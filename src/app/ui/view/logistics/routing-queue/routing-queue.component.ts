import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import {
  Order,
  Rider,
  FulfillmentType,
  AGING_THRESHOLD_MINUTES,
  formatDuration,
  minutesBetween
} from '../../../domain/logistics/logistics.dto';

type QueueTab = 'triage' | 'pool';

interface Toast {
  id: number;
  message: string;
}

@Component({
  selector: 'app-routing-queue',
  templateUrl: './routing-queue.component.html',
  styleUrl: './routing-queue.component.scss'
})
export class RoutingQueueComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  activeTab: QueueTab = 'triage';

  // Triage state
  triageOrders: Order[] = [];
  triageSearch = '';
  triageSelection: Order[] = [];
  isTriageLoading = true;

  // Pool state
  poolOrders: Order[] = [];
  poolAgingCount = 0;
  isPoolLoading = true;
  agingThresholdMinutes = AGING_THRESHOLD_MINUTES;

  // Riders (for force-assign)
  activeRiders: Rider[] = [];

  // Force-assign modal
  showForceAssignModal = false;
  forceAssignOrder: Order | null = null;
  forceAssignRiderId: string | null = null;
  isAssigning = false;

  // Order detail drawer
  selectedOrderId: string | null = null;

  // Toasts
  toasts: Toast[] = [];
  private toastCounter = 0;

  readonly formatDuration = formatDuration;
  readonly FulfillmentType = FulfillmentType;

  readonly triageColumns = [
    { header: 'Order ID' },
    { header: 'Customer Name' },
    { header: 'Items Summary' },
    { header: 'Location' },
    { header: 'Time Since Paid' },
    { header: 'Actions', align: 'right' as const }
  ];

  readonly poolColumns = [
    { header: 'Order ID' },
    { header: 'Customer Name' },
    { header: 'Items Summary' },
    { header: 'Location' },
    { header: 'Time in Pool' },
    { header: 'Actions', align: 'right' as const }
  ];

  constructor(private logisticsService: LogisticsService) {}

  ngOnInit(): void {
    this.loadTriage();
    this.loadPool();
    this.logisticsService
      .getActiveRiders()
      .pipe(takeUntil(this.destroy$))
      .subscribe((riders) => (this.activeRiders = riders));
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: QueueTab): void {
    this.activeTab = tab;
  }

  // ============================================================
  // TRIAGE (Part A)
  // ============================================================

  loadTriage(): void {
    this.isTriageLoading = true;
    this.logisticsService
      .getTriageOrders(this.triageSearch)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.triageOrders = res.orders;
        this.isTriageLoading = false;
        // drop selections that no longer exist in the fresh list
        const validIds = new Set(res.orders.map((o) => o.id));
        this.triageSelection = this.triageSelection.filter((o) => validIds.has(o.id));
      });
  }

  onSearchChange(value: string): void {
    this.triageSearch = value;
    this.loadTriage();
  }

  onSelectionChange(selection: Order[]): void {
    this.triageSelection = selection || [];
  }

  get selectedCount(): number {
    return this.triageSelection.length;
  }

  routeOne(order: Order, type: FulfillmentType.PICKUP | FulfillmentType.DELIVERY): void {
    this.logisticsService
      .routeOrder(order.id, type)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.triageOrders = this.triageOrders.filter((o) => o.id !== order.id);
        this.triageSelection = this.triageSelection.filter((o) => o.id !== order.id);
        this.pushToast(`${order.orderId} routed to ${type === FulfillmentType.PICKUP ? 'Pickup' : 'Delivery'}`);
        if (type === FulfillmentType.DELIVERY) this.loadPool();
      });
  }

  bulkRoute(type: FulfillmentType.PICKUP | FulfillmentType.DELIVERY): void {
    const ids = this.triageSelection.map((o) => o.id);
    if (!ids.length) return;
    this.logisticsService
      .bulkRouteOrders(ids, type)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        const idSet = new Set(ids);
        this.triageOrders = this.triageOrders.filter((o) => !idSet.has(o.id));
        this.pushToast(`${res.routed} order${res.routed === 1 ? '' : 's'} routed to ${type === FulfillmentType.PICKUP ? 'Pickup' : 'Delivery'}`);
        this.triageSelection = [];
        if (type === FulfillmentType.DELIVERY) this.loadPool();
      });
  }

  // ============================================================
  // POOL OVERSIGHT (Part B)
  // ============================================================

  loadPool(): void {
    this.isPoolLoading = true;
    this.logisticsService
      .getPoolOrders(this.agingThresholdMinutes)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.poolOrders = res.orders;
        this.poolAgingCount = res.agingCount;
        this.isPoolLoading = false;
      });
  }

  timeInPoolLabel(order: Order): string {
    const mins = order.timeInPoolMinutes ?? minutesBetween(order.enteredPoolAt || order.paidAt);
    return formatDuration(mins);
  }

  timeSincePaidLabel(order: Order): string {
    return formatDuration(minutesBetween(order.paidAt));
  }

  openForceAssign(order: Order): void {
    this.forceAssignOrder = order;
    this.forceAssignRiderId = null;
    this.showForceAssignModal = true;
  }

  closeForceAssign(): void {
    this.showForceAssignModal = false;
    this.forceAssignOrder = null;
    this.forceAssignRiderId = null;
  }

  confirmForceAssign(): void {
    if (!this.forceAssignOrder || !this.forceAssignRiderId) return;
    this.isAssigning = true;
    const rider = this.activeRiders.find((r) => r.id === this.forceAssignRiderId);
    this.logisticsService
      .forceAssignOrder(this.forceAssignOrder.id, this.forceAssignRiderId)
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.pushToast(`${this.forceAssignOrder!.orderId} assigned to ${rider?.name ?? 'rider'}.`);
        this.poolOrders = this.poolOrders.filter((o) => o.id !== this.forceAssignOrder!.id);
        this.isAssigning = false;
        this.closeForceAssign();
      });
  }

  // ============================================================
  // SHARED
  // ============================================================

  openOrderDetail(order: Order): void {
    this.selectedOrderId = order.id;
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
