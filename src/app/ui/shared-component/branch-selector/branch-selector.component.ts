// branch-selector.component.ts
// ============================================================
// Reusable branch-switching dropdown.
//
// Drop this into any top bar / filter section / form field that
// needs to let the user pick (or switch) a branch. It can load its
// own branch list from InventoryService, or reuse a list the parent
// already has via [branches]. Selection is fully controlled by the
// parent via [selectedBranchId] + (branchChange) — this component
// never navigates or mutates global state on its own, so it's safe
// to use for "switch branch context" (dashboard, branch detail) as
// well as plain "pick a branch" form fields (movement/restock forms).
// ============================================================

import { Component, EventEmitter, Input, OnChanges, OnDestroy, OnInit, Output, SimpleChanges } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { InventoryService } from '../../service/inventory/inventory.service';
import { Branch } from '../../domain/inventory/inventory.dto';

@Component({
  selector: 'app-branch-selector',
  templateUrl: './branch-selector.component.html',
  styleUrls: ['./branch-selector.component.scss']
})
export class BranchSelectorComponent implements OnInit, OnChanges, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  /** Pass an already-loaded branch list to skip this component's own fetch. */
  @Input() branches: Branch[] | null = null;

  /** Currently selected branch id. Pass `null` for "All Branches". */
  @Input() selectedBranchId: string | null = null;

  /** Show a leading "All Branches" option (dashboards / list filters). */
  @Input() showAllOption: boolean = false;

  @Input() allOptionLabel: string = 'All Branches';

  @Input() placeholder: string = 'Select Branch';

  /** 'default' = compact form/filter control. 'title' = large, borderless — for replacing a page heading. */
  @Input() size: 'default' | 'title' = 'default';

  @Input() disabled: boolean = false;

  @Output() branchChange = new EventEmitter<string | null>();

  // ============================================================
  // STATE
  // ============================================================

  branchOptions: Branch[] = [];
  isLoading: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(private inventoryService: InventoryService) { }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  ngOnInit(): void {
    if (this.branches && this.branches.length) {
      this.branchOptions = this.branches;
    } else {
      this.loadBranches();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['branches'] && this.branches) {
      this.branchOptions = this.branches;
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadBranches(): void {
    this.isLoading = true;
    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          this.branchOptions = branches;
          this.isLoading = false;
        },
        error: (err) => {
          console.error('BranchSelector: failed to load branches:', err);
          this.isLoading = false;
        }
      });
  }

  // ============================================================
  // EVENTS
  // ============================================================

  onSelectChange(value: string): void {
    const branchId = value === '' ? null : value;
    this.selectedBranchId = branchId;
    this.branchChange.emit(branchId);
  }

  // ============================================================
  // HELPERS
  // ============================================================

  getSelectedBranchName(): string {
    if (!this.selectedBranchId) return this.allOptionLabel;
    const branch = this.branchOptions.find(b => this.isBranchSelected(b.id));
    return branch ? branch.name : this.placeholder;
  }

  /** selectedBranchId is a string (it comes from a route param / <select> value), Branch.id is a number. */
  isBranchSelected(id: number): boolean {
    return String(id) === this.selectedBranchId;
  }
}
