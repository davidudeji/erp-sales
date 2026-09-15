import { Component, Input, OnInit } from '@angular/core';
import { PdfGenerationService } from '../../../service/procurement/pdf-generation.service';
import { MessageService } from 'primeng/api';
import {
  GoodsReceivedNote, PaymentVoucher, ProcurementInvoice, ProcurementLpo
} from '../../../domain/procurement-request/procurement.dto';

export type ReceiptDocumentType = 'GRN' | 'PAYMENT_RECEIPT' | 'LPO' | 'INVOICE';

@Component({
  selector: 'app-receipt-preview',
  templateUrl: './receipt-preview.component.html',
  styleUrls: ['./receipt-preview.component.scss']
})
export class ReceiptPreviewComponent implements OnInit {
  @Input() documentType: ReceiptDocumentType = 'PAYMENT_RECEIPT';
  @Input() grn: GoodsReceivedNote | null = null;
  @Input() voucher: PaymentVoucher | null = null;
  @Input() invoice: ProcurementInvoice | null = null;
  @Input() lpo: ProcurementLpo | null = null;
  @Input() companyName = 'OptimaX Enterprise';
  @Input() companyAddress = '5B, Adewale Oshin Street, Lekki Phase 1, Lagos, Nigeria';
  @Input() companyPhone = '+234 (0) 700 OPTIMAX';
  @Input() companyEmail = 'procurement@optimaxsuites.com';

  isGenerating = false;
  today = new Date();

  get documentNumber(): string {
    if (this.documentType === 'GRN') return this.grn?.grnNumber ?? '';
    if (this.documentType === 'PAYMENT_RECEIPT') return this.voucher?.voucherNumber ?? '';
    if (this.documentType === 'LPO') return this.lpo?.lpoNumber ?? '';
    if (this.documentType === 'INVOICE') return this.invoice?.invoiceNumber ?? '';
    return '';
  }

  get documentTitle(): string {
    const map: Record<ReceiptDocumentType, string> = {
      GRN: 'GOODS RECEIVED NOTE',
      PAYMENT_RECEIPT: 'PAYMENT RECEIPT',
      LPO: 'LOCAL PURCHASE ORDER',
      INVOICE: 'INVOICE'
    };
    return map[this.documentType];
  }

  get totalAmount(): number {
    if (this.documentType === 'GRN') return this.grn?.totalReceivedValue ?? 0;
    if (this.documentType === 'PAYMENT_RECEIPT') return this.voucher?.amount ?? 0;
    if (this.documentType === 'LPO') return this.lpo?.totalAmount ?? 0;
    if (this.documentType === 'INVOICE') return this.invoice?.totalAmount ?? 0;
    return 0;
  }

  get currency(): string {
    if (this.documentType === 'PAYMENT_RECEIPT') return this.voucher?.currency ?? 'NGN';
    if (this.documentType === 'INVOICE') return this.invoice?.currency ?? 'NGN';
    if (this.documentType === 'LPO') return this.lpo?.currency ?? 'NGN';
    return 'NGN';
  }

  get vendorName(): string {
    if (this.documentType === 'GRN') return this.grn?.vendorName ?? '';
    if (this.documentType === 'PAYMENT_RECEIPT') return this.voucher?.vendorName ?? '';
    if (this.documentType === 'LPO') return this.lpo?.vendorName ?? '';
    if (this.documentType === 'INVOICE') return this.invoice?.vendorName ?? '';
    return '';
  }

  get isPaymentReceipt(): boolean { return this.documentType === 'PAYMENT_RECEIPT'; }
  get isGrn(): boolean { return this.documentType === 'GRN'; }
  get isLpo(): boolean { return this.documentType === 'LPO'; }
  get isInvoice(): boolean { return this.documentType === 'INVOICE'; }

  constructor(
    private pdfService: PdfGenerationService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {}

  print(): void {
    this.pdfService.printDocument('receipt-document');
  }

  download(): void {
    this.isGenerating = true;
    this.pdfService.generatePdf({
      documentType: this.documentType,
      documentId: this.documentNumber,
      documentNumber: this.documentNumber,
      tenantId: 'optimax'
    }).subscribe({
      next: (result) => {
        this.isGenerating = false;
        if (result.blob) {
          this.pdfService.downloadBlob(result.blob, `${this.documentType}-${this.documentNumber}.pdf`);
        } else if (result.url) {
          this.pdfService.downloadFile(result.url, `${this.documentType}-${this.documentNumber}.pdf`);
        } else {
          this.print();
          this.messageService.add({ severity: 'info', summary: 'Print Mode', detail: 'PDF generated via browser print.' });
        }
      },
      error: () => {
        this.isGenerating = false;
        this.print();
      }
    });
  }

  formatCurrency(amount: number): string {
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: this.currency,
        maximumFractionDigits: 2
      }).format(amount);
    } catch {
      return `${this.currency} ${amount.toLocaleString()}`;
    }
  }

  formatDate(d: Date | string | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  }

  replaceUnderscores(s: string): string {
    return s ? s.replace(/_/g, ' ') : '';
  }

  toWords(amount: number): string {
    const ones = [
      '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
      'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
      'Seventeen', 'Eighteen', 'Nineteen'
    ];
    const tens = [
      '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
      'Sixty', 'Seventy', 'Eighty', 'Ninety'
    ];

    const convert = (n: number): string => {
      if (n === 0) return '';
      if (n < 20) return ones[n];
      if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
      if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + convert(n % 100) : '');
      if (n < 1_000_000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
      if (n < 1_000_000_000) return convert(Math.floor(n / 1_000_000)) + ' Million' + (n % 1_000_000 ? ' ' + convert(n % 1_000_000) : '');
      return convert(Math.floor(n / 1_000_000_000)) + ' Billion' + (n % 1_000_000_000 ? ' ' + convert(n % 1_000_000_000) : '');
    };

    if (!amount || amount === 0) return 'Zero Naira Only';
    const wholePart = Math.floor(Math.abs(amount));
    const kobo = Math.round((Math.abs(amount) - wholePart) * 100);
    let result = convert(wholePart) + ' Naira';
    if (kobo > 0) result += ' and ' + convert(kobo) + ' Kobo';
    return result + ' Only';
  }
}
