import { Component } from '@angular/core';
import { TabConfig } from '../../shared-component/service/interface/data';
import { SalesDashboardComponent } from './sales-dashboard/sales-dashboard.component';
import { ProductServiceCatalogListComponent } from './product-service-catalog/product-service-catalog-list/product-service-catalog-list.component';
import { PaymentProcessingComponent } from './payment-processing/payment-processing.component';
import { CustomerListComponent } from './customer-management/customer-list/customer-list.component';
import { DeliveryManagementComponent } from './delivery-management/delivery-management.component';
import { QuoteListComponent } from './quotations/quote-list/quote-list.component';
import { InvoiceListComponent } from './invoices/invoice-list/invoice-list.component';
import { SalesAndTransactionsListComponent } from './sales-and-transactions/sales-and-transactions-list/sales-and-transactions-list.component';

@Component({
  selector: 'app-sales-hub',
  templateUrl: './sales-hub.component.html',
  styleUrl: './sales-hub.component.scss'
})
export class SalesHubComponent {

  tabsConfig: TabConfig[] = [
    {
      name: 'Dashboard',
      component: SalesDashboardComponent,
      icon: 'fa-sharp fa-solid fa-chart-line',
    },
    {
      name: 'Catalog',
      component: ProductServiceCatalogListComponent,
      icon: 'fa-sharp fa-solid fa-layer-group',
    },
    {
      name: 'Quotes',
      component: QuoteListComponent,
      icon: 'fa-solid fa-file',
    },
    {
      name: 'Invoices',
      component: InvoiceListComponent,
      icon: 'fa-solid fa-file-invoice-dollar',
    },
    {
      name: 'Customers',
      component: CustomerListComponent,
      icon: 'fa-solid fa-users',
    },
    {
      name: 'Sales & Transactions',
      component: SalesAndTransactionsListComponent,
      icon: 'fa-solid fa-money-bill-wave',
    },
  ];

}


