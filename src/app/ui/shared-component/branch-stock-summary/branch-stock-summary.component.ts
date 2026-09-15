// branch-stock-summary.component.ts
// ============================================================
// Reusable branch stock summary widget.
//
// Given a branchId it shows live totals (products, units, value,
// low/out-of-stock counts) computed from that branch's actual
// inventory — not the static dashboard mock summary — so it stays
// correct as products are assigned/adjusted. When branchId is
// falsy/null it shows an aggregate across all branches, which is
// what lets it sit behind the dashboard's "All Branches" selection.
// ============================================================

import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, Subscription, forkJoin, interval, takeUntil } from 'rxjs';
import { InventoryService } from '../../service/inventory/inventory.service';
import { BranchStockSummary } from '../../domain/inventory/inventory.dto';

@Component({
  selector: 'app-branch-stock-summary',
  templateUrl: './branch-stock-summary.component.html',
  styleUrls: ['./branch-stock-summary.component.scss']
})
export class BranchStockSummaryComponent implements OnInit, OnChanges, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  /** Branch to summarize. Falsy/null = aggregate across all branches. */
  @Input() branchId: string | number | null = null;

  /** Condensed layout for sidebars / grid cards — no top-sellers list, tighter tiles. */
  @Input() compact: boolean = false;

  /** Show the "View Branch" / "Add Product" quick actions footer. */
  @Input() showActions: boolean = true;

  /** Auto-refresh interval in ms. 0/undefined disables auto-refresh. */
  @Input() refreshInterval: number = 0;

  @Output() summaryLoaded = new EventEmitter<BranchStockSummary>();

  // ============================================================
  // STATE
  // ============================================================

  summary: BranchStockSummary | null = null;
  isLoading: boolean = true;
  error: string | null = null;

  private destroy$ = new Subject<void>();
  private refreshSub: Subscription | null = null;

  constructor(
    private inventoryService: InventoryService,
    private router: Router
  ) { }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngOnInit(): void {
    this.loadSummary();
    this.setupAutoRefresh();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['branchId'] && !changes['branchId'].firstChange) {
      this.loadSummary();
    }
    if (changes['refreshInterval'] && !changes['refreshInterval'].firstChange) {
      this.setupAutoRefresh();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    this.refreshSub?.unsubscribe();
  }

  private setupAutoRefresh(): void {
    this.refreshSub?.unsubscribe();
    if (this.refreshInterval && this.refreshInterval > 0) {
      this.refreshSub = interval(this.refreshInterval)
        .pipe(takeUntil(this.destroy$))
        .subscribe(() => this.loadSummary());
    }
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadSummary(): void {
    this.isLoading = true;
    this.error = null;

    if (this.branchId) {
      this.loadSingleBranchSummary(String(this.branchId));
    } else {
      this.loadAllBranchesSummary();
    }
  }

  private loadSingleBranchSummary(branchId: string): void {
    forkJoin({
      branch: this.inventoryService.getBranch(branchId),
      inventory: this.inventoryService.getBranchInventory(branchId),
      allSummaries: this.inventoryService.getBranchSummaries()
    }).pipe(takeUntil(this.destroy$)).subscribe({
      next: ({ branch, inventory, allSummaries }) => {
        const totalStockUnits = inventory.reduce((sum, item) => sum + item.quantity, 0);
        const totalStockValue = inventory.reduce((sum, item) => sum + item.quantity * item.sellingPrice, 0);
        const lowStockCount = inventory.filter(item => item.quantity > 0 && item.quantity <= item.reorderPoint).length;
        const outOfStockCount = inventory.filter(item => item.quantity <= 0).length;
        const matched = allSummaries.find(s => s.branchId === branchId);

        this.summary = {
          branchId,
          branchName: branch.name,
          totalProducts: inventory.length,
          totalStockUnits,
          totalStockValue,
          lowStockCount,
          outOfStockCount,
          topSellingProducts: matched?.topSellingProducts
        };
        this.isLoading = false;
        this.summaryLoaded.emit(this.summary);
      },
      error: (err) => {
        console.error('BranchStockSummary: failed to load branch summary:', err);
        this.error = 'Failed to load branch stock summary.';
        this.isLoading = false;
      }
    });
  }

  private loadAllBranchesSummary(): void {
    this.inventoryService.getDashboardStats()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (stats) => {
          this.summary = {
            branchId: 'all',
            branchName: 'All Branches',
            totalProducts: stats.totalSkus,
            totalStockUnits: stats.totalStockUnits,
            totalStockValue: stats.totalStockValue,
            lowStockCount: stats.lowStockItems,
            outOfStockCount: stats.outOfStockItems
          };
          this.isLoading = false;
          this.summaryLoaded.emit(this.summary);
        },
        error: (err) => {
          console.error('BranchStockSummary: failed to load aggregate stats:', err);
          this.error = 'Failed to load stock summary.';
          this.isLoading = false;
        }
      });
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  refresh(): void {
    this.loadSummary();
  }

  viewBranch(): void {
    if (this.branchId) {
      this.router.navigate(['/admin/sales/commerce/inventory/branches', this.branchId]);
    }
  }

  addProduct(): void {
    if (this.branchId) {
      this.router.navigate(['/admin/sales/commerce/inventory/branches', this.branchId, 'add-product']);
    }
  }

  // ============================================================
  // HELPERS
  // ============================================================

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
    if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
    if (value >= 1000) return (value / 1000).toFixed(1) + 'K';
    return value.toString();
  }
}
