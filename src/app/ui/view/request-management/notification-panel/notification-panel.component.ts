import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { NotificationService } from '../../../service/procurement/notification.service';
import { ProcurementNotification, NotificationType, NotificationStatus } from '../../../domain/procurement-request/procurement.dto';

@Component({
  selector: 'app-notification-panel',
  templateUrl: './notification-panel.component.html',
  styleUrls: ['./notification-panel.component.scss']
})
export class NotificationPanelComponent implements OnInit, OnDestroy {
  @Input() entityId = '';
  @Input() entityType = '';
  @Input() compact = false;

  private destroy$ = new Subject<void>();
  notifications: ProcurementNotification[] = [];
  isLoading = false;
  retryingId: number | null = null;

  constructor(private notificationService: NotificationService) {}

  ngOnInit(): void {
    if (this.entityId) this.loadNotifications();
    this.notificationService.notifications$.pipe(takeUntil(this.destroy$)).subscribe(list => {
      if (list.length) this.notifications = list;
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadNotifications(): void {
    this.isLoading = true;
    this.notificationService.getForEntity(this.entityId, this.entityType).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: list => { this.notifications = list; this.isLoading = false; },
      error: () => { this.isLoading = false; }
    });
  }

  retry(n: ProcurementNotification): void {
    this.retryingId = n.id;
    this.notificationService.retryFailed(n.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: updated => {
        this.notifications = this.notifications.map(x => x.id === updated.id ? updated : x);
        this.retryingId = null;
      },
      error: () => { this.retryingId = null; }
    });
  }

  getStatusIcon(status: NotificationStatus): string {
    const map: Record<NotificationStatus, string> = {
      PENDING:   '⏳',
      SENT:      '📤',
      DELIVERED: '✅',
      FAILED:    '❌',
      BOUNCED:   '↩️'
    };
    return map[status] ?? '•';
  }

  getTypeLabel(type: NotificationType): string {
    const map: Partial<Record<NotificationType, string>> = {
      RFQ_SENT:             'RFQ Sent to Vendor',
      QUOTATION_RECEIVED:   'Quotation Received',
      QUOTATION_ACCEPTED:   'Quotation Accepted',
      QUOTATION_REJECTED:   'Quotation Rejected',
      REVISION_REQUESTED:   'Revision Requested',
      LPO_ISSUED:           'LPO Issued',
      DELIVERY_SCHEDULED:   'Delivery Scheduled',
      DELIVERY_UPDATE:      'Delivery Update',
      GRN_SUBMITTED:        'GRN Submitted',
      PAYMENT_PROCESSED:    'Payment Processed',
      PAYMENT_RECEIPT:      'Payment Receipt Sent'
    };
    return map[type] ?? type;
  }

  get sentCount(): number {
    return this.notifications.filter(n => n.status === 'DELIVERED').length;
  }

  get failedCount(): number {
    return this.notifications.filter(n => n.status === 'FAILED' || n.status === 'BOUNCED').length;
  }
}
