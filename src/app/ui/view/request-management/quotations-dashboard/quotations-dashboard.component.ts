import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { QuotationManagementService } from '../../../service/procurement/quotation-management.service';
import { VendorQuotation } from '../../../domain/procurement-request/procurement.dto';

export interface RFQGroup {
  rfqId: string;
  rfqTitle: string;
  receivedCount: number;
  totalCount: number;
  quotes: VendorQuotation[];
}

@Component({
  selector: 'app-quotations-dashboard',
  templateUrl: './quotations-dashboard.component.html',
  styleUrls: ['./quotations-dashboard.component.scss']
})
export class QuotationsDashboardComponent implements OnInit, OnDestroy {
  Math = Math;
  quotations: VendorQuotation[] = [];
  rfqGroups: RFQGroup[] = [];
  filteredRfqGroups: RFQGroup[] = [];
  paginatedRfqGroups: RFQGroup[] = [];
  selectedRfqGroup: RFQGroup | null = null;
  showVendorSummaryModal = false;
  isLoading = false;

  selectedStatus: string = 'ALL';
  searchTerm: string = '';
  dateRange: string = 'month';
  dateFrom: string = '';
  dateTo: string = '';

  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  sortField = 'mostRecent';
  sortAsc = false;

  statusOptions = [
    { value: 'ALL', label: 'All Requests' },
    { value: 'SUBMITTED', label: 'Submitted', color: '#3b82f6' },
    { value: 'ACCEPTED', label: 'Accepted', color: '#22c55e' },
    { value: 'LPO_GENERATED', label: 'LPO Draft', color: '#184440' },
    { value: 'LPO_SENT', label: 'LPO Sent', color: '#22c55e' },
    { value: 'DECLINED', label: 'Declined', color: '#ef4444' },
    { value: 'PENDING', label: 'Pending', color: '#f59e0b' },
    { value: 'EXPIRED', label: 'Expired', color: '#6b7280' },
    { value: 'REVIEW_REQUESTED', label: 'Review Requested', color: '#f97316' }
  ];

  stats = {
    total: 0,
    pending: 0,
    submitted: 0,
    accepted: 0,
    declined: 0,
    expired: 0
  };

  private destroy$ = new Subject<void>();

