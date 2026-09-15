import { AfterViewInit, Component, ElementRef, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import { DeliveryBatch, FailureReason, ProofType, RouteStop, StopStatus, getFailureReasonLabel } from '../../../domain/logistics/logistics.dto';

type ActionMode = 'delivered' | 'failed';
type CaptureMode = 'signature' | 'photo' | 'code' | null;

interface PendingAction {
  id: string;
  orderId: string;
  kind: 'delivered' | 'failed';
  payload: any;
}

const OFFLINE_QUEUE_KEY = 'logistics_rider_offline_queue';

@Component({
  selector: 'app-stop-checklist',
  templateUrl: './stop-checklist.component.html',
  styleUrl: './stop-checklist.component.scss'
})
export class StopChecklistComponent implements OnInit, AfterViewInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  batch: DeliveryBatch | null = null;
  isLoading = true;

  selectedStop: RouteStop | null = null;
  actionMode: ActionMode = 'delivered';

  // Delivered form
  captureMode: CaptureMode = 'signature';
  signatureDataUrl: string | null = null;
  photoDataUrl: string | null = null;
  accessCode = '';
  receiverName = '';

  // Failed form
  selectedReason: FailureReason | null = null;
  failureNote = '';

  isSubmittingAction = false;

  // Offline handling
  isOnline = navigator.onLine;
  pendingSync = new Set<string>();
  private pendingQueue: PendingAction[] = [];

  @ViewChild('sigCanvas') sigCanvasRef?: ElementRef<HTMLCanvasElement>;
  private sigCtx: CanvasRenderingContext2D | null = null;
  private drawing = false;

  readonly StopStatus = StopStatus;
  readonly FailureReason = FailureReason;
  readonly getFailureReasonLabel = getFailureReasonLabel;
  readonly failureReasons = [FailureReason.NOT_HOME, FailureReason.REFUSED, FailureReason.WRONG_ADDRESS, FailureReason.DAMAGED, FailureReason.OTHER];

  constructor(private logisticsService: LogisticsService) {}

  ngOnInit(): void {
    this.loadBatch();
    this.restoreOfflineQueue();
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);
  }

  ngAfterViewInit(): void {}

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    window.removeEventListener('online', this.handleOnline);
    window.removeEventListener('offline', this.handleOffline);
  }

  private handleOnline = () => {
    this.isOnline = true;
    this.flushOfflineQueue();
  };
  private handleOffline = () => {
    this.isOnline = false;
  };

  loadBatch(): void {
    this.isLoading = true;
    this.logisticsService
      .getActiveBatch()
      .pipe(takeUntil(this.destroy$))
      .subscribe((batch) => {
        this.batch = batch;
        this.isLoading = false;
        this.autoSelectStop();
      });
  }

  private autoSelectStop(): void {
    if (!this.batch) {
      this.selectedStop = null;
      return;
    }
    const stillOpen = this.selectedStop && this.batch.proposedRoute.some((s) => s.orderId === this.selectedStop!.orderId && (s.stopStatus === StopStatus.PENDING || s.stopStatus === StopStatus.EN_ROUTE));
    if (!stillOpen) {
      this.selectedStop = this.nextStop;
    }
  }

  // ============================================================
  // PROGRESS
  // ============================================================

  get doneCount(): number {
    if (!this.batch) return 0;
    return this.batch.proposedRoute.filter((s) => s.stopStatus === StopStatus.DELIVERED || s.stopStatus === StopStatus.FAILED).length;
  }
  get totalCount(): number {
    return this.batch?.proposedRoute.length ?? 0;
  }
  get isRouteComplete(): boolean {
    return this.totalCount > 0 && this.doneCount === this.totalCount;
  }
  get deliveredCount(): number {
    return this.batch?.proposedRoute.filter((s) => s.stopStatus === StopStatus.DELIVERED).length ?? 0;
  }
  get failedCount(): number {
    return this.batch?.proposedRoute.filter((s) => s.stopStatus === StopStatus.FAILED).length ?? 0;
  }
  get pendingCount(): number {
    return this.batch?.proposedRoute.filter((s) => s.stopStatus === StopStatus.PENDING || s.stopStatus === StopStatus.EN_ROUTE).length ?? 0;
  }
  get nextStop(): RouteStop | null {
    return this.batch?.proposedRoute.find((s) => s.stopStatus === StopStatus.PENDING || s.stopStatus === StopStatus.EN_ROUTE) ?? null;
  }

  get openStops(): RouteStop[] {
    return this.batch?.proposedRoute.filter((s) => s.stopStatus === StopStatus.PENDING || s.stopStatus === StopStatus.EN_ROUTE) ?? [];
  }
  get completedStops(): RouteStop[] {
    return this.batch?.proposedRoute.filter((s) => s.stopStatus === StopStatus.DELIVERED || s.stopStatus === StopStatus.FAILED) ?? [];
  }

  // ============================================================
  // MASTER-DETAIL SELECTION
  // ============================================================

  markEnRoute(stop: RouteStop, event?: Event): void {
    event?.stopPropagation();
    this.logisticsService
      .markStopEnRoute(stop.orderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe((batch) => {
        if (batch) this.batch = batch;
      });
  }

  selectStop(stop: RouteStop): void {
    if (stop.stopStatus === StopStatus.DELIVERED || stop.stopStatus === StopStatus.FAILED) return;
    this.selectedStop = stop;
    this.actionMode = 'delivered';
    this.resetDeliveredForm();
  }

  /** Mobile: tapping a stop navigates to the full-screen detail; this clears that selection to return to the list. */
  backToList(): void {
    this.selectedStop = null;
  }

  setActionMode(mode: ActionMode): void {
    this.actionMode = mode;
    if (mode === 'failed') {
      this.selectedReason = null;
      this.failureNote = '';
    } else {
      this.resetDeliveredForm();
    }
  }

  // ============================================================
  // DELIVERED FLOW
  // ============================================================

  private resetDeliveredForm(): void {
    this.captureMode = 'signature';
    this.signatureDataUrl = null;
    this.photoDataUrl = null;
    this.accessCode = '';
    this.receiverName = '';
    if (this.captureMode === 'signature') setTimeout(() => this.initSignaturePad(), 0);
  }

  setCaptureMode(mode: CaptureMode): void {
    this.captureMode = mode;
    if (mode === 'signature') setTimeout(() => this.initSignaturePad(), 0);
  }

  private initSignaturePad(): void {
    const canvas = this.sigCanvasRef?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    this.sigCtx = ctx;
    ctx.strokeStyle = '#14181b';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    const getPos = (e: MouseEvent | TouchEvent): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      const point = 'touches' in e ? e.touches[0] : e;
      return { x: point.clientX - rect.left, y: point.clientY - rect.top };
    };
    const start = (e: MouseEvent | TouchEvent) => {
      this.drawing = true;
      const { x, y } = getPos(e);
      ctx.beginPath();
      ctx.moveTo(x, y);
    };
    const move = (e: MouseEvent | TouchEvent) => {
      if (!this.drawing) return;
      e.preventDefault();
      const { x, y } = getPos(e);
      ctx.lineTo(x, y);
      ctx.stroke();
    };
    const end = () => {
      this.drawing = false;
      this.signatureDataUrl = canvas.toDataURL();
    };

    canvas.onmousedown = start;
    canvas.onmousemove = move;
    canvas.onmouseup = end;
    canvas.ontouchstart = start;
    canvas.ontouchmove = move;
    canvas.ontouchend = end;
  }

  clearSignature(): void {
    const canvas = this.sigCanvasRef?.nativeElement;
    if (canvas && this.sigCtx) this.sigCtx.clearRect(0, 0, canvas.width, canvas.height);
    this.signatureDataUrl = null;
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => (this.photoDataUrl = reader.result as string);
    reader.readAsDataURL(file);
  }

  get hasProof(): boolean {
    return !!this.signatureDataUrl || !!this.photoDataUrl || !!this.accessCode.trim();
  }

  confirmDelivered(): void {
    if (!this.selectedStop || !this.hasProof) return;
    const proofType = this.signatureDataUrl ? ProofType.SIGNATURE : this.photoDataUrl ? ProofType.PHOTO : ProofType.CODE;
    const proofValue = this.signatureDataUrl || this.photoDataUrl || this.accessCode.trim();
    const orderId = this.selectedStop.orderId;

    if (!this.isOnline) {
      this.queueOffline({ id: `${orderId}-${Date.now()}`, orderId, kind: 'delivered', payload: { proofType, proofValue, receiverName: this.receiverName } });
      this.applyLocalStopStatus(orderId, StopStatus.DELIVERED);
      this.autoSelectStop();
      return;
    }

    this.isSubmittingAction = true;
    this.logisticsService
      .markStopDelivered(orderId, proofType, proofValue, this.receiverName || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe((batch) => {
        if (batch) this.batch = batch;
        this.isSubmittingAction = false;
        this.autoSelectStop();
      });
  }

  // ============================================================
  // FAILED FLOW
  // ============================================================

  confirmFailed(): void {
    if (!this.selectedStop || !this.selectedReason) return;
    const orderId = this.selectedStop.orderId;

    if (!this.isOnline) {
      this.queueOffline({ id: `${orderId}-${Date.now()}`, orderId, kind: 'failed', payload: { reason: this.selectedReason, note: this.failureNote || undefined } });
      this.applyLocalStopStatus(orderId, StopStatus.FAILED);
      this.autoSelectStop();
      return;
    }

    this.isSubmittingAction = true;
    this.logisticsService
      .markStopFailed(orderId, this.selectedReason, this.failureNote || undefined)
      .pipe(takeUntil(this.destroy$))
      .subscribe((batch) => {
        if (batch) this.batch = batch;
        this.isSubmittingAction = false;
        this.autoSelectStop();
      });
  }

  // ============================================================
  // OFFLINE QUEUE
  // ============================================================

  private applyLocalStopStatus(orderId: string, status: StopStatus): void {
    if (!this.batch) return;
    const stop = this.batch.proposedRoute.find((s) => s.orderId === orderId);
    if (stop) stop.stopStatus = status;
    this.pendingSync.add(orderId);
  }

  private queueOffline(action: PendingAction): void {
    this.pendingQueue.push(action);
    this.persistOfflineQueue();
  }

  private persistOfflineQueue(): void {
    try {
      localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(this.pendingQueue));
    } catch {
      // best-effort; in-memory queue still holds the actions this session
    }
  }

  private restoreOfflineQueue(): void {
    try {
      const raw = localStorage.getItem(OFFLINE_QUEUE_KEY);
      if (raw) {
        this.pendingQueue = JSON.parse(raw);
        this.pendingQueue.forEach((a) => this.pendingSync.add(a.orderId));
      }
    } catch {
      this.pendingQueue = [];
    }
  }

  private flushOfflineQueue(): void {
    if (!this.pendingQueue.length) return;
    const queue = [...this.pendingQueue];
    this.pendingQueue = [];
    this.persistOfflineQueue();

    queue.forEach((action) => {
      const request$ =
        action.kind === 'delivered'
          ? this.logisticsService.markStopDelivered(action.orderId, action.payload.proofType, action.payload.proofValue, action.payload.receiverName)
          : this.logisticsService.markStopFailed(action.orderId, action.payload.reason, action.payload.note);

      request$.pipe(takeUntil(this.destroy$)).subscribe((batch) => {
        if (batch) this.batch = batch;
        this.pendingSync.delete(action.orderId);
      });
    });
  }

  isPendingSync(stop: RouteStop): boolean {
    return this.pendingSync.has(stop.orderId);
  }
}
