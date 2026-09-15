import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { SalesService } from '../../../../service/sales/sales.service';
import { Customer } from '../../../../domain/sales/sales.dto';
import { formatApiDate } from '../../../../service/sales/date.util';
import { BackButtonComponent } from '../../../../shared-component/view/back-button/back-button.component';
import { MessageService } from 'primeng/api';

// No local ToastModule/providers/<p-toast> here on purpose: this component navigates away
// right after a successful delete, so a locally-scoped MessageService (with its own <p-toast>)
// would be torn down before the toast could render. Leaving MessageService un-shadowed lets it
// resolve to the app-root singleton instead, whose <p-toast> in app.html outlives the navigation.
@Component({
  selector: 'app-customer-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, BackButtonComponent],
  templateUrl: './customer-detail.component.html',
  styleUrls: ['./customer-detail.component.scss']
})
export class CustomerDetailComponent implements OnInit, OnDestroy {
  
  customer: Customer | null = null;
  isLoading = true;
  customerId: string = '';
  
  // UI State
  showDeleteConfirm = false;
  
  // Order history (mock)
  orderHistory: any[] = [];
  isLoadingOrders = false;
  
  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router,
    private salesService: SalesService
  ) {}

  ngOnInit(): void {
    this.customerId = this.route.snapshot.paramMap.get('id') || '';
    if (this.customerId) {
      this.loadCustomer();
      this.loadOrderHistory();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadCustomer(): void {
    this.isLoading = true;
    this.salesService.getCustomerById(this.customerId).subscribe({
      next: (customer: Customer | null) => {
        this.customer = customer;
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading customer:', error);
        this.isLoading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load customer. Please try again.' });
        this.goBack();
      }
    });
  }

  private loadOrderHistory(): void {
    this.isLoadingOrders = true;
    this.salesService.getSalesandTransactions({ customerId: this.customerId, page: 0, size: 10 }).subscribe({
      next: (res: any) => {
        this.orderHistory = res.data || [];
        this.isLoadingOrders = false;
      },
      error: () => { this.isLoadingOrders = false; }
    });
  }

  editCustomer(): void {
    let uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid === 'edit') {
      uuid = null;
    }
    if (uuid) {
      this.router.navigate(['/customers', this.customerId, 'edit', uuid]);
    } else {
      this.router.navigate(['/customers', this.customerId, 'edit']);
    }
  }

  createQuote(): void {
    let uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid === 'edit') {
      uuid = null;
    }
    const path = uuid ? ['/quotes/new', uuid] : ['/quotes/new'];
    this.router.navigate(path, { queryParams: { customerId: this.customerId } });
  }

  createInvoice(): void {
    let uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid === 'edit') {
      uuid = null;
    }
    const path = uuid ? ['/invoices/new', uuid] : ['/invoices/new'];
    this.router.navigate(path, { queryParams: { customerId: this.customerId } });
  }

  deleteCustomer(): void {
    this.showDeleteConfirm = true;
  }

  confirmDelete(): void {
    const customerName = this.customer?.name || 'Customer';
    this.salesService.deleteCustomer(this.customer!.id).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `${customerName} deleted successfully` });
        const uuid = this.route.snapshot.paramMap.get('uuid') === 'edit' ? null : this.route.snapshot.paramMap.get('uuid');
        if (uuid) {
          this.router.navigate(['/sales-hub', uuid]);
        } else {
          this.router.navigate(['/sales-hub']);
        }
      },
      error: (err: any) => {
        console.error('Failed to delete customer:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete customer. Please try again.' });
      }
    });
  }

  viewOrder(orderId: string): void {
    let uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid === 'edit') {
      uuid = null;
    }
    if (uuid) {
      this.router.navigate(['/orders', orderId, uuid]);
    } else {
      this.router.navigate(['/orders', orderId]);
    }
  }

  goBack(): void {
    let uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid === 'edit') {
      uuid = null;
    }
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
    }
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'ACTIVE': 'status-active',
      'INACTIVE': 'status-inactive',
      'BLACKLISTED': 'status-blacklisted'
    };
    return classes[status] || 'status-active';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'ACTIVE': 'Active',
      'INACTIVE': 'Inactive',
      'BLACKLISTED': 'Blacklisted'
    };
    return labels[status] || status;
  }

  getOrderStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'PENDING': 'status-pending',
      'PROCESSING': 'status-processing',
      'SHIPPED': 'status-shipped',
      'DELIVERED': 'status-delivered',
      'COMPLETED': 'status-completed',
      'CANCELLED': 'status-cancelled'
    };
    return classes[status] || 'status-pending';
  }

  getOrderStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'PENDING': 'Pending',
      'PROCESSING': 'Processing',
      'SHIPPED': 'Shipped',
      'DELIVERED': 'Delivered',
      'COMPLETED': 'Completed',
      'CANCELLED': 'Cancelled'
    };
    return labels[status] || status;
  }

  formatCurrency(amount: number): string {
    const currency = 'NGN';
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  }

  formatDate(date: Date): string {
    return formatApiDate(date, { day: 'numeric', month: 'long', year: 'numeric' });
  }

  formatDateShort(date: Date): string {
    return formatApiDate(date, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  }

  getCustomerLifetimeValue(): number {
    return this.customer?.totalSpent || 0;
  }

  getAverageOrderValue(): number {
    if (!this.customer || this.customer.totalOrders === 0) return 0;
    return this.customer.totalSpent / this.customer.totalOrders;
  }

  getCustomerNotes(): string | undefined {
    return this.customer?.notes;
  }

  viewOrderHistory(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
    }
  }

  getStatusClass(status: string): string {
  const classes: Record<string, string> = {
    'ACTIVE': 'active',
    'INACTIVE': 'inactive',
    'BLACKLISTED': 'blacklisted'
  };
  return classes[status] || 'active';
}

getOrderStatusClass(status: string): string {
  const classes: Record<string, string> = {
    'PENDING': 'pending',
    'PROCESSING': 'processing',
    'SHIPPED': 'shipped',
    'DELIVERED': 'delivered',
    'COMPLETED': 'completed',
    'CANCELLED': 'cancelled'
  };
  return classes[status] || 'pending';
}
}