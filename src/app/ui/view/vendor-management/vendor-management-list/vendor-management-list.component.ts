// vendor-list.component.ts
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
  VendorRiskTrajectory,
  FraudFlag,
  getRiskTrajectoryColor,
  getRiskTrajectoryIcon
} from '../../../domain/vendor-management/vendor-management.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-vendor-management-list',
  templateUrl: './vendor-management-list.component.html',
  styleUrls: ['./vendor-management-list.component.scss']
})
export class VendorManagementListComponent implements OnInit, OnDestroy, AfterViewInit {

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
  isExporting: boolean = false;
  error: string | null = null;

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

  // Enums for template
  VendorStatus = VendorStatus;
  VendorTier = VendorTier;
  RiskLevel = RiskLevel;

  // Column visibility
  visibleColumns = {
    select: true,
    rank: true,
    company: true,
    tier: true,
    status: true,
    risk: true,
    performance: true,
    projects: true,
    revenue: true,
    documents: true,
    joined: true,
    actions: true
  };

  // Column configuration
  columnConfigs = [
    { key: 'select', label: '', visible: true, width: '40px' },
    { key: 'rank', label: '#', visible: true, width: '50px' },
    { key: 'company', label: 'Company', visible: true, width: 'auto' },
    { key: 'tier', label: 'Tier', visible: true, width: '120px' },
    { key: 'status', label: 'Status', visible: true, width: '140px' },
    { key: 'risk', label: 'Risk', visible: true, width: '100px' },
    { key: 'performance', label: 'Performance', visible: true, width: '160px' },
    { key: 'projects', label: 'Projects', visible: true, width: '100px' },
    { key: 'revenue', label: 'Revenue', visible: true, width: '140px' },
    { key: 'documents', label: 'Docs', visible: true, width: '100px' },
    { key: 'joined', label: 'Joined', visible: true, width: '120px' },
    { key: 'actions', label: 'Actions', visible: true, width: '120px' }
  ];

  // Quick stats
  stats = {
    total: 0,
    active: 0,
    preferred: 0,
    highRisk: 0
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
    this.loadVendors();
    this.setupSearch();
    this.checkScreenSize();
    this.loadColumnPreferences();
  }

