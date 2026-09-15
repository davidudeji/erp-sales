import { Component } from '@angular/core';
import { TabConfig } from '../../shared-component/service/interface/data';
import { RoutingQueueComponent } from './routing-queue/routing-queue.component';
import { RouteApprovalComponent } from './route-approval/route-approval.component';
import { DeliveryRecordsComponent } from './delivery-records/delivery-records.component';
import { RiderActivityComponent } from './rider-activity/rider-activity.component';
import { RouteBuilderComponent } from './route-builder/route-builder.component';
import { StopChecklistComponent } from './stop-checklist/stop-checklist.component';


@Component({
  selector: 'app-logistics',
  templateUrl: './logistics.component.html',
  styleUrl: './logistics.component.scss'
})
export class LogisticsComponent {
  tabsConfig: TabConfig[] = [
    {
      name: 'Routing Queue',
      component: RoutingQueueComponent,
      icon: 'pi pi-sort-amount-down'
    },
    {
      name: 'Route Approval',
      component: RouteApprovalComponent,
      icon: 'pi pi-check-square'
    },
    {
      name: 'Delivery Records',
      component: DeliveryRecordsComponent,
      icon: 'pi pi-box'
    },
    {
      name: 'Rider Activity',
      component: RiderActivityComponent,
      icon: 'pi pi-users'
    },
    {
      name: 'Route Builder',
      component: RouteBuilderComponent,
      icon: 'pi pi-map'
    },
    {
      name: 'Stop Checklist',
      component: StopChecklistComponent,
      icon: 'pi pi-check-circle'
    },
    // Route Builder & Stop Checklist are the rider-facing, mobile-first
    // screens (per the brief). They're included as tabs here for now so
    // they're reachable from the same admin shell; if/when riders get a
    // separate app entry point, these two can move there without any
    // change to their own component code.
  ]



}
