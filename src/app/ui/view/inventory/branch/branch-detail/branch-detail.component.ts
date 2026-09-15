// branch-detail.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { RestockSuggestion } from '../../restock/restock-suggestion/restock-suggestion.component';
import {
  Branch,
  BranchInventory,
  BranchStockSummary,
  StockMovement,
  StockAlert,
  getStockStatus,
  getStockStatusColor,
  getStockStatusLabel,
  MovementType,
  MovementStatus
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-branch-detail',
  templateUrl: './branch-detail.component.html',
  styleUrls: ['./branch-detail.component.scss']
})
export class BranchDetailComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  // Core
  branchId: string = '';
  branch: Branch | null = null;
  branches: Branch[] = [];
  branchInventory: BranchInventory[] = [];
  branchSummary: BranchStockSummary | null = null;
  isLoading: boolean = true;
  error: string | null = null;

  // Tabs
  activeTab: 'overview' | 'inventory' | 'movements' | 'alerts' | 'analytics' | 'restock' = 'overview';

  // Inventory filters
  inventoryFilters = {
    searchTerm: '',
    stockStatus: 'ALL',
    category: 'ALL'
  };

  // Categories for filter
  categories: string[] = ['ALL'];

  // Stock movement filters
  movementFilters = {
    type: 'ALL',
    status: 'ALL',
    dateFrom: '',
    dateTo: ''
  };

  // UI
  Math = Math;

  // Movement types for filter
  movementTypes = ['ALL', 'PURCHASE', 'TRANSFER', 'SALE', 'RETURN', 'ADJUSTMENT', 'DAMAGED'];
  movementStatuses = ['ALL', 'PENDING', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED'];
  stockStatuses = ['ALL', 'CRITICAL', 'LOW', 'NORMAL', 'OVERSTOCK'];

  // Computed
  filteredInventory: BranchInventory[] = [];
  filteredMovements: StockMovement[] = [];

  // Statistics
  stats = {
    totalProducts: 0,
    totalStockUnits: 0,
    totalStockValue: 0,
    lowStock: 0,
    outOfStock: 0,
    totalMovements: 0
  };

  // Alerts
  alerts: StockAlert[] = [];

  // Recent movements
  recentMovements: StockMovement[] = [];

  // Private
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private route: ActivatedRoute,
    public router: Router,
    private location: Location,
    private inventoryService: InventoryService
  ) {}

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadBranchList();
    // Optional deep link to a specific tab, e.g. ?tab=inventory. Read reactively (not just
    // once off the snapshot) — Angular reuses this component instance when only the route's
    // :branchId or query params change (e.g. clicking "View Inventory" again for a different
    // branch), so ngOnInit doesn't re-run and a snapshot-only read would leave activeTab stuck
    // on whatever tab was showing before.
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(queryParams => {
      const requestedTab = queryParams['tab'];
      if (requestedTab && ['overview', 'inventory', 'movements', 'alerts', 'analytics', 'restock'].includes(requestedTab)) {
        this.activeTab = requestedTab as typeof this.activeTab;
      }
    });
    this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
      this.branchId = params['branchId'];
      if (this.branchId) {
        this.loadBranchData();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadBranchData(): void {
    this.isLoading = true;
    this.error = null;

    // Load branch details
    this.inventoryService.getBranch(this.branchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branch) => {
          this.branch = branch;
          this.loadBranchInventory();
          this.loadBranchSummary();
          this.loadBranchAlerts();
          this.loadRecentMovements();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load branch:', err);
          this.error = 'Failed to load branch details. Please try again.';
          this.isLoading = false;
        }
      });
  }

  loadBranchList(): void {
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => { this.branches = branches; },
        error: (err) => console.error('Failed to load branch list:', err)
      });
  }

  loadBranchInventory(): void {
    this.inventoryService.getBranchInventory(this.branchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inventory) => {
          this.branchInventory = inventory;
          this.applyInventoryFilters();
          this.calculateStats();
          this.updateCategories();
        },
        error: (err) => {
          console.error('Failed to load branch inventory:', err);
        }
      });
  }

  loadBranchSummary(): void {
    this.inventoryService.getBranchAnalytics(this.branchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => {
          this.branchSummary = summary;
        },
        error: (err) => {
          console.error('Failed to load branch summary:', err);
        }
      });
  }

  loadBranchAlerts(): void {
    this.inventoryService.getDashboardAlerts()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (alerts) => {
          this.alerts = alerts.filter(a => a.branchId === this.branchId);
        },
        error: (err) => {
          console.error('Failed to load alerts:', err);
        }
      });
  }

  loadRecentMovements(): void {
    this.inventoryService.getRecentMovements(20)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (movements) => {
          this.recentMovements = movements.filter(m =>
            m.fromLocation.id === this.branchId ||
            m.toLocation.id === this.branchId
          );
          this.applyMovementFilters();
        },
        error: (err) => {
          console.error('Failed to load movements:', err);
        }
      });
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyInventoryFilters(): void {
    this.filteredInventory = this.branchInventory.filter(item => {
      const searchMatch = !this.inventoryFilters.searchTerm ||
        item.productName.toLowerCase().includes(this.inventoryFilters.searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(this.inventoryFilters.searchTerm.toLowerCase());

      const status = getStockStatus(item.quantity, item.reorderPoint, item.safetyStock);
      const statusMatch = this.inventoryFilters.stockStatus === 'ALL' ||
        status === this.inventoryFilters.stockStatus;

      return searchMatch && statusMatch;
    });
  }

  applyMovementFilters(): void {
    this.filteredMovements = this.recentMovements.filter(m => {
      const typeMatch = this.movementFilters.type === 'ALL' ||
        m.movementType === this.movementFilters.type;

      const statusMatch = this.movementFilters.status === 'ALL' ||
        m.status === this.movementFilters.status;

      return typeMatch && statusMatch;
    });
  }

  private updateCategories(): void {
    this.categories = ['ALL', 'Electronics', 'Building Materials', 'Paints', 'Plumbing'];
  }

  // ============================================================
  // STATS CALCULATION
  // ============================================================

  calculateStats(): void {
    let totalProducts = this.branchInventory.length;
    let totalStockUnits = 0;
    let totalStockValue = 0;
    let lowStock = 0;
    let outOfStock = 0;

    this.branchInventory.forEach(item => {
      totalStockUnits += item.quantity;
      totalStockValue += item.quantity * item.sellingPrice;

      if (item.quantity <= 0) {
        outOfStock++;
      } else if (item.quantity <= item.reorderPoint) {
        lowStock++;
      }
    });

    this.stats = {
      totalProducts,
      totalStockUnits,
      totalStockValue,
      lowStock,
      outOfStock,
      totalMovements: this.recentMovements.length
    };
  }

  // ============================================================
  // TAB MANAGEMENT
  // ============================================================

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  navigateToProduct(productId: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/products', productId]);
  }

  /** Switch to a different branch from the branch selector in the top bar. */
  onBranchChange(branchId: string | null): void {
    if (!branchId || branchId === this.branchId) return;
    this.router.navigate(['/admin/sales/commerce/inventory/branches', branchId]);
  }

  createTransfer(productId?: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements/transfer'], {
      queryParams: productId ? {
        productId: productId,
        branchId: this.branchId
      } : { branchId: this.branchId }
    });
  }

  createRestockRequest(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/restock/requests/new'], {
      queryParams: { branchId: this.branchId }
    });
  }

  /** Fired by <app-restock-suggestion> when a suggestion is turned into a request (it handles its own navigation). */
  onCreateRestockRequest(_suggestion: RestockSuggestion): void {
    this.refresh();
  }

  createStockCount(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements/new'], {
      queryParams: { branchId: this.branchId }
    });
  }

  navigateToAddProduct(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/branches', this.branchId, 'add-product']);
  }

  viewMovement(movementId: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements', movementId]);
  }

  // ============================================================
  // EDIT MODE
  // ============================================================

  /** Opens the dedicated branch form (same one used for "New Branch") pre-filled with this
   *  branch's current details, so editing actually has real input fields to change. */
  navigateToEdit(): void {
    this.router.navigate(['/commerce/inventory/branches', this.branchId, 'edit']);
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  goBack(): void {
    this.location.back();
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadBranchData();
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getStockStatus(quantity: number, reorderPoint: number, safetyStock: number): 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK' {
    return getStockStatus(quantity, reorderPoint, safetyStock);
  }

  getStockStatusColor(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusColor(status);
  }

  getStockStatusLabel(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusLabel(status);
  }

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

  getMovementTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'PURCHASE': 'Purchase',
      'TRANSFER': 'Transfer',
      'SALE': 'Sale',
      'RETURN': 'Return',
      'ADJUSTMENT': 'Adjustment',
      'DAMAGED': 'Damaged'
    };
    return map[type] || type;
  }

  getMovementStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
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

}