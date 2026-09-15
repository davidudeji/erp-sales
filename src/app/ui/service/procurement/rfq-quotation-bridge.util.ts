/**
 * ───────────────────────────────────────────────────────────────────────
 * Procurement ↔ vendor-portal bridge
 * ───────────────────────────────────────────────────────────────────────
 * The request-management (procurement) module and the vendor portal are two
 * different personas over what should be *one* shared backend. In this demo
 * that shared backend is simulated by VendorService (vendor.dto.ts's Rfq /
 * Quotation / Lpo, persisted under the 'erp_sim:v1:shared:*' localStorage
 * keys — see service/vendor-portal/local-store.util.ts).
 *
 * Procurement's own domain models (ProcurementRequest / VendorQuotation in
 * procurement.dto.ts) are richer and shaped differently — approval workflow,
 * RFQ templates, budget fields, multi-vendor targeting, etc. — none of which
 * the vendor side needs to know about. Rather than rewrite either side's
 * DTOs (which would ripple through every component using them), this module
 * is the seam: it converts one shape into the other at the two points of
 * contact —
 *
 *   1. Procurement sends an RFQ out to vendors  → mirrored into VendorService
 *      as an Rfq, so it shows up in the vendor's RFQ inbox.
 *   2. The vendor submits/updates a Quotation    → read back here as a
 *      VendorQuotation, so it shows up in procurement's quotation lists,
 *      merged alongside procurement's own (non-shared, demo) quotations.
 *
 * A live-linked VendorQuotation's `id` is prefixed ("live:quot-123") so
 * QuotationManagementService can tell, just from the id a component hands
 * back to it, whether a given action (accept/decline/request changes)
 * should be routed to the real shared record (via VendorService — reusing
 * its revision-cap/history logic rather than duplicating it) or handled
 * against procurement's own local seed data as before.
 */

import {
  ProcurementRequest,
  RequestStatus,
  VendorQuotation,
  QuotationItemDetail,
  QuotationHistoryEntry as ProcHistoryEntry,
  QuotationHistoryAction as ProcHistoryAction,
  VendorQuotationStatus,
  RFQAttachment,
} from '../../domain/procurement-request/procurement.dto';
import {
  Rfq,
  RfqItem,
  RfqStatus,
  Quotation,
  QuotationHistoryEntry as SharedHistoryEntry,
  QuotationHistoryAction as SharedHistoryAction,
  ItemAvailability,
} from '../../domain/vendor-portal/vendor.dto';

export interface ExtendedProcurementRequest extends ProcurementRequest {
  selectedVendors?: string[];
  deliveryLocation?: string;
  deliveryDeadline?: Date;
  attachments?: RFQAttachment[];
  rfqTemplateId?: string;
  selectedLpoId?: string | number;
  selectedLpoNumber?: string;
}

export function parseIdToNumber(id: any): number {
  if (id === null || id === undefined) return 0;
  if (typeof id === 'number') return id;
  const idStr = String(id);
  const match = idStr.match(/\d+/);
  return match ? parseInt(match[0], 10) : 0;
}

export const LIVE_ID_PREFIX = 'live:';

export function isLiveQuotationId(id: string | number): boolean {
  return String(id).startsWith(LIVE_ID_PREFIX);
}
export function toLiveId(sharedId: string): string {
  return `${LIVE_ID_PREFIX}${sharedId}`;
}
export function fromLiveId(liveId: string | number): string {
  return String(liveId).slice(LIVE_ID_PREFIX.length);
}

// Request statuses at or beyond this point mean vendors have been (or are
// about to be) invited — anything earlier (DRAFT / PENDING / PENDING_APPROVAL
// / REJECTED / a request cancelled before ever being sent) has no business
// on the vendor's side yet.
const VENDOR_VISIBLE_STATUSES: ReadonlySet<RequestStatus> = new Set<RequestStatus>([
  'APPROVED',
  'VENDORS_QUOTING',
  'VENDOR_SELECTED',
  'LPO_ISSUED',
  'PAYMENT_PENDING',
  'PAYMENT_CONFIRMED',
  'DELIVERY_IN_PROGRESS',
  'DELIVERED',
]);

export function requestIsVendorVisible(status: RequestStatus): boolean {
  return VENDOR_VISIBLE_STATUSES.has(status);
}

function mapRequestStatusToRfqStatus(req: ProcurementRequest): RfqStatus {
  if (req.status === 'CANCELLED' || req.status === 'REJECTED') return 'closed';
  if (
    req.rfqExpiryDate &&
    new Date(req.rfqExpiryDate).getTime() < Date.now() &&
    (req.status === 'VENDORS_QUOTING' || req.status === 'APPROVED')
  ) {
    return 'expired';
  }
  if (req.status === 'VENDORS_QUOTING' || req.status === 'APPROVED') return 'open';
  // VENDOR_SELECTED and everything after it means a quotation was accepted.
  return 'converted';
}

/** Buyer's RFQ → the shape the vendor portal reads. Same `id` as the source
 *  ProcurementRequest, so a Quotation's `rfqId` joins straight back to it. */
