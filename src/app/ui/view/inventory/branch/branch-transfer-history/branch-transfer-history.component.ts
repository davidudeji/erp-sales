// branch-transfer-history.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, takeUntil, debounceTime, distinctUntilChanged } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  StockMovement,
  MovementType,
  MovementStatus,
  getMovementTypeLabel,
  getMovementTypeIcon
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-branch-transfer-history',
  templateUrl: './branch-transfer-history.component.html',
  styleUrls: ['./branch-transfer-history.component.scss']
})
export class BranchTransferHistoryComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() branchId: string = '';
  @Input() branchName: string = '';
  @Input() limit: number = 20;
  @Input() compact: boolean = false;
  @Input() showFilters: boolean = true;
  @Output() movementSelected = new EventEmitter<string>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  movements: StockMovement[] = [];
  filteredMovements: StockMovement[] = [];
  isLoading: boolean = true;
  error: string | null = null;
  totalItems: number = 0;

  // Filters
  filterForm: FormGroup;
  searchSubject = new Subject<string>();

  // Pagination
  currentPage: number = 1;
  pageSize: number = 10;
  pageSizeOptions: number[] = [5, 10, 20, 50];
  totalPages: number = 0;

  // UI
  Math = Math;
  showFilterDrawer: boolean = false;

  // Enums
  MovementType = MovementType;
  MovementStatus = MovementStatus;

  // Filter options
  movementTypes = ['ALL', ...Object.values(MovementType)];
  movementStatuses = ['ALL', ...Object.values(MovementStatus)];

  // Stats
  stats = {
    total: 0,
    incoming: 0,
    outgoing: 0,
    completed: 0,
    pending: 0,
    inTransit: 0
  };

  // Private
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private fb: FormBuilder
  ) {
    this.filterForm = this.buildFilterForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.loadTransferHistory();
    this.setupSearch();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // SETUP
  // ============================================================

  private buildFilterForm(): FormGroup {
    return this.fb.group({
      search: [''],
      type: ['ALL'],
      status: ['ALL'],
      dateFrom: [''],
      dateTo: ['']
    });
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.filterForm.patchValue({ search: searchTerm });
      this.currentPage = 1;
      this.applyFilters();
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadTransferHistory(): void {
    if (!this.branchId) {
      this.isLoading = false;
      return;
    }

    this.isLoading = true;
    this.error = null;

    // Get all movements for this branch (both incoming and outgoing)
    this.inventoryService.getMovements({
      branchId: this.branchId,
      limit: 100
    })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.movements = response.data;
          this.totalItems = this.movements.length;
          this.applyFilters();
          this.calculateStats();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load transfer history:', err);
          this.error = 'Failed to load transfer history';
          this.isLoading = false;
        }
      });
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilters(): void {
    const formValue = this.filterForm.value;

    this.filteredMovements = this.movements.filter(m => {
      // Search filter
      const searchMatch = !formValue.search ||
        m.productName.toLowerCase().includes(formValue.search.toLowerCase()) ||
        m.sku.toLowerCase().includes(formValue.search.toLowerCase()) ||
        m.fromLocation.name.toLowerCase().includes(formValue.search.toLowerCase()) ||
        m.toLocation.name.toLowerCase().includes(formValue.search.toLowerCase());

      // Type filter
      const typeMatch = formValue.type === 'ALL' ||
        m.movementType === formValue.type;

      // Status filter
      const statusMatch = formValue.status === 'ALL' ||
        m.status === formValue.status;

      // Date range filters
      const dateMatch = this.filterByDate(m);

      return searchMatch && typeMatch && statusMatch && dateMatch;
    });

    // Update pagination
    this.totalItems = this.filteredMovements.length;
    this.totalPages = Math.ceil(this.totalItems / this.pageSize);
    this.currentPage = 1;
  }

  private filterByDate(movement: StockMovement): boolean {
    const dateFrom = this.filterForm.get('dateFrom')?.value;
    const dateTo = this.filterForm.get('dateTo')?.value;

    if (dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      const movementDate = new Date(movement.createdAt);
      return movementDate >= from && movementDate <= to;
    }
    return true;
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      type: 'ALL',
      status: 'ALL',
      dateFrom: '',
      dateTo: ''
    });
    this.searchSubject.next('');
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.searchSubject.next(target.value);
    }
  }

  getActiveFilterCount(): number {
    const formValue = this.filterForm.value;
    let count = 0;
    if (formValue.search) count++;
    if (formValue.type !== 'ALL') count++;
    if (formValue.status !== 'ALL') count++;
    if (formValue.dateFrom) count++;
    if (formValue.dateTo) count++;
    return count;
  }

  // ============================================================
  // STATS CALCULATION
  // ============================================================

  calculateStats(): void {
    this.stats.total = this.movements.length;
    this.stats.incoming = this.movements.filter(m => m.toLocation.id === this.branchId).length;
    this.stats.outgoing = this.movements.filter(m => m.fromLocation.id === this.branchId).length;
    this.stats.completed = this.movements.filter(m => m.status === MovementStatus.COMPLETED).length;
    this.stats.pending = this.movements.filter(m => m.status === MovementStatus.PENDING).length;
    this.stats.inTransit = this.movements.filter(m => m.status === MovementStatus.IN_TRANSIT).length;
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  getPaginatedItems(): StockMovement[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredMovements.slice(start, end);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
  }

  changePageSize(size: number): void {
    this.pageSize = size;
    this.currentPage = 1;
  }

  getPageNumbers(): (number | '...')[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: (number | '...')[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (current > 3) {
        pages.push('...');
      }
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (current < total - 2) {
        pages.push('...');
      }
      pages.push(total);
    }
    return pages;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  viewMovement(movementId: string | number): void {
    this.movementSelected.emit(String(movementId));
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getMovementTypeLabel(type: string): string {
    return getMovementTypeLabel(type as MovementType);
  }

  getMovementTypeIcon(type: string): string {
    return getMovementTypeIcon(type as MovementType);
  }

  getMovementStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  getMovementStatusColor(status: string): string {
    const map: Record<string, string> = {
      [MovementStatus.PENDING]: '#F59E0B',
      [MovementStatus.IN_TRANSIT]: '#3B82F6',
      [MovementStatus.COMPLETED]: '#2EB270',
      [MovementStatus.CANCELLED]: '#6B7280'
    };
    return map[status] || '#6B7280';
  }

  getMovementStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      [MovementStatus.PENDING]: 'pending',
      [MovementStatus.IN_TRANSIT]: 'in-transit',
      [MovementStatus.COMPLETED]: 'completed',
      [MovementStatus.CANCELLED]: 'cancelled'
    };
    return map[status] || 'pending';
  }

  getDirectionLabel(movement: StockMovement): string {
    if (movement.toLocation.id === this.branchId) {
      return 'Incoming';
    }
    if (movement.fromLocation.id === this.branchId) {
      return 'Outgoing';
    }
    return '—';
  }

  getDirectionColor(movement: StockMovement): string {
    if (movement.toLocation.id === this.branchId) {
      return '#2EB270';
    }
    if (movement.fromLocation.id === this.branchId) {
      return '#F59E0B';
    }
    return '#6B7280';
  }

  getDirectionIcon(movement: StockMovement): string {
    if (movement.toLocation.id === this.branchId) {
      return 'fa-arrow-right';
    }
    if (movement.fromLocation.id === this.branchId) {
      return 'fa-arrow-left';
    }
    return 'fa-arrows-alt-h';
  }

  formatDate(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatTime(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
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

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadTransferHistory();
  }
}