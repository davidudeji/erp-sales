import { Component } from '@angular/core';
import { TabConfig } from '../../shared-component/service/interface/data';
import { RequestForQuotationListComponent } from './request-for-quotation-list/request-for-quotation-list.component';
import { QuotationsDashboardComponent } from './quotations-dashboard/quotations-dashboard.component';
import { DocumentationHistoryComponent } from './documentation-history/documentation-history.component';
import { ApprovalInboxComponent } from './approval-inbox/approval-inbox.component';
import { DeliveryTrackingComponent } from './delivery-tracking/delivery-tracking.component';
import { PaymentVoucherComponent } from './payment-voucher/payment-voucher.component';
import { GrnListComponent } from './grn-list/grn-list.component';

@Component({
  selector: 'app-request-management',
  templateUrl: './request-management.component.html',
  styleUrls: ['./request-management.component.scss']
})
export class RequestManagementComponent {

  tabsConfig: TabConfig[] = [
    {
      name: 'Request for Quotations',
      component: RequestForQuotationListComponent,
      icon: 'fa-solid fa-bell',
    },
    {
      name: 'Review Vendor Quotations',
      component: QuotationsDashboardComponent,
      icon: 'fa-solid fa-file-invoice',
    },
    {
      name: 'Approval Inbox',
      component: ApprovalInboxComponent,
      icon: 'fa-solid fa-inbox',
    },
    {
      name: 'Supply Chain & Delivery',
      component: DeliveryTrackingComponent,
      icon: 'fa-solid fa-truck',
    },
    {
      name: 'Goods Received Notes',
      component: GrnListComponent,
      icon: 'fa-solid fa-clipboard-check',
    },
    {
      name: 'Payment Vouchers',
      component: PaymentVoucherComponent,
      icon: 'fa-solid fa-money-check-dollar',
    },
    {
      name: 'Archives',
      component: DocumentationHistoryComponent,
      icon: 'fa-solid fa-box-archive',
    }
  ];
}
