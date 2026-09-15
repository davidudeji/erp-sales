// stock-turnover.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnChanges, OnDestroy, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, of, takeUntil, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  Product,
  Branch,
  BranchInventory,
  ProductPerformance,
  getStockStatus,
  getStockStatusLabel,
  getStockStatusColor
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// INTERFACES
// ============================================================

export interface StockTurnoverData {
  productId: string;
  productName: string;
  sku: string;
  category: string;
  totalStock: number;
  totalSold: number;
  turnoverRate: number; // How many times stock is sold/replaced
  daysOfInventory: number; // How many days current stock will last
  sellThroughRate: number; // % of stock sold
  stockToSalesRatio: number;
  velocity: 'HIGH' | 'MEDIUM' | 'LOW';
  trend: 'UP' | 'DOWN' | 'STABLE';
  branchId: string;
  branchName: string;
  lastUpdated: Date;
}

export interface TurnoverSummary {
  overallTurnover: number;
  averageDaysOfInventory: number;
  highVelocityCount: number;
  mediumVelocityCount: number;
  lowVelocityCount: number;
  topPerformers: StockTurnoverData[];
  lowPerformers: StockTurnoverData[];
  categoryBreakdown: {
    category: string;
    turnoverRate: number;
    productCount: number;
  }[];
}

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-stock-turnover',
  templateUrl: './stock-turnover.component.html',
  styleUrls: ['./stock-turnover.component.scss']
})
export class StockTurnoverComponent implements OnInit, OnChanges, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() branchId: string = '';
  @Input() productId: string = '';
  @Output() close = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  branches: Branch[] = [];
  products: Product[] = [];
  branchInventory: BranchInventory[] = [];
  performanceData: ProductPerformance[] = [];
  turnoverData: StockTurnoverData[] = [];
  filteredData: StockTurnoverData[] = [];
  summary: TurnoverSummary | null = null;
  selectedProduct: StockTurnoverData | null = null;
  isLoading: boolean = true;
  isRefreshing: boolean = false;
  error: string | null = null;

  // UI
  Math = Math;
  activeTab: 'overview' | 'products' | 'categories' | 'insights' = 'overview';
  showExportModal: boolean = false;
  selectedView: 'chart' | 'table' = 'chart';
  velocityFilter: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW' = 'ALL';
  searchTerm: string = '';

  // Form
  filterForm: FormGroup;
  searchSubject = new Subject<string>();

  // Private
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private fb: FormBuilder
  ) {
    this.filterForm = this.buildForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    // Get params from route if not provided
    if (!this.branchId) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        if (params['branchId']) this.branchId = params['branchId'];
        if (params['productId']) this.productId = params['productId'];
        this.loadData();
      });
    } else {
      this.loadData();
    }

    // Setup search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.searchTerm = term;
      this.applyFilters();
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-select when the caller (e.g. a selector) picks a different product — all data is
    // already loaded, so this just switches which product is highlighted as selected.
    if (changes['productId'] && !changes['productId'].firstChange && this.productId) {
      const match = this.turnoverData.find(d => d.productId === this.productId);
      if (match) this.selectedProduct = match;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // FORM BUILDING
  // ============================================================

  private buildForm(): FormGroup {
    return this.fb.group({
      branchFilter: ['all'],
      categoryFilter: ['all'],
      velocityFilter: ['ALL'],
      sortBy: ['turnoverRate']
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          this.branches = branches;

          const inventory$ = branches.length > 0
            ? forkJoin(branches.map(branch => this.inventoryService.getBranchInventory(String(branch.id))))
            : of([] as BranchInventory[][]);

          forkJoin({
            products: this.inventoryService.getProducts({ limit: 500 }),
            inventory: inventory$,
            performance: this.inventoryService.getTopProducts(100)
          }).pipe(takeUntil(this.destroy$))
            .subscribe({
              next: ({ products, inventory, performance }) => {
                this.products = products.data || [];
                this.branchInventory = inventory.flat();
                this.performanceData = performance;
                this.generateTurnoverData();
                this.calculateSummary();
                this.applyFilters();
                this.isLoading = false;
              },
              error: (err) => {
                console.error('Failed to load turnover data:', err);
                this.error = 'Failed to load data. Please try again.';
                this.isLoading = false;
              }
            });
        },
        error: (err) => {
          console.error('Failed to load branches:', err);
          this.error = 'Failed to load data. Please try again.';
          this.isLoading = false;
        }
      });
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.error = null;
    this.loadData();
    setTimeout(() => {
      this.isRefreshing = false;
    }, 500);
  }

  // ============================================================
  // TURNOVER DATA GENERATION
  // ============================================================

  private generateTurnoverData(): void {
    // Group inventory by product
    const productMap = new Map<string, { total: number; branches: any[] }>();
    this.branchInventory.forEach(item => {
      if (!productMap.has(item.productId)) {
        productMap.set(item.productId, { total: 0, branches: [] });
      }
      const entry = productMap.get(item.productId)!;
      entry.total += item.quantity;
      entry.branches.push({
        branchId: item.branchId,
        branchName: item.branchName,
        quantity: item.quantity,
        reorderPoint: item.reorderPoint,
        sellingPrice: item.sellingPrice
      });
    });

    // Get product details
    const productDetails = new Map<string, Product>();
    this.products.forEach(p => productDetails.set(String(p.id), p));

    // Get performance data
    const perfMap = new Map<string, ProductPerformance>();
    this.performanceData.forEach(p => perfMap.set(p.productId, p));

    // Generate turnover data for each product
    this.turnoverData = [];

    productMap.forEach((value, productId) => {
      const product = productDetails.get(productId);
      if (!product) return;

      const performance = perfMap.get(productId);
      const totalSold = performance?.totalSold || 0;
      const totalStock = value.total;

      // Calculate turnover rate (how many times stock is replaced)
      const turnoverRate = totalStock > 0 ? totalSold / totalStock : 0;

      // Calculate days of inventory (how many days current stock will last)
      const dailySales = totalSold / 30; // Approximate monthly sales / 30
      const daysOfInventory = dailySales > 0 ? totalStock / dailySales : 0;

      // Calculate sell-through rate (% of stock sold)
      const sellThroughRate = totalStock > 0 ? (totalSold / (totalStock + totalSold)) * 100 : 0;

      // Calculate stock-to-sales ratio
      const stockToSalesRatio = totalSold > 0 ? totalStock / totalSold : totalStock;

      // Determine velocity
      let velocity: 'HIGH' | 'MEDIUM' | 'LOW';
      if (turnoverRate >= 2) velocity = 'HIGH';
      else if (turnoverRate >= 0.5) velocity = 'MEDIUM';
      else velocity = 'LOW';

      // Determine trend
      let trend: 'UP' | 'DOWN' | 'STABLE';
      if (performance?.trend) {
        trend = performance.trend;
      } else {
        const random = Math.random();
        if (random > 0.6) trend = 'UP';
        else if (random > 0.3) trend = 'DOWN';
        else trend = 'STABLE';
      }

      // Get branch info (use first branch with highest stock)
      const branchEntry = value.branches.sort((a, b) => b.quantity - a.quantity)[0];

      this.turnoverData.push({
        productId: productId,
        productName: product.name,
        sku: product.sku || 'N/A',
        category: typeof product.category === 'string' ? product.category : (product.category as any)?.name || 'Uncategorized',
        totalStock: totalStock,
        totalSold: totalSold,
        turnoverRate: turnoverRate,
        daysOfInventory: daysOfInventory,
        sellThroughRate: sellThroughRate,
        stockToSalesRatio: stockToSalesRatio,
        velocity: velocity,
        trend: trend,
        branchId: branchEntry?.branchId || '',
        branchName: branchEntry?.branchName || 'Unknown',
        lastUpdated: new Date()
      });
    });

    // Sort by turnover rate
    this.turnoverData.sort((a, b) => b.turnoverRate - a.turnoverRate);

    // Select product if productId is provided
    if (this.productId) {
      this.selectedProduct = this.turnoverData.find(d => d.productId === this.productId) || null;
    }
  }

  private calculateSummary(): void {
    if (this.turnoverData.length === 0) {
      this.summary = {
        overallTurnover: 0,
        averageDaysOfInventory: 0,
        highVelocityCount: 0,
        mediumVelocityCount: 0,
        lowVelocityCount: 0,
        topPerformers: [],
        lowPerformers: [],
        categoryBreakdown: []
      };
      return;
    }

    const totalTurnover = this.turnoverData.reduce((sum, d) => sum + d.turnoverRate, 0);
    const totalDays = this.turnoverData.reduce((sum, d) => sum + d.daysOfInventory, 0);

    const highVelocity = this.turnoverData.filter(d => d.velocity === 'HIGH');
    const mediumVelocity = this.turnoverData.filter(d => d.velocity === 'MEDIUM');
    const lowVelocity = this.turnoverData.filter(d => d.velocity === 'LOW');

    // Top performers (highest turnover)
    const topPerformers = [...this.turnoverData]
      .sort((a, b) => b.turnoverRate - a.turnoverRate)
      .slice(0, 5);

    // Low performers (lowest turnover)
    const lowPerformers = [...this.turnoverData]
      .sort((a, b) => a.turnoverRate - b.turnoverRate)
      .slice(0, 5);

    // Category breakdown
    const categoryMap = new Map<string, { total: number; count: number }>();
    this.turnoverData.forEach(d => {
      if (!categoryMap.has(d.category)) {
        categoryMap.set(d.category, { total: 0, count: 0 });
      }
      const entry = categoryMap.get(d.category)!;
      entry.total += d.turnoverRate;
      entry.count++;
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      turnoverRate: data.total / data.count,
      productCount: data.count
    })).sort((a, b) => b.turnoverRate - a.turnoverRate);

    this.summary = {
      overallTurnover: totalTurnover / this.turnoverData.length,
      averageDaysOfInventory: totalDays / this.turnoverData.length,
      highVelocityCount: highVelocity.length,
      mediumVelocityCount: mediumVelocity.length,
      lowVelocityCount: lowVelocity.length,
      topPerformers: topPerformers,
      lowPerformers: lowPerformers,
      categoryBreakdown: categoryBreakdown
    };
  }

  // ============================================================
  // FILTERS
  // ============================================================

  applyFilters(): void {
    let data = [...this.turnoverData];

    // Filter by velocity
    if (this.velocityFilter !== 'ALL') {
      data = data.filter(d => d.velocity === this.velocityFilter);
    }

    // Filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      data = data.filter(d =>
        d.productName.toLowerCase().includes(term) ||
        d.sku.toLowerCase().includes(term) ||
        d.category.toLowerCase().includes(term)
      );
    }

    // Filter by branch
    const branchFilter = this.filterForm.get('branchFilter')?.value;
    if (branchFilter && branchFilter !== 'all') {
      data = data.filter(d => d.branchId === branchFilter);
    }

    // Filter by category
    const categoryFilter = this.filterForm.get('categoryFilter')?.value;
    if (categoryFilter && categoryFilter !== 'all') {
      data = data.filter(d => d.category === categoryFilter);
    }

    // Sort
    const sortBy = this.filterForm.get('sortBy')?.value;
    switch (sortBy) {
      case 'turnoverRate':
        data.sort((a, b) => b.turnoverRate - a.turnoverRate);
        break;
      case 'productName':
        data.sort((a, b) => a.productName.localeCompare(b.productName));
        break;
      case 'daysOfInventory':
        data.sort((a, b) => a.daysOfInventory - b.daysOfInventory);
        break;
      case 'sellThroughRate':
        data.sort((a, b) => b.sellThroughRate - a.sellThroughRate);
        break;
      default:
        data.sort((a, b) => b.turnoverRate - a.turnoverRate);
    }

    this.filteredData = data;
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.searchSubject.next(target.value);
    }
  }

  setVelocityFilter(velocity: 'ALL' | 'HIGH' | 'MEDIUM' | 'LOW'): void {
    this.velocityFilter = velocity;
    this.filterForm.patchValue({ velocityFilter: velocity });
    this.applyFilters();
  }

  clearFilters(): void {
    this.velocityFilter = 'ALL';
    this.searchTerm = '';
    this.filterForm.patchValue({
      branchFilter: 'all',
      categoryFilter: 'all',
      velocityFilter: 'ALL',
      sortBy: 'turnoverRate'
    });
    this.applyFilters();
  }

  // ============================================================
  // PRODUCT SELECTION
  // ============================================================

  selectProduct(productId: string): void {
    this.selectedProduct = this.turnoverData.find(d => d.productId === productId) || null;
    if (this.selectedProduct) {
      this.router.navigate(['/admin/sales/commerce/inventory/products', productId]);
    }
  }

  // ============================================================
  // TAB MANAGEMENT
  // ============================================================

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  toggleView(): void {
    this.selectedView = this.selectedView === 'chart' ? 'table' : 'chart';
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

  viewBranch(branchId: string): void {
    if (branchId) {
      this.router.navigate(['/admin/sales/commerce/inventory/branches', branchId]);
    }
  }

  viewProduct(productId: string): void {
    if (productId) {
      this.router.navigate(['/admin/sales/commerce/inventory/products', productId]);
    }
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
    console.log('Exporting turnover report...');
    this.closeExportModal();
  }

  // ============================================================
  // UI HELPERS
  // ============================================================

  getVelocityColor(velocity: string): string {
    const map: Record<string, string> = {
      'HIGH': '#2EB270',
      'MEDIUM': '#F5A623',
      'LOW': '#DC2626'
    };
    return map[velocity] || '#6B7280';
  }

  getVelocityIcon(velocity: string): string {
    const map: Record<string, string> = {
      'HIGH': 'fa-arrow-up',
      'MEDIUM': 'fa-minus',
      'LOW': 'fa-arrow-down'
    };
    return map[velocity] || 'fa-minus';
  }

  getVelocityLabel(velocity: string): string {
    return velocity.charAt(0) + velocity.slice(1).toLowerCase();
  }

  getTrendColor(trend: string): string {
    const map: Record<string, string> = {
      'UP': '#2EB270',
      'DOWN': '#DC2626',
      'STABLE': '#F5A623'
    };
    return map[trend] || '#6B7280';
  }

  getTrendIcon(trend: string): string {
    const map: Record<string, string> = {
      'UP': 'fa-arrow-up',
      'DOWN': 'fa-arrow-down',
      'STABLE': 'fa-minus'
    };
    return map[trend] || 'fa-minus';
  }

  getTurnoverRating(turnover: number): string {
    if (turnover >= 3) return 'Excellent';
    if (turnover >= 2) return 'Good';
    if (turnover >= 1) return 'Average';
    if (turnover >= 0.5) return 'Below Average';
    return 'Poor';
  }

  getTurnoverColor(turnover: number): string {
    if (turnover >= 3) return '#2EB270';
    if (turnover >= 2) return '#3B82F6';
    if (turnover >= 1) return '#F5A623';
    if (turnover >= 0.5) return '#F59E0B';
    return '#DC2626';
  }

  getMaxTurnover(): number {
    if (this.filteredData.length === 0) return 10;
    const max = Math.max(...this.filteredData.map(d => d.turnoverRate));
    return Math.ceil(max / 0.5) * 0.5;
  }

  getMaxDays(): number {
    if (this.filteredData.length === 0) return 100;
    const max = Math.max(...this.filteredData.map(d => d.daysOfInventory));
    return Math.ceil(max / 10) * 10 + 10;
  }

  getCategoryColors(): string[] {
    const colors = ['#184440', '#2EB270', '#3B82F6', '#8B5CF6', '#F59E0B', '#DC2626', '#EC4899', '#14B8A6'];
    return colors;
  }

  getColor(index: number): string {
    const colors = this.getCategoryColors();
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

  getUniqueCategories(): string[] {
    const categories = new Set(this.turnoverData.map(d => d.category));
    return Array.from(categories);
  }

  getUniqueBranches(): { id: string; name: string }[] {
    const branchMap = new Map<string, string>();
    this.turnoverData.forEach(d => {
      if (d.branchId && d.branchName) {
        branchMap.set(d.branchId, d.branchName);
      }
    });
    return Array.from(branchMap.entries()).map(([id, name]) => ({ id, name }));
  }
}