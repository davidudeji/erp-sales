import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  Rfq,
  Quotation,
  QuotationItem,
  QuotationHistoryEntry,
  Lpo,
  LpoItem,
  Invoice,
  Payment,
  VendorDocument,
  VendorStats,
  LpoStats,
  FinanceStats,
  DocumentStats,
  PerformanceStats,
  ItemAvailability,
  MonthlyMetric,
  ClientPerformance,
  VendorProfile,
  DocumentTemplate,
  TemplateDocType,
  MAX_REVISION_ROUNDS,
} from '../../domain/vendor-portal/vendor.dto';
import { environment } from '../../shared-component/service/environments/environment';

// Pure helper — recomputes per-line totals and quotation totals from item
// state. Exported so both the service (on save/resubmit) and the dashboard
// component (live, as the vendor edits) can share one source of truth for
// the pricing rules instead of drifting apart.
export function lineTotal(item: QuotationItem): number | null {
  if (item.unitPrice === null || item.unitPrice < 0) return null;
  switch (item.availability) {
    case 'available':
      return item.unitPrice * item.quantity;
    case 'partial':
      return item.offeredQuantity !== null ? item.unitPrice * item.offeredQuantity : null;
    case 'substitute':
      return item.unitPrice * (item.offeredQuantity ?? item.quantity);
    case 'unavailable':
      return null;
  }
}

export function computeQuotationTotals(q: Quotation): Quotation {
  const items = q.items.map((i) => ({ ...i, totalPrice: lineTotal(i) }));
  const subtotal = items.reduce((s, i) => s + (i.totalPrice ?? 0), 0);
  return { ...q, items, subtotal, tax: subtotal * 0.075, total: subtotal * 1.075 };
}

// Is this single line item in a submittable state? Every item needs a
// definitive, explained answer before a quotation can go out — either it's
// priced and available (in full, in part, or as a substitute) or it's
// explicitly marked unavailable with a reason.
export function isItemValid(item: QuotationItem): boolean {
  switch (item.availability) {
    case 'available':
      return item.unitPrice !== null && item.unitPrice >= 0;
    case 'partial':
      return (
        item.unitPrice !== null &&
        item.unitPrice >= 0 &&
        item.offeredQuantity !== null &&
        item.offeredQuantity > 0 &&
        item.offeredQuantity < item.quantity &&
        !!item.exceptionNote?.trim()
      );
    case 'substitute':
      return item.unitPrice !== null && item.unitPrice >= 0 && !!item.substituteDescription?.trim();
    case 'unavailable':
      return !!item.exceptionNote?.trim();
  }
}

export function isQuotationSubmittable(q: Quotation): boolean {
  return (
    q.items.length > 0 &&
    q.items.every((i) => isItemValid(i)) &&
    q.items.some((i) => i.availability !== 'unavailable')
  );
}

const AVAILABILITY_LABEL: Record<ItemAvailability, string> = {
  available: 'full qty',
  partial: 'partial qty',
  substitute: 'substitute',
  unavailable: 'unavailable',
};

function fmtMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${Math.round(amount).toLocaleString()}`;
  }
}

// Builds the short, human-readable account of what changed between two
// versions of the same quotation — e.g. "Gate Valve DN80: unit price
// ₦165,000 → ₦150,000; Total ₦4,257,000 → ₦4,187,500." This is what turns a
// bare "vendor resubmitted" log line into something a reviewer can actually
// act on without re-reading every line item by hand. Used to fill in the
// RESUBMITTED history entry's `note` — see resubmitQuotation() below.
export function summarizeQuotationChanges(previous: Quotation, next: Quotation): string {
  const parts: string[] = [];

  for (const item of next.items) {
    const before = previous.items.find((i) => i.rfqItemId === item.rfqItemId);
    if (!before) {
      parts.push(`${item.name}: added`);
      continue;
    }

    const availabilityChanged = before.availability !== item.availability;
    const qtyChanged = before.offeredQuantity !== item.offeredQuantity;
    const priceChanged = before.unitPrice !== item.unitPrice;
    if (!availabilityChanged && !qtyChanged && !priceChanged) continue;

    if (availabilityChanged) {
      parts.push(`${item.name}: ${AVAILABILITY_LABEL[before.availability]} → ${AVAILABILITY_LABEL[item.availability]}`);
    } else if (item.availability === 'partial' && qtyChanged) {
      parts.push(
        `${item.name}: now offering ${item.offeredQuantity ?? 0} of ${item.quantity} (was ${before.offeredQuantity ?? 0})`,
      );
    } else if (priceChanged && item.unitPrice !== null) {
      const wasText = before.unitPrice !== null ? fmtMoney(before.unitPrice, next.currency) : 'unpriced';
      parts.push(`${item.name}: unit price ${wasText} → ${fmtMoney(item.unitPrice, next.currency)}`);
    } else {
      parts.push(`${item.name}: updated`);
    }
  }

  if (previous.total !== next.total) {
    parts.unshift(`Total ${fmtMoney(previous.total, previous.currency)} → ${fmtMoney(next.total, next.currency)}`);
  }

  return parts.length > 0 ? parts.join('; ') : 'Resubmitted with no changes to items.';
}

@Injectable({ providedIn: 'root' })
export class VendorService {

  private readonly baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';

  // BehaviorSubjects hold in-memory state, seeded empty and populated on first
  // load from the backend. All mutating methods update these subjects so
  // subscribers (components) react immediately without a second HTTP round-trip.
  private rfqs$$ = new BehaviorSubject<Rfq[]>([]);
  private quotations$$ = new BehaviorSubject<Quotation[]>([]);
  private lpos$$ = new BehaviorSubject<Lpo[]>([]);
  private invoices$$ = new BehaviorSubject<Invoice[]>([]);
  private documents$$ = new BehaviorSubject<VendorDocument[]>([]);
  private profile$$ = new BehaviorSubject<VendorProfile>(this.blankProfile());
  private templates$$ = new BehaviorSubject<DocumentTemplate[]>([]);

  readonly profile$ = this.profile$$.asObservable();
  readonly templates$ = this.templates$$.asObservable();
  readonly rfqs$ = this.rfqs$$.asObservable();
  readonly quotations$ = this.quotations$$.asObservable();
  readonly lpos$ = this.lpos$$.asObservable();
  readonly invoices$ = this.invoices$$.asObservable();
  readonly documents$ = this.documents$$.asObservable();

  private get vendorId(): string {
    return sessionStorage.getItem('userid') || '';
  }

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  constructor(private http: HttpClient) {}

  // ── Procurement ↔ vendor-portal bridge ──────────────────────────────────────
  // These methods are the seam between the procurement module and the vendor
  // portal. Procurement can push RFQs in through upsertExternalRfq() and read
  // Quotations back out through the snapshot getters — the BehaviorSubjects
  // serve as the shared in-process state.

  /** Procurement creates/updates an RFQ and it should appear here, in this vendor's inbox. */
  upsertExternalRfq(rfq: Rfq): void {
    const existing = this.rfqs$$.getValue();
    const idx = existing.findIndex((r) => r.id === rfq.id);
    if (idx === -1) {
      this.rfqs$$.next([rfq, ...existing]);
      return;
    }
    // Preserve isRead — procurement re-syncing an RFQ (e.g. after a status
    // change on its side) shouldn't un-read something the vendor already saw.
    const updated = [...existing];
    updated[idx] = { ...rfq, isRead: existing[idx].isRead };
    this.rfqs$$.next(updated);
  }

  /** Synchronous snapshots for services (procurement) that need to read this
   *  data inline rather than subscribing — always current since they share
   *  this same singleton instance. */
  getRfqsSnapshot(): Rfq[] {
    return this.rfqs$$.getValue();
  }
  getQuotationsSnapshot(): Quotation[] {
    return this.quotations$$.getValue();
  }
  getLposSnapshot(): Lpo[] {
    return this.lpos$$.getValue();
  }
  getInvoicesSnapshot(): Invoice[] {
    return this.invoices$$.getValue();
  }

  /** Buyer (procurement) opened this quotation for the first time. */
  markQuotationViewedByCustomer(id: string): void {
    const current = this.quotations$$.getValue().find((x) => x.id === id);
    if (!current || current.history.some((h) => h.action === 'VIEWED')) return;
    const entry: QuotationHistoryEntry = {
      id: `hist-${Date.now()}`,
      version: current.version,
      action: 'VIEWED',
      actor: 'CUSTOMER',
      timestamp: new Date(),
    };
    this.quotations$$.next(
      this.quotations$$.getValue().map((x) => (x.id === id ? { ...x, history: [...x.history, entry] } : x)),
    );
  }

  // ── RFQ ──────────────────────────────────────────────────────────────────────
  getRfqs(): Observable<Rfq[]> {
    this.loadRfqs();
    return this.rfqs$.pipe(
      map((l) => [...l].sort((a, b) => new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime())),
    );
  }

  markRfqAsRead(id: string): void {
    this.rfqs$$.next(this.rfqs$$.getValue().map((r) => (r.id === id ? { ...r, isRead: true } : r)));
    this.http.patch(`${this.baseUrl}/vendor-rfqs/${id}/mark-read`, {}).pipe(
      catchError((err) => { console.error('[VendorService] markRfqAsRead failed:', err); return of(null); }),
    ).subscribe();
  }

  rfqHasQuotation(rfqId: string): boolean {
    return this.quotations$$.getValue().some((q) => q.rfqId === rfqId);
  }

  loadRfqs(): void {
    const params = new HttpParams()
      .set('vendorId', this.vendorId)
      .set('page', '1')
      .set('size', '100');
    this.http.get<any>(`${this.baseUrl}/vendor-rfqs`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? res ?? [])),
      catchError((err) => { console.error('[VendorService] loadRfqs failed:', err); return of([] as Rfq[]); }),
    ).subscribe((rfqs) => this.rfqs$$.next(rfqs));
  }

  loadQuotations(): void {
    const params = new HttpParams()
      .set('vendorId', this.vendorId)
      .set('page', '1')
      .set('size', '100');
    this.http.get<any>(`${this.baseUrl}/vendor-quotations/`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? res ?? [])),
      catchError((err) => { console.error('[VendorService] loadQuotations failed:', err); return of([] as Quotation[]); }),
    ).subscribe((quotations) => this.quotations$$.next(quotations));
  }

  // ── Quotation ─────────────────────────────────────────────────────────────────
  getQuotations(): Observable<Quotation[]> {
    this.loadQuotations();
    return this.quotations$.pipe(
      map((l) => [...l].sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())),
    );
  }

  /** Local factory: builds a Quotation object from an Rfq without an API call.
   *  The resulting draft is then saved via createQuotation() → POST /vendor-quotations. */
  createQuotationFromRfq(rfq: Rfq): Quotation {
    const items: QuotationItem[] = rfq.items.map((item) => ({
      rfqItemId: item.id,
      name: item.name,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: null,
      totalPrice: null,
      availability: 'available' as ItemAvailability,
      offeredQuantity: null,
      exceptionNote: null,
      substituteDescription: null,
    }));
    const q: Quotation = {
      id: `quot-${Date.now()}`,
      quotationNumber: `QT-${new Date().getFullYear()}-${String(this.quotations$$.getValue().length + 1).padStart(3, '0')}`,
      rfqId: rfq.id,
      rfqNumber: rfq.rfqNumber,
      clientName: rfq.clientName,
      createdDate: new Date(),
      validUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      status: 'draft',
      items,
      subtotal: 0,
      tax: 0,
      total: 0,
      currency: rfq.currency,
      notes: '',
      vendorId: this.profile$$.getValue().id,
      vendorName: this.profile$$.getValue().companyName,
      vendorCode: this.profile$$.getValue().rcNumber,
      vendorRating: 4.6,
      version: 1,
      revisionCount: 0,
      includeSignature: true,
      history: [
        { id: `hist-${Date.now()}`, version: 1, action: 'CREATED', actor: 'VENDOR', timestamp: new Date() },
      ],
    };

    // Optimistically update local state; persist to backend
    this.quotations$$.next([q, ...this.quotations$$.getValue()]);
    this.rfqs$$.next(
      this.rfqs$$.getValue().map((r) => (r.id === rfq.id ? { ...r, status: 'converted' } : r)),
    );
    this.http.post<Quotation>(`${this.baseUrl}/vendor-quotations/`, q).pipe(
      tap((saved) => {
        // Replace the optimistic entry with the server-assigned record
        this.quotations$$.next(
          this.quotations$$.getValue().map((x) => (x.id === q.id ? saved : x)),
        );
      }),
      catchError((err) => { console.error('[VendorService] createQuotationFromRfq (POST) failed:', err); return of(null); }),
    ).subscribe();

    return q;
  }

  updateQuotation(q: Quotation): void {
    const recalculated = computeQuotationTotals(q);
    this.quotations$$.next(
      this.quotations$$.getValue().map((x) => (x.id === q.id ? recalculated : x)),
    );
    this.http.put<Quotation>(`${this.baseUrl}/vendor-quotations/${q.id}`, recalculated).pipe(
      catchError((err) => { console.error('[VendorService] updateQuotation failed:', err); return of(null); }),
    ).subscribe();
  }

  /** First submission — draft becomes visible to the client. */
  sendQuotation(id: string): void {
    let sentQuote: Quotation | undefined;
    this.quotations$$.next(
      this.quotations$$.getValue().map((q) => {
        if (q.id !== id) return q;
        const recalculated = computeQuotationTotals(q);
        const entry: QuotationHistoryEntry = {
          id: `hist-${Date.now()}`,
          version: recalculated.version,
          action: 'SUBMITTED',
          actor: 'VENDOR',
          total: recalculated.total,
          timestamp: new Date(),
        };
        sentQuote = {
          ...recalculated,
          status: 'sent' as const,
          sentDate: new Date(),
          history: [...recalculated.history, entry],
        };
        return sentQuote;
      }),
    );
    this.http.patch(`${this.baseUrl}/vendor-quotations/${id}/accept`, {}).pipe(
      catchError((err) => { console.error('[VendorService] sendQuotation failed:', err); return of(null); }),
    ).subscribe();
  }

  // ── Negotiation / revision cycle ────────────────────────────────────────────

  requestRevision(quotationId: string, note: string): { ok: boolean; reason?: string } {
    const current = this.quotations$$.getValue().find((x) => x.id === quotationId);
    if (!current) return { ok: false, reason: 'Quotation not found.' };
    if (current.status !== 'sent') {
      return { ok: false, reason: 'Only a submitted quotation awaiting a decision can be sent back for revision.' };
    }
    if (current.revisionCount >= MAX_REVISION_ROUNDS) {
      return {
        ok: false,
        reason: `This quotation has already been revised ${MAX_REVISION_ROUNDS} times. Please reach out to the vendor directly, or close/re-issue the RFQ.`,
      };
    }

    const entry: QuotationHistoryEntry = {
      id: `hist-${Date.now()}`,
      version: current.version,
      action: 'REVISION_REQUESTED',
      actor: 'CUSTOMER',
      note,
      timestamp: new Date(),
    };
    this.quotations$$.next(
      this.quotations$$.getValue().map((x) =>
        x.id === quotationId
          ? {
            ...x,
            status: 'revision_requested' as const,
            revisionRequestNote: note,
            revisionRequestedAt: new Date(),
            revisionCount: x.revisionCount + 1,
            history: [...x.history, entry],
          }
          : x,
      ),
    );
    this.http.patch(`${this.baseUrl}/vendor-quotations/${quotationId}/request-revision`, { note }).pipe(
      catchError((err) => { console.error('[VendorService] requestRevision failed:', err); return of(null); }),
    ).subscribe();
    return { ok: true };
  }

  acceptQuotation(quotationId: string, note?: string): { ok: boolean; reason?: string } {
    const current = this.quotations$$.getValue().find((x) => x.id === quotationId);
    if (!current) return { ok: false, reason: 'Quotation not found.' };
    if (current.status !== 'sent') {
      return { ok: false, reason: 'Only a submitted quotation awaiting a decision can be accepted.' };
    }

    const entry: QuotationHistoryEntry = {
      id: `hist-${Date.now()}`,
      version: current.version,
      action: 'ACCEPTED',
      actor: 'CUSTOMER',
      note,
      total: current.total,
      timestamp: new Date(),
    };
    const accepted: Quotation = { ...current, status: 'accepted', history: [...current.history, entry] };
    this.quotations$$.next(this.quotations$$.getValue().map((x) => (x.id === quotationId ? accepted : x)));
    this.http.patch(`${this.baseUrl}/vendor-quotations/${quotationId}/accept`, {}).pipe(
      catchError((err) => { console.error('[VendorService] acceptQuotation failed:', err); return of(null); }),
    ).subscribe();
    return { ok: true };
  }

  /**
   * Explicit, separate step: raise the LPO against an accepted quotation.
   * Idempotent — calling this again for a quotation that already has one
   * just returns the existing Lpo rather than creating a duplicate.
   */
  generateLpoForQuotation(quotationId: string): { ok: boolean; lpo?: Lpo; reason?: string } {
    const existing = this.lpos$$.getValue().find((l) => l.quotationId === quotationId);
    if (existing) return { ok: true, lpo: existing };

    const quotation = this.quotations$$.getValue().find((x) => x.id === quotationId);
    if (!quotation) return { ok: false, reason: 'Quotation not found.' };
    if (quotation.status !== 'accepted') {
      return { ok: false, reason: 'Only an accepted quotation can have an LPO generated for it.' };
    }

    this.http.patch<Lpo>(`${this.baseUrl}/vendor-quotations/${quotationId}/generate-lpo`, {}).pipe(
      tap((lpo) => {
        this.lpos$$.next([lpo, ...this.lpos$$.getValue()]);
        const entry: QuotationHistoryEntry = {
          id: `hist-${Date.now()}`,
          version: quotation.version,
          action: 'LPO_GENERATED',
          actor: 'SYSTEM',
          note: `LPO ${lpo.lpoNumber} generated.`,
          timestamp: new Date(),
        };
        this.quotations$$.next(
          this.quotations$$.getValue().map((x) => (x.id === quotationId ? { ...x, history: [...x.history, entry] } : x)),
        );
      }),
      catchError((err) => { console.error('[VendorService] generateLpoForQuotation failed:', err); return of(null); }),
    ).subscribe();

    // Return optimistic ok; lpo will be populated once the API responds
    return { ok: true };
  }

  rejectQuotation(quotationId: string, reason: string): { ok: boolean; reason?: string } {
    const current = this.quotations$$.getValue().find((x) => x.id === quotationId);
    if (!current) return { ok: false, reason: 'Quotation not found.' };
    if (current.status !== 'sent') {
      return { ok: false, reason: 'Only a submitted quotation awaiting a decision can be rejected.' };
    }

    const entry: QuotationHistoryEntry = {
      id: `hist-${Date.now()}`,
      version: current.version,
      action: 'REJECTED',
      actor: 'CUSTOMER',
      note: reason,
      timestamp: new Date(),
    };
    this.quotations$$.next(
      this.quotations$$.getValue().map((x) =>
        x.id === quotationId ? { ...x, status: 'rejected' as const, history: [...x.history, entry] } : x,
      ),
    );
    this.http.patch(`${this.baseUrl}/vendor-quotations/${quotationId}/decline`, { reason }).pipe(
      catchError((err) => { console.error('[VendorService] rejectQuotation failed:', err); return of(null); }),
    ).subscribe();
    return { ok: true };
  }

  /** Vendor's action: resubmit an updated quotation after a revision request. */
  resubmitQuotation(q: Quotation): void {
    const previous = this.quotations$$.getValue().find((x) => x.id === q.id);
    const recalculated = computeQuotationTotals(q);
    const newVersion = recalculated.version + 1;
    const entry: QuotationHistoryEntry = {
      id: `hist-${Date.now()}`,
      version: newVersion,
      action: 'RESUBMITTED',
      actor: 'VENDOR',
      total: recalculated.total,
      note: previous ? summarizeQuotationChanges(previous, recalculated) : undefined,
      timestamp: new Date(),
    };
    const updated: Quotation = {
      ...recalculated,
      version: newVersion,
      status: 'sent',
      sentDate: new Date(),
      revisionRequestNote: undefined,
      history: [...recalculated.history, entry],
    };
    this.quotations$$.next(this.quotations$$.getValue().map((x) => (x.id === q.id ? updated : x)));
    this.http.put<Quotation>(`${this.baseUrl}/vendor-quotations/${q.id}`, updated).pipe(
      catchError((err) => { console.error('[VendorService] resubmitQuotation (PUT) failed:', err); return of(null); }),
    ).subscribe();
  }

  /** Vendor pulls back a quotation that hasn't been decided on yet. */
  withdrawQuotation(id: string, reason?: string): void {
    this.quotations$$.next(
      this.quotations$$.getValue().map((x) => {
        if (x.id !== id) return x;
        const entry: QuotationHistoryEntry = {
          id: `hist-${Date.now()}`,
          version: x.version,
          action: 'WITHDRAWN',
          actor: 'VENDOR',
          note: reason,
          timestamp: new Date(),
        };
        return { ...x, status: 'withdrawn' as const, history: [...x.history, entry] };
      }),
    );
    this.http.put(`${this.baseUrl}/vendor-quotations/${id}`, { status: 'withdrawn', withdrawReason: reason }).pipe(
      catchError((err) => { console.error('[VendorService] withdrawQuotation failed:', err); return of(null); }),
    ).subscribe();
  }

  loadLpos(): void {
    const params = new HttpParams()
      .set('vendorId', this.vendorId)
      .set('page', '1')
      .set('size', '100');
    this.http.get<any>(`${this.baseUrl}/vendor-lpos`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? res ?? [])),
      catchError((err) => { console.error('[VendorService] loadLpos failed:', err); return of([] as Lpo[]); }),
    ).subscribe((lpos) => this.lpos$$.next(lpos));
  }

  // ── LPO ──────────────────────────────────────────────────────────────────────
  getLpos(): Observable<Lpo[]> {
    this.loadLpos();
    return this.lpos$.pipe(
      map((l) => [...l].sort((a, b) => new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime())),
    );
  }

  markLpoAsRead(id: string): void {
    this.lpos$$.next(this.lpos$$.getValue().map((l) => (l.id === id ? { ...l, isRead: true } : l)));
    this.http.patch(`${this.baseUrl}/vendor-lpos/${id}/mark-read`, {}).pipe(
      catchError((err) => { console.error('[VendorService] markLpoAsRead failed:', err); return of(null); }),
    ).subscribe();
  }

  acceptLpo(id: string): void {
    this.lpos$$.next(
      this.lpos$$.getValue().map((l) => (l.id === id ? { ...l, status: 'accepted' as const } : l)),
    );
    this.http.patch(`${this.baseUrl}/vendor-lpos/${id}/accept`, {}).pipe(
      catchError((err) => { console.error('[VendorService] acceptLpo failed:', err); return of(null); }),
    ).subscribe();
  }

  rejectLpo(id: string, reason: string): void {
    this.lpos$$.next(
      this.lpos$$.getValue().map((l) =>
        l.id === id ? { ...l, status: 'rejected' as const, rejectionReason: reason } : l,
      ),
    );
    this.http.patch(`${this.baseUrl}/vendor-lpos/${id}/reject`, { rejectionReason: reason }).pipe(
      catchError((err) => { console.error('[VendorService] rejectLpo failed:', err); return of(null); }),
    ).subscribe();
  }

  // How much of each LPO line item has already been invoiced, across every
  // invoice raised against that LPO (any status — a draft invoice still
  // claims the quantity so two drafts can't both bill the same units).
  // Keyed by lpoItemId; lines a vendor added manually (no lpoItemId) aren't included.
  getInvoicedQuantities(lpoId: string): Record<string, number> {
    const out: Record<string, number> = {};
    for (const inv of this.invoices$$.getValue()) {
      if (inv.lpoId !== lpoId) continue;
      for (const item of inv.items) {
        if (!item.lpoItemId) continue;
        out[item.lpoItemId] = (out[item.lpoItemId] ?? 0) + item.quantity;
      }
    }
    return out;
  }

  // Vendor's action: raise an invoice (optionally against an LPO). Persists it
  // via POST /vendor-invoices and, if every LPO line is now fully billed,
  // marks that LPO fulfilled.
  createInvoice(invoice: Invoice): Invoice {
    this.invoices$$.next([invoice, ...this.invoices$$.getValue()]);

    if (invoice.lpoId) {
      const lpo = this.lpos$$.getValue().find((l) => l.id === invoice.lpoId);
      if (lpo) {
        const invoicedNow = this.getInvoicedQuantities(lpo.id);
        const fullyBilled = lpo.items.every((li) => (invoicedNow[li.id] ?? 0) >= li.quantity);
        if (fullyBilled && lpo.status !== 'fulfilled') {
          this.lpos$$.next(
            this.lpos$$.getValue().map((l) => (l.id === lpo.id ? { ...l, status: 'fulfilled' as const } : l)),
          );
          this.http.patch(`${this.baseUrl}/vendor-lpos/${lpo.id}/mark-fulfilled`, {}).pipe(
            catchError((err) => { console.error('[VendorService] markLpoFulfilled failed:', err); return of(null); }),
          ).subscribe();
        }
      }
    }

    this.http.post<Invoice>(`${this.baseUrl}/vendor-invoices`, invoice).pipe(
      tap((saved) => {
        this.invoices$$.next(
          this.invoices$$.getValue().map((x) => (x.id === invoice.id ? saved : x)),
        );
      }),
      catchError((err) => { console.error('[VendorService] createInvoice failed:', err); return of(null); }),
    ).subscribe();

    return invoice;
  }

  // ── Finance ───────────────────────────────────────────────────────────────────
  getInvoices(): Observable<Invoice[]> {
    const params = new HttpParams()
      .set('vendorId', this.vendorId)
      .set('page', '1')
      .set('size', '100');
    this.http.get<any>(`${this.baseUrl}/vendor-invoices`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? res ?? [])),
      catchError((err) => { console.error('[VendorService] getInvoices failed:', err); return of([] as Invoice[]); }),
    ).subscribe((invoices) => this.invoices$$.next(invoices));

    return this.invoices$.pipe(
      map((l) => [...l].sort((a, b) => new Date(b.issuedDate).getTime() - new Date(a.issuedDate).getTime())),
    );
  }

  getFinanceStats(): Observable<FinanceStats> {
    return this.http.get<FinanceStats>(`${this.baseUrl}/vendor-invoices/stats`, {
      params: new HttpParams().set('vendorId', this.vendorId),
    }).pipe(
      catchError((err) => {
        console.error('[VendorService] getFinanceStats failed:', err);
        // Derive stats from local BehaviorSubject state as fallback
        const invoices = this.invoices$$.getValue();
        const paid = invoices.filter((i) => i.status === 'paid');
        const overdue = invoices.filter((i) => i.status === 'overdue');
        const pending = invoices.filter((i) => i.status === 'submitted' || i.status === 'approved');
        const avgPaymentDays =
          paid.length > 0
            ? Math.round(
              paid.reduce((s, i) => {
                const days = i.paidDate
                  ? (new Date(i.paidDate).getTime() - new Date(i.issuedDate).getTime()) / (1000 * 60 * 60 * 24)
                  : 0;
                return s + days;
              }, 0) / paid.length,
            )
            : 0;
        return of({
          totalInvoiced: invoices.reduce((s, i) => s + i.total, 0),
          totalPaid: paid.reduce((s, i) => s + i.total, 0),
          totalOutstanding: pending.reduce((s, i) => s + i.amountOutstanding, 0),
          totalOverdue: overdue.reduce((s, i) => s + i.amountOutstanding, 0),
          invoiceCount: invoices.length,
          paidCount: paid.length,
          overdueCount: overdue.length,
          pendingCount: pending.length,
          avgPaymentDays,
          recentPayments: [],
        } as FinanceStats);
      }),
    );
  }

  // ── Documents ─────────────────────────────────────────────────────────────────
  getDocuments(): Observable<VendorDocument[]> {
    return this.documents$.pipe(
      map((l) => [...l].sort((a, b) => new Date(b.uploadedDate).getTime() - new Date(a.uploadedDate).getTime())),
    );
  }

  getDocumentStats(): Observable<DocumentStats> {
    const docs = this.documents$$.getValue();
    return of({
      total: docs.length,
      active: docs.filter((d) => d.status === 'active').length,
      expiringSoon: docs.filter((d) => d.status === 'expiring_soon').length,
      expired: docs.filter((d) => d.status === 'expired').length,
      pendingReview: docs.filter((d) => d.status === 'pending_review').length,
    });
  }

  uploadDocument(vendorId: string, doc: Omit<VendorDocument, 'id' | 'uploadedDate' | 'status'>): Observable<VendorDocument> {
    const payload = { ...doc, vendorId };
    return this.http.post<VendorDocument>(`${this.baseUrl}/vendors/${vendorId}/documents`, payload).pipe(
      tap((saved) => this.documents$$.next([saved, ...this.documents$$.getValue()])),
      catchError((err) => { console.error('[VendorService] uploadDocument failed:', err); return of(null as any); }),
    );
  }

  deleteDocument(id: string): void {
    this.documents$$.next(this.documents$$.getValue().filter((d) => d.id !== id));
    this.http.delete(`${this.baseUrl}/vendors/documents/${id}`).pipe(
      catchError((err) => { console.error('[VendorService] deleteDocument failed:', err); return of(null); }),
    ).subscribe();
  }

  // ── Vendor Profile ─────────────────────────────────────────────────────────────
  getProfile(): Observable<VendorProfile> {
    const vendorId = this.vendorId;
    if (vendorId) {
      this.http.get<VendorProfile>(`${this.baseUrl}/vendor-profiles/${vendorId}`).pipe(
        tap((profile) => { if (profile) this.profile$$.next(profile); }),
        catchError((err) => { console.error('[VendorService] getProfile failed:', err); return of(null); }),
      ).subscribe();
    }
    return this.profile$;
  }

  updateProfile(patch: Partial<VendorProfile>): void {
    const updated = { ...this.profile$$.getValue(), ...patch };
    this.profile$$.next(updated);
    const vendorId = this.vendorId;
    if (vendorId) {
      this.http.put(`${this.baseUrl}/vendor-profiles/${vendorId}`, updated).pipe(
        catchError((err) => { console.error('[VendorService] updateProfile failed:', err); return of(null); }),
      ).subscribe();
    }
  }

  // ── Document Templates (branding) ────────────────────────────────────────────
  getTemplates(docType?: TemplateDocType): Observable<DocumentTemplate[]> {
    const params = new HttpParams().set('vendorId', this.vendorId);
    const url = `${this.baseUrl}/document-templates`;
    this.http.get<DocumentTemplate[]>(url, { params: docType ? params.set('docType', docType) : params }).pipe(
      tap((list) => this.templates$$.next(list)),
      catchError((err) => { console.error('[VendorService] getTemplates failed:', err); return of([] as DocumentTemplate[]); }),
    ).subscribe();

    return this.templates$.pipe(
      map((list) => (docType ? list.filter((t) => t.docType === docType) : list)),
    );
  }

  getActiveTemplate(docType: TemplateDocType): Observable<DocumentTemplate | undefined> {
    return this.templates$.pipe(
      map((list) => list.find((t) => t.docType === docType && t.isActive)),
    );
  }

  saveTemplate(
    template: Omit<DocumentTemplate, 'id' | 'updatedDate'>,
    id?: string,
  ): DocumentTemplate {
    const list = this.templates$$.getValue();
    const now = new Date();

    if (id) {
      const payload = { ...template, updatedDate: now };
      const updated = list.map((t) => (t.id === id ? { ...t, ...payload } : t));
      this.templates$$.next(updated);
      this.http.put(`${this.baseUrl}/document-templates/${id}`, payload).pipe(
        catchError((err) => { console.error('[VendorService] saveTemplate (PUT) failed:', err); return of(null); }),
      ).subscribe();
      return updated.find((t) => t.id === id)!;
    }

    const newTemplate: DocumentTemplate = {
      ...template,
      id: `tmpl-${Date.now()}`,
      updatedDate: now,
    };
    this.templates$$.next([...list, newTemplate]);
    this.http.post<DocumentTemplate>(`${this.baseUrl}/document-templates`, newTemplate).pipe(
      tap((saved) => {
        this.templates$$.next(
          this.templates$$.getValue().map((t) => (t.id === newTemplate.id ? saved : t)),
        );
      }),
      catchError((err) => { console.error('[VendorService] saveTemplate (POST) failed:', err); return of(null); }),
    ).subscribe();
    return newTemplate;
  }

  setActiveTemplate(id: string, docType: TemplateDocType): void {
    const list = this.templates$$.getValue().map((t) => (t.docType === docType ? { ...t, isActive: t.id === id } : t));
    this.templates$$.next(list);
    this.http.patch(`${this.baseUrl}/document-templates/${id}/activate`, {}).pipe(
      catchError((err) => { console.error('[VendorService] setActiveTemplate failed:', err); return of(null); }),
    ).subscribe();
  }

  deleteTemplate(id: string): void {
    this.templates$$.next(this.templates$$.getValue().filter((t) => t.id !== id));
    this.http.delete(`${this.baseUrl}/document-templates/${id}`).pipe(
      catchError((err) => { console.error('[VendorService] deleteTemplate failed:', err); return of(null); }),
    ).subscribe();
  }

  // ── Performance ───────────────────────────────────────────────────────────────
  getPerformanceStats(): Observable<PerformanceStats> {
    return this.http.get<PerformanceStats>(`${this.baseUrl}/vendor-dashboard/performance`, {
      params: new HttpParams().set('vendorId', this.vendorId),
    }).pipe(
      catchError((err) => {
        console.error('[VendorService] getPerformanceStats failed:', err);
        return of(this.buildPerformanceStats());
      }),
    );
  }

  // ── Shared vendor stats ───────────────────────────────────────────────────────
  getVendorStats(): Observable<VendorStats> {
    return this.http.get<VendorStats>(`${this.baseUrl}/vendor-dashboard/stats`, {
      params: new HttpParams().set('vendorId', this.vendorId),
    }).pipe(
      catchError((err) => {
        console.error('[VendorService] getVendorStats failed:', err);
        const rfqs = this.rfqs$$.getValue();
        const quotations = this.quotations$$.getValue();
        const now = new Date();
        const threeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        const accepted = quotations.filter((q) => q.status === 'accepted').length;
        const sent = quotations.filter((q) => q.status === 'sent').length;
        return of({
          totalRfqs: rfqs.length,
          unreadRfqs: rfqs.filter((r) => !r.isRead).length,
          openRfqs: rfqs.filter((r) => r.status === 'open').length,
          totalQuotations: quotations.length,
          draftQuotations: quotations.filter((q) => q.status === 'draft').length,
          sentQuotations: sent,
          acceptedQuotations: accepted,
          revisionRequestedQuotations: quotations.filter((q) => q.status === 'revision_requested').length,
          conversionRate: sent + accepted > 0 ? Math.round((accepted / (sent + accepted)) * 100) : 0,
          pendingResponseDueSoon: rfqs.filter(
            (r) => r.status === 'open' && r.dueDate >= now && r.dueDate <= threeDays,
          ).length,
        } as VendorStats);
      }),
    );
  }

  getLpoStats(): Observable<LpoStats> {
    return this.http.get<LpoStats>(`${this.baseUrl}/vendor-dashboard/lpo-stats`, {
      params: new HttpParams().set('vendorId', this.vendorId),
    }).pipe(
      catchError((err) => {
        console.error('[VendorService] getLpoStats failed:', err);
        const lpos = this.lpos$$.getValue();
        return of({
          total: lpos.length,
          pending: lpos.filter((l) => l.status === 'pending').length,
          accepted: lpos.filter((l) => l.status === 'accepted').length,
          rejected: lpos.filter((l) => l.status === 'rejected').length,
          fulfilled: lpos.filter((l) => l.status === 'fulfilled').length,
          unread: lpos.filter((l) => !l.isRead).length,
          totalValue: lpos
            .filter((l) => l.status === 'accepted' || l.status === 'fulfilled')
            .reduce((s, l) => s + l.total, 0),
        } as LpoStats);
      }),
    );
  }

  getApprovedVendors(): Observable<any[]> {
    return of([]);
  }

  getLposByVendorId(vendorId: string | number): Observable<any[]> {
    const params = new HttpParams().set('vendorId', String(vendorId)).set('page', '1').set('size', '100');
    return this.http.get<any>(`${this.baseUrl}/vendor-lpos`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? res ?? [])),
      catchError(() => of([])),
    );
  }

  getInvoicesByVendorId(vendorId: string | number): Observable<any[]> {
    const params = new HttpParams().set('vendorId', String(vendorId)).set('page', '1').set('size', '100');
    return this.http.get<any>(`${this.baseUrl}/vendor-invoices`, { params }).pipe(
      map(res => Array.isArray(res) ? res : (res?.data ?? res ?? [])),
      catchError(() => of([])),
    );
  }

  /** Dev tooling: clears in-memory state so a fresh reload re-fetches from backend. */
  resetDemoData(): void {
    this.rfqs$$.next([]);
    this.quotations$$.next([]);
    this.lpos$$.next([]);
    this.invoices$$.next([]);
    this.documents$$.next([]);
    this.profile$$.next(this.blankProfile());
    this.templates$$.next([]);
  }

  // ── Private helpers ───────────────────────────────────────────────────────────
  private resolveDocStatus(expiry?: Date): VendorDocument['status'] {
    if (!expiry) return 'active';
    const now = new Date();
    const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    if (expiry < now) return 'expired';
    if (expiry <= thirtyDays) return 'expiring_soon';
    return 'active';
  }

  private blankProfile(): VendorProfile {
    return {
      id: '',
      companyName: '',
      tradingName: '',
      rcNumber: '',
      taxId: '',
      category: '',
      additionalCategories: [],
      email: '',
      phone: '',
      address: '',
      city: '',
      state: '',
      country: '',
      contactPersonName: '',
      contactPersonRole: '',
      bankDetails: { bankName: '', accountName: '', accountNumber: '', sortCode: '' },
      verificationStatus: 'pending',
      memberSince: new Date(),
    } as unknown as VendorProfile;
  }

  private buildPerformanceStats(): PerformanceStats {
    return {
      avgRfqResponseHours: 0,
      rfqResponseRate: 0,
      quotationAcceptanceRate: 0,
      onTimeDeliveryRate: 0,
      totalRevenueYtd: 0,
      totalRevenueAllTime: 0,
      revenueGrowthPct: 0,
      totalRfqsReceived: 0,
      totalQuotationsSubmitted: 0,
      totalLposAccepted: 0,
      totalLposFulfilled: 0,
      overallRating: 0,
      monthlyMetrics: [],
      topClients: [],
    };
  }
}
