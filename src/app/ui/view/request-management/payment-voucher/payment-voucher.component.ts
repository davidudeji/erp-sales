import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { MessageService } from 'primeng/api';
import { SupplyChainService } from '../../../service/procurement/supply-chain.service';
import { FinanceBridgeService, FinanceBridgeResult } from '../../../service/procurement/finance-bridge.service';
import { NotificationService } from '../../../service/procurement/notification.service';
import { PaymentVoucher, GoodsReceivedNote } from '../../../domain/procurement-request/procurement.dto';

@Component({
  selector: 'app-payment-voucher',
  templateUrl: './payment-voucher.component.html',
  styleUrls: ['./payment-voucher.component.scss']
})
export class PaymentVoucherComponent implements OnInit, OnDestroy {
  @Input() grn!: GoodsReceivedNote;
  @Input() invoice: any = {};
  @Input() lpoNumber = '';
  @Input() vendorBankDetails: { bankName: string; accountNumber: string; accountName: string } = { bankName: '', accountNumber: '', accountName: '' };
  @Output() voucherCreated = new EventEmitter<PaymentVoucher>();
  @Output() paymentPosted = new EventEmitter<FinanceBridgeResult>();

  private destroy$ = new Subject<void>();

  voucherForm!: FormGroup;
  existingVoucher: PaymentVoucher | null = null;
  isCreating = false;
  isApproving = false;
  financeResult: FinanceBridgeResult | null = null;
  activeTab: 'voucher' | 'finance' | 'receipt' = 'voucher';
  financeEntries: any[] = [];
  isLoadingFinance = false;

  readonly today = new Date();

  readonly paymentMethods = [
    { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'ONLINE', label: 'Online Payment' }
  ];

  constructor(
    private fb: FormBuilder,
    private supplyChainService: SupplyChainService,
    private financeBridge: FinanceBridgeService,
    private notificationService: NotificationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.buildForm();
    this.loadExistingVoucher();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private buildForm(): void {
    this.voucherForm = this.fb.group({
      paymentMethod: ['BANK_TRANSFER', Validators.required],
      narration: [
        `Payment for LPO ${this.lpoNumber} — ${this.grn?.vendorName ?? ''}`,
        [Validators.required, Validators.minLength(10)]
      ],
      bankName: [this.vendorBankDetails.bankName, Validators.required],
      accountNumber: [this.vendorBankDetails.accountNumber, Validators.required],
      accountName: [this.vendorBankDetails.accountName, Validators.required],
      notes: [''],
      requestedBy: ['', Validators.required]
    });
  }

  private loadExistingVoucher(): void {
    if (!this.grn?.id) return;
    this.supplyChainService.getPaymentVouchers({ lpoId: String(this.grn.lpoId) }).pipe(
      takeUntil(this.destroy$)
    ).subscribe(vouchers => {
      this.existingVoucher = vouchers[0] ?? null;
    });
    this.loadFinanceEntries();
  }

  private loadFinanceEntries(): void {
    if (!this.lpoNumber) return;
    this.isLoadingFinance = true;
    this.financeBridge.getLedgerEntries(this.lpoNumber).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: entries => { this.financeEntries = entries; this.isLoadingFinance = false; },
      error: () => { this.isLoadingFinance = false; }
    });
  }

  get totalAmount(): number {
    return this.grn?.totalReceivedValue ?? this.invoice?.totalAmount ?? 0;
  }

  get currency(): string {
    return this.invoice?.currency ?? 'NGN';
  }

  createVoucher(): void {
    if (this.voucherForm.invalid) { this.voucherForm.markAllAsTouched(); return; }
    this.isCreating = true;
    const val = this.voucherForm.value;
    const voucher: Partial<PaymentVoucher> = {
      grnId: String(this.grn?.id ?? ''),
      grnNumber: this.grn?.grnNumber,
      invoiceId: this.invoice?.id,
      invoiceNumber: this.invoice?.invoiceNumber,
      lpoId: String(this.grn?.lpoId ?? ''),
      lpoNumber: this.lpoNumber,
      procurementRequestId: this.grn?.procurementRequestId,
      vendorId: this.grn?.vendorId,
      vendorName: this.grn?.vendorName,
      vendorBankName: val.bankName,
      vendorAccountNumber: val.accountNumber,
      vendorAccountName: val.accountName,
      amount: this.totalAmount,
      currency: this.currency,
      paymentMethod: val.paymentMethod,
      narration: val.narration,
      notes: val.notes,
      requestedBy: val.requestedBy,
      requestedAt: new Date(),
      status: 'PENDING_APPROVAL'
    };

    this.supplyChainService.createPaymentVoucher(voucher).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: saved => {
        this.existingVoucher = saved;
        this.isCreating = false;
        this.voucherCreated.emit(saved);
        this.messageService.add({
          severity: 'success',
          summary: 'Voucher Created',
          detail: `Payment voucher ${saved.voucherNumber} created. Awaiting finance approval.`
        });
        this.notificationService.trigger({
          type: 'PAYMENT_PROCESSED',
          recipientId: val.requestedBy,
          recipientEmail: '',
          recipientName: val.requestedBy,
          relatedEntityId: String(saved.id),
          relatedEntityType: 'PAYMENT_VOUCHER',
          templateData: {
            voucherNumber: saved.voucherNumber,
            amount: this.totalAmount,
            currency: this.currency,
            vendorName: this.grn?.vendorName
          }
        }).subscribe();
      },
      error: () => {
        this.isCreating = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to create payment voucher.' });
      }
    });
  }

  approveAndPostToFinance(): void {
    if (!this.existingVoucher) return;
    this.isApproving = true;
    this.financeBridge.postPaymentToFinance(this.existingVoucher).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: result => {
        this.financeResult = result;
        this.isApproving = false;
        this.paymentPosted.emit(result);
        if (result.success) {
          this.messageService.add({ severity: 'success', summary: 'Posted to Finance', detail: result.message });
          this.loadFinanceEntries();
        } else {
          this.messageService.add({ severity: 'warn', summary: 'Posting Issue', detail: result.message });
        }
      },
      error: () => {
        this.isApproving = false;
        this.messageService.add({ severity: 'error', summary: 'Finance Error', detail: 'Failed to post to Finance.' });
      }
    });
  }

  formatCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat('en-NG', { style: 'currency', currency: this.currency, maximumFractionDigits: 0 }).format(amount);
    } catch {
      return `${this.currency} ${Math.round(amount).toLocaleString()}`;
    }
  }

  formatDate(d: Date | string): string {
    return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  printReceipt(): void {
    window.print();
  }
}
