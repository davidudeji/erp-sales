// ─── Shared ───────────────────────────────────────────────────────────────────
export type Currency = 'NGN' | 'USD' | 'GBP' | 'EUR';

// ─── RFQ ─────────────────────────────────────────────────────────────────────
export type RfqStatus = 'open' | 'converted' | 'expired' | 'closed';

// Vendor's response to a single RFQ line item:
//   available   — vendor can supply the full requested quantity, on spec
//   partial     — vendor can only supply part of the requested quantity
//   substitute  — vendor can't match the exact item/spec but is offering an alternative
//   unavailable — vendor cannot supply this item at all
export type ItemAvailability = 'available' | 'partial' | 'substitute' | 'unavailable';

// Quotation status / negotiation workflow:
//   draft               — vendor still preparing, not yet sent
//   sent                — submitted to client, awaiting their decision
//   revision_requested  — client asked for changes; vendor must edit and resubmit
//   accepted            — client selected this vendor
//   rejected            — client chose another vendor / declined
//   withdrawn           — vendor pulled the quotation back before a decision was made
export type QuotationStatus =
  | 'draft'
  | 'sent'
  | 'revision_requested'
  | 'accepted'
  | 'rejected'
  | 'withdrawn';

export type LpoStatus = 'pending' | 'accepted' | 'rejected' | 'fulfilled' | 'cancelled';

// Ceiling on how many times a client can send a quotation back for changes
// before the negotiation should be escalated or the RFQ closed manually.
export const MAX_REVISION_ROUNDS = 3;

export interface RfqImage {
  id: string;
  url: string;
  label?: string;
}

export interface RfqItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  specifications?: string;
  referenceImages?: RfqImage[];
}

// A general document attachment on an RFQ — specs, drawings, terms & conditions,
// data sheets, etc. Distinct from RfqImage (which is a small inline reference
// photo shown under an item) — this is a downloadable file the vendor needs to
// fully understand the request before pricing it. See PRD §6.2 "Full Spec Viewing".
export type RfqAttachmentType = 'pdf' | 'doc' | 'xls' | 'image' | 'dwg' | 'zip' | 'other';

export interface RfqAttachment {
  id: string;
  fileName: string;
  fileType: RfqAttachmentType;
  fileSize: string;       // display string, e.g. "2.4 MB"
  url: string;
  label?: string;         // short human description, e.g. "Technical drawing — Rev B"
  uploadedDate: Date;
}

export interface Rfq {
  id: string;
  rfqNumber: string;
  clientName: string;
  clientEmail?: string;
  issuedDate: Date;
  dueDate: Date;
  status: RfqStatus;
  isRead: boolean;
  items: RfqItem[];
  clientInstructions?: string;
  deliveryAddress?: string;
  paymentTerms?: string;
  currency: string;
  category: string;
  totalEstimatedValue?: number;
  // Full spec attachments — drawings, data sheets, terms & conditions, etc.
  attachments?: RfqAttachment[];
  // True when the customer specifically invited this vendor to quote, rather
  // than the RFQ being open to the whole registered category. See PRD §6.2
  // "Direct Targeting". Surfaced as a badge so vendors can prioritise warmer leads.
  isDirectInvite?: boolean;
}

// ─── Quotation ────────────────────────────────────────────────────────────────
export interface QuotationItem {
  rfqItemId: string;
  name: string;
  description: string;
  quantity: number;                      // originally requested quantity — never mutated
  unit: string;
  unitPrice: number | null;
  totalPrice: number | null;
  availability: ItemAvailability;
  offeredQuantity: number | null;        // how much the vendor can actually supply — required for 'partial', optional for 'substitute'
  exceptionNote: string | null;          // vendor's explanation — required for 'partial' | 'unavailable'
  substituteDescription: string | null;  // what's being offered instead — required for 'substitute'
}

