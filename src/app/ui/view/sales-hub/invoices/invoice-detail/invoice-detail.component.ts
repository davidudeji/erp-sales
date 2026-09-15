// src/app/ui/view/sales-module/invoice-detail/invoice-detail.component.ts

import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { SalesService } from '../../../../service/sales/sales.service';
import { Invoice, InvoiceStatus, PaymentMethod, SaleLifecycleStatus, SalesandTransactions } from '../../../../domain/sales/sales.dto';
import { formatApiDate, parseApiDate } from '../../../../service/sales/date.util';

import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BackButtonComponent } from '../../../../shared-component/view/back-button/back-button.component';
import { SharedOverlayModule } from '../../../../../shared-overlay.module';
import { PaymentReceiptComponent } from '../../payment-receipt/payment-receipt.component';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-invoice-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, BackButtonComponent, SharedOverlayModule, PaymentReceiptComponent],
  templateUrl: './invoice-detail.component.html',
  styleUrls: ['./invoice-detail.component.scss']
})
export class InvoiceDetailComponent implements OnInit {
  @Input() detailId?: string;
  @Output() closed = new EventEmitter<void>();
  @Output() edit = new EventEmitter<string>();

  invoice: any = null;
  isLoading = true;
  showPaymentModal = false;
  paymentAmount = 0;
  isDownloading = false;

  selectedReceiptPaymentId?: string | number;
  showReceiptModal = false;

  openReceiptForPayment(paymentId: string | number): void {
    this.selectedReceiptPaymentId = paymentId;
    this.showReceiptModal = true;
  }

  closeReceipt(): void {
    this.selectedReceiptPaymentId = undefined;
    this.showReceiptModal = false;
  }

  invoicePayments: SalesandTransactions[] = [];
  paymentMethod: PaymentMethod = 'BANK_TRANSFER';
  paymentReference = '';
  paymentNotes = '';
  paymentDate = new Date().toISOString().substring(0, 10);
  isSavingPayment = false;

  paymentMethodOptions: { value: PaymentMethod; label: string }[] = [
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CARD', label: 'Credit/Debit Card' },
    { value: 'CASH', label: 'Cash' },
    { value: 'POS', label: 'POS Terminal' },
    { value: 'MOBILE_MONEY', label: 'Mobile Money' },
    { value: 'CHEQUE', label: 'Cheque' }
  ];

  constructor(
    private messageService: MessageService,
    private route: ActivatedRoute,
    private router: Router,
    private salesService: SalesService
  ) {}

  ngOnInit(): void {
    const id = this.detailId || this.route.snapshot.paramMap.get('id');
    if (id) {
      this.loadInvoice(id);
    } else {
      this.isLoading = false;
    }
  }

  loadInvoice(id: string): void {
    this.isLoading = true;
    this.salesService.getInvoiceById(id).subscribe({
      next: (invoice: Invoice | null) => {
        this.invoice = invoice;
        if (invoice) {
          this.loadPaymentsForInvoice(invoice.id);
        } else {
          this.isLoading = false;
        }
      },
      error: (err: any) => {
        console.error('Error loading invoice:', err);
        this.isLoading = false;
      }
    });
  }

  loadPaymentsForInvoice(invoiceId: string | number): void {
    this.salesService.getSalesandTransactions({ invoiceId, size: 100 }).subscribe({
      next: (res) => {
        this.invoicePayments = res.data;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error loading invoice payments:', err);
        this.isLoading = false;
      }
    });
  }

  openPaymentModal(): void {
    if (this.invoice) {
      this.paymentAmount = this.invoice.balanceDue || 0;
      this.paymentMethod = 'BANK_TRANSFER';
      this.paymentReference = '';
      this.paymentNotes = '';
      this.paymentDate = new Date().toISOString().substring(0, 10);
      this.showPaymentModal = true;
    }
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
  }

