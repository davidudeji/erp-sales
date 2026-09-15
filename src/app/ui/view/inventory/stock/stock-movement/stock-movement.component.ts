import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { FormBuilder, FormGroup } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, takeUntil } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  StockMovement,
  MovementType,
  MovementStatus,
  hasUnresolvedChangeRequest,
  getMovementTypeLabel,
  getMovementTypeIcon,
  MovementFilters
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-stock-movement',
  templateUrl: './stock-movement.component.html',
  styleUrls: ['./stock-movement.component.scss']
})
export class StockMovementComponent implements OnInit, OnDestroy {

  // ============================================================
  // STATE
  // ============================================================

  // Data
  movements: StockMovement[] = [];
  filteredMovements: StockMovement[] = [];
  totalElements: number = 0;
  totalPages: number = 0;

  // Loading
  isLoading: boolean = true;
  isExporting: boolean = false;

  // Filters
  filterForm: FormGroup;
  searchSubject = new Subject<string>();

  // Pagination
  currentPage: number = 0;
  pageSize: number = 20;
  pageSizeOptions: number[] = [10, 20, 50, 100];

  // Selection
  selectedMovementIds: Set<number> = new Set();
  selectAll: boolean = false;

  // UI
  Math = Math;
  showFilterDrawer: boolean = false;
  showTransferMenu: boolean = false;
  aiDismissed: boolean = false;

  // Row-level Approve/Reject confirmation
  actionTargetMovement: StockMovement | null = null;
  showApproveConfirm: boolean = false;
  showRejectConfirm: boolean = false;
  showRequestChangesModal: boolean = false;
  isProcessingAction: boolean = false;
  rejectReason: string = '';
  changesReason: string = '';

  // Enums
  MovementType = MovementType;
  MovementStatus = MovementStatus;

  // Filter options — movementTypes is loaded dynamically (see loadMovementTypes()) so custom
  // types added via the movement form's "+ Add Movement Type" show up as filters here too.
  movementTypes: string[] = ['ALL', ...Object.values(MovementType)];
  movementStatuses = ['ALL', ...Object.values(MovementStatus)];

  // Stats
  stats = {
    total: 0,
    pending: 0,
    inTransit: 0,
    completed: 0,
    cancelled: 0
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
    this.loadMovements();
    this.setupSearch();
    this.loadMovementTypes();
  }

