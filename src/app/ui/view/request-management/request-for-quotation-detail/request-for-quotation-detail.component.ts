import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcurementRequest, RFQTemplate, VendorSuggestion } from '../../../domain/procurement-request/procurement.dto';
import { ExtendedProcurementRequest, parseIdToNumber } from '../../../service/procurement/rfq-quotation-bridge.util';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-request-for-quotation-detail',
  templateUrl: './request-for-quotation-detail.component.html',
  styleUrls: ['./request-for-quotation-detail.component.scss']
})
export class RequestForQuotationDetailComponent implements OnInit {
  request: ExtendedProcurementRequest | null = null;
  isLoading = false;
  isDownloading = false;
  showCancelDialog = false;
  cancellationReason = '';
  template: RFQTemplate | null = null;
  vendors: VendorSuggestion[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private procurementService: ProcurementRequestService
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadRequestDetails(id);
    }
  }

  loadRequestDetails(id: string): void {
    this.isLoading = true;
    this.procurementService.getRequest(parseIdToNumber(id)).subscribe({
      next: (req) => {
        this.request = req as ExtendedProcurementRequest;
        this.isLoading = false;
        if (this.request?.rfqTemplateId) {
          this.loadTemplateDetails(this.request.rfqTemplateId);
        }
        this.loadVendorSuggestions(id);
      },
      error: (err) => {
        console.error('Error loading request details:', err);
        this.isLoading = false;
      }
    });
  }

  loadTemplateDetails(templateId: string): void {
    this.procurementService.getRFQTemplate(templateId).subscribe({
      next: (tpl) => {
        this.template = tpl;
      }
    });
  }

  loadVendorSuggestions(requestId: string): void {
    this.procurementService.getVendorSuggestions(parseIdToNumber(requestId)).subscribe({
      next: (suggestions) => {
        if (this.request?.selectedVendors && this.request.selectedVendors.length > 0) {
          this.vendors = suggestions.filter(v => 
            this.request?.selectedVendors?.includes(v.vendorId)
          );
        } else {
          this.vendors = suggestions.slice(0, 3);
        }
      }
    });
  }

  getStatusClass(status: string): string {
    if (!status) return 'pending';
    return status.toLowerCase();
  }

  getStatusLabel(status: string): string {
    if (!status) return 'Pending';
    return status.replace(/_/g, ' ');
  }

  formatBudget(value: number, currency?: string): string {
    const curr = currency || this.request?.currency || 'NGN';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: curr 
    }).format(value || 0);
  }

  formatDate(date: any): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/sales/commerce/requests']);
  }

  triggerCancel(): void {
    this.showCancelDialog = true;
  }

  closeCancelDialog(): void {
    this.showCancelDialog = false;
    this.cancellationReason = '';
  }

  confirmCancel(): void {
    if (this.request && this.cancellationReason.trim()) {
      this.procurementService.cancelRequest(this.request.id, this.cancellationReason).subscribe({
        next: () => {
          if (this.request) {
            this.request.status = 'CANCELLED';
            this.request.cancellationReason = this.cancellationReason;
            this.request.cancelledAt = new Date();
          }
          this.closeCancelDialog();
        },
        error: (err) => {
          console.error('Error cancelling request:', err);
        }
      });
    }
  }

  getFileIcon(fileType: string | undefined): string {
    if (!fileType) return 'fa-file';
    if (fileType.includes('pdf')) return 'fa-file-pdf';
    if (fileType.includes('image')) return 'fa-file-image';
    if (fileType.includes('excel') || fileType.includes('spreadsheet') || fileType.includes('csv')) return 'fa-file-excel';
    if (fileType.includes('word') || fileType.includes('document')) return 'fa-file-word';
    return 'fa-file';
  }

  downloadPDF(): void {
    const element = document.getElementById('rfq-detail-sheet');
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
        pdf.save(`RFQ-Detail-${this.request?.id || 'Request'}.pdf`);
        this.isDownloading = false;
      }).catch(err => {
        console.error('Error generating PDF:', err);
        this.isDownloading = false;
      });
    }
  }

  canEdit(request: ProcurementRequest): boolean {
    const nonEditableStatuses = ['DELIVERED', 'CANCELLED'];
    return !nonEditableStatuses.includes(request.status);
  }

  goEdit(): void {
    if (this.request) {
      const typePath = this.request.procurementType?.toLowerCase() === 'service' ? 'service' : 'product';
      this.router.navigate(['/admin/sales/commerce/requests/new', typePath, this.request.id]);
    }
  }
}
