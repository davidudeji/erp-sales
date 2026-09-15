//vendor-notification.dto.ts
interface VendorNotification {
  id: string;
  vendorId: string;
  type: 'NEW_REQUEST' | 'QUOTATION_ACCEPTED' | 'QUOTATION_REJECTED' | 'LPO_ISSUED';
  title: string;
  message: string;
  relatedRequestId?: string;
  relatedQuotationId?: string;
  isRead: boolean;
  createdAt: Date;
}