// branch-inventory-table.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  BranchInventory,
  Branch,
  getStockStatus,
  getStockStatusColor,
  getStockStatusLabel
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-branch-inventory-table',
  templateUrl: './branch-inventory-table.component.html',
  styleUrls: ['./branch-inventory-table.component.scss']
})
export class BranchInventoryTableComponent implements OnInit, OnDestroy, OnChanges {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() branchId: string = '';
  @Input() branch: Branch | null = null;
  @Input() compact: boolean = false;
  @Output() productSelected = new EventEmitter<string>();
  @Output() transferRequested = new EventEmitter<string>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  inventoryItems: BranchInventory[] = [];
  filteredItems: BranchInventory[] = [];
  isLoading: boolean = true;
  error: string | null = null;

  // Filters
  filterForm: FormGroup;
  searchSubject = new Subject<string>();

  // Sorting
  sortField: string = 'productName';
  sortDirection: 'asc' | 'desc' = 'asc';

  // Selection
  selectedItems: Set<number> = new Set();
  selectAll: boolean = false;

  // UI
  Math = Math;
  showBulkActions: boolean = false;
  showEditModal: boolean = false;
  editingItem: BranchInventory | null = null;
  isSaving: boolean = false;
  editForm: FormGroup;

  // Pagination
  currentPage: number = 1;
  pageSize: number = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];
  totalItems: number = 0;

  // Stock status options for filter
  stockStatuses = ['ALL', 'CRITICAL', 'LOW', 'NORMAL', 'OVERSTOCK'];

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
    this.editForm = this.buildEditForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.setupSearch();
    if (this.branchId) {
      this.loadInventory();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['branchId'] && !changes['branchId'].firstChange && this.branchId) {
      this.loadInventory();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // FORM BUILDING
  // ============================================================

  private buildFilterForm(): FormGroup {
    return this.fb.group({
      search: [''],
      stockStatus: ['ALL'],
      category: ['ALL'],
      minStock: [''],
      maxStock: ['']
    });
  }

  private buildEditForm(): FormGroup {
    return this.fb.group({
      quantity: [''],
      reorderPoint: [''],
      safetyStock: [''],
      sellingPrice: ['']
    });
  }

  private setupSearch(): void {
    this.searchSubject.pipe(
      debounceTime(400),
      distinctUntilChanged(),
      takeUntil(this.destroy$)
    ).subscribe(searchTerm => {
      this.filterForm.patchValue({ search: searchTerm });
      this.applyFilters();
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadInventory(): void {
    this.isLoading = true;
    this.error = null;

    this.inventoryService.getBranchInventory(this.branchId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (items) => {
          this.inventoryItems = items;
          this.totalItems = items.length;
          this.applyFilters();
          this.isLoading = false;
          this.selectedItems.clear();
          this.selectAll = false;
        },
        error: (err) => {
          console.error('Failed to load branch inventory:', err);
          this.error = 'Failed to load inventory. Please try again.';
          this.isLoading = false;
        }
      });
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilters(): void {
    const formValue = this.filterForm.value;

    this.filteredItems = this.inventoryItems.filter(item => {
      // Search filter
      const searchMatch = !formValue.search ||
        item.productName.toLowerCase().includes(formValue.search.toLowerCase()) ||
        item.sku.toLowerCase().includes(formValue.search.toLowerCase());

      // Stock status filter
      const status = getStockStatus(item.quantity, item.reorderPoint, item.safetyStock);
      const statusMatch = formValue.stockStatus === 'ALL' ||
        status === formValue.stockStatus;

      // Stock range filters
      const minMatch = !formValue.minStock || item.quantity >= parseInt(formValue.minStock);
      const maxMatch = !formValue.maxStock || item.quantity <= parseInt(formValue.maxStock);

      return searchMatch && statusMatch && minMatch && maxMatch;
    });

    // Apply sorting
    this.sortItems();

    // Update pagination
    this.totalItems = this.filteredItems.length;
    this.currentPage = 1;
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      stockStatus: 'ALL',
      category: 'ALL',
      minStock: '',
      maxStock: ''
    });
    this.searchSubject.next('');
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
    if (formValue.stockStatus !== 'ALL') count++;
    if (formValue.category !== 'ALL') count++;
    if (formValue.minStock) count++;
    if (formValue.maxStock) count++;
    return count;
  }

  // ============================================================
  // SORTING
  // ============================================================

  toggleSort(field: string): void {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortField = field;
      this.sortDirection = 'asc';
    }
    this.sortItems();
  }

  private sortItems(): void {
    this.filteredItems.sort((a, b) => {
      let aVal: any = (a as any)[this.sortField];
      let bVal: any = (b as any)[this.sortField];

      // Handle nested properties
      if (this.sortField === 'productName') {
        aVal = a.productName;
        bVal = b.productName;
      }

      // Handle strings
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        const comparison = aVal.toLowerCase().localeCompare(bVal.toLowerCase());
        return this.sortDirection === 'asc' ? comparison : -comparison;
      }

      // Handle numbers
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return this.sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });
  }

  getSortIcon(field: string): string {
    if (this.sortField !== field) {
      return 'fa-sort';
    }
    return this.sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down';
  }

  // ============================================================
  // SELECTION
  // ============================================================

  toggleSelectAll(): void {
    this.selectAll = !this.selectAll;
    if (this.selectAll) {
      this.filteredItems.forEach(item => this.selectedItems.add(item.id));
    } else {
      this.selectedItems.clear();
    }
  }

  toggleSelectItem(id: number): void {
    if (this.selectedItems.has(id)) {
      this.selectedItems.delete(id);
    } else {
      this.selectedItems.add(id);
    }
    this.selectAll = this.filteredItems.every(item => this.selectedItems.has(item.id));
  }

  isSelected(id: number): boolean {
    return this.selectedItems.has(id);
  }

  getSelectedCount(): number {
    return this.selectedItems.size;
  }

  // ============================================================
  // BULK ACTIONS
  // ============================================================

  bulkAction(action: string): void {
    if (this.selectedItems.size === 0) return;

    switch (action) {
      case 'transfer':
        this.bulkTransfer();
        break;
      case 'adjust':
        this.bulkAdjust();
        break;
      default:
        break;
    }
  }

  private bulkTransfer(): void {
    // Navigate to transfer with selected items
    const ids = Array.from(this.selectedItems);
    this.router.navigate(['/admin/sales/commerce/inventory/movements/transfer'], {
      queryParams: {
        ids: ids.join(','),
        branchId: this.branchId
      }
    });
    this.selectedItems.clear();
    this.selectAll = false;
  }

  private bulkAdjust(): void {
    // Navigate to adjustment with selected items
    const ids = Array.from(this.selectedItems);
    this.router.navigate(['/admin/sales/commerce/inventory/movements/new'], {
      queryParams: {
        ids: ids.join(','),
        branchId: this.branchId
      }
    });
    this.selectedItems.clear();
    this.selectAll = false;
  }

  // ============================================================
  // EDIT MODAL
  // ============================================================

  openEditModal(item: BranchInventory): void {
    this.editingItem = item;
    this.editForm.patchValue({
      quantity: item.quantity,
      reorderPoint: item.reorderPoint,
      safetyStock: item.safetyStock,
      sellingPrice: item.sellingPrice
    });
    this.showEditModal = true;
  }

  closeEditModal(): void {
    this.showEditModal = false;
    this.editingItem = null;
    this.editForm.reset();
  }

  saveEdit(): void {
    if (!this.editingItem) return;

    const formValue = this.editForm.value;
    const item = this.editingItem;
    const updates = {
      quantity: formValue.quantity !== undefined ? parseInt(formValue.quantity) : item.quantity,
      reorderPoint: formValue.reorderPoint !== undefined ? parseInt(formValue.reorderPoint) : item.reorderPoint,
      safetyStock: formValue.safetyStock !== undefined ? parseInt(formValue.safetyStock) : item.safetyStock,
      sellingPrice: formValue.sellingPrice !== undefined ? parseFloat(formValue.sellingPrice) : item.sellingPrice
    };

    this.isSaving = true;
    this.inventoryService.saveBranchInventoryItem({
      branchId: item.branchId,
      productId: item.productId,
      quantity: updates.quantity,
      reorderPoint: updates.reorderPoint,
      safetyStock: updates.safetyStock,
      sellingPrice: updates.sellingPrice,
      costPrice: item.costPrice
    }).subscribe({
      next: (saved) => {
        // Mutate the same object reference that's already in inventoryItems/filteredItems
        // so the table reflects the persisted values immediately, no re-fetch needed.
        item.quantity = saved.quantity;
        item.reorderPoint = saved.reorderPoint;
        item.safetyStock = saved.safetyStock;
        item.sellingPrice = saved.sellingPrice;
        item.lastUpdated = saved.lastUpdated;
        this.isSaving = false;
        this.closeEditModal();
      },
      error: (err) => {
        console.error('Failed to update inventory item:', err);
        this.isSaving = false;
      }
    });
  }

  // ============================================================
  // ACTIONS
  // ============================================================

  viewProduct(productId: string): void {
    this.productSelected.emit(productId);
  }

  requestTransfer(productId: string): void {
    this.transferRequested.emit(productId);
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getStockStatus(quantity: number, reorderPoint: number, safetyStock: number): 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK' {
    return getStockStatus(quantity, reorderPoint, safetyStock);
  }

  getStockStatusColor(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusColor(status);
  }

  getStockStatusLabel(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    return getStockStatusLabel(status);
  }

  getStockStatusClass(status: 'CRITICAL' | 'LOW' | 'NORMAL' | 'OVERSTOCK'): string {
    const map = {
      'CRITICAL': 'critical',
      'LOW': 'low',
      'NORMAL': 'normal',
      'OVERSTOCK': 'overstock'
    };
    return map[status] || 'normal';
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

  getStatusBadgeClass(status: string): string {
    const map: Record<string, string> = {
      'ACTIVE': 'active',
      'INACTIVE': 'inactive',
      'UNDER_CONSTRUCTION': 'construction'
    };
    return map[status] || 'active';
  }

  getStockStatusLabelFromClass(statusClass: string): string {
    const map: Record<string, string> = {
      'critical': 'Critical',
      'low': 'Low Stock',
      'normal': 'Normal',
      'overstock': 'Overstock'
    };
    return map[statusClass] || 'Normal';
  }

  getPaginatedItems(): BranchInventory[] {
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    return this.filteredItems.slice(start, end);
  }

  getTotalPages(): number {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  getPageNumbers(): number[] {
    const total = this.getTotalPages();
    const current = this.currentPage;
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (current > 3) {
        pages.push(0); // ellipsis
      }
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      if (current < total - 2) {
        pages.push(0); // ellipsis
      }
      pages.push(total);
    }
    return pages;
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.getTotalPages()) return;
    this.currentPage = page;
  }

  changePageSize(size: any): void {
    this.pageSize = parseInt(size, 10) || 20;
    this.currentPage = 1;
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadInventory();
  }
}