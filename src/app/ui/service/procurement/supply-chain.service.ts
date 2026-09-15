import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import {
  GoodsReceivedNote, DeliveryTracking, PaymentVoucher, PaymentVoucherStatus, GrnStatus,
  DeliveryStatus, ProcurementNotification
} from '../../domain/procurement-request/procurement.dto';
import { environment } from '../../shared-component/service/environments/environment';

@Injectable({ providedIn: 'root' })
export class SupplyChainService {

  private readonly baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';

  // In-memory caches for optimistic UI
  private deliveries$$ = new BehaviorSubject<DeliveryTracking[]>([]);
  private grns$$ = new BehaviorSubject<GoodsReceivedNote[]>([]);
  private vouchers$$ = new BehaviorSubject<PaymentVoucher[]>([]);

  readonly deliveries$ = this.deliveries$$.asObservable();
  readonly grns$ = this.grns$$.asObservable();
  readonly vouchers$ = this.vouchers$$.asObservable();

  constructor(private http: HttpClient) {}

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  // ── Delivery Tracking ───────────────────────────────────────────────────────

  getDeliveries(filters?: { lpoId?: string; vendorId?: string; status?: DeliveryStatus; page?: number; size?: number }): Observable<DeliveryTracking[]> {
    let params = new HttpParams().set('page', '1').set('size', '50');
    if (filters?.lpoId) params = params.set('lpoId', filters.lpoId);
    if (filters?.vendorId) params = params.set('vendorId', filters.vendorId);
    if (filters?.status) params = params.set('status', filters.status);
    return this.http.get<any>(`${this.baseUrl}/deliveries`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      tap(list => this.deliveries$$.next(list)),
      catchError(err => { console.error('[SupplyChainService] getDeliveries failed:', err); return this.deliveries$; })
    );
  }

  getDeliveryByLpo(lpoId: string): Observable<DeliveryTracking | null> {
    return this.http.get<DeliveryTracking>(`${this.baseUrl}/deliveries/lpo/${lpoId}`).pipe(
      catchError(() => of(null))
    );
  }

  createDelivery(delivery: Partial<DeliveryTracking>): Observable<DeliveryTracking> {
    return this.http.post<DeliveryTracking>(`${this.baseUrl}/deliveries`, { ...delivery, tenantId: this.tenantId }).pipe(
      tap(saved => this.deliveries$$.next([saved, ...this.deliveries$$.getValue()])),
      catchError(err => { console.error('[SupplyChainService] createDelivery failed:', err); throw err; })
    );
  }

  updateDeliveryStatus(deliveryId: string, status: DeliveryStatus, description: string, location?: string): Observable<DeliveryTracking> {
    return this.http.patch<DeliveryTracking>(`${this.baseUrl}/deliveries/${deliveryId}/status`, { status, description, location }).pipe(
      tap(updated => {
        const current = this.deliveries$$.getValue();
        this.deliveries$$.next(current.map(d => d.id === deliveryId ? updated : d));
      }),
      catchError(err => { console.error('[SupplyChainService] updateDeliveryStatus failed:', err); throw err; })
    );
  }

  // ── GRN ────────────────────────────────────────────────────────────────────

  /** All GRNs. The real API has no lpoId/status query params, so those filters (when given) are applied client-side. */
  getGrns(filters?: { lpoId?: number; status?: GrnStatus }): Observable<GoodsReceivedNote[]> {
    const params = new HttpParams().set('tenantId', this.tenantId);
    return this.http.get<any>(`${this.baseUrl}/goods-received-notes/`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      map((list: GoodsReceivedNote[]) => list.filter(g =>
        (filters?.lpoId === undefined || g.lpoId === filters.lpoId) &&
        (!filters?.status || g.status === filters.status)
      )),
      tap(list => this.grns$$.next(list)),
      catchError(err => { console.error('[SupplyChainService] getGrns failed:', err); return this.grns$; })
    );
  }

  getGrnById(id: number): Observable<GoodsReceivedNote | null> {
    const params = new HttpParams().set('tenantId', this.tenantId);
    return this.http.get<GoodsReceivedNote>(`${this.baseUrl}/goods-received-notes/${id}`, { params }).pipe(
      catchError(err => { console.error('[SupplyChainService] getGrnById failed:', err); return of(null); })
    );
  }

  getGrnByLpo(lpoId: string): Observable<GoodsReceivedNote | null> {
    return this.http.get<GoodsReceivedNote>(`${this.baseUrl}/goods-received-notes/lpo/${lpoId}`).pipe(
      catchError(() => of(null))
    );
  }

  createGrn(grn: Partial<GoodsReceivedNote>): Observable<GoodsReceivedNote> {
    return this.http.post<GoodsReceivedNote>(`${this.baseUrl}/goods-received-notes/`, { ...grn, tenantId: this.tenantId }).pipe(
      tap(saved => this.grns$$.next([saved, ...this.grns$$.getValue()])),
      catchError(err => { console.error('[SupplyChainService] createGrn failed:', err); throw err; })
    );
  }

  updateGrn(grnId: number, grn: Partial<GoodsReceivedNote>): Observable<GoodsReceivedNote> {
    return this.http.put<GoodsReceivedNote>(`${this.baseUrl}/goods-received-notes/${grnId}`, { ...grn, tenantId: this.tenantId }).pipe(
      tap(updated => {
        const current = this.grns$$.getValue();
        this.grns$$.next(current.map(g => g.id === grnId ? updated : g));
      }),
      catchError(err => { console.error('[SupplyChainService] updateGrn failed:', err); throw err; })
    );
  }

  updateGrnStatus(grnId: number, status: GrnStatus, extra?: Record<string, any>): Observable<GoodsReceivedNote> {
    return this.http.patch<GoodsReceivedNote>(`${this.baseUrl}/goods-received-notes/${grnId}/status`, { status, ...extra }).pipe(
      tap(updated => {
        const current = this.grns$$.getValue();
        this.grns$$.next(current.map(g => g.id === grnId ? updated : g));
      }),
      catchError(err => { console.error('[SupplyChainService] updateGrnStatus failed:', err); throw err; })
    );
  }

  deleteGrn(id: number): Observable<boolean> {
    return this.http.delete<void>(`${this.baseUrl}/goods-received-notes/${id}`).pipe(
      map(() => {
        this.grns$$.next(this.grns$$.getValue().filter(g => g.id !== id));
        return true;
      }),
      catchError(err => { console.error('[SupplyChainService] deleteGrn failed:', err); return of(false); })
    );
  }

  submitGrn(grnId: number): Observable<GoodsReceivedNote> {
    return this.http.patch<GoodsReceivedNote>(`${this.baseUrl}/goods-received-notes/${grnId}/submit`, {}).pipe(
      tap(updated => {
        const current = this.grns$$.getValue();
        this.grns$$.next(current.map(g => g.id === grnId ? updated : g));
      }),
      catchError(err => { console.error('[SupplyChainService] submitGrn failed:', err); throw err; })
    );
  }

  approveGrn(grnId: number, approvedBy: string): Observable<GoodsReceivedNote> {
    return this.http.patch<GoodsReceivedNote>(`${this.baseUrl}/goods-received-notes/${grnId}/approve`, { approvedBy }).pipe(
      catchError(err => { console.error('[SupplyChainService] approveGrn failed:', err); throw err; })
    );
  }

  // ── Payment Voucher ─────────────────────────────────────────────────────────

  createPaymentVoucher(voucher: Partial<PaymentVoucher>): Observable<PaymentVoucher> {
    return this.http.post<PaymentVoucher>(`${this.baseUrl}/payment-vouchers/`, { ...voucher, tenantId: this.tenantId }).pipe(
      tap(saved => this.vouchers$$.next([saved, ...this.vouchers$$.getValue()])),
      catchError(err => { console.error('[SupplyChainService] createPaymentVoucher failed:', err); throw err; })
    );
  }

  /** All payment vouchers. The real API has no lpoId/invoiceId query params, so those filters (when given) are applied client-side. */
  getPaymentVouchers(filters?: { lpoId?: string; invoiceId?: string }): Observable<PaymentVoucher[]> {
    const params = new HttpParams().set('tenantId', this.tenantId);
    return this.http.get<any>(`${this.baseUrl}/payment-vouchers/`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      map((list: PaymentVoucher[]) => list.filter(v =>
        (!filters?.lpoId || v.lpoId === filters.lpoId) &&
        (!filters?.invoiceId || v.invoiceId === filters.invoiceId)
      )),
      tap(list => this.vouchers$$.next(list)),
      catchError(() => of([]))
    );
  }

  getPaymentVoucherById(id: number): Observable<PaymentVoucher | null> {
    const params = new HttpParams().set('tenantId', this.tenantId);
    return this.http.get<PaymentVoucher>(`${this.baseUrl}/payment-vouchers/${id}`, { params }).pipe(
      catchError(err => { console.error('[SupplyChainService] getPaymentVoucherById failed:', err); return of(null); })
    );
  }

  updatePaymentVoucher(id: number, voucher: Partial<PaymentVoucher>): Observable<PaymentVoucher> {
    return this.http.put<PaymentVoucher>(`${this.baseUrl}/payment-vouchers/${id}`, { ...voucher, tenantId: this.tenantId }).pipe(
      tap(updated => {
        const current = this.vouchers$$.getValue();
        this.vouchers$$.next(current.map(v => v.id === id ? updated : v));
      }),
      catchError(err => { console.error('[SupplyChainService] updatePaymentVoucher failed:', err); throw err; })
    );
  }

  updatePaymentVoucherStatus(id: number, status: PaymentVoucherStatus, extra?: Record<string, any>): Observable<PaymentVoucher> {
    return this.http.patch<PaymentVoucher>(`${this.baseUrl}/payment-vouchers/${id}/status`, { status, ...extra }).pipe(
      tap(updated => {
        const current = this.vouchers$$.getValue();
        this.vouchers$$.next(current.map(v => v.id === id ? updated : v));
      }),
      catchError(err => { console.error('[SupplyChainService] updatePaymentVoucherStatus failed:', err); throw err; })
    );
  }

  deletePaymentVoucher(id: number): Observable<boolean> {
    return this.http.delete<void>(`${this.baseUrl}/payment-vouchers/${id}`).pipe(
      map(() => {
        this.vouchers$$.next(this.vouchers$$.getValue().filter(v => v.id !== id));
        return true;
      }),
      catchError(err => { console.error('[SupplyChainService] deletePaymentVoucher failed:', err); return of(false); })
    );
  }

  // ── Notification helpers (status-only, not content generation) ──────────────

  getNotifications(entityId: string, entityType: string): Observable<ProcurementNotification[]> {
    const params = new HttpParams().set('entityId', entityId).set('entityType', entityType);
    return this.http.get<any>(`${this.baseUrl}/notifications`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? [])),
      catchError(() => of([]))
    );
  }

  retryNotification(notificationId: string): Observable<ProcurementNotification> {
    return this.http.patch<ProcurementNotification>(`${this.baseUrl}/notifications/${notificationId}/retry`, {}).pipe(
      catchError(err => { console.error('[SupplyChainService] retryNotification failed:', err); throw err; })
    );
  }
}
