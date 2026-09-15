// product-detail.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  Product,
  ProductPerformance,
  BranchInventory,
  Branch,
  Category,
  Supplier,
  getStockStatus,
  getStockStatusLabel,
  getStockStatusColor,
  ProductStatus
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-product-detail',
  templateUrl: './product-detail.component.html',
  styleUrls: ['./product-detail.component.scss']
})
export class ProductDetailComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() productId: string = '';
  @Output() close = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Core
  product: Product | null = null;
  productPerformance: ProductPerformance | null = null;
  branchInventory: BranchInventory[] = [];
  branches: Branch[] = [];
  categories: Category[] = [];
  suppliers: Supplier[] = [];
  isLoading: boolean = true;
  error: string | null = null;

  // Tabs
  activeTab: 'overview' | 'inventory' | 'performance' | 'history' = 'overview';

  // UI
  Math = Math;
  isEditing: boolean = false;

  // Enums
  ProductStatus = ProductStatus;

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
  ) {}

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    // Get productId from route if not provided
    if (!this.productId) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        if (params['id']) {
          this.productId = params['id'];
          this.loadProductData();
        }
      });
    } else {
      this.loadProductData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadProductData(): void {
    this.isLoading = true;
    this.error = null;

    // Load product details
    this.inventoryService.getProduct(this.productId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (product) => {
          this.product = product;
          this.isLoading = false;
          
          // Load related data
          this.loadProductPerformance();
          this.loadBranchInventory();
          this.loadBranches();
          this.loadCategories();
          this.loadSuppliers();
        },
        error: (err) => {
          console.error('Failed to load product:', err);
          this.error = 'Failed to load product details. Please try again.';
          this.isLoading = false;
        }
      });
  }

  loadProductPerformance(): void {
    this.inventoryService.getProductPerformance(this.productId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (performance) => {
          this.productPerformance = performance;
        },
        error: (err) => {
          console.error('Failed to load product performance:', err);
        }
      });
  }

  loadBranchInventory(): void {
    // Get inventory across all branches for this product
    // This would be a specific API call in production
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          // For each branch, get inventory and filter by product
          branches.forEach(branch => {
            this.inventoryService.getBranchInventory(String(branch.id))
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (inventory) => {
                  const items = inventory.filter(i => i.productId === this.productId);
                  this.branchInventory.push(...items);
                },
                error: (err) => console.error('Failed to load branch inventory:', err)
              });
          });
        },
        error: (err) => console.error('Failed to load branches:', err)
      });
  }

  loadBranches(): void {
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          this.branches = branches;
        },
        error: (err) => console.error('Failed to load branches:', err)
      });
  }

  loadCategories(): void {
    this.inventoryService.getCategories()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (categories) => {
          this.categories = categories;
        },
        error: (err) => console.error('Failed to load categories:', err)
      });
  }

  loadSuppliers(): void {
    this.inventoryService.getSuppliers()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (suppliers) => {
          this.suppliers = suppliers;
        },
        error: (err) => console.error('Failed to load suppliers:', err)
      });
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

  editProduct(): void {
    if (this.product) {
      this.router.navigate(['/admin/sales/commerce/inventory/products', this.product.id, 'edit']);
    }
  }

  viewBranch(branchId: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/branches', branchId]);
  }

  createTransfer(productId: string | number, branchId: string | number): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements/transfer'], {
      queryParams: {
        productId: String(productId),
        branchId: String(branchId)
      }
    });
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

  getTotalStock(): number {
    if (!this.product) return 0;
    return this.branchInventory.reduce((sum, item) => sum + item.quantity, 0);
  }

  getTotalValue(): number {
    if (!this.product) return 0;
    return this.branchInventory.reduce((sum, item) => sum + (item.quantity * item.sellingPrice), 0);
  }

  getPerformanceColor(score: number): string {
    if (score >= 80) return '#2EB270';
    if (score >= 60) return '#F5A623';
    if (score >= 40) return '#F97316';
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

  formatDate(date: Date | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date | null | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      [ProductStatus.ACTIVE]: 'active',
      [ProductStatus.INACTIVE]: 'inactive',
      [ProductStatus.DISCONTINUED]: 'discontinued',
      [ProductStatus.OUT_OF_STOCK]: 'out-of-stock'
    };
    return map[status] || 'inactive';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  getTrendIcon(trend: 'UP' | 'DOWN' | 'STABLE'): string {
    const map = {
      'UP': 'fa-arrow-up',
      'DOWN': 'fa-arrow-down',
      'STABLE': 'fa-minus'
    };
    return map[trend] || 'fa-minus';
  }

  getTrendColor(trend: 'UP' | 'DOWN' | 'STABLE'): string {
    const map = {
      'UP': '#2EB270',
      'DOWN': '#DC2626',
      'STABLE': '#F5A623'
    };
    return map[trend] || '#6B7280';
  }

  getBranchName(branchId: string): string {
    const branch = this.branches.find(b => String(b.id) === branchId);
    return branch?.name || branchId;
  }

  getCategoryName(): string {
    const raw = (this.product?.category as any)?.name || this.product?.category;
    if (!raw) return 'Uncategorized';
    if (typeof raw === 'string') {
      // `category` may hold either the category's id or its literal name (legacy data) —
      // resolve it to a name if it matches a known category, otherwise trust it as-is.
      const byId = this.categories.find(c => String(c.id) === String(raw) || c.categoryId === raw);
      return byId?.name || raw;
    }
    return 'Uncategorized';
  }

  getSupplierName(supplierId: string): string {
    const supplier = this.suppliers.find(s => String(s.id) === supplierId || s.supplierId === supplierId);
    return supplier?.name || supplierId;
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

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadProductData();
  }
}