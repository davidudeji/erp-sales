import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { SalesService } from '../../../../service/sales/sales.service';
import { SalesandTransactions, SaleLifecycleStatus } from '../../../../domain/sales/sales.dto';
import { parseApiDate } from '../../../../service/sales/date.util';
import { BackButtonComponent } from '../../../../shared-component/view/back-button/back-button.component';

@Component({
  selector: 'app-sales-and-transactions-detail',
  standalone: true,
  imports: [CommonModule, BackButtonComponent],
  templateUrl: './sales-and-transactions-detail.component.html',
  styleUrls: ['./sales-and-transactions-detail.component.scss']
})
export class SalesAndTransactionsDetailComponent implements OnInit {
  @Input() detailId?: number | string | null;
  @Output() closed = new EventEmitter<void>();

  transaction: SalesandTransactions | null = null;
  isLoading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private salesService: SalesService
  ) {}

  ngOnInit(): void {
    const idParam = this.detailId || this.route.snapshot.paramMap.get('id');
    if (idParam) {
      this.loadTransaction(idParam);
    } else {
      this.isLoading = false;
    }
  }

  loadTransaction(id: number | string): void {
    this.isLoading = true;
    this.salesService.getSalesandTransactionsById(id).subscribe({
      next: (tx) => {
        this.transaction = tx;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading transaction details:', err);
        this.isLoading = false;
      }
    });
  }

  // Normalizes a raw API date value before handing it to the `date` pipe —
  // the pipe treats a raw number as milliseconds, which breaks on backend
  // records whose timestamps are epoch seconds.
  toDate(value: unknown): Date | null {
    return parseApiDate(value);
  }

  // deliveredAt comes back as epoch (getTime() === 0) as a "not delivered yet"
  // sentinel rather than being omitted, so treat that the same as no date.
  getDeliveredAtDate(): Date | null {
    const d = parseApiDate(this.transaction?.deliveredAt);
    return d && d.getTime() > 0 ? d : null;
  }

  getCustomerName(): string {
    if (!this.transaction) return 'N/A';
    const tx = this.transaction;
    if (typeof tx.customerName === 'object' && tx.customerName?.name) {
      return tx.customerName.name;
    }
    if (typeof tx.customerId === 'object' && tx.customerId?.name) {
      return tx.customerId.name;
    }
    return String(tx.customerName || tx.customerId || 'N/A');
  }

  getCustomerEmail(): string {
    if (!this.transaction) return '-';
    const cust = this.transaction.customerId || this.transaction.customerName;
    return typeof cust === 'object' ? cust?.email || '-' : '-';
  }

  getCustomerPhone(): string {
    if (!this.transaction) return '-';
    const cust = this.transaction.customerId || this.transaction.customerName;
    return typeof cust === 'object' ? cust?.phone || '-' : '-';
  }

  getQuoteNumber(): string {
    if (!this.transaction?.quoteId) return 'N/A';
    if (typeof this.transaction.quoteId === 'object') {
      return this.transaction.quoteId.quoteNumber || 'N/A';
    }
    return String(this.transaction.quoteId);
  }

  getInvoiceNumber(): string {
    if (!this.transaction?.invoiceId) return 'N/A';
    if (typeof this.transaction.invoiceId === 'object') {
      return this.transaction.invoiceId.invoiceNumber || 'N/A';
    }
    return String(this.transaction.invoiceId);
  }

  getItemsList(): any[] {
    if (!this.transaction) return [];
    if (this.transaction.items && Array.isArray((this.transaction.items as any).items)) {
      return (this.transaction.items as any).items;
    }
    if (this.transaction.quoteId && Array.isArray((this.transaction.quoteId as any).items)) {
      return (this.transaction.quoteId as any).items;
    }
    return [];
  }

  getStatusBadgeClass(status: SaleLifecycleStatus | string | undefined): string {
    if (!status) return 'badge-default';
    switch (status) {
      case 'QUOTE_SENT': return 'badge-sent';
      case 'QUOTE_ACCEPTED':
      case 'QUOTE_CONVERTED': return 'badge-converted';
      case 'QUOTE_REJECTED': return 'badge-rejected';
      case 'INVOICE_SENT': return 'badge-invoice';
      case 'PAYMENT_PENDING':
      case 'PAYMENT_IN_PROGRESS': return 'badge-pending';
      case 'PAYMENT_COMPLETED':
      case 'RECEIPT_GENERATED': return 'badge-completed';
      case 'PAYMENT_FAILED': return 'badge-failed';
      case 'DISPATCHED':
      case 'IN_TRANSIT': return 'badge-transit';
      case 'DELIVERED': return 'badge-delivered';
      case 'RETURNED': return 'badge-returned';
      default: return 'badge-default';
    }
  }

  formatStatusLabel(status: SaleLifecycleStatus | string | undefined): string {
    if (!status) return 'DRAFT';
    return this.formatDisplayLabel(status);
  }

  formatPaymentMethodLabel(paymentMethod: string | undefined): string {
    return this.formatDisplayLabel(paymentMethod || 'BANK_TRANSFER');
  }

  formatPaymentModeLabel(paymentMode: string | undefined): string {
    const normalizedMode = (paymentMode || 'ONE-OFF').replace(/_/g, '-');
    return normalizedMode.toUpperCase() === 'ONE-OFF'
      ? 'One-Off'
      : this.formatDisplayLabel(normalizedMode);
  }

  private formatDisplayLabel(value: string): string {
    return value
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  formatCurrency(amount: number | undefined, currency: string = 'NGN'): string {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₦';
    return `${symbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  isStepCompleted(step: number): boolean {
    if (!this.transaction) return false;
    const s = this.transaction.status;
    switch (step) {
      case 1:
        return !!this.transaction.quoteSentDate || s !== undefined;
      case 2:
        return s === 'QUOTE_ACCEPTED' || s === 'QUOTE_CONVERTED' || s === 'INVOICE_SENT' || s === 'PAYMENT_PENDING' || s === 'PAYMENT_COMPLETED' || s === 'DELIVERED';
      case 3:
        return s === 'INVOICE_SENT' || s === 'PAYMENT_PENDING' || s === 'PAYMENT_COMPLETED' || s === 'DELIVERED';
      case 4:
        return s === 'PAYMENT_COMPLETED' || s === 'RECEIPT_GENERATED' || s === 'DELIVERED';
      case 5:
        return s === 'DELIVERED';
      default:
        return false;
    }
  }

  printSnapshot(): void {
    window.print();
  }

  goBack(): void {
    if (this.closed.observed) {
      this.closed.emit();
    } else {
      this.goToTransactionsList();
    }
  }

  goToTransactionsList(): void {
    // Must match the [cacheKey] passed to <app-nav-tab> in sales-hub.component.html.
    const sessionStorageKey = 'sales-hub';
    sessionStorage.setItem(sessionStorageKey, 'Sales & Transactions');

    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
    }
  }

  closeModal(): void {
    this.goBack();
  }
}