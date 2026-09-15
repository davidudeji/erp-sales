// vendor-dashboard.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription, interval, takeWhile } from 'rxjs';
import {
  VendorService
} from '../../../service/vendor-management/vendor-management.service';
import {
  VendorDashboardStats,
  VendorRecentActivity,
  VendorDocument,
  Vendor,
  VendorStatus,
  VendorTier,
  RiskLevel,
  getVendorStatusColor,
  getVendorTierLabel,
  getRiskLevelColor,
  getDocumentStatusColor,
  DocumentStatus,
  SentinelInsight,
  InsightActionStatus,
  InsightSeverity,
  FraudFlag,
  SentinelSummaryStats,
  getInsightSeverityColor
} from '../../../domain/vendor-management/vendor-management.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-vendor-management-dashboard',
  templateUrl: './vendor-management-dashboard.component.html',
  styleUrls: ['./vendor-management-dashboard.component.scss']
})
export class VendorManagementDashboardComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  isLoading: boolean = true;
  stats: VendorDashboardStats | null = null;
  recentActivity: VendorRecentActivity[] = [];
  expiringDocuments: VendorDocument[] = [];
  topPerformers: Vendor[] = [];

  // AI suggestions (formerly the standalone "AI Vendor Intelligence" tab —
  // surfaced inline here instead of its own workspace)
  sentinelInsights: SentinelInsight[] = [];
  fraudFlags: FraudFlag[] = [];
  aiSummary: SentinelSummaryStats | null = null;
  getInsightSeverityColor = getInsightSeverityColor;

  // Date range
  dateRange: 'week' | 'month' | 'quarter' | 'year' = 'month';

  // Customization
  customization = {
    showStatsGrid: true,
    showPerformanceChart: true,
    showRecentActivity: true,
    showExpiringDocuments: true,
    showTopPerformers: true,
    showRiskAlerts: true,
    showAiInsights: true
  };

  // Chart data
  performanceData: any[] = [];
  vendorTierData: any[] = [];
  riskDistributionData: any[] = [];

  // UI Helpers
  Math = Math;

  // Error state
  error: string | null = null;

  // Subscriptions
  private subscriptions: Subscription[] = [];
  private autoRefreshSubscription?: Subscription;

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private vendorService: VendorService,
    private router: Router
  ) { }

  // ============================================================
  // GETTERS FOR TEMPLATE
  // ============================================================

  get totalVendorsCount(): number { return this.stats?.totalVendors ?? 0; }
  get activeVendorsCount(): number { return this.stats?.activeVendors ?? 0; }
  get pendingOnboardingCount(): number { return this.stats?.pendingOnboarding ?? 0; }
  get monthOverMonthGrowth(): number { return this.stats?.monthOverMonthGrowth ?? 0; }
  get averagePerformanceScore(): number { return this.stats?.averagePerformanceScore ?? 0; }
  get riskAlertsCount(): number { return this.stats?.riskAlertsCount ?? 0; }
  get highRiskVendorsCount(): number { return this.stats?.highRiskVendors ?? 0; }
  get expiringDocumentsCount(): number { return this.stats?.expiringDocuments ?? 0; }

  getCompliancePercentage(): number {
    if (!this.stats || !this.stats.totalVendors) return 0;
    return ((this.stats.totalVendors - this.stats.expiringDocuments) / this.stats.totalVendors) * 100;
  }

  ngOnInit(): void {
    this.loadDashboardData();
    this.startAutoRefresh();
  }

  ngOnDestroy(): void {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    if (this.autoRefreshSubscription) {
      this.autoRefreshSubscription.unsubscribe();
    }
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadDashboardData(): void {
    this.isLoading = true;

    // Load dashboard stats
    this.vendorService.getDashboardStats().subscribe({
      next: (stats) => {
        this.stats = stats;
        if (stats.recentActivity && stats.recentActivity.length > 0) {
          this.recentActivity = stats.recentActivity;
        }
        if (stats.expiringDocumentsList && stats.expiringDocumentsList.length > 0) {
          this.expiringDocuments = stats.expiringDocumentsList;
        }
        if (stats.topPerformers && stats.topPerformers.length > 0) {
          this.topPerformers = stats.topPerformers;
        }
        this.prepareChartData(stats);
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Failed to load dashboard stats:', err);
        this.isLoading = false;
      }
    });

    // Load recent activity
    this.vendorService.getRecentActivity(10).subscribe({
      next: (activities) => {
        this.recentActivity = activities;
      },
      error: (err) => {
        console.error('Failed to load recent activity:', err);
      }
    });

    // AI suggestions — insights feed, fraud watch, and the rollup numbers for both
    this.vendorService.getSentinelInsights().subscribe({
      next: (insights) => { this.sentinelInsights = insights; },
      error: (err) => console.error('Failed to load AI insights:', err)
    });

    this.vendorService.getFraudFlags().subscribe({
      next: (flags) => { this.fraudFlags = flags; },
      error: (err) => console.error('Failed to load fraud flags:', err)
    });

    this.vendorService.getSentinelSummaryStats().subscribe({
      next: (summary) => { this.aiSummary = summary; },
      error: (err) => console.error('Failed to load AI summary stats:', err)
    });
  }

  // ============================================================
  // AI SUGGESTIONS (INSIGHTS + FRAUD WATCH)
  // ============================================================

  private static readonly SEVERITY_RANK: Record<InsightSeverity, number> = {
    [InsightSeverity.CRITICAL]: 0,
    [InsightSeverity.HIGH]: 1,
    [InsightSeverity.MEDIUM]: 2,
    [InsightSeverity.LOW]: 3
  };

  /** Open insights only, most severe/recent first, capped to keep the card compact. */
  get topInsights(): SentinelInsight[] {
    return this.sentinelInsights
      .filter(i => i.status === InsightActionStatus.OPEN)
      .sort((a, b) =>
        VendorManagementDashboardComponent.SEVERITY_RANK[a.severity] - VendorManagementDashboardComponent.SEVERITY_RANK[b.severity]
        || new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime()
      )
      .slice(0, 4);
  }

  /** Fraud flags still awaiting a first look, most recent first, capped to keep the card compact. */
  get pendingFraudFlags(): FraudFlag[] {
    return this.fraudFlags
      .filter(f => f.status === 'PENDING_REVIEW')
      .sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime())
      .slice(0, 4);
  }

  actOnInsight(insight: SentinelInsight, action: string): void {
    this.vendorService.actOnInsight(insight.id, action).subscribe({
      next: (updated) => { this.sentinelInsights = updated; },
      error: (err) => console.error('Failed to act on insight:', err)
    });
  }

  investigateFraudFlag(flag: FraudFlag): void {
    this.vendorService.updateFraudFlagStatus(flag.id, 'INVESTIGATING').subscribe({
      next: (updated) => { this.fraudFlags = updated; },
      error: (err) => console.error('Failed to update fraud flag:', err)
    });
  }

  clearFraudFlag(flag: FraudFlag): void {
    this.vendorService.updateFraudFlagStatus(flag.id, 'CLEARED').subscribe({
      next: (updated) => { this.fraudFlags = updated; },
      error: (err) => console.error('Failed to update fraud flag:', err)
    });
  }

  // ============================================================
  // CHART DATA PREPARATION
  // ============================================================

  prepareChartData(stats: VendorDashboardStats): void {
    // Vendor Tier Distribution
    this.vendorTierData = [
      { label: '⭐ Preferred', value: stats.vendorsByTier.preferred, color: '#2EB270' },
      { label: '✓ Approved', value: stats.vendorsByTier.approved, color: '#2E6276' },
      { label: '⚠️ Conditional', value: stats.vendorsByTier.conditional, color: '#F59E0B' }
    ].filter(item => item.value > 0);

    // Risk Distribution
    this.riskDistributionData = [
      { label: 'Low Risk', value: stats.totalVendors - stats.highRiskVendors, color: '#2EB270' },
      { label: 'High Risk', value: stats.highRiskVendors, color: '#DC2626' }
    ];

    this.performanceData = [];
  }

  // ============================================================
  // AUTO REFRESH
  // ============================================================

  private startAutoRefresh(): void {
    // Refresh every 60 seconds
    this.autoRefreshSubscription = interval(60000)
      .pipe(takeWhile(() => true))
      .subscribe(() => {
        this.loadDashboardData();
      });
  }

  // ============================================================
  // DATE RANGE CHANGES
  // ============================================================

  changeDateRange(range: 'week' | 'month' | 'quarter' | 'year'): void {
    this.dateRange = range;
    // In real implementation, this would re-fetch data for the new range
    this.loadDashboardData();
  }

  // ============================================================
  // NAVIGATION - FIXED
  // ============================================================

  // Tab sessionStorage key used by NavTabComponent for the vendor management shell
  private readonly VM_TAB_KEY = 'dashboard-vendor global registry-vendor directory';

  navigateToVendors(): void {
    sessionStorage.setItem(this.VM_TAB_KEY, 'Vendor Directory');
    this.router.navigate(['/admin/sales/commerce/manage-vendors']);
  }

  navigateToVendor(id: string): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { returnTo: 'dashboard' }
    });
  }

  navigateToPerformance(): void {
    sessionStorage.setItem(this.VM_TAB_KEY, 'Vendor Directory');
    this.router.navigate(['/admin/sales/commerce/manage-vendors']);
  }

  navigateToRisk(): void {
    sessionStorage.setItem(this.VM_TAB_KEY, 'Vendor Directory');
    this.router.navigate(['/admin/sales/commerce/manage-vendors']);
  }

  navigateToDocuments(id: string): void {
    this.router.navigate(['/commerce/manage-vendors', id, 'profile'], {
      queryParams: { returnTo: 'dashboard' }
    });
  }

  // ============================================================
  // CUSTOMIZATION
  // ============================================================

  openCustomizationModal(): void {
    // In real implementation, this would open a modal/drawer
    console.log('Open customization modal');
  }

  saveCustomization(): void {
    // Save to localStorage or API
    localStorage.setItem('vendorDashboardCustomization', JSON.stringify(this.customization));
  }

  loadCustomization(): void {
    const saved = localStorage.getItem('vendorDashboardCustomization');
    if (saved) {
      try {
        this.customization = { ...this.customization, ...JSON.parse(saved) };
      } catch (e) {
        // Ignore parse errors
      }
    }
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getVendorStatusColor(status: VendorStatus): string {
    return getVendorStatusColor(status);
  }

  getVendorTierLabel(tier: VendorTier): string {
    return getVendorTierLabel(tier);
  }

  getRiskLevelColor(level: RiskLevel): string {
    return getRiskLevelColor(level);
  }

  getDocumentStatusColor(status: DocumentStatus): string {
    return getDocumentStatusColor(status);
  }

  getDocumentStatusLabel(status: DocumentStatus): string {
    const map: Record<DocumentStatus, string> = {
      [DocumentStatus.ACTIVE]: 'Active',
      [DocumentStatus.EXPIRING_SOON]: 'Expiring Soon',
      [DocumentStatus.EXPIRED]: 'Expired',
      [DocumentStatus.PENDING_VERIFICATION]: 'Pending',
      [DocumentStatus.REJECTED]: 'Rejected'
    };
    return map[status] || status;
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  getDaysUntilExpiry(date: Date): number {
    const now = new Date();
    const expiry = new Date(date);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getStatusClass(status: string): string {
    return status.toLowerCase().replace(/_/g, '-');
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // ============================================================
  // CHART HELPERS
  // ============================================================

  getConicGradient(): string {
    if (!this.vendorTierData || this.vendorTierData.length === 0) {
      return '#e2e8f0';
    }

    const total = this.vendorTierData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return '#e2e8f0';

    let gradient = '';
    let currentAngle = 0;

    this.vendorTierData.forEach((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const start = currentAngle;
      const end = currentAngle + angle;

      if (index === 0) {
        gradient = `conic-gradient(${item.color} 0% ${end}%`;
      } else {
        gradient += `, ${item.color} ${start}% ${end}%`;
      }

      if (index === this.vendorTierData.length - 1) {
        gradient += ')';
      }

      currentAngle = end;
    });

    return gradient;
  }

  getChartCallouts(): any[] {
    if (!this.vendorTierData || this.vendorTierData.length === 0) {
      return [];
    }

    const total = this.vendorTierData.reduce((sum, item) => sum + item.value, 0);
    if (total === 0) return [];

    const centerX = 290;
    const centerY = 180;
    const radius = 140;
    const calloutRadius = 180;

    return this.vendorTierData.map((item, index) => {
      const percentage = (item.value / total) * 100;
      const angle = (percentage / 100) * 360;
      const startAngle = this.vendorTierData.slice(0, index).reduce((sum, prev) =>
        sum + (prev.value / total) * 360, 0);
      const midAngle = startAngle + angle / 2;
      const rad = (midAngle - 90) * Math.PI / 180;

      const x = centerX + calloutRadius * Math.cos(rad);
      const y = centerY + calloutRadius * Math.sin(rad);

      const lineStartX = centerX + radius * Math.cos(rad);
      const lineStartY = centerY + radius * Math.sin(rad);

      const isRight = x > centerX;
      const textAnchor = isRight ? 'start' : 'end';
      const textX = x + (isRight ? 20 : -20);

      return {
        label: item.label,
        amount: this.formatCurrency(item.value),
        percent: percentage.toFixed(1) + '%',
        value: item.value,
        color: item.color,
        x: x,
        y: y,
        textX: textX,
        textY: y,
        textAnchor: textAnchor,
        linePath: `M${lineStartX},${lineStartY} L${x},${y}`
      };
    });
  }

  getMaxPerformance(): number {
    if (!this.performanceData || this.performanceData.length === 0) return 100;
    const max = Math.max(...this.performanceData.map(d => d.score));
    return Math.ceil(max / 10) * 10 + 10;
  }

  getPointX(index: number): number {
    if (!this.performanceData || this.performanceData.length === 0) return 0;
    const padding = 40;
    const width = 500 - padding * 2;
    return padding + (index / (this.performanceData.length - 1)) * width;
  }

  getPointY(value: number): number {
    const max = this.getMaxPerformance();
    const padding = 20;
    const height = 260 - padding * 2;
    return padding + height - (value / max) * height;
  }

  getLineChartPath(): string {
    if (!this.performanceData || this.performanceData.length === 0) return '';

    return this.performanceData.map((d, i) => {
      const x = this.getPointX(i);
      const y = this.getPointY(d.score);
      return (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }).join(' ');
  }

  getDeliveryLineChartPath(): string {
    if (!this.performanceData || this.performanceData.length === 0) return '';

    return this.performanceData.map((d, i) => {
      const x = this.getPointX(i);
      const y = this.getPointY(d.onTimeDelivery);
      return `${x},${y}`;
    }).join(' ');
  }

  getLineChartAreaPath(): string {
    if (!this.performanceData || this.performanceData.length === 0) return '';

    const path = this.performanceData.map((d, i) => {
      const x = this.getPointX(i);
      const y = this.getPointY(d.score);
      return (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }).join(' ');

    const lastX = this.getPointX(this.performanceData.length - 1);
    const firstX = this.getPointX(0);
    return path + ` L${lastX},${this.getPointY(0)} L${firstX},${this.getPointY(0)} Z`;
  }

  getInsightMetrics(): any[] {
    if (!this.stats) return [];

    return [
      {
        label: 'Avg Performance Score',
        value: this.stats.averagePerformanceScore.toFixed(1) + '%',
        color: '#2E6276',
        trend: 'up',
        percent: 4.2
      },
      {
        label: 'Active Vendors',
        value: this.formatNumber(this.stats.activeVendors),
        color: '#2EB270',
        trend: 'up',
        percent: 8.7
      },
      {
        label: 'Pending Review',
        value: this.formatNumber(this.stats.pendingReview),
        color: '#F59E0B',
        trend: 'down',
        percent: 3.1
      },
      {
        label: 'High Risk Vendors',
        value: this.formatNumber(this.stats.highRiskVendors),
        color: '#DC2626',
        trend: this.stats.highRiskVendors > 5 ? 'down' : 'up',
        percent: this.stats.highRiskVendors > 5 ? 5.2 : 2.8
      }
    ];
  }

  // Navigation - Global Registry (Vendor Approval Queue tab)
  navigateToApprovalQueue(): void {
    sessionStorage.setItem(this.VM_TAB_KEY, 'Vendor Global Registry');
    this.router.navigate(['/admin/sales/commerce/manage-vendors']);
  }

  // Refresh
  refreshData(): void {
    this.error = null;
    this.loadDashboardData();
  }

  // Export
  exportReport(): void {
    console.log('Exporting vendor report...');
  }
}