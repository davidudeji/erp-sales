import { Component, Input } from '@angular/core';
import { ExtendedProcurementRequest } from '../../../service/procurement/rfq-quotation-bridge.util';

@Component({
  selector: 'app-invoices',
  templateUrl: './invoices.component.html',
  styleUrl: './invoices.component.scss'
})
export class InvoicesComponent {
  @Input() request: ExtendedProcurementRequest | null = null;
  @Input() invoice: any = null;

  formatCurrency(amount: number): string {
    if (!amount) return '0.00';
    const currency = this.request?.currency || 'NGN';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  getRequestIdSuffix(id: any): string {
    if (!id) return '';
    const str = String(id);
    return str.includes('-') ? str.split('-')[1] : str;
  }
}
