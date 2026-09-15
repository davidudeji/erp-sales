import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SalesService } from '../../../../service/sales/sales.service';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { formatApiDate } from '../../../../service/sales/date.util';
import { BackButtonComponent } from '../../../../shared-component/view/back-button/back-button.component';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BackButtonComponent],
  templateUrl: './product-service-catalog-detail.component.html',
  styleUrls: ['./product-service-catalog-detail.component.scss']
})
export class ProductServiceCatalogDetailComponent implements OnInit, OnDestroy {
  
  // Sourced from Inventory's Product Management — this page only ever displays it, since
  // that's the single hub for creating/editing products now.
  product: any | null = null;
  isLoading = true;
  productId: string = '';

  // Mock sales history
  salesHistory: any[] = [];
  isLoadingHistory = false;

  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router,
    private salesService: SalesService,
    private inventoryService: InventoryService
  ) {}

  ngOnInit(): void {
    this.productId = this.route.snapshot.paramMap.get('id') || '';
    if (this.productId) {
      this.loadProduct();
      this.loadSalesHistory();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadProduct(): void {
    this.isLoading = true;
    this.inventoryService.getProduct(this.productId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (product) => {
        this.product = product;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading product:', error);
        this.isLoading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load product. Please try again.' });
        this.goBack();
      }
    });
  }

  private loadSalesHistory(): void {
    this.isLoadingHistory = true;
    this.salesService.getSalesandTransactions({ page: 0, size: 10 }).subscribe({
      next: (res: any) => {
        this.salesHistory = res.data || [];
        this.isLoadingHistory = false;
      },
      error: () => { this.isLoadingHistory = false; }
    });
  }

  /** Passes the product's own details (not just its id) so the quote form can build the
   *  line item directly — it has its own separate product list and an inventory id
   *  wouldn't necessarily resolve there otherwise (see the catalog list's identical helper). */
  private productQueryParams(): Record<string, string> {
    const p = this.product;
    return {
      productId: String(p.id),
      productName: p.name || '',
      productSku: p.sku || '',
      productDescription: p.description || '',
      productUnitPrice: String(p.unitPrice ?? p.sellingPrice ?? 0),
      productTaxRate: String(p.taxRate ?? 0)
    };
  }

  generateQuote(): void {
    if (!this.product) return;
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const path = uuid ? ['/quotes/new', uuid] : ['/quotes/new'];
    this.router.navigate(path, { queryParams: this.productQueryParams() });
  }

  createInvoice(): void {
    if (!this.product) return;
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const path = uuid ? ['/invoices/new', uuid] : ['/invoices/new'];
    this.router.navigate(path, { queryParams: this.productQueryParams() });
  }

  goBack(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
    }
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  }

  formatDate(date: Date): string {
    return formatApiDate(date, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatDateShort(date: Date): string {
    return formatApiDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  // Some products only ever received a value under the legacy `sellingPrice`
  // field, so fall back to it whenever `unitPrice` wasn't populated.
  getUnitPrice(): number {
    return this.product ? (this.product.unitPrice || this.product.sellingPrice || 0) : 0;
  }

  getProfitMargin(): number {
    const unitPrice = this.getUnitPrice();
    if (!this.product || !unitPrice || this.product.costPrice === 0) return 0;
    return ((unitPrice - this.product.costPrice) / unitPrice) * 100;
  }

  getTotalStockValue(): number {
    if (!this.product) return 0;
    return this.getUnitPrice() * this.product.stockQuantity;
  }

  getOrderStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'PENDING': 'status-pending',
      'PROCESSING': 'status-processing',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
  }

  getOrderStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PENDING': 'Pending',
      'PROCESSING': 'Processing',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled'
    };
    return labels[status] || status;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }
}