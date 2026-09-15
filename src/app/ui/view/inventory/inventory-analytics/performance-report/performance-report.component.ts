// performance-report.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, of, takeUntil, forkJoin, debounceTime, distinctUntilChanged } from 'rxjs';
import { MessageService } from 'primeng/api';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';
import * as XLSX from 'xlsx';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  Product,
  Branch,
  BranchInventory,
  ProductPerformance,
  StockMovement,
  getStockStatus,
  getStockStatusLabel,
  getStockStatusColor
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// INTERFACES
// ============================================================

export interface ReportConfig {
  id: string;
  name: string;
  type: 'PERFORMANCE' | 'INVENTORY' | 'SALES' | 'TURNOVER' | 'AFFORDABILITY' | 'CUSTOM';
  format: 'PDF' | 'EXCEL' | 'CSV' | 'HTML';
  dateRange: {
    start: Date;
    end: Date;
  };
  filters: {
    branchIds?: string[];
    productIds?: string[];
    categoryIds?: string[];
    statuses?: string[];
    minTurnover?: number;
    maxTurnover?: number;
    minScore?: number;
    maxScore?: number;
  };
  includeSections: {
    summary: boolean;
    charts: boolean;
    tables: boolean;
    recommendations: boolean;
    details: boolean;
  };
  schedule?: {
    enabled: boolean;
    frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
    recipients: string[];
  };
  createdAt: Date;
  createdBy: string;
  lastRun?: Date;
}

export interface ReportData {
  config: ReportConfig;
  generatedAt: Date;
  summary: ReportSummary;
  performanceData: ProductPerformance[];
  turnoverData: any[];
  affordabilityData: any[];
  inventoryData: BranchInventory[];
  movements: StockMovement[];
  charts: ReportChart[];
  recommendations: string[];
  metadata: {
    totalProducts: number;
    totalBranches: number;
    totalStockValue: number;
    averageTurnover: number;
    topPerformingProduct: string;
    topPerformingBranch: string;
    periodDays: number;
  };
}

export interface ReportSummary {
  totalRevenue: number;
  totalProfit: number;
  totalUnitsSold: number;
  averageOrderValue: number;
  stockTurnover: number;
  inventoryValue: number;
  lowStockCount: number;
  outOfStockCount: number;
  highPerformingCount: number;
  lowPerformingCount: number;
  branchCount: number;
  productCount: number;
}

