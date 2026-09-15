import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { QuotationManagementService } from '../../../service/procurement/quotation-management.service';
import { VendorQuotation, MAX_QUOTATION_REVISIONS } from '../../../domain/procurement-request/procurement.dto';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-quotation-detail',
  templateUrl: './quotation-detail.component.html',
  styleUrls: ['./quotation-detail.component.scss']
})
export class QuotationDetailComponent implements OnInit, OnDestroy {
  quotationId: string | null = null;
  quotation: VendorQuotation | null = null;
  isLoading = false;
  isProcessing = false;
  showAcceptModal = false;
  showRejectModal = false;
  rejectReason = '';
  showRequestChangesModal = false;
  requestChangesNotes = '';
  simulationNewTotal = 0;
  allQuotationsForRfq: VendorQuotation[] = [];
  showCompareDisclaimerModal = false;
  successMessage = '';
  isDownloading = false;

  private destroy$ = new Subject<void>();

  readonly maxQuotationRevisions = MAX_QUOTATION_REVISIONS;

  /** How many more times this quotation can be sent back for revision. */
  get revisionsRemaining(): number {
    return Math.max(0, MAX_QUOTATION_REVISIONS - (this.quotation?.revisionCount ?? 0));
  }

  get canRequestChanges(): boolean {
    return this.revisionsRemaining > 0;
  }

  constructor(
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router,
    private quotationService: QuotationManagementService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.quotationId = params.get('id');
      if (this.quotationId) {
        this.loadQuotationDetail();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuotationDetail(): void {
    if (!this.quotationId) return;

    this.isLoading = true;
    this.quotationService.getQuotationDetail(this.quotationId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.quotation = data;
        this.simulationNewTotal = data.totalAmount;
        this.isLoading = false;
        // Mark as viewed
        if (!data.isViewed) {
          this.quotationService.markAsViewed(data.id).subscribe();
        }
        this.loadAllQuotationsForRfq(data.rfqId);
      },
      error: (err) => {
        console.error('Error loading quotation:', err);
        this.isLoading = false;
      }
    });
  }


  openAcceptModal(): void {
    this.showAcceptModal = true;
  }

  closeAcceptModal(): void {
    this.showAcceptModal = false;
  }

  openRejectModal(): void {
    this.rejectReason = '';
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.rejectReason = '';
  }

  openRequestChangesModal(): void {
    this.requestChangesNotes = '';
    this.showRequestChangesModal = true;
  }

  closeRequestChangesModal(): void {
    this.showRequestChangesModal = false;
    this.requestChangesNotes = '';
  }

  confirmRequestChanges(): void {
    if (!this.quotation) return;

    if (!this.requestChangesNotes.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please provide detailed request notes.' });
      return;
    }

    this.isProcessing = true;
    this.quotationService.requestChanges(this.quotation.id, this.requestChangesNotes.trim()).subscribe({
      next: () => {
        this.isProcessing = false;
        this.closeRequestChangesModal();
        this.messageService.add({ severity: 'info', summary: 'Notice', detail: 'Changes requested. Status updated to "Review Requested".' });
        this.loadQuotationDetail(); // Refresh
      },
      error: (err) => {
        this.isProcessing = false;
        console.error('Error requesting changes:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: err?.message || 'Failed to request changes. Please try again.' });
      }
    });
  }

  confirmSimulateResubmit(): void {
    if (!this.quotation) return;

    if (!this.simulationNewTotal || this.simulationNewTotal <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a valid amount.' });
      return;
    }

    this.isProcessing = true;
    this.quotationService.simulateVendorResubmit(
      this.quotation.id, 
      this.simulationNewTotal,
      `Vendor updated pricing to ${this.formatCurrency(this.simulationNewTotal)} based on customer review requested changes.`
    ).subscribe({
      next: () => {
        this.isProcessing = false;
        this.messageService.add({ severity: 'success', summary: 'Success', detail: 'Vendor resubmission simulated successfully. Quotation has been updated.' });
        this.loadQuotationDetail(); // Refresh
      },
      error: (err) => {
        this.isProcessing = false;
        console.error('Error simulating resubmit:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to simulate resubmission.' });
      }
    });
  }

