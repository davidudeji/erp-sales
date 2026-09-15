//sales.dto.ts
// Enum Structures
export type CustomerStatus = 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED';

export type ProductStatus = 'ACTIVE' | 'DISCONTINUED' | 'OUT_OF_STOCK';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'DECLINED' | 'EXPIRED' | 'CONVERTED';

export type InvoiceStatus = 'DRAFT' | 'SENT' | 'CANCELLED';

export type PaymentMode = 'MONTHLY' | 'ONE-OFF';

export type PaymentMethod = 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE' | 'POS' | 'MOBILE_MONEY';

export type SaleLifecycleStatus =
  | 'QUOTE_SENT'
  | 'QUOTE_ACCEPTED'
  | 'QUOTE_REJECTED'
  | 'QUOTE_CONVERTED'
  | 'INVOICE_SENT'
  | 'INVOICE_CANCELLED'
  | 'PAYMENT_PENDING'
  | 'PAYMENT_IN_PROGRESS'
  | 'PAYMENT_COMPLETED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_REFUNDED'
  | 'RECEIPT_GENERATED'
  | 'DELIVERY_PENDING'
  | 'DISPATCHED'
  | 'IN_TRANSIT'
  | 'DELIVERED'
  | 'RETURNED'
  ;

// DTOs
export interface CustomerBankDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  routingNumber?: string; // remove later
}

export interface Customer {
  id: number;
  customerId: string;
  name: string;
  email: string;
  phone: string;
  address: string[]; // billing address
  deliverAddress: string[];
  taxId?: string;
  createdBy: string;
  createdAt: Date;
  totalSpent: number;
  totalOrders: number;
  status: CustomerStatus;
  notes?: string;
  bankAccounts?: CustomerBankDetails[];
}

export interface ProductVariantAttributes {
  color?: string;
  size?: string;
  material?: string;
  model?: string;
  year?: string | number;
  [key: string]: any;
}

export interface ProductVariant {
  id?: number;
  variantId: string;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  attributes?: ProductVariantAttributes;
}

export interface Category {
  id: number;
  categoryId: string;
  name: string;
  description?: string;
}

export interface MeasurementUnit {
  id?: number;
  unitId: string;
  name: string;
  code?: string;
  description?: string;
}

export interface Supplier {
  id?: number;
  supplierId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: string;
  contactPerson?: string;
}

export interface StockMovement {
  id?: number;
  supplierId?: Supplier;
  movementDate: Date | string;
  movementQuantity: number;
  movementPurchasePrice?: number;
  movementTax?: number;
  reference?: string;
}

export interface ComboProduct {
  id?: number;
  comboId: string;
  comboName: string;
  quantity: number;
  unitPrice?: number;
}

export interface Product {
  id: number;
  productId: string;
  name: string;
  sku: string;
  description: string;
  measurementUnit?: MeasurementUnit;
  partNumber: string;
  code: string;
  reorderThreshold: number;
  weight: number;
  unitPrice: number;
  costPrice: number;
  sellingPrice: number;
  currency: string;
  stockQuantity: number;
  expiryDate: Date;
  discount: number;
  supplier: Supplier;
  category: Category;
  categoryId?: number;
  measurementUnitId?: number;
  supplierId?: number;
  stockMovement: StockMovement;
  taxRate: number;
  images: string[];
  status: ProductStatus;
  variants?: ProductVariant[];
  isComboProduct?: boolean;
  comboItems?: ComboProduct[];
  noOfTimesSoldPerMonth: number;
}

export interface QuoteItem {
  id: number;
  productId: string;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  amount: number;
  total: number;
}

export interface QuoteAttachments {
  id?: number;
  fileName?: string;
  fileUrl?: string;
  uploadedAt?: Date | string;
  size?: number;
  type?: string;
}

export interface AdditionalQuoteOptions {
  signatureText: string;
  attachments: QuoteAttachments[];
  email: string;
  address: string;
  phone: string;
  notes: string;
  terms: string
}


