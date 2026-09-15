import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { take, takeUntil } from 'rxjs/operators';
import {
  ApexAxisChartSeries,
  ApexChart,
  ApexXAxis,
  ApexYAxis,
  ApexDataLabels,
  ApexStroke,
  ApexLegend,
  ApexGrid,
  ApexTooltip,
  ApexNonAxisChartSeries,
  ApexPlotOptions,
} from 'ng-apexcharts';

import { VendorService } from '../../../service/vendor-portal/vendor.service';
import {
  VendorStats,
  PerformanceStats,
  Quotation,
  Rfq,
  Lpo,
  LpoStatus,
  MonthlyMetric,
} from '../../../domain/vendor-portal/vendor.dto';
import { TableColumn } from '../../../shared-component/view/table/table.component';

// ── Chart option shapes ──────────────────────────────────────────────────────
// Same ApexCharts config pattern used elsewhere in the app (see
// shared-component/customer-fulfilment) — kept as plain option bags so the
// template can bind each piece straight to <apx-chart>.
export type TrendChartOptions = {
  series: ApexAxisChartSeries;
  chart: ApexChart;
  xaxis: ApexXAxis;
  yaxis: ApexYAxis;
  colors: string[];
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  legend: ApexLegend;
  grid: ApexGrid;
  tooltip: ApexTooltip;
};

export type PipelineChartOptions = {
  series: ApexNonAxisChartSeries;
  chart: ApexChart;
  labels: string[];
  colors: string[];
  stroke: ApexStroke;
  dataLabels: ApexDataLabels;
  legend: ApexLegend;
  plotOptions: ApexPlotOptions;
  tooltip: ApexTooltip;
};