  private loadMovementTypes(): void {
    this.inventoryService.getMovementTypes()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (types) => { this.movementTypes = ['ALL', ...types]; },
        error: (err) => console.error('Failed to load movement types:', err)
      });
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
      this.currentPage = 0;
      this.loadMovements();
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadMovements(): void {
    this.isLoading = true;

    const filters = this.buildFilters();

    this.inventoryService.getMovements(filters)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          // The search filter is applied server-side (via buildFilters()) before pagination,
          // so response.data is already the correct page of already-filtered results — no
          // client-side re-filtering needed here.
          this.movements = response.data;
          this.filteredMovements = response.data;
          // Previously these were derived from filteredMovements.length, i.e. the size of the
          // current page (at most pageSize) — so totalPages was always ~1 and Next/page-number
          // buttons never had anywhere further to go. Use the service's real grand total instead.
          this.totalElements = response.total;
          this.totalPages = response.totalPages;
          this.calculateStats();
          this.isLoading = false;
          this.selectedMovementIds.clear();
          this.selectAll = false;
        },
        error: (err) => {
          console.error('Failed to load movements:', err);
          this.isLoading = false;
        }
      });
  }

  private buildFilters(): MovementFilters {
    const formValue = this.filterForm.value;
    const filters: MovementFilters = {
      page: this.currentPage,
      limit: this.pageSize
    };

    if (formValue.type && formValue.type !== 'ALL') filters.type = formValue.type;
    if (formValue.status && formValue.status !== 'ALL') filters.status = formValue.status;
    if (formValue.search) filters.search = formValue.search;
    if (formValue.dateFrom) filters.dateFrom = new Date(formValue.dateFrom);
    if (formValue.dateTo) filters.dateTo = new Date(formValue.dateTo);

    return filters;
  }

  private calculateStats(): void {
    this.stats.total = this.totalElements;
    this.stats.pending = this.movements.filter(m => m.status === MovementStatus.PENDING).length;
    this.stats.inTransit = this.movements.filter(m => m.status === MovementStatus.IN_TRANSIT).length;
    this.stats.completed = this.movements.filter(m => m.status === MovementStatus.COMPLETED).length;
    this.stats.cancelled = this.movements.filter(m => m.status === MovementStatus.CANCELLED).length;
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilters(): void {
    this.currentPage = 0;
    this.loadMovements();
    this.showFilterDrawer = false;
  }

  clearFilters(): void {
    this.filterForm.reset({
      search: '',
      type: 'ALL',
      status: 'ALL',
      dateFrom: '',
      dateTo: ''
    });
    this.currentPage = 0;
    this.loadMovements();
    this.showFilterDrawer = false;
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

  getFilterSummary(): string {
    const parts: string[] = [];
    const formValue = this.filterForm.value;

    if (formValue.type !== 'ALL') parts.push(`Type: ${this.getMovementTypeLabel(formValue.type)}`);
    if (formValue.status !== 'ALL') parts.push(`Status: ${this.getMovementStatusLabel(formValue.status)}`);
    if (formValue.dateFrom) parts.push(`From: ${this.formatDate(formValue.dateFrom)}`);
    if (formValue.dateTo) parts.push(`To: ${this.formatDate(formValue.dateTo)}`);

    return parts.length > 0 ? parts.join(' · ') : 'All movements';
  }

  // ============================================================
  // PAGINATION
  // ============================================================

  onPageChange(page: number): void {
    this.currentPage = page;
    this.loadMovements();
  }

  onPageSizeChange(size: number): void {
    this.pageSize = size;
    this.currentPage = 0;
    this.loadMovements();
  }

  getPageNumbers(): number[] {
    const total = this.totalPages;
    const current = this.currentPage;
    const pages: number[] = [];

    if (total <= 7) {
      for (let i = 0; i < total; i++) pages.push(i);
    } else {
      pages.push(0);
      if (current > 2) pages.push(-1);
      const start = Math.max(1, current - 1);
      const end = Math.min(total - 2, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 3) pages.push(-1);
      pages.push(total - 1);
    }
    return pages;
  }

  // ============================================================
  // SELECTION
  // ============================================================

  toggleSelectAll(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.selectAll = checked;
    if (checked) {
      this.filteredMovements.forEach(m => this.selectedMovementIds.add(m.id));
    } else {
      this.selectedMovementIds.clear();
    }
  }

  toggleSelection(id: number, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedMovementIds.add(id);
    } else {
      this.selectedMovementIds.delete(id);
    }
    this.selectAll = this.filteredMovements.every(m => this.selectedMovementIds.has(m.id));
  }

  isSelected(id: number): boolean {
    return this.selectedMovementIds.has(id);
  }

  getSelectedCount(): number {
    return this.selectedMovementIds.size;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  viewMovement(id: string | number): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements', id]);
  }

  navigateToNew(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements/new']);
  }

  toggleTransferMenu(): void {
    this.showTransferMenu = !this.showTransferMenu;
  }

  closeTransferMenu(): void {
    this.showTransferMenu = false;
  }

  navigateToTransfer(): void {
    this.showTransferMenu = false;
    this.router.navigate(['/admin/sales/commerce/inventory/movements/transfer']);
  }

  navigateToBulkTransfer(): void {
    this.showTransferMenu = false;
    this.router.navigate(['/admin/sales/commerce/inventory/movements/bulk-transfer']);
  }

  navigateToAdjustment(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements/new']);
  }

  navigateToApprovals(): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements/approvals']);
  }

  // ============================================================
  // ROW-LEVEL APPROVE / REJECT
  // ============================================================

  /** True for a TRANSFER movement — the Approve confirmation offers "Request Changes" as an
   *  alternative to a straight approve only for these, matching Movement Approvals. */
  isTransferMovement(movement: StockMovement | null): boolean {
    return movement?.movementType === MovementType.TRANSFER;
  }

  /** While changes are outstanding, Approve/Reject/Request Changes stay hidden — nothing to
   *  approve or reject yet, and asking for changes twice makes no sense. They reappear once
   *  the movement is edited (see StockMovementFormComponent.save()). */
  hasUnresolvedChangeRequest(movement: StockMovement): boolean {
    return hasUnresolvedChangeRequest(movement);
  }

  openApproveConfirm(movement: StockMovement): void {
    this.actionTargetMovement = movement;
    this.showApproveConfirm = true;
  }

  openRejectConfirm(movement: StockMovement): void {
    this.actionTargetMovement = movement;
    this.rejectReason = '';
    this.showRejectConfirm = true;
  }

  openRequestChangesConfirm(movement: StockMovement): void {
    this.actionTargetMovement = movement;
    this.changesReason = '';
    this.showRequestChangesModal = true;
  }

  /** From the Approve confirmation, switches to the Request Changes form for the same movement
   *  instead of approving it outright — only reachable there for transfers. */
  switchToRequestChanges(): void {
    this.showApproveConfirm = false;
    this.changesReason = '';
    this.showRequestChangesModal = true;
  }

  closeActionModals(): void {
    this.showApproveConfirm = false;
    this.showRejectConfirm = false;
    this.showRequestChangesModal = false;
    this.actionTargetMovement = null;
    this.rejectReason = '';
    this.changesReason = '';
  }

  confirmApproveMovement(): void {
    if (!this.actionTargetMovement || this.isProcessingAction) return;
    this.isProcessingAction = true;
    const id = this.actionTargetMovement.id;

    // Approving moves a transfer to IN_TRANSIT, not straight to COMPLETED — stock only actually
    // moves once the movement is later marked COMPLETED (see InventoryService.updateMovement()/
    // applyTransferStockAdjustment()). For non-transfer movement types this is simply their
    // approval step in the same PENDING -> IN_TRANSIT -> COMPLETED lifecycle.
    this.inventoryService.updateMovement(id, {
      status: MovementStatus.IN_TRANSIT,
      approvedBy: 'usr-1',
      approvedByName: 'John Doe',
      approvedAt: new Date()
    }).subscribe({
      next: () => {
        this.isProcessingAction = false;
        this.closeActionModals();
        this.loadMovements();
      },
      error: (err) => {
        console.error('Failed to approve movement:', err);
        this.isProcessingAction = false;
      }
    });
  }

  confirmRejectMovement(): void {
    if (!this.actionTargetMovement || this.isProcessingAction) return;
    this.isProcessingAction = true;
    const movement = this.actionTargetMovement;
    const reason = this.rejectReason.trim();

    this.inventoryService.updateMovement(movement.id, {
      status: MovementStatus.CANCELLED,
      notes: (movement.notes || '') + (reason ? `\nRejection reason: ${reason}` : '')
    }).subscribe({
      next: () => {
        this.isProcessingAction = false;
        this.closeActionModals();
        this.loadMovements();
      },
      error: (err) => {
        console.error('Failed to reject movement:', err);
        this.isProcessingAction = false;
      }
    });
  }

  confirmRequestChanges(): void {
    if (!this.actionTargetMovement || this.isProcessingAction) return;
    const reason = this.changesReason.trim();
    if (!reason) return;
    this.isProcessingAction = true;
    const movement = this.actionTargetMovement;

    // Status stays PENDING — requesting changes doesn't approve or reject, just leaves a note
    // (matches Movement Approvals' submitChanges()); the Branch Manager dashboard surfaces this
    // note as a notification linking straight to the edit form.
    this.inventoryService.updateMovement(movement.id, {
      notes: (movement.notes || '') + `\nChanges requested: ${reason}`
    }).subscribe({
      next: () => {
        this.isProcessingAction = false;
        this.closeActionModals();
        this.loadMovements();
      },
      error: (err) => {
        console.error('Failed to request changes:', err);
        this.isProcessingAction = false;
      }
    });
  }

  // ============================================================
  // EXPORT
  // ============================================================

  exportMovements(): void {
    this.isExporting = true;

    // In real implementation, this would call an export API
    setTimeout(() => {
      this.isExporting = false;
      console.log('Exporting movements...');
    }, 1500);
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

  getDirectionIcon(movement: StockMovement): string {
    if (movement.movementType === MovementType.PURCHASE) return 'fa-arrow-down';
    if (movement.movementType === MovementType.SALE) return 'fa-arrow-up';
    if (movement.movementType === MovementType.RETURN) return 'fa-arrow-left';
    if (movement.movementType === MovementType.TRANSFER) return 'fa-arrows-alt-h';
    return 'fa-arrow-right';
  }

  getDirectionColor(movement: StockMovement): string {
    if (movement.movementType === MovementType.PURCHASE) return '#2EB270';
    if (movement.movementType === MovementType.SALE) return '#DC2626';
    if (movement.movementType === MovementType.TRANSFER) return '#3B82F6';
    return '#6B7280';
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
    this.loadMovements();
  }
}