export interface Quote {
  id: number;
  quoteNumber: string;
  customerId: Customer;
  customerName: Customer;
  selectedCustomerBank: CustomerBankDetails;
  merchantDetails: MerchantInfo;
  logoUrl: string[];
  items: QuoteItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  additionalCharges: number[];
  additionalChargesLabel?: string[];
  totalAmount: number;
  currency: string;
  status: QuoteStatus;
  validUntil: Date;
  createdBy: string;
  createdAt: Date;
  expiresAt: Date;
  additionalOptions?: AdditionalQuoteOptions[];
}


export interface SalesandTransactions {
  id: number;
  orderId: string;
  quoteId: Quote;
  paymentNumber: string;
  invoiceId: Invoice;
  customerId: Customer;
  customerName: Customer;
  items: Quote;
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  additionalCharges: number[];
  additionalChargesLabel: string[];
  totalAmount: number;
  currency: string;
  status: SaleLifecycleStatus;
  orderDate: Date;
  expectedDeliveryDate: Date;
  actualDeliveryDate: Date;
  quoteSentDate: Date;
  quoteAcceptedOrRejectedDate: Date;
  quoteConvertedDate: Date;
  invoiceSentDate: Date;
  invoiceCancelledDate?: Date;
  customerNotes: string;
  billingAddress: string;
  paidAmount: number;
  paymentMethod: PaymentMethod;
  PaymentMode: PaymentMode;
  PaymentTerms: PaymentTerms;
  balanceDue: number;
  installmentNumber: number;
  completedInstallments: number;
  reference: string;
  transactionNotes: string;
  deliveryNumber: string;
  shippingAddress: string;
  carrier: string;
  trackingNumber: string;
  dispatchedAt: Date;
  deliveredAt: Date;
  returnedAt: Date;
  signature: string;
}


export interface PaymentTerms {
  id?: number;
  customerId: Customer;
  customerName: Customer;
  InvoiceId?: SalesandTransactions;
  orderId?: SalesandTransactions;
  paymentMethod?: PaymentMethod;
  paymentMode?: PaymentMode;
  paymentPeriod: number;
  amount: number;
  balanceDue: number;
  installmentNumber: number;
  completedInstallments: number;
}

export interface InvoiceItem {
  id: number;
  productName: string;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  taxRate: number;
  amount: number;
  total: number;
}


export interface InvoiceAttachments {
  id: number;
  fileName: string;
  fileUrl: string;
  uploadedAt: Date;
  size: number;
  type: string;
}


export interface AdditionalInvoiceOptions {
  signatureText: string;
  attachments: InvoiceAttachments[];
  email: string;
  address: string;
  phone: string;
  notes: string;
  terms: string
}

export interface Invoice {
  id: number;
  invoiceNumber: string;
  orderId: string;
  quoteId?: string;
  customerId: Customer;
  customerName: Customer;
  selectedCustomerBank?: CustomerBankDetails;
  merchantDetails?: MerchantInfo;
  logoUrl?: string;
  items: InvoiceItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  additionalCharges: number[];
  additionalChargesLabel?: string[];
  totalAmount: number;
  currency: string;
  status: InvoiceStatus;
  issueDate: Date;
  dueDate: Date;
  paidAt?: Date;
  notes?: string;
  shippingAddress?: string;
  paymentTerms: PaymentTerms[];
  additionalOptions: AdditionalInvoiceOptions[]
}


