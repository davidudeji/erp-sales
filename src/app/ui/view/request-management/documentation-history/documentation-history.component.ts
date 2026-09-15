import { Component, OnInit } from '@angular/core';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { QuotationManagementService } from '../../../service/procurement/quotation-management.service';
import { VendorService } from '../../../service/vendor-portal/vendor.service';
import { ProcurementRequest } from '../../../domain/procurement-request/procurement.dto';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Component({
  selector: 'app-documentation-history',
  templateUrl: './documentation-history.component.html',
  styleUrl: './documentation-history.component.scss'
})
export class DocumentationHistoryComponent implements OnInit {
  requests: ProcurementRequest[] = [];
  isLoading = false;
  showModal = false;
  selectedRequest: ProcurementRequest | null = null;
  selectedDocType: 'rfq' | 'quotation' | 'lpo' | 'invoice' = 'rfq';
  isDownloading = false;
  isLoadingDocs = false;

  quotationDoc: any = null;
  lpoDoc: any = null;
  invoiceDoc: any = null;

  constructor(
    private procurementService: ProcurementRequestService,
    private quotationService: QuotationManagementService,
    private vendorService: VendorService
  ) { }

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.isLoading = true;
    this.procurementService.getRequests({ page: 0, size: 100, status: 'ALL' }).subscribe({
      next: (response) => {
        this.requests = response.data || [];
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading requests:', err);
        this.isLoading = false;
      }
    });
  }

  openArchiveModal(request: ProcurementRequest): void {
    this.selectedRequest = request;
    this.showModal = true;
    this.selectedDocType = 'rfq';
    this.quotationDoc = null;
    this.lpoDoc = null;
    this.invoiceDoc = null;
    this.loadDocuments(request);
  }

  closeArchiveModal(): void {
    this.showModal = false;
    this.selectedRequest = null;
    this.quotationDoc = null;
    this.lpoDoc = null;
    this.invoiceDoc = null;
  }

  loadDocuments(request: ProcurementRequest): void {
    this.isLoadingDocs = true;

    const quotation$ = (request as any).selectedQuotationId
      ? this.quotationService.getQuotation((request as any).selectedQuotationId).pipe(catchError(() => of(null)))
      : of(null);

    const vendorId = (request as any).selectedVendorId;
    const lpos$ = vendorId
      ? this.vendorService.getLposByVendorId(vendorId).pipe(catchError(() => of([])))
      : of([]);

    const invoices$ = vendorId
      ? this.vendorService.getInvoicesByVendorId(vendorId).pipe(catchError(() => of([])))
      : of([]);

    forkJoin({ quotation: quotation$, lpos: lpos$, invoices: invoices$ }).subscribe({
      next: ({ quotation, lpos, invoices }) => {
        this.quotationDoc = quotation;

        const lpoId = (request as any).selectedLpoId;
        this.lpoDoc = lpoId
          ? (lpos as any[]).find((l: any) => String(l.id) === String(lpoId) || l.lpoNumber === (request as any).selectedLpoNumber) || null
          : (lpos as any[]).find((l: any) => l.quotationId && String(l.quotationId) === String((request as any).selectedQuotationId)) || null;

        this.invoiceDoc = this.lpoDoc
          ? (invoices as any[]).find((inv: any) => String(inv.lpoId) === String(this.lpoDoc.id) || inv.lpoNumber === this.lpoDoc.lpoNumber) || null
          : null;

        this.isLoadingDocs = false;
      },
      error: () => { this.isLoadingDocs = false; }
    });
  }

  isUnlocked(type: 'rfq' | 'quotation' | 'lpo' | 'invoice'): boolean {
    if (!this.selectedRequest) return false;
    const status = (this.selectedRequest as any).status;

    switch (type) {
      case 'rfq':
        return true;
      case 'quotation':
        return status !== 'PENDING' && status !== 'DRAFT' && status !== 'PENDING_APPROVAL' && status !== 'REJECTED' && status !== 'CANCELLED';
      case 'lpo':
        return ['LPO_ISSUED', 'PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'DELIVERY_IN_PROGRESS', 'DELIVERED'].includes(status);
      case 'invoice':
        return ['PAYMENT_PENDING', 'PAYMENT_CONFIRMED', 'DELIVERY_IN_PROGRESS', 'DELIVERED'].includes(status);
      default:
        return false;
    }
  }

  selectDocType(type: 'rfq' | 'quotation' | 'lpo' | 'invoice'): void {
    if (this.isUnlocked(type)) {
      this.selectedDocType = type;
    }
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'PENDING': 'status-pending',
      'VENDORS_QUOTING': 'status-quoting',
      'VENDOR_SELECTED': 'status-selected',
      'LPO_ISSUED': 'status-lpo-issued',
      'PAYMENT_PENDING': 'status-payment-pending',
      'PAYMENT_CONFIRMED': 'status-payment-confirmed',
      'DELIVERY_IN_PROGRESS': 'status-delivering',
      'DELIVERED': 'status-delivered',
      'CANCELLED': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PENDING': 'Pending RFQ',
      'VENDORS_QUOTING': 'Vendors Quoting',
      'VENDOR_SELECTED': 'Vendor Selected',
      'LPO_ISSUED': 'LPO Issued',
      'PAYMENT_PENDING': 'Payment Pending',
      'PAYMENT_CONFIRMED': 'Payment Confirmed',
      'DELIVERY_IN_PROGRESS': 'Delivery In Progress',
      'DELIVERED': 'Delivered',
      'CANCELLED': 'Cancelled'
    };
    return labels[status] || status;
  }

  downloadCurrentDocPDF(): void {
    const element = document.getElementById('preview-document-container');
    if (!element || !this.selectedRequest) return;

    this.isDownloading = true;
    const docTitle = `${this.selectedDocType.toUpperCase()}-${(this.selectedRequest as any).id}`;

    html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true
    }).then((canvas) => {
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`${docTitle}.pdf`);
      this.isDownloading = false;
    }).catch(err => {
      console.error('Error generating PDF:', err);
      this.isDownloading = false;
    });
  }

  formatCurrency(amount: number, currency: string = 'NGN'): string {
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