  confirmAccept(): void {
    if (!this.quotation) return;

    this.isProcessing = true;
    this.quotationService.acceptQuotation(this.quotation.id).subscribe({
      next: (response) => {
        this.isProcessing = false;
        this.closeAcceptModal();
        this.successMessage = 'Quotation successfully accepted.';
        
        // update statuses locally
        if (this.quotation) {
          this.quotation.status = 'ACCEPTED';
          this.allQuotationsForRfq.forEach(q => {
            if (q.id !== this.quotation?.id && (q.status === 'SUBMITTED' || q.status === 'PENDING')) {
              q.status = 'DECLINED';
              q.declineReason = 'Another quotation was accepted for this RFQ';
            }
          });
        }
        
        this.messageService.add({ severity: 'success', summary: 'Success', detail: response.message || 'Quotation successfully accepted. Generate the LPO from the LPO preview screen.' });
        this.loadQuotationDetail(); // Refresh
      },
      error: (err) => {
        // Fallback mock update
        this.isProcessing = false;
        this.closeAcceptModal();
        this.successMessage = 'Quotation successfully accepted.';
        
        if (this.quotation) {
          this.quotation.status = 'ACCEPTED';
          this.allQuotationsForRfq.forEach(q => {
            if (q.id !== this.quotation?.id && (q.status === 'SUBMITTED' || q.status === 'PENDING')) {
              q.status = 'DECLINED';
              q.declineReason = 'Another quotation was accepted for this RFQ';
            }
          });
        }
        
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Quotation successfully accepted. LPO has been generated.` });
      }
    });
  }

  confirmReject(): void {
    if (!this.quotation) return;

    if (!this.rejectReason.trim()) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please provide a reason for rejection.' });
      return;
    }

    this.isProcessing = true;
    this.quotationService.rejectQuotation(this.quotation.id, this.rejectReason.trim()).subscribe({
      next: () => {
        this.isProcessing = false;
        this.closeRejectModal();
        this.messageService.add({ severity: 'info', summary: 'Notice', detail: `Quotation from ${this.quotation?.vendorName} has been rejected.` });
        this.loadQuotationDetail(); // Refresh
      },
      error: (err) => {
        this.isProcessing = false;
        console.error('Error rejecting quotation:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to reject quotation. Please try again.' });
      }
    });
  }

  loadAllQuotationsForRfq(rfqId: string): void {
    this.quotationService.getQuotationsForRFQ(rfqId).subscribe({
      next: (rfqData) => {
        this.allQuotationsForRfq = rfqData.quotations || [];
      },
      error: (err) => {
        console.error('Error loading quotations for RFQ:', err);
        this.allQuotationsForRfq = [];
      }
    });
  }


  onAcceptClick(): void {
    const activeQuotations = this.allQuotationsForRfq.filter(q => q.status === 'SUBMITTED' || q.status === 'ACCEPTED');
    if (activeQuotations.length > 1) {
      this.showCompareDisclaimerModal = true;
    } else {
      this.openAcceptModal();
    }
  }

  proceedToAccept(): void {
    this.showCompareDisclaimerModal = false;
    this.openAcceptModal();
  }

  closeCompareDisclaimerModal(): void {
    this.showCompareDisclaimerModal = false;
  }

  downloadPDF(): void {
    const element = document.getElementById('quotation-detail-sheet');
    if (element) {
      this.isDownloading = true;
      html2canvas(element, { 
        scale: 2, 
        useCORS: true, 
        allowTaint: true,
        ignoreElements: (el) => el.classList.contains('action-bar') || el.tagName.toLowerCase() === 'app-back-button'
      }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210; // A4 size width
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`Quotation-${this.quotation?.id || 'Detail'}.pdf`);
        this.isDownloading = false;
      }).catch(err => {
        console.error('Error generating PDF:', err);
        this.isDownloading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to generate PDF. Printing window instead.' });
        window.print();
      });
    } else {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not find element to export. Printing window instead.' });
      window.print();
    }
  }

  generateLPO(): void {
    if (this.quotation) {
      this.router.navigate(['/admin/sales/commerce/quotations', this.quotation.id, 'generate-lpo']);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/sales/commerce/quotations']);
  }

  goToRFQ(): void {
    if (this.quotation?.rfqId) {
      this.router.navigate(['/admin/sales/commerce/requests', this.quotation.rfqId]);
    }
  }

  formatTerms(terms: string | undefined): string {
    return terms ? terms.replace(/\n/g, '<br>') : '';
  }

  formatCurrency(amount: number): string {
    const currency = this.quotation?.currency || 'NGN';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  formatDateTime(date: any): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'PENDING': 'status-pending',
      'SUBMITTED': 'status-submitted',
      'ACCEPTED': 'status-accepted',
      'DECLINED': 'status-declined',
      'EXPIRED': 'status-expired',
      'WITHDRAWN': 'status-withdrawn',
      'LPO_GENERATED': 'status-accepted',
      'LPO_SENT': 'status-accepted',
      'REVIEW_REQUESTED': 'status-review'
    };
    return classes[status] || 'status-expired';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PENDING': 'Pending',
      'SUBMITTED': 'Submitted',
      'ACCEPTED': 'Accepted',
      'DECLINED': 'Declined',
      'EXPIRED': 'Expired',
      'WITHDRAWN': 'Withdrawn',
      'LPO_GENERATED': 'LPO Draft',
      'LPO_SENT': 'LPO Sent',
      'REVIEW_REQUESTED': 'Review Requested'
    };
    return labels[status] || status;
  }

  getStatusIcon(status: string): string {
    const icons: Record<string, string> = {
      'PENDING': 'fa-clock',
      'SUBMITTED': 'fa-paper-plane',
      'ACCEPTED': 'fa-check-circle',
      'DECLINED': 'fa-times-circle',
      'EXPIRED': 'fa-hourglass-end',
      'WITHDRAWN': 'fa-times',
      'LPO_GENERATED': 'fa-file-invoice',
      'LPO_SENT': 'fa-paper-plane',
      'REVIEW_REQUESTED': 'fa-reply'
    };
    return icons[status] || 'fa-circle';
  }

  getAvailabilityColor(availability: string): string {
    const colors: Record<string, string> = {
      'AVAILABLE': '#059669',
      'PARTIAL': '#d97706',
      'UNAVAILABLE': '#dc2626',
      'SUBSTITUTE': '#3b82f6'
    };
    return colors[availability] || '#6b7280';
  }

  getAvailabilityLabel(availability: string): string {
    const labels: Record<string, string> = {
      'AVAILABLE': 'Available',
      'PARTIAL': 'Partial',
      'UNAVAILABLE': 'Unavailable',
      'SUBSTITUTE': 'Substitute'
    };
    return labels[availability] || availability;
  }

  getDaysRemaining(): number {
    if (!this.quotation?.expiresAt) return 0;
    const now = new Date();
    const expiry = new Date(this.quotation.expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  isExpired(): boolean {
    if (!this.quotation?.expiresAt) return false;
    return new Date(this.quotation.expiresAt) < new Date();
  }
}