// vendor-approval-queue.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import {
  VendorService
} from '../../../service/vendor-management/vendor-management.service';
import {
  Vendor,
  VendorStatus,
  VendorTier,
  RiskLevel,
  VendorListResponse,
  getVendorStatusColor,
  getVendorTierLabel,
  getRiskLevelColor,
  OnboardingCopilotSession,
  ExtractedField
} from '../../../domain/vendor-management/vendor-management.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-vendor-approval-queue',
  templateUrl: './vendor-approval-queue.component.html',
  styleUrls: ['./vendor-approval-queue.component.scss']
})
export class VendorApprovalQueueComponent implements OnInit, OnDestroy, AfterViewInit {

  // ============================================================
  // VIEW CHILDREN
  // ============================================================

  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChild('tableContainer') tableContainer!: ElementRef<HTMLDivElement>;

  // ============================================================
  // STATE
  // ============================================================

  // Data
  vendors: Vendor[] = [];
  filteredVendors: Vendor[] = [];
  totalVendors: number = 0;
  totalPages: number = 0;

  // Loading
  isLoading: boolean = false;
  isProcessing: boolean = false;
  isExporting: boolean = false;

  // Pagination
  currentPage: number = 1;
  pageSize: number = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];

  // Filters
  filterForm: FormGroup;
  activeFilters: { [key: string]: any } = {};

  // Sorting
  sortField: string = 'companyName';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Selection
  selectedVendors: Set<number> = new Set();
  selectAll: boolean = false;

  // UI
  Math = Math;
  showFilterDrawer: boolean = false;
  showColumnMenu: boolean = false;
  isMobileView: boolean = false;
  showReviewModal: boolean = false;
  selectedVendor: Vendor | null = null;
  reviewNotes: string = '';
  reviewAction: 'approve' | 'reject' | null = null;

  // Enums for template
  VendorStatus = VendorStatus;
  VendorTier = VendorTier;
  RiskLevel = RiskLevel;

  // Column visibility
  visibleColumns = {
    select: true,
    rank: true,
    company: true,
    registrationDate: true,
    documents: true,
    status: true,
    actions: true
  };

  // Error state
  error: string | null = null;

  // Column configuration
  columnConfigs = [
    { key: 'select', label: '', visible: true, width: '40px' },
    { key: 'rank', label: '#', visible: true, width: '50px' },
    { key: 'company', label: 'Company', visible: true, width: 'auto' },
    { key: 'registrationDate', label: 'Registered', visible: true, width: '140px' },
    { key: 'documents', label: 'Documents', visible: true, width: '120px' },
    { key: 'status', label: 'Status', visible: true, width: '140px' },
    { key: 'actions', label: 'Actions', visible: true, width: '200px' }
  ];

  // Quick stats
  stats = {
    total: 0,
    pending: 0,
    underReview: 0,
    approvedToday: 0,
    rejectedToday: 0
  };

  // Public search subject for template
  searchSubject = new Subject<string>();
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private vendorService: VendorService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.filterForm = this.buildFilterForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadPendingVendors();
    this.setupSearch();
    this.checkScreenSize();
    this.loadColumnPreferences();
  }

  ngAfterViewInit(): void {
    document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    document.removeEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
  }

  // ============================================================
  // SETUP
  // ============================================================

  private buildFilterForm(): FormGroup {
    return this.fb.group({
      search: [''],
      status: [''],
      tier: [''],
      riskLevel: [''],
      category: [''],
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
      this.currentPage = 1;
      this.loadPendingVendors();
    });
  }

  private checkScreenSize(): void {
    this.isMobileView = window.innerWidth < 768;
    window.addEventListener('resize', () => {
      this.isMobileView = window.innerWidth < 768;
    });
  }

  private loadColumnPreferences(): void {
    const saved = localStorage.getItem('vendorApprovalColumns');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.visibleColumns = { ...this.visibleColumns, ...parsed };
        this.columnConfigs.forEach(col => {
          if (col.key in parsed) {
            col.visible = parsed[col.key];
          }
        });
      } catch (e) { /* Ignore */ }
    }
  }

  private handleKeyboardShortcuts(event: KeyboardEvent): void {
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    }
    if (event.key === 'Escape' && this.searchInput?.nativeElement === document.activeElement) {
      this.clearSearch();
    }
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadPendingVendors(): void {
    this.isLoading = true;

    const filters = this.buildFilters();
    // Only show pending and under review vendors
    filters.statuses = [VendorStatus.PENDING_ONBOARDING, VendorStatus.UNDER_REVIEW];

    this.vendorService.getVendors(this.currentPage, this.pageSize, filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response: VendorListResponse) => {
          this.vendors = response.vendors;
          this.filteredVendors = response.vendors;
          this.totalVendors = response.total;
          this.totalPages = response.totalPages;
          this.calculateStats();
          this.isLoading = false;
          this.selectedVendors.clear();
          this.selectAll = false;
        },
        error: (err) => {
          console.error('Failed to load pending vendors:', err);
          this.isLoading = false;
        }
      });
  }

  private buildFilters(): any {
    const formValue = this.filterForm.value;
    const filters: any = {};

    if (formValue.search) filters.search = formValue.search;
    if (formValue.status) filters.status = formValue.status;
    if (formValue.tier) filters.tier = formValue.tier;
    if (formValue.riskLevel) filters.riskLevel = formValue.riskLevel;
    if (formValue.category) filters.category = formValue.category;
    if (formValue.dateFrom) filters.dateFrom = formValue.dateFrom;
    if (formValue.dateTo) filters.dateTo = formValue.dateTo;

    return filters;
  }

  private calculateStats(): void {
    this.stats.total = this.totalVendors;
    this.stats.pending = this.vendors.filter(v => v.status === VendorStatus.PENDING_ONBOARDING).length;
    this.stats.underReview = this.vendors.filter(v => v.status === VendorStatus.UNDER_REVIEW).length;
    // These would come from API in real implementation
    this.stats.approvedToday = 0;
    this.stats.rejectedToday = 0;
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilters(): void {
    this.currentPage = 1;
    this.loadPendingVendors();
    this.showFilterDrawer = false;
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: '',
      tier: '',
      riskLevel: '',
      category: '',
      dateFrom: '',
      dateTo: ''
    });
    this.currentPage = 1;
    this.loadPendingVendors();
    this.showFilterDrawer = false;
  }

  clearSearch(): void {
    this.filterForm.patchValue({ search: '' });
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }
    this.currentPage = 1;
    this.loadPendingVendors();
  }

  getActiveFilterCount(): number {
    const formValue = this.filterForm.value;
    let count = 0;
    if (formValue.status) count++;
    if (formValue.tier) count++;
    if (formValue.riskLevel) count++;
    if (formValue.category) count++;
    if (formValue.dateFrom) count++;
    if (formValue.dateTo) count++;
    if (formValue.search) count++;
    return count;
  }

  getFilterSummary(): string {
    const parts: string[] = [];
    const formValue = this.filterForm.value;

    if (formValue.status) parts.push(`Status: ${this.getStatusLabel(formValue.status)}`);
    if (formValue.tier) parts.push(`Tier: ${this.getTierLabel(formValue.tier)}`);
    if (formValue.riskLevel) parts.push(`Risk: ${formValue.riskLevel}`);
    if (formValue.category) parts.push(`Category: ${formValue.category}`);

    return parts.length > 0 ? parts.join(' · ') : 'All pending vendors';
  }

  // ============================================================
  // SORTING
  // ============================================================

  toggleSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.sortVendors();
  }

  private sortVendors(): void {
    this.filteredVendors.sort((a, b) => {
      let aVal: any = a[this.sortField as keyof Vendor];
      let bVal: any = b[this.sortField as keyof Vendor];

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
        return this.sortDirection === 'asc' ? comparison : -comparison;
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  getVisibleColumnCount(): number {
    return Object.values(this.visibleColumns).filter(v => v).length;
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.searchSubject.next(target.value);
    }
  }

  onPageSizeChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value) {
      this.changePageSize(Number(target.value));
    }
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  goToPage(page: number | string): void {
    if (typeof page === 'string') return;
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadPendingVendors();
    this.tableContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadPendingVendors();
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: (number | string)[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }

    return pages;
  }

  // ============================================================
  // SELECTION
  // ============================================================

  toggleSelectAll(): void {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.filteredVendors.forEach(v => this.selectedVendors.add(v.id));
    } else {
      this.selectedVendors.clear();
    }
  }

  toggleSelectVendor(id: number): void {
    if (this.selectedVendors.has(id)) {
      this.selectedVendors.delete(id);
    } else {
      this.selectedVendors.add(id);
    }
    this.selectAll = this.filteredVendors.every(v => this.selectedVendors.has(v.id));
  }

  isSelected(id: number): boolean {
    return this.selectedVendors.has(id);
  }

  getSelectedCount(): number {
    return this.selectedVendors.size;
  }

  // ============================================================
  // REVIEW MODAL
  // ============================================================

  openReviewModal(vendor: Vendor, action: 'approve' | 'reject'): void {
    this.selectedVendor = vendor;
    this.reviewAction = action;
    this.reviewNotes = '';
    this.showReviewModal = true;
    this.loadOnboardingCopilot(String(vendor.id));
  }

  closeReviewModal(): void {
    this.showReviewModal = false;
    this.selectedVendor = null;
    this.reviewAction = null;
    this.reviewNotes = '';
    this.copilotSession = null;
    this.editingFieldName = null;
  }

  // ============================================================
  // ONBOARDING COPILOT (AI-extracted fields — inline instead of a dedicated tab)
  // ============================================================

  copilotSession: OnboardingCopilotSession | null = null;
  isLoadingCopilot = false;
  editingFieldName: string | null = null;
  editFieldValue = '';

  private loadOnboardingCopilot(vendorId: string): void {
    this.copilotSession = null;
    this.isLoadingCopilot = true;

    this.vendorService.getOnboardingCopilotSession(vendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (session) => {
          this.copilotSession = session;
          this.isLoadingCopilot = false;
        },
        error: (err) => {
          console.error('Failed to load onboarding copilot session:', err);
          this.isLoadingCopilot = false;
        }
      });
  }

  startEditingField(field: ExtractedField): void {
    this.editingFieldName = field.fieldName;
    this.editFieldValue = field.extractedValue;
  }

  cancelEditingField(): void {
    this.editingFieldName = null;
    this.editFieldValue = '';
  }

  confirmField(field: ExtractedField, correctedValue?: string): void {
    if (!this.copilotSession) return;

    this.vendorService.confirmExtractedField(this.copilotSession.id, field.fieldName, correctedValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          const session = this.copilotSession;
          if (!session) return;
          session.extractedFields = session.extractedFields.map(f => f.fieldName === updated.fieldName ? updated : f);
          this.editingFieldName = null;
          this.editFieldValue = '';
        },
        error: (err) => console.error('Failed to confirm extracted field:', err)
      });
  }

  submitReview(): void {
    if (!this.selectedVendor || !this.reviewAction) return;

    this.isProcessing = true;

    if (this.reviewAction === 'approve') {
      // Approve vendor - set status to ACTIVE
      this.vendorService.updateVendorStatus(String(this.selectedVendor.id), VendorStatus.ACTIVE)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.isProcessing = false;
            this.closeReviewModal();
            this.loadPendingVendors();
            // Show success toast
            console.log(`Vendor ${this.selectedVendor?.companyName} approved successfully`);
          },
          error: (err) => {
            console.error('Failed to approve vendor:', err);
            this.isProcessing = false;
          }
        });
    } else {
      // Reject vendor - set status to INACTIVE or OFFBOARDED
      // In real implementation, you might want to send rejection reason
      this.vendorService.updateVendorStatus(String(this.selectedVendor.id), VendorStatus.INACTIVE)
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: () => {
            this.isProcessing = false;
            this.closeReviewModal();
            this.loadPendingVendors();
            // Show success toast
            console.log(`Vendor ${this.selectedVendor?.companyName} rejected`);
          },
          error: (err) => {
            console.error('Failed to reject vendor:', err);
            this.isProcessing = false;
          }
        });
    }
  }

  // ============================================================
  // BULK ACTIONS
  // ============================================================

  bulkAction(action: string): void {
    if (this.selectedVendors.size === 0) return;

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
    if (!confirm(`Are you sure you want to approve ${this.selectedVendors.size} vendor(s)?`)) {
      return;
    }

    this.isProcessing = true;
    const ids = Array.from(this.selectedVendors);
    let completed = 0;

    ids.forEach(id => {
      this.vendorService.updateVendorStatus(String(id), VendorStatus.ACTIVE).subscribe({
        next: () => {
          completed++;
          if (completed === ids.length) {
            this.isProcessing = false;
            this.selectedVendors.clear();
            this.selectAll = false;
            this.loadPendingVendors();
            console.log(`Approved ${ids.length} vendors`);
          }
        },
        error: (err) => {
          console.error('Failed to approve vendor:', err);
          this.isProcessing = false;
        }
      });
    });
  }

  private bulkReject(): void {
    if (!confirm(`Are you sure you want to reject ${this.selectedVendors.size} vendor(s)?`)) {
      return;
    }

    this.isProcessing = true;
    const ids = Array.from(this.selectedVendors);
    let completed = 0;

    ids.forEach(id => {
      this.vendorService.updateVendorStatus(String(id), VendorStatus.INACTIVE).subscribe({
        next: () => {
          completed++;
          if (completed === ids.length) {
            this.isProcessing = false;
            this.selectedVendors.clear();
            this.selectAll = false;
            this.loadPendingVendors();
            console.log(`Rejected ${ids.length} vendors`);
          }
        },
        error: (err) => {
          console.error('Failed to reject vendor:', err);
          this.isProcessing = false;
        }
      });
    });
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  viewVendor(id: number): void {
    this.router.navigate(['/commerce/manage-vendors', String(id), 'profile'], {
      queryParams: { returnTo: 'registry' }
    });
  }

  viewDocuments(id: number): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { tab: 'documents', returnTo: 'registry' }
    });
  }

  // ============================================================
  // COLUMN VISIBILITY
  // ============================================================

  toggleColumn(key: string): void {
    (this.visibleColumns as any)[key] = !(this.visibleColumns as any)[key];
    const col = this.columnConfigs.find(c => c.key === key);
    if (col) col.visible = (this.visibleColumns as any)[key];
    this.saveColumnPreferences();
  }

  private saveColumnPreferences(): void {
    localStorage.setItem('vendorApprovalColumns', JSON.stringify(this.visibleColumns));
  }

  resetColumns(): void {
    this.columnConfigs.forEach(col => {
      col.visible = true;
    });
    this.visibleColumns = {
      select: true,
      rank: true,
      company: true,
      registrationDate: true,
      documents: true,
      status: true,
      actions: true
    };
    this.saveColumnPreferences();
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getVendorStatusColor(status: VendorStatus): string {
    return getVendorStatusColor(status);
  }

  getVendorTierLabel(tier: VendorTier): string {
    return getVendorTierLabel(tier);
  }

  getRiskLevelColor(level: RiskLevel): string {
    return getRiskLevelColor(level);
  }

  getStatusLabel(status: VendorStatus | string): string {
    const map: Record<string, string> = {
      [VendorStatus.ACTIVE]: 'Active',
      [VendorStatus.INACTIVE]: 'Inactive',
      [VendorStatus.PENDING_ONBOARDING]: 'Pending Onboarding',
      [VendorStatus.UNDER_REVIEW]: 'Under Review',
      [VendorStatus.SUSPENDED]: 'Suspended',
      [VendorStatus.OFFBOARDED]: 'Offboarded',
      [VendorStatus.CONDITIONAL]: 'Conditional',
      [VendorStatus.REJECTED]: 'Rejected'
    };
    return map[status] || status;
  }

  getTierLabel(tier: VendorTier | string): string {
    const map: Record<string, string> = {
      [VendorTier.PREFERRED]: '⭐ Preferred',
      [VendorTier.APPROVED]: '✓ Approved',
      [VendorTier.CONDITIONAL]: '⚠️ Conditional'
    };
    return map[tier] || tier;
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

  getDocumentCount(vendor: Vendor): number {
    return vendor.documents?.length || 0;
  }

  getDocumentStatusSummary(vendor: Vendor): { total: number; verified: number; pending: number } {
    const docs = vendor.documents || [];
    const total = docs.length;
    const verified = docs.filter(d => d.status === 'ACTIVE').length;
    const pending = docs.filter(d => d.status === 'PENDING_VERIFICATION').length;
    return { total, verified, pending };
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadPendingVendors();
  }


  // Export
  exportReport(): void {
    console.log('Exporting vendor approval report...');
  }

  // Clear selection
  clearSelection(): void {
    this.selectedVendors.clear();
    this.selectAll = false;
  }

  // Filter change handler
  onFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    if (target && target.value !== undefined) {
      this.currentPage = 1;
      this.loadPendingVendors();
    }
  }
}