  constructor(
    private quotationService: QuotationManagementService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadQuotations();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuotations(): void {
    this.isLoading = true;
    this.quotationService.getQuotationsDashboard().pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: (data) => {
        this.quotations = data.quotations;
        this.rfqGroups = this.groupQuotations(this.quotations);
        this.calculateStats();
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading quotations:', err);
        this.isLoading = false;
      }
    });
  }

  groupQuotations(quotes: VendorQuotation[]): RFQGroup[] {
    const groupsMap = new Map<string, VendorQuotation[]>();
    quotes.forEach(q => {
      const list = groupsMap.get(q.rfqId) || [];
      list.push(q);
      groupsMap.set(q.rfqId, list);
    });

    const groups: RFQGroup[] = [];
    groupsMap.forEach((list, rfqId) => {
      // Sort individual quotation responses within the group by submittedAt descending (most recent first)
      list.sort((a, b) => {
        const timeA = a.submittedAt ? new Date(a.submittedAt).getTime() : 0;
        const timeB = b.submittedAt ? new Date(b.submittedAt).getTime() : 0;
        return timeB - timeA;
      });

      const rfqTitle = list[0]?.rfqTitle || 'Request for Quotation';
      const respondedCount = list.filter(q => q.status === 'SUBMITTED' || q.status === 'ACCEPTED' || q.status === 'DECLINED' || q.status === 'LPO_GENERATED' || q.status === 'LPO_SENT' || q.status === 'REVIEW_REQUESTED').length;
      groups.push({
        rfqId,
        rfqTitle,
        receivedCount: respondedCount,
        totalCount: list.length,
        quotes: list
      });
    });
    return groups;
  }


  calculateStats(): void {
    this.stats.total = this.quotations.length;
    this.stats.pending = this.quotations.filter(q => q.status === 'PENDING').length;
    this.stats.submitted = this.quotations.filter(q => q.status === 'SUBMITTED').length;
    this.stats.accepted = this.quotations.filter(q => q.status === 'ACCEPTED').length;
    this.stats.declined = this.quotations.filter(q => q.status === 'DECLINED').length;
    this.stats.expired = this.quotations.filter(q => q.status === 'EXPIRED').length;
  }

  applyFilters(): void {
    let filtered = [...this.rfqGroups];

    if (this.selectedStatus !== 'ALL') {
      filtered = filtered.filter(g => g.quotes.some(q => q.status === this.selectedStatus));
    }

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.rfqId.toLowerCase().includes(term) ||
        g.rfqTitle.toLowerCase().includes(term)
      );
    }

    if (this.dateFrom) {
      const from = new Date(this.dateFrom);
      filtered = filtered.filter(g => g.quotes.some(q => q.submittedAt && new Date(q.submittedAt) >= from));
    }

    if (this.dateTo) {
      const to = new Date(this.dateTo);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(g => g.quotes.some(q => q.submittedAt && new Date(q.submittedAt) <= to));
    }

    // Sort
    if (this.sortField) {
      filtered.sort((a, b) => {
        if (this.sortField === 'mostRecent') {
          const maxA = Math.max(...a.quotes.map(q => q.submittedAt ? new Date(q.submittedAt).getTime() : 0), 0);
          const maxB = Math.max(...b.quotes.map(q => q.submittedAt ? new Date(q.submittedAt).getTime() : 0), 0);
          return this.sortAsc ? maxA - maxB : maxB - maxA;
        }

        let valA: any;
        let valB: any;

        if (this.sortField === 'rfqId') {
          valA = a.rfqId;
          valB = b.rfqId;
        } else if (this.sortField === 'rfqTitle') {
          valA = a.rfqTitle;
          valB = b.rfqTitle;
        } else if (this.sortField === 'receivedCount') {
          valA = a.receivedCount;
          valB = b.receivedCount;
        } else {
          valA = a.rfqId;
          valB = b.rfqId;
        }

        if (valA === undefined || valA === null) valA = '';
        if (valB === undefined || valB === null) valB = '';

        if (typeof valA === 'string') {
          valA = valA.toLowerCase();
          valB = String(valB).toLowerCase();
        }

        if (valA < valB) return this.sortAsc ? -1 : 1;
        if (valA > valB) return this.sortAsc ? 1 : -1;
        return 0;
      });
    }

    this.filteredRfqGroups = filtered;
    this.currentPage = 0;
    this.updatePagination();
  }

  changeDateRange(range: string): void {
    this.dateRange = range;
    const now = new Date();
    let fromDate = new Date();
    if (range === 'week') {
      fromDate.setDate(now.getDate() - 7);
    } else if (range === 'month') {
      fromDate.setMonth(now.getMonth() - 1);
    } else if (range === 'quarter') {
      fromDate.setMonth(now.getMonth() - 3);
    } else if (range === 'year') {
      fromDate.setFullYear(now.getFullYear() - 1);
    }
    this.dateFrom = fromDate.toISOString().split('T')[0];
    this.dateTo = now.toISOString().split('T')[0];
    this.applyFilters();
  }

  resetFilters(): void {
    this.selectedStatus = 'ALL';
    this.searchTerm = '';
    this.dateFrom = '';
    this.dateTo = '';
    this.applyFilters();
  }

  setSort(field: string): void {
    if (this.sortField === field) {
      this.sortAsc = !this.sortAsc;
    } else {
      this.sortField = field;
      this.sortAsc = true;
    }
    this.applyFilters();
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    return this.sortAsc ? 'fa-sort-up' : 'fa-sort-down';
  }



  onPageChange(page: number): void {
    this.currentPage = page;
    this.updatePagination();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.updatePagination();
  }

  getPageNumbers(): number[] {
    const pages = [];
    for (let i = 0; i < this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  updatePagination(): void {
    this.totalElements = this.filteredRfqGroups.length;
    this.totalPages = Math.ceil(this.totalElements / this.pageSize);
    this.paginatedRfqGroups = this.filteredRfqGroups.slice(
      this.currentPage * this.pageSize,
      (this.currentPage + 1) * this.pageSize
    );
  }

  onStatusFilter(status: string): void {
    this.selectedStatus = status;
    this.applyFilters();
  }

  onSearch(event: Event): void {
    this.searchTerm = (event.target as HTMLInputElement).value;
    this.applyFilters();
  }

  viewQuotationDetail(quotationId: string | number): void {
    this.router.navigate(['/admin/sales/commerce/quotations', String(quotationId)]);
  }

  getStatusBadgeClass(status: string): string {
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

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount || 0);
  }

  formatDate(date: any): string {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }

  getDaysRemaining(expiresAt: Date): number {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  isExpired(expiresAt: Date): boolean {
    return new Date(expiresAt) < new Date();
  }

  openVendorSummary(group: RFQGroup): void {
    this.selectedRfqGroup = group;
    this.showVendorSummaryModal = true;
  }

  closeVendorSummary(): void {
    this.showVendorSummaryModal = false;
    this.selectedRfqGroup = null;
  }

}