// analytics.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { Product, Branch } from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-analytics',
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.scss'
})
export class AnalyticsComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  activeTab: 'product' | 'branch' | 'affordability' | 'turnover' | 'likelihood' | 'reports' = 'product';

  products: Product[] = [];
  branches: Branch[] = [];
  isLoadingProducts: boolean = true;
  isLoadingBranches: boolean = true;

  selectedProductId: string = '';
  selectedBranchId: string | null = null;

  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(private inventoryService: InventoryService) { }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadProducts();
    this.loadBranches();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  private loadProducts(): void {
    this.isLoadingProducts = true;
    this.inventoryService.getProducts({ limit: 500 })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.products = response.data;
          if (!this.selectedProductId && this.products.length > 0) {
            this.selectedProductId = String(this.products[0].id);
          }
          this.isLoadingProducts = false;
        },
        error: (err) => {
          console.error('Failed to load products:', err);
          this.isLoadingProducts = false;
        }
      });
  }

  private loadBranches(): void {
    this.isLoadingBranches = true;
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          this.branches = branches;
          if (!this.selectedBranchId && branches.length > 0) {
            this.selectedBranchId = String(branches[0].id);
          }
          this.isLoadingBranches = false;
        },
        error: (err) => {
          console.error('Failed to load branches:', err);
          this.isLoadingBranches = false;
        }
      });
  }

  // ============================================================
  // TAB MANAGEMENT
  // ============================================================

  setActiveTab(tab: typeof this.activeTab): void {
    this.activeTab = tab;
  }

  // ============================================================
  // SELECTION
  // ============================================================

  onProductChange(productId: string): void {
    this.selectedProductId = productId;
  }

  onBranchChange(branchId: string | null): void {
    this.selectedBranchId = branchId;
  }

  /** <app-product-analytics>/<app-branch-analytics> normally emit this to close a routed detail
   *  view. Embedded here as tabs there's nothing to close back to, so this is a deliberate no-op —
   *  it exists to stop their internal "Back" button from falling back to browser history. */
  noopClose(): void { }
}
