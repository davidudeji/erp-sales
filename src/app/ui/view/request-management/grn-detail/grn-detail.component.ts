// grn-detail.component.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { MessageService } from 'primeng/api';
import { SupplyChainService } from '../../../service/procurement/supply-chain.service';
import {
  GoodsReceivedNote,
  GrnStatus,
  GrnLineItem,
  getGrnStatusLabel,
  getGrnStatusSeverity
} from '../../../domain/procurement-request/procurement.dto';

@Component({
  selector: 'app-grn-detail',
  templateUrl: './grn-detail.component.html',
  styleUrls: ['./grn-detail.component.scss']
})
export class GrnDetailComponent implements OnInit, OnDestroy {

  grn: GoodsReceivedNote | null = null;
  isLoading = true;
  notFound = false;

  isUpdatingStatus = false;
  showDeleteModal = false;
  isDeleting = false;
  showApproveForm = false;
  approverName = '';

  getGrnStatusLabel = getGrnStatusLabel;
  getGrnStatusSeverity = getGrnStatusSeverity;

  private destroy$ = new Subject<void>();
  private grnId!: number;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private supplyChainService: SupplyChainService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    this.grnId = Number(idParam);
    if (!idParam || isNaN(this.grnId)) {
      this.isLoading = false;
      this.notFound = true;
      return;
    }
    this.loadGrn();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadGrn(): void {
    this.isLoading = true;
    this.notFound = false;
    this.supplyChainService.getGrnById(this.grnId).pipe(takeUntil(this.destroy$)).subscribe({
      next: (grn) => {
        this.grn = grn;
        this.notFound = !grn;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
        this.notFound = true;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/admin/sales/commerce/goods-received-notes']);
  }

  // ============================================================
  // STATUS TRANSITIONS
  // ============================================================

  canSubmit(): boolean {
    return this.grn?.status === 'DRAFT';
  }

  canApprove(): boolean {
    return this.grn?.status === 'SUBMITTED';
  }

  canDispute(): boolean {
    return this.grn?.status === 'SUBMITTED';
  }

  canCancel(): boolean {
    return !!this.grn && this.grn.status !== 'CANCELLED' && this.grn.status !== 'APPROVED';
  }

  submitForApproval(): void {
    if (!this.grn) return;
    this.isUpdatingStatus = true;
    this.supplyChainService.submitGrn(this.grn.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.grn = updated;
        this.isUpdatingStatus = false;
        this.messageService.add({ severity: 'success', summary: 'Submitted', detail: 'GRN submitted for approval.' });
      },
      error: () => {
        this.isUpdatingStatus = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to submit GRN. Please try again.' });
      }
    });
  }

  openApproveForm(): void {
    this.showApproveForm = true;
  }

  cancelApproveForm(): void {
    this.showApproveForm = false;
    this.approverName = '';
  }

  confirmApprove(): void {
    if (!this.grn) return;
    const approvedBy = this.approverName.trim();
    if (!approvedBy) {
      this.messageService.add({ severity: 'warn', summary: 'Approver required', detail: 'Enter your name before approving.' });
      return;
    }
    this.showApproveForm = false;
    this.runStatusChange('APPROVED', { approvedBy }, 'GRN approved.');
  }

  dispute(): void {
    if (!this.grn) return;
    if (!confirm('Mark this GRN as disputed? Use this when the delivery has a discrepancy that needs resolving before payment.')) return;
    this.runStatusChange('DISPUTED', {}, 'GRN marked as disputed.');
  }

  cancelGrn(): void {
    if (!this.grn) return;
    if (!confirm('Cancel this GRN? This cannot be undone.')) return;
    this.runStatusChange('CANCELLED', {}, 'GRN cancelled.');
  }

  private runStatusChange(status: GrnStatus, extra: Record<string, any>, successMessage: string): void {
    if (!this.grn) return;
    this.isUpdatingStatus = true;
    this.supplyChainService.updateGrnStatus(this.grn.id, status, extra).pipe(takeUntil(this.destroy$)).subscribe({
      next: (updated) => {
        this.grn = updated;
        this.isUpdatingStatus = false;
        this.messageService.add({ severity: 'success', summary: 'Updated', detail: successMessage });
      },
      error: () => {
        this.isUpdatingStatus = false;
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to update GRN status. Please try again.' });
      }
    });
  }

  // ============================================================
  // DELETE
  // ============================================================

  confirmDelete(): void {
    if (!this.grn) return;
    this.isDeleting = true;
    this.supplyChainService.deleteGrn(this.grn.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: (success) => {
        this.isDeleting = false;
        this.showDeleteModal = false;
        if (success) {
          this.messageService.add({ severity: 'success', summary: 'Deleted', detail: 'GRN deleted.' });
          this.goBack();
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

  // ============================================================
  // HELPERS
  // ============================================================

  getLineTotal(item: GrnLineItem): number {
    return (item.acceptedQuantity || 0) * (item.unitPrice || 0);
  }

  getConditionClass(condition: string): string {
    const map: Record<string, string> = {
      GOOD: 'good',
      DAMAGED: 'damaged',
      WRONG_ITEM: 'wrong',
      SHORT_SUPPLY: 'short',
      EXCESS_SUPPLY: 'excess'
    };
    return map[condition] || 'good';
  }

  getConditionLabel(condition: string): string {
    return (condition || '').replace(/_/g, ' ');
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount || 0);
  }

  formatDate(date?: Date | string): string {
    if (!date) return '—';
    const d = new Date(date);
    return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  formatDateTime(date?: Date | string): string {
    if (!date) return '—';
    const d = new Date(date);
    return isNaN(d.getTime())
      ? '—'
      : d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
}
