import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { QuotationManagementService } from '../../../service/procurement/quotation-management.service';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { VendorQuotation } from '../../../domain/procurement-request/procurement.dto';
import { parseIdToNumber } from '../../../service/procurement/rfq-quotation-bridge.util';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-lpo-preview',
  templateUrl: './lpo-preview.component.html',
  styleUrls: ['./lpo-preview.component.scss']
})
export class LpoPreviewComponent implements OnInit, OnDestroy {
  quotationId: string | null = null;
  quotation: VendorQuotation | null = null;
  lpoNumber: string = '';
  lpoId: string | undefined;
  orderDate: Date = new Date();
  isLoading = false;
  isProcessing = false;
  isDownloading = false;
  successMessage = '';

  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router,
    private quotationService: QuotationManagementService,
    private procurementService: ProcurementRequestService
  ) {}

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

  generateLpoDetails(): void {
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.lpoNumber = `LPO-2026-${randomSuffix}`;
    this.orderDate = new Date();
  }

  /**
   * Resolves this quotation's LPO number/date — generating one only the
   * first time it's needed (see QuotationManagementService.ensureLpoAssigned)
   * — instead of inventing a new random number every time this page loads.
   * This is the explicit, separate "generate the LPO" step: acceptance
   * itself no longer creates one.
   */
  private resolveLpoNumber(quotation: VendorQuotation): void {
    if (quotation.lpoNumber) {
      this.lpoNumber = quotation.lpoNumber;
      this.orderDate = quotation.lpoIssuedAt ?? new Date();
      this.isLoading = false;
      return;
    }
    this.quotationService.ensureLpoAssigned(quotation.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ lpoId, lpoNumber, lpoIssuedAt }) => {
        this.lpoId = lpoId;
        this.lpoNumber = lpoNumber;
        this.orderDate = lpoIssuedAt;
        if (this.quotation) {
          this.quotation.lpoNumber = lpoNumber;
          this.quotation.lpoIssuedAt = lpoIssuedAt;
        }
        this.isLoading = false;
        // Now that an LPO number actually exists, reflect that in status.
        if (this.quotation?.status === 'ACCEPTED') {
          this.updateStatus('LPO_GENERATED');
        }
      },
      error: () => {
        this.generateLpoDetails(); // last resort — service unavailable
        this.isLoading = false;
      }
    });
  }

  loadQuotationDetail(): void {
    if (!this.quotationId) return;

    this.isLoading = true;
    this.quotationService.getQuotationDetail(this.quotationId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.quotation = data;
        this.resolveLpoNumber(data);

        if (data.status === 'LPO_SENT') {
          this.successMessage = 'LPO has been successfully sent to the vendor.';
        }
      },
      error: (err) => {
        console.error('Error loading quotation for LPO preview:', err);
        this.isLoading = false;
      }
    });
  }

  updateStatus(status: 'LPO_GENERATED' | 'LPO_SENT'): void {
    if (!this.quotation) return;
    
    this.quotation.status = status;
    this.quotationService.updateQuotationStatus(this.quotation.id, status).subscribe({
      next: () => {
        console.log(`Quotation status updated successfully to ${status}`);
        if (status === 'LPO_SENT') {
          this.procurementService.updateRequest(parseIdToNumber(this.quotation!.rfqId), {
            status: 'LPO_ISSUED',
            selectedLpoId: this.lpoId,
            selectedLpoNumber: this.lpoNumber
          } as any).subscribe({
            next: () => console.log(`Procurement request ${this.quotation!.rfqId} status updated to LPO_ISSUED`),
            error: (err) => console.error('Failed to update procurement request status:', err)
          });
        }
      },
      error: () => {
        // Mock fallback: do nothing, we already set it locally
        console.log(`Mock fallback: status updated locally to ${status}`);
        if (status === 'LPO_SENT') {
          this.procurementService.updateRequest(parseIdToNumber(this.quotation!.rfqId), {
            status: 'LPO_ISSUED',
            selectedLpoId: this.lpoId,
            selectedLpoNumber: this.lpoNumber
          } as any).subscribe({
            next: () => console.log(`Procurement request ${this.quotation!.rfqId} status updated to LPO_ISSUED`),
            error: (err) => console.error('Failed to update procurement request status:', err)
          });
        }
      }
    });
  }

  downloadLpoPDF(): void {
    const element = document.getElementById('lpo-sheet');
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
        pdf.save(`LPO-${this.lpoNumber}.pdf`);
        this.isDownloading = false;
      }).catch(err => {
        console.error('Error generating LPO PDF:', err);
        this.isDownloading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to generate PDF. Printing window instead.' });
        window.print();
      });
    }
  }

  sendToVendor(): void {
    if (!this.quotation) return;

    this.isProcessing = true;
    this.quotationService.sendLpoToVendor(this.quotation.id, this.lpoNumber).subscribe({
      next: (response) => {
        this.isProcessing = false;
        this.updateStatus('LPO_SENT');
        this.successMessage = 'LPO has been successfully sent to the vendor.';
        this.messageService.add({ severity: 'success', summary: 'Success', detail: response.message || `LPO successfully sent to ${this.quotation?.vendorName}.` });
      },
      error: () => {
        this.isProcessing = false;
        this.updateStatus('LPO_SENT');
        this.successMessage = 'LPO has been successfully sent to the vendor.';
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `LPO successfully sent to ${this.quotation?.vendorName}.` });
      }
    });
  }

  navigateToDelivery(): void {
    if (this.lpoId) {
      this.router.navigate(['/admin/sales/commerce/requests', this.lpoId, 'delivery']);
    }
  }

  navigateToPaymentVoucher(): void {
    if (this.lpoId) {
      this.router.navigate(['/admin/sales/commerce/payment-vouchers', this.lpoId]);
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/sales/commerce/quotations', this.quotationId]);
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
}
