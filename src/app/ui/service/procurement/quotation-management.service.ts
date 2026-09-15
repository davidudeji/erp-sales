// quotation-management.service.ts

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  VendorQuotation,
  RFQWithQuotations,
  VendorQuotationStatus,
  QuotationHistoryEntry,
  MAX_QUOTATION_REVISIONS,
  ProcurementRequest,
} from '../../domain/procurement-request/procurement.dto';
import { environment } from '../../shared-component/service/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class QuotationManagementService {

  private readonly baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';

  constructor(private http: HttpClient) {}

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  // ── Quotation queries ────────────────────────────────────────────────────────

  getQuotationsByRfq(rfqId: string): Observable<VendorQuotation[]> {
    const params = new HttpParams()
      .set('page', '1')
      .set('size', '100')
      .set('rfqId', rfqId);
    return this.http.get<any>(`${this.baseUrl}/vendor-quotations/`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? res ?? []))
    );
  }

  getQuotation(id: string | number): Observable<VendorQuotation> {
    return this.http.get<VendorQuotation>(`${this.baseUrl}/vendor-quotations/${id}`);
  }

  getAllQuotations(filters?: any): Observable<VendorQuotation[]> {
    let params = new HttpParams()
      .set('page', String((filters?.page || 0) + 1))
      .set('size', String(filters?.size || 50));

    if (filters?.rfqId) { params = params.set('rfqId', filters.rfqId); }
    if (filters?.vendorId) { params = params.set('vendorId', filters.vendorId); }
    if (filters?.status) { params = params.set('status', filters.status); }

    return this.http.get<any>(`${this.baseUrl}/vendor-quotations/`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? res ?? []))
    );
  }

  // ── Quotation detail (alias used by existing components) ────────────────────

  getQuotationDetail(quotationId: string | number): Observable<VendorQuotation> {
    return this.getQuotation(quotationId);
  }

  // ── RFQ + quotations aggregate view ─────────────────────────────────────────

  getQuotationsForRFQ(rfqId: string): Observable<RFQWithQuotations> {
    return this.getQuotationsByRfq(rfqId).pipe(
      map((quotations: VendorQuotation[]) => {
        const responded = quotations.filter(q =>
          ['SUBMITTED', 'ACCEPTED', 'DECLINED', 'LPO_GENERATED', 'LPO_SENT', 'REVIEW_REQUESTED'].includes(q.status)
        ).length;
        const pending = quotations.filter(q => q.status === 'PENDING').length;
        const accepted = quotations.filter(q => ['ACCEPTED', 'LPO_GENERATED', 'LPO_SENT'].includes(q.status)).length;
        const declined = quotations.filter(q => q.status === 'DECLINED').length;
        const expired  = quotations.filter(q => q.status === 'EXPIRED').length;

        const rfqTitle = (quotations[0] as any)?.rfqTitle || 'Request for Quotation';

        const rfqData: RFQWithQuotations = {
          rfq: {
            id: Number(rfqId) || 0,
            title: rfqTitle,
            status: accepted > 0 ? 'VENDOR_SELECTED' : 'VENDORS_QUOTING',
            selectedVendorId: quotations.find(q => q.status === 'ACCEPTED')?.vendorId || '',
            selectedVendorName: quotations.find(q => q.status === 'ACCEPTED')?.vendorName || '',
            selectedQuotationId: quotations.find(q => q.status === 'ACCEPTED')?.id?.toString() || '',
          } as any,
          quotations,
          summary: {
            totalVendors: quotations.length,
            responded,
            pending,
            accepted,
            declined,
            expired
          }
        };
        return rfqData;
      })
    );
  }

  // ── Quotation dashboard (all quotations) ─────────────────────────────────────

  getQuotationsDashboard(filters?: any): Observable<any> {
    return this.getAllQuotations(filters).pipe(
      map(quotations => ({ quotations }))
    );
  }

  // ── Lifecycle actions ────────────────────────────────────────────────────────

  acceptQuotation(quotationId: string | number, note?: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/vendor-quotations/${quotationId}/accept`,
      note ? { note } : {}
    );
  }

  declineQuotation(quotationId: string | number, reason: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/vendor-quotations/${quotationId}/decline`,
      { reason }
    );
  }

  /** Alias used by components that call rejectQuotation */
  rejectQuotation(quotationId: string | number, reason: string): Observable<{ message: string }> {
    return this.declineQuotation(quotationId, reason);
  }

  requestRevision(quotationId: string | number, note: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/vendor-quotations/${quotationId}/request-revision`,
      { note }
    );
  }

  /** Alias used by components that call requestChanges */
  requestChanges(quotationId: string | number, notes: string): Observable<{ message: string }> {
    return this.requestRevision(quotationId, notes);
  }

  generateLpo(quotationId: string | number): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/vendor-quotations/${quotationId}/generate-lpo`,
      {}
    );
  }

  markAsViewed(quotationId: string | number): Observable<void> {
    return this.http.patch<void>(
      `${this.baseUrl}/vendor-quotations/${quotationId}/mark-viewed`,
      {}
    );
  }

  // ── LPO helpers ──────────────────────────────────────────────────────────────

  ensureLpoAssigned(quotationId: string | number): Observable<{ lpoId: string; lpoNumber: string; lpoIssuedAt: Date }> {
    return this.generateLpo(quotationId).pipe(
      map((res: any) => ({
        lpoId: res?.lpoId ?? String(quotationId),
        lpoNumber: res?.lpoNumber ?? `LPO-${new Date().getFullYear()}-${String(quotationId)}`,
        lpoIssuedAt: res?.lpoIssuedAt ? new Date(res.lpoIssuedAt) : new Date()
      }))
    );
  }

  sendLpoToVendor(quotationId: string | number, lpoNumber: string): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/vendor-quotations/${quotationId}/generate-lpo`,
      { lpoNumber }
    );
  }

  // ── Status & history helpers ─────────────────────────────────────────────────

  updateQuotationStatus(quotationId: string | number, status: VendorQuotationStatus): Observable<{ message: string }> {
    return this.http.patch<{ message: string }>(
      `${this.baseUrl}/vendor-quotations/${quotationId}/decline`,
      { status }
    );
  }

  getQuotationHistory(quotationId: string | number): Observable<QuotationHistoryEntry[]> {
    return this.getQuotation(quotationId).pipe(
      map(q => q.history ?? [])
    );
  }

  // ── Write (create / update) ──────────────────────────────────────────────────

  createQuotation(quotation: Partial<VendorQuotation>): Observable<VendorQuotation> {
    return this.http.post<VendorQuotation>(
      `${this.baseUrl}/vendor-quotations/`,
      quotation
    );
  }

  updateQuotation(id: string | number, quotation: Partial<VendorQuotation>): Observable<VendorQuotation> {
    return this.http.put<VendorQuotation>(
      `${this.baseUrl}/vendor-quotations/${id}`,
      quotation
    );
  }

  // ── Simulation helpers (dev/demo only — no-op in production) ────────────────

  simulateVendorResubmit(quotationId: string | number, _newTotal: number, _newNotes?: string): Observable<{ message: string }> {
    // Vendor resubmission originates from the vendor portal; nothing to do here.
    return new Observable(observer => {
      observer.next({ message: 'Vendor resubmission must come from the vendor portal.' });
      observer.complete();
    });
  }

  cancelPendingQuotation(_rfqId: string, _vendorId: string): Observable<{ message: string }> {
    return new Observable(observer => {
      observer.next({ message: 'Use the decline endpoint to withdraw a pending quotation.' });
      observer.complete();
    });
  }
}