export interface MerchantBankDetails {
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export interface MerchantInfo {
  id: number;
  tenantId?: string;
  merchantId: string;
  name: string;
  companyName: string;
  bankDetails: MerchantBankDetails;
  address: string[];
  phone: string;
  email: string;
  taxId: string;
  website?: string;
  logoUrl?: string[];
  createdBy?: number;
  createdAt?: Date;
  updatedAt?: Date;
}


export interface PaymentReceipt {
  receiptNumber: string;
  payment: SalesandTransactions;
  invoice: Invoice;
  customer?: Customer;
  merchantInfo: MerchantInfo;
  issuedAt: Date;
}

// ------------------------------------------------------------------
// Sales Document Email DTOs
// Backs POST/GET /x/api/v2/commerce/sales/email(/send|/{id}) — emailing
// a Quote or Invoice to a customer, and the send history/status for it.
// Replaces the generic procurement NotificationService.sendDirectEmail()
// call quote-form/invoice-form used before this endpoint existed.
// ------------------------------------------------------------------

export type SalesEmailDocumentType = 'QUOTE' | 'INVOICE';

export type SalesEmailStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';

export interface SalesEmailAttachment {
  fileName: string;
  fileUrl: string;
  size: number;
  type: string;
}

/** Request body for POST /sales/email/send. */
export interface SendSalesEmailRequest {
  documentType: SalesEmailDocumentType;
  documentId: number;
  documentNumber: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  message: string;
  attachments?: SalesEmailAttachment[];
  sentBy: string;
}

/** A logged send, as returned by GET /sales/email and GET /sales/email/{id}. */
export interface SalesEmailNotification {
  id: number;
  tenantId: string;
  documentType: SalesEmailDocumentType;
  documentId: number;
  documentNumber: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  attachments?: SalesEmailAttachment[];
  status: SalesEmailStatus;
  sentAt?: Date | string;
  deliveredAt?: Date | string;
  failureReason?: string;
  retryCount: number;
  sentBy: string;
  createdAt: Date | string;
}

export interface TopCustomers {
  customerId: Customer;
  productName: SalesandTransactions;
  amount: number;
  month: string;
}


export interface SalesSummary {
  totalRevenue: number;
  totalQuotes: number;
  acceptedQuotes: number;
  pendingQuotes: number;
  totalInvoices: number;
  paidInvoices: number;
  overdueInvoices: number;
  totalCustomers: number;
}

export interface RevenueChartData {
  month: string;
  amount: number;
}

export interface TopProduct {
  productId: Product;
  productName: Product;
  quantitySold: number;
  month: string;
  revenue: number;
}

// ============================================================
// DOCUMENT EMAIL DELIVERY — forward Quotes & Invoices to customers
// ============================================================
// This is meant to replace the ad-hoc, attachment-less `sendDirectEmail` call that
// quote-form/invoice-form currently borrow from procurement's NotificationService
// (see quote-form.component.ts#sendQuoteEmail / invoice-form.component.ts#sendInvoiceEmail —
// both build an HTML string and POST it with no reference to the PDF that was just
// generated for the customer). Once a backend endpoint exists for this DTO, those two
// methods should call it instead, passing the generated PDF as an attachment.

export type SalesDocumentType = 'QUOTE' | 'INVOICE';

export type EmailDeliveryStatus = 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'BOUNCED';

// Field names match the existing QuoteAttachments/InvoiceAttachments shape above —
// attachments in this app are uploaded first (see procurement.service.ts#uploadAttachment)
// and referenced by URL, never inlined as base64.
export interface EmailAttachment {
  fileName: string;
  fileUrl: string;
  size?: number;
  type?: string; // mime type, e.g. 'application/pdf'
}

/** Request payload for sending/forwarding a Quote or Invoice to a customer by email. */
export interface SendDocumentEmailRequest {
  documentType: SalesDocumentType;
  documentId: number;              // Quote.id or Invoice.id
  documentNumber: string;          // quoteNumber / invoiceNumber — for subject + logging
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  message: string;                 // editable body shown in the send modal before dispatch
  attachments?: EmailAttachment[]; // generated PDF, plus any user-attached files
  sentBy: string;                  // id/name of the user who triggered the send
}

/** Delivery record returned after a send, and used to render send history on a document. */
export interface DocumentEmailLog {
  id: string;
  documentType: SalesDocumentType;
  documentId: number;
  documentNumber: string;
  to: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  attachments: EmailAttachment[];
  status: EmailDeliveryStatus;
  sentAt?: Date;
  deliveredAt?: Date;
  failureReason?: string;
  retryCount: number;
  sentBy: string;
  createdAt: Date;
}




