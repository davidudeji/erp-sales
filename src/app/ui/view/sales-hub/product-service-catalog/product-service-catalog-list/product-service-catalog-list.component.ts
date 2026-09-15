import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { Category } from '../../../../domain/inventory/inventory.dto';
import { formatApiDate } from '../../../../service/sales/date.util';

// ============================================================
// COMPONENT
// ============================================================
//
// Product Management (in Inventory) is the single hub for creating, editing, and
// organizing products, categories, units, and suppliers — this catalog is a read-only
// view of that same data for Sales. It exists to let a salesperson browse what's
// available and act on it in exactly two ways: start a Quote, or start an Invoice. There
// is no Add Product / Add Category / Add Unit / Add Supplier, and no Edit or Delete here
// — those changes always happen in Inventory and are reflected here automatically since
// this reads straight from InventoryService.

@Component({
  selector: 'app-product-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './product-service-catalog-list.component.html',
  styleUrls: ['./product-service-catalog-list.component.scss']
})
export class ProductServiceCatalogListComponent implements OnInit, OnDestroy {

  protected readonly Math = Math;

  viewMode: 'list' | 'icon' = 'icon';
  products: any[] = [];
  isLoading = true;
  selectedProductIds: any[] = [];

  // AI insight banner
  aiDismissed = false;

  setViewMode(mode: 'list' | 'icon'): void {
    this.viewMode = mode;
  }

  // Filters
  filters = {
    status: 'ALL',
    category: 'ALL',
    searchTerm: '',
    minPrice: '',
    maxPrice: '',
    page: 0,
    size: 10
  };

  // Pagination
  currentPage = 0;
  pageSize = 10;
  totalElements = 0;
  totalPages = 0;

  // Stats
  stats = {
    total: 0,
    active: 0,
    outOfStock: 0,
    discontinued: 0,
    totalValue: 0
  };

  // Categories — for the filter dropdown only; managed in Inventory's Product Management.
  categories: string[] = ['ALL'];
  rawCategories: Category[] = [];

  statusOptions: { value: string; label: string; color: string }[] = [
    { value: 'ALL', label: 'All Products', color: 'gray' },
    { value: 'ACTIVE', label: 'Active', color: 'green' },
    { value: 'OUT_OF_STOCK', label: 'Out of Stock', color: 'orange' },
    { value: 'DISCONTINUED', label: 'Discontinued', color: 'red' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadCategories(): void {
    this.inventoryService.getCategories().pipe(takeUntil(this.destroy$)).subscribe({
      next: (cats: Category[]) => {
        this.rawCategories = cats;
        this.categories = ['ALL', ...cats.map(c => c.name)];
      }
    });
  }

  loadProducts(): void {
    this.isLoading = true;

    this.inventoryService.getProducts(this.filters as any).pipe(takeUntil(this.destroy$)).subscribe({
      next: (response: any) => {
        this.products = response.data;
        this.totalElements = response.total;
        this.totalPages = Math.ceil(response.total / this.filters.size);
        this.calculateStats();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading products:', error);
        this.calculateStats();
        this.isLoading = false;
      }
    });
  }

  private calculateStats(): void {
    const totalValue = this.products.reduce((sum, p) => sum + ((p.unitPrice || p.sellingPrice || 0) * (p.stockQuantity || 0)), 0);

    this.stats = {
      total: this.products.length,
      active: this.products.filter(p => p.status === 'ACTIVE').length,
      outOfStock: this.products.filter(p => p.status === 'OUT_OF_STOCK').length,
      discontinued: this.products.filter(p => p.status === 'DISCONTINUED').length,
      totalValue: totalValue
    };
  }

  applyFilters(): void {
    this.filters.page = 0;
    this.loadProducts();
  }

  resetFilters(): void {
    this.filters = {
      status: 'ALL',
      category: 'ALL',
      searchTerm: '',
      minPrice: '',
      maxPrice: '',
      page: 0,
      size: 10
    };
    this.loadProducts();
  }

  onPageChange(page: number): void {
    this.filters.page = page;
    this.loadProducts();
  }

  onPageSizeChange(size: number): void {
    this.filters.size = size;
    this.filters.page = 0;
    this.loadProducts();
  }

  toggleSelection(productId: any, event: any): void {
    if (event.target.checked) {
      this.selectedProductIds.push(productId);
    } else {
      this.selectedProductIds = this.selectedProductIds.filter(id => String(id) !== String(productId));
    }
  }

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.selectedProductIds = this.products.map(p => p.productId || String(p.id));
    } else {
      this.selectedProductIds = [];
    }
  }

