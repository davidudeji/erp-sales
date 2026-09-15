import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import {
  DeliveryAttempt,
  Order,
  FailureReason,
  getFailureReasonLabel,
  formatDuration,
  minutesBetween
} from '../../../domain/logistics/logistics.dto';

type RecordsTab = 'delivered' | 'failed' | 'pickups';

interface Toast {
  id: number;
  message: string;
}

@Component({
  selector: 'app-delivery-records',
  templateUrl: './delivery-records.component.html',
  styleUrl: './delivery-records.component.scss'
})
export class DeliveryRecordsComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  activeTab: RecordsTab = 'delivered';

  // Delivered
  deliveredAttempts: DeliveryAttempt[] = [];
  deliveredSearch = '';
  isDeliveredLoading = true;
  selectedProofAttempt: DeliveryAttempt | null = null;

  // Failed
  failedAttempts: DeliveryAttempt[] = [];
  isFailedLoading = true;
  showEscalateModal = false;
  escalatingAttempt: DeliveryAttempt | null = null;
  escalateNote = '';
  isActioning = false;

  // Pickups
  pickupOrders: Order[] = [];
  isPickupsLoading = true;
  showCollectConfirm = false;
  collectingOrder: Order | null = null;
  verificationCode = '';

  // Order detail drawer (row drill-in from Delivered/Pickups)
  selectedOrderId: string | null = null;

  toasts: Toast[] = [];
  private toastCounter = 0;

  readonly formatDuration = formatDuration;
  readonly getFailureReasonLabel = getFailureReasonLabel;
  readonly FailureReason = FailureReason;

  readonly deliveredColumns = [
    { header: 'Order ID' },
    { header: 'Customer' },
    { header: 'Rider' },
    { header: 'Timestamp' },
    { header: 'Status' },
    { header: 'POD', align: 'center' as const }
  ];

  readonly failedColumns = [
    { header: 'Order ID' },
    { header: 'Customer' },
    { header: 'Rider' },
    { header: 'Reason' },
    { header: 'Failed' },
    { header: 'Flag' },
    { header: 'Actions', align: 'right' as const }
  ];

  readonly pickupColumns = [
    { header: 'Order ID' },
    { header: 'Customer' },
    { header: 'Items' },
    { header: 'Waiting' },
    { header: 'Actions', align: 'right' as const }
  ];

  constructor(private logisticsService: LogisticsService) {}

  ngOnInit(): void {
    this.loadDelivered();
    this.loadFailed();
    this.loadPickups();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: RecordsTab): void {
    this.activeTab = tab;
  }

  // ============================================================
  // PART A — DELIVERED
  // ============================================================

  loadDelivered(): void {
    this.isDeliveredLoading = true;
    this.logisticsService
      .getDeliveredAttempts(this.deliveredSearch)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.deliveredAttempts = res.attempts;
        this.isDeliveredLoading = false;
      });
  }

  onDeliveredSearchChange(value: string): void {
    this.deliveredSearch = value;
    this.loadDelivered();
  }

  openProof(attempt: DeliveryAttempt): void {
    this.selectedProofAttempt = attempt;
  }

  closeProof(): void {
    this.selectedProofAttempt = null;
  }

  // ============================================================
  // PART B — FAILED / EXCEPTIONS
  // ============================================================

  loadFailed(): void {
    this.isFailedLoading = true;
    this.logisticsService
      .getFailedAttempts()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.failedAttempts = res.attempts;
        this.isFailedLoading = false;
      });
  }

  requeue(attempt: DeliveryAttempt): void {
    this.logisticsService
      .requeueFailedOrder(attempt.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.failedAttempts = this.failedAttempts.filter((a) => a.id !== attempt.id);
        this.pushToast(`${attempt.orderDisplayId} requeued to pool`);
      });
  }

  cancel(attempt: DeliveryAttempt): void {
    this.logisticsService
      .cancelFailedOrder(attempt.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.failedAttempts = this.failedAttempts.filter((a) => a.id !== attempt.id);
        this.pushToast(`${attempt.orderDisplayId} cancelled and closed`);
      });
  }

  openEscalate(attempt: DeliveryAttempt): void {
    this.escalatingAttempt = attempt;
    this.escalateNote = '';
    this.showEscalateModal = true;
  }

  closeEscalate(): void {
    this.showEscalateModal = false;
    this.escalatingAttempt = null;
    this.escalateNote = '';
  }

  confirmEscalate(): void {
    if (!this.escalatingAttempt || !this.escalateNote.trim()) return;
    this.isActioning = true;
    const displayId = this.escalatingAttempt.orderDisplayId;
    this.logisticsService
      .escalateFailedOrder(this.escalatingAttempt.id, this.escalateNote.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe((updated) => {
        const idx = this.failedAttempts.findIndex((a) => a.id === updated.id);
        if (idx > -1) this.failedAttempts[idx] = updated;
        this.pushToast(`${displayId} flagged for escalation`);
        this.isActioning = false;
        this.closeEscalate();
      });
  }

  // ============================================================
  // PART C — PICKUPS
  // ============================================================

  loadPickups(): void {
    this.isPickupsLoading = true;
    this.logisticsService
      .getPickupOrders()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.pickupOrders = res.orders;
        this.isPickupsLoading = false;
      });
  }

  openCollectConfirm(order: Order): void {
    this.collectingOrder = order;
    this.verificationCode = '';
    this.showCollectConfirm = true;
  }

  closeCollectConfirm(): void {
    this.showCollectConfirm = false;
    this.collectingOrder = null;
    this.verificationCode = '';
  }

  confirmCollected(): void {
    if (!this.collectingOrder) return;
    this.isActioning = true;
    const orderId = this.collectingOrder.orderId;
    const id = this.collectingOrder.id;
    this.logisticsService
      .markCollected(id, this.verificationCode || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.pickupOrders = this.pickupOrders.filter((o) => o.id !== id);
        this.pushToast(`${orderId} marked collected`);
        this.isActioning = false;
        this.closeCollectConfirm();
      });
  }

  // ============================================================
  // SHARED
  // ============================================================

  openOrderDetail(orderId: string): void {
    this.selectedOrderId = orderId;
  }

  closeOrderDetail(): void {
    this.selectedOrderId = null;
  }

  timeAgo(iso?: string): string {
    if (!iso) return '—';
    return formatDuration(minutesBetween(iso));
  }

  private pushToast(message: string): void {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message });
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 3500);
  }
}
