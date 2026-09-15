import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { PaymentVoucher, GoodsReceivedNote, ProcurementInvoice } from '../../domain/procurement-request/procurement.dto';
import { environment } from '../../shared-component/service/environments/environment';

export interface FinanceJournalEntry {
  id?: string;
  reference: string;
  description: string;
  date: string;            // ISO date string
  amount: number;
  currency: string;
  debitAccount: string;    // e.g., "5000 - Purchases"
  creditAccount: string;   // e.g., "2100 - Accounts Payable"
  vendorId: string;
  vendorName: string;
  lpoNumber: string;
  invoiceNumber: string;
  voucherNumber: string;
  tenantId: string;
  postedAt?: string;
  postedBy?: string;
  status?: 'PENDING' | 'POSTED' | 'REVERSED';
}

export interface FinanceBridgeResult {
  success: boolean;
  journalEntryId?: string;
  reference?: string;
  message: string;
  postedAt?: Date;
}

@Injectable({ providedIn: 'root' })
export class FinanceBridgeService {

  private readonly commerceUrl = environment.apiBaseUrl + '/x/api/v2/commerce';
  private readonly financeUrl  = environment.apiBaseUrl + '/x/api/v2/accounting';

  constructor(private http: HttpClient) {}

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  /**
   * Called automatically when a GRN is approved. Posts a journal entry to
   * the accounting module: Debit Purchases / Credit Accounts Payable.
   * Returns the journal entry reference for tracking.
   */
  postGrnToFinance(grn: GoodsReceivedNote, invoice: Partial<ProcurementInvoice>): Observable<FinanceBridgeResult> {
    const entry: FinanceJournalEntry = {
      reference: `GRN-${grn.grnNumber}-${Date.now()}`,
      description: `Goods received for LPO ${grn.lpoNumber} from ${grn.vendorName}`,
      date: new Date().toISOString().split('T')[0],
      amount: grn.totalReceivedValue,
      currency: (invoice as any)?.currency ?? 'NGN',
      debitAccount: '5000',
      creditAccount: '2100',
      vendorId: grn.vendorId,
      vendorName: grn.vendorName,
      lpoNumber: grn.lpoNumber,
      invoiceNumber: (invoice as any)?.invoiceNumber ?? '',
      voucherNumber: '',
      tenantId: this.tenantId
    };

    return this.http.post<any>(`${this.financeUrl}/journal-entries`, entry).pipe(
      map(res => ({
        success: true,
        journalEntryId: res?.id ?? res?.journalEntryId,
        reference: entry.reference,
        message: 'Successfully posted to Finance ledger',
        postedAt: new Date()
      } as FinanceBridgeResult)),
      catchError(err => {
        console.error('[FinanceBridgeService] postGrnToFinance failed:', err);
        return of({
          success: false,
          message: 'Finance posting failed — will retry automatically'
        } as FinanceBridgeResult);
      })
    );
  }

  /**
   * Posts payment confirmation to finance when a payment voucher is approved.
   * Debit Accounts Payable / Credit Bank Account.
   */
  postPaymentToFinance(voucher: PaymentVoucher): Observable<FinanceBridgeResult> {
    const entry: FinanceJournalEntry = {
      reference: `PV-${voucher.voucherNumber}-${Date.now()}`,
      description: voucher.narration,
      date: new Date().toISOString().split('T')[0],
      amount: voucher.amount,
      currency: voucher.currency,
      debitAccount: '2100',   // Accounts Payable
      creditAccount: '1010',  // Bank / Cash
      vendorId: voucher.vendorId,
      vendorName: voucher.vendorName,
      lpoNumber: voucher.lpoNumber,
      invoiceNumber: voucher.invoiceNumber,
      voucherNumber: voucher.voucherNumber,
      tenantId: this.tenantId
    };

    return this.http.post<any>(`${this.financeUrl}/journal-entries`, entry).pipe(
      map(res => ({
        success: true,
        journalEntryId: res?.id ?? res?.journalEntryId,
        reference: entry.reference,
        message: `Payment of ${voucher.currency} ${voucher.amount.toLocaleString()} posted to Finance`,
        postedAt: new Date()
      } as FinanceBridgeResult)),
      catchError(err => {
        console.error('[FinanceBridgeService] postPaymentToFinance failed:', err);
        return of({ success: false, message: 'Finance posting failed — retry later' } as FinanceBridgeResult);
      })
    );
  }

  /**
   * Checks if a GRN/payment has already been posted to avoid duplicates.
   */
  checkIfPosted(reference: string): Observable<boolean> {
    const params = new HttpParams().set('reference', reference).set('tenantId', this.tenantId);
    return this.http.get<any>(`${this.financeUrl}/journal-entries/check`, { params }).pipe(
      map(res => res?.exists === true),
      catchError(() => of(false))
    );
  }

  /**
   * Retrieves the finance ledger entries for a given LPO or payment voucher.
   */
  getLedgerEntries(lpoNumber: string): Observable<FinanceJournalEntry[]> {
    const params = new HttpParams().set('lpoNumber', lpoNumber).set('tenantId', this.tenantId);
    return this.http.get<any>(`${this.financeUrl}/journal-entries`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      catchError(() => of([]))
    );
  }
}