export interface ReportChart {
  id: string;
  type: 'BAR' | 'LINE' | 'PIE' | 'GAUGE' | 'HISTOGRAM';
  title: string;
  data: any[];
  labels: string[];
  colors?: string[];
  options?: any;
}

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-performance-report',
  templateUrl: './performance-report.component.html',
  styleUrls: ['./performance-report.component.scss'],
  providers: [MessageService]
})
export class PerformanceReportComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() reportId: string = '';
  @Input() presetType: 'PERFORMANCE' | 'INVENTORY' | 'SALES' | 'TURNOVER' | 'AFFORDABILITY' = 'PERFORMANCE';
  @Output() close = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  branches: Branch[] = [];
  products: Product[] = [];
  inventory: BranchInventory[] = [];
  performance: ProductPerformance[] = [];
  movements: StockMovement[] = [];
  reportData: ReportData | null = null;
  savedReports: ReportConfig[] = [];
  isLoading: boolean = true;
  isGenerating: boolean = false;
  isSaving: boolean = false;
  error: string | null = null;

  // UI
  activeTab: 'builder' | 'preview' | 'saved' | 'schedule' = 'builder';
  previewTab: 'summary' | 'charts' | 'tables' | 'details' = 'summary';
  showExportModal: boolean = false;
  showScheduleModal: boolean = false;
  selectedReportId: string = '';
  isEditing: boolean = false;
  exportFormat: 'PDF' | 'EXCEL' | 'CSV' = 'PDF';
  isExporting: boolean = false;

  // Form
  reportForm: FormGroup;
  scheduleForm: FormGroup;
  searchSubject = new Subject<string>();

  // Report templates
  reportTemplates = [
    { id: 'performance', name: 'Performance Report', icon: 'fa-chart-line', description: 'Product and branch performance metrics' },
    { id: 'inventory', name: 'Inventory Report', icon: 'fa-boxes', description: 'Current stock levels and inventory status' },
    { id: 'sales', name: 'Sales Report', icon: 'fa-shopping-cart', description: 'Sales performance and revenue analysis' },
    { id: 'turnover', name: 'Turnover Report', icon: 'fa-rotate', description: 'Stock turnover and efficiency metrics' },
    { id: 'affordability', name: 'Affordability Report', icon: 'fa-wallet', description: 'Branch affordability analysis' }
  ];

  // Available sections
  availableSections = [
    { id: 'summary', name: 'Executive Summary', icon: 'fa-file-alt', default: true },
    { id: 'charts', name: 'Charts & Visualizations', icon: 'fa-chart-pie', default: true },
    { id: 'tables', name: 'Data Tables', icon: 'fa-table', default: true },
    { id: 'recommendations', name: 'Recommendations', icon: 'fa-lightbulb', default: true },
    { id: 'details', name: 'Detailed Breakdown', icon: 'fa-list', default: false }
  ];

  // Private
  private destroy$ = new Subject<void>();
  private Math = Math;

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private fb: FormBuilder,
    private messageService: MessageService
  ) {
    this.reportForm = this.buildReportForm();
    this.scheduleForm = this.buildScheduleForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    // Get report ID from route if not provided
    if (!this.reportId) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        if (params['reportId']) {
          this.reportId = params['reportId'];
          this.loadSavedReport(this.reportId);
        } else {
          this.loadData();
        }
      });
    } else {
      this.loadSavedReport(this.reportId);
    }

    // Setup search
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      // Handle search
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // FORM BUILDING
  // ============================================================

  private buildReportForm(): FormGroup {
    return this.fb.group({
      name: ['', Validators.required],
      type: [this.presetType, Validators.required],
      format: ['PDF', Validators.required],
      dateRangeStart: [new Date(new Date().setDate(new Date().getDate() - 30)), Validators.required],
      dateRangeEnd: [new Date(), Validators.required],
      branches: [[]],
      products: [[]],
      categories: [[]],
      includeSummary: [true],
      includeCharts: [true],
      includeTables: [true],
      includeRecommendations: [true],
      includeDetails: [false]
    });
  }

  private buildScheduleForm(): FormGroup {
    return this.fb.group({
      enabled: [false],
      frequency: ['WEEKLY'],
      dayOfWeek: ['MONDAY'],
      dayOfMonth: [1],
      time: ['09:00'],
      recipients: ['', Validators.email],
      subject: [''],
      message: ['']
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          this.branches = branches;

          const inventory$ = branches.length > 0
            ? forkJoin(branches.map(branch => this.inventoryService.getBranchInventory(String(branch.id))))
            : of([] as BranchInventory[][]);

          forkJoin({
            products: this.inventoryService.getProducts({ limit: 500 }),
            inventory: inventory$,
            performance: this.inventoryService.getTopProducts(100),
            movements: this.inventoryService.getMovements({ limit: 200 })
          }).pipe(takeUntil(this.destroy$))
            .subscribe({
              next: ({ products, inventory, performance, movements }) => {
                this.products = products.data || [];
                this.inventory = inventory.flat();
                this.performance = performance;
                this.movements = movements.data || [];
                this.loadSavedReports();
                this.isLoading = false;
              },
              error: (err) => {
                console.error('Failed to load report data:', err);
                this.error = 'Failed to load data. Please try again.';
                this.isLoading = false;
              }
            });
        },
        error: (err) => {
          console.error('Failed to load branches:', err);
          this.error = 'Failed to load data. Please try again.';
          this.isLoading = false;
        }
      });
  }

  loadSavedReports(): void {
    // Mock saved reports
    this.savedReports = [
      {
        id: 'report-1',
        name: 'Q4 Performance Report',
        type: 'PERFORMANCE',
        format: 'PDF',
        dateRange: { start: new Date('2024-10-01'), end: new Date('2024-12-31') },
        filters: {},
        includeSections: { summary: true, charts: true, tables: true, recommendations: true, details: false },
        createdAt: new Date('2025-01-15'),
        createdBy: 'Admin',
        lastRun: new Date('2025-01-20')
      },
      {
        id: 'report-2',
        name: 'Monthly Inventory Report',
        type: 'INVENTORY',
        format: 'EXCEL',
        dateRange: { start: new Date('2025-01-01'), end: new Date('2025-01-31') },
        filters: {},
        includeSections: { summary: true, charts: true, tables: true, recommendations: false, details: false },
        createdAt: new Date('2025-02-01'),
        createdBy: 'Admin'
      },
      {
        id: 'report-3',
        name: 'Branch Affordability Analysis',
        type: 'AFFORDABILITY',
        format: 'PDF',
        dateRange: { start: new Date('2025-01-01'), end: new Date('2025-02-28') },
        filters: {},
        includeSections: { summary: true, charts: true, tables: true, recommendations: true, details: true },
        createdAt: new Date('2025-02-15'),
        createdBy: 'Admin',
        lastRun: new Date('2025-02-20')
      }
    ];
  }

  loadSavedReport(reportId: string): void {
    this.isLoading = true;
    // In real implementation, fetch from API
    setTimeout(() => {
      const report = this.savedReports.find(r => r.id === reportId);
      if (report) {
        this.reportForm.patchValue({
          name: report.name,
          type: report.type,
          format: report.format,
          dateRangeStart: report.dateRange.start,
          dateRangeEnd: report.dateRange.end,
          includeSummary: report.includeSections.summary,
          includeCharts: report.includeSections.charts,
          includeTables: report.includeSections.tables,
          includeRecommendations: report.includeSections.recommendations,
          includeDetails: report.includeSections.details
        });
        this.isEditing = true;
        this.loadData();
      } else {
        this.loadData();
      }
    }, 300);
  }

  // ============================================================
  // REPORT GENERATION
  // ============================================================

  generateReport(): void {
    if (this.reportForm.invalid) {
      this.reportForm.markAllAsTouched();
      return;
    }

    this.isGenerating = true;
    this.error = null;

    const formValue = this.reportForm.value;

    setTimeout(() => {
      try {
        this.reportData = this.generateReportData(formValue);
        this.activeTab = 'preview';
        this.isGenerating = false;
      } catch (err) {
        console.error('Failed to generate report:', err);
        this.error = 'Failed to generate report. Please try again.';
        this.isGenerating = false;
      }
    }, 1200);
  }

  private generateReportData(formValue: any): ReportData {
    const startDate = new Date(formValue.dateRangeStart);
    const endDate = new Date(formValue.dateRangeEnd);
    const periodDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

    // Filter data based on selections
    const selectedBranches = formValue.branches || [];
    const selectedProducts = formValue.products || [];
    const selectedCategories = formValue.categories || [];

    let filteredInventory = this.inventory;
    let filteredPerformance = this.performance;
    let filteredMovements = this.movements;

    if (selectedBranches.length > 0) {
      filteredInventory = filteredInventory.filter(i => selectedBranches.includes(i.branchId));
      filteredMovements = filteredMovements.filter(m =>
        selectedBranches.includes(m.toLocation.id) || selectedBranches.includes(m.fromLocation.id)
      );
    }

    if (selectedProducts.length > 0) {
      filteredInventory = filteredInventory.filter(i => selectedProducts.includes(i.productId));
      filteredPerformance = filteredPerformance.filter(p => selectedProducts.includes(p.productId));
    }

    if (selectedCategories.length > 0) {
      const productIds = this.products
        .filter(p => selectedCategories.includes(typeof p.category === 'string' ? p.category : (p.category as any)?.name))
        .map(p => String(p.id));
      filteredInventory = filteredInventory.filter(i => productIds.includes(i.productId));
      filteredPerformance = filteredPerformance.filter(p => productIds.includes(p.productId));
    }

    // Calculate summary
    const totalRevenue = filteredPerformance.reduce((sum, p) => sum + p.totalRevenue, 0);
    const totalProfit = filteredPerformance.reduce((sum, p) => sum + p.totalProfit, 0);
    const totalUnitsSold = filteredPerformance.reduce((sum, p) => sum + p.totalSold, 0);
    const inventoryValue = filteredInventory.reduce((sum, i) => sum + (i.quantity * i.sellingPrice), 0);

    const lowStockCount = filteredInventory.filter(i => i.quantity <= i.reorderPoint).length;
    const outOfStockCount = filteredInventory.filter(i => i.quantity === 0).length;

    const avgTurnover = filteredPerformance.length > 0
      ? filteredPerformance.reduce((sum, p) => sum + p.stockTurnover, 0) / filteredPerformance.length
      : 0;

    const highPerforming = filteredPerformance.filter(p => p.performanceScore >= 70);
    const lowPerforming = filteredPerformance.filter(p => p.performanceScore < 40);

    const topPerformer = filteredPerformance.length > 0
      ? filteredPerformance.sort((a, b) => b.performanceScore - a.performanceScore)[0]
      : null;

    const topBranch = this.getTopPerformingBranch();

    const summary: ReportSummary = {
      totalRevenue,
      totalProfit,
      totalUnitsSold,
      averageOrderValue: totalUnitsSold > 0 ? totalRevenue / totalUnitsSold : 0,
      stockTurnover: avgTurnover,
      inventoryValue,
      lowStockCount,
      outOfStockCount,
      highPerformingCount: highPerforming.length,
      lowPerformingCount: lowPerforming.length,
      branchCount: new Set(filteredInventory.map(i => i.branchId)).size,
      productCount: new Set(filteredInventory.map(i => i.productId)).size
    };

    // Generate charts
    const charts = this.generateCharts(filteredPerformance, filteredInventory, formValue);

    // Generate recommendations
    const recommendations = this.generateRecommendations(summary, filteredPerformance, filteredInventory);

    // Generate turnover data
    const turnoverData = filteredPerformance.map(p => ({
      productId: p.productId,
      productName: p.productName,
      turnoverRate: p.stockTurnover,
      daysOfInventory: p.daysOfInventory,
      sellThroughRate: p.sellThroughRate
    }));

    // Generate affordability data
    const affordabilityData = this.generateAffordabilityData(filteredInventory);

    const config: ReportConfig = {
      id: this.isEditing ? this.reportId : `report-${Date.now()}`,
      name: formValue.name,
      type: formValue.type,
      format: formValue.format,
      dateRange: { start: startDate, end: endDate },
      filters: {
        branchIds: selectedBranches,
        productIds: selectedProducts,
        categoryIds: selectedCategories
      },
      includeSections: {
        summary: formValue.includeSummary,
        charts: formValue.includeCharts,
        tables: formValue.includeTables,
        recommendations: formValue.includeRecommendations,
        details: formValue.includeDetails
      },
      createdAt: new Date(),
      createdBy: 'Admin'
    };

    return {
      config,
      generatedAt: new Date(),
      summary,
      performanceData: filteredPerformance,
      turnoverData,
      affordabilityData,
      inventoryData: filteredInventory,
      movements: filteredMovements,
      charts,
      recommendations,
      metadata: {
        totalProducts: new Set(filteredInventory.map(i => i.productId)).size,
        totalBranches: new Set(filteredInventory.map(i => i.branchId)).size,
        totalStockValue: inventoryValue,
        averageTurnover: avgTurnover,
        topPerformingProduct: topPerformer?.productName || 'N/A',
        topPerformingBranch: topBranch || 'N/A',
        periodDays
      }
    };
  }

  private generateCharts(performance: ProductPerformance[], inventory: BranchInventory[], formValue: any): ReportChart[] {
    const charts: ReportChart[] = [];

    // 1. Top Products by Revenue
    const topProducts = [...performance]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    charts.push({
      id: 'top-products-revenue',
      type: 'BAR',
      title: 'Top Products by Revenue',
      data: topProducts.map(p => p.totalRevenue),
      labels: topProducts.map(p => p.productName.substring(0, 20)),
      colors: ['#184440', '#2EB270', '#3B82F6', '#8B5CF6', '#F59E0B', '#DC2626', '#EC4899', '#14B8A6', '#F97316', '#6366F1']
    });

    // 2. Product Performance Distribution
    const scoreRanges = [
      { range: '0-20', count: 0 },
      { range: '21-40', count: 0 },
      { range: '41-60', count: 0 },
      { range: '61-80', count: 0 },
      { range: '81-100', count: 0 }
    ];
    performance.forEach(p => {
      const score = p.performanceScore || 0;
      if (score <= 20) scoreRanges[0].count++;
      else if (score <= 40) scoreRanges[1].count++;
      else if (score <= 60) scoreRanges[2].count++;
      else if (score <= 80) scoreRanges[3].count++;
      else scoreRanges[4].count++;
    });
    charts.push({
      id: 'performance-distribution',
      type: 'PIE',
      title: 'Performance Score Distribution',
      data: scoreRanges.map(r => r.count),
      labels: scoreRanges.map(r => r.range),
      colors: ['#DC2626', '#F59E0B', '#F5A623', '#3B82F6', '#2EB270']
    });

    // 3. Stock Status
    const stockStatus = { critical: 0, low: 0, normal: 0, overstock: 0 };
    inventory.forEach(i => {
      const status = getStockStatus(i.quantity, i.reorderPoint, i.safetyStock);
      if (status === 'CRITICAL') stockStatus.critical++;
      else if (status === 'LOW') stockStatus.low++;
      else if (status === 'OVERSTOCK') stockStatus.overstock++;
      else stockStatus.normal++;
    });
    charts.push({
      id: 'stock-status',
      type: 'PIE',
      title: 'Stock Status Distribution',
      data: [stockStatus.critical, stockStatus.low, stockStatus.normal, stockStatus.overstock],
      labels: ['Critical', 'Low Stock', 'Normal', 'Overstock'],
      colors: ['#DC2626', '#F59E0B', '#2EB270', '#3B82F6']
    });

    // 4. Category Performance
    const categoryMap = new Map<string, { revenue: number; count: number }>();
    performance.forEach(p => {
      const cat = p.category || 'Uncategorized';
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, { revenue: 0, count: 0 });
      }
      const entry = categoryMap.get(cat)!;
      entry.revenue += p.totalRevenue;
      entry.count++;
    });
    const categoryData = Array.from(categoryMap.entries())
      .map(([cat, data]) => ({ category: cat, revenue: data.revenue, count: data.count }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 8);
    charts.push({
      id: 'category-performance',
      type: 'BAR',
      title: 'Category Performance by Revenue',
      data: categoryData.map(c => c.revenue),
      labels: categoryData.map(c => c.category),
      colors: ['#184440', '#2EB270', '#3B82F6', '#8B5CF6', '#F59E0B', '#DC2626', '#EC4899', '#14B8A6']
    });

    // 5. Branch Performance
    const branchMap = new Map<string, { revenue: number; products: number }>();
    inventory.forEach(i => {
      if (!branchMap.has(i.branchId)) {
        branchMap.set(i.branchId, { revenue: 0, products: 0 });
      }
      const entry = branchMap.get(i.branchId)!;
      entry.revenue += i.quantity * i.sellingPrice;
      entry.products++;
    });
    const branchData = Array.from(branchMap.entries())
      .map(([id, data]) => ({
        branchId: id,
        branchName: this.getBranchName(id),
        revenue: data.revenue,
        products: data.products
      }))
      .sort((a, b) => b.revenue - a.revenue);
    charts.push({
      id: 'branch-performance',
      type: 'BAR',
      title: 'Branch Performance by Stock Value',
      data: branchData.map(b => b.revenue),
      labels: branchData.map(b => b.branchName.substring(0, 15)),
      colors: ['#184440', '#2EB270', '#3B82F6', '#8B5CF6', '#F59E0B', '#DC2626']
    });

    return charts;
  }

  private generateRecommendations(summary: ReportSummary, performance: ProductPerformance[], inventory: BranchInventory[]): string[] {
    const recommendations: string[] = [];

    // Performance based
    if (summary.highPerformingCount > 0) {
      recommendations.push(`💰 ${summary.highPerformingCount} products are high performers — consider increasing stock and marketing focus.`);
    }

    if (summary.lowPerformingCount > 0) {
      recommendations.push(`⚠️ ${summary.lowPerformingCount} products are underperforming — review pricing, placement, or consider clearance.`);
    }

    // Inventory based
    if (summary.lowStockCount > 0) {
      recommendations.push(`📦 ${summary.lowStockCount} products are below reorder point — prioritize restocking to prevent stockouts.`);
    }

    if (summary.outOfStockCount > 0) {
      recommendations.push(`🚨 ${summary.outOfStockCount} products are out of stock — immediate action required.`);
    }

    // Turnover based
    if (summary.stockTurnover < 1) {
      recommendations.push(`🔄 Stock turnover (${summary.stockTurnover.toFixed(1)}x) is below optimal — consider improving inventory efficiency.`);
    } else if (summary.stockTurnover > 4) {
      recommendations.push(`🚀 Excellent stock turnover (${summary.stockTurnover.toFixed(1)}x) — maintain current inventory strategy.`);
    }

    // General
    if (summary.totalProfit / summary.totalRevenue < 0.1) {
      recommendations.push(`📊 Profit margin is low (${(summary.totalProfit / summary.totalRevenue * 100).toFixed(1)}%) — review pricing strategy.`);
    }

    // Add general recommendations
    recommendations.push('📈 Consider running a performance review meeting to discuss these insights.');
    recommendations.push('🎯 Use this report to align inventory strategy with business goals.');

    return recommendations.slice(0, 7);
  }

  private generateAffordabilityData(inventory: BranchInventory[]): any[] {
    const branchMap = new Map<string, { total: number; count: number; prices: number[] }>();

    inventory.forEach(i => {
      if (!branchMap.has(i.branchId)) {
        branchMap.set(i.branchId, { total: 0, count: 0, prices: [] });
      }
      const entry = branchMap.get(i.branchId)!;
      entry.total += i.quantity * i.sellingPrice;
      entry.count += i.quantity;
      entry.prices.push(i.sellingPrice);
    });

    return Array.from(branchMap.entries()).map(([id, data]) => {
      const avgPrice = data.prices.length > 0
        ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length
        : 0;

      // Calculate affordability score (inverse of average price relative to all branches)
      const allPrices = inventory.map(i => i.sellingPrice);
      const globalAvg = allPrices.length > 0
        ? allPrices.reduce((a, b) => a + b, 0) / allPrices.length
        : 1;

      const score = globalAvg > 0 ? Math.min(Math.max((globalAvg / avgPrice) * 50, 0), 100) : 50;

      let level: 'HIGH' | 'MEDIUM' | 'LOW';
      if (score >= 60) level = 'HIGH';
      else if (score >= 35) level = 'MEDIUM';
      else level = 'LOW';

      return {
        branchId: id,
        branchName: this.getBranchName(id),
        totalValue: data.total,
        productCount: data.count,
        averagePrice: avgPrice,
        affordabilityScore: score,
        affordabilityLevel: level
      };
    });
  }

  private getTopPerformingBranch(): string {
    const branchMap = new Map<string, { revenue: number; count: number }>();
    this.performance.forEach(p => {
      // Find which branch has the most sales for this product
      const branchInventory = this.inventory.filter(i => i.productId === p.productId);
      branchInventory.forEach(i => {
        if (!branchMap.has(i.branchId)) {
          branchMap.set(i.branchId, { revenue: 0, count: 0 });
        }
        const entry = branchMap.get(i.branchId)!;
        entry.revenue += i.quantity * i.sellingPrice;
        entry.count += i.quantity;
      });
    });

    let topBranch = '';
    let maxRevenue = 0;
    branchMap.forEach((value, key) => {
      if (value.revenue > maxRevenue) {
        maxRevenue = value.revenue;
        topBranch = key;
      }
    });

    return topBranch ? this.getBranchName(topBranch) : '';
  }

  private getBranchName(branchId: string): string {
    const branch = this.branches.find(b => String(b.id) === branchId);
    return branch?.name || branchId;
  }

  // ============================================================
  // REPORT SAVING
  // ============================================================

  saveReport(): void {
    if (!this.reportData) return;

    this.isSaving = true;

    const config: ReportConfig = {
      id: this.isEditing ? this.reportId : `report-${Date.now()}`,
      name: this.reportForm.get('name')?.value || 'Untitled Report',
      type: this.reportForm.get('type')?.value || 'PERFORMANCE',
      format: this.reportForm.get('format')?.value || 'PDF',
      dateRange: {
        start: this.reportForm.get('dateRangeStart')?.value || new Date(),
        end: this.reportForm.get('dateRangeEnd')?.value || new Date()
      },
      filters: {
        branchIds: this.reportForm.get('branches')?.value || [],
        productIds: this.reportForm.get('products')?.value || [],
        categoryIds: this.reportForm.get('categories')?.value || []
      },
      includeSections: {
        summary: this.reportForm.get('includeSummary')?.value || true,
        charts: this.reportForm.get('includeCharts')?.value || true,
        tables: this.reportForm.get('includeTables')?.value || true,
        recommendations: this.reportForm.get('includeRecommendations')?.value || true,
        details: this.reportForm.get('includeDetails')?.value || false
      },
      createdAt: new Date(),
      createdBy: 'Admin'
    };

    // In real implementation, save to API
    setTimeout(() => {
      if (!this.isEditing) {
        this.savedReports.push(config);
      } else {
        const index = this.savedReports.findIndex(r => r.id === this.reportId);
        if (index !== -1) {
          this.savedReports[index] = config;
        }
      }
      this.isSaving = false;
      this.isEditing = false;
      this.reportId = config.id;
      // Show success message
    }, 500);
  }

  // ============================================================
  // EXPORT
  // ============================================================

  exportReport(): void {
    this.exportFormat = this.reportForm.get('format')?.value || 'PDF';
    this.showExportModal = true;
  }

  closeExportModal(): void {
    if (this.isExporting) return;
    this.showExportModal = false;
  }

  selectExportFormat(format: 'PDF' | 'EXCEL' | 'CSV'): void {
    this.exportFormat = format;
  }

  confirmExport(): void {
    if (!this.reportData || this.isExporting) return;

    this.isExporting = true;

    try {
      switch (this.exportFormat) {
        case 'EXCEL':
          this.exportAsExcel(this.reportData);
          this.onExportComplete();
          break;
        case 'CSV':
          this.exportAsCsv(this.reportData);
          this.onExportComplete();
          break;
        default:
          // PDF capture is async (html2canvas) — it completes itself.
          this.exportAsPdf(this.reportData);
      }
    } catch (err) {
      console.error('Failed to export report:', err);
      this.isExporting = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Export Failed',
        detail: 'Could not export the report. Please try again.'
      });
    }
  }

  private onExportComplete(): void {
    this.isExporting = false;
    this.showExportModal = false;
    this.messageService.add({
      severity: 'success',
      summary: 'Export Complete',
      detail: `Report downloaded as ${this.exportFormat}.`
    });
  }

  private exportAsPdf(data: ReportData): void {
    const element = document.getElementById('report-preview-sheet');
    if (!element) {
      this.isExporting = false;
      this.messageService.add({
        severity: 'error',
        summary: 'Export Failed',
        detail: 'Nothing to export — open the report preview first.'
      });
      return;
    }

    html2canvas(element, { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff' })
      .then(canvas => {
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF('p', 'mm', 'a4');
        const imgWidth = 210; // A4 width in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
        pdf.save(`${this.sanitizeFileName(data.config.name)}.pdf`);
        this.onExportComplete();
      })
      .catch(err => {
        console.error('Failed to generate PDF:', err);
        this.isExporting = false;
        this.messageService.add({
          severity: 'error',
          summary: 'Export Failed',
          detail: 'Could not generate the PDF.'
        });
      });
  }

  private exportAsExcel(data: ReportData): void {
    const summaryRows: (string | number)[][] = [
      ['Report', data.config.name],
      ['Type', this.getReportTypeLabel(data.config.type)],
      ['Generated', this.formatDateTime(data.generatedAt)],
      ['Period', `${this.formatDate(data.config.dateRange.start)} - ${this.formatDate(data.config.dateRange.end)}`],
      [],
      ['Total Revenue', data.summary.totalRevenue],
      ['Total Profit', data.summary.totalProfit],
      ['Units Sold', data.summary.totalUnitsSold],
      ['Average Order Value', data.summary.averageOrderValue],
      ['Stock Turnover', data.summary.stockTurnover],
      ['Inventory Value', data.summary.inventoryValue],
      ['Low Stock Count', data.summary.lowStockCount],
      ['Out of Stock Count', data.summary.outOfStockCount],
      ['High Performing Products', data.summary.highPerformingCount],
      ['Low Performing Products', data.summary.lowPerformingCount]
    ];

    const productHeader = ['Product', 'SKU', 'Category', 'Units Sold', 'Revenue', 'Profit', 'Performance Score'];
    const productRows = data.performanceData.map(p => [
      p.productName, p.sku, p.category, p.totalSold, p.totalRevenue, p.totalProfit, p.performanceScore
    ]);

    const branches = this.getUniqueBranches();
    const branchHeader = ['Branch', 'Products', 'Units', 'Stock Value', 'Low Stock', 'Out of Stock'];
    const branchRows = branches.map(b => [
      b.name,
      this.getBranchProductCount(b.id),
      this.getBranchTotalUnits(b.id),
      this.getBranchStockValue(b.id),
      this.getBranchLowStockCount(b.id),
      this.getBranchOutOfStockCount(b.id)
    ]);

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(summaryRows), 'Summary');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([productHeader, ...productRows]), 'Products');
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([branchHeader, ...branchRows]), 'Branches');
    XLSX.writeFile(workbook, `${this.sanitizeFileName(data.config.name)}.xlsx`);
  }

  private exportAsCsv(data: ReportData): void {
    const header = ['Product', 'SKU', 'Category', 'Units Sold', 'Revenue', 'Profit', 'Performance Score'];
    const rows = data.performanceData.map(p => [
      p.productName, p.sku, p.category, p.totalSold, p.totalRevenue, p.totalProfit, p.performanceScore
    ]);

    const escapeCsvCell = (value: string | number): string => {
      const str = String(value ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const csvContent = [header, ...rows].map(row => row.map(escapeCsvCell).join(',')).join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.sanitizeFileName(data.config.name)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  private sanitizeFileName(name: string): string {
    return (name || 'Report').replace(/[\\/:*?"<>|]/g, '-').trim() || 'Report';
  }

  // ============================================================
  // SCHEDULE
  // ============================================================

  openScheduleModal(): void {
    this.showScheduleModal = true;
  }

  closeScheduleModal(): void {
    this.showScheduleModal = false;
  }

  saveSchedule(): void {
    if (this.scheduleForm.invalid) {
      this.scheduleForm.markAllAsTouched();
      return;
    }

    console.log('Saving schedule:', this.scheduleForm.value);
    this.closeScheduleModal();
  }

  // ============================================================
  // TAB MANAGEMENT
  // ============================================================

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  setPreviewTab(tab: typeof this.previewTab): void {
    this.previewTab = tab;
  }

  selectReport(reportId: string): void {
    this.selectedReportId = reportId;
    this.loadSavedReport(reportId);
  }

  deleteReport(reportId: string): void {
    if (confirm('Are you sure you want to delete this report?')) {
      this.savedReports = this.savedReports.filter(r => r.id !== reportId);
      if (this.reportId === reportId) {
        this.reportData = null;
        this.reportId = '';
        this.isEditing = false;
        this.reportForm.reset();
        this.loadData();
      }
    }
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  goBack(): void {
    if (this.close.observed) {
      this.close.emit();
    } else {
      this.location.back();
    }
  }

  // ============================================================
  // UI HELPERS
  // ============================================================

  getReportTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'PERFORMANCE': 'Performance',
      'INVENTORY': 'Inventory',
      'SALES': 'Sales',
      'TURNOVER': 'Turnover',
      'AFFORDABILITY': 'Affordability',
      'CUSTOM': 'Custom'
    };
    return map[type] || type;
  }

  getReportTypeIcon(type: string): string {
    const map: Record<string, string> = {
      'PERFORMANCE': 'fa-chart-line',
      'INVENTORY': 'fa-boxes',
      'SALES': 'fa-shopping-cart',
      'TURNOVER': 'fa-rotate',
      'AFFORDABILITY': 'fa-wallet',
      'CUSTOM': 'fa-file-alt'
    };
    return map[type] || 'fa-file';
  }

  getStatusColor(score: number): string {
    if (score >= 70) return '#2EB270';
    if (score >= 40) return '#F5A623';
    return '#DC2626';
  }

  getStatusLabel(score: number): string {
    if (score >= 70) return 'High';
    if (score >= 40) return 'Medium';
    return 'Low';
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

  formatDate(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  getBranchNameById(id: string): string {
    const branch = this.branches.find(b => String(b.id) === id);
    return branch?.name || id;
  }

  getUniqueCategories(): string[] {
    const categories = new Set<string>();
    this.products.forEach(p => {
      const cat = typeof p.category === 'string' ? p.category : (p.category as any)?.name;
      if (cat) categories.add(cat);
    });
    return Array.from(categories).sort();
  }

  getUniqueBranches(): { id: string; name: string }[] {
    const inventory = this.reportData?.inventoryData || this.inventory;
    const branchIds = new Set(inventory.map(i => i.branchId));
    return this.branches
      .filter(b => branchIds.has(String(b.id)))
      .map(b => ({ id: String(b.id), name: b.name }));
  }

  getBranchProductCount(branchId: string): number {
    const inventory = this.reportData?.inventoryData || this.inventory;
    return new Set(inventory.filter(i => i.branchId === branchId).map(i => i.productId)).size;
  }

  getBranchTotalUnits(branchId: string): number {
    const inventory = this.reportData?.inventoryData || this.inventory;
    return inventory.filter(i => i.branchId === branchId).reduce((sum, i) => sum + i.quantity, 0);
  }

  getBranchStockValue(branchId: string): number {
    const inventory = this.reportData?.inventoryData || this.inventory;
    return inventory.filter(i => i.branchId === branchId)
      .reduce((sum, i) => sum + (i.quantity * i.sellingPrice), 0);
  }

  getBranchLowStockCount(branchId: string): number {
    const inventory = this.reportData?.inventoryData || this.inventory;
    return inventory.filter(i => i.branchId === branchId && i.quantity <= i.reorderPoint).length;
  }

  getBranchOutOfStockCount(branchId: string): number {
    const inventory = this.reportData?.inventoryData || this.inventory;
    return inventory.filter(i => i.branchId === branchId && i.quantity === 0).length;
  }

  getMaxChartValue(data: number[]): number {
    const max = Math.max(...data);
    return Math.ceil(max / 1000) * 1000 + 1000;
  }

  getScoreBarWidth(score: number): number {
    return Math.min(Math.max(score, 0), 100);
  }

  getBarHeight(value: number, max: number): number {
    if (max === 0) return 0;
    return Math.min((value / max) * 100, 100);
  }

  isSectionIncluded(sectionId: string): boolean {
    if (!this.reportData) return false;
    const sections = this.reportData.config.includeSections as unknown as Record<string, boolean>;
    return !!sections[sectionId];
  }

  getChartTotal(chart: ReportChart): number {
    return chart.data.reduce((sum, v) => sum + v, 0);
  }

  getConicGradient(chart: ReportChart): string {
    const total = this.getChartTotal(chart);
    if (total === 0) return '#e2e8f0';

    let gradient = '';
    let currentAngle = 0;

    chart.data.forEach((value, index) => {
      const percentage = (value / total) * 100;
      const end = currentAngle + percentage;
      const color = chart.colors?.[index] || '#184440';

      if (index === 0) {
        gradient = `conic-gradient(${color} 0% ${end}%`;
      } else {
        gradient += `, ${color} ${currentAngle}% ${end}%`;
      }

      if (index === chart.data.length - 1) {
        gradient += ')';
      }

      currentAngle = end;
    });

    return gradient;
  }
}