@Component({
  selector: 'app-vendor-dashboard',
  templateUrl: './vendor-dashboard.component.html',
  styleUrl: './vendor-dashboard.component.scss',
})
export class VendorDashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  stats: VendorStats | null = null;
  perfStats: PerformanceStats | null = null;

  upcomingRfqs: Rfq[] = [];
  recentQuotations: Quotation[] = [];
  recentLpos: Lpo[] = [];

  // Which table the quick-access panel is showing — lets a vendor check
  // recent orders or quotations right from the dashboard, without switching tabs.
  quickAccessView: 'orders' | 'quotations' = 'orders';

  trendChart: Partial<TrendChartOptions> = {};
  pipelineChart: Partial<PipelineChartOptions> = {};

  // Column configs for <app-table> — the same shared data-table component
  // used on the RFQ/Quotations page, so these mini "quick access" tables
  // are visually identical to it rather than a second, plainer table style.
  // appTableBody overrides the <td> rendering but header count/order must
  // still match these column arrays exactly.
  upcomingRfqColumns: TableColumn[] = [
    { header: 'RFQ', field: 'rfqNumber' },
    { header: 'Client', field: 'clientName' },
    { header: 'Due', align: 'right' },
    { header: 'Status', align: 'right' },
  ];

  recentLpoColumns: TableColumn[] = [
    { header: 'Order', field: 'lpoNumber' },
    { header: 'Client', field: 'clientName' },
    { header: 'Items' },
    { header: 'Amount', align: 'right' },
    { header: 'Delivery', align: 'right' },
    { header: 'Status', align: 'right' },
  ];

  recentQuotationColumns: TableColumn[] = [
    { header: 'Quotation', field: 'quotationNumber' },
    { header: 'Client', field: 'clientName' },
    { header: 'Valid Until', align: 'right' },
    { header: 'Total', align: 'right' },
    { header: 'Status', align: 'right' },
  ];

  constructor(private vendorService: VendorService) {}

  ngOnInit(): void {
    this.vendorService.loadRfqs();

    // Load vendor summary stats
    this.vendorService
      .getVendorStats()
      .pipe(take(1))
      .subscribe((s) => {
        this.stats = s;
        this.buildPipelineChart(s);
      });

    // Load performance stats (win rate, revenue, rating)
    this.vendorService
      .getPerformanceStats()
      .pipe(take(1))
      .subscribe((p) => {
        this.perfStats = p;
        this.buildTrendChart(p.monthlyMetrics);
      });

    // Load RFQs — show those closing soonest
    this.vendorService
      .getRfqs()
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => {
        const now = new Date();
        this.upcomingRfqs = list
          .filter((r) => r.status === 'open' && new Date(r.dueDate) >= now)
          .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
          .slice(0, 5);
      });

    // Load quotations — most recent first
    this.vendorService
      .getQuotations()
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => {
        this.recentQuotations = [...list]
          .sort((a, b) => new Date(b.createdDate).getTime() - new Date(a.createdDate).getTime())
          .slice(0, 5);
      });

    // Load LPOs (accepted orders) — most recent first. Powers the quick-access
    // "Orders" table so a vendor can see what's just come in without leaving
    // the dashboard.
    this.vendorService
      .getLpos()
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => {
        this.recentLpos = list.slice(0, 5);
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ── Quick-action navigation helpers ──────────────────────────────────────────
  // These emit a string that the parent tab component can intercept,
  // or you can wire them up to your router / tab-switch service.
  navigateTo(tab: 'rfq' | 'quotation' | 'lpo'): void {
    // Replace with your actual tab-switch logic / router.navigate
    console.log('Navigate to:', tab);
  }

  setQuickAccessView(view: 'orders' | 'quotations'): void {
    this.quickAccessView = view;
  }

  // ── Deadline helpers ──────────────────────────────────────────────────────────
  daysUntil(d: Date): number {
    const ms = new Date(d).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / (1000 * 60 * 60 * 24)));
  }

  isDueSoon(d: Date): boolean {
    return this.daysUntil(d) <= 3;
  }

  dueBadgeClass(rfq: Rfq): string {
    const days = this.daysUntil(rfq.dueDate);
    if (days <= 1) return 'deadline-critical';
    if (days <= 3) return 'deadline-urgent';
    return 'deadline-normal';
  }

  // ── Rating stars ─────────────────────────────────────────────────────────────
  stars(rating: number): { full: boolean; half: boolean }[] {
    return [1, 2, 3, 4, 5].map((i) => ({
      full: i <= Math.floor(rating),
      half: i === Math.ceil(rating) && rating % 1 >= 0.5,
    }));
  }

  // ── Quotation badge ───────────────────────────────────────────────────────────
  quotBadge(status: string): string {
    const map: Record<string, string> = {
      draft:               'badge badge-draft',
      sent:                'badge badge-sent',
      revision_requested:  'badge badge-revision_requested',
      accepted:            'badge badge-accepted',
      rejected:            'badge badge-rejected',
      withdrawn:           'badge badge-withdrawn',
    };
    return map[status] ?? 'badge';
  }

  quotStatusLabel(status: string): string {
    const map: Record<string, string> = {
      draft:               'Draft',
      sent:                'Sent',
      revision_requested:  'Needs Revision',
      accepted:            'Accepted',
      rejected:            'Rejected',
      withdrawn:           'Withdrawn',
    };
    return map[status] ?? status;
  }

  // ── RFQ badge ────────────────────────────────────────────────────────────────
  rfqBadge(status: string): string {
    const map: Record<string, string> = {
      open:      'badge badge-open',
      converted: 'badge badge-converted',
      expired:   'badge badge-expired',
      closed:    'badge badge-closed',
    };
    return map[status] ?? 'badge';
  }

  // ── LPO / order badge ─────────────────────────────────────────────────────────
  lpoBadge(status: LpoStatus | string): string {
    const map: Record<string, string> = {
      pending:   'badge badge-pending',
      accepted:  'badge badge-accepted',
      fulfilled: 'badge badge-fulfilled',
      rejected:  'badge badge-rejected',
      cancelled: 'badge badge-cancelled',
    };
    return map[status] ?? 'badge';
  }

  lpoStatusLabel(status: LpoStatus | string): string {
    const map: Record<string, string> = {
      pending:   'Pending',
      accepted:  'Accepted',
      fulfilled: 'Fulfilled',
      rejected:  'Rejected',
      cancelled: 'Cancelled',
    };
    return map[status] ?? status;
  }

  // ── Status → (tone, icon) for <app-vp-status> ──────────────────────────────────
  // Same mapping used on the RFQ page — shape carries the meaning, colour reinforces it.
  rfqStatusTone(s: string): 'info' | 'success' | 'danger' | 'neutral' {
    const map: Record<string, 'info' | 'success' | 'danger' | 'neutral'> = {
      open: 'info', converted: 'success', expired: 'danger', closed: 'neutral',
    };
    return map[s] ?? 'neutral';
  }
  rfqStatusIcon(s: string): 'dot' | 'check' | 'x' | 'dash' {
    const map: Record<string, 'dot' | 'check' | 'x' | 'dash'> = {
      open: 'dot', converted: 'check', expired: 'x', closed: 'dash',
    };
    return map[s] ?? 'dot';
  }
  quotStatusTone(s: string): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
    const map: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
      draft: 'neutral', sent: 'info', revision_requested: 'warning', accepted: 'success', rejected: 'danger', withdrawn: 'neutral',
    };
    return map[s] ?? 'neutral';
  }
  quotStatusIcon(s: string): 'dash' | 'clock' | 'half' | 'check' | 'x' {
    const map: Record<string, 'dash' | 'clock' | 'half' | 'check' | 'x'> = {
      draft: 'dash', sent: 'clock', revision_requested: 'half', accepted: 'check', rejected: 'x', withdrawn: 'dash',
    };
    return map[s] ?? 'dash';
  }
  lpoStatusTone(s: string): 'warning' | 'success' | 'info' | 'danger' | 'neutral' {
    const map: Record<string, 'warning' | 'success' | 'info' | 'danger' | 'neutral'> = {
      pending: 'warning', accepted: 'info', fulfilled: 'success', rejected: 'danger', cancelled: 'neutral',
    };
    return map[s] ?? 'neutral';
  }
  lpoStatusIcon(s: string): 'clock' | 'dot' | 'check' | 'x' | 'dash' {
    const map: Record<string, 'clock' | 'dot' | 'check' | 'x' | 'dash'> = {
      pending: 'clock', accepted: 'dot', fulfilled: 'check', rejected: 'x', cancelled: 'dash',
    };
    return map[s] ?? 'dot';
  }

  // ── Hero sparkline ────────────────────────────────────────────────────────────
  // A quiet 6-point line built from the same monthly revenue history the trend
  // chart already renders — gives the revenue hero tile some texture without
  // asking for another full chart. Points are normalised into a fixed
  // viewBox so it never needs the actual pixel scale of the parent element.
  sparklinePoints(metrics: MonthlyMetric[] | undefined): string {
    if (!metrics || metrics.length < 2) return '';
    const values = metrics.map((m) => m.revenue);
    const max = Math.max(...values, 1);
    const min = Math.min(...values, 0);
    const range = max - min || 1;
    const w = 100;
    const h = 32;
    const stepX = w / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * stepX;
        const y = h - ((v - min) / range) * h;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  }

  // ── Rating stars (data already existed via getPerformanceStats — just wasn't rendered) ──
  ratingLabel(rating: number): string {
    return rating.toFixed(1);
  }

  // ── Formatting helpers ────────────────────────────────────────────────────────
  fmtDate(d: Date | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NG', {
      day:   '2-digit',
      month: 'short',
      year:  'numeric',
    });
  }

  fmtCurrencyShort(n: number): string {
    if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`;
    if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`;
    return `₦${n}`;
  }

  fmtCurrency(n: number, cur = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
      style:                'currency',
      currency:             cur,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  }

  // ── Win-rate ring offset ─────────────────────────────────────────────────────
  // SVG circle circumference = 2π × r ; r = 26  →  ~163.36
  winRateOffset(rate: number): number {
    const circumference = 2 * Math.PI * 26;
    return circumference - (rate / 100) * circumference;
  }

  // ── Client initials (top-clients avatar) ──────────────────────────────────────
  initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w.charAt(0).toUpperCase())
      .join('');
  }

  // ── Chart builders ────────────────────────────────────────────────────────────
  private buildTrendChart(metrics: MonthlyMetric[]): void {
    this.trendChart = {
      series: [
        { name: 'RFQs Received', data: metrics.map((m) => m.rfqs) },
        { name: 'Quoted',        data: metrics.map((m) => m.quoted) },
        { name: 'Won',           data: metrics.map((m) => m.won) },
      ],
      chart: {
        type: 'line',
        height: 272,
        toolbar: { show: false },
        zoom: { enabled: false },
        fontFamily: 'inherit',
      },
      colors: ['#c3ccd2', '#224957', '#17845a'],
      stroke: { curve: 'smooth', width: [2, 2, 3] },
      dataLabels: { enabled: false },
      xaxis: {
        categories: metrics.map((m) => m.month.split(' ')[0]),
        axisBorder: { show: false },
        axisTicks:  { show: false },
        labels: { style: { colors: '#9aa7ae', fontSize: '11px', fontFamily: 'inherit' } },
      },
      yaxis: {
        labels: { style: { colors: '#9aa7ae', fontSize: '11px', fontFamily: 'inherit' } },
      },
      legend: {
        position: 'top',
        horizontalAlign: 'right',
        fontSize: '11px',
        fontFamily: 'inherit',
        labels: { colors: '#566670' },
      },
      grid: {
        borderColor: '#eef2f5',
        strokeDashArray: 4,
        yaxis: { lines: { show: true } },
        xaxis: { lines: { show: false } },
        padding: { left: 8, right: 8, top: 0, bottom: 0 },
      },
      tooltip: {
        theme: 'light',
        y: { formatter: (v: number) => `${v}` },
      },
    };
  }

  private buildPipelineChart(stats: VendorStats): void {
    const other = Math.max(
      0,
      stats.totalQuotations -
        stats.draftQuotations -
        stats.sentQuotations -
        stats.acceptedQuotations -
        stats.revisionRequestedQuotations,
    );
    this.pipelineChart = {
      series: [
        stats.draftQuotations,
        stats.sentQuotations,
        stats.revisionRequestedQuotations,
        stats.acceptedQuotations,
        other,
      ],
      chart: { type: 'donut', height: 272, fontFamily: 'inherit' },
      labels: ['Draft', 'Sent', 'Needs Revision', 'Accepted', 'Rejected / Other'],
      colors: ['#9aa7ae', '#2461d9', '#b3690a', '#17845a', '#e5eaed'],
      stroke: { show: true, width: 2, colors: ['#ffffff'] },
      dataLabels: { enabled: false },
      legend: {
        position: 'bottom',
        fontSize: '11px',
        fontFamily: 'inherit',
        labels: { colors: '#566670' },
        itemMargin: { horizontal: 8, vertical: 3 },
      },
      plotOptions: {
        pie: {
          donut: {
            size: '72%',
            labels: {
              show: true,
              name:  { show: true, fontSize: '11px', color: '#9aa7ae', offsetY: 20 },
              value: { show: true, fontSize: '22px', fontWeight: 700, color: '#14181b', offsetY: -16 },
              total: {
                show: true,
                showAlways: true,
                label: 'Win Rate',
                fontSize: '11px',
                color: '#9aa7ae',
                formatter: () => `${stats.conversionRate}%`,
              },
            },
          },
        },
      },
      tooltip: { theme: 'light' },
    };
  }
}
