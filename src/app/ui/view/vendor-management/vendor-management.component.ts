import { Component } from '@angular/core';
import { TabConfig } from '../../shared-component/service/interface/data';
import { VendorManagementDashboardComponent } from './vendor-management-dashboard/vendor-management-dashboard.component';
import { VendorManagementListComponent } from './vendor-management-list/vendor-management-list.component';
import { VendorApprovalQueueComponent } from './vendor-approval-queue/vendor-approval-queue.component';

@Component({
  selector: 'app-vendor-management',
  templateUrl: './vendor-management.component.html',
  styleUrl: './vendor-management.component.scss'
})
export class VendorManagementComponent {
  tabsConfig: TabConfig[] = [
    {
      name: 'Dashboard',
      component: VendorManagementDashboardComponent,
      icon: 'fa-sharp fa-solid fa-chart-line',
    },
    {
      name: 'Vendor Global Registry',
      component: VendorApprovalQueueComponent,
      icon: 'fa-sharp fa-solid fa-user-group',
    },
    {
      name: 'Vendor Directory',
      component: VendorManagementListComponent,
      icon: 'fa-sharp fa-solid fa-store',
    },
  ];
}
