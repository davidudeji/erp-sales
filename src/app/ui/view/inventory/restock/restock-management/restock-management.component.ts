// restock-dashboard.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, interval, takeUntil, takeWhile } from 'rxjs';
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
  selector: 'app-restock-management',
  templateUrl: './restock-management.component.html',
  styleUrls: ['./restock-management.component.scss']
})
export class RestockManagementComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  // Data
  restockRequests: RestockRequest[] = [];
  filteredRequests: RestockRequest[] = [];
  branches: Branch[] = [];

  // Loading
  isLoading: boolean = true;
  isProcessing: boolean = false;
  error: string | null = null;

  // Filters
  filterForm = {
    status: 'ALL',
    urgency: 'ALL',
    branchId: 'ALL',
    search: ''
  };

  // UI
  Math = Math;
  aiDismissed: boolean = false;
  showRequestModal: boolean = false;
  showApprovalModal: boolean = false;
  selectedRequest: RestockRequest | null = null;
  approvalNotes: string = '';
  approvalAction: 'approve' | 'reject' | null = null;

  // Pagination
  currentPage: number = 0;
  pageSize: number = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];

  // Stats
  stats = {
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    ordered: 0,
    received: 0,
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    totalValue: 0
  };

  // Enums
  RestockStatus = RestockStatus;
  RestockUrgency = RestockUrgency;

  // Status options for filter
  statusOptions = ['ALL', ...Object.values(RestockStatus)];
  urgencyOptions = ['ALL', ...Object.values(RestockUrgency)];

  // Private
  private destroy$ = new Subject<void>();
  private autoRefreshSubscription: any;

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router
  ) { }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadDashboardData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadDashboardData(): void {
    this.isLoading = true;
    this.error = null;

    // Load restock requests
    this.inventoryService.getRestockRequests({ limit: 100 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.restockRequests = response.data;
          this.applyFilters();
          this.calculateStats();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load restock requests:', err);
          this.error = 'Failed to load restock data';
          this.isLoading = false;
        }
      });

    // Load branches
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
  // AUTO REFRESH
  // ============================================================

  private startAutoRefresh(): void {
    this.autoRefreshSubscription = interval(30000)
      .pipe(takeWhile(() => true))
      .subscribe(() => {
        this.loadDashboardData();
      });
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilters(): void {
    this.filteredRequests = this.restockRequests.filter(request => {
      // Status filter
      const statusMatch = this.filterForm.status === 'ALL' ||
        request.status === this.filterForm.status;

      // Urgency filter
      const urgencyMatch = this.filterForm.urgency === 'ALL' ||
        request.urgency === this.filterForm.urgency;

      // Branch filter
      const branchMatch = this.filterForm.branchId === 'ALL' ||
        request.branchId === this.filterForm.branchId;

      // Search filter
      const searchMatch = !this.filterForm.search ||
        request.productName.toLowerCase().includes(this.filterForm.search.toLowerCase()) ||
        request.sku.toLowerCase().includes(this.filterForm.search.toLowerCase()) ||
        request.branchName.toLowerCase().includes(this.filterForm.search.toLowerCase());

      return statusMatch && urgencyMatch && branchMatch && searchMatch;
    });

    this.currentPage = 0;
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  get totalElements(): number {
    return this.filteredRequests.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalElements / this.pageSize) || 1;
  }

  get pagedRequests(): RestockRequest[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredRequests.slice(start, start + this.pageSize);
  }

  onPageChange(page: number): void {
    if (page < 0 || page >= this.totalPages) return;
    this.currentPage = page;
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
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

  clearFilters(): void {
    this.filterForm = {
      status: 'ALL',
      urgency: 'ALL',
      branchId: 'ALL',
      search: ''
    };
    this.applyFilters();
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filterForm.status !== 'ALL') count++;
    if (this.filterForm.urgency !== 'ALL') count++;
    if (this.filterForm.branchId !== 'ALL') count++;
    if (this.filterForm.search) count++;
    return count;
  }

  // ============================================================
  // STATS CALCULATION
  // ============================================================

  calculateStats(): void {
    const requests = this.restockRequests;

    this.stats.total = requests.length;
    this.stats.pending = requests.filter(r => r.status === RestockStatus.PENDING).length;
    this.stats.approved = requests.filter(r => r.status === RestockStatus.APPROVED).length;
    this.stats.rejected = requests.filter(r => r.status === RestockStatus.REJECTED).length;
    this.stats.ordered = requests.filter(r => r.status === RestockStatus.ORDERED).length;
    this.stats.received = requests.filter(r => r.status === RestockStatus.RECEIVED).length;

    this.stats.critical = requests.filter(r => r.urgency === RestockUrgency.CRITICAL).length;
    this.stats.high = requests.filter(r => r.urgency === RestockUrgency.HIGH).length;
    this.stats.medium = requests.filter(r => r.urgency === RestockUrgency.MEDIUM).length;
    this.stats.low = requests.filter(r => r.urgency === RestockUrgency.LOW).length;

    this.stats.totalValue = requests.reduce((sum, r) => sum + (r.costEstimate || 0), 0);
  }

  // ============================================================
  // RESTOCK ACTIONS
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
            this.loadDashboardData();
            console.log('Restock request approved');
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
            this.loadDashboardData();
            console.log('Restock request rejected');
          },
          error: (err) => {
            console.error('Failed to reject request:', err);
            this.isProcessing = false;
            this.error = 'Failed to reject request';
          }
        });
    }
  }

  navigateToNewRequest(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/requests/new']);
  }

  navigateToRequestDetail(id: string | number): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/requests', id]);
  }

  navigateToThresholds(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/thresholds']);
  }

  navigateToSuggestions(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/suggestions']);
  }

  navigateToApprovals(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/approvals']);
  }

  // ============================================================
  // AI INSIGHTS
  // ============================================================

  getUrgentRestockCount(): number {
    return this.restockRequests.filter(r =>
      r.status === RestockStatus.PENDING &&
      (r.urgency === RestockUrgency.CRITICAL || r.urgency === RestockUrgency.HIGH)
    ).length;
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

  formatDate(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatTime(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadDashboardData();
  }
}