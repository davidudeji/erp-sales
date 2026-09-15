import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import {
  DeliveryBatch,
  BatchStatus,
  StopStatus,
  formatDuration,
  getStopStatusBadgeClass,
  minutesBetween
} from '../../../domain/logistics/logistics.dto';

type ApprovalTab = 'pending' | 'active';

interface Toast {
  id: number;
  message: string;
}

@Component({
  selector: 'app-route-approval',
  templateUrl: './route-approval.component.html',
  styleUrl: './route-approval.component.scss'
})
export class RouteApprovalComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  activeTab: ApprovalTab = 'pending';

  // Pending approval
  pendingBatches: DeliveryBatch[] = [];
  isPendingLoading = true;
  selectedBatch: DeliveryBatch | null = null;
  reviewNote = '';
  showRejectPanel = false;
  rejectNote = '';
  isSubmitting = false;

  // Active routes
  activeBatches: DeliveryBatch[] = [];
  isActiveLoading = true;

  // Order detail drawer (per-stop drill-in)
  selectedOrderId: string | null = null;

  toasts: Toast[] = [];
  private toastCounter = 0;

  readonly formatDuration = formatDuration;
  readonly getStopStatusBadgeClass = getStopStatusBadgeClass;
  readonly StopStatus = StopStatus;

  constructor(private logisticsService: LogisticsService) {}

  ngOnInit(): void {
    this.loadPending();
    this.loadActive();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: ApprovalTab): void {
    this.activeTab = tab;
  }

  // ============================================================
  // PART A — APPROVAL QUEUE
  // ============================================================

  loadPending(): void {
    this.isPendingLoading = true;
    this.logisticsService
      .getPendingApprovalBatches()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.pendingBatches = res.batches;
        this.isPendingLoading = false;
        if (!this.selectedBatch && res.batches.length) {
          this.selectBatch(res.batches[0]);
        } else if (this.selectedBatch) {
          const refreshed = res.batches.find((b) => b.id === this.selectedBatch!.id);
          this.selectedBatch = refreshed ?? null;
        }
      });
  }

  selectBatch(batch: DeliveryBatch): void {
    this.selectedBatch = batch;
    this.showRejectPanel = false;
    this.rejectNote = '';
    this.reviewNote = '';
  }

  waitLabel(batch: DeliveryBatch): string {
    const mins = batch.waitMinutes ?? minutesBetween(batch.submittedAt || batch.createdAt);
    return formatDuration(mins);
  }

  openRejectPanel(): void {
    this.showRejectPanel = true;
  }

  cancelReject(): void {
    this.showRejectPanel = false;
    this.rejectNote = '';
  }

  approveSelected(): void {
    if (!this.selectedBatch) return;
    this.isSubmitting = true;
    const riderName = this.selectedBatch.riderName;
    this.logisticsService
      .approveBatch(this.selectedBatch.id, this.reviewNote || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.pushToast(`Route approved — ${riderName} can now begin deliveries.`);
        this.isSubmitting = false;
        this.selectedBatch = null;
        this.loadPending();
        this.loadActive();
      });
  }

  submitReject(): void {
    if (!this.selectedBatch || !this.rejectNote.trim()) return;
    this.isSubmitting = true;
    const batchCode = this.selectedBatch.batchCode;
    this.logisticsService
      .rejectBatch(this.selectedBatch.id, this.rejectNote.trim())
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.pushToast(`${batchCode} sent back to rider for edits.`);
        this.isSubmitting = false;
        this.selectedBatch = null;
        this.showRejectPanel = false;
        this.rejectNote = '';
        this.loadPending();
      });
  }

  // ============================================================
  // PART B — LIVE TRACKING
  // ============================================================

  loadActive(): void {
    this.isActiveLoading = true;
    this.logisticsService
      .getActiveRouteBatches()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.activeBatches = res.batches;
        this.isActiveLoading = false;
      });
  }

  progressLabel(batch: DeliveryBatch): string {
    const done = batch.proposedRoute.filter((s) => s.stopStatus === StopStatus.DELIVERED || s.stopStatus === StopStatus.FAILED).length;
    return `${done} of ${batch.proposedRoute.length} done`;
  }

  progressPercent(batch: DeliveryBatch): number {
    if (!batch.proposedRoute.length) return 0;
    const done = batch.proposedRoute.filter((s) => s.stopStatus === StopStatus.DELIVERED || s.stopStatus === StopStatus.FAILED).length;
    return Math.round((done / batch.proposedRoute.length) * 100);
  }

  hasFailedStop(batch: DeliveryBatch): boolean {
    return batch.proposedRoute.some((s) => s.stopStatus === StopStatus.FAILED);
  }

  openOrderDetail(orderId: string): void {
    this.selectedOrderId = orderId;
  }

  closeOrderDetail(): void {
    this.selectedOrderId = null;
  }

  private pushToast(message: string): void {
    const id = ++this.toastCounter;
    this.toasts.push({ id, message });
    setTimeout(() => {
      this.toasts = this.toasts.filter((t) => t.id !== id);
    }, 3500);
  }
}