  ngAfterViewInit(): void {
    // Focus search on keyboard shortcut
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
      minPerformance: [''],
      maxPerformance: [''],
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
      this.loadVendors();
    });
  }

  private checkScreenSize(): void {
    this.isMobileView = window.innerWidth < 768;
    window.addEventListener('resize', () => {
      this.isMobileView = window.innerWidth < 768;
    });
  }

  private loadColumnPreferences(): void {
    const saved = localStorage.getItem('vendorListColumns');
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
    // Ctrl+F or Cmd+F to focus search
    if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
      event.preventDefault();
      this.searchInput?.nativeElement?.focus();
    }
    // Escape to clear search
    if (event.key === 'Escape' && this.searchInput?.nativeElement === document.activeElement) {
      this.clearSearch();
    }
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadVendors(): void {
    this.isLoading = true;

    const filters = this.buildFilters();

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
          // Clear selection when data changes
          this.selectedVendors.clear();
          this.selectAll = false;
          // AI signals are fetched per-vendor, so only load them for the page just shown
          this.loadAiSignals(response.vendors.map(v => String(v.id)));
        },
        error: (err) => {
          console.error('Failed to load vendors:', err);
          this.isLoading = false;
        }
      });
  }

  // ============================================================
  // AI SIGNALS (risk trend + fraud flags — inline instead of a dedicated tab)
  // ============================================================

  private riskTrajectories: VendorRiskTrajectory[] = [];
  private activeFraudFlagVendorIds = new Set<string>();
  getRiskTrajectoryColor = getRiskTrajectoryColor;
  getRiskTrajectoryIcon = getRiskTrajectoryIcon;

  private loadAiSignals(vendorIds: string[]): void {
    this.vendorService.getRiskTrajectories(vendorIds).subscribe({
      next: (trajectories) => { this.riskTrajectories = trajectories; },
      error: (err) => console.error('Failed to load risk trajectories:', err)
    });

    this.vendorService.getFraudFlags().subscribe({
      next: (flags) => {
        this.activeFraudFlagVendorIds = new Set(
          flags.filter(f => f.status === 'PENDING_REVIEW' || f.status === 'INVESTIGATING').map(f => f.vendorId)
        );
      },
      error: (err) => console.error('Failed to load fraud flags:', err)
    });
  }

  /** A vendor's AI-projected risk trend, if Sentinel has one for them. */
  getRiskTrajectory(vendorId: number): VendorRiskTrajectory | undefined {
    return this.riskTrajectories.find(t => t.vendorId === String(vendorId));
  }

  hasActiveFraudFlag(vendorId: number): boolean {
    return this.activeFraudFlagVendorIds.has(String(vendorId));
  }

  private buildFilters(): any {
    const formValue = this.filterForm.value;
    const filters: any = {};

    if (formValue.search) filters.search = formValue.search;
    if (formValue.status) filters.status = formValue.status;
    if (formValue.tier) filters.tier = formValue.tier;
    if (formValue.riskLevel) filters.riskLevel = formValue.riskLevel;
    if (formValue.category) filters.category = formValue.category;
    if (formValue.minPerformance) filters.minPerformance = formValue.minPerformance;
    if (formValue.maxPerformance) filters.maxPerformance = formValue.maxPerformance;
    if (formValue.dateFrom) filters.dateFrom = formValue.dateFrom;
    if (formValue.dateTo) filters.dateTo = formValue.dateTo;

    return filters;
  }

  private calculateStats(): void {
    this.stats.total = this.totalVendors;
    this.stats.active = this.vendors.filter(v => v.status === VendorStatus.ACTIVE).length;
    this.stats.preferred = this.vendors.filter(v => v.tier === VendorTier.PREFERRED).length;
    this.stats.highRisk = this.vendors.filter(v => v.riskLevel === RiskLevel.HIGH).length;
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilters(): void {
    this.currentPage = 1;
    this.loadVendors();
    this.showFilterDrawer = false;
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      status: '',
      tier: '',
      riskLevel: '',
      category: '',
      minPerformance: '',
      maxPerformance: '',
      dateFrom: '',
      dateTo: ''
    });
    this.currentPage = 1;
    this.loadVendors();
    this.showFilterDrawer = false;
  }

  clearSearch(): void {
    this.filterForm.patchValue({ search: '' });
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }
    this.currentPage = 1;
    this.loadVendors();
  }

  onFilterChange(event: Event): void {
    const target = event.target as HTMLSelectElement;
    const field = target.name;
    if (!field) return;

    this.filterForm.patchValue({ [field]: target.value });
    this.currentPage = 1;
    this.loadVendors();
  }

  getActiveFilterCount(): number {
    const formValue = this.filterForm.value;
    let count = 0;
    if (formValue.status) count++;
    if (formValue.tier) count++;
    if (formValue.riskLevel) count++;
    if (formValue.category) count++;
    if (formValue.minPerformance) count++;
    if (formValue.maxPerformance) count++;
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
    if (formValue.minPerformance || formValue.maxPerformance) {
      const min = formValue.minPerformance || '0';
      const max = formValue.maxPerformance || '100';
      parts.push(`Score: ${min}% - ${max}%`);
    }

    return parts.length > 0 ? parts.join(' · ') : 'All vendors';
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

      // Handle nested properties
      if (this.sortField === 'companyName') {
        aVal = a.companyName;
        bVal = b.companyName;
      } else if (this.sortField === 'performanceScore') {
        aVal = a.performanceScore;
        bVal = b.performanceScore;
      } else if (this.sortField === 'totalRevenue') {
        aVal = a.performanceMetrics?.totalRevenue || 0;
        bVal = b.performanceMetrics?.totalRevenue || 0;
      }

      // Handle strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
        return this.sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle numbers
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
    this.loadVendors();
    // Scroll to top of table
    this.tableContainer?.nativeElement?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
    this.loadVendors();
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

      if (current > 3) {
        pages.push('...');
      }

      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 2) {
        pages.push('...');
      }

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

  clearSelection(): void {
    this.selectedVendors.clear();
    this.selectAll = false;
  }

  // ============================================================
  // BULK ACTIONS
  // ============================================================

  bulkAction(action: string): void {
    if (this.selectedVendors.size === 0) return;

    switch (action) {
      case 'export':
        this.exportSelected();
        break;
      case 'activate':
        this.bulkUpdateStatus(VendorStatus.ACTIVE);
        break;
      case 'suspend':
        this.bulkUpdateStatus(VendorStatus.SUSPENDED);
        break;
      case 'delete':
        this.bulkDelete();
        break;
      default:
        break;
    }
  }

  private bulkUpdateStatus(status: VendorStatus): void {
    if (!confirm(`Are you sure you want to ${status.toLowerCase()} ${this.selectedVendors.size} vendor(s)?`)) {
      return;
    }

    const ids = Array.from(this.selectedVendors);
    ids.forEach(id => {
      this.vendorService.updateVendorStatus(String(id), status).subscribe({
        next: () => {
          const vendor = this.vendors.find(v => v.id === id);
          if (vendor) vendor.status = status;
        },
        error: (err) => console.error('Failed to update vendor:', err)
      });
    });

    this.selectedVendors.clear();
    this.selectAll = false;
    setTimeout(() => this.loadVendors(), 2000);
  }

  private bulkDelete(): void {
    if (!confirm(`Are you sure you want to delete ${this.selectedVendors.size} vendor(s)? This action cannot be undone.`)) {
      return;
    }

    const ids = Array.from(this.selectedVendors);
    ids.forEach(id => {
      this.vendorService.deleteVendor(String(id)).subscribe({
        next: () => {
          // Remove from local list
          this.vendors = this.vendors.filter(v => v.id !== id);
          this.filteredVendors = this.filteredVendors.filter(v => v.id !== id);
        },
        error: (err) => console.error('Failed to delete vendor:', err)
      });
    });

    this.selectedVendors.clear();
    this.selectAll = false;
    setTimeout(() => this.loadVendors(), 2000);
  }

  private exportSelected(): void {
    this.isExporting = true;
    const ids = Array.from(this.selectedVendors);

    this.vendorService.exportVendors({ ids: ids.join(',') }).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vendors_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isExporting = false;
        this.selectedVendors.clear();
        this.selectAll = false;
      },
      error: (err) => {
        console.error('Export failed:', err);
        this.isExporting = false;
      }
    });
  }

  // ============================================================
  // NAVIGATION - UPDATED to use router.navigate
  // ============================================================

  private readonly VM_TAB_KEY = 'dashboard-vendor global registry-vendor directory';

  goBack(): void {
    this.router.navigate(['/commerce/manage-vendors']);
  }

  navigateToApprovalQueue(): void {
    sessionStorage.setItem(this.VM_TAB_KEY, 'Vendor Global Registry');
    this.router.navigate(['/commerce/manage-vendors']);
  }

  navigateToDashboard(): void {
    sessionStorage.setItem(this.VM_TAB_KEY, 'Dashboard');
    this.router.navigate(['/commerce/manage-vendors']);
  }

  navigateToVendor(id: string): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { returnTo: 'directory' }
    });
  }



  navigateToVendorDetail(id: string): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { returnTo: 'directory' }
    });
  }

  // ============================================================
  // ACTIONS - UPDATED
  // ============================================================

  /**
   * View vendor details - navigates to profile page
   */
  viewVendor(id: number): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { returnTo: 'directory' }
    });
  }

  /**

  /**
   * Delete vendor with confirmation
   */
  deleteVendor(vendor: Vendor): void {
    if (confirm(`Are you sure you want to delete ${vendor.companyName}? This action cannot be undone.`)) {
      this.vendorService.deleteVendor(String(vendor.id)).subscribe({
        next: () => {
          this.loadVendors();
        },
        error: (err) => console.error('Failed to delete vendor:', err)
      });
    }
  }

  /**
   * View performance - navigates to profile with performance tab
   */
  viewPerformance(id: string): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { tab: 'performance', returnTo: 'directory' }
    });
  }

  /**
   * View risk - navigates to profile with risk tab
   */
  viewRisk(id: string): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { tab: 'risk', returnTo: 'directory' }
    });
  }

  /**
   * View documents - navigates to profile with documents tab
   */
  viewDocuments(id: string): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { tab: 'documents', returnTo: 'directory' }
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
    localStorage.setItem('vendorListColumns', JSON.stringify(this.visibleColumns));
  }

  resetColumns(): void {
    this.columnConfigs.forEach(col => {
      col.visible = col.key !== 'select' && col.key !== 'actions' || col.key === 'select' || col.key === 'actions';
    });
    this.visibleColumns = {
      select: true,
      rank: true,
      company: true,
      tier: true,
      status: true,
      risk: true,
      performance: true,
      projects: true,
      revenue: true,
      documents: true,
      joined: true,
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

  formatCurrency(value: number): string {
    if (!value) return '—';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    if (!value) return '—';
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  getDocumentStatusCount(vendor: Vendor): { total: number; valid: number; expiring: number; expired: number } {
    const docs = vendor.documents || [];
    const total = docs.length;
    const valid = docs.filter(d => d.status === 'ACTIVE').length;
    const expiring = docs.filter(d => d.status === 'EXPIRING_SOON').length;
    const expired = docs.filter(d => d.status === 'EXPIRED').length;
    return { total, valid, expiring, expired };
  }

  getPerformanceColor(score: number): string {
    if (score >= 80) return '#2EB270';
    if (score >= 60) return '#F5A623';
    if (score >= 40) return '#F97316';
    return '#DC2626';
  }

  getPerformanceLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  // ============================================================
  // EXPORT ALL
  // ============================================================

  exportAll(): void {
    this.isExporting = true;

    this.vendorService.exportVendors(this.buildFilters()).subscribe({
      next: (blob: Blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `vendors_export_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        this.isExporting = false;
      },
      error: (err) => {
        console.error('Export failed:', err);
        this.isExporting = false;
      }
    });
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadVendors();
  }
}