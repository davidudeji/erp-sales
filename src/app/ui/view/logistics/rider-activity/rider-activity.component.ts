import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import {
  Rider,
  RiderPerformanceStat,
  AuditLogEntry,
  AuditLogFilter,
  getRiderStatusBadgeClass
} from '../../../domain/logistics/logistics.dto';

type ActivityTab = 'roster' | 'performance' | 'audit';

@Component({
  selector: 'app-rider-activity',
  templateUrl: './rider-activity.component.html',
  styleUrl: './rider-activity.component.scss'
})
export class RiderActivityComponent implements OnInit, OnDestroy {
  private readonly destroy$ = new Subject<void>();

  activeTab: ActivityTab = 'roster';

  // Roster
  riders: Rider[] = [];
  isRosterLoading = true;
  showAddRider = false;
  selectedRider: Rider | null = null;

  // Performance
  performanceStats: RiderPerformanceStat[] = [];
  activeRidersCount = 0;
  avgDeliveryRate = 0;
  avgTimePerOrder = 0;
  hoardingRiskCount = 0;
  isPerformanceLoading = true;

  // Audit log
  auditEntries: AuditLogEntry[] = [];
  isAuditLoading = true;
  auditFilter: AuditLogFilter = {};
  activeOrderFilterChip: string | null = null;

  readonly getRiderStatusBadgeClass = getRiderStatusBadgeClass;

  readonly rosterColumns = [
    { header: 'Rider' },
    { header: 'Status' },
    { header: 'Vehicle' },
    { header: 'Current Load' },
    { header: 'Contact' }
  ];

  readonly performanceColumns = [
    { header: 'Rider Name', field: 'riderName', sortable: true },
    { header: 'Orders (wk)', field: 'ordersClaimedWeek', sortable: true },
    { header: 'Delivered', field: 'delivered', sortable: true },
    { header: 'Failed', field: 'failed', sortable: true },
    { header: 'Avg. Time', field: 'avgTimeMinutes', sortable: true },
    { header: 'Approval Wait', field: 'avgApprovalWaitMinutes', sortable: true }
  ];

  readonly auditColumns = [
    { header: 'Timestamp' },
    { header: 'Actor' },
    { header: 'Action Details' },
    { header: 'Transition' }
  ];

  constructor(private logisticsService: LogisticsService) {}

  ngOnInit(): void {
    this.loadRoster();
    this.loadPerformance();
    this.loadAuditLog();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  setTab(tab: ActivityTab): void {
    this.activeTab = tab;
  }

  // ============================================================
  // PART A(i) — ROSTER
  // ============================================================

  loadRoster(): void {
    this.isRosterLoading = true;
    this.logisticsService
      .getRiderRoster()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.riders = res.riders;
        this.isRosterLoading = false;
      });
  }

  openAddRider(): void {
    this.showAddRider = true;
  }

  closeAddRider(): void {
    this.showAddRider = false;
  }

  onRiderCreated(rider: Rider): void {
    this.showAddRider = false;
    this.loadRoster();
  }

  openRiderDetail(rider: Rider): void {
    this.selectedRider = rider;
  }

  closeRiderDetail(): void {
    this.selectedRider = null;
  }

  // ============================================================
  // PART A(ii) — PERFORMANCE
  // ============================================================

  loadPerformance(): void {
    this.isPerformanceLoading = true;
    this.logisticsService
      .getRiderPerformance()
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.performanceStats = res.stats;
        this.activeRidersCount = res.activeRiders;
        this.avgDeliveryRate = res.avgDeliveryRate;
        this.avgTimePerOrder = res.avgTimePerOrderMinutes;
        this.hoardingRiskCount = res.hoardingRiskCount;
        this.isPerformanceLoading = false;
      });
  }

  // ============================================================
  // PART B — AUDIT LOG
  // ============================================================

  loadAuditLog(): void {
    this.isAuditLoading = true;
    this.logisticsService
      .getSystemAuditLog(this.auditFilter)
      .pipe(takeUntil(this.destroy$))
      .subscribe((res) => {
        this.auditEntries = res.entries;
        this.isAuditLoading = false;
      });
  }

  onAuditSearchChange(value: string): void {
    this.auditFilter = { ...this.auditFilter, orderId: value || undefined };
    this.loadAuditLog();
  }

  /** Called from other components to deep-link into a specific order's history. */
  filterByOrder(orderDisplayId: string): void {
    this.activeOrderFilterChip = orderDisplayId;
    this.auditFilter = { ...this.auditFilter, orderId: orderDisplayId };
    this.activeTab = 'audit';
    this.loadAuditLog();
  }

  clearOrderFilter(): void {
    this.activeOrderFilterChip = null;
    this.auditFilter = { ...this.auditFilter, orderId: undefined };
    this.loadAuditLog();
  }

  exportCsv(): void {
    const header = 'Timestamp,Actor,Action,From,To\n';
    const rows = this.auditEntries
      .map((e) => `"${e.timestamp}","${e.actor}","${e.action.replace(/"/g, '""')}","${e.fromStatus}","${e.toStatus}"`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
