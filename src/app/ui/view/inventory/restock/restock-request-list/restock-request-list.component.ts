// restock-request-list.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  RestockRequest,
  RestockStatus,
  RestockUrgency,
  Branch,
  getStockStatus,
  getStockStatusLabel,
  getStockStatusColor
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-restock-request-list',
  templateUrl: './restock-request-list.component.html',
  styleUrls: ['./restock-request-list.component.scss']
})
export class RestockRequestListComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  // Data
  requests: RestockRequest[] = [];
  filteredRequests: RestockRequest[] = [];
  branches: Branch[] = [];
  totalElements: number = 0;
  totalPages: number = 0;

  // Loading
  isLoading: boolean = true;
  isProcessing: boolean = false;
  error: string | null = null;

  // Filters
  filterForm: FormGroup;
  searchSubject = new Subject<string>();

  // Pagination
  currentPage: number = 0;
  pageSize: number = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];

  // Selection
  selectedRequestIds: Set<number> = new Set();
  selectAll: boolean = false;

  // UI
  Math = Math;
  showFilterDrawer: boolean = false;
  aiDismissed: boolean = false;
  showApprovalModal: boolean = false;
  selectedRequest: RestockRequest | null = null;
  approvalNotes: string = '';
  approvalAction: 'approve' | 'reject' | null = null;

  // Enums
  RestockStatus = RestockStatus;
  RestockUrgency = RestockUrgency;

  // Filter options
  statusOptions = ['ALL', ...Object.values(RestockStatus)];
  urgencyOptions = ['ALL', ...Object.values(RestockUrgency)];

  // Stats
  stats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    ordered: 0,
    received: 0,
    critical: 0,
    high: 0
  };

  // Private
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute,
    private fb: FormBuilder
  ) {
    this.filterForm = this.buildFilterForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    // Optional prefill, e.g. ?branchId=br-1 — used when linking in from a specific branch's
    // page so the list opens already filtered to it (the filter stays editable).
    const branchId = this.route.snapshot.queryParamMap.get('branchId');
    if (branchId) {
      this.filterForm.patchValue({ branchId });
    }
    this.loadRequests();
    this.loadBranches();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // SETUP
  // ============================================================

  private buildFilterForm(): FormGroup {
    return this.fb.group({
      search: [''],
      status: ['ALL'],
      urgency: ['ALL'],
      branchId: ['ALL'],
      dateFrom: [''],
      dateTo: ['']
    });
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.filterForm.patchValue({ search: searchTerm });
      this.currentPage = 0;
      this.loadRequests();
    });
  }

  private loadBranches(): void {
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          this.branches = branches;
        },
        error: (err) => console.error('Failed to load branches:', err)
      });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadRequests(): void {
    this.isLoading = true;
    this.error = null;

    const filters = this.buildFilters();

    this.inventoryService.getRestockRequests(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.requests = response.data;
          this.filteredRequests = response.data;
          this.totalElements = response.total;
          this.totalPages = response.totalPages;
          this.calculateStats();
          this.isLoading = false;
          this.selectedRequestIds.clear();
          this.selectAll = false;
        },
        error: (err) => {
          console.error('Failed to load restock requests:', err);
          this.error = 'Failed to load restock requests';
          this.isLoading = false;
        }
      });
  }

  private buildFilters(): any {
    const formValue = this.filterForm.value;
    const filters: any = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (formValue.status && formValue.status !== 'ALL') filters.status = formValue.status;
    if (formValue.urgency && formValue.urgency !== 'ALL') filters.urgency = formValue.urgency;
    if (formValue.branchId && formValue.branchId !== 'ALL') filters.branchId = formValue.branchId;
    if (formValue.dateFrom) filters.dateFrom = new Date(formValue.dateFrom);
    if (formValue.dateTo) filters.dateTo = new Date(formValue.dateTo);

    return filters;
  }

  private calculateStats(): void {
    this.stats.total = this.totalElements;
    this.stats.pending = this.requests.filter(r => r.status === RestockStatus.PENDING).length;
    this.stats.approved = this.requests.filter(r => r.status === RestockStatus.APPROVED).length;
    this.stats.rejected = this.requests.filter(r => r.status === RestockStatus.REJECTED).length;
    this.stats.ordered = this.requests.filter(r => r.status === RestockStatus.ORDERED).length;
    this.stats.received = this.requests.filter(r => r.status === RestockStatus.RECEIVED).length;
    this.stats.critical = this.requests.filter(r => r.urgency === RestockUrgency.CRITICAL).length;
    this.stats.high = this.requests.filter(r => r.urgency === RestockUrgency.HIGH).length;
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilters(): void {
    this.currentPage = 0;
    this.loadRequests();
    this.showFilterDrawer = false;
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: 'ALL',
      urgency: 'ALL',
      branchId: 'ALL',
      dateFrom: '',
      dateTo: ''
    });
    this.searchSubject.next('');
    this.currentPage = 0;
    this.loadRequests();
    this.showFilterDrawer = false;
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.searchSubject.next(target.value);
    }
  }

  getActiveFilterCount(): number {
    const formValue = this.filterForm.value;
    let count = 0;
    if (formValue.search) count++;
    if (formValue.status !== 'ALL') count++;
    if (formValue.urgency !== 'ALL') count++;
    if (formValue.branchId !== 'ALL') count++;
    if (formValue.dateFrom) count++;
    if (formValue.dateTo) count++;
    return count;
  }

  getFilterSummary(): string {
    const parts: string[] = [];
    const formValue = this.filterForm.value;

    if (formValue.status !== 'ALL') parts.push(`Status: ${this.getStatusLabel(formValue.status)}`);
    if (formValue.urgency !== 'ALL') parts.push(`Urgency: ${this.getUrgencyLabel(formValue.urgency)}`);
    if (formValue.branchId !== 'ALL') {
      const branch = this.branches.find(b => b.id === formValue.branchId);
      parts.push(`Branch: ${branch?.name || formValue.branchId}`);
    }
    if (formValue.dateFrom) parts.push(`From: ${this.formatDate(formValue.dateFrom)}`);
    if (formValue.dateTo) parts.push(`To: ${this.formatDate(formValue.dateTo)}`);

    return parts.length > 0 ? parts.join(' · ') : 'All requests';
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadRequests();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.loadRequests();
  }

  getPageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 0; i < total; i++) pages.push(i);
    } else {
      pages.push(0);
      if (current > 2) pages.push(-1);
      const start = Math.max(1, current - 1);
      const end = Math.min(total - 2, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 3) pages.push(-1);
      pages.push(total - 1);
    }
    return pages;
  }

  // ============================================================
  // SELECTION
  // ============================================================

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAll = checked;
    if (checked) {
      this.filteredRequests.forEach(r => this.selectedRequestIds.add(r.id));
    } else {
      this.selectedRequestIds.clear();
    }
  }

  toggleSelection(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedRequestIds.add(id);
    } else {
      this.selectedRequestIds.delete(id);
    }
    this.selectAll = this.filteredRequests.every(r => this.selectedRequestIds.has(r.id));
  }

  isSelected(id: number): boolean {
    return this.selectedRequestIds.has(id);
  }

  getSelectedCount(): number {
    return this.selectedRequestIds.size;
  }

  // ============================================================
  // BULK ACTIONS
  // ============================================================

  bulkAction(action: string): void {
    if (this.selectedRequestIds.size === 0) return;

    switch (action) {
      case 'approve':
        this.bulkApprove();
        break;
      case 'reject':
        this.bulkReject();
        break;
      default:
        break;
    }
  }

  private bulkApprove(): void {
    if (!confirm(`Are you sure you want to approve ${this.selectedRequestIds.size} request(s)?`)) return;

    this.isProcessing = true;
    const ids = Array.from(this.selectedRequestIds);
    let completed = 0;

    ids.forEach(id => {
      this.inventoryService.approveRestockRequest(id, 'Bulk approval')
        .subscribe({
          next: () => {
            completed++;
            if (completed === ids.length) {
              this.isProcessing = false;
              this.selectedRequestIds.clear();
              this.selectAll = false;
              this.loadRequests();
            }
          },
          error: (err) => {
            console.error('Failed to approve request:', err);
            this.isProcessing = false;
          }
        });
    });
  }

  private bulkReject(): void {
    if (!confirm(`Are you sure you want to reject ${this.selectedRequestIds.size} request(s)?`)) return;

    this.isProcessing = true;
    const ids = Array.from(this.selectedRequestIds);
    let completed = 0;

    ids.forEach(id => {
      this.inventoryService.rejectRestockRequest(id, 'Bulk rejection')
        .subscribe({
          next: () => {
            completed++;
            if (completed === ids.length) {
              this.isProcessing = false;
              this.selectedRequestIds.clear();
              this.selectAll = false;
              this.loadRequests();
            }
          },
          error: (err) => {
            console.error('Failed to reject request:', err);
            this.isProcessing = false;
          }
        });
    });
  }

  // ============================================================
  // APPROVAL MODAL
  // ============================================================

  openApprovalModal(request: RestockRequest, action: 'approve' | 'reject'): void {
    this.selectedRequest = request;
    this.approvalAction = action;
    this.approvalNotes = '';
    this.showApprovalModal = true;
  }

  closeApprovalModal(): void {
    this.showApprovalModal = false;
    this.selectedRequest = null;
    this.approvalAction = null;
    this.approvalNotes = '';
  }

  submitApproval(): void {
    if (!this.selectedRequest || !this.approvalAction) return;

    this.isProcessing = true;

    if (this.approvalAction === 'approve') {
      this.inventoryService.approveRestockRequest(this.selectedRequest.id, this.approvalNotes)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.isProcessing = false;
            this.closeApprovalModal();
            this.loadRequests();
          },
          error: (err) => {
            console.error('Failed to approve request:', err);
            this.isProcessing = false;
            this.error = 'Failed to approve request';
          }
        });
    } else {
      this.inventoryService.rejectRestockRequest(this.selectedRequest.id, this.approvalNotes)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.isProcessing = false;
            this.closeApprovalModal();
            this.loadRequests();
          },
          error: (err) => {
            console.error('Failed to reject request:', err);
            this.isProcessing = false;
            this.error = 'Failed to reject request';
          }
        });
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  viewRequest(id: string | number): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/requests', id]);
  }

  navigateToNew(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/requests/new']);
  }

  navigateToApprovals(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/approvals']);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  exportRequests(): void {
    // In real implementation, this would call an export API
    console.log('Exporting restock requests...');
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getUrgencyColor(urgency: string): string {
    const map: Record<string, string> = {
      [RestockUrgency.CRITICAL]: '#DC2626',
      [RestockUrgency.HIGH]: '#F97316',
      [RestockUrgency.MEDIUM]: '#F59E0B',
      [RestockUrgency.LOW]: '#3B82F6'
    };
    return map[urgency] || '#6B7280';
  }

  getUrgencyLabel(urgency: string): string {
    return urgency.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getStatusColor(status: string): string {
    const map: Record<string, string> = {
      [RestockStatus.PENDING]: '#F59E0B',
      [RestockStatus.APPROVED]: '#3B82F6',
      [RestockStatus.REJECTED]: '#DC2626',
      [RestockStatus.ORDERED]: '#8B5CF6',
      [RestockStatus.RECEIVED]: '#2EB270'
    };
    return map[status] || '#6B7280';
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      [RestockStatus.PENDING]: 'pending',
      [RestockStatus.APPROVED]: 'approved',
      [RestockStatus.REJECTED]: 'rejected',
      [RestockStatus.ORDERED]: 'ordered',
      [RestockStatus.RECEIVED]: 'received'
    };
    return map[status] || 'pending';
  }

  getBranchName(branchId: string): string {
    const branch = this.branches.find(b => String(b.id) === branchId);
    return branch?.name || branchId;
  }

  getStockStatus(quantity: number, reorderPoint: number, safetyStock: number): string {
    return getStockStatus(quantity, reorderPoint, safetyStock);
  }

  getStockStatusLabel(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusLabel(status);
  }

  getStockStatusColor(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusColor(status);
  }

  formatDate(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(value: number): string {
    if (!value) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    if (!value) return '0';
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadRequests();
  }
}