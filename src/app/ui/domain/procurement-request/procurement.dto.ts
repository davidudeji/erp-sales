// procurement.dto.ts
// Constants
export const MAX_QUOTATION_REVISIONS = 3;

// Enums
export type RequestStatus =
  | 'PENDING'             // Initial request state, waiting for procurement team processing
  | 'VENDORS_QUOTING'     // RFQ is active and open for selected vendors to submit pricing quotations
  | 'PENDING_VENDOR_QUOTES'// RFQ is active and awaiting vendor quotations
  | 'VENDOR_SELECTED'     // A specific vendor quotation has been approved and accepted by the buyer
  | 'LPO_ISSUED'          // A Local Purchase Order (LPO) has been generated and officially sent to the vendor
  | 'PAYMENT_PENDING'     // Fulfillment is complete, awaiting final invoice settlement authorization
  | 'PAYMENT_CONFIRMED'   // Payment has been successfully released and confirmed for this request
  | 'DELIVERY_IN_PROGRESS'// Vendor is in the process of shipping/delivering goods or executing services
  | 'DELIVERED'           // Procurement items have been fully received and verified at the destination
  | 'COMPLETED'           // Delivery confirmed, vendor reviewed, procurement lifecycle fully closed
  | 'CANCELLED'           // The request has been cancelled/aborted by the procurement department
  | 'DRAFT'               // Draft request saved locally by the initiator before formal submission
  | 'PENDING_APPROVAL'    // Awaiting internal managerial approval or review board authorization
  | 'REJECTED'            // Rejected by internal manager/approver during the review phase
  | 'APPROVED';           // Approved internally, ready to be sent to vendor portal


export type ProcurementType =
  | 'PRODUCT'             // Materials, goods, hardware or physical equipment procurement
  | 'SERVICE';            // Professional labor, cleaning, maintenance, or consultation services


export type VendorQuotationStatus =
  | 'PENDING'           // Vendor has been invited/suggested but has not submitted a response yet
  | 'SUBMITTED'         // Vendor has successfully submitted their quotation details to the buyer
  | 'ACCEPTED'          // Buyer approved this specific quotation, triggering subsequent LPO steps
  | 'DECLINED'          // Vendor declined to quote, or buyer rejected the submitted quotation
  | 'EXPIRED'           // The quotation is no longer valid because its validity period has elapsed
  | 'WITHDRAWN'         // The vendor withdrew their quotation before the buyer could accept/decline it
  | 'LPO_GENERATED'     // Customer generated the Local Purchase Order draft from this quotation
  | 'LPO_SENT'          // Customer has sent the finalized LPO document to the vendor
  | 'REVIEW_REQUESTED'; // Customer requested changes or price adjustments, expecting a revised quote


export type VendorReviewStatus =
  | 'PENDING_REVIEW'      // Delivery confirmed but no review submitted yet
  | 'SUBMITTED'           // Buyer has submitted their review
  | 'ACKNOWLEDGED';       // Vendor has seen / acknowledged the review


export type VendorCriteriaCategories =
  | 'QUALITY'
  | 'DELIVERY_TIMELINESS'
  | 'COST'
  | 'SERVICE_SUPPORT'
  | 'COMPLIANCE'
  | 'OVERALL';


export type ApprovalStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_APPROVAL'
  | 'APPROVED'
  | 'REJECTED';



export type QuotationHistoryAction =
  | 'CREATED'            // Quotation record was created (draft, not yet sent) — mirrors the shared vendor-side event
  | 'SUBMITTED'          // Vendor submitted (or the demo simulated a submission of) this quotation
  | 'VIEWED'             // Buyer opened/reviewed the quotation for the first time
  | 'REVIEW_REQUESTED'   // Buyer sent the quotation back to the vendor for changes
  | 'RESUBMITTED'        // Vendor resubmitted an updated quotation after a revision request
  | 'ACCEPTED'           // Buyer accepted this quotation, triggering LPO generation
  | 'DECLINED'           // Buyer declined this quotation, or it was auto-declined because another was accepted
  | 'LPO_GENERATED'      // An LPO draft was generated from this accepted quotation
  | 'LPO_SENT'           // The finalized LPO was sent to the vendor
  | 'WITHDRAWN'          // The pending/unanswered quotation was cancelled/withdrawn
  | 'STATUS_CHANGED';    // Catch-all for direct status updates not covered above


