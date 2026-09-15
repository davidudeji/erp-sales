import { Component } from '@angular/core';
import { TabConfig } from '../../shared-component/service/interface/data';
import { InventoryDashboardComponent } from './inventory-dashboard/inventory-dashboard.component';
import { ProductManagementComponent } from './product/product-management/product-management.component';
import { BranchInventoryComponent } from './branch/branch-inventory/branch-inventory.component';
import { StockMovementComponent } from './stock/stock-movement/stock-movement.component';
import { RestockManagementComponent } from './restock/restock-management/restock-management.component';
import { AnalyticsComponent } from './inventory-analytics/analytics/analytics.component';
import { BranchManagerDashboardComponent } from './branch-managers/branch-manager-dashboard/branch-manager-dashboard.component';

@Component({
  selector: 'app-inventory',
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss'
})
export class InventoryComponent {
  tabsConfig: TabConfig[] = [
    {
      name: 'Inventory Dashboard',
      component: InventoryDashboardComponent,
      icon: 'fa-sharp fa-solid fa-chart-line'
    },
    {
      name: 'Product Management',
      component: ProductManagementComponent,
      icon: 'fa-sharp fa-solid fa-box-open'
    },
    {
      name: 'Branch Inventory',
      component: BranchInventoryComponent,
      icon: 'fa-sharp fa-solid fa-store'
    },
    {
      name: 'Stock Movement',
      component: StockMovementComponent,
      icon: 'fa-sharp fa-solid fa-arrow-right-arrow-left'
    },
    {
      name: 'Restock Management',
      component: RestockManagementComponent,
      icon: 'fa-sharp fa-solid fa-cart-plus'
    },
    {
      name: 'Analytics',
      component: AnalyticsComponent,
      icon: 'fa-sharp fa-solid fa-chart-line'
    },
    {
      name: 'Branch Manager',
      component: BranchManagerDashboardComponent,
      icon: 'fa-solid fa-user'
    }
  ]
}