// One entry in a quotation's audit trail. Captures every step of the
// back-and-forth so both sides can see the full negotiation history,
// not just the current state.
//
// VIEWED / LPO_GENERATED / LPO_SENT / STATUS_CHANGED are buyer-side
// (procurement) events — added so the request-management module can log
// its own actions onto this same shared history array instead of keeping a
// separate, disconnected log. actor: 'SYSTEM' covers automatic entries
// (e.g. "declined because another quotation was accepted").
export type QuotationHistoryAction =
  | 'CREATED'
  | 'SUBMITTED'
  | 'VIEWED'
  | 'REVISION_REQUESTED'
  | 'RESUBMITTED'
  | 'ACCEPTED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'LPO_GENERATED'
  | 'LPO_SENT'
  | 'STATUS_CHANGED';

export interface QuotationHistoryEntry {
  id: string;
  version: number;
  action: QuotationHistoryAction;
  actor: 'VENDOR' | 'CUSTOMER' | 'SYSTEM';
  note?: string;
  total?: number;
  timestamp: Date;
}

export interface Quotation {
  id: string;
  quotationNumber: string;
  rfqId: string;
  rfqNumber: string;
  clientName: string;
  createdDate: Date;
  sentDate?: Date;
  validUntil: Date;
  status: QuotationStatus;
  items: QuotationItem[];
  subtotal: number;
  tax: number;
  total: number;
  notes?: string;
  currency: string;
  // Populated from VendorProfile at creation (see createQuotationFromRfq()) so
  // the buyer side (request-management module) can identify who quoted
  // without needing its own separate vendor record for the same company.
  vendorId?: string;
  vendorName?: string;
  vendorCode?: string;
  vendorRating?: number;
  // ── Negotiation / revision cycle ──────────────────────────────────────────
  version: number;                     // increments every time the vendor resubmits after a revision request
  revisionCount: number;               // how many times the client has sent this back so far
  revisionRequestNote?: string;        // the client's active request note — shown to vendor while status is 'revision_requested'
  revisionRequestedAt?: Date;
  history: QuotationHistoryEntry[];
  includeSignature?: boolean;   // decided per-document, at creation — see VendorProfile.signatureDataUrl
}

// ─── LPO ─────────────────────────────────────────────────────────────────────
export interface LpoItem {
  id: string;
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface Lpo {
  id: string;
  lpoNumber: string;
  quotationId?: string;
  quotationNumber?: string;
  rfqNumber?: string;
  clientName: string;
  clientEmail?: string;
  issuedDate: Date;
  deliveryDate: Date;
  status: LpoStatus;
  isRead: boolean;
  items: LpoItem[];
  deliveryAddress: string;
  paymentTerms: string;
  currency: string;
  subtotal: number;
  tax: number;
  total: number;
  specialConditions?: string;
  rejectionReason?: string;
}

// ─── Finance — Invoice ────────────────────────────────────────────────────────
export type InvoiceStatus = 'draft' | 'submitted' | 'approved' | 'paid' | 'overdue' | 'disputed';

export interface InvoiceLineItem {
  id: string;
  lpoItemId?: string;        // links back to the originating LPO line — absent for manually-added lines
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  lpoId?: string;
  lpoNumber?: string;
  quotationNumber?: string;
  clientName: string;
  clientEmail?: string;
  issuedDate: Date;
  dueDate: Date;
  paidDate?: Date;
  status: InvoiceStatus;
  items: InvoiceLineItem[];
  subtotal: number;
  tax: number;
  total: number;
  amountPaid: number;
  amountOutstanding: number;
  currency: string;
  notes?: string;
  bankDetails?: BankDetails;
  includeSignature?: boolean;   // decided per-document, at creation — see VendorProfile.signatureDataUrl
}

export interface BankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  sortCode?: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  clientName: string;
  amount: number;
  currency: string;
  paidDate: Date;
  method: 'bank_transfer' | 'cheque' | 'cash' | 'online';
  reference: string;
  notes?: string;
}

export interface FinanceStats {
  totalInvoiced: number;
  totalPaid: number;
  totalOutstanding: number;
  totalOverdue: number;
  invoiceCount: number;
  paidCount: number;
  overdueCount: number;
  pendingCount: number;
  avgPaymentDays: number;
  recentPayments: Payment[];
}

