import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SalesService } from '../../../../service/sales/sales.service';
import { Quote, QuoteStatus } from '../../../../domain/sales/sales.dto';
import { formatApiDate, parseApiDate } from '../../../../service/sales/date.util';

import { SharedOverlayModule } from '../../../../../shared-overlay.module';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-quote-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SharedOverlayModule,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './quote-list.component.html',
  styleUrls: ['./quote-list.component.scss']
})
export class QuoteListComponent implements OnInit, OnDestroy {
  protected readonly Math = Math;

  quotes: Quote[] = [];
  customers: any[] = [];
  isLoading = true;
  selectedQuoteIds: any[] = [];

  showQuoteModal = false;
  showQuoteDetail = false;
  selectedQuoteId?: string;

  openNewQuoteModal(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/quotes/new', uuid]);
    } else {
      this.router.navigate(['/quotes/new']);
    }
  }

  openEditQuoteModal(quoteId: string | number): void {
    const quoteIdStr = String(quoteId);
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/quotes', quoteIdStr, 'edit', uuid]);
    } else {
      this.router.navigate(['/quotes', quoteIdStr, 'edit']);
    }
  }

  openQuoteDetail(quoteId: string | number): void {
    const quoteIdStr = String(quoteId);
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/quotes', quoteIdStr, uuid]);
    } else {
      this.router.navigate(['/quotes', quoteIdStr]);
    }
  }

  closeQuoteModal(): void {
    this.showQuoteModal = false;
    this.selectedQuoteId = undefined;
  }

  closeQuoteDetail(): void {
    this.showQuoteDetail = false;
    this.selectedQuoteId = undefined;
  }

  onQuoteSaved(): void {
    this.closeQuoteModal();
    this.loadQuotes();
  }

  showInvoiceModal = false;

  openInvoiceModal(quoteId: string | number): void {
    const quoteIdStr = String(quoteId);
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const path = uuid ? ['/invoices/new', uuid] : ['/invoices/new'];
    this.router.navigate(path, { queryParams: { quoteId: quoteIdStr } });
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.selectedQuoteId = undefined;
  }

  duplicateQuote(quote: Quote): void {
    const quoteIdStr = String(quote.id);
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const path = uuid ? ['/quotes/new', uuid] : ['/quotes/new'];
    // Hand the already-loaded quote straight to the form via navigation state so it
    // doesn't have to make a fresh round-trip to re-fetch data we already have.
    this.router.navigate(path, { queryParams: { duplicateId: quoteIdStr }, state: { duplicateSource: quote } });
  }

  onInvoiceSaved(): void {
    this.closeInvoiceModal();
    this.loadQuotes();
  }

  // Filters
  filters = {
    status: 'ALL',
    searchTerm: '',
    dateFrom: '',
    dateTo: '',
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
    draft: 0,
    sent: 0,
    accepted: 0,
    declined: 0,
    expired: 0,
    converted: 0
  };

  statusOptions: { value: QuoteStatus | 'ALL'; label: string; icon: string; color: string }[] = [
    { value: 'ALL', label: 'All Quotes', icon: 'M4 6h16M4 12h16M4 18h16', color: 'gray' },
    { value: 'DRAFT', label: 'Draft', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'gray' },
    { value: 'SENT', label: 'Sent', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'blue' },
    { value: 'ACCEPTED', label: 'Accepted', icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', color: 'green' },
    { value: 'DECLINED', label: 'Declined', icon: 'M6 18L18 6M6 6l12 12', color: 'red' },
    { value: 'EXPIRED', label: 'Expired', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z', color: 'orange' },
    { value: 'CONVERTED', label: 'Converted', icon: 'M13 7l5 5m0 0l-5 5m5-5H6', color: 'purple' }
  ];

  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private salesService: SalesService,
    private route: ActivatedRoute,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.loadQuotes();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadQuotes(): void {
    this.isLoading = true;
    forkJoin({
      quotes: this.salesService.getQuotes(this.filters),
      customers: this.salesService.getCustomers({ page: 0, size: 200 })
    }).subscribe({
      next: ({ quotes, customers }: any) => {
        this.customers = customers.data;
        this.quotes = quotes.data;
        this.totalElements = quotes.total;
        this.totalPages = Math.ceil(quotes.total / this.filters.size);
        this.calculateStats();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading quotes:', error);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load quotes. Please try again.' });
        this.calculateStats();
        this.isLoading = false;
      }
    });
  }

  getQuoteDateValue(quote: any): unknown {
    return quote?.createdAt ?? quote?.quoteDate ?? quote?.quote_date ?? null;
  }

  getQuoteValidUntilValue(quote: any): unknown {
    return quote?.validUntil ?? quote?.expiresAt ?? quote?.expiryDate ?? null;
  }

  getCustomerName(customerId: any, customerName?: any): string {
    if (customerName) {
      if (typeof customerName === 'object') {
        return customerName.name || customerName.customerName || String(customerName) || '—';
      }
      return String(customerName);
    }

    if (!customerId) return '—';

    if (typeof customerId === 'object') {
      if (customerId.name) return customerId.name;
      const id = customerId.id ?? customerId.customerId ?? customerId;
      const c = this.customers.find(c => c.id === id || String(c.id) === String(id) || String(c.customerId) === String(id));
      return c?.name || (typeof id === 'string' ? `Customer #${id}` : 'Customer');
    }

    const c = this.customers.find(c => c.id === customerId || String(c.id) === String(customerId) || String(c.customerId) === String(customerId));
    return c?.name || `Customer #${customerId}`;
  }

  private calculateStats(): void {
    this.stats = {
      total: this.quotes.length,
      draft: this.quotes.filter(q => q.status === 'DRAFT').length,
      sent: this.quotes.filter(q => q.status === 'SENT').length,
      accepted: this.quotes.filter(q => q.status === 'ACCEPTED').length,
      declined: this.quotes.filter(q => q.status === 'DECLINED').length,
      expired: this.quotes.filter(q => q.status === 'EXPIRED').length,
      converted: this.quotes.filter(q => q.status === 'CONVERTED').length
    };
  }

  applyFilters(): void {
    this.filters.page = 0;
    this.loadQuotes();
  }

  resetFilters(): void {
    this.filters = {
      status: 'ALL',
      searchTerm: '',
      dateFrom: '',
      dateTo: '',
      page: 0,
      size: 10
    };
    this.loadQuotes();
  }

  onPageChange(page: number): void {
    this.filters.page = page;
    this.loadQuotes();
  }

  onPageSizeChange(size: number): void {
    this.filters.size = size;
    this.filters.page = 0;
    this.loadQuotes();
  }

  getStatusBadgeClass(status: QuoteStatus): string {
    const classes: Record<QuoteStatus, string> = {
      'DRAFT': 'status-draft',
      'SENT': 'status-sent',
      'ACCEPTED': 'status-accepted',
      'DECLINED': 'status-declined',
      'EXPIRED': 'status-expired',
      'CONVERTED': 'status-converted'
    };
    return classes[status] || 'status-draft';
  }

  getStatusLabel(status: QuoteStatus): string {
    const labels: Record<QuoteStatus, string> = {
      'DRAFT': 'Draft',
      'SENT': 'Sent',
      'ACCEPTED': 'Accepted',
      'DECLINED': 'Declined',
      'EXPIRED': 'Expired',
      'CONVERTED': 'Converted'
    };
    return labels[status] || status;
  }

  getStatusIcon(status: QuoteStatus): string {
    const icon = this.statusOptions.find(o => o.value === status);
    return icon?.icon || '';
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  }

  formatDate(date: unknown): string {
    return formatApiDate(date);
  }

  isExpiringSoon(expiryDate: unknown): boolean {
    const expiry = parseApiDate(expiryDate);
    if (!expiry) return false;
    const daysRemaining = Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return daysRemaining <= 3 && daysRemaining > 0;
  }

  getDaysRemaining(expiryDate: unknown): number {
    const expiry = parseApiDate(expiryDate);
    if (!expiry) return 0;
    return Math.ceil((expiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
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

  toggleSelection(quoteId: any, event: any): void {
    if (event.target.checked) {
      this.selectedQuoteIds.push(quoteId);
    } else {
      this.selectedQuoteIds = this.selectedQuoteIds.filter(id => id !== quoteId);
    }
  }

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.selectedQuoteIds = this.quotes.map(q => q.id);
    } else {
      this.selectedQuoteIds = [];
    }
  }

  isSelected(quoteId: any): boolean {
    return this.selectedQuoteIds.includes(quoteId);
  }

  isAllSelected(): boolean {
    return this.quotes.length > 0 && this.selectedQuoteIds.length === this.quotes.length;
  }

  showSendQuoteModal = false;
  pendingSendQuote: Quote | null = null;
  pendingSendQuoteNumber = '';
  pendingSendCustomerName = '';

  sendQuote(quote: Quote): void {
    const custName = this.getCustomerName((quote as any).customerId) || (quote.customerName as any)?.name || quote.customerName || 'Customer';
    this.pendingSendQuote = quote;
    this.pendingSendQuoteNumber = quote.quoteNumber;
    this.pendingSendCustomerName = custName;
    this.showSendQuoteModal = true;
  }

  confirmSendQuote(): void {
    if (!this.pendingSendQuote) return;
    const targetQuote = this.pendingSendQuote;
    this.showSendQuoteModal = false;
    this.salesService.updateQuote(String(targetQuote.id), { status: 'SENT' }).subscribe({
      next: (updated: Quote) => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Quote ${targetQuote.quoteNumber} sent successfully!` });
        this.loadQuotes();
      },
      error: (error: any) => {
        console.error('Error sending quote:', error);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to send quote. Please try again.' });
      }
    });
  }

  showDeleteModal = false;
  pendingDeleteQuote: Quote | null = null;
  pendingDeleteQuoteNumber = '';
  pendingDeleteCustomerName = '';
  aiDismissed = false;

  deleteQuote(quote: Quote): void {
    this.pendingDeleteQuote = quote;
    this.pendingDeleteQuoteNumber = quote.quoteNumber;
    this.pendingDeleteCustomerName = this.getCustomerName((quote as any).customerId) || (quote.customerName as any)?.name || quote.customerName || 'Customer';
    this.showDeleteModal = true;
  }

  confirmDeleteQuote(): void {
    if (!this.pendingDeleteQuote) return;
    const target = this.pendingDeleteQuote;
    this.showDeleteModal = false;
    this.salesService.deleteQuote(String(target.id)).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Quote ${target.quoteNumber} deleted successfully` });
        this.loadQuotes();
      },
      error: () => {
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete quote. Please try again.' });
      }
    });
  }

}
