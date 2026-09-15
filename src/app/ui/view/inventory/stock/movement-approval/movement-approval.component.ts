// movement-approval.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil, forkJoin } from 'rxjs';
import { InventoryService } from '../../../../service/inventory/inventory.service';
import {
  StockMovement,
  MovementStatus,
  MovementType,
  Branch,
  Product,
  hasUnresolvedChangeRequest,
  getMovementTypeLabel,
  getMovementTypeIcon,
  getMovementStatusLabel
} from '../../../../domain/inventory/inventory.dto';

// ============================================================
// INTERFACES
// ============================================================

export interface ApprovalAction {
  movementId: string;
  action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
  comments: string;
  approvedBy: string;
  approvedByName: string;
  timestamp: Date;
  changesRequested?: {
    field: string;
    currentValue: any;
    suggestedValue: any;
  }[];
}

export interface ApprovalStats {
  totalPending: number;
  totalApproved: number;
  totalRejected: number;
  totalRequestedChanges: number;
  averageApprovalTime: number; // in hours
  urgentCount: number;
  highValueCount: number;
}

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-movement-approval',
  templateUrl: './movement-approval.component.html',
  styleUrls: ['./movement-approval.component.scss']
})
export class MovementApprovalComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS / OUTPUTS
  // ============================================================

  @Input() movementId: string = '';
  @Input() autoSelect: boolean = true;
  @Output() close = new EventEmitter<void>();
  @Output() approvalComplete = new EventEmitter<ApprovalAction>();

  // ============================================================
  // STATE
  // ============================================================

  // Data
  movements: StockMovement[] = [];
  filteredMovements: StockMovement[] = [];
  selectedMovement: StockMovement | null = null;
  branches: Branch[] = [];
  products: Product[] = [];
  approvalStats: ApprovalStats | null = null;
  approvalHistory: ApprovalAction[] = [];
  isLoading: boolean = true;
  isSubmitting: boolean = false;
  isRefreshing: boolean = false;
  error: string | null = null;

  // UI
  activeTab: 'pending' | 'history' | 'stats' = 'pending';
  selectedFilter: 'ALL' | 'PENDING' | 'URGENT' | 'HIGH_VALUE' = 'ALL';
  selectedTypeFilter: 'ALL' | MovementType = 'ALL';
  showCommentsModal: boolean = false;
  showChangesModal: boolean = false;
  showConfirmModal: boolean = false;
  selectedAction: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | null = null;
  searchTerm: string = '';

  // Form
  approvalForm: FormGroup;
  commentsForm: FormGroup;
  changesForm: FormGroup;
  searchSubject = new Subject<string>();

  // Private
  private destroy$ = new Subject<void>();
  private Math = Math;

  // Movement-type breakdown list for the Statistics tab — a typed array (rather than a plain
  // string array cast with `as MovementType` inline in the template, which Angular's template
  // parser rejects) so getMovementTypeIcon()/getMovementTypeLabel() can be called directly.
  movementTypeList: MovementType[] = [
    MovementType.PURCHASE,
    MovementType.TRANSFER,
    MovementType.SALE,
    MovementType.RETURN,
    MovementType.ADJUSTMENT
  ];

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private inventoryService: InventoryService,
    private router: Router,
    private route: ActivatedRoute,
    private location: Location,
    private fb: FormBuilder
  ) {
    this.approvalForm = this.buildApprovalForm();
    this.commentsForm = this.buildCommentsForm();
    this.changesForm = this.buildChangesForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    // Get movement ID from route if not provided
    if (!this.movementId) {
      this.route.params.pipe(takeUntil(this.destroy$)).subscribe(params => {
        if (params['movementId']) {
          this.movementId = params['movementId'];
          this.loadData();
        } else {
          this.loadData();
        }
      });
    } else {
      this.loadData();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // FORM BUILDING
  // ============================================================

  private buildApprovalForm(): FormGroup {
    return this.fb.group({
      action: ['', Validators.required],
      comments: ['', [Validators.maxLength(500)]],
      requireChanges: [false]
    });
  }

  private buildCommentsForm(): FormGroup {
    return this.fb.group({
      comments: ['', [Validators.required, Validators.maxLength(500)]],
      notifyRequester: [true],
      attachment: [null]
    });
  }

  private buildChangesForm(): FormGroup {
    return this.fb.group({
      field: ['', Validators.required],
      currentValue: ['', Validators.required],
      suggestedValue: ['', Validators.required],
      reason: ['', [Validators.required, Validators.maxLength(300)]]
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadData(): void {
    this.isLoading = true;
    this.error = null;

    forkJoin({
      movements: this.inventoryService.getMovements({ limit: 200, status: MovementStatus.PENDING }),
      branches: this.inventoryService.getBranches(),
      products: this.inventoryService.getProducts({ limit: 500 })
    }).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: ({ movements, branches, products }) => {
          this.movements = movements.data || [];
          this.branches = branches;
          this.products = products.data || [];
          this.filterMovements();
          this.calculateStats();
          
          // Auto-select movement if ID provided
          if (this.movementId && this.autoSelect) {
            this.selectedMovement = this.movements.find(m => String(m.id) === this.movementId) || null;
          } else if (this.movements.length > 0 && !this.selectedMovement) {
            this.selectedMovement = this.movements[0];
          }
          
          this.loadApprovalHistory();
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Failed to load movements:', err);
          this.error = 'Failed to load movements. Please try again.';
          this.isLoading = false;
        }
      });
  }

  refreshData(): void {
    this.isRefreshing = true;
    this.error = null;
    this.loadData();
    setTimeout(() => {
      this.isRefreshing = false;
    }, 500);
  }

  private loadApprovalHistory(): void {
    // Mock approval history
    this.approvalHistory = [
      {
        movementId: 'mov-1',
        action: 'APPROVE',
        comments: 'Approved - stock transfer confirmed',
        approvedBy: 'usr-2',
        approvedByName: 'Jane Smith',
        timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        movementId: 'mov-2',
        action: 'REJECT',
        comments: 'Insufficient stock at source location',
        approvedBy: 'usr-2',
        approvedByName: 'Jane Smith',
        timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      },
      {
        movementId: 'mov-3',
        action: 'REQUEST_CHANGES',
        comments: 'Please review quantity - seems too high',
        approvedBy: 'usr-2',
        approvedByName: 'Jane Smith',
        timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        changesRequested: [
          {
            field: 'quantity',
            currentValue: 600,
            suggestedValue: 400
          }
        ]
      }
    ];
  }

  // ============================================================
  // FILTERING
  // ============================================================

  filterMovements(): void {
    let filtered = [...this.movements];

    // Filter by status
    if (this.selectedFilter === 'PENDING') {
      filtered = filtered.filter(m => m.status === MovementStatus.PENDING);
    } else if (this.selectedFilter === 'URGENT') {
      filtered = filtered.filter(m => m.notes?.toLowerCase().includes('urgent') || m.cost > 5000000);
    } else if (this.selectedFilter === 'HIGH_VALUE') {
      filtered = filtered.filter(m => m.cost > 10000000);
    }

    // Filter by movement type
    if (this.selectedTypeFilter !== 'ALL') {
      filtered = filtered.filter(m => m.movementType === this.selectedTypeFilter);
    }

    // Filter by search term
    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(m =>
        m.productName?.toLowerCase().includes(term) ||
        m.sku?.toLowerCase().includes(term) ||
        String(m.id ?? '').toLowerCase().includes(term) ||
        m.fromLocation?.name?.toLowerCase().includes(term) ||
        m.toLocation?.name?.toLowerCase().includes(term)
      );
    }

    // Sort by priority (urgent first, then by date)
    filtered.sort((a, b) => {
      const aUrgent = a.notes?.toLowerCase().includes('urgent') || a.cost > 5000000;
      const bUrgent = b.notes?.toLowerCase().includes('urgent') || b.cost > 5000000;
      if (aUrgent && !bUrgent) return -1;
      if (!aUrgent && bUrgent) return 1;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    this.filteredMovements = filtered;
  }

  setFilter(filter: 'ALL' | 'PENDING' | 'URGENT' | 'HIGH_VALUE'): void {
    this.selectedFilter = filter;
    this.filterMovements();
  }

  setTypeFilter(type: 'ALL' | MovementType): void {
    this.selectedTypeFilter = type;
    this.filterMovements();
  }

  onSearch(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target) {
      this.searchTerm = target.value;
      this.filterMovements();
    }
  }

  clearFilters(): void {
    this.searchTerm = '';
    this.selectedFilter = 'ALL';
    this.selectedTypeFilter = 'ALL';
    this.filterMovements();
  }

  // ============================================================
  // STATISTICS
  // ============================================================

  private calculateStats(): void {
    const pending = this.movements.filter(m => m.status === MovementStatus.PENDING);
    const approved = this.movements.filter(m => m.status === MovementStatus.COMPLETED);
    const rejected = this.movements.filter(m => m.status === MovementStatus.CANCELLED);
    const requestedChanges = this.movements.filter(m => m.notes?.toLowerCase().includes('changes requested'));

    // Calculate average approval time (mock)
    const avgApprovalTime = pending.length > 0 ? 4.5 : 0;

    const urgent = pending.filter(m => 
      m.notes?.toLowerCase().includes('urgent') || 
      m.cost > 5000000
    );

    const highValue = pending.filter(m => m.cost > 10000000);

    this.approvalStats = {
      totalPending: pending.length,
      totalApproved: approved.length,
      totalRejected: rejected.length,
      totalRequestedChanges: requestedChanges.length,
      averageApprovalTime: avgApprovalTime,
      urgentCount: urgent.length,
      highValueCount: highValue.length
    };
  }

  // ============================================================
  // SELECTION
  // ============================================================

  selectMovement(movementId: string | number): void {
    this.selectedMovement = this.movements.find(m => String(m.id) === String(movementId)) || null;
    if (this.selectedMovement) {
      // Reset forms
      this.approvalForm.reset();
      this.commentsForm.reset();
      this.changesForm.reset();
      this.selectedAction = null;
      this.showCommentsModal = false;
      this.showChangesModal = false;
      this.showConfirmModal = false;
    }
  }

  // ============================================================
  // APPROVAL ACTIONS
  // ============================================================

  /** While changes are outstanding, Approve/Reject/Request Changes stay hidden — nothing to
   *  approve or reject yet, and asking twice makes no sense. Reappear once it's edited (see
   *  StockMovementFormComponent.save()). */
  hasUnresolvedChangeRequest(movement: StockMovement | null): boolean {
    return hasUnresolvedChangeRequest(movement);
  }

  openActionModal(action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'): void {
    this.selectedAction = action;
    
    if (action === 'APPROVE') {
      this.showConfirmModal = true;
    } else if (action === 'REJECT') {
      this.showCommentsModal = true;
    } else if (action === 'REQUEST_CHANGES') {
      this.showChangesModal = true;
    }
  }

  closeActionModal(): void {
    this.showCommentsModal = false;
    this.showChangesModal = false;
    this.showConfirmModal = false;
    this.selectedAction = null;
    this.commentsForm.reset();
    this.changesForm.reset();
  }

  confirmApproval(): void {
    if (!this.selectedMovement || !this.selectedAction) return;

    this.isSubmitting = true;
    const movementId = String(this.selectedMovement.id);

    const action: ApprovalAction = {
      movementId,
      action: this.selectedAction,
      comments: 'Approved',
      approvedBy: 'usr-1', // Current user ID
      approvedByName: 'John Doe', // Current user name
      timestamp: new Date()
    };

    // Approving moves a transfer to IN_TRANSIT, not straight to COMPLETED — stock only actually
    // moves once the movement is later marked COMPLETED (e.g. when it's confirmed received via
    // Stock Movement's status update), which is where InventoryService.updateMovement() applies
    // the real stock adjustment. This is a real persisted update, not a simulation.
    this.inventoryService.updateMovement(movementId, {
      status: MovementStatus.IN_TRANSIT,
      approvedBy: action.approvedBy,
      approvedByName: action.approvedByName,
      approvedAt: action.timestamp
    }).subscribe({
      next: (updated) => {
        if (this.selectedMovement && String(this.selectedMovement.id) === movementId) {
          this.selectedMovement = updated;
        }
        const idx = this.movements.findIndex(m => String(m.id) === movementId);
        if (idx > -1) this.movements[idx] = updated;

        this.calculateStats();
        this.filterMovements();
        this.approvalHistory.unshift(action);
        this.approvalComplete.emit(action);

        this.isSubmitting = false;
        this.showConfirmModal = false;
        this.selectedAction = null;
      },
      error: (err) => {
        console.error('Failed to approve movement:', err);
        this.error = 'Failed to approve movement. Please try again.';
        this.isSubmitting = false;
      }
    });
  }

  submitComments(): void {
    if (this.commentsForm.invalid || !this.selectedMovement || this.selectedAction !== 'REJECT') {
      return;
    }

    this.isSubmitting = true;
    const movementId = String(this.selectedMovement.id);
    const comments = this.commentsForm.get('comments')?.value || '';

    const action: ApprovalAction = {
      movementId,
      action: 'REJECT',
      comments,
      approvedBy: 'usr-1',
      approvedByName: 'John Doe',
      timestamp: new Date()
    };

    this.inventoryService.updateMovement(movementId, {
      status: MovementStatus.CANCELLED,
      notes: (this.selectedMovement.notes || '') + `\nRejection reason: ${comments}`
    }).subscribe({
      next: (updated) => {
        if (this.selectedMovement && String(this.selectedMovement.id) === movementId) {
          this.selectedMovement = updated;
        }
        const idx = this.movements.findIndex(m => String(m.id) === movementId);
        if (idx > -1) this.movements[idx] = updated;

        this.calculateStats();
        this.filterMovements();
        this.approvalHistory.unshift(action);
        this.approvalComplete.emit(action);

        this.isSubmitting = false;
        this.showCommentsModal = false;
        this.selectedAction = null;
        this.commentsForm.reset();
      },
      error: (err) => {
        console.error('Failed to reject movement:', err);
        this.error = 'Failed to reject movement. Please try again.';
        this.isSubmitting = false;
      }
    });
  }

  submitChanges(): void {
    if (this.changesForm.invalid || !this.selectedMovement || this.selectedAction !== 'REQUEST_CHANGES') {
      return;
    }

    this.isSubmitting = true;
    const movementId = String(this.selectedMovement.id);

    const changesRequested = [{
      field: this.changesForm.get('field')?.value || '',
      currentValue: this.changesForm.get('currentValue')?.value || '',
      suggestedValue: this.changesForm.get('suggestedValue')?.value || ''
    }];

    const comments = this.changesForm.get('reason')?.value || '';
    const action: ApprovalAction = {
      movementId,
      action: 'REQUEST_CHANGES',
      comments,
      approvedBy: 'usr-1',
      approvedByName: 'John Doe',
      timestamp: new Date(),
      changesRequested: changesRequested
    };

    // Status stays PENDING — requesting changes doesn't approve or reject, just leaves a note.
    this.inventoryService.updateMovement(movementId, {
      notes: (this.selectedMovement.notes || '') + `\nChanges requested: ${comments}`
    }).subscribe({
      next: (updated) => {
        if (this.selectedMovement && String(this.selectedMovement.id) === movementId) {
          this.selectedMovement = updated;
        }
        const idx = this.movements.findIndex(m => String(m.id) === movementId);
        if (idx > -1) this.movements[idx] = updated;

        this.calculateStats();
        this.filterMovements();
        this.approvalHistory.unshift(action);
        this.approvalComplete.emit(action);

        this.isSubmitting = false;
        this.showChangesModal = false;
        this.selectedAction = null;
        this.changesForm.reset();
      },
      error: (err) => {
        console.error('Failed to request changes:', err);
        this.error = 'Failed to request changes. Please try again.';
        this.isSubmitting = false;
      }
    });
  }

  // ============================================================
  // BULK ACTIONS
  // ============================================================

  approveAll(): void {
    const pending = this.filteredMovements.filter(m => m.status === MovementStatus.PENDING);
    if (pending.length === 0) return;

    const confirmed = window.confirm(`Are you sure you want to approve all ${pending.length} pending movements?`);
    if (!confirmed) return;

    this.isSubmitting = true;

    // updateMovement() is a localStorage-backed mock that resolves synchronously, so this plain
    // loop completes in one tick — no forkJoin needed.
    pending.forEach(m => {
      const approvedAt = new Date();
      this.inventoryService.updateMovement(m.id, {
        status: MovementStatus.IN_TRANSIT,
        approvedBy: 'usr-1',
        approvedByName: 'John Doe',
        approvedAt
      }).subscribe({
        next: (updated) => {
          const idx = this.movements.findIndex(mv => mv.id === m.id);
          if (idx > -1) this.movements[idx] = updated;
          this.approvalHistory.unshift({
            movementId: String(m.id),
            action: 'APPROVE',
            comments: 'Bulk approved',
            approvedBy: 'usr-1',
            approvedByName: 'John Doe',
            timestamp: approvedAt
          });
        },
        error: (err) => console.error(`Failed to approve movement ${m.id}:`, err)
      });
    });

    this.calculateStats();
    this.filterMovements();
    this.isSubmitting = false;
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

  viewMovementDetail(movementId: string): void {
    this.router.navigate(['/admin/sales/commerce/inventory/movements', movementId]);
  }

  viewBranch(branchId: string): void {
    if (branchId) {
      this.router.navigate(['/admin/sales/commerce/inventory/branches', branchId]);
    }
  }

  viewProduct(productId: string): void {
    if (productId) {
      this.router.navigate(['/admin/sales/commerce/inventory/products', productId]);
    }
  }

  // ============================================================
  // EXPORT
  // ============================================================

  exportReport(): void {
    console.log('Exporting approval report...');
    // In real implementation, generate report
  }

  // ============================================================
  // UI HELPERS
  // ============================================================

  getMovementTypeLabel(type: MovementType): string {
    return getMovementTypeLabel(type);
  }

  getMovementTypeIcon(type: MovementType): string {
    return getMovementTypeIcon(type);
  }

  getMovementStatusLabel(status: MovementStatus): string {
    return getMovementStatusLabel(status);
  }

  getStatusColor(status: MovementStatus): string {
    const map: Record<string, string> = {
      'PENDING': '#F5A623',
      'IN_TRANSIT': '#3B82F6',
      'COMPLETED': '#2EB270',
      'CANCELLED': '#DC2626'
    };
    return map[status] || '#6B7280';
  }

  getStatusIcon(status: MovementStatus): string {
    const map: Record<string, string> = {
      'PENDING': 'fa-clock',
      'IN_TRANSIT': 'fa-truck',
      'COMPLETED': 'fa-check-circle',
      'CANCELLED': 'fa-times-circle'
    };
    return map[status] || 'fa-circle';
  }

  getPriorityLabel(movement: StockMovement): string {
    if (movement.notes?.toLowerCase().includes('critical')) return 'Critical';
    if (movement.notes?.toLowerCase().includes('urgent')) return 'Urgent';
    if (movement.cost > 10000000) return 'High Value';
    if (movement.cost > 5000000) return 'Medium Value';
    return 'Normal';
  }

  getPriorityColor(movement: StockMovement): string {
    const label = this.getPriorityLabel(movement);
    const map: Record<string, string> = {
      'Critical': '#DC2626',
      'Urgent': '#F59E0B',
      'High Value': '#8B5CF6',
      'Medium Value': '#3B82F6',
      'Normal': '#6B7280'
    };
    return map[label] || '#6B7280';
  }

  getPriorityIcon(movement: StockMovement): string {
    const label = this.getPriorityLabel(movement);
    const map: Record<string, string> = {
      'Critical': 'fa-exclamation-circle',
      'Urgent': 'fa-exclamation-triangle',
      'High Value': 'fa-crown',
      'Medium Value': 'fa-star',
      'Normal': 'fa-circle'
    };
    return map[label] || 'fa-circle';
  }

  getActionColor(action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'): string {
    const map: Record<string, string> = {
      'APPROVE': '#2EB270',
      'REJECT': '#DC2626',
      'REQUEST_CHANGES': '#F5A623'
    };
    return map[action] || '#6B7280';
  }

  getActionIcon(action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'): string {
    const map: Record<string, string> = {
      'APPROVE': 'fa-check-circle',
      'REJECT': 'fa-times-circle',
      'REQUEST_CHANGES': 'fa-edit'
    };
    return map[action] || 'fa-circle';
  }

  getActionLabel(action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'): string {
    const map: Record<string, string> = {
      'APPROVE': 'Approved',
      'REJECT': 'Rejected',
      'REQUEST_CHANGES': 'Changes Requested'
    };
    return map[action] || action;
  }

  getBranchName(branchId: string): string {
    const branch = this.branches.find(b => String(b.id) === branchId);
    return branch?.name || branchId;
  }

  getProductName(productId: string): string {
    const product = this.products.find(p => String(p.id) === productId);
    return product?.name || productId;
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

  formatDate(date: Date | string): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date | string): string {
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

  getTimeAgo(date: Date | string): string {
    if (!date) return '—';
    const diff = Date.now() - new Date(date).getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 4) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    return `${Math.floor(months / 12)}y ago`;
  }

  isUrgent(movement: StockMovement): boolean {
    return movement.notes?.toLowerCase().includes('urgent') || 
           movement.notes?.toLowerCase().includes('critical') ||
           movement.cost > 10000000;
  }

  isHighValue(movement: StockMovement): boolean {
    return movement.cost > 10000000;
  }

  getMovementCount(): number {
    return this.filteredMovements.length;
  }

  getPendingCount(): number {
    return this.movements.filter(m => m.status === MovementStatus.PENDING).length;
  }

  getCompletedCount(): number {
    return this.movements.filter(m => m.status === MovementStatus.COMPLETED).length;
  }

  getCancelledCount(): number {
    return this.movements.filter(m => m.status === MovementStatus.CANCELLED).length;
  }

  getTypeCount(type: MovementType): number {
    return this.movements.filter(m => m.movementType === type).length;
  }
}