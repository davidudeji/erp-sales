// restock-suggestions-page.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { Branch } from '../../../../domain/inventory/inventory.dto';
import { RestockSuggestion } from '../restock-suggestion/restock-suggestion.component';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-restock-suggestions-page',
  templateUrl: './restock-suggestions-page.component.html',
  styleUrls: ['./restock-suggestions-page.component.scss']
})
export class RestockSuggestionsPageComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  branches: Branch[] = [];
  selectedBranchId: string | null = null;

  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router
  ) { }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => this.branches = branches,
        error: (err) => console.error('Failed to load branches:', err)
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  onBranchChange(branchId: string | null): void {
    this.selectedBranchId = branchId;
  }

  goBack(): void {
    this.router.navigate(['/admin/sales/commerce/inventory']);
  }

  /** <app-restock-suggestion> handles its own navigation to the new-request form. */
  onCreateRequest(_suggestion: RestockSuggestion): void { }
}