  isSelected(productId: any): boolean {
    return this.selectedProductIds.includes(productId);
  }

  isAllSelected(): boolean {
    return this.products.length > 0 && this.selectedProductIds.length === this.products.length;
  }

  /** Grid view's "#N" badge — a global row number, since `products` only holds the current page. */
  getProductIndex(product: any): number {
    return this.currentPage * this.pageSize + this.products.indexOf(product) + 1;
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'ACTIVE': 'status-active',
      'OUT_OF_STOCK': 'status-out-of-stock',
      'DISCONTINUED': 'status-discontinued'
    };
    return classes[status] || 'status-active';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'ACTIVE': 'Active',
      'OUT_OF_STOCK': 'Out of Stock',
      'DISCONTINUED': 'Discontinued'
    };
    return labels[status] || status;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  }

  formatDate(date: Date): string {
    return formatApiDate(date);
  }

  getStockStatusClass(stockQuantity: number): string {
    if (stockQuantity === 0) return 'stock-out';
    if (stockQuantity <= 5) return 'stock-low';
    return 'stock-good';
  }

  getStockStatusLabel(stockQuantity: number): string {
    if (stockQuantity === 0) return 'Out of Stock';
    if (stockQuantity <= 5) return 'Low Stock';
    return 'In Stock';
  }

  getStatusClass(status: string): string {
    return status ? status.toLowerCase().replace(/_/g, '-') : '';
  }

  getCategoryName(product: any): string {
    if (product?.category?.name) return product.category.name;
    if (product?.category && typeof product.category === 'string') return product.category;
    const id = product?.categoryId;
    if (!id) return '—';
    const cat = this.rawCategories.find(c => c.id === id || String(c.id) === String(id));
    return cat?.name || '—';
  }

  // ============================================================
  // PER-PRODUCT ACTIONS — exactly three: View, Generate Quote, Create Invoice
  // ============================================================

  viewProduct(productId: string): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/products', productId, uuid]);
    } else {
      this.router.navigate(['/products', productId]);
    }
  }

  /** Passes the product's own details (not just its id) so the quote form can build the
   *  line item directly — it has its own separate product list and an inventory id
   *  wouldn't necessarily resolve there otherwise. */
  generateQuoteFromProduct(product: any): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const path = uuid ? ['/quotes/new', uuid] : ['/quotes/new'];
    this.router.navigate(path, { queryParams: this.productQueryParams(product) });
  }

  createInvoiceFromProduct(product: any): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const path = uuid ? ['/invoices/new', uuid] : ['/invoices/new'];
    this.router.navigate(path, { queryParams: this.productQueryParams(product) });
  }

  private productQueryParams(product: any): Record<string, string> {
    return {
      productId: String(product.id),
      productName: product.name || '',
      productSku: product.sku || '',
      productDescription: product.description || '',
      productUnitPrice: String(product.unitPrice ?? product.sellingPrice ?? 0),
      productTaxRate: String(product.taxRate ?? 0)
    };
  }

  getPageNumbers(): number[] {
    const maxVisible = 5;
    let start = Math.max(0, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible);

    if (end - start < maxVisible) {
      start = Math.max(0, end - maxVisible);
    }

    return Array.from({ length: end - start }, (_, i) => start + i);
  }

}