// ─── Documents ────────────────────────────────────────────────────────────────
export type DocumentStatus = 'active' | 'expiring_soon' | 'expired' | 'pending_review';
export type DocumentCategory = 'registration' | 'tax' | 'licence' | 'insurance' | 'certification' | 'other';

export interface VendorDocument {
  id: string;
  name: string;
  category: DocumentCategory;
  fileUrl: string;
  fileName: string;
  fileSize: string;
  fileType: string;
  uploadedDate: Date;
  expiryDate?: Date;
  status: DocumentStatus;
  notes?: string;
  isRequired: boolean;
}

export interface DocumentStats {
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  pendingReview: number;
}

// ─── Performance ──────────────────────────────────────────────────────────────
export interface MonthlyMetric {
  month: string;  // e.g. 'Jan 2026'
  rfqs: number;
  quoted: number;
  won: number;
  revenue: number;
}

export interface ClientPerformance {
  clientName: string;
  totalOrders: number;
  totalRevenue: number;
  onTimeRate: number;
  acceptanceRate: number;
}

export interface PerformanceStats {
  // Response
  avgRfqResponseHours: number;
  rfqResponseRate: number;    // % RFQs quoted vs received
  // Quality
  quotationAcceptanceRate: number;   // % won
  onTimeDeliveryRate: number;
  // Revenue
  totalRevenueYtd: number;
  totalRevenueAllTime: number;
  revenueGrowthPct: number;   // vs prior period
  // Volume
  totalRfqsReceived: number;
  totalQuotationsSubmitted: number;
  totalLposAccepted: number;
  totalLposFulfilled: number;
  // Rating
  overallRating: number;      // 1-5
  // Breakdown
  monthlyMetrics: MonthlyMetric[];
  topClients: ClientPerformance[];
}

// ─── Stats (dashboard + lpo) ──────────────────────────────────────────────────
export interface VendorStats {
  totalRfqs: number;
  unreadRfqs: number;
  openRfqs: number;
  totalQuotations: number;
  draftQuotations: number;
  sentQuotations: number;
  acceptedQuotations: number;
  revisionRequestedQuotations: number;
  conversionRate: number;
  pendingResponseDueSoon: number;
}

export interface LpoStats {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
  fulfilled: number;
  unread: number;
  totalValue: number;
}

// ─── Vendor Profile ────────────────────────────────────────────────────────────
export type VerificationStatus = 'verified' | 'pending' | 'unverified';

export interface VendorProfile {
  id: string;
  companyName: string;
  tradingName?: string;
  rcNumber: string;          // CAC registration number
  taxId: string;             // TIN
  category: string;          // primary supply category
  additionalCategories: string[];
  email: string;
  phone: string;
  alternatePhone?: string;
  website?: string;
  address: string;
  city: string;
  state: string;
  country: string;
  contactPersonName: string;
  contactPersonRole: string;
  bankDetails: BankDetails;
  logoUrl?: string;
  signatureDataUrl?: string;   // drawn once here; whether to attach it is decided per-document (quotation/invoice), not by the template
  verificationStatus: VerificationStatus;
  memberSince: Date;
}

// ─── Document Templates (branding) ────────────────────────────────────────────
export type TemplateDocType = 'invoice' | 'quotation';
export type LogoPosition = 'left' | 'center' | 'right';
export type TemplateDensity = 'simple' | 'detailed';
export type TemplateBaseStyle = 'classic' | 'bold' | 'sidebar' | 'modern';

export interface DocumentTemplate {
  id: string;
  name: string;
  docType: TemplateDocType;
  isActive: boolean;
  baseStyle: TemplateBaseStyle;
  logoUrl?: string;
  logoPosition: LogoPosition;
  accentColor: string;
  density: TemplateDensity;
  footerText?: string;
  showBankDetails: boolean;
  notesDefault?: string;
  updatedDate: Date;
}
