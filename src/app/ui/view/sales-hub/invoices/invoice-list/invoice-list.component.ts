// src/app/ui/view/sales-module/invoice-list/invoice-list.component.ts

import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { SalesService } from '../../../../service/sales/sales.service';
import { Invoice, InvoiceStatus } from '../../../../domain/sales/sales.dto';
import { formatApiDate, parseApiDate } from '../../../../service/sales/date.util';

import { SharedOverlayModule } from '../../../../../shared-overlay.module';
import { InvoiceFormComponent } from '../invoice-form/invoice-form.component';
import { InvoiceDetailComponent } from '../invoice-detail/invoice-detail.component';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';

@Component({
  selector: 'app-invoice-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    SharedOverlayModule,
    InvoiceFormComponent,
    InvoiceDetailComponent,
    ToastModule
  ],
  providers: [MessageService],
  templateUrl: './invoice-list.component.html',
  styleUrls: ['./invoice-list.component.scss']
})
export class InvoiceListComponent implements OnInit, OnDestroy {
  
  // Expose Math to template
  Math = Math;
  
  invoices: any[] = [];
  customers: any[] = [];
  isLoading = true;
  selectedInvoiceIds: string[] = [];

  showInvoiceModal = false;
  showInvoiceDetail = false;
  selectedInvoiceId?: string;

