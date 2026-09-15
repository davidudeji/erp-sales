// grn-list.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MessageService } from 'primeng/api';
import { SupplyChainService } from '../../../service/procurement/supply-chain.service';
import {
  GoodsReceivedNote,
  GrnStatus,
  getGrnStatusLabel,
  getGrnStatusSeverity
} from '../../../domain/procurement-request/procurement.dto';

@Component({
  selector: 'app-grn-list',
  templateUrl: './grn-list.component.html',
  styleUrls: ['./grn-list.component.scss']
})
export class GrnListComponent implements OnInit, OnDestroy {

  grns: GoodsReceivedNote[] = [];
  filteredGrns: GoodsReceivedNote[] = [];
  isLoading = true;

  searchTerm = '';
  selectedStatus: GrnStatus | 'ALL' = 'ALL';

  currentPage = 1;
  pageSize = 10;
  totalPages = 1;
  totalFiltered = 0;

  showDeleteModal = false;
  pendingDeleteGrn: GoodsReceivedNote | null = null;
  isDeleting = false;

  readonly statusOptions: { value: GrnStatus | 'ALL'; label: string }[] = [
    { value: 'ALL', label: 'All Statuses' },
    { value: 'DRAFT', label: 'Draft' },
    { value: 'SUBMITTED', label: 'Submitted' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'DISPUTED', label: 'Disputed' },
    { value: 'CANCELLED', label: 'Cancelled' }
  ];

  getGrnStatusLabel = getGrnStatusLabel;
  getGrnStatusSeverity = getGrnStatusSeverity;

  private destroy$ = new Subject<void>();

  constructor(
    private supplyChainService: SupplyChainService,
    private router: Router,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    this.loadGrns();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadGrns(): void {
    this.isLoading = true;
    this.supplyChainService.getGrns().pipe(takeUntil(this.destroy$)).subscribe({
      next: (grns) => {
        this.grns = grns;
        this.applyFilters();
        this.isLoading = false;
      },
      error: (err) => {
        console.error('[GrnListComponent] Failed to load GRNs:', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to load goods received notes.' });
        this.isLoading = false;
      }
    });
  }

  applyFilters(): void {
    let result = [...this.grns];

    if (this.selectedStatus !== 'ALL') {
      result = result.filter(g => g.status === this.selectedStatus);
    }

    if (this.searchTerm.trim()) {
      const term = this.searchTerm.toLowerCase().trim();
      result = result.filter(g =>
        (g.grnNumber || '').toLowerCase().includes(term) ||
        (g.lpoNumber || '').toLowerCase().includes(term) ||
        (g.vendorName || '').toLowerCase().includes(term)
      );
    }

    this.totalFiltered = result.length;
    this.totalPages = Math.ceil(result.length / this.pageSize) || 1;
    if (this.currentPage > this.totalPages) {
      this.currentPage = 1;
    }

    const start = (this.currentPage - 1) * this.pageSize;
    this.filteredGrns = result.slice(start, start + this.pageSize);
  }

  onSearchChange(): void {
    this.currentPage = 1;
    this.applyFilters();
  }

  onStatusFilterChange(status: GrnStatus | 'ALL'): void {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.applyFilters();
  }

  resetFilters(): void {
    this.searchTerm = '';
    this.selectedStatus = 'ALL';
    this.currentPage = 1;
    this.applyFilters();
  }

  goToPage(page: number): void {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.applyFilters();
    }
  }

  getPageNumbers(): number[] {
    const maxVisible = 5;
    let start = Math.max(1, this.currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    return Array.from({ length: end - start + 1 }, (_, i) => start + i);
  }

  getStatusCount(status: GrnStatus): number {
    return this.grns.filter(g => g.status === status).length;
  }

  viewGrn(grn: GoodsReceivedNote): void {
    this.router.navigate(['/admin/sales/commerce/goods-received-notes', grn.id]);
  }

  deleteGrn(grn: GoodsReceivedNote, event?: Event): void {
    if (event) event.stopPropagation();
    this.pendingDeleteGrn = grn;
    this.showDeleteModal = true;
  }

  cancelDelete(): void {
    this.showDeleteModal = false;
    this.pendingDeleteGrn = null;
  }

  confirmDelete(): void {
    if (!this.pendingDeleteGrn) return;
    const grn = this.pendingDeleteGrn;
    this.isDeleting = true;

    this.supplyChainService.deleteGrn(grn.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (success) => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.pendingDeleteGrn = null;
        if (success) {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: `GRN ${grn.grnNumber} deleted.` });
          this.loadGrns();
        } else {
          this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete GRN. Please try again.' });
        }
      },
      error: () => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to delete GRN. Please try again.' });
      }
    });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount || 0);
  }

  formatDate(date?: Date | string): string {
    if (!date) return '—';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
