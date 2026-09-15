import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SalesService } from '../../../../service/sales/sales.service';
import { SalesandTransactions, SaleLifecycleStatus, PaymentMethod } from '../../../../domain/sales/sales.dto';
import { parseApiDate } from '../../../../service/sales/date.util';
import { SharedOverlayModule } from '../../../../../shared-overlay.module';
import { PaymentReceiptComponent } from '../../payment-receipt/payment-receipt.component';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-sales-and-transactions-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SharedOverlayModule,
    PaymentReceiptComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './sales-and-transactions-list.component.html',
  styleUrls: ['./sales-and-transactions-list.component.scss']
})
export class SalesAndTransactionsListComponent implements OnInit, OnDestroy {
  protected readonly Math = Math;

  transactions: SalesandTransactions[] = [];
  filteredTransactions: SalesandTransactions[] = [];
  customers: any[] = [];
  isLoading: boolean = false;
  searchTerm: string = '';
  selectedStatus: string = 'ALL';

  // Record Payment Modal State
  showPaymentModal = false;
  selectedTxForPayment: SalesandTransactions | null = null;
  paymentAmount: number = 0;
  paymentMethod: PaymentMethod = 'BANK_TRANSFER';
  paymentReference: string = '';
  paymentNotes: string = '';
  paymentDate: string = new Date().toISOString().substring(0, 10);
  isSavingPayment = false;

  paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'BANK_TRANSFER', label: 'Bank Transfer (EFT)' },
    { value: 'CARD', label: 'Credit / Debit Card' },
    { value: 'CASH', label: 'Cash Payment' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'POS', label: 'Point of Sale (POS)' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money' }
  ];

  // Print Receipt Modal State
  showReceiptModal = false;
  selectedReceiptTx: SalesandTransactions | null = null;
  selectedTxId: number | string | null = null;
  showDetailModal: boolean = false;

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  totalPages: number = 1;

  // Sidebar date-range filter
  filters: { dateFrom: string; dateTo: string } = { dateFrom: '', dateTo: '' };

  // AI insight banner
  aiDismissed = false;

  // Row selection (bulk actions bar)
  selectedTransactionIds: number[] = [];

  statusOptions: { label: string; value: string }[] = [
    { label: 'All Lifecycle Statuses', value: 'ALL' },
    { label: 'Quote Sent', value: 'QUOTE_SENT' },
    { label: 'Quote Accepted', value: 'QUOTE_ACCEPTED' },
    { label: 'Quote Converted', value: 'QUOTE_CONVERTED' },
    { label: 'Invoice Sent', value: 'INVOICE_SENT' },
    { label: 'Payment Pending', value: 'PAYMENT_PENDING' },
    { label: 'Payment Completed', value: 'PAYMENT_COMPLETED' },
    { label: 'Dispatched', value: 'DISPATCHED' },
    { label: 'Delivered', value: 'DELIVERED' }
  ];

  private destroy$ = new Subject<void>();

  get todayDateString(): string {
    return new Date().toISOString().substring(0, 10);
  }

  constructor(
    private salesService: SalesService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadTransactions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // Normalizes a raw API date value before handing it to the `date` pipe —
  // the pipe treats a raw number as milliseconds, which breaks on backend
  // records whose timestamps are epoch seconds.
  toDate(value: unknown): Date | null {
    return parseApiDate(value);
  }

  loadTransactions(): void {
    this.isLoading = true;
    // This component does its own search/status/date-range filtering and pagination over the
    // full set below (applyFilters()), so it needs everything up front rather than a capped
    // page — a small size here would silently hide anything past the cap from search/filters.
    forkJoin({
      transactions: this.salesService.getSalesandTransactions({ size: 1000 }),
      customers: this.salesService.getCustomers({ page: 0, size: 1000 })
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ transactions, customers }: any) => {
          this.customers = customers.data || [];
          this.transactions = transactions.data || [];
          this.applyFilters();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading sales and transactions:', err);
          this.isLoading = false;
        }
      });
  }

  applyFilters(): void {
    let result = [...this.transactions];

    if (this.selectedStatus !== 'ALL') {
      result = result.filter(tx => tx.status === this.selectedStatus);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(tx =>
        (tx.orderId || '').toLowerCase().includes(term) ||
        (tx.quoteId?.quoteNumber || '').toLowerCase().includes(term) ||
        (tx.paymentNumber || '').toLowerCase().includes(term) ||
        (tx.reference || '').toLowerCase().includes(term) ||
        (this.getCustomerName(tx)).toLowerCase().includes(term)
      );
    }

    if (this.filters.dateFrom) {
      const from = new Date(this.filters.dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter(tx => {
        const created = this.toDate(tx.quoteConvertedDate || tx.orderDate);
        return !!created && created >= from;
      });
    }

    if (this.filters.dateTo) {
      const to = new Date(this.filters.dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter(tx => {
        const created = this.toDate(tx.quoteConvertedDate || tx.orderDate);
        return !!created && created <= to;
      });
    }

    this.totalPages = Math.ceil(result.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    this.filteredTransactions = result.slice(start, start + this.pageSize);
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'ALL';
    this.filters = { dateFrom: '', dateTo: '' };
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onStatusFilterChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = Number(size);
    this.currentPage = 1;
    this.applyFilters();
  }

  // ============================================================
  // ROW SELECTION (bulk actions bar)
  // ============================================================

  isSelected(id: number): boolean {
    return this.selectedTransactionIds.includes(id);
  }

  toggleSelection(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      if (!this.isSelected(id)) {
        this.selectedTransactionIds = [...this.selectedTransactionIds, id];
      }
    } else {
      this.selectedTransactionIds = this.selectedTransactionIds.filter(x => x !== id);
    }
  }

  isAllSelected(): boolean {
    return this.filteredTransactions.length > 0
      && this.filteredTransactions.every(tx => this.isSelected(tx.id));
  }

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    const pageIds = this.filteredTransactions.map(tx => tx.id);
    if (checked) {
      this.selectedTransactionIds = Array.from(new Set([...this.selectedTransactionIds, ...pageIds]));
    } else {
      const pageIdSet = new Set(pageIds);
      this.selectedTransactionIds = this.selectedTransactionIds.filter(id => !pageIdSet.has(id));
    }
  }

  /**
   * There's no explicit "payment due date" field on a sales transaction —
   * the closest proxy is the expected delivery date: once goods should
   * already be delivered but a balance is still outstanding, the payment
   * is treated as overdue (mirrors invoice-list's isOverdue convention).
   */
  isPaymentOverdue(tx: SalesandTransactions): boolean {
    if (!tx || !(tx.balanceDue > 0)) return false;
    const due = this.toDate(tx.expectedDeliveryDate);
    if (!due) return false;
    const now = new Date();
    return due < now && due.toDateString() !== now.toDateString();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilters();
    }
  }

  getPageNumbers(): number[] {
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  getStatusCount(status: string): number {
    return this.transactions.filter(tx => tx.status === status).length;
  }

  getCustomerName(tx: SalesandTransactions | null): string {
    if (!tx) return 'N/A';
    if (typeof tx.customerName === 'object' && (tx.customerName as any)?.name) {
      return (tx.customerName as any).name;
    }
    if (typeof tx.customerId === 'object' && (tx.customerId as any)?.name) {
      return (tx.customerId as any).name;
    }
    // Resolve integer customerId against loaded customers list
    const rawId = tx.customerId ?? tx.customerName;
    if (rawId && this.customers.length) {
      const found = this.customers.find(c => c.id === rawId || String(c.id) === String(rawId));
      if (found?.name) return found.name;
    }
    return String(tx.customerName || tx.customerId || 'N/A');
  }

  getQuoteNumber(tx: SalesandTransactions): string {
    if (!tx) return '-';
    if (tx.quoteId && typeof tx.quoteId === 'object') {
      return tx.quoteId.quoteNumber || '-';
    }
    return '-';
  }

  viewDetails(tx: SalesandTransactions): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const txIdStr = String(tx.id);
    if (uuid) {
      this.router.navigate(['/sales-and-transactions', txIdStr, uuid]);
    } else {
      this.router.navigate(['/sales-and-transactions', txIdStr]);
    }
  }

  getStatusBadgeClass(status: SaleLifecycleStatus | string): string {
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

  formatStatusLabel(status: SaleLifecycleStatus | string): string {
    if (!status) return 'DRAFT';
    return status
      .replace(/[_-]+/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, character => character.toUpperCase());
  }

  formatCurrency(amount: number, currency: string = 'NGN'): string {
    const symbol = currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '₦';
    return `${symbol}${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  openPaymentModal(tx: SalesandTransactions, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedTxForPayment = tx;
    const isMonthly = tx.PaymentMode === 'MONTHLY' || (tx.installmentNumber && tx.installmentNumber > 1);
    if (isMonthly && tx.installmentNumber) {
      const perInstallment = (tx.totalAmount || 0) / tx.installmentNumber;
      this.paymentAmount = tx.balanceDue > 0 ? Math.min(perInstallment, tx.balanceDue) : perInstallment;
    } else {
      this.paymentAmount = tx.balanceDue > 0 ? tx.balanceDue : (tx.totalAmount || 0) - (tx.paidAmount || 0);
    }

    this.paymentMethod = tx.paymentMethod || 'BANK_TRANSFER';
    this.paymentReference = '';
    this.paymentNotes = '';
    this.paymentDate = new Date().toISOString().substring(0, 10);
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.selectedTxForPayment = null;
  }

  openReceiptModal(tx: SalesandTransactions, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedReceiptTx = tx;
    this.showReceiptModal = true;
  }

  closeReceiptModal(): void {
    this.showReceiptModal = false;
    this.selectedReceiptTx = null;
  }

  savePayment(): void {
    if (!this.selectedTxForPayment || this.paymentAmount <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a valid payment amount' });
      return;
    }

    if (this.paymentDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const inputDate = new Date(this.paymentDate);
      inputDate.setHours(0, 0, 0, 0);
      if (inputDate > today) {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Payment date cannot be in the future.' });
        return;
      }
    }

    const tx = this.selectedTxForPayment;
    const currentBalance = tx.balanceDue !== undefined ? tx.balanceDue : ((tx.totalAmount || 0) - (tx.paidAmount || 0));

    if (this.paymentAmount > currentBalance && currentBalance > 0) {
      if (!confirm(`The payment amount (${this.formatCurrency(this.paymentAmount, tx.currency)}) exceeds the balance due (${this.formatCurrency(currentBalance, tx.currency)}). Proceed?`)) {
        return;
      }
    }

    this.isSavingPayment = true;
    const newPaidAmount = (tx.paidAmount || 0) + this.paymentAmount;
    const newBalanceDue = Math.max(0, (tx.totalAmount || 0) - newPaidAmount);
    const newCompletedInstallments = (tx.completedInstallments || 0) + 1;
    const newStatus: SaleLifecycleStatus = newBalanceDue === 0 ? 'PAYMENT_COMPLETED' : 'PAYMENT_IN_PROGRESS';

    const updatePayload: Partial<SalesandTransactions> = {
      paidAmount: newPaidAmount,
      balanceDue: newBalanceDue,
      completedInstallments: newCompletedInstallments,
      paymentMethod: this.paymentMethod,
      status: newStatus,
      reference: this.paymentReference.trim() || tx.reference || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      transactionNotes: this.paymentNotes.trim() || tx.transactionNotes
    };

    this.salesService.updateSalesandTransactions(tx.id, updatePayload).subscribe({
      next: (updatedTx) => {
        this.isSavingPayment = false;
        this.closePaymentModal();
        this.loadTransactions();
        this.openReceiptModal(updatedTx || tx);
      },
      error: (err) => {
        this.isSavingPayment = false;
        console.error('Error saving transaction payment:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to record payment. Please try again.' });
      }
    });
  }
}