export function procurementRequestToRfq(req: ProcurementRequest): Rfq {
  const items: RfqItem[] = req.items.map((item) => ({
    id: String(item.id),
    name: item.name,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    specifications: item.specifications ? JSON.stringify(item.specifications) : undefined,
  }));

  return {
    id: String(req.id),
    rfqNumber: `RFQ-${req.id}`,
    clientName: req.customerName,
    issuedDate: req.createdAt,
    dueDate: req.rfqExpiryDate ?? new Date(),
    status: mapRequestStatusToRfqStatus(req),
    isRead: false, // VendorService.upsertExternalRfq() preserves the real flag if this Rfq already exists
    items,
    clientInstructions: req.specialInstructions,
    deliveryAddress: undefined,
    currency: req.currency,
    category:
      req.serviceCategory ??
      (req.procurementType === 'SERVICE' ? 'Services' : 'General Procurement'),
    totalEstimatedValue: req.totalBudget,
  };
}

// ── Quotation: shared (vendor.dto) → procurement's VendorQuotation ─────────

const ITEM_AVAILABILITY_TO_PROCUREMENT: Record<
  ItemAvailability,
  QuotationItemDetail['availability']
> = {
  available: 'AVAILABLE',
  partial: 'PARTIAL',
  substitute: 'SUBSTITUTE',
  unavailable: 'UNAVAILABLE',
};

const HISTORY_ACTION_TO_PROCUREMENT: Record<SharedHistoryAction, ProcHistoryAction> = {
  CREATED: 'CREATED',
  SUBMITTED: 'SUBMITTED',
  VIEWED: 'VIEWED',
  REVISION_REQUESTED: 'REVIEW_REQUESTED',
  RESUBMITTED: 'RESUBMITTED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'DECLINED',
  WITHDRAWN: 'WITHDRAWN',
  LPO_GENERATED: 'LPO_GENERATED',
  LPO_SENT: 'LPO_SENT',
  STATUS_CHANGED: 'STATUS_CHANGED',
};

function mapSharedStatus(q: Quotation, hasLpo: boolean): VendorQuotationStatus {
  switch (q.status) {
    case 'sent':
      return new Date(q.validUntil).getTime() < Date.now() ? 'EXPIRED' : 'SUBMITTED';
    case 'revision_requested':
      return 'REVIEW_REQUESTED';
    case 'accepted':
      return hasLpo ? 'LPO_SENT' : 'ACCEPTED';
    case 'rejected':
      return 'DECLINED';
    case 'withdrawn':
      return 'WITHDRAWN';
    case 'draft':
    default:
      // Callers filter draft quotations out before this is ever reached —
      // see sharedQuotationsForRfq() below — but fall back sensibly if not.
      return 'PENDING';
  }
}

export function sharedQuotationToVendorQuotation(
  q: Quotation,
  hasLpo: boolean,
  rfqTitle?: string,
  requests: ProcurementRequest[] = [],
): VendorQuotation {
  const declineEntry = [...q.history].reverse().find((h) => h.action === 'REJECTED');
  const lastEntry = q.history[q.history.length - 1];
  const matchingRequest = requests.find((r) => String(r.id) === String(q.rfqId));

  const result: any = {
    id: toLiveId(q.id) as any,
    rfqId: q.rfqId,
    rfqTitle: rfqTitle ?? (matchingRequest ? matchingRequest.title : q.rfqNumber),
    vendorId: q.vendorId ?? 'vendor-001',
    vendorName: q.vendorName ?? 'Connected Vendor',
    vendorCode: q.vendorCode ?? 'VEN-LIVE',
    vendorRating: q.vendorRating ?? 4.5,
    quotationId: q.id,
    status: mapSharedStatus(q, hasLpo),
    items: q.items.map((item) => {
      const origItem = matchingRequest?.items.find((i) => String(i.id) === String(item.rfqItemId));
      return {
        id: parseIdToNumber(item.rfqItemId) as any,
        name: origItem ? origItem.name : item.name,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice ?? 0,
        totalPrice: item.totalPrice ?? 0,
        availability: ITEM_AVAILABILITY_TO_PROCUREMENT[item.availability],
        alternativeProduct: item.substituteDescription ?? undefined,
        availableQuantity: item.offeredQuantity ?? undefined,
        notes: item.exceptionNote ?? undefined,
      };
    }),
    totalAmount: q.total,
    currency: q.currency,
    deliveryTimeline: 'Per vendor terms',
    validityDays: Math.max(
      0,
      Math.round(
        (new Date(q.validUntil).getTime() - new Date(q.createdDate).getTime()) / 86_400_000,
      ),
    ),
    termsAndConditions: undefined,
    notes: q.notes,
    declineReason: declineEntry?.note,
    revisionRequestNote: q.revisionRequestNote,
    submittedAt: q.sentDate,
    updatedAt: lastEntry?.timestamp ?? q.createdDate,
    expiresAt: q.validUntil,
    isViewed: q.history.some((h) => h.action === 'VIEWED'),
    version: q.version,
    revisionCount: q.revisionCount,
    revisionRequestedAt: q.revisionRequestedAt,
  };

  result.history = q.history.map((entry) => ({
    id: parseIdToNumber(entry.id),
    version: entry.version,
    action: HISTORY_ACTION_TO_PROCUREMENT[entry.action],
    actor: entry.actor,
    note: entry.note,
    amount: entry.total,
    timestamp: entry.timestamp,
    quoteId: result,
  }));

  return result as VendorQuotation;
}