  openNewInvoiceModal(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/invoices/new', uuid]);
    } else {
      this.router.navigate(['/invoices/new']);
    }
  }

  openEditInvoiceModal(invoiceId: string): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/invoices', invoiceId, 'edit', uuid]);
    } else {
      this.router.navigate(['/invoices', invoiceId, 'edit']);
    }
  }

  openInvoiceDetail(invoiceId: string): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/invoices', invoiceId, uuid]);
    } else {
      this.router.navigate(['/invoices', invoiceId]);
    }
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.selectedInvoiceId = undefined;
  }

  duplicateInvoice(invoice: Invoice): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    const path = uuid ? ['/invoices/new', uuid] : ['/invoices/new'];
    // Hand the already-loaded invoice straight to the form via navigation state so it
    // doesn't have to make a fresh round-trip to re-fetch data we already have.
    this.router.navigate(path, { queryParams: { duplicateId: String(invoice.id) }, state: { duplicateSource: invoice } });
  }

  closeInvoiceDetail(): void {
    this.showInvoiceDetail = false;
    this.selectedInvoiceId = undefined;
  }

  onInvoiceSaved(): void {
    this.closeInvoiceModal();
    this.loadInvoices();
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
  
  aiDismissed = false;

  // Stats
  stats = {
    total: 0,
    draft: 0,
    sent: 0,
    paid: 0,
    overdue: 0,
    partial: 0,
    cancelled: 0
  };
  
  statusOptions: { value: InvoiceStatus | 'ALL'; label: string; icon: string; color: string }[] = [
    { value: 'ALL', label: 'All Invoices', icon: 'M4 6h16M4 12h16M4 18h16', color: 'gray' },
    { value: 'DRAFT', label: 'Draft', icon: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', color: 'gray' },
    { value: 'SENT', label: 'Sent', icon: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', color: 'blue' },
    { value: 'CANCELLED', label: 'Cancelled', icon: 'M6 18L18 6M6 6l12 12', color: 'gray' }
  ];
  
  private destroy$ = new Subject<void>();

  constructor(
    private messageService: MessageService,
    private salesService: SalesService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadInvoices();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadInvoices(): void {
    this.isLoading = true;
    forkJoin({
      invoices: this.salesService.getInvoices(this.filters),
      customers: this.salesService.getCustomers({ page: 0, size: 200 })
    }).subscribe({
      next: ({ invoices, customers }: any) => {
        this.customers = customers.data;
        this.invoices = invoices.data;
        this.totalElements = invoices.total;
        this.totalPages = Math.ceil(invoices.total / this.filters.size);
        this.calculateStats();
        this.isLoading = false;
      },
      error: (error: any) => {
        console.error('Error loading invoices:', error);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load invoices. Please try again.' });
        this.calculateStats();
        this.isLoading = false;
      }
    });
  }

  getCustomerName(customerId: any): string {
    if (!customerId) return '—';
    const id = typeof customerId === 'object' ? (customerId?.id ?? customerId) : customerId;
    const c = this.customers.find(c => c.id === id || String(c.id) === String(id));
    return c?.name || `Customer #${id}`;
  }

  private calculateStats(): void {
    this.stats = {
      total: this.invoices.length,
      draft: this.invoices.filter(i => i.status === 'DRAFT').length,
      sent: this.invoices.filter(i => i.status === 'SENT').length,
      paid: 0,
      overdue: 0,
      partial: 0,
      cancelled: this.invoices.filter(i => i.status === 'CANCELLED').length
    };
  }

  applyFilters(): void {
    this.filters.page = 0;
    this.loadInvoices();
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
    this.loadInvoices();
  }

  onPageChange(page: number): void {
    this.filters.page = page;
    this.loadInvoices();
  }

  onPageSizeChange(size: number): void {
    this.filters.size = size;
    this.filters.page = 0;
    this.loadInvoices();
  }

  toggleSelection(invoiceId: string, event: any): void {
    if (event.target.checked) {
      this.selectedInvoiceIds.push(invoiceId);
    } else {
      this.selectedInvoiceIds = this.selectedInvoiceIds.filter(id => id !== invoiceId);
    }
  }

  toggleSelectAll(event: any): void {
    if (event.target.checked) {
      this.selectedInvoiceIds = this.invoices.map(i => i.id);
    } else {
      this.selectedInvoiceIds = [];
    }
  }

  isSelected(invoiceId: string): boolean {
    return this.selectedInvoiceIds.includes(invoiceId);
  }

  isAllSelected(): boolean {
    return this.invoices.length > 0 && this.selectedInvoiceIds.length === this.invoices.length;
  }

  getStatusBadgeClass(status: InvoiceStatus): string {
    const classes: Record<InvoiceStatus, string> = {
      'DRAFT': 'status-draft',
      'SENT': 'status-sent',
      'CANCELLED': 'status-cancelled'
    };
    return classes[status] || 'status-draft';
  }

  getStatusLabel(status: InvoiceStatus): string {
    const labels: Record<InvoiceStatus, string> = {
      'DRAFT': 'Draft',
      'SENT': 'Sent',
      'CANCELLED': 'Cancelled'
    };
    return labels[status] || status;
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  }

  formatDate(date: Date): string {
    return formatApiDate(date);
  }

  isOverdue(dueDate: Date): boolean {
    const due = parseApiDate(dueDate);
    if (!due) return false;
    const now = new Date();
    return due < now && due.toDateString() !== now.toDateString();
  }

  getDaysOverdue(dueDate: Date): number {
    const due = parseApiDate(dueDate);
    if (!due) return 0;
    const diffTime = Date.now() - due.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }

  showReminderModal = false;
  showDeleteInvoiceModal = false;
  pendingInvoice: Invoice | null = null;
  pendingInvoiceNumber = '';
  pendingCustomerName = '';

  sendReminder(invoice: Invoice): void {
    const custName = this.getCustomerName((invoice as any).customerId) || (invoice.customerName as any)?.name || invoice.customerName || 'Customer';
    this.pendingInvoice = invoice;
    this.pendingInvoiceNumber = invoice.invoiceNumber;
    this.pendingCustomerName = custName;
    this.showReminderModal = true;
  }

  confirmSendReminder(): void {
    if (!this.pendingInvoice) return;
    const targetInvoice = this.pendingInvoice;
    this.showReminderModal = false;
    this.salesService.updateInvoice(targetInvoice.id, { status: 'SENT' }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Reminder sent for invoice ${targetInvoice.invoiceNumber}` });
        this.loadInvoices();
      },
      error: (error: any) => {
        console.error('Error sending reminder:', error);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to send reminder. Please try again.' });
      }
    });
  }

  deleteInvoice(invoice: Invoice): void {
    const custName = this.getCustomerName((invoice as any).customerId) || (invoice.customerName as any)?.name || invoice.customerName || 'Customer';
    this.pendingInvoice = invoice;
    this.pendingInvoiceNumber = invoice.invoiceNumber;
    this.pendingCustomerName = custName;
    this.showDeleteInvoiceModal = true;
  }

  confirmDeleteInvoice(): void {
    if (!this.pendingInvoice) return;
    const targetInvoice = this.pendingInvoice;
    this.showDeleteInvoiceModal = false;
    this.salesService.updateInvoice(targetInvoice.id, { status: 'CANCELLED' }).subscribe({
      next: () => {
        this.messageService.add({ severity: 'success', summary: 'Success', detail: `Invoice ${targetInvoice.invoiceNumber} cancelled successfully` });
        this.loadInvoices();
      },
      error: (error: any) => {
        console.error('Error cancelling invoice:', error);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to cancel invoice. Please try again.' });
      }
    });
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
