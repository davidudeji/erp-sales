// rfq-preview.component.ts

import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ProcurementRequest, RFQTemplate, VendorSuggestion } from '../../../domain/procurement-request/procurement.dto';
import { ExtendedProcurementRequest, parseIdToNumber } from '../../../service/procurement/rfq-quotation-bridge.util';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { MessageService } from 'primeng/api';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

@Component({
  selector: 'app-rfq-preview',
  templateUrl: './rfq-preview.component.html',
  styleUrls: ['./rfq-preview.component.scss']
})
export class RfqPreviewComponent implements OnInit {
  request: ExtendedProcurementRequest | null = null;
  template: RFQTemplate | null = null;
  vendors: VendorSuggestion[] = [];
  isLoading = false;
  isDownloading = false;
  isSubmitting = false;
  requestId: string | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private procurementService: ProcurementRequestService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.requestId = this.route.snapshot.paramMap.get('uuid');
    if (this.requestId) {
      this.loadRequestDetails(this.requestId);
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
        if (this.request.vendorsToNotify && this.request.vendorsToNotify.length > 0) {
          this.loadVendorDetails(this.request.vendorsToNotify);
        }
      },
      error: (err) => {
        console.error('Error loading request details:', err);
        this.isLoading = false;
      }
    });
  }

  loadTemplateDetails(templateId: string): void {
    this.procurementService.getRFQTemplate(templateId).subscribe({
      next: (tpl) => { this.template = tpl; },
      error: () => {
        this.template = {
          id: 'default', name: 'Standard RFQ', description: 'Default template',
          layout: 'STANDARD', isDefault: true, sections: [],
          createdBy: 'system', createdAt: new Date(), updatedAt: new Date()
        };
      }
    });
  }

  loadVendorDetails(vendorIds: string[]): void {
    if (!vendorIds || vendorIds.length === 0) { this.vendors = []; return; }
    this.procurementService.getVendorSuggestions(parseIdToNumber(this.requestId!)).subscribe({
      next: (suggestions) => {
        const idSet = new Set(vendorIds);
        this.vendors = suggestions.filter(v => idSet.has(v.vendorId));
      },
      error: () => { this.vendors = []; }
    });
  }

  formatBudget(value: number, currency?: string): string {
    const curr = currency || this.request?.currency || 'NGN';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: curr }).format(value || 0);
  }

  formatDate(date: any): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  getTemplateClass(): string {
    if (!this.template) return 'layout-standard';
    return `layout-${this.template.layout.toLowerCase()}`;
  }

  downloadPDF(): void {
    const element = document.getElementById('rfq-preview-document');
    if (element) {
      this.isDownloading = true;
      html2canvas(element, { scale: 2, useCORS: true, allowTaint: true }).then((canvas) => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`RFQ-${this.request?.id || 'Draft'}.pdf`);
        this.isDownloading = false;
      }).catch(err => {
        console.error('Error generating PDF:', err);
        this.isDownloading = false;
      });
    }
  }

  onBack(): void {
    if (this.requestId) {
      const typePath = this.request?.procurementType === 'SERVICE' ? 'service' : 'product';
      this.router.navigate(['/admin/sales/commerce/requests/new', typePath, this.requestId, 'vendors']);
    } else {
      this.router.navigate(['/admin/sales/commerce/requests/new']);
    }
  }

  onSubmit(): void {
    if (!this.requestId || !this.request) return;
    this.isSubmitting = true;
    this.procurementService.submitForApproval(parseIdToNumber(this.requestId)).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'success',
          summary: 'Request Submitted',
          detail: 'Your procurement request has been submitted for approval. Vendors will be notified once all approval stages are completed.'
        });
        setTimeout(() => this.router.navigate(['/admin/sales/commerce/requests', this.requestId]), 1500);
      },
      error: (err) => {
        console.error('Failed to submit request:', err);
        this.isSubmitting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Submission Failed',
          detail: 'Could not submit the request. Ensure the "Commerce Procurement" approval workflow is configured in Settings → Approval Workflows.'
        });
      }
    });
  }
}