  savePayment(): void {
    if (!this.invoice || this.paymentAmount <= 0) {
      this.messageService.add({ severity: 'warn', summary: 'Warning', detail: 'Please enter a valid payment amount' });
      return;
    }
    
    const balanceDue = this.invoice.balanceDue || 0;
    if (this.paymentAmount > balanceDue) {
      if (!confirm(`The amount exceeds the invoice's balance due (${this.formatCurrency(balanceDue)}). Proceed?`)) {
        return;
      }
    }

    this.isSavingPayment = true;

    const newBalanceDue = Math.max(0, balanceDue - this.paymentAmount);
    const payload: Partial<SalesandTransactions> = {
      invoiceId: this.invoice,
      customerId: this.invoice.customerId,
      customerName: this.invoice.customerName,
      paidAmount: this.paymentAmount,
      totalAmount: this.invoice.totalAmount,
      currency: this.invoice.currency,
      paymentMethod: this.paymentMethod,
      reference: this.paymentReference.trim() || `REF-${Math.floor(100000 + Math.random() * 900000)}`,
      // A payment that doesn't clear the full balance is still in progress, not completed —
      // mislabeling every partial payment as PAYMENT_COMPLETED would make the lifecycle
      // tracker lie about outstanding balances.
      status: newBalanceDue === 0 ? 'PAYMENT_COMPLETED' : 'PAYMENT_IN_PROGRESS',
      orderDate: new Date(this.paymentDate),
      transactionNotes: this.paymentNotes.trim(),
      balanceDue: newBalanceDue
    };

    // This invoice already has a transaction tracking it since it was created (see
    // SalesService.trackNewInvoice()) — advance that same record rather than creating a
    // second, duplicate one every time a payment is recorded.
    this.salesService.upsertTransactionForInvoice(this.invoice.id, payload).subscribe({
      next: (res) => {
        this.isSavingPayment = false;
        this.showPaymentModal = false;
        this.loadInvoice(this.invoice!.id);
        this.openReceiptForPayment(String(res.id) || '');
      },
      error: (err) => {
        this.isSavingPayment = false;
        console.error('Error recording payment:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to record payment. Please try again.' });
      }
    });
  }

  formatCurrency(amount: number): string {
    const currency = this.invoice?.currency || 'NGN';
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  }

  formatDate(date: any): string {
    return formatApiDate(date, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-NG', '');
  }

  getStatusBadgeClass(status: string): string {
    const classes: Record<string, string> = {
      'DRAFT': 'status-draft',
      'SENT': 'status-sent',
      'PAID': 'status-paid',
      'PARTIAL': 'status-partial',
      'OVERDUE': 'status-overdue',
      'CANCELLED': 'status-cancelled'
    };
    return classes[status] || 'status-draft';
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      'DRAFT': 'draft',
      'SENT': 'sent',
      'PAID': 'paid',
      'PARTIAL': 'partial',
      'OVERDUE': 'overdue',
      'CANCELLED': 'cancelled'
    };
    return classes[status] || 'draft';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'DRAFT': 'Draft',
      'SENT': 'Sent',
      'PAID': 'Paid',
      'PARTIAL': 'Partial',
      'OVERDUE': 'Overdue',
      'CANCELLED': 'Cancelled'
    };
    return labels[status] || status;
  }

  isOverdue(dueDate: Date | string): boolean {
    const due = parseApiDate(dueDate);
    if (!due) return false;
    return due < new Date();
  }

  getTotalQuantity(): number {
    if (!this.invoice || !this.invoice.items) return 0;
    return this.invoice.items.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0);
  }

  getTotalInWords(amount: number): string {
    if (amount === 0) return 'Zero';
    
    const currency = this.invoice?.currency || 'NGN';
    const currencySymbol = currency === 'NGN' ? 'Naira' : currency;
    
    const naira = Math.floor(amount);
    const kobo = Math.round((amount - naira) * 100);
    
    if (naira === 0) return `${kobo} Kobo`;
    
    let words = this.numberToWords(naira) + ' ' + currencySymbol;
    if (kobo > 0) {
      words += ` and ${this.numberToWords(kobo)} Kobo`;
    }
    return words;
  }

  private numberToWords(num: number): string {
    if (num === 0) return 'Zero';
    
    const units = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
    const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    const thousands = ['', 'Thousand', 'Million', 'Billion'];
    
    if (num < 10) return units[num];
    if (num < 20) return teens[num - 10];
    if (num < 100) {
      const t = Math.floor(num / 10);
      const u = num % 10;
      return tens[t] + (u > 0 ? ' ' + units[u] : '');
    }
    if (num < 1000) {
      const h = Math.floor(num / 100);
      const r = num % 100;
      return units[h] + ' Hundred' + (r > 0 ? ' and ' + this.numberToWords(r) : '');
    }
    
    let result = '';
    let remaining = num;
    let group = 0;
    
    while (remaining > 0) {
      const chunk = remaining % 1000;
      if (chunk > 0) {
        const chunkWords = this.numberToWords(chunk);
        result = chunkWords + (thousands[group] ? ' ' + thousands[group] : '') + (result ? ' ' + result : '');
      }
      remaining = Math.floor(remaining / 1000);
      group++;
    }
    
    return result;
  }



  getMerchantAddressStr(): string {
    const addr = (this.invoice?.merchantDetails as any)?.address;
    if (!addr) return '';
    return Array.isArray(addr) ? addr.filter(Boolean).join(', ') : String(addr);
  }

  getCustomerAddressStr(): string {
    const c = (this.invoice?.customerId || this.invoice?.customerName) as any;
    const addr = c?.address;
    if (!addr) return '';
    return Array.isArray(addr) ? addr.filter(Boolean).join(', ') : String(addr);
  }

  getInvoiceCustomerName(): string {
    const inv = this.invoice as any;
    const cName = inv?.customerName;
    if (!cName) return 'Customer';
    if (typeof cName === 'object') return cName.name || cName.customerName || 'Customer';
    return String(cName);
  }

  getAdditionalCharges(): { label: string; amount: number }[] {
    const charges: number[] = this.invoice?.additionalCharges || [];
    const labels: string[] = (this.invoice as any)?.additionalChargesLabel || [];
    return charges.map((amount: number, i: number) => ({ label: labels[i] || 'Additional Charge', amount }));
  }

  get additionalInvoiceOpts(): any {
    const opts = this.invoice?.additionalOptions;
    if (!opts) return undefined;
    return Array.isArray(opts) ? opts[0] : opts;
  }

  showSendInvoiceModal = false;
  showCancelInvoiceModal = false;
  pendingInvoiceNumber = '';
  pendingCustomerName = '';

  sendInvoice(): void {
    if (!this.invoice) return;
    const custName = (this.invoice.customerName as any)?.name || this.invoice.customerName || 'Customer';
    this.pendingInvoiceNumber = this.invoice.invoiceNumber || '';
    this.pendingCustomerName = custName;
    this.showSendInvoiceModal = true;
  }

  confirmSendInvoice(): void {
    if (!this.invoice) return;
    this.showSendInvoiceModal = false;
    this.salesService.updateInvoice(this.invoice.id, { status: 'SENT' }).subscribe({
      next: (updated: Invoice) => {
        this.invoice = updated;
        if (updated.quoteId) {
          this.salesService.updateQuote(updated.quoteId, { status: 'CONVERTED' }).subscribe({
            next: () => console.log(`Quote ${updated.quoteId} updated to CONVERTED`),
            error: (err) => console.error('Error updating quote to CONVERTED:', err)
          });
        }
      },
      error: (err: any) => {
        console.error('Error sending invoice:', err);
      }
    });
  }

  cancelInvoice(): void {
    if (!this.invoice) return;
    this.pendingInvoiceNumber = this.invoice.invoiceNumber || '';
    this.showCancelInvoiceModal = true;
  }

  confirmCancelInvoice(): void {
    if (!this.invoice) return;
    const invoiceNumber = this.invoice.invoiceNumber;
    this.showCancelInvoiceModal = false;
    this.salesService.updateInvoice(this.invoice.id, { status: 'CANCELLED' }).subscribe({
      next: (updated: Invoice) => {
        this.invoice = updated;
        this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `Invoice ${invoiceNumber} deleted successfully` });
      },
      error: (err: any) => {
        console.error('Error cancelling invoice:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete invoice. Please try again.' });
      }
    });
  }

  goBack(): void {
    if (this.closed.observed) {
      this.closed.emit();
    } else {
      // Must match the [cacheKey] passed to <app-nav-tab> in sales-hub.component.html.
      const sessionStorageKey = 'sales-hub';
      sessionStorage.setItem(sessionStorageKey, 'Invoices');

      const uuid = this.route.snapshot.paramMap.get('uuid');
      if (uuid) {
        this.router.navigate(['/sales-hub', uuid]);
      } else {
        this.router.navigate(['/sales-hub']);
      }
    }
  }

  goToInvoicesList(): void {
    // Must match the [cacheKey] passed to <app-nav-tab> in sales-hub.component.html.
    const sessionStorageKey = 'sales-hub';
    sessionStorage.setItem(sessionStorageKey, 'Invoices');

    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.router.navigate(['/sales-hub', uuid]);
    } else {
      this.router.navigate(['/sales-hub']);
    }
  }

  editInvoice(): void {
    if (this.edit.observed) {
      this.edit.emit(this.invoice!.id);
    } else {
      const uuid = this.route.snapshot.paramMap.get('uuid');
      if (uuid) {
        this.router.navigate(['/invoices', this.invoice!.id, 'edit', uuid]);
      } else {
        this.router.navigate(['/invoices', this.invoice!.id, 'edit']);
      }
    }
  }

  viewCustomer(): void {
    if (this.invoice && this.invoice.customerId) {
      const uuid = this.route.snapshot.paramMap.get('uuid');
      if (uuid) {
        this.router.navigate(['/customers', this.invoice.customerId, uuid]);
      } else {
        this.router.navigate(['/customers', this.invoice.customerId]);
      }
    }
  }

  downloadPDF(): void {
    const element = document.getElementById('invoice-detail-sheet');
    if (!element) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Could not find element to export.' });
      return;
    }
    this.isDownloading = true;
    element.classList.add('pdf-printing-active');

    setTimeout(() => {
      html2canvas(element, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' }).then(canvas => {
        element.classList.remove('pdf-printing-active');
        const imgData = canvas.toDataURL('image/png');
        const pageW = 210;
        const pageH = 297;
        const imgW = pageW;
        const imgH = (canvas.height * imgW) / canvas.width;
        const pdf = new jsPDF('p', 'mm', 'a4');

        if (imgH <= pageH) {
          pdf.addImage(imgData, 'PNG', 0, 0, imgW, imgH);
        } else {
          let heightLeft = imgH;
          let position = 0;
          pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
          heightLeft -= pageH;
          while (heightLeft > 0) {
            position = heightLeft - imgH;
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH);
            heightLeft -= pageH;
          }
        }

        pdf.save(`Invoice-${this.invoice?.invoiceNumber || 'Detail'}.pdf`);
        this.isDownloading = false;
      }).catch(err => {
        element.classList.remove('pdf-printing-active');
        console.error('Error generating PDF:', err);
        this.isDownloading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to generate PDF.' });
      });
    }, 300);
  }
}