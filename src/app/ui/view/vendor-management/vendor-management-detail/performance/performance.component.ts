// vendor-performance.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, Input } from '@angular/core';
import { VendorPerformanceMetrics } from '../../../../domain/vendor-management/vendor-management.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-vendor-performance',
  templateUrl: './performance.component.html',
  styleUrls: ['./performance.component.scss']
})
export class VendorPerformanceComponent {

  // ============================================================
  // INPUTS
  // ============================================================

  /** The performance metrics to display */
  @Input() performance: VendorPerformanceMetrics | null = null;

  // ============================================================
  // UI HELPERS
  // ============================================================

  Math = Math;
  parseFloat = parseFloat;

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getPerformanceColor(score: number): string {
    if (score >= 80) return '#2EB270';
    if (score >= 60) return '#F5A623';
    if (score >= 40) return '#F97316';
    return '#DC2626';
  }

  getPerformanceLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  parseKpiValue(val: any): number {
    if (typeof val === 'number') return val;
    return parseFloat(val) || 0;
  }

  formatDate(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatCurrency(value: number): string {
    if (!value) return '—';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    if (!value) return '—';
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  // ============================================================
  // CHART HELPERS (for inline SVG charts)
  // ============================================================

  getPerformanceScores(): number[] {
    return this.performance?.trendData?.map(d => d.score) || [];
  }

  getMaxPerformance(): number {
    if (!this.performance?.trendData || this.performance.trendData.length === 0) return 100;
    const max = Math.max(...this.performance.trendData.map(d => d.score));
    return Math.ceil(max / 10) * 10 + 10;
  }

  getPointX(index: number, total: number): number {
    const padding = 40;
    const width = 500 - padding * 2;
    return padding + (index / (total - 1 || 1)) * width;
  }

  getPointY(value: number, max: number): number {
    const padding = 20;
    const height = 260 - padding * 2;
    return padding + height - (value / max) * height;
  }

  getPerformanceChartPath(data: number[], max: number): string {
    if (!data || data.length === 0) return '';

    return data.map((d, i) => {
      const x = this.getPointX(i, data.length);
      const y = this.getPointY(d, max);
      return (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }).join(' ');
  }

  getPerformanceChartAreaPath(data: number[], max: number): string {
    if (!data || data.length === 0) return '';

    const path = data.map((d, i) => {
      const x = this.getPointX(i, data.length);
      const y = this.getPointY(d, max);
      return (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }).join(' ');

    const lastX = this.getPointX(data.length - 1, data.length);
    const firstX = this.getPointX(0, data.length);
    const baseY = this.getPointY(0, max);
    return path + ` L${lastX},${baseY} L${firstX},${baseY} Z`;
  }
}