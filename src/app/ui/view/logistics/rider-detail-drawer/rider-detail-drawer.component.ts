import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { LogisticsService } from '../../../service/logistics/logistics.service';
import { AuditLogEntry, Rider, RiderPerformanceStat, getRiderStatusBadgeClass } from '../../../domain/logistics/logistics.dto';

@Component({
  selector: 'app-rider-detail-drawer',
  templateUrl: './rider-detail-drawer.component.html',
  styleUrl: './rider-detail-drawer.component.scss'
})
export class RiderDetailDrawerComponent implements OnChanges {
  @Input() rider: Rider | null = null;
  @Output() closed = new EventEmitter<void>();

  stat: RiderPerformanceStat | null = null;
  history: AuditLogEntry[] = [];
  isLoading = false;

  readonly getRiderStatusBadgeClass = getRiderStatusBadgeClass;

  constructor(private logisticsService: LogisticsService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rider'] && this.rider) {
      this.load();
    }
  }

  private load(): void {
    if (!this.rider) return;
    this.isLoading = true;
    this.logisticsService.getRiderPerformance().subscribe((res) => {
      this.stat = res.stats.find((s) => s.riderName === this.rider!.name) ?? null;
    });
    this.logisticsService.getSystemAuditLog({ riderId: this.rider.name }).subscribe((res) => {
      this.history = res.entries;
      this.isLoading = false;
    });
  }

  close(): void {
    this.closed.emit();
  }
}
