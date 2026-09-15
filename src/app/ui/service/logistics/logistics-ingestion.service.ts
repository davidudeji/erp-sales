// logistics-ingestion.service.ts
// ============================================================
// COMMERCE → LOGISTICS HANDOFF (self-contained, owned entirely by
// Logistics — no changes needed anywhere in Sales).
//
// Per Optimax_Logistics_Models_v4 §4: the moment a sales order's status
// hits PAYMENT_COMPLETED, Logistics should pull it once and create its
// own OrderDTO snapshot. Rather than hooking into whichever screen in
// Sales happens to flip that status (fragile — misses any other path
// to PAYMENT_COMPLETED: a different screen, a direct API call, a future
// integration), this polls Commerce's own `sales-orders` list endpoint
// directly from the Logistics side and ingests anything new it finds.
//
// This uses SalesService.getSalesandTransactions() — a real, existing,
// public method already used elsewhere in Sales — purely as a read.
// Nothing in the Sales module is modified or depended on beyond that.
//
// Start this watcher once, e.g. from the logistics shell/dashboard
// component's ngOnInit:
//
//   constructor(private ingestion: LogisticsIngestionService) {}
//   ngOnInit() { this.ingestion.start(); }
//   ngOnDestroy() { this.ingestion.stop(); }
//
// ============================================================

import { Injectable, OnDestroy } from '@angular/core';
import { Subscription, timer } from 'rxjs';
import { switchMap, catchError, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { SalesService } from '../sales/sales.service';
import { SalesandTransactions } from '../../domain/sales/sales.dto';
import { LogisticsService } from './logistics.service';
import { ApiIngestPayload, ApiOrderItem } from '../../domain/logistics/logistics.dto';

@Injectable({
  providedIn: 'root'
})
export class LogisticsIngestionService implements OnDestroy {
  private pollSub?: Subscription;

  /** orderIds already confirmed present in (or just pushed to) Logistics this session,
   *  so repeated polls don't re-check/re-ingest the same order over and over. */
  private readonly seen = new Set<string>();

  constructor(private salesService: SalesService, private logisticsService: LogisticsService) {}

  ngOnDestroy(): void {
    this.stop();
  }

  /** Begin polling Commerce for newly-paid orders every `intervalMs`. Safe to call once. */
  start(intervalMs: number = 30000): void {
    if (this.pollSub) return; // already running
    this.pollSub = timer(0, intervalMs)
      .pipe(
        switchMap(() => this.salesService.getSalesandTransactions({ status: 'PAYMENT_COMPLETED', page: 0, size: 100 })),
        catchError(() => of({ data: [] as SalesandTransactions[], total: 0 })),
        switchMap((res) => this.ingestUnseen(res.data || []))
      )
      .subscribe();
  }

  stop(): void {
    this.pollSub?.unsubscribe();
    this.pollSub = undefined;
  }

  /** One-off sweep, e.g. for a manual "sync now" button — returns how many orders were ingested. */
  runOnce() {
    return this.salesService.getSalesandTransactions({ status: 'PAYMENT_COMPLETED', page: 0, size: 100 }).pipe(
      catchError(() => of({ data: [] as SalesandTransactions[], total: 0 })),
      switchMap((res) => this.ingestUnseen(res.data || []))
    );
  }

  private ingestUnseen(paidOrders: SalesandTransactions[]) {
    const candidates = paidOrders.filter((tx) => tx.orderId && !this.seen.has(tx.orderId));
    if (!candidates.length) return of(0);

    let ingestedCount = 0;
    const checks = candidates.map((tx) =>
      // Idempotency: Logistics keeps orderId identical to Commerce's (per spec),
      // so a lookup there is the real source of truth for "already ingested" —
      // not just this session's in-memory `seen` set, which only guards against
      // re-checking the same order on every poll tick.
      this.logisticsService.getOrderDetail(tx.orderId).pipe(
        switchMap((existing) => {
          this.seen.add(tx.orderId);
          if (existing) return of(false);
          return this.logisticsService.ingestOrderFromCommerce(this.toIngestPayload(tx)).pipe(
            tap(() => ingestedCount++),
            switchMap(() => of(true)),
            catchError((err) => {
              // Leave it out of `seen` so the next poll retries it.
              this.seen.delete(tx.orderId);
              console.error(`Logistics ingestion failed for order ${tx.orderId}:`, err);
              return of(false);
            })
          );
        }),
        catchError(() => of(false))
      )
    );

    // Run sequentially rather than forkJoin — keeps this gentle on both
    // APIs when there's a backlog, rather than firing 100 requests at once.
    return checks.reduce(
      (chain$, next$) => chain$.pipe(switchMap(() => next$)),
      of(true)
    ).pipe(switchMap(() => of(ingestedCount)));
  }

  private toIngestPayload(tx: SalesandTransactions): ApiIngestPayload {
    return {
      orderId: tx.orderId,
      customerName: this.resolveCustomerName(tx),
      items: this.resolveOrderItems(tx),
      shippingAddress: tx.shippingAddress || tx.billingAddress || '',
      deliveryNote: tx.customerNotes || tx.transactionNotes || undefined
      // expectedReceiverName / expectedReceiverPhone: no source field exists
      // anywhere on SalesandTransactions or its nested Quote/Customer —
      // Logistics needs to collect these itself (e.g. at routing/claim time).
    };
  }

  // `SalesandTransactions.customerName` is typed as `Customer`, not a
  // string, in the dto — read whichever shape actually shows up at
  // runtime rather than trusting the declared type.
  private resolveCustomerName(tx: SalesandTransactions): string {
    const c: any = tx.customerName ?? tx.customerId;
    if (!c) return '';
    return typeof c === 'string' ? c : (c.name || '');
  }

  // `SalesandTransactions.items` is typed as `Quote` (a single object) in
  // the dto, which looks like a copy/paste mistake — the real line items
  // live on `Quote.items: QuoteItem[]`. Pull from `quoteId.items` first,
  // and fall back to `items` in case it holds an array at runtime despite
  // its declared type.
  private resolveOrderItems(tx: SalesandTransactions): ApiOrderItem[] {
    const fromQuote: any[] = (tx.quoteId as any)?.items;
    const fromItemsField: any[] = Array.isArray(tx.items) ? (tx.items as any) : (tx.items as any)?.items;
    const source: any[] = fromQuote || fromItemsField || [];
    return source.map((i) => ({
      id: i.id,
      name: i.productName || i.name || 'Item',
      quantity: i.quantity || 1,
      note: i.description || undefined
    }));
  }
}
