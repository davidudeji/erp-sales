// branch-analytics.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnChanges, OnDestroy, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  Branch,
  BranchInventory,
  BranchStockSummary,
  ProductPerformance,
  getStockStatus,
  getStockStatusLabel,
  getStockStatusColor
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-branch-analytics',
  templateUrl: './branch-analytics.component.html',
  styleUrls: ['./branch-analytics.component.scss']
})
export class BranchAnalyticsComponent implements OnInit, OnChanges, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() branchId: string = '';
  @Output() close = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Core
  branch: Branch | null = null;
  summary: BranchStockSummary | null = null;
  inventory: BranchInventory[] = [];
  topProducts: ProductPerformance[] = [];
  isLoading: boolean = true;
  error: string | null = null;

  // UI
  Math = Math;
  activeTab: 'overview' | 'inventory' | 'performance' | 'trends' = 'overview';
  dateRange: 'week' | 'month' | 'quarter' | 'year' = 'month';
  showExportModal: boolean = false;

  // Filters
  productFilter: string = '';
  filteredInventory: BranchInventory[] = [];

  // Computed
  totalStock: number = 0;
  totalValue: number = 0;
  uniqueProducts: number = 0;
  lowStockCount: number = 0;
  outOfStockCount: number = 0;

  // Chart data
  categoryData: any[] = [];
  stockDistributionData: any[] = [];
  topSellingData: any[] = [];

  // Private
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location
  ) { }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    if (!this.branchId) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        if (params['branchId']) {
          this.branchId = params['branchId'];
          this.loadData();
        }
      });
    } else {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-load when the caller (e.g. a selector dropdown) picks a different branch.
    if (changes['branchId'] && !changes['branchId'].firstChange && this.branchId) {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    forkJoin({
      branch: this.inventoryService.getBranch(this.branchId),
      summary: this.inventoryService.getBranchAnalytics(this.branchId),
      inventory: this.inventoryService.getBranchInventory(this.branchId)
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ branch, summary, inventory }) => {
          this.branch = branch;
          this.summary = summary;
          this.inventory = inventory;
          this.filteredInventory = inventory;
          this.calculateStats();
          this.prepareChartData();
          this.loadTopProducts();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load branch analytics:', err);
          this.error = 'Failed to load analytics data';
          this.isLoading = false;
        }
      });
  }

  loadTopProducts(): void {
    // In real implementation, this would fetch top products from API
    // For now, we'll generate from inventory data
    this.topProducts = this.inventory
      .sort((a, b) => (b.quantity * b.sellingPrice) - (a.quantity * a.sellingPrice))
      .slice(0, 5)
      .map(item => ({
        productId: item.productId,
        productName: item.productName,
        sku: item.sku,
        category: '',
        totalSold: 0,
        totalRevenue: item.quantity * item.sellingPrice,
        totalProfit: 0,
        averagePrice: item.sellingPrice,
        sellThroughRate: 0,
        stockTurnover: 0,
        daysOfInventory: 0,
        performanceScore: 0,
        trend: 'STABLE',
        period: { start: new Date(), end: new Date() }
      }));
  }

  // ============================================================
  // STATS CALCULATION
  // ============================================================

  calculateStats(): void {
    this.totalStock = this.inventory.reduce((sum, item) => sum + item.quantity, 0);
    this.totalValue = this.inventory.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0);
    this.uniqueProducts = this.inventory.length;
    this.lowStockCount = this.inventory.filter(item =>
      getStockStatus(item.quantity, item.reorderPoint, item.safetyStock) === 'LOW'
    ).length;
    this.outOfStockCount = this.inventory.filter(item =>
      getStockStatus(item.quantity, item.reorderPoint, item.safetyStock) === 'CRITICAL'
    ).length;
  }

  // ============================================================
  // CHART DATA PREPARATION
  // ============================================================

  prepareChartData(): void {
    // Category distribution (mock)
    const categoryMap = new Map<string, number>();
    this.inventory.forEach(item => {
      const category = item.productName.split(' ')[0] || 'Other';
      categoryMap.set(category, (categoryMap.get(category) || 0) + item.quantity);
    });

    this.categoryData = Array.from(categoryMap.entries()).map(([name, value]) => ({
      name,
      value
    })).sort((a, b) => b.value - a.value).slice(0, 6);

    // Stock distribution by status
    const statusMap = {
      'Critical': 0,
      'Low': 0,
      'Normal': 0,
      'Overstock': 0
    };

    this.inventory.forEach(item => {
      const status = getStockStatus(item.quantity, item.reorderPoint, item.safetyStock);
      if (status === 'CRITICAL') statusMap['Critical']++;
      else if (status === 'LOW') statusMap['Low']++;
      else if (status === 'NORMAL') statusMap['Normal']++;
      else if (status === 'OVERSTOCK') statusMap['Overstock']++;
    });

    this.stockDistributionData = Object.entries(statusMap).map(([name, value]) => ({
      name,
      value
    }));

    // Top selling products (using inventory value as proxy)
    this.topSellingData = this.inventory
      .sort((a, b) => (b.quantity * b.sellingPrice) - (a.quantity * a.sellingPrice))
      .slice(0, 5)
      .map(item => ({
        name: item.productName,
        value: item.quantity * item.sellingPrice,
        quantity: item.quantity
      }));
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilter(): void {
    if (!this.productFilter.trim()) {
      this.filteredInventory = this.inventory;
    } else {
      const search = this.productFilter.toLowerCase();
      this.filteredInventory = this.inventory.filter(item =>
        item.productName.toLowerCase().includes(search) ||
        item.sku.toLowerCase().includes(search)
      );
    }
  }

  clearFilter(): void {
    this.productFilter = '';
    this.filteredInventory = this.inventory;
  }

  // ============================================================
  // TAB MANAGEMENT
  // ============================================================

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  // ============================================================
  // DATE RANGE
  // ============================================================

  changeDateRange(range: 'week' | 'month' | 'quarter' | 'year'): void {
    this.dateRange = range;
    // In real implementation, this would re-fetch data
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  goBack(): void {
    if (this.close.observed) {
      this.close.emit();
    } else {
      this.location.back();
    }
  }

  viewBranch(): void {
    if (this.branch) {
      this.router.navigate(['/admin/sales/commerce/inventory/branches', this.branch.id]);
    }
  }

  viewProduct(productId: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/products', productId]);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  exportReport(): void {
    this.showExportModal = true;
  }

  closeExportModal(): void {
    this.showExportModal = false;
  }

  confirmExport(): void {
    console.log('Exporting report...');
    this.closeExportModal();
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadData();
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getStockStatus(quantity: number, reorderPoint: number, safetyStock: number): 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK' {
    return getStockStatus(quantity, reorderPoint, safetyStock);
  }

  getStockStatusLabel(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusLabel(status);
  }

  getStockStatusColor(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusColor(status);
  }

  getStockStatusClass(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    const map = {
      'CRITICAL': 'critical',
      'LOW': 'low',
      'NORMAL': 'normal',
      'OVERSTOCK': 'overstock'
    };
    return map[status] || 'normal';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getBranchTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'FLAGSHIP': 'Flagship',
      'STANDARD': 'Standard',
      'MINI': 'Mini'
    };
    return map[type] || type;
  }

  getBranchStatusColor(status: string): string {
    const map: Record<string, string> = {
      'ACTIVE': '#2EB270',
      'INACTIVE': '#6B7280',
      'UNDER_CONSTRUCTION': '#F59E0B'
    };
    return map[status] || '#6B7280';
  }

  getColor(index: number): string {
    const colors = ['#2E6276', '#2EB270', '#F5A623', '#DC2626', '#3B82F6', '#8B5CF6'];
    return colors[index % colors.length];
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

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  getMaxCategoryValue(): number {
    if (!this.categoryData || this.categoryData.length === 0) return 100;
    const max = Math.max(...this.categoryData.map(d => d.value));
    return Math.ceil(max / 10) * 10 + 10;
  }

  getMaxTopSellingValue(): number {
    if (!this.topSellingData || this.topSellingData.length === 0) return 100;
    const max = Math.max(...this.topSellingData.map(d => d.value));
    return Math.ceil(max / 10000) * 10000 + 10000;
  }

  getCategoryPercentage(value: number): number {
    const total = this.categoryData.reduce((sum, d) => sum + d.value, 0);
    if (total === 0) return 0;
    return (value / total) * 100;
  }

  getConicGradient(): string {
    if (!this.stockDistributionData || this.stockDistributionData.length === 0) {
      return '#e2e8f0';
    }

    const total = this.stockDistributionData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return '#e2e8f0';

    const colors: Record<string, string> = {
      'Critical': '#DC2626',
      'Low': '#F59E0B',
      'Normal': '#2EB270',
      'Overstock': '#3B82F6'
    };

    let gradient = '';
    let currentAngle = 0;

    this.stockDistributionData.forEach((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const start = currentAngle;
      const end = currentAngle + angle;
      const color = colors[item.name] || '#6B7280';

      if (index === 0) {
        gradient = `conic-gradient(${color} 0% ${end}%`;
      } else {
        gradient += `, ${color} ${start}% ${end}%`;
      }

      if (index === this.stockDistributionData.length - 1) {
        gradient += ')';
      }

      currentAngle = end;
    });

    return gradient;
  }
}