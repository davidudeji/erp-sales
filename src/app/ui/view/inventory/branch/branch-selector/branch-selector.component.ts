// branch-selector.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import { Branch } from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-branch-selector',
  templateUrl: './branch-selector.component.html',
  styleUrls: ['./branch-selector.component.scss'],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => BranchSelectorComponent),
      multi: true
    }
  ]
})
export class BranchSelectorComponent implements OnInit, OnDestroy, ControlValueAccessor {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() placeholder: string = 'Search branches...';
  @Input() selectedBranchId: string | null = null;
  @Input() showStatus: boolean = true;
  @Input() showCity: boolean = true;
  @Input() excludeBranchId: string | null = null;
  @Input() filterInactive: boolean = false;
  @Input() compact: boolean = false;
  @Input() label: string = '';

  @Output() branchSelected = new EventEmitter<Branch>();
  @Output() branchChanged = new EventEmitter<string>();

  // ============================================================
  // STATE
  // ============================================================

  branches: Branch[] = [];
  filteredBranches: Branch[] = [];
  isLoading: boolean = true;
  error: string | null = null;

  searchTerm: string = '';
  isOpen: boolean = false;
  selectedBranch: Branch | null = null;

  // ControlValueAccessor
  value: string | null = null;
  onChange: any = () => { };
  onTouched: any = () => { };

  // UI
  Math = Math;
  showDropdown: boolean = false;
  highlightedIndex: number = -1;

  // Private
  private destroy$ = new Subject<void>();
  private searchSubject = new Subject<string>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(private inventoryService: InventoryService) { }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadBranches();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadBranches(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getBranches()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (branches) => {
          this.branches = this.applyFilters(branches);
          this.filteredBranches = this.branches;

          // Select branch if branchId provided
          if (this.selectedBranchId) {
            const found = this.branches.find(b => b.id === this.selectedBranchId);
            if (found) {
              this.selectedBranch = found;
              this.value = found.id;
              this.searchTerm = this.getDisplayName(found);
            }
          }

          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load branches:', err);
          this.error = 'Failed to load branches';
          this.isLoading = false;
        }
      });
  }

  private applyFilters(branches: Branch[]): Branch[] {
    let filtered = [...branches];

    // Exclude specific branch
    if (this.excludeBranchId) {
      filtered = filtered.filter(b => b.id !== this.excludeBranchId);
    }

    // Filter inactive branches
    if (this.filterInactive) {
      filtered = filtered.filter(b => b.status === 'ACTIVE');
    }

    return filtered;
  }

  // ============================================================
  // SEARCH
  // ============================================================

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(term => {
      this.searchTerm = term;
      this.filterBranches();
    });
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.searchSubject.next(input.value);
  }

  filterBranches(): void {
    const term = this.searchTerm.toLowerCase().trim();
    if (!term) {
      this.filteredBranches = this.branches;
      return;
    }

    this.filteredBranches = this.branches.filter(branch =>
      branch.name.toLowerCase().includes(term) ||
      branch.code.toLowerCase().includes(term) ||
      branch.location.city.toLowerCase().includes(term)
    );
  }

  // ============================================================
  // DROPDOWN
  // ============================================================

  toggleDropdown(): void {
    if (this.isOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown(): void {
    this.isOpen = true;
    this.showDropdown = true;
    this.highlightedIndex = -1;
    // Reset filter when opening
    if (this.searchTerm) {
      this.searchTerm = '';
      this.filteredBranches = this.branches;
    }
  }

  closeDropdown(): void {
    this.isOpen = false;
    this.showDropdown = false;
    this.highlightedIndex = -1;
    // Restore search term to selected branch name
    if (this.selectedBranch) {
      this.searchTerm = this.getDisplayName(this.selectedBranch);
    } else {
      this.searchTerm = '';
    }
  }

  // ============================================================
  // SELECTION
  // ============================================================

  selectBranch(branch: Branch): void {
    this.selectedBranch = branch;
    this.value = branch.id;
    this.searchTerm = this.getDisplayName(branch);
    this.closeDropdown();

    // Notify
    this.onChange(branch.id);
    this.branchSelected.emit(branch);
    this.branchChanged.emit(branch.id);
  }

  clearSelection(): void {
    this.selectedBranch = null;
    this.value = null;
    this.searchTerm = '';
    this.onChange(null);
    this.branchSelected.emit(null as any);
    this.branchChanged.emit(null as any);
  }

  // ============================================================
  // KEYBOARD NAVIGATION
  // ============================================================

  onKeydown(event: KeyboardEvent): void {
    if (!this.isOpen) {
      if (event.key === 'ArrowDown' || event.key === 'Enter') {
        event.preventDefault();
        this.openDropdown();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.highlightedIndex = Math.min(this.highlightedIndex + 1, this.filteredBranches.length - 1);
        this.scrollToHighlighted();
        break;

      case 'ArrowUp':
        event.preventDefault();
        this.highlightedIndex = Math.max(this.highlightedIndex - 1, -1);
        this.scrollToHighlighted();
        break;

      case 'Enter':
        event.preventDefault();
        if (this.highlightedIndex >= 0 && this.highlightedIndex < this.filteredBranches.length) {
          this.selectBranch(this.filteredBranches[this.highlightedIndex]);
        }
        break;

      case 'Escape':
        event.preventDefault();
        this.closeDropdown();
        break;
    }
  }

  private scrollToHighlighted(): void {
    setTimeout(() => {
      const items = document.querySelectorAll('.ql-selector-option');
      if (items[this.highlightedIndex]) {
        items[this.highlightedIndex].scrollIntoView({ block: 'nearest' });
      }
    }, 50);
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getDisplayName(branch: Branch): string {
    return `${branch.name} (${branch.code})`;
  }

  getBranchStatusColor(status: string): string {
    const map: Record<string, string> = {
      'ACTIVE': '#2EB270',
      'INACTIVE': '#6B7280',
      'UNDER_CONSTRUCTION': '#F59E0B'
    };
    return map[status] || '#6B7280';
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getBranchTypeLabel(type: string): string {
    const map: Record<string, string> = {
      'FLAGSHIP': 'Flagship',
      'STANDARD': 'Standard',
      'MINI': 'Mini'
    };
    return map[type] || type;
  }

  getInitials(name: string): string {
    if (!name) return '?';
    return name.charAt(0).toUpperCase();
  }

  // ============================================================
  // CONTROL VALUE ACCESSOR
  // ============================================================

  writeValue(value: string | null): void {
    this.value = value;
    if (value) {
      const found = this.branches.find(b => b.id === value);
      if (found) {
        this.selectedBranch = found;
        this.searchTerm = this.getDisplayName(found);
      }
    } else {
      this.selectedBranch = null;
      this.searchTerm = '';
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    // Handle disabled state if needed
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadBranches();
  }
}