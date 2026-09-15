// sell-likelihood.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';
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

export interface SellLikelihoodPrediction {
  productId: string;
  productName: string;
  sku: string;
  branchId: string;
  branchName: string;
  likelihood: 'HIGH' | 'MEDIUM' | 'LOW';
  score: number;
  confidence: number;
  factors: {
    name: string;
    impact: 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE';
    weight: number;
    value: string;
  }[];
  recommendations: string[];
  predictedMonthlySales: number;
  predictedQuarterlySales: number;
  lastCalculated: Date;
}

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-sell-likelihood',
  templateUrl: './sell-likelihood.component.html',
  styleUrls: ['./sell-likelihood.component.scss']
})
export class SellLikelihoodComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() productId: string = '';
  @Input() branchId: string = '';
  @Output() close = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  products: Product[] = [];
  branches: Branch[] = [];
  inventory: BranchInventory[] = [];
  prediction: SellLikelihoodPrediction | null = null;
  isLoading: boolean = true;
  isPredicting: boolean = false;
  error: string | null = null;

  // UI
  Math = Math;
  activeTab: 'overview' | 'factors' | 'recommendations' | 'history' = 'overview';
  showExportModal: boolean = false;

  // Form
  predictionForm: FormGroup;
  searchSubject = new Subject<string>();

  // History data (mock)
  historyData: any[] = [];

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
    this.predictionForm = this.buildForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    // Get params from route if not provided
    if (!this.productId || !this.branchId) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        if (params['productId']) this.productId = params['productId'];
        if (params['branchId']) this.branchId = params['branchId'];
        this.loadData();
      });
    } else {
      this.loadData();
    }

    // Setup search for product selection
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.filterProducts(searchTerm);
    });
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
      productId: ['', Validators.required],
      branchId: ['', Validators.required],
      timeframe: ['month']
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    forkJoin({
      products: this.inventoryService.getProducts({ limit: 500 }),
      branches: this.inventoryService.getBranches()
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ products, branches }) => {
          this.products = products.data;
          this.branches = branches;

          // If productId and branchId are provided, load prediction
          if (this.productId && this.branchId) {
            this.loadPrediction();
          } else {
            this.isLoading = false;
          }
        },
        error: (err) => {
          console.error('Failed to load data:', err);
          this.error = 'Failed to load data';
          this.isLoading = false;
        }
      });
  }

  loadPrediction(): void {
    this.isPredicting = true;
    this.error = null;

    // In real implementation, this would call an API
    // For now, we'll generate mock prediction
    setTimeout(() => {
      this.prediction = this.generateMockPrediction();
      this.generateHistoryData();
      this.isPredicting = false;
      this.isLoading = false;
    }, 800);
  }

  // ============================================================
  // PRODUCT SEARCH
  // ============================================================

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.searchSubject.next(target.value);
    }
  }

  filterProducts(searchTerm: string): void {
    // This would be handled by the dropdown in the template
    // We're using a separate method for the product dropdown
  }

  selectProduct(product: Product): void {
    this.predictionForm.patchValue({ productId: String(product.id) });
    this.productId = String(product.id);
    // Close dropdown, and show the picked product in the search box
    // (previously cleared to '', which made the field look empty after selection).
    this.showProductDropdown = false;
    this.productSearchTerm = product.name;
  }

  onBranchChange(): void {
    this.branchId = this.predictionForm.get('branchId')?.value;
  }

  // ============================================================
  // PREDICTION GENERATION (Mock)
  // ============================================================

  private generateMockPrediction(): SellLikelihoodPrediction {
    const product = this.products.find(p => String(p.id) === this.productId);
    const branch = this.branches.find(b => String(b.id) === this.branchId);

    // Generate random factors
    const factors = [
      {
        name: 'Historical Sales',
        impact: 'POSITIVE' as const,
        weight: 40,
        value: `${Math.floor(50 + Math.random() * 150)} units/month`
      },
      {
        name: 'Branch Demographics',
        impact: Math.random() > 0.5 ? 'POSITIVE' as const : 'NEUTRAL' as const,
        weight: 20,
        value: Math.random() > 0.7 ? 'High Income Area' : 'Mixed Demographics'
      },
      {
        name: 'Seasonality',
        impact: Math.random() > 0.6 ? 'POSITIVE' as const : 'NEUTRAL' as const,
        weight: 15,
        value: Math.random() > 0.5 ? 'Peak Season' : 'Normal Season'
      },
      {
        name: 'Price Sensitivity',
        impact: Math.random() > 0.5 ? 'POSITIVE' as const : 'NEGATIVE' as const,
        weight: 10,
        value: Math.random() > 0.6 ? 'Low Sensitivity' : 'High Sensitivity'
      },
      {
        name: 'Competitor Presence',
        impact: Math.random() > 0.6 ? 'NEGATIVE' as const : 'NEUTRAL' as const,
        weight: 10,
        value: Math.random() > 0.6 ? 'Low Competition' : 'Moderate Competition'
      },
      {
        name: 'Marketing Activity',
        impact: 'POSITIVE' as const,
        weight: 5,
        value: 'Active Campaigns'
      }
    ];

    // Calculate score based on factors
    let score = 0;
    factors.forEach(f => {
      const impactMultiplier = f.impact === 'POSITIVE' ? 1 : f.impact === 'NEGATIVE' ? -0.5 : 0;
      score += (f.weight / 100) * (50 + Math.random() * 50) * (1 + impactMultiplier * 0.3);
    });
    score = Math.min(Math.max(Math.round(score), 0), 100);

    // Determine likelihood
    let likelihood: 'HIGH' | 'MEDIUM' | 'LOW';
    if (score >= 70) likelihood = 'HIGH';
    else if (score >= 45) likelihood = 'MEDIUM';
    else likelihood = 'LOW';

    // Generate recommendations
    const recommendations = [];
    if (likelihood === 'HIGH') {
      recommendations.push('Increase stock levels by 30% for this branch');
      recommendations.push('Run targeted promotion campaign');
      recommendations.push('Train staff on premium features');
    } else if (likelihood === 'MEDIUM') {
      recommendations.push('Monitor sales velocity for 2 weeks');
      recommendations.push('Test with small marketing campaign');
      recommendations.push('Consider price adjustment');
    } else {
      recommendations.push('Reduce stock allocation to this branch');
      recommendations.push('Run survey to understand low demand');
      recommendations.push('Consider product bundling');
    }

    return {
      productId: this.productId,
      productName: product?.name || 'Unknown Product',
      sku: product?.sku || 'N/A',
      branchId: this.branchId,
      branchName: branch?.name || 'Unknown Branch',
      likelihood: likelihood,
      score: score,
      confidence: 70 + Math.random() * 20,
      factors: factors,
      recommendations: recommendations,
      predictedMonthlySales: Math.floor(20 + Math.random() * 150),
      predictedQuarterlySales: Math.floor(60 + Math.random() * 450),
      lastCalculated: new Date()
    };
  }

  private generateHistoryData(): void {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    this.historyData = months.map((month, i) => ({
      month: month,
      score: 40 + Math.random() * 50,
      sales: Math.floor(10 + Math.random() * 100),
      confidence: 60 + Math.random() * 30
    }));
  }

  // ============================================================
  // REFRESH PREDICTION
  // ============================================================

  refreshPrediction(): void {
    if (this.productId && this.branchId) {
      this.loadPrediction();
    }
  }

  // ============================================================
  // TAB MANAGEMENT
  // ============================================================

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
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

  viewProduct(): void {
    if (this.productId) {
      this.router.navigate(['/admin/sales/commerce/inventory/products', this.productId]);
    }
  }

  viewBranch(): void {
    if (this.branchId) {
      this.router.navigate(['/admin/sales/commerce/inventory/branches', this.branchId]);
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
    console.log('Exporting prediction report...');
    this.closeExportModal();
  }

  // ============================================================
  // UI HELPERS
  // ============================================================

  showProductDropdown: boolean = false;
  productSearchTerm: string = '';
  filteredProducts: Product[] = [];

  toggleProductDropdown(): void {
    this.showProductDropdown = !this.showProductDropdown;
    if (this.showProductDropdown) {
      this.filteredProducts = this.products;
    }
  }

  /** Delay hiding the dropdown on blur so a (mousedown) on a dropdown option has a chance to
   *  register first — otherwise the blur fires and removes the options before the click lands. */
  onProductInputBlur(): void {
    setTimeout(() => {
      this.showProductDropdown = false;
    }, 200);
  }

  onProductSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.productSearchTerm = target.value;
    if (this.productSearchTerm.length > 0) {
      this.filteredProducts = this.products.filter(p =>
        p.name.toLowerCase().includes(this.productSearchTerm.toLowerCase()) ||
        p.sku.toLowerCase().includes(this.productSearchTerm.toLowerCase())
      );
    } else {
      this.filteredProducts = this.products;
    }
    this.showProductDropdown = true;
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getLikelihoodColor(likelihood: string): string {
    const map: Record<string, string> = {
      'HIGH': '#2EB270',
      'MEDIUM': '#F5A623',
      'LOW': '#DC2626'
    };
    return map[likelihood] || '#6B7280';
  }

  getLikelihoodIcon(likelihood: string): string {
    const map: Record<string, string> = {
      'HIGH': 'fa-arrow-up',
      'MEDIUM': 'fa-minus',
      'LOW': 'fa-arrow-down'
    };
    return map[likelihood] || 'fa-minus';
  }

  getLikelihoodLabel(likelihood: string): string {
    return likelihood.charAt(0) + likelihood.slice(1).toLowerCase();
  }

  getImpactColor(impact: string): string {
    const map: Record<string, string> = {
      'POSITIVE': '#2EB270',
      'NEUTRAL': '#F5A623',
      'NEGATIVE': '#DC2626'
    };
    return map[impact] || '#6B7280';
  }

  getImpactIcon(impact: string): string {
    const map: Record<string, string> = {
      'POSITIVE': 'fa-arrow-up',
      'NEUTRAL': 'fa-minus',
      'NEGATIVE': 'fa-arrow-down'
    };
    return map[impact] || 'fa-minus';
  }

  getProductName(productId: string): string {
    const product = this.products.find(p => String(p.id) === productId);
    return product?.name || productId;
  }

  getBranchName(branchId: string): string {
    const branch = this.branches.find(b => String(b.id) === branchId);
    return branch?.name || branchId;
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

  getHistoryChange(): number {
    if (!this.historyData || this.historyData.length === 0) return 0;
    const first = this.historyData[0]?.score || 0;
    const last = this.historyData[this.historyData.length - 1]?.score || 0;
    return last - first;
  }

  getHistoryChangeColor(): string {
    const change = this.getHistoryChange();
    if (change > 0) return '#2EB270';
    if (change < 0) return '#DC2626';
    return '#F5A623';
  }

  getMaxHistoryScore(): number {
    if (!this.historyData || this.historyData.length === 0) return 100;
    const max = Math.max(...this.historyData.map(d => d.score));
    return Math.ceil(max / 10) * 10 + 10;
  }

  getPointX(index: number, total: number): number {
    const padding = 40;
    const width = 500 - padding * 2;
    return padding + (index / (total - 1 || 1)) * width;
  }

  getPointY(value: number, max: number): number {
    const padding = 20;
    const height = 260 - padding * 2;
    return padding + height - (value / max) * height;
  }

  getHistoryPath(data: any[], max: number, key: string): string {
    if (!data || data.length === 0) return '';

    return data.map((d, i) => {
      const x = this.getPointX(i, data.length);
      const y = this.getPointY(d[key], max);
      return (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }).join(' ');
  }

  getHistoryAreaPath(data: any[], max: number, key: string): string {
    if (!data || data.length === 0) return '';

    const path = data.map((d, i) => {
      const x = this.getPointX(i, data.length);
      const y = this.getPointY(d[key], max);
      return (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }).join(' ');

    const lastX = this.getPointX(data.length - 1, data.length);
    const firstX = this.getPointX(0, data.length);
    const baseY = this.getPointY(0, max);
    return path + ` L${lastX},${baseY} L${firstX},${baseY} Z`;
  }

  isFieldInvalid(fieldName: string): boolean {
    const control = this.predictionForm.get(fieldName);
    return !!control?.invalid && !!control?.touched;
  }

  getFieldError(fieldName: string): string {
    const control = this.predictionForm.get(fieldName);
    if (!control || !control.errors) return '';

    const errors = control.errors;
    if (errors['required']) return 'This field is required';

    return 'Invalid input';
  }
}