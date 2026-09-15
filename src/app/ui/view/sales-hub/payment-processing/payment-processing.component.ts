import { Component, OnInit, OnDestroy } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormBuilder, FormGroup, Validators, AbstractControl, ValidatorFn } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { environment } from '../../../shared-component/service/environments/environment';
import { formatApiDate, parseApiDate } from '../../../service/sales/date.util';

export function pastDateValidator(): ValidatorFn {
  return (control: AbstractControl): { [key: string]: any } | null => {
    if (!control.value) {
      return null;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const controlDate = new Date(control.value);
    controlDate.setHours(0, 0, 0, 0);
    return controlDate > today ? { 'futureDate': true } : null;
  };
}

interface PaymentRecord {
  id: string;
  invoiceNumber: string;
  vendorName: string;
  vendorId: string;
  requestTitle: string;
  lpoNumber: string;
  invoiceDate: Date;
  dueDate: Date;
  amount: number;
  amountPaid: number;
  currency: string;
  status: 'PENDING' | 'PARTIAL' | 'PAID' | 'OVERDUE' | 'DISPUTED';
  paymentMethod?: string;
  paymentDate?: Date;
  notes?: string;
}

@Component({
  selector: 'app-payment-processing',
  templateUrl: './payment-processing.component.html',
  styleUrl: './payment-processing.component.scss'
})
export class PaymentProcessingComponent implements OnInit, OnDestroy {

  payments: PaymentRecord[] = [];
  filteredPayments: PaymentRecord[] = [];
  filterStatus = 'ALL';
  searchTerm = '';
  selectedPayment: PaymentRecord | null = null;
  showPaymentModal = false;
  paymentForm!: FormGroup;
  isLoading = false;
  isSaving = false;

  private baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';
  private destroy$ = new Subject<void>();

  constructor(
    private http: HttpClient,
    private fb: FormBuilder
  ) {}

  ngOnInit(): void {
    this.initForm();
    this.loadPayments();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  get todayDateString(): string {
    return new Date().toISOString().split('T')[0];
  }

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  private initForm(): void {
    this.paymentForm = this.fb.group({
      amount: [0, [Validators.required, Validators.min(0.01)]],
      paymentMethod: ['BANK_TRANSFER', Validators.required],
      paymentDate: [new Date().toISOString().split('T')[0], [Validators.required, pastDateValidator()]],
      notes: ['']
    });
  }

  loadPayments(): void {
    this.isLoading = true;
    const url = `${this.baseUrl}/invoices?tenantId=${this.tenantId}&page=1&size=50`;

    this.http.get<any>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          const raw: any[] = Array.isArray(res) ? res : (res?.content ?? res?.data ?? res?.items ?? []);
          this.payments = raw.map((item: any) => this.mapToPaymentRecord(item));
          this.applyFilter();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load payments:', err);
          this.payments = [];
          this.filteredPayments = [];
          this.isLoading = false;
        }
      });
  }

  private mapToPaymentRecord(item: any): PaymentRecord {
    const amount = item.totalAmount ?? item.amount ?? item.total ?? 0;
    const amountPaid = item.amountPaid ?? item.paidAmount ?? 0;
    const rawStatus = String(item.status ?? 'PENDING');
    const statusMap: Record<string, string> = { UNPAID: 'PENDING', PARTIALLY_PAID: 'PARTIAL' };
    const normalised = statusMap[rawStatus] ?? rawStatus;
    const status: PaymentRecord['status'] = (['PENDING','PARTIAL','PAID','OVERDUE','DISPUTED'].includes(normalised)
      ? normalised : 'PENDING') as PaymentRecord['status'];

    return {
      id: item.id ?? item._id ?? '',
      invoiceNumber: item.invoiceNumber ?? item.invoiceNo ?? item.reference ?? `INV-${item.id}`,
      vendorName: item.vendorName ?? item.customerName ?? item.clientName ?? 'Unknown',
      vendorId: item.vendorId ?? item.customerId ?? '',
      requestTitle: item.requestTitle ?? item.title ?? item.description ?? item.subject ?? '',
      lpoNumber: item.lpoNumber ?? item.lpo ?? item.purchaseOrderNumber ?? '',
      invoiceDate: parseApiDate(item.invoiceDate) ?? parseApiDate(item.createdAt) ?? new Date(),
      dueDate: parseApiDate(item.dueDate) ?? parseApiDate(item.paymentDueDate) ?? new Date(),
      amount,
      amountPaid,
      currency: item.currency ?? 'NGN',
      status,
      paymentMethod: item.paymentMethod,
      paymentDate: parseApiDate(item.paymentDate) ?? undefined,
      notes: item.notes ?? ''
    };
  }

  applyFilter(): void {
    let result = [...this.payments];

    if (this.filterStatus !== 'ALL') {
      result = result.filter(p => p.status === this.filterStatus);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.trim().toLowerCase();
      result = result.filter(p =>
        p.invoiceNumber.toLowerCase().includes(term) ||
        p.vendorName.toLowerCase().includes(term) ||
        p.requestTitle.toLowerCase().includes(term) ||
        p.lpoNumber.toLowerCase().includes(term)
      );
    }

    this.filteredPayments = result;
  }

  setFilter(status: string): void {
    this.filterStatus = status;
    this.applyFilter();
  }

  onSearchChange(): void {
    this.applyFilter();
  }

  // ── Stats ────────────────────────────────────────────────────────────────

  get totalPayable(): number {
    return this.payments.reduce((sum, p) => sum + p.amount, 0);
  }

  get totalPaid(): number {
    return this.payments.reduce((sum, p) => sum + p.amountPaid, 0);
  }

  get totalPending(): number {
    return this.payments
      .filter(p => p.status === 'PENDING' || p.status === 'PARTIAL')
      .reduce((sum, p) => sum + (p.amount - p.amountPaid), 0);
  }

  get totalOverdue(): number {
    return this.payments
      .filter(p => p.status === 'OVERDUE')
      .reduce((sum, p) => sum + (p.amount - p.amountPaid), 0);
  }

  get countByStatus(): Record<string, number> {
    return this.payments.reduce((acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  // ── Modal ────────────────────────────────────────────────────────────────

  openPaymentModal(payment: PaymentRecord): void {
    this.selectedPayment = payment;
    const remaining = Math.max(0, payment.amount - payment.amountPaid);
    this.paymentForm.patchValue({
      amount: remaining,
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
    this.showPaymentModal = true;
  }

  closePaymentModal(): void {
    this.showPaymentModal = false;
    this.selectedPayment = null;
    this.paymentForm.reset({
      amount: 0,
      paymentMethod: 'BANK_TRANSFER',
      paymentDate: new Date().toISOString().split('T')[0],
      notes: ''
    });
  }

  submitPayment(): void {
    if (this.paymentForm.invalid || !this.selectedPayment) return;
    const { amount, paymentMethod, paymentDate, notes } = this.paymentForm.value;
    this.recordPayment(this.selectedPayment.id, amount, paymentMethod, paymentDate, notes);
  }

  recordPayment(paymentId: string, amount: number, method: string, paymentDate?: string, notes?: string): void {
    this.isSaving = true;
    const url = `${this.baseUrl}/invoices/${paymentId}/payment`;
    const payload = {
      amountPaid: amount,
      paymentMethod: method,
      paidAt: paymentDate ? new Date(paymentDate) : new Date(),
      notes: notes ?? ''
    };

    this.http.patch<any>(url, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.isSaving = false;
          this.closePaymentModal();
          this.loadPayments();
        },
        error: (err) => {
          console.error('Failed to record payment:', err);
          this.isSaving = false;
        }
      });
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  getDaysOverdue(dueDate: Date): number {
    const due = parseApiDate(dueDate);
    if (!due) return 0;
    const diff = Math.floor((Date.now() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  }

  formatCurrency(amount: number, currency = 'NGN'): string {
    return '₦' + new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  }

  formatDate(date: Date): string {
    return formatApiDate(date);
  }

  getProgressPercent(payment: PaymentRecord): number {
    if (!payment.amount) return 0;
    return Math.min(100, Math.round((payment.amountPaid / payment.amount) * 100));
  }

  canRecordPayment(payment: PaymentRecord): boolean {
    return payment.status !== 'PAID';
  }
}
