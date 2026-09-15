interface Quotation {
  id: string;
  requestId: string;
  vendorId: string;
  amount: number;
  currency: string;
  deliveryTimeline: string;  // e.g., "5-7 business days"
  terms: string;
  notes: string;
  validityDays: number;
  status: QuotationStatus;
  submittedAt: Date;
  updatedAt: Date;
  selectedAt?: Date;
  rejectionReason?: string;
}

type QuotationStatus = 
  | 'PENDING' 
  | 'ACCEPTED' 
  | 'REJECTED' 
  | 'WITHDRAWN' 
  | 'EXPIRED';

interface QuotationTemplate {
  id: string;
  vendorId: string;
  name: string;
  defaultAmount?: number;
  defaultDeliveryTimeline: string;
  defaultTerms: string;
  markupPercentage?: number;
  isDefault: boolean;
}
