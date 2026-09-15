// branch-stock-summary.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { BranchStockSummary } from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-branch-stock-summary',
  templateUrl: './branch-stock-summary.component.html',
  styleUrls: ['./branch-stock-summary.component.scss']
})
export class BranchStockSummaryComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() branchId: string = '';
  @Input() compact: boolean = false;
  @Input() showActions: boolean = true;
  @Input() refreshInterval: number = 60000; // 1 minute
  @Output() summaryLoaded = new EventEmitter<BranchStockSummary>();
  @Output() summaryError = new EventEmitter<string>();

  // ============================================================
  // STATE
  // ============================================================

  summary: BranchStockSummary | null = null;
  isLoading: boolean = true;
  error: string | null = null;
  lastUpdated: Date | null = null;

  // UI
  Math = Math;

  // Private
  private destroy$ = new Subject<void>();
  private refreshTimer: any;

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(private inventoryService: InventoryService) { }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadSummary();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.stopAutoRefresh();
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadSummary(): void {
    if (!this.branchId) {
      this.error = 'No branch selected';
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.error = null;

    this.inventoryService.getBranchAnalytics(this.branchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (summary) => {
          this.summary = summary;
          this.lastUpdated = new Date();
          this.isLoading = false;
          this.summaryLoaded.emit(summary);
        },
        error: (err) => {
          console.error('Failed to load branch summary:', err);
          this.error = 'Failed to load branch summary';
          this.isLoading = false;
          this.summaryError.emit('Failed to load branch summary');
        }
      });
  }

  // ============================================================
  // AUTO REFRESH
  // ============================================================

  private startAutoRefresh(): void {
    if (this.refreshInterval > 0) {
      this.refreshTimer = setInterval(() => {
        this.loadSummary();
      }, this.refreshInterval);
    }
  }

  private stopAutoRefresh(): void {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadSummary();
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getStockHealthStatus(): 'healthy' | 'warning' | 'danger' {
    if (!this.summary) return 'healthy';
    if (this.summary.outOfStockCount > 0) return 'danger';
    if (this.summary.lowStockCount > 0) return 'warning';
    return 'healthy';
  }

  getStockHealthLabel(): string {
    const status = this.getStockHealthStatus();
    const map = {
      'healthy': 'Healthy',
      'warning': 'Needs Attention',
      'danger': 'Critical'
    };
    return map[status];
  }

  getStockHealthIcon(): string {
    const status = this.getStockHealthStatus();
    const map = {
      'healthy': 'fa-check-circle',
      'warning': 'fa-exclamation-triangle',
      'danger': 'fa-times-circle'
    };
    return map[status];
  }

  getStockHealthColor(): string {
    const status = this.getStockHealthStatus();
    const map = {
      'healthy': '#2EB270',
      'warning': '#F5A623',
      'danger': '#DC2626'
    };
    return map[status];
  }

  formatCurrency(value: number): string {
    if (!value) return '₦0';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    if (!value) return '0';
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  formatTime(date: Date | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatDate(date: Date | null): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  getProgressPercentage(value: number, max: number): number {
    if (max === 0) return 0;
    return Math.min((value / max) * 100, 100);
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  navigateToBranch(): void {
    if (this.summary) {
      // Navigate to branch detail
      // This would need to be handled by the parent component
    }
  }

  navigateToInventory(): void {
    if (this.summary) {
      // Navigate to branch inventory
    }
  }
}