// branch-list.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  Branch,
  BranchStockSummary,
  getStockStatus,
  getStockStatusColor,
  getStockStatusLabel
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-branch-inventory',
  templateUrl: './branch-inventory.component.html',
  styleUrls: ['./branch-inventory.component.scss']
})
export class BranchInventoryComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  // Data
  branches: Branch[] = [];
  branchSummaries: BranchStockSummary[] = [];
  filteredBranches: Branch[] = [];
  isLoading: boolean = true;
  error: string | null = null;

  // Filters
  filters = {
    searchTerm: '',
    status: 'ALL',
    type: 'ALL',
    city: 'ALL',
    branchId: null as string | null,
    minProducts: '',
    maxProducts: ''
  };

  // Stats
  stats = {
    total: 0,
    active: 0,
    inactive: 0,
    underConstruction: 0,
    totalProducts: 0,
    totalStockValue: 0,
    totalStockUnits: 0
  };

  // City options for filter
  cities: string[] = ['ALL'];
  // Loaded dynamically (see loadBranchTypes()) so custom branch types show up here too, not
  // just the three built-in ones.
  typeOptions: string[] = ['ALL', 'FLAGSHIP', 'STANDARD', 'MINI'];
  statusOptions = ['ALL', 'ACTIVE', 'INACTIVE', 'UNDER_CONSTRUCTION'];

  // Selected branch for detail view
  selectedBranchId: string | null = null;
  showBranchDetail: boolean = false;

  // UI
  Math = Math;
  aiDismissed: boolean = false;
  viewMode: 'list' | 'grid' = 'list';

  // Pagination
  currentPage: number = 0;
  pageSize: number = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];

  // Private
  private destroy$ = new Subject<void>();

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
    this.loadBranches();
    this.loadBranchSummaries();
    this.loadBranchTypes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadBranches(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          this.branches = branches;
          this.filterBranches();
          this.calculateStats();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load branches:', err);
          this.error = 'Failed to load branches. Please try again.';
          this.isLoading = false;
        }
      });
  }

  loadBranchSummaries(): void {
    this.inventoryService.getBranchSummaries()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summaries) => {
          this.branchSummaries = summaries;
          // Update stats with summary data
          this.updateStatsWithSummaries();
        },
        error: (err) => {
          console.error('Failed to load branch summaries:', err);
        }
      });
  }

  /** Populates the Type filter with every branch type that exists, including custom ones added
   *  via the branch form's "+ Add Branch Type" — not just the three built-in ones. */
  loadBranchTypes(): void {
    this.inventoryService.getBranchTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => {
          this.typeOptions = ['ALL', ...types];
        },
        error: (err) => console.error('Failed to load branch types:', err)
      });
  }

  // ============================================================
  // FILTERING
  // ============================================================

  filterBranches(): void {
    this.filteredBranches = this.branches.filter(branch => {
      // Search filter
      const searchMatch = !this.filters.searchTerm ||
        branch.name.toLowerCase().includes(this.filters.searchTerm.toLowerCase()) ||
        branch.code.toLowerCase().includes(this.filters.searchTerm.toLowerCase()) ||
        branch.location.city.toLowerCase().includes(this.filters.searchTerm.toLowerCase());

      // Status filter
      const statusMatch = this.filters.status === 'ALL' ||
        branch.status === this.filters.status;

      // Type filter
      const typeMatch = this.filters.type === 'ALL' ||
        branch.type === this.filters.type;

      // City filter
      const cityMatch = this.filters.city === 'ALL' ||
        branch.location.city === this.filters.city;

      // Branch quick-filter (jump straight to a single branch)
      const branchMatch = !this.filters.branchId ||
        String(branch.id) === this.filters.branchId;

      // Products count filter (using summary data)
      const summary = this.branchSummaries.find(s => s.branchId === String(branch.id));
      const productCount = summary?.totalProducts || 0;
      const minMatch = !this.filters.minProducts || productCount >= parseInt(this.filters.minProducts);
      const maxMatch = !this.filters.maxProducts || productCount <= parseInt(this.filters.maxProducts);

      return searchMatch && statusMatch && typeMatch && cityMatch && branchMatch && minMatch && maxMatch;
    });

    // Update cities for filter
    this.updateCityOptions();

    this.currentPage = 0;
  }

  updateCityOptions(): void {
    const cities = this.branches.map(b => b.location.city);
    this.cities = ['ALL', ...new Set(cities)];
  }

  applyFilters(): void {
    this.filterBranches();
  }

  resetFilters(): void {
    this.filters = {
      searchTerm: '',
      status: 'ALL',
      type: 'ALL',
      city: 'ALL',
      branchId: null,
      minProducts: '',
      maxProducts: ''
    };
    this.filterBranches();
  }

  onBranchFilterChange(branchId: string | null): void {
    this.filters.branchId = branchId;
    this.applyFilters();
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  get totalElements(): number {
    return this.filteredBranches.length;
  }

  get totalPages(): number {
    return Math.ceil(this.totalElements / this.pageSize) || 1;
  }

  get pagedBranches(): Branch[] {
    const start = this.currentPage * this.pageSize;
    return this.filteredBranches.slice(start, start + this.pageSize);
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

  // ============================================================
  // STATS CALCULATION
  // ============================================================

  calculateStats(): void {
    this.stats.total = this.branches.length;
    this.stats.active = this.branches.filter(b => b.status === 'ACTIVE').length;
    this.stats.inactive = this.branches.filter(b => b.status === 'INACTIVE').length;
    this.stats.underConstruction = this.branches.filter(b => b.status === 'UNDER_CONSTRUCTION').length;
  }

  updateStatsWithSummaries(): void {
    let totalProducts = 0;
    let totalStockValue = 0;
    let totalStockUnits = 0;

    this.branchSummaries.forEach(summary => {
      totalProducts += summary.totalProducts || 0;
      totalStockValue += summary.totalStockValue || 0;
      totalStockUnits += summary.totalStockUnits || 0;
    });

    this.stats.totalProducts = totalProducts;
    this.stats.totalStockValue = totalStockValue;
    this.stats.totalStockUnits = totalStockUnits;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  navigateToBranch(branchId: string | number): void {
    this.router.navigate(['/admin/sales/commerce/inventory/branches', branchId]);
  }

  navigateToNewBranch(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/branches/new']);
  }

  navigateToAddProduct(branchId: string | number): void {
    this.router.navigate(['/admin/sales/commerce/inventory/branches', branchId, 'add-product']);
  }

  // ============================================================
  // VIEW MODE
  // ============================================================

  setViewMode(mode: 'list' | 'grid'): void {
    this.viewMode = mode;
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getBranchStatusColor(status: string): string {
    const map: Record<string, string> = {
      'ACTIVE': '#2EB270',
      'INACTIVE': '#6B7280',
      'UNDER_CONSTRUCTION': '#F59E0B'
    };
    return map[status] || '#6B7280';
  }

  getBranchTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'FLAGSHIP': 'Flagship',
      'STANDARD': 'Standard',
      'MINI': 'Mini'
    };
    if (map[type]) return map[type];
    // Custom branch types are shown in Title Case no matter how they were typed in.
    return type.toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
  }

  /** True for any branch type outside the three built-in ones — used to give custom types
   *  their own badge color instead of falling through unstyled. */
  isCustomBranchType(type: string): boolean {
    return !['FLAGSHIP', 'STANDARD', 'MINI'].includes(type);
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getStockStatus(quantity: number, reorderPoint: number, safetyStock: number): 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK' {
    return getStockStatus(quantity, reorderPoint, safetyStock);
  }

  getStockStatusColor(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusColor(status);
  }

  getStockStatusLabel(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusLabel(status);
  }

  getBranchSummary(branchId: string | number): BranchStockSummary | undefined {
    return this.branchSummaries.find(s => s.branchId === String(branchId));
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

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  getActiveFilterCount(): number {
    let count = 0;
    if (this.filters.status !== 'ALL') count++;
    if (this.filters.type !== 'ALL') count++;
    if (this.filters.city !== 'ALL') count++;
    if (this.filters.branchId) count++;
    if (this.filters.searchTerm) count++;
    if (this.filters.minProducts) count++;
    if (this.filters.maxProducts) count++;
    return count;
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadBranches();
    this.loadBranchSummaries();
  }
}