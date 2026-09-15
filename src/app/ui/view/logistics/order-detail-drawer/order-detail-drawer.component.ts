import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import {
  AuditLogEntry,
  Order,
  getOrderStatusBadgeClass,
  getOrderStatusLabel,
  formatDuration,
  minutesBetween
} from '../../../domain/logistics/logistics.dto';

@Component({
  selector: 'app-order-detail-drawer',
  templateUrl: './order-detail-drawer.component.html',
  styleUrl: './order-detail-drawer.component.scss'
})
export class OrderDetailDrawerComponent implements OnChanges {
  @Input() orderId: string | null = null;
  @Output() closed = new EventEmitter<void>();

  order: Order | null = null;
  auditLog: AuditLogEntry[] = [];
  isLoading = false;
  showItems = false;

  readonly getOrderStatusLabel = getOrderStatusLabel;
  readonly getOrderStatusBadgeClass = getOrderStatusBadgeClass;
  readonly formatDuration = formatDuration;

  constructor(private logisticsService: LogisticsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['orderId'] && this.orderId) {
      this.showItems = false;
      this.load(this.orderId);
    }
  }

  toggleItems(): void {
    this.showItems = !this.showItems;
  }

  private load(orderId: string): void {
    this.isLoading = true;
    this.order = null;
    this.auditLog = [];
    this.logisticsService.getOrderDetail(orderId).subscribe((order) => {
      this.order = order ?? null;
      this.isLoading = false;
    });
    this.logisticsService.getAuditLog(orderId).subscribe((log) => {
      this.auditLog = log;
    });
  }

  timeSincePaid(): string {
    if (!this.order) return '—';
    return formatDuration(minutesBetween(this.order.paidAt));
  }

  close(): void {
    this.closed.emit();
  }
}
