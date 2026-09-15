import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import { ApprovalService } from '../../../service/approval-inbox/approval.service';
import { WorkflowInstance } from '../../../domain/approval-inbox/approval-request.dto';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { ProcurementRequest } from '../../../domain/procurement-request/procurement.dto';
import { ExtendedProcurementRequest, parseIdToNumber } from '../../../service/procurement/rfq-quotation-bridge.util';

@Component({
  selector: 'app-approval-rfq-detail',
  templateUrl: './approval-rfq-detail.component.html',
  styleUrls: ['./approval-rfq-detail.component.scss']
})
export class ApprovalRfqDetailComponent implements OnInit, OnDestroy {
  requestId: string | null = null;
  procurementRequest: ExtendedProcurementRequest | null = null;
  workflowInstance: WorkflowInstance | null = null;
  isLoading = true;
  isActioning = false;
  showApproveModal = false;
  showRejectModal = false;
  commentsText = '';

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private approvalService: ApprovalService,
    private procurementService: ProcurementRequestService
  ) {}

  ngOnInit(): void {
    this.requestId = this.route.snapshot.paramMap.get('id');
    if (this.requestId) {
      this.loadDetails(this.requestId);
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadDetails(id: string): void {
    this.isLoading = true;
    this.procurementService.getRequest(parseIdToNumber(id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (req) => {
          this.procurementRequest = req as ExtendedProcurementRequest;
          this.isLoading = false;
          const instanceId = (req as any).approvalInstanceId;
          if (instanceId) {
            this.approvalService.getWorkflowInstance(Number(instanceId))
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (inst) => { this.workflowInstance = inst; },
                error: () => {}
              });
          }
        },
        error: () => { this.isLoading = false; }
      });
  }

  forwardToVendor(): void {
    this.showApproveModal = true;
    this.commentsText = '';
  }

  rejectRequest(): void {
    this.showRejectModal = true;
    this.commentsText = '';
  }

  confirmApprove(): void {
    if (!this.workflowInstance) return;
    this.isActioning = true;
    const userId = Number(sessionStorage.getItem('userId') || 0);
    const roleCode = sessionStorage.getItem('role');
    const payload = new FormData();
    payload.append('actorUserId', String(userId));
    if (roleCode) payload.append('actorRoleCode', roleCode);
    payload.append('comment', this.commentsText.trim());

    this.approvalService.approveWorkflowInstance(this.workflowInstance.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showApproveModal = false;
          this.isActioning = false;
          if (this.requestId) this.loadDetails(this.requestId);
        },
        error: () => { this.isActioning = false; }
      });
  }

  confirmReject(): void {
    if (!this.workflowInstance || !this.commentsText.trim()) return;
    this.isActioning = true;
    const userId = Number(sessionStorage.getItem('userId') || 0);
    const roleCode = sessionStorage.getItem('role');
    const payload: any = { actorUserId: userId, actorRoleCode: roleCode, comment: this.commentsText.trim() };

    this.approvalService.rejectWorkflowInstance(this.workflowInstance.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showRejectModal = false;
          this.isActioning = false;
          this.router.navigate(['/admin/sales/commerce/requests']);
        },
        error: () => { this.isActioning = false; }
      });
  }

  goBack(): void {
    this.router.navigate(['/admin/sales/commerce/requests']);
  }

  formatDate(date: any): string {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString();
  }

  formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'NGN' }).format(amount || 0);
  }

  getApprovalProgress(): number {
    const stages = this.workflowInstance?.approval?.stages ?? [];
    const actions = this.workflowInstance?.actions ?? [];
    if (!stages.length) return 0;
    const done = stages.filter(s =>
      actions.some(a => a.action === 'APPROVED' && a.stageOrderIndex === s.orderIndex)
    ).length;
    return Math.round((done / stages.length) * 100);
  }
}
