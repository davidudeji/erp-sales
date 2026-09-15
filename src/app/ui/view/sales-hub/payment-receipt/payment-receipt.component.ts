import { Component, OnInit, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SalesService } from '../../../service/sales/sales.service';
import { PaymentReceipt, SalesandTransactions } from '../../../domain/sales/sales.dto';
import { formatApiDate, formatApiDateTime } from '../../../service/sales/date.util';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-payment-receipt',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-receipt.component.html',
  styleUrl: './payment-receipt.component.scss'
})
export class PaymentReceiptComponent implements OnInit {
  @Input() paymentId?: string | number;
  @Input() paymentObj?: SalesandTransactions;
  @Output() closed = new EventEmitter<void>();

  receipt: PaymentReceipt | null = null;
  isLoading = true;
  isDownloading = false;
  isSendingEmail = false;
  emailSentSuccess = false;

  constructor(
    private messageService: MessageService,private salesService: SalesService) {}

  ngOnInit(): void {
    const targetId = this.paymentId || this.paymentObj?.id || this.paymentObj?.paymentNumber;
    if (targetId) {
      this.loadReceipt(String(targetId));
    } else {
      this.isLoading = false;
    }
  }

  loadReceipt(paymentId: string): void {
    this.isLoading = true;
    this.salesService.getPaymentReceipt(paymentId).subscribe({
      next: (res) => {
        this.receipt = res;
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Error fetching receipt:', err);
        this.isLoading = false;
      }
    });
  }

  close(): void {
    this.closed.emit();
  }

  formatCurrency(amount: number, currency: string = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency }).format(amount);
  }

  formatDate(date: any): string {
    return formatApiDate(date, { day: 'numeric', month: 'short', year: 'numeric' }, 'en-NG', '');
  }

  formatDateTime(date: any): string {
    return formatApiDateTime(date, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }, 'en-NG', '');
  }

  downloadPDF(): void {
    const element = document.getElementById('receipt-sheet');
    if (!element) {
      this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Unable to find receipt element to generate PDF.' });
      return;
    }

    this.isDownloading = true;
    element.classList.add('pdf-render-mode');

    setTimeout(() => {
      html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff'
      }).then((canvas) => {
        element.classList.remove('pdf-render-mode');
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`Receipt-${this.receipt?.receiptNumber || 'Payment'}.pdf`);
        this.isDownloading = false;
      }).catch((err) => {
        element.classList.remove('pdf-render-mode');
        console.error('Error generating PDF:', err);
        this.isDownloading = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to build PDF document. Printing browser view instead.' });
        this.printReceipt();
      });
    }, 100);
  }

  printReceipt(): void {
    window.print();
  }

  sendEmail(): void {
    if (this.isSendingEmail) return;
    this.isSendingEmail = true;
    setTimeout(() => {
      this.isSendingEmail = false;
      this.emailSentSuccess = true;
      setTimeout(() => {
        this.emailSentSuccess = false;
      }, 4000);
    }, 1200);
  }
}
