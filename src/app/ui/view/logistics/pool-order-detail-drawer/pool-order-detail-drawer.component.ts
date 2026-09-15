import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Order, RouteStop, StopStatus } from '../../../domain/logistics/logistics.dto';

@Component({
  selector: 'app-pool-order-detail-drawer',
  templateUrl: './pool-order-detail-drawer.component.html',
  styleUrl: './pool-order-detail-drawer.component.scss'
})
export class PoolOrderDetailDrawerComponent {
  @Input() order: Order | null = null;
  @Output() closed = new EventEmitter<void>();

  get mapStop(): RouteStop[] {
    if (!this.order?.lat || !this.order?.lng) return [];
    return [
      {
        sequence: 1,
        orderId: this.order.id,
        orderDisplayId: this.order.orderId,
        location: this.order.deliveryLocation,
        itemsSummary: this.order.itemsSummary,
        stopStatus: StopStatus.PENDING,
        lat: this.order.lat,
        lng: this.order.lng
      }
    ];
  }

  close(): void {
    this.closed.emit();
  }
}
