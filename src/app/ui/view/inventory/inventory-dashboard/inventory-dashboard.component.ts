// inventory-dashboard.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, interval, takeUntil, takeWhile } from 'rxjs';
import { InventoryService } from '../../../service/inventory/inventory.service';
import {
  InventoryDashboardData,
  InventoryDashboardStats,
  StockAlert,
  StockMovement,
  ProductPerformance,
  TopSellingProduct,
  BranchStockSummary,
  QuickAction,
  Branch,
  getStockStatus,
  getStockStatusColor,
  getStockStatusLabel,
  getMovementTypeLabel,
  getMovementTypeIcon,
  StockAlertSeverity
} from '../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-inventory-dashboard',
  templateUrl: './inventory-dashboard.component.html',
  styleUrls: ['./inventory-dashboard.component.scss']
})
export class InventoryDashboardComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  isLoading: boolean = true;
  dashboardData: InventoryDashboardData | null = null;
  error: string | null = null;

  // Branch context — null means "All Branches"
  branches: Branch[] = [];
  selectedBranchId: string | null = null;

  // Stats
  stats: InventoryDashboardStats | null = null;
  aiDismissed: boolean = false;

  // Data Arrays
  alerts: StockAlert[] = [];
  recentMovements: StockMovement[] = [];
  topProducts: ProductPerformance[] = [];
  branchSummaries: BranchStockSummary[] = [];
  quickActions: QuickAction[] = [];

  // Top Selling widget — loaded independently from the rest of the dashboard
  // (GET /inventory/dashboard/top-selling has no branch scoping of its own).
  topSellingProducts: TopSellingProduct[] = [];
  isLoadingTopSelling: boolean = true;

  // UI Helpers
  Math = Math;

  // Auto-refresh
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
    this.loadBranches();
    this.loadDashboardData();
    this.loadTopSellingProducts();
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

    this.inventoryService.getDashboardData()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (data) => {
          this.dashboardData = data;
          this.applyBranchScope();
          this.inventoryService.getQuickActions().pipe(takeUntil(this.destroy$)).subscribe(actions => { this.quickActions = actions; });
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load dashboard:', err);
          this.error = 'Failed to load inventory dashboard data';
          this.isLoading = false;
        }
      });
  }

  loadBranches(): void {
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => { this.branches = branches; },
        error: (err) => console.error('Failed to load branches:', err)
      });
  }

  loadTopSellingProducts(): void {
    this.isLoadingTopSelling = true;
    this.inventoryService.getTopSellingProducts(5)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (products) => {
          this.topSellingProducts = products;
          this.isLoadingTopSelling = false;
        },
        error: (err) => {
          console.error('Failed to load top selling products:', err);
          this.isLoadingTopSelling = false;
        }
      });
  }

  // ============================================================
  // BRANCH SWITCHING
  // ============================================================

  /** Called from the branch selector in the top bar. `null` = All Branches. */
  onBranchChange(branchId: string | null): void {
    this.selectedBranchId = branchId;
    this.applyBranchScope();
  }

  /** Re-derives every dashboard view (stats, alerts, movements, branch cards) scoped to the selected branch. */
  private applyBranchScope(): void {
    if (!this.dashboardData) return;

    if (!this.selectedBranchId) {
      this.stats = this.dashboardData.stats;
      this.alerts = this.dashboardData.alerts || [];
      this.recentMovements = this.dashboardData.recentMovements || [];
      this.topProducts = this.dashboardData.topProducts || [];
      this.branchSummaries = this.dashboardData.branchSummaries || [];
      return;
    }

    const branchId = this.selectedBranchId;
    const summary = (this.dashboardData.branchSummaries || []).find(b => b.branchId === branchId) || null;

    this.branchSummaries = summary ? [summary] : [];
    this.alerts = (this.dashboardData.alerts || []).filter(a => a.branchId === branchId);
    this.recentMovements = (this.dashboardData.recentMovements || []).filter(m =>
      m.fromLocation.id === branchId || m.toLocation.id === branchId
    );
    // Top products aren't tracked per-branch in the data model, so this stays global.
    this.topProducts = this.dashboardData.topProducts || [];

    this.stats = summary ? {
      ...this.dashboardData.stats,
      totalSkus: summary.totalProducts,
      totalStockValue: summary.totalStockValue,
      totalStockUnits: summary.totalStockUnits,
      lowStockItems: summary.lowStockCount,
      outOfStockItems: summary.outOfStockCount,
      totalBranches: 1,
      monthlyMovementCount: this.recentMovements.length
    } : this.dashboardData.stats;
  }

  // ============================================================
  // AUTO REFRESH
  // ============================================================

  private startAutoRefresh(): void {
    // Refresh every 60 seconds
    this.autoRefreshSubscription = interval(60000)
      .pipe(takeWhile(() => true))
      .subscribe(() => {
        this.loadDashboardData();
        this.loadTopSellingProducts();
      });
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  /**
   * Product Management, Stock Movements, Branch Directory, and Analytics are tabs inside the
   * Inventory shell (/commerce/inventory) rather than standalone routes, so most of these targets
   * can't be deep-linked to directly. Only the routes below actually exist on their own; anything
   * else falls back to the shell itself instead of hitting a dead route.
   */
  navigateTo(route: string): void {
    const path = route.split('?')[0];
    const realRoutes: Record<string, string> = {
      '/inventory/products/new': '/admin/sales/commerce/inventory/products/new',
      '/inventory/movements/transfer': '/admin/sales/commerce/inventory/movements/transfer'
    };
    this.router.navigateByUrl(realRoutes[path] || '/admin/sales/commerce/inventory');
  }

  navigateToProduct(productId: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/products', productId]);
  }

  navigateToBranch(branchId: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/branches', branchId]);
  }

  navigateToMovement(movementId: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements', movementId]);
  }

  /** Fired by <app-branch-stock-summary> once it (re)loads its data. */
  onSummaryLoaded(_summary: BranchStockSummary): void {
    // Currently just informational — the summary widget manages its own state.
    // Hook available for callers that want to react to fresh branch stock totals.
  }

  resolveAlert(alertId: string | number): void {
    this.inventoryService.resolveAlert(alertId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          // Remove the alert from the list
          this.alerts = this.alerts.filter(a => a.id !== Number(alertId));
          if (this.stats) {
            this.stats.lowStockItems = this.alerts.filter(a =>
              a.type === 'LOW_STOCK' || a.type === 'OUT_OF_STOCK'
            ).length;
          }
        },
        error: (err) => {
          console.error('Failed to resolve alert:', err);
        }
      });
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

  getMovementTypeLabel(type: string): string {
    return getMovementTypeLabel(type as any);
  }

  getMovementTypeIcon(type: string): string {
    return getMovementTypeIcon(type as any);
  }

  getAlertSeverityClass(severity: StockAlertSeverity): string {
    const map: Record<StockAlertSeverity, string> = {
      [StockAlertSeverity.INFO]: 'info',
      [StockAlertSeverity.WARNING]: 'warning',
      [StockAlertSeverity.CRITICAL]: 'critical'
    };
    return map[severity] || 'info';
  }

  getAlertIcon(type: string): string {
    const map: Record<string, string> = {
      'LOW_STOCK': 'fa-exclamation-triangle',
      'OUT_OF_STOCK': 'fa-times-circle',
      'EXPIRING': 'fa-clock',
      'OVER_STOCK': 'fa-arrow-up'
    };
    return map[type] || 'fa-bell';
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

  getPerformanceTrend(trend: 'UP' | 'DOWN' | 'STABLE'): string {
    const map = {
      'UP': 'fa-arrow-up',
      'DOWN': 'fa-arrow-down',
      'STABLE': 'fa-minus'
    };
    return map[trend] || 'fa-minus';
  }

  getPerformanceTrendColor(trend: 'UP' | 'DOWN' | 'STABLE'): string {
    const map = {
      'UP': '#2EB270',
      'DOWN': '#DC2626',
      'STABLE': '#F5A623'
    };
    return map[trend] || '#6B7280';
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
    this.loadTopSellingProducts();
  }
}