export type AvailabilityStatus =
  | 'AVAILABLE'
  | 'PARTIAL'
  | 'UNAVAILABLE'
  | 'SUBSTITUTE'; // should be an array


export type ActorStatus =
  | 'VENDOR'
  | 'CUSTOMER'
  | 'ADMIN'    // Admin is the person who does the internal approval
  | 'SYSTEM';


export type ProcurementLpoStatus =
  | 'DRAFT'               // LPO created but not yet sent to the vendor
  | 'SENT'                // LPO has been dispatched to the vendor
  | 'ACKNOWLEDGED'        // Vendor has confirmed receipt of the LPO
  | 'PARTIALLY_FULFILLED' // Vendor has delivered some but not all line items
  | 'FULFILLED'           // All line items have been delivered and received
  | 'CANCELLED'           // LPO was revoked/cancelled before fulfilment
  | 'DISPUTED';           // Discrepancy raised — under review


export type ProcurementInvoiceStatus =
  | 'RECEIVED'            // Invoice received from the vendor
  | 'UNDER_REVIEW'        // Procurement / finance team is verifying the invoice
  | 'APPROVED'            // Invoice verified and approved for payment
  | 'REJECTED'            // Invoice rejected due to discrepancies
  | 'PAYMENT_SCHEDULED'   // Payment has been scheduled / queued
  | 'PAID'                // Payment completed
  | 'OVERDUE'             // Payment due date has passed without settlement
  | 'DISPUTED';           // Invoice is under dispute (amount mismatch, quality issues, etc.)


// DTOs
export interface RFQAttachment {
  id: number;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  size?: number;
  type?: string;
}

export interface ProcurementCategory {
  id: number;
  categoryId: string;
  name: string;
  description?: string;
}

export interface VendorReviewCriteria {
  category: VendorCriteriaCategories
  score: number[];           // 1–5 star rating for this dimension
  averageScore?: number;         // Optional weighting factor for weighted average (0–1, defaults to equal weight)
  comments?: string[];        // Free-text justification for this score
}

export interface ReviewAttachments {
  id: number;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  size?: number;
  type?: string;

}

export interface VendorReview {
  id: number;
  ratingId: string;
  procurementRequestId: ProcurementRequest;   // The ProcurementRequest this review belongs to
  rfqId: string;                   // The originating RFQ reference
  vendorId: string;                // Reviewed vendor
  vendorName: string;              // Vendor display name (denormalized for convenience)
  reviewerName: string;            // Name of the person who submitted the review
  reviewerRole?: string;           // Role/title of the reviewer (e.g. 'Procurement Manager')
  status: VendorReviewStatus;
  overallRating: number;           // Computed weighted average of all criteria scores (1–5)
  criteria: VendorReviewCriteria[];
  strengths?: string;              // Free-text: what the vendor did well
  improvements?: string;           // Free-text: areas for improvement
  recommendForFuture: boolean;     // Would the buyer use this vendor again?
  attachments?: ReviewAttachments[];      // Supporting evidence (photos, reports)
  submittedAt?: Date;
  acknowledgedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface RequestItem {
  id: number;
  name: string;
  category?: ProcurementCategory;
  description: string;
  quantity: number;
  unit: string;
  unitPrice?: number;
  estimatedBudget: number;
  attachments?: RFQAttachment[];
  brandName?: string;
  model?: string;
  color?: string;
  size?: string;
  material?: string;
  warrantyPeriod?: string;
  specifications?: Record<string, any>;
  currency?: string;
  deliveryMode?: string;
  deliveryDeadline?: Date;
  deliveryLocation?: string;
  // Service specific
  serviceDuration?: string;
  serviceStartDate?: Date;
  serviceEndDate?: Date;
  requiredQualifications?: string[];
  serviceCategory?: string;
  experienceLevel?: string;
}

export interface ProcurementRequest {
  id: number;
  rfqId?: string;
  customerId: string;
  customerName: string;
  procurementType: ProcurementType;
  title: string;
  description: string;
  items: RequestItem[];
  totalBudget: number;
  currency: string;
  status: RequestStatus;
  createdAt: Date;
  createdBy: string;
  updatedAt: Date;
  updatedBy: string;
  suggestedVendorIds: VendorSuggestion[]; // vendors suggestd by ai
  suggestedVendors: VendorSuggestion[];
  // The real, shared vendor-portal Lpo record's `id` (and, for convenience,
  // its human-readable `lpoNumber`) — assigned the moment the LPO is
  // actually generated for this request (see LpoPreviewComponent.updateStatus()
  // and QuotationManagementService.ensureLpoAssigned()). This is the durable
  // join key invoices are matched against; VendorService.createInvoice() and
  // DocumentationHistoryComponent both key off this instead of trying to
  // infer the link from lpoId/lpoNumber string contents (which don't reliably
  // encode the request id).
  cancellationReason?: string;
  cancelledAt?: Date;
  cancellationAdditionalNotes?: string;
  // RFQ Settings
  rfqTitle?: string;
  rfqExpiryDate?: Date;
  vendorsToNotify?: string[];
  selectedVendorId: string;
  selectedVendorName: string;
  selectedQuotationId: string;
  // Approval
  approvalStatus: ApprovalStatus
  approvedBy: string;
  approvedAt: Date;
  approvalComments?: string;
  approvalInstanceId?: number | null;
  // Vendor Selection
  specialInstructions?: string;
  serviceCategory?: string;
  // Post-delivery vendor review
  vendorReview?: VendorReview;
  // LPO & Invoice references
  lpoId?: string;                  // Reference to the ProcurementLpo issued for this request
  invoiceId?: string;              // Reference to the ProcurementInvoice received for this request
  deliveryDeadline?: Date;         // Delivery deadline
  deliveryLocation?: string;       // Delivery location
}

export interface RequestFilters {
  status?: RequestStatus | 'ALL';
  procurementType?: ProcurementType | 'ALL';
  searchTerm?: string;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  size: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  totalElements: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
}

// RFQ Template
export interface RFQTemplate {
  id: string;
  name: string;
  description: string;
  layout: 'STANDARD' | 'MINIMAL' | 'DETAILED' | 'CORPORATE';
  sections: RFQTemplateSection[];
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface RFQTemplateSection {
  id: string;
  title: string;
  type: 'HEADER' | 'DETAILS' | 'ITEMS' | 'TERMS' | 'FOOTER';
  content: string;
  order: number;
  isVisible: boolean;
}

// Vendor Suggestion
export interface VendorSuggestion {
  id: number;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  categories: string[];
  rating: number;
  reviews: string[]
  totalProjects: number;
  completionRate: number;
  averageResponseTime: number;
  matchScore: number;
  isRecommended: boolean;
  reason: string;
}


export interface QuotationHistoryEntry {
  id: number;
  quoteId: VendorQuotation
  version: number;          // quotation version this entry applies to (see VendorQuotation.version)
  action: QuotationHistoryAction;
  actor: ActorStatus;
  note?: string;             // free-text detail — revision instructions, decline reason, resubmission summary, etc.
  amount?: number;           // totalAmount at the time of this entry, where relevant (submission/resubmission/acceptance)
  timestamp: Date;
}

export interface VendorQuotation {
  id: number;
  rfqId: string;
  rfqTitle?: string;
  vendorId: string;
  vendorName: string;
  vendorCode: string;
  vendorRating: number;
  quotationId: String;
  status: VendorQuotationStatus;
  items: QuotationItemDetail[];
  totalAmount: number;
  currency: string;
  deliveryTimeline: string;
  validityDays: number;
  vendorEmail?: string;
  vendorPhone?: string;
  termsAndConditions?: string;
  notes?: string;
  declineReason?: string;
  revisionRequestNote?: string; // Notes describing revision instructions/changes requested by the customer
  submittedAt?: Date;
  updatedAt: Date;
  expiresAt: Date;
  isViewed: boolean;
  // ── Negotiation / revision cycle ──────────────────────────────────────────
  // Optional (rather than required) so existing code that builds a
  // VendorQuotation without these — seed data, mocks, partial updates —
  // keeps compiling. QuotationManagementService normalizes every record to
  // have concrete values (version ?? 1, revisionCount ?? 0, history ?? [])
  // as soon as it loads them, so nothing downstream needs to special-case
  // "missing" vs "zero".
  version?: number;              // increments every time the vendor resubmits after a revision request
  revisionCount?: number;        // how many times the buyer has sent this back so far — capped at MAX_QUOTATION_REVISIONS
  revisionRequestedAt?: Date;    // when the currently-active revision request (if any) was raised
  history?: QuotationHistoryEntry[];
  // ── LPO ────────────────────────────────────────────────────────────────────
  // Assigned exactly once, the first time an LPO is needed for this
  // quotation (see QuotationManagementService.ensureLpoAssigned()) — never
  // regenerated on a later visit, so the number on screen always matches
  // what was actually sent to the vendor.
  lpoNumber?: string;
  lpoIssuedAt?: Date;
}

export interface QuotationItemDetail {
  id: number;
  name: string;
  description: string;
  quantity: number; // Requested quantity from the customer
  unitPrice: number;
  totalPrice: number;
  availability: AvailabilityStatus // Current availability status committed by the vendor
  alternativeProduct?: string; // Alternative product name (applicable only when availability is SUBSTITUTE)
  availableQuantity?: number; // Partial quantity the vendor can provide (applicable only when availability is PARTIAL)
  deliveryDate?: Date;
  notes?: string;
}

export interface RFQWithQuotations {
  rfq: ProcurementRequest;
  quotations: VendorQuotation[];
  summary: {
    totalVendors: number;
    responded: number;
    pending: number;
    accepted: number;
    declined: number;
    expired: number;
  };
}


export interface ProcurementLpoItem {
  id: string;
  name: string;                  // Product or service name
  description: string;
  quantity: number;               // Ordered quantity
  unit: string;                   // Unit of measure (e.g., pcs, hours)
  unitPrice: number;
  totalPrice: number;             // quantity × unitPrice
  deliveredQuantity?: number;     // How many have been received so far
  deliveryDate?: Date;            // Expected delivery date for this item
}

/**
 * ProcurementLpo is the buyer's record of a Local Purchase Order issued
 * to a vendor after accepting their quotation. It references the originating
 * RFQ, quotation, and vendor for full traceability.
 */
export interface ProcurementLpo {
  id: number;
  lpoNumber: string;              // Formatted LPO reference (e.g., LPO-2026-4821)
  procurementRequestId: ProcurementRequest;   // Parent ProcurementRequest
  rfqId: string;                  // Originating RFQ
  quotationId: string;            // Accepted VendorQuotation
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  vendorPhone?: string;
  status: ProcurementLpoStatus;
  items: ProcurementLpoItem[];
  subtotal: number;
  taxRate?: number;               // Tax percentage (e.g. 7.5 for 7.5%)
  taxAmount: number;
  totalAmount: number;            // subtotal + taxAmount
  currency: string;
  deliveryAddress: string;
  deliveryDeadline: Date;
  paymentTerms: string;           // e.g., 'Net 30', '50% upfront, 50% on delivery'
  specialConditions?: string;     // Additional terms / clauses
  attachments?: RFQAttachment[];
  issuedAt?: Date;                // When the LPO was sent to the vendor
  acknowledgedAt?: Date;          // When the vendor confirmed receipt
  fulfilledAt?: Date;             // When all items were delivered
  createdAt: Date;
  updatedAt: Date;
}



export interface ProcurementInvoiceItem {
  id: number;
  lpoItemId?: string;             // Links back to the corresponding LPO line item
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}


export interface ProcurementInvoice {
  id: string;
  invoiceNumber: string;           // Vendor's invoice reference number
  procurementRequestId: ProcurementRequest;    // Parent ProcurementRequest
  lpoId: ProcurementLpo;                   // The LPO this invoice is billed against
  lpoNumber: ProcurementLpo;               // LPO reference for display
  quotationId?: VendorQuotation;            // Original accepted quotation
  vendorId: string;
  vendorName: string;
  vendorEmail?: string;
  status: ProcurementInvoiceStatus;
  items: ProcurementInvoiceItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  currency: string;
  amountPaid: number;              // How much has been paid so far
  amountOutstanding: number;       // totalAmount - amountPaid
  invoiceDate: Date;               // Date the vendor issued the invoice
  dueDate: Date;                   // Payment deadline
  receivedAt: Date;                // When procurement received it
  approvedAt?: Date;               // When finance approved it
  paidAt?: Date;                   // When payment was completed
  rejectionReason?: string;        // Reason for rejection (if REJECTED)
  disputeReason?: string;          // Reason for dispute (if DISPUTED)
  notes?: string;
  attachments?: RFQAttachment[];      // Invoice PDF, supporting documents
  createdAt: Date;
  updatedAt: Date;
}


/**
 * ProcurementPaymentRecord captures each payment event against an invoice.
 * Supports partial payments (multiple records per invoice).
 */
export interface ProcurementPaymentRecord {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  lpoNumber: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  currency: string;
  paymentDate: Date;
  paymentMethod: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'ONLINE' | 'MOBILE_MONEY';
  referenceNumber: string;         // Bank reference / transaction ID
  approvedBy?: string;             // Finance officer who authorized the payment
  notes?: string;
  attachments?: RFQAttachment[];      // Payment receipt / proof of transfer
  createdAt: Date;
}

// ── Supply Chain / Delivery / GRN ──────────────────────────────────────────

export type DeliveryStatus =
  | 'SCHEDULED'          // Delivery scheduled, not yet started
  | 'DISPATCHED'         // Vendor has shipped/dispatched the goods
  | 'IN_TRANSIT'         // In transit to delivery address
  | 'OUT_FOR_DELIVERY'   // Last-mile, arriving today
  | 'DELIVERED'          // Physically arrived at site
  | 'PARTIALLY_DELIVERED'// Some items delivered, others pending
  | 'FAILED'             // Delivery attempted but failed
  | 'RETURNED';          // Goods returned to vendor

export type GrnStatus =
  | 'DRAFT'              // GRN being filled in by receiver
  | 'SUBMITTED'          // GRN submitted, awaiting finance sign-off
  | 'APPROVED'           // Finance approved, triggers payment
  | 'DISPUTED'           // Discrepancy raised
  | 'CANCELLED';         // GRN cancelled

export type GrnItemCondition =
  | 'GOOD'               // Item received in perfect condition
  | 'DAMAGED'            // Item received damaged
  | 'WRONG_ITEM'         // Wrong item received
  | 'SHORT_SUPPLY'       // Fewer units than ordered
  | 'EXCESS_SUPPLY';     // More units than ordered

export function getGrnStatusLabel(status: GrnStatus): string {
  const map: Record<GrnStatus, string> = {
    DRAFT:     'Draft',
    SUBMITTED: 'Submitted — Awaiting Approval',
    APPROVED:  'Approved',
    DISPUTED:  'Disputed',
    CANCELLED: 'Cancelled'
  };
  return map[status] ?? status;
}

export function getGrnStatusSeverity(status: GrnStatus): 'info' | 'warning' | 'success' | 'danger' {
  const map: Record<GrnStatus, 'info' | 'warning' | 'success' | 'danger'> = {
    DRAFT:     'info',
    SUBMITTED: 'warning',
    APPROVED:  'success',
    DISPUTED:  'danger',
    CANCELLED: 'danger'
  };
  return map[status] ?? 'info';
}

export function getGrnStatusColor(status: GrnStatus): string {
  const map: Record<GrnStatus, string> = {
    DRAFT:     '#64748b',
    SUBMITTED: '#d97706',
    APPROVED:  '#16a34a',
    DISPUTED:  '#dc2626',
    CANCELLED: '#94a3b8'
  };
  return map[status] ?? '#64748b';
}

export interface GrnLineItem {
  id: number;
  lpoItemId: string;
  name: string;
  description: string;
  orderedQuantity: number;
  receivedQuantity: number;
  acceptedQuantity: number;
  rejectedQuantity: number;
  unit: string;
  unitPrice: number;
  condition: GrnItemCondition;
  batchNumber?: string;
  serialNumbers?: string[];
  expiryDate?: Date;
  storageLocation?: string;
  notes?: string;
  photosUrls?: string[];
}

export interface GoodsReceivedNote {
  id: number;
  grnNumber: string;             // e.g., GRN-2026-001
  lpoId: number;
  lpoNumber: string;
  procurementRequestId: number;
  vendorId: string;
  vendorName: string;
  deliveryNoteNumber?: string;   // Vendor's delivery note number
  status: GrnStatus;
  items: GrnLineItem[];
  receivedBy: string;
  receivedAt: Date;
  deliveryLocation: string;
  deliveryAddress: string;
  vehicleDetails?: string;
  driverName?: string;
  driverPhone?: string;
  overallCondition: 'ACCEPTABLE' | 'PARTIAL' | 'REJECTED';
  discrepancyNotes?: string;
  signatureUrl?: string;
  photosUrls?: string[];
  attachments?: RFQAttachment[];
  submittedAt?: Date;
  approvedAt?: Date;
  approvedBy?: string;
  createdAt: Date;
  updatedAt: Date;
  // Computed
  totalOrderedValue: number;
  totalReceivedValue: number;
  varianceAmount: number;
}

export interface DeliveryEvent {
  id: string;
  timestamp: Date;
  status: DeliveryStatus;
  location?: string;
  description: string;
  actor: string;
  metadata?: Record<string, any>;
}

export interface DeliveryTracking {
  id: string;
  trackingNumber?: string;
  lpoId: string;
  lpoNumber: string;
  procurementRequestId: number;
  vendorId: string;
  vendorName: string;
  currentStatus: DeliveryStatus;
  estimatedDeliveryDate: Date;
  actualDeliveryDate?: Date;
  deliveryAddress: string;
  contactPerson: string;
  contactPhone: string;
  carrierName?: string;
  timeline: DeliveryEvent[];
  grnId?: string;               // Set once GRN is created
  grnNumber?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Payment Voucher / Finance Bridge ───────────────────────────────────────

export type PaymentVoucherStatus =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'PROCESSING'
  | 'PAID'
  | 'FAILED'
  | 'REVERSED';

export interface PaymentVoucher {
  id: number;
  voucherNumber: string;         // e.g., PV-2026-0042
  grnId: string;
  grnNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  lpoId: string;
  lpoNumber: string;
  procurementRequestId: number;
  vendorId: string;
  vendorName: string;
  vendorBankName: string;
  vendorAccountNumber: string;
  vendorAccountName: string;
  amount: number;
  currency: string;
  paymentMethod: 'BANK_TRANSFER' | 'CHEQUE' | 'CASH' | 'ONLINE' | 'MOBILE_MONEY';
  narration: string;             // e.g., "Payment for LPO-2026-4821 — Office Furniture"
  status: PaymentVoucherStatus;
  requestedBy: string;
  requestedAt: Date;
  approvedBy?: string;
  approvedAt?: Date;
  processedAt?: Date;
  referenceNumber?: string;      // Bank transaction reference
  financeLedgerRef?: string;     // Reference in the accounting/finance module
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Email Notification ──────────────────────────────────────────────────────

export type NotificationType =
  | 'RFQ_SENT'
  | 'QUOTATION_RECEIVED'
  | 'QUOTATION_ACCEPTED'
  | 'QUOTATION_REJECTED'
  | 'REVISION_REQUESTED'
  | 'LPO_ISSUED'
  | 'DELIVERY_SCHEDULED'
  | 'DELIVERY_UPDATE'
  | 'GRN_SUBMITTED'
  | 'PAYMENT_PROCESSED'
  | 'PAYMENT_RECEIPT';

export type NotificationChannel = 'EMAIL' | 'IN_APP' | 'SMS' | 'PUSH';

export type NotificationStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';

export interface ProcurementNotification {
  id: number;
  type: NotificationType;
  channel: NotificationChannel;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  body: string;
  status: NotificationStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  relatedEntityId: string;       // RFQ ID, quotation ID, LPO ID, etc.
  relatedEntityType: string;     // 'RFQ', 'QUOTATION', 'LPO', 'GRN', 'PAYMENT'
  createdAt: Date;
}