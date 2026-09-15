import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { QuotationManagementService } from '../../../service/procurement/quotation-management.service';
import { VendorQuotation, VendorQuotationStatus } from '../../../domain/procurement-request/procurement.dto';
import { ExtendedProcurementRequest } from '../../../service/procurement/rfq-quotation-bridge.util';
import { MessageService } from 'primeng/api';

export interface LocalRFQWithQuotations {
  rfq: ExtendedProcurementRequest;
  quotations: VendorQuotation[];
  summary: any;
}

@Component({
  selector: 'app-rfq-detail-with-quotations',
  templateUrl: './rfq-detail-with-quotations.component.html',
  styleUrls: ['./rfq-detail-with-quotations.component.scss']
})
export class RfqDetailWithQuotationsComponent implements OnInit, OnDestroy {
  rfqId: string | null = null;
  rfqData: LocalRFQWithQuotations | null = null;
  isLoading = false;
  showVendorSummaryModal = false;
  selectedQuotation: VendorQuotation | null = null;
  showQuotationDetailModal = false;
  isProcessing = false;
  activeTab: 'quotations' | 'messages' = 'quotations';

  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private route: ActivatedRoute,
    public router: Router,
    private quotationService: QuotationManagementService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.rfqId = params.get('id');
      if (this.rfqId) {
        this.loadRFQDetails();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadRFQDetails(): void {
    if (!this.rfqId) return;

    this.isLoading = true;
    this.quotationService.getQuotationsForRFQ(this.rfqId).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.rfqData = data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading RFQ details:', err);
        this.isLoading = false;
      }
    });
  }

  openVendorSummary(): void {
    this.showVendorSummaryModal = true;
  }

  closeVendorSummary(): void {
    this.showVendorSummaryModal = false;
  }

  viewQuotationDetail(quotation: VendorQuotation): void {
    this.selectedQuotation = quotation;
    this.showQuotationDetailModal = true;

    // Mark as viewed
    if (!quotation.isViewed) {
      this.quotationService.markAsViewed(quotation.id).subscribe();
    }
  }

  closeQuotationDetail(): void {
    this.showQuotationDetailModal = false;
    this.selectedQuotation = null;
  }

  acceptQuotation(quotationId: string | number): void {
    if (confirm('Are you sure you want to accept this quotation? You\'ll generate and send the LPO as a separate step afterward.')) {
      this.isProcessing = true;
      this.quotationService.acceptQuotation(quotationId).subscribe({
        next: (response) => {
          this.isProcessing = false;
          this.closeQuotationDetail();
          this.loadRFQDetails(); // Refresh data
          this.messageService.add({ severity: 'info', summary: 'Notice', detail: response.message || 'Quotation accepted. You can now generate the LPO from the LPO preview screen.' });
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('Error accepting quotation:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to accept quotation. Please try again.' });
        }
      });
    }
  }

  rejectQuotation(quotationId: string | number): void {
    const reason = prompt('Please provide a reason for rejecting this quotation:');
    if (reason !== null && reason.trim()) {
      this.isProcessing = true;
      this.quotationService.rejectQuotation(quotationId, reason.trim()).subscribe({
        next: () => {
          this.isProcessing = false;
          this.closeQuotationDetail();
          this.loadRFQDetails(); // Refresh data
          this.messageService.add({ severity: 'info', summary: 'Notice', detail: 'Quotation has been rejected.' });
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('Error rejecting quotation:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to reject quotation. Please try again.' });
        }
      });
    }
  }

  cancelPendingVendor(rfqId: number, vendorId: string, vendorName: string): void {
    if (confirm(`Are you sure you want to cancel the RFQ sent to ${vendorName}? This action cannot be undone.`)) {
      this.isProcessing = true;
      this.quotationService.cancelPendingQuotation(String(rfqId), vendorId).subscribe({
        next: () => {
          this.isProcessing = false;
          this.loadRFQDetails(); // Refresh data
          this.messageService.add({ severity: 'info', summary: 'Notice', detail: `RFQ to ${vendorName} has been cancelled.` });
        },
        error: (err) => {
          this.isProcessing = false;
          console.error('Error cancelling vendor:', err);
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to cancel. Please try again.' });
        }
      });
    }
  }

  getStatusColor(status: VendorQuotationStatus): string {
    const colors: Record<VendorQuotationStatus, string> = {
      'PENDING': '#f59e0b',
      'SUBMITTED': '#3b82f6',
      'ACCEPTED': '#22c55e',
      'DECLINED': '#ef4444',
      'EXPIRED': '#6b7280',
      'WITHDRAWN': '#8b5cf6',
      'LPO_GENERATED': '#184440',
      'LPO_SENT': '#22c55e',
      'REVIEW_REQUESTED': '#f97316'
    };
    return colors[status] || '#6b7280';
  }

  getStatusLabel(status: VendorQuotationStatus): string {
    const labels: Record<VendorQuotationStatus, string> = {
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

  getStatusIcon(status: VendorQuotationStatus): string {
    const icons: Record<VendorQuotationStatus, string> = {
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

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'NGN'
    }).format(amount || 0);
  }

  formatDate(date: any): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getDaysRemaining(expiresAt: Date): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }
}