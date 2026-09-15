// logistics.service.ts
// ============================================================
// Wired to the OptimaX Logistics API v4 endpoints, verified against the
// EXPANDED Commerce Swagger (real request/response examples for all 30
// /x/api/v2/commerce/logistics/* operations — see the "BACKEND WIRE
// CONTRACT" block at the bottom of logistics.dto.ts for what that
// confirmed vs. what was still a guess). Every public method signature
// below is unchanged from the original mock-backed version — the 14
// logistics components already consume this exact interface — only the
// implementation talks to the real backend now.
//
// Two confirmed quirks this file works around:
//  - GET /orders, /batches, /attempts, /audit return bare arrays with no
//    pagination/total envelope, and none of the GET list endpoints
//    declare accepted query parameters in swagger. Filters are still
//    sent (harmless if ignored) AND re-applied client-side so each
//    screen is correct regardless of whether the backend honors them.
//  - Primary keys are numbers on the wire; UI-facing models keep them as
//    strings (unchanged components), so ids are coerced at the mapper
//    boundary and back to numbers only where a payload needs one
//    (riderId on batch/attempt create, deliveryAttemptId on proof).
//
// ID convention (per spec): POST payloads (create) never include an
// `id` — the backend assigns it. Updates address the record purely via
// the `{id}` path segment on PUT/PATCH and never repeat `id` in the body.
// ============================================================

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, timer, forkJoin } from 'rxjs';
import { catchError, map, tap, switchMap } from 'rxjs/operators';
import {
  Order,
  Rider,
  DeliveryBatch,
  DeliveryAttempt,
  AuditLogEntry,
  FulfillmentType,
  OrderStatus,
  BatchStatus,
  StopStatus,
  ProofType,
  FailureReason,
  RiderPerformanceStat,
  AuditLogFilter,
  RiderCreatePayload,
  GeoPoint,
  RouteStop,
  AvailablePoolResponse,
  TriageListResponse,
  PoolListResponse,
  ApprovalQueueResponse,
  ActiveRoutesResponse,
  DeliveredListResponse,
  FailedListResponse,
  PickupListResponse,
  RiderRosterResponse,
  RiderPerformanceResponse,
  AuditLogResponse,
  AGING_THRESHOLD_MINUTES,
  minutesBetween,
  // wire (v4) types + mappers
  ApiOrder,
  ApiRider,
  ApiDeliveryBatch,
  ApiDeliveryAttempt,
  ApiAuditLogEntry,
  ApiPoolListResponse,
  ApiRiderRosterResponse,
  ApiRiderPerformanceResponse,
  ApiIngestPayload,
  ApiBatchCreatePayload,
  ApiAttemptCreatePayload,
  ApiProofCreatePayload,
  ApiRiderCreatePayload,
  mapApiOrder,
  mapApiRider,
  mapApiBatch,
  mapApiAttempt,
  mapApiAuditEntry,
  mapApiPerformanceStat
} from '../../domain/logistics/logistics.dto';
import { environment } from '../../shared-component/service/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class LogisticsService {
  private readonly base = `${environment.apiBaseUrl}/x/api/v2/commerce/logistics`;

  private get tenantId(): string {
    const h = window.location.hostname;
    return h.includes('localhost') || h.includes('127.0.0.1') ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  /**
   * The rider driving the "Rider App" screens (route-builder, stop-checklist).
   * There's no rider auth/session wired into the frontend yet, so this is the
   * one seam that stands in for it — swap for the real logged-in rider id
   * once rider login exists.
   */
  private get riderId(): string {
    return localStorage.getItem('logistics.currentRiderId') || 'r1';
  }

  // Live counters other parts of the shell (e.g. tab badges) can subscribe to.
  private readonly unroutedCount$$ = new BehaviorSubject<number>(0);
  private readonly poolAgingCount$$ = new BehaviorSubject<number>(0);
  private readonly pendingApprovalCount$$ = new BehaviorSubject<number>(0);

  readonly unroutedCount = this.unroutedCount$$.asObservable();
  readonly poolAgingCount = this.poolAgingCount$$.asObservable();
  readonly pendingApprovalCount = this.pendingApprovalCount$$.asObservable();

  constructor(private http: HttpClient) {}

  // ============================================================
  // ROUTING QUEUE — PART A: TRIAGE
  // GET /logistics/orders — bare array, no confirmed filter params, so
  // this re-filters/sorts to PENDING_ROUTING client-side regardless.
  // ============================================================

  getTriageOrders(search: string = ''): Observable<TriageListResponse> {
    let params = new HttpParams().set('status', OrderStatus.PENDING_ROUTING).set('sort', 'ingestedAt:asc');
    if (search) params = params.set('search', search);
    return this.http.get<ApiOrder[]>(`${this.base}/orders`, { params }).pipe(
      map((res) => {
        let orders = (res || []).map(mapApiOrder).filter((o) => o.status === OrderStatus.PENDING_ROUTING);
        if (search) {
          const q = search.toLowerCase();
          orders = orders.filter((o) => o.orderId.toLowerCase().includes(q) || o.customerName.toLowerCase().includes(q));
        }
        orders = orders.sort((a, b) => new Date(a.paidAt).getTime() - new Date(b.paidAt).getTime());
        return { orders, total: orders.length };
      }),
      tap((res) => this.unroutedCount$$.next(res.total)),
      catchError(() => of({ orders: [], total: 0 }))
    );
  }

  // PATCH /logistics/orders/{id}/route — id lives in the path, never in the
  // body. NOTE: the request body schema is undocumented in swagger (shown
  // as a generic placeholder), so `fulfillmentType` here is a best-effort
  // guess from the docx, not a confirmed field name.
  routeOrder(orderId: string, fulfillmentType: FulfillmentType.PICKUP | FulfillmentType.DELIVERY): Observable<Order> {
    return this.http
      .patch<ApiOrder>(`${this.base}/orders/${orderId}/route`, { fulfillmentType, tenantId: this.tenantId })
      .pipe(map(mapApiOrder));
  }

  // No dedicated bulk-route endpoint exists, so this fans the confirmed
  // single-order PATCH .../route call out across every selected id.
  bulkRouteOrders(orderIds: string[], fulfillmentType: FulfillmentType.PICKUP | FulfillmentType.DELIVERY): Observable<{ routed: number }> {
    if (!orderIds.length) return of({ routed: 0 });
    return forkJoin(
      orderIds.map((id) =>
        this.routeOrder(id, fulfillmentType).pipe(
          map(() => true),
          catchError(() => of(false))
        )
      )
    ).pipe(map((results) => ({ routed: results.filter(Boolean).length })));
  }

  // ============================================================
  // ROUTING QUEUE — PART B: POOL OVERSIGHT
  // GET /logistics/orders/pool — confirmed wrapper shape { orders, total, agingCount }
  // ============================================================

  getPoolOrders(agingThresholdMinutes: number = AGING_THRESHOLD_MINUTES): Observable<PoolListResponse> {
    const params = new HttpParams().set('agingThresholdMinutes', agingThresholdMinutes);
    return this.http.get<ApiPoolListResponse>(`${this.base}/orders/pool`, { params }).pipe(
      map((res) => this.toPoolList(res, agingThresholdMinutes)),
      tap((res) => this.poolAgingCount$$.next(res.agingCount)),
      catchError(() => of({ orders: [], total: 0, agingCount: 0 }))
    );
  }

  // GET /logistics/riders — confirmed wrapper { riders, total }; status
  // filter param unconfirmed, so also filtered client-side.
  getActiveRiders(): Observable<Rider[]> {
    const params = new HttpParams().set('status', 'active');
    return this.http.get<ApiRiderRosterResponse>(`${this.base}/riders`, { params }).pipe(
      map((res) => (res.riders || []).map(mapApiRider)),
      catchError(() => of([]))
    );
  }

  // No dedicated force-assign endpoint — modelled as a direct status
  // transition to CLAIMED via the generic order-status endpoint, carrying
  // the rider to assign as an extra field. Body schema unconfirmed (see
  // note above), same caveat as routeOrder().
  forceAssignOrder(orderId: string, riderId: string): Observable<Order> {
    return this.http
      .patch<ApiOrder>(`${this.base}/orders/${orderId}/status`, { status: OrderStatus.CLAIMED, riderId: Number(riderId), tenantId: this.tenantId })
      .pipe(map(mapApiOrder));
  }

  // ============================================================
  // ROUTE APPROVAL — PART A: APPROVAL QUEUE
  // GET /logistics/batches — bare array; PATCH .../approve confirmed to
  // return the full updated batch, request body unconfirmed.
  // ============================================================

  getPendingApprovalBatches(): Observable<ApprovalQueueResponse> {
    const params = new HttpParams().set('status', BatchStatus.ROUTE_SUBMITTED);
    return this.http.get<ApiDeliveryBatch[]>(`${this.base}/batches`, { params }).pipe(
      map((res) => {
        const batches = (res || []).map(mapApiBatch).filter((b) => b.status === BatchStatus.ROUTE_SUBMITTED);
        return { batches, total: batches.length };
      }),
      tap((res) => this.pendingApprovalCount$$.next(res.total)),
      catchError(() => of({ batches: [], total: 0 }))
    );
  }

  approveBatch(batchId: string, note?: string): Observable<DeliveryBatch> {
    return this.http
      .patch<ApiDeliveryBatch>(`${this.base}/batches/${batchId}/approve`, { approved: true, note, tenantId: this.tenantId })
      .pipe(map(mapApiBatch));
  }

  rejectBatch(batchId: string, note: string): Observable<DeliveryBatch> {
    return this.http
      .patch<ApiDeliveryBatch>(`${this.base}/batches/${batchId}/approve`, { approved: false, note, tenantId: this.tenantId })
      .pipe(map(mapApiBatch));
  }

  // ============================================================
  // ROUTE APPROVAL — PART B: LIVE TRACKING
  // ============================================================

  getActiveRouteBatches(): Observable<ActiveRoutesResponse> {
    const params = new HttpParams().set('status', `${BatchStatus.ROUTE_APPROVED},${BatchStatus.IN_PROGRESS}`);
    return this.http.get<ApiDeliveryBatch[]>(`${this.base}/batches`, { params }).pipe(
      map((res) => {
        const batches = (res || [])
          .map(mapApiBatch)
          .filter((b) => b.status === BatchStatus.ROUTE_APPROVED || b.status === BatchStatus.IN_PROGRESS);
        return { batches, total: batches.length };
      }),
      catchError(() => of({ batches: [], total: 0 }))
    );
  }

  /** Poll active routes every N ms — used for "near real-time" updates without a manual refresh. */
  pollActiveRouteBatches(intervalMs: number = 15000): Observable<ActiveRoutesResponse> {
    return timer(0, intervalMs).pipe(switchMap(() => this.getActiveRouteBatches()));
  }

  // ============================================================
  // SHARED — ORDER DETAIL + AUDIT TRAIL
  // ============================================================

  getOrderDetail(orderId: string): Observable<Order | undefined> {
    return this.http.get<ApiOrder>(`${this.base}/orders/${orderId}`).pipe(
      map(mapApiOrder),
      catchError(() => of(undefined))
    );
  }

  // GET /logistics/audit — confirmed path + bare-array shape (field names
  // match the docx's AuditLogEntryDTO exactly: entityType, actorId,
  // actorName, actorType, fromStatus, toStatus, etc.)
  getAuditLog(entityId: string): Observable<AuditLogEntry[]> {
    const params = new HttpParams().set('entityId', entityId);
    return this.http.get<ApiAuditLogEntry[]>(`${this.base}/audit`, { params }).pipe(
      map((res) => (res || []).filter((e) => e.entityId === entityId).map(mapApiAuditEntry)),
      catchError(() => of([]))
    );
  }

  // ============================================================
  // DELIVERY RECORDS — PART A: DELIVERED (PROOF REVIEW)
  // GET /logistics/attempts — bare array
  // ============================================================

  getDeliveredAttempts(search: string = ''): Observable<DeliveredListResponse> {
    let params = new HttpParams().set('outcome', 'DELIVERED');
    if (search) params = params.set('search', search);
    return this.http.get<ApiDeliveryAttempt[]>(`${this.base}/attempts`, { params }).pipe(
      map((res) => {
        let attempts = (res || []).filter((a) => a.outcome === 'DELIVERED').map(mapApiAttempt);
        if (search) {
          const q = search.toLowerCase();
          attempts = attempts.filter(
            (a) => a.orderDisplayId.toLowerCase().includes(q) || a.customerName.toLowerCase().includes(q) || a.riderName.toLowerCase().includes(q)
          );
        }
        attempts = attempts.sort((a, b) => new Date(b.attemptedAt || 0).getTime() - new Date(a.attemptedAt || 0).getTime());
        return { attempts, total: attempts.length };
      }),
      catchError(() => of({ attempts: [], total: 0 }))
    );
  }

  // ============================================================
  // DELIVERY RECORDS — PART B: FAILED (EXCEPTIONS)
  // PATCH /logistics/attempts/{id}/resolve — request body unconfirmed
  // ============================================================

  getFailedAttempts(): Observable<FailedListResponse> {
    const params = new HttpParams().set('outcome', 'FAILED').set('isResolved', 'false');
    return this.http.get<ApiDeliveryAttempt[]>(`${this.base}/attempts`, { params }).pipe(
      map((res) => {
        const attempts = (res || [])
          .filter((a) => a.outcome === 'FAILED' && !a.isResolved)
          .map(mapApiAttempt)
          .sort((a, b) => new Date(b.attemptedAt || 0).getTime() - new Date(a.attemptedAt || 0).getTime());
        return { attempts, total: attempts.length };
      }),
      catchError(() => of({ attempts: [], total: 0 }))
    );
  }

  requeueFailedOrder(attemptId: string): Observable<DeliveryAttempt> {
    return this.http
      .patch<ApiDeliveryAttempt>(`${this.base}/attempts/${attemptId}/resolve`, { resolutionAction: 'REQUEUE', tenantId: this.tenantId })
      .pipe(map(mapApiAttempt));
  }

  cancelFailedOrder(attemptId: string): Observable<DeliveryAttempt> {
    return this.http
      .patch<ApiDeliveryAttempt>(`${this.base}/attempts/${attemptId}/resolve`, { resolutionAction: 'CANCEL', tenantId: this.tenantId })
      .pipe(map(mapApiAttempt));
  }

  escalateFailedOrder(attemptId: string, note: string): Observable<DeliveryAttempt> {
    return this.http
      .patch<ApiDeliveryAttempt>(`${this.base}/attempts/${attemptId}/resolve`, { resolutionAction: 'ESCALATE', note, tenantId: this.tenantId })
      .pipe(map(mapApiAttempt));
  }

  // ============================================================
  // DELIVERY RECORDS — PART C: PICKUP CONFIRMATION
  // ============================================================

  getPickupOrders(): Observable<PickupListResponse> {
    const params = new HttpParams().set('fulfillmentType', FulfillmentType.PICKUP).set('status', OrderStatus.READY_FOR_PICKUP);
    return this.http.get<ApiOrder[]>(`${this.base}/orders`, { params }).pipe(
      map((res) => {
        const orders = (res || [])
          .map(mapApiOrder)
          .filter((o) => o.fulfillmentType === FulfillmentType.PICKUP && o.status === OrderStatus.READY_FOR_PICKUP);
        return { orders, total: orders.length };
      }),
      catchError(() => of({ orders: [], total: 0 }))
    );
  }

  markCollected(orderId: string, verificationCode?: string): Observable<Order> {
    return this.http
      .patch<ApiOrder>(`${this.base}/orders/${orderId}/status`, { status: OrderStatus.COLLECTED, verificationCode, tenantId: this.tenantId })
      .pipe(map(mapApiOrder));
  }

  // ============================================================
  // RIDER ACTIVITY — PART A: ROSTER + PERFORMANCE
  // ============================================================

  getRiderRoster(): Observable<RiderRosterResponse> {
    return this.http.get<ApiRiderRosterResponse>(`${this.base}/riders`).pipe(
      map((res) => ({ riders: (res.riders || []).map(mapApiRider), total: res.total ?? (res.riders || []).length })),
      catchError(() => of({ riders: [], total: 0 }))
    );
  }

  // POST /logistics/riders — confirmed payload: name, email, phone,
  // vehicleType, activeStatus, maxClaimLimit. No `id`, backend assigns one.
  addRider(payload: RiderCreatePayload): Observable<Rider> {
    const body: ApiRiderCreatePayload = {
      name: payload.name,
      email: payload.email,
      phone: payload.phone,
      vehicleType: payload.vehicleType,
      activeStatus: payload.activeStatus
    };
    return this.http.post<ApiRider>(`${this.base}/riders`, { ...body, tenantId: this.tenantId }).pipe(map(mapApiRider));
  }

  getRiderById(riderId: string): Observable<Rider | undefined> {
    return this.http.get<ApiRider>(`${this.base}/riders/${riderId}`).pipe(
      map(mapApiRider),
      catchError(() => of(undefined))
    );
  }

  getRiderPerformance(): Observable<RiderPerformanceResponse> {
    return this.http.get<ApiRiderPerformanceResponse>(`${this.base}/riders/performance`).pipe(
      map((res) => ({
        stats: (res.stats || []).map(mapApiPerformanceStat),
        total: res.total ?? (res.stats || []).length,
        activeRiders: res.activeRiders ?? 0,
        avgDeliveryRate: res.avgDeliveryRate ?? 0,
        avgTimePerOrderMinutes: res.avgTimePerOrderMinutes ?? 0,
        hoardingRiskCount: res.hoardingRiskCount ?? 0
      })),
      catchError(() =>
        of({ stats: [], total: 0, activeRiders: 0, avgDeliveryRate: 0, avgTimePerOrderMinutes: 0, hoardingRiskCount: 0 })
      )
    );
  }

  // ============================================================
  // RIDER ACTIVITY — PART B: SYSTEM AUDIT LOG
  // GET /logistics/audit — same confirmed endpoint as getAuditLog(),
  // just filtered differently for the system-wide view.
  // ============================================================

  getSystemAuditLog(filter: AuditLogFilter = {}): Observable<AuditLogResponse> {
    let params = new HttpParams();
    Object.entries(filter).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') params = params.set(k, String(v));
    });
    return this.http.get<ApiAuditLogEntry[]>(`${this.base}/audit`, { params }).pipe(
      map((res) => {
        let entries = (res || []).map(mapApiAuditEntry);
        if (filter.orderId) {
          const q = filter.orderId.toLowerCase();
          entries = entries.filter((e) => (e.entityDisplayId || '').toLowerCase().includes(q));
        }
        if (filter.riderId) {
          const q = filter.riderId.toLowerCase();
          entries = entries.filter((e) => e.actor.toLowerCase().includes(q));
        }
        if (filter.actionType) {
          entries = entries.filter((e) => e.toStatus === filter.actionType);
        }
        entries = entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        return { entries, total: entries.length };
      }),
      catchError(() => of({ entries: [], total: 0 }))
    );
  }

  // ============================================================
  // RIDER APP — ROUTE BUILDER (claim → arrange → submit)
  // ============================================================

  getRiderAvailablePool(): Observable<AvailablePoolResponse> {
    return forkJoin([
      this.http
        .get<ApiPoolListResponse>(`${this.base}/orders/pool`)
        .pipe(catchError(() => of({ orders: [], total: 0, agingCount: 0 } as ApiPoolListResponse))),
      this.getRiderById(this.riderId)
    ]).pipe(
      switchMap(([pool, rider]) =>
        this.fetchMyDraftBatch().pipe(
          map((draft) => ({
            orders: (pool.orders || []).map(mapApiOrder),
            total: pool.total ?? (pool.orders || []).length,
            claimLimit: (rider as any)?.maxClaimLimit ?? 15,
            currentLoad: draft?.orderIds.length ?? 0
          }))
        )
      ),
      catchError(() => of({ orders: [], total: 0, claimLimit: 15, currentLoad: 0 }))
    );
  }

  getMyBatch(): Observable<DeliveryBatch | null> {
    return this.fetchMyDraftBatch();
  }

  // POST /logistics/batches — confirmed payload uses `riderId` (a NUMBER)
  // + orderIds, no `id`; the backend upserts the rider's draft batch.
  claimOrders(orderIds: string[]): Observable<DeliveryBatch> {
    const body: ApiBatchCreatePayload = { riderId: Number(this.riderId.replace(/\D/g, '')) || 0, orderIds };
    return this.http.post<ApiDeliveryBatch>(`${this.base}/batches`, { ...body, tenantId: this.tenantId }).pipe(map(mapApiBatch));
  }

  // PUT /logistics/batches/{id} — id addressed via the path only.
  removeFromBatch(orderId: string): Observable<DeliveryBatch | null> {
    return this.fetchMyDraftBatch().pipe(
      switchMap((batch) => {
        if (!batch) return of(null);
        const orderIds = batch.orderIds.filter((id) => id !== orderId);
        if (!orderIds.length) {
          return this.http.delete(`${this.base}/batches/${batch.id}`).pipe(map(() => null));
        }
        const proposedRoute = batch.proposedRoute.filter((s) => s.orderId !== orderId).map((s, idx) => ({ ...s, sequence: idx + 1 }));
        return this.putBatch(batch.id, { ...batch, orderIds, proposedRoute });
      })
    );
  }

  reorderBatch(orderedOrderIds: string[]): Observable<DeliveryBatch | null> {
    return this.fetchMyDraftBatch().pipe(
      switchMap((batch) => {
        if (!batch) return of(null);
        const stopMap = new Map(batch.proposedRoute.map((s) => [s.orderId, s]));
        const proposedRoute: RouteStop[] = orderedOrderIds
          .map((id) => stopMap.get(id))
          .filter((s): s is RouteStop => !!s)
          .map((s, idx) => ({ ...s, sequence: idx + 1 }));
        return this.putBatch(batch.id, { ...batch, orderIds: orderedOrderIds, proposedRoute });
      })
    );
  }

  updateStopLocation(orderId: string, point: GeoPoint): Observable<DeliveryBatch | null> {
    return this.mutateStop(orderId, (stop) => ({ ...stop, lat: point.lat, lng: point.lng, location: point.label }));
  }

  confirmStopLocation(orderId: string, point: GeoPoint): Observable<DeliveryBatch | null> {
    return this.mutateStop(orderId, (stop) => ({ ...stop, lat: point.lat, lng: point.lng, location: point.label, locationConfirmed: true }));
  }

  submitBatchForApproval(): Observable<DeliveryBatch | null> {
    return this.fetchMyDraftBatch().pipe(
      switchMap((batch) => {
        if (!batch) return of(null);
        return this.http
          .patch<ApiDeliveryBatch>(`${this.base}/batches/${batch.id}/submit`, { tenantId: this.tenantId })
          .pipe(map(mapApiBatch));
      })
    );
  }

  // ============================================================
  // RIDER APP — STOP CHECKLIST (execute an approved route)
  // ============================================================

  getActiveBatch(): Observable<DeliveryBatch | null> {
    const params = new HttpParams().set('riderId', this.riderId).set('status', `${BatchStatus.ROUTE_APPROVED},${BatchStatus.IN_PROGRESS}`);
    return this.http.get<ApiDeliveryBatch[]>(`${this.base}/batches`, { params }).pipe(
      map((res) => {
        const mine = (res || [])
          .filter((b) => (b.status === BatchStatus.ROUTE_APPROVED || b.status === BatchStatus.IN_PROGRESS) && String(b.rider?.id) === this.riderId.replace(/\D/g, ''))
          .map(mapApiBatch);
        return mine[0] || null;
      }),
      catchError(() => of(null))
    );
  }

  markStopEnRoute(orderId: string): Observable<DeliveryBatch | null> {
    return this.mutateActiveStop(orderId, (stop) => ({ ...stop, stopStatus: StopStatus.EN_ROUTE }));
  }

  // POST /logistics/attempts (create — no id), then POST /logistics/attempts/proof,
  // then reflect the stop + order status. None of the create bodies carry an `id`.
  markStopDelivered(orderId: string, proofType: ProofType, proofValue?: string, receiverName?: string): Observable<DeliveryBatch | null> {
    return this.getActiveBatch().pipe(
      switchMap((batch) => {
        if (!batch) return of(null);
        const attemptPayload: ApiAttemptCreatePayload = {
          orderId,
          batchId: batch.id,
          riderId: Number(this.riderId.replace(/\D/g, '')) || 0,
          outcome: 'DELIVERED'
        };
        return this.http.post<ApiDeliveryAttempt>(`${this.base}/attempts`, { ...attemptPayload, tenantId: this.tenantId }).pipe(
          switchMap((attempt) => {
            const proofPayload: ApiProofCreatePayload = {
              deliveryAttemptId: attempt.id,
              type: proofType,
              fileUrl: proofType !== ProofType.CODE ? proofValue : undefined,
              code: proofType === ProofType.CODE ? proofValue : undefined
            };
            return this.http.post(`${this.base}/attempts/proof`, { ...proofPayload, tenantId: this.tenantId });
          }),
          switchMap(() =>
            this.http.patch<ApiOrder>(`${this.base}/orders/${orderId}/status`, { status: OrderStatus.DELIVERED, receiverName, tenantId: this.tenantId })
          ),
          switchMap(() => this.mutateStopOnBatch(batch, orderId, (stop) => ({ ...stop, stopStatus: StopStatus.DELIVERED })))
        );
      })
    );
  }

  markStopFailed(orderId: string, reason: FailureReason, note?: string): Observable<DeliveryBatch | null> {
    return this.getActiveBatch().pipe(
      switchMap((batch) => {
        if (!batch) return of(null);
        const attemptPayload: ApiAttemptCreatePayload = {
          orderId,
          batchId: batch.id,
          riderId: Number(this.riderId.replace(/\D/g, '')) || 0,
          outcome: 'FAILED',
          failureReason: reason
        };
        return this.http.post<ApiDeliveryAttempt>(`${this.base}/attempts`, { ...attemptPayload, note, tenantId: this.tenantId }).pipe(
          switchMap(() =>
            this.http.patch<ApiOrder>(`${this.base}/orders/${orderId}/status`, { status: OrderStatus.FAILED, tenantId: this.tenantId })
          ),
          switchMap(() => this.mutateStopOnBatch(batch, orderId, (stop) => ({ ...stop, stopStatus: StopStatus.FAILED })))
        );
      })
    );
  }

  // ============================================================
  // GEOCODING (address autocomplete + reverse lookup via OpenStreetMap Nominatim)
  // ============================================================

  searchAddress(query: string): Observable<GeoPoint[]> {
    if (!query || query.trim().length < 3) return of([]);
    const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=${encodeURIComponent(query)}`;
    return this.http.get<any[]>(url).pipe(
      map((results) => (results || []).map((r) => ({ label: r.display_name, lat: parseFloat(r.lat), lng: parseFloat(r.lon) }))),
      catchError(() => of([]))
    );
  }

  reverseGeocode(lat: number, lng: number): Observable<GeoPoint> {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
    return this.http.get<any>(url).pipe(
      map((r) => ({ label: r?.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng })),
      catchError(() => of({ label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng }))
    );
  }

  // ============================================================
  // INGESTION — one-time read from Commerce, see Optimax_Logistics_Models_v4 §4.
  // CONFIRMED payload shape from the expanded swagger: the caller supplies
  // the already-fetched Commerce snapshot (orderId, customerName, items,
  // shippingAddress as a plain string, receiver info) — Logistics geocodes
  // shippingAddress into its own AddressDTO server-side and creates the
  // OrderDTO. This is NOT "give me an id and I'll go fetch it".
  // ============================================================

  ingestOrderFromCommerce(payload: ApiIngestPayload): Observable<Order> {
    return this.http.post<ApiOrder>(`${this.base}/orders/ingest`, { ...payload, tenantId: this.tenantId }).pipe(map(mapApiOrder));
  }

  // ============================================================
  // INTERNAL HELPERS
  // ============================================================

  private toPoolList(res: ApiPoolListResponse, agingThresholdMinutes: number): PoolListResponse {
    const orders = (res.orders || []).map(mapApiOrder).map((o) => {
      const timeInPoolMinutes = o.timeInPoolMinutes ?? (o.enteredPoolAt ? minutesBetween(o.enteredPoolAt) : undefined);
      return { ...o, timeInPoolMinutes, isAging: timeInPoolMinutes !== undefined && timeInPoolMinutes >= agingThresholdMinutes };
    });
    return { orders, total: res.total ?? orders.length, agingCount: res.agingCount ?? orders.filter((o) => o.isAging).length };
  }

  /** The current rider's in-progress draft/submitted batch (route-builder screens). */
  private fetchMyDraftBatch(): Observable<DeliveryBatch | null> {
    const params = new HttpParams().set('riderId', this.riderId).set('status', `${BatchStatus.CLAIMING},${BatchStatus.ROUTE_SUBMITTED}`);
    return this.http.get<ApiDeliveryBatch[]>(`${this.base}/batches`, { params }).pipe(
      map((res) => {
        const mine = (res || [])
          .filter((b) => (b.status === BatchStatus.CLAIMING || b.status === BatchStatus.ROUTE_SUBMITTED) && String(b.rider?.id) === this.riderId.replace(/\D/g, ''))
          .map(mapApiBatch);
        return mine[0] || null;
      }),
      catchError(() => of(null))
    );
  }

  /** PUT /logistics/batches/{id} — id only in the path, body is the full updated record. */
  private putBatch(id: string, batch: DeliveryBatch): Observable<DeliveryBatch | null> {
    const { id: _drop, ...body } = batch;
    return this.http.put<ApiDeliveryBatch>(`${this.base}/batches/${id}`, { ...body, tenantId: this.tenantId }).pipe(map(mapApiBatch));
  }

  private mutateStop(orderId: string, mutate: (stop: RouteStop) => RouteStop): Observable<DeliveryBatch | null> {
    return this.fetchMyDraftBatch().pipe(switchMap((batch) => (batch ? this.mutateStopOnBatch(batch, orderId, mutate) : of(null))));
  }

  private mutateActiveStop(orderId: string, mutate: (stop: RouteStop) => RouteStop): Observable<DeliveryBatch | null> {
    return this.getActiveBatch().pipe(switchMap((batch) => (batch ? this.mutateStopOnBatch(batch, orderId, mutate) : of(null))));
  }

  private mutateStopOnBatch(batch: DeliveryBatch, orderId: string, mutate: (stop: RouteStop) => RouteStop): Observable<DeliveryBatch | null> {
    const proposedRoute = batch.proposedRoute.map((s) => (s.orderId === orderId ? mutate(s) : s));
    return this.putBatch(batch.id, { ...batch, proposedRoute });
  }
}
