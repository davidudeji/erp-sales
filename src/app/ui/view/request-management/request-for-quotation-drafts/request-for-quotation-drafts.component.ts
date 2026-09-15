import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { ProcurementRequest, RequestStatus } from '../../../domain/procurement-request/procurement.dto';
import { ExtendedProcurementRequest } from '../../../service/procurement/rfq-quotation-bridge.util';

@Component({
  selector: 'app-request-for-quotation-drafts',
  templateUrl: './request-for-quotation-drafts.component.html',
  styleUrls: ['./request-for-quotation-drafts.component.scss']
})
export class RequestForQuotationDraftsComponent implements OnInit, OnDestroy {
  drafts: ExtendedProcurementRequest[] = [];
  isLoading = false;
  private destroy$ = new Subject<void>();

  constructor(
    private procurementRequestService: ProcurementRequestService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadDrafts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDrafts(): void {
    this.isLoading = true;
    this.procurementRequestService.getRequests({
      status: 'DRAFT',
      page: 0,
      size: 100
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (page) => {
          this.drafts = page.data;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading drafts:', err);
          this.isLoading = false;
        }
      });
  }

  continueDraft(row: ProcurementRequest): void {
    const typePath = row.procurementType?.toLowerCase() === 'service' ? 'service' : 'product';
    this.router.navigate(['/admin/sales/commerce/requests/new', typePath, row.id]);
  }

  deleteDraft(row: ProcurementRequest): void {
    const confirmDelete = window.confirm(`Are you sure you want to delete draft "${row.title}"?`);
    if (confirmDelete) {
      this.isLoading = true;
      this.procurementRequestService.deleteRequest(row.id)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.loadDrafts();
          },
          error: (err) => {
            console.error('Error deleting draft:', err);
            this.isLoading = false;
          }
        });
    }
  }

  goBack(): void {
    this.router.navigate(['/admin/sales/commerce/requests']);
  }

  formatBudget(row: ProcurementRequest): string {
    return `${row.currency} ${Number(row.totalBudget || 0).toLocaleString()}`;
  }

  formatDate(value: string | Date | undefined): string {
    if (!value) return '-';
    return new Date(value).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  truncate(value: string | undefined, limit: number): string {
    if (!value) return '';
    return value.length > limit ? `${value.slice(0, limit)}...` : value;
  }
}
