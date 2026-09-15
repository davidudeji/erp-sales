import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import { VendorService } from '../../../service/vendor-portal/vendor.service';
import { PerformanceStats, MonthlyMetric, ClientPerformance } from '../../../domain/vendor-portal/vendor.dto';

@Component({
  selector: 'app-performance',
  templateUrl: './performance.component.html',
  styleUrl: './performance.component.scss',
})
export class PerformanceComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  stats: PerformanceStats | null = null;

  constructor(private vendorService: VendorService) {}

  ngOnInit(): void {
    this.vendorService.getPerformanceStats()
      .pipe(take(1))
      .subscribe(s => this.stats = s);
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  // ── Chart helpers ─────────────────────────────────────────────────────────────
  // Returns bar height as a percentage of the max value in the dataset
  barHeight(value: number, allValues: number[]): number {
    const max = Math.max(...allValues);
    if (max === 0) return 0;
    return Math.round((value / max) * 100);
  }

  revenueValues(metrics: MonthlyMetric[]): number[] {
    return metrics.map(m => m.revenue);
  }

  maxRevenue(metrics: MonthlyMetric[]): number {
    return Math.max(...metrics.map(m => m.revenue));
  }

  // Win rate per month = won / quoted * 100
  winRate(m: MonthlyMetric): number {
    if (!m.quoted) return 0;
    return Math.round((m.won / m.quoted) * 100);
  }

  // Rating stars helper — returns array [1..5]
  stars(rating: number): { full: boolean; half: boolean }[] {
    return [1, 2, 3, 4, 5].map(i => ({
      full: i <= Math.floor(rating),
      half: i === Math.ceil(rating) && rating % 1 >= 0.5,
    }));
  }

  // ── Formatting ────────────────────────────────────────────────────────────────
  fmtCurrency(n: number, cur = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur,
      minimumFractionDigits: 0, maximumFractionDigits: 0,
    }).format(n);
  }

  fmtCurrencyShort(n: number): string {
    if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`;
    return `₦${n}`;
  }

  ratingColor(rate: number): string {
    if (rate >= 90) return 'text-green-600';
    if (rate >= 70) return 'text-amber-600';
    return 'text-red-500';
  }

  ratingBg(rate: number): string {
    if (rate >= 90) return 'bg-green-50';
    if (rate >= 70) return 'bg-amber-50';
    return 'bg-red-50';
  }

  growthColor(pct: number): string {
    return pct >= 0 ? 'text-green-600' : 'text-red-500';
  }
}