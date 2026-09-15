// affordability-dashboard.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnChanges, OnDestroy, Input, Output, EventEmitter, SimpleChanges } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, takeUntil, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  Product,
  Branch,
  BranchInventory,
  getStockStatus,
  getStockStatusLabel,
  getStockStatusColor
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// INTERFACES
// ============================================================

export interface AffordabilityScore {
  branchId: string;
  branchName: string;
  location: string;
  totalProducts: number;
  totalStockValue: number;
  averageProductPrice: number;
  medianProductPrice: number;
  priceRange: {
    min: number;
    max: number;
  };
  affordabilityScore: number; // 0-100
  affordabilityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  productsCount: {
    affordable: number; // <= 25th percentile
    moderate: number;   // 25th-75th percentile
    premium: number;    // >= 75th percentile
  };
  topSellingProducts: {
    productId: string;
    productName: string;
    quantity: number;
    price: number;
  }[];
  priceDistribution: {
    price: number;
    count: number;
  }[];
  recommendations: string[];
  lastCalculated: Date;
}

export interface AffordabilityComparison {
  branchId: string;
  branchName: string;
  affordabilityScore: number;
  affordabilityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
  avgPrice: number;
  totalValue: number;
}

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-affordability-dashboard',
  templateUrl: './affordability-dashboard.component.html',
  styleUrls: ['./affordability-dashboard.component.scss']
})
export class AffordabilityDashboardComponent implements OnInit, OnChanges, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() branchId: string = '';
  @Output() close = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  branches: Branch[] = [];
  branchInventory: BranchInventory[] = [];
  affordabilityData: AffordabilityScore[] = [];
  selectedBranchData: AffordabilityScore | null = null;
  comparisonData: AffordabilityComparison[] = [];
  isLoading: boolean = true;
  isRefreshing: boolean = false;
  error: string | null = null;

  // UI
  activeTab: 'overview' | 'branches' | 'comparison' | 'insights' = 'overview';
  showExportModal: boolean = false;
  selectedView: 'chart' | 'table' = 'chart';

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
    // Get branch param from route if not provided
    if (!this.branchId) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        if (params['branchId']) this.branchId = params['branchId'];
        this.loadData();
      });
    } else {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-select when the caller (e.g. a selector dropdown) picks a different branch —
    // all branches' data is already loaded, so this just switches which one is shown.
    if (changes['branchId'] && !changes['branchId'].firstChange && this.branchId) {
      const match = this.affordabilityData.find(d => d.branchId === this.branchId);
      if (match) this.selectedBranchData = match;
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
      priceRange: ['all'],
      categoryFilter: ['all'],
      sortBy: ['affordability']
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

          if (branches.length === 0) {
            this.branchInventory = [];
            this.generateAffordabilityData();
            this.isLoading = false;
            return;
          }

          forkJoin(branches.map(branch => this.inventoryService.getBranchInventory(String(branch.id))))
            .pipe(takeUntil(this.destroy$))
            .subscribe({
              next: (results) => {
                this.branchInventory = results.flat();
                this.generateAffordabilityData();
                this.isLoading = false;
              },
              error: (err) => {
                console.error('Failed to load branch inventory:', err);
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
  // AFFORDABILITY DATA GENERATION
  // ============================================================

  private generateAffordabilityData(): void {
    // Group inventory by branch
    const branchMap = new Map<string, BranchInventory[]>();
    this.branchInventory.forEach(item => {
      if (!branchMap.has(item.branchId)) {
        branchMap.set(item.branchId, []);
      }
      branchMap.get(item.branchId)!.push(item);
    });

    // Generate affordability score for each branch
    this.affordabilityData = this.branches.map(branch => {
      const inventory = branchMap.get(String(branch.id)) || [];
      const prices = inventory.map(item => item.sellingPrice).filter(p => p > 0);
      const totalValue = inventory.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0);
      const totalProducts = inventory.reduce((sum, item) => sum + item.quantity, 0);

      // Calculate price statistics
      const sortedPrices = [...prices].sort((a, b) => a - b);
      const minPrice = sortedPrices[0] || 0;
      const maxPrice = sortedPrices[sortedPrices.length - 1] || 0;
      const avgPrice = prices.length > 0 ? prices.reduce((a, b) => a + b, 0) / prices.length : 0;
      const medianPrice = this.calculateMedian(sortedPrices);

      // Calculate affordability score
      // Factors: average price relative to all branches, product mix, total value
      const allPrices = this.affordabilityData.length === 0 ?
        this.branchInventory.map(item => item.sellingPrice).filter(p => p > 0) :
        this.affordabilityData.flatMap(d =>
          this.branchInventory.filter(i => i.branchId === d.branchId).map(i => i.sellingPrice)
        ).filter(p => p > 0);

      const globalAvgPrice = allPrices.length > 0 ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length : 1;
      const priceRatio = avgPrice > 0 ? globalAvgPrice / avgPrice : 1;

      // Score components (0-100)
      const priceScore = Math.min(Math.max((priceRatio) * 50, 0), 50);
      const volumeScore = Math.min(Math.max((totalProducts / 100) * 25, 0), 25);
      const valueScore = Math.min(Math.max((totalValue / 1000000) * 25, 0), 25);

      const affordabilityScore = Math.round(priceScore + volumeScore + valueScore);

      // Determine affordability level
      let affordabilityLevel: 'HIGH' | 'MEDIUM' | 'LOW';
      if (affordabilityScore >= 60) affordabilityLevel = 'HIGH';
      else if (affordabilityScore >= 35) affordabilityLevel = 'MEDIUM';
      else affordabilityLevel = 'LOW';

      // Calculate product distribution by price tiers
      const twentyFifthPercentile = this.calculatePercentile(sortedPrices, 25);
      const seventyFifthPercentile = this.calculatePercentile(sortedPrices, 75);

      let affordable = 0, moderate = 0, premium = 0;
      inventory.forEach(item => {
        const price = item.sellingPrice;
        if (price <= twentyFifthPercentile) affordable++;
        else if (price <= seventyFifthPercentile) moderate++;
        else premium++;
      });

      // Generate price distribution for chart
      const priceDistribution = this.generatePriceDistribution(inventory);

      // Top selling products
      const topSelling = inventory
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 5)
        .map(item => ({
          productId: item.productId,
          productName: item.productName,
          quantity: item.quantity,
          price: item.sellingPrice
        }));

      // Generate recommendations
      const recommendations = this.generateRecommendations(
        affordabilityScore,
        affordabilityLevel,
        avgPrice,
        totalProducts,
        inventory
      );

      return {
        branchId: String(branch.id),
        branchName: branch.name,
        location: `${branch.location.city}, ${branch.location.state}`,
        totalProducts,
        totalStockValue: totalValue,
        averageProductPrice: avgPrice,
        medianProductPrice: medianPrice,
        priceRange: { min: minPrice, max: maxPrice },
        affordabilityScore,
        affordabilityLevel,
        productsCount: { affordable, moderate, premium },
        topSellingProducts: topSelling,
        priceDistribution,
        recommendations,
        lastCalculated: new Date()
      };
    });

    // Select branch data if branchId is provided
    if (this.branchId) {
      this.selectedBranchData = this.affordabilityData.find(d => d.branchId === this.branchId) || null;
      if (!this.selectedBranchData && this.affordabilityData.length > 0) {
        this.selectedBranchData = this.affordabilityData[0];
      }
    } else if (this.affordabilityData.length > 0) {
      this.selectedBranchData = this.affordabilityData[0];
    }

    // Generate comparison data
    this.comparisonData = this.affordabilityData.map(d => ({
      branchId: d.branchId,
      branchName: d.branchName,
      affordabilityScore: d.affordabilityScore,
      affordabilityLevel: d.affordabilityLevel,
      avgPrice: d.averageProductPrice,
      totalValue: d.totalStockValue
    }));
  }

  // ============================================================
  // UTILITY FUNCTIONS
  // ============================================================

  private calculateMedian(sortedArray: number[]): number {
    if (sortedArray.length === 0) return 0;
    const mid = Math.floor(sortedArray.length / 2);
    if (sortedArray.length % 2 === 0) {
      return (sortedArray[mid - 1] + sortedArray[mid]) / 2;
    }
    return sortedArray[mid];
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    const index = (percentile / 100) * (sortedArray.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper || upper >= sortedArray.length) {
      return sortedArray[lower] || 0;
    }
    return sortedArray[lower] + (sortedArray[upper] - sortedArray[lower]) * (index - lower);
  }

  private generatePriceDistribution(inventory: BranchInventory[]): { price: number; count: number }[] {
    const priceMap = new Map<number, number>();
    inventory.forEach(item => {
      const price = Math.round(item.sellingPrice / 1000) * 1000; // Group by thousands
      priceMap.set(price, (priceMap.get(price) || 0) + 1);
    });

    return Array.from(priceMap.entries())
      .map(([price, count]) => ({ price, count }))
      .sort((a, b) => a.price - b.price)
      .slice(0, 20); // Limit to 20 data points
  }

  private generateRecommendations(
    score: number,
    level: 'HIGH' | 'MEDIUM' | 'LOW',
    avgPrice: number,
    totalProducts: number,
    inventory: BranchInventory[]
  ): string[] {
    const recommendations: string[] = [];

    if (level === 'HIGH') {
      recommendations.push('Branch has strong affordability — consider premium product placement');
      recommendations.push('Customers in this area can support higher price points');
      if (totalProducts < 100) {
        recommendations.push('Expand product variety to capture more market share');
      }
    } else if (level === 'MEDIUM') {
      recommendations.push('Balanced affordability — maintain current pricing strategy');
      recommendations.push('Consider tiered pricing to serve different customer segments');
      if (avgPrice > 50000) {
        recommendations.push('Introduce more entry-level products to improve affordability');
      }
    } else {
      recommendations.push('Low affordability score — review pricing strategy for this branch');
      recommendations.push('Consider offering discounts or payment plans');
      recommendations.push('Focus on essential products with competitive pricing');
    }

    // Additional recommendations based on inventory
    const lowStockItems = inventory.filter(item => item.quantity < item.reorderPoint);
    if (lowStockItems.length > 5) {
      recommendations.push(`${lowStockItems.length} products are below reorder point — restock soon`);
    }

    const expensiveItems = inventory.filter(item => item.sellingPrice > 100000);
    if (expensiveItems.length > 0 && level === 'LOW') {
      recommendations.push(`${expensiveItems.length} high-priced items may not perform well here`);
    }

    return recommendations.slice(0, 5);
  }

  // ============================================================
  // BRANCH SELECTION
  // ============================================================

  selectBranch(branchId: string): void {
    this.branchId = branchId;
    this.selectedBranchData = this.affordabilityData.find(d => d.branchId === branchId) || null;
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
    console.log('Exporting affordability report...');
    this.closeExportModal();
  }

  // ============================================================
  // UI HELPERS
  // ============================================================

  getAffordabilityColor(level: string): string {
    const map: Record<string, string> = {
      'HIGH': '#2EB270',
      'MEDIUM': '#F5A623',
      'LOW': '#DC2626'
    };
    return map[level] || '#6B7280';
  }

  getAffordabilityIcon(level: string): string {
    const map: Record<string, string> = {
      'HIGH': 'fa-arrow-up',
      'MEDIUM': 'fa-minus',
      'LOW': 'fa-arrow-down'
    };
    return map[level] || 'fa-minus';
  }

  getAffordabilityLabel(level: string): string {
    return level.charAt(0) + level.slice(1).toLowerCase();
  }

  getAffordabilityGradient(score: number): string {
    if (score >= 60) return '#2EB270';
    if (score >= 35) return '#F5A623';
    return '#DC2626';
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

  getMaxPrice(): number {
    if (!this.selectedBranchData) return 1000;
    const max = Math.max(...this.selectedBranchData.priceDistribution.map(d => d.count));
    return max * 1.2;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  getColor(index: number): string {
    const colors = ['#184440', '#2EB270', '#3B82F6', '#8B5CF6', '#F59E0B', '#DC2626', '#EC4899'];
    return colors[index % colors.length];
  }

  getScoreBarWidth(score: number): number {
    return Math.min(Math.max(score, 0), 100);
  }

  getBranchCount(): number {
    return this.affordabilityData.length;
  }

  getAverageScore(): number {
    if (this.affordabilityData.length === 0) return 0;
    const sum = this.affordabilityData.reduce((acc, d) => acc + d.affordabilityScore, 0);
    return Math.round(sum / this.affordabilityData.length);
  }

  getHighScoreBranches(): number {
    return this.affordabilityData.filter(d => d.affordabilityLevel === 'HIGH').length;
  }

  getLowScoreBranches(): number {
    return this.affordabilityData.filter(d => d.affordabilityLevel === 'LOW').length;
  }
}