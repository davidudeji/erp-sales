import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { ApprovalService } from '../../../service/approval-inbox/approval.service';
import { WorkflowInstance, WorkflowStage, WorkflowAction } from '../../../domain/approval-inbox/approval-request.dto';
import { ProcurementRequest } from '../../../domain/procurement-request/procurement.dto';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-approval-inbox',
  templateUrl: './approval-inbox.component.html',
  styleUrls: ['./approval-inbox.component.scss']
})
export class ApprovalInboxComponent implements OnInit, OnDestroy {

  requests: ProcurementRequest[] = [];
  filtered: ProcurementRequest[] = [];
  selected: ProcurementRequest | null = null;
  workflowInstance: WorkflowInstance | null = null;

  isLoading = false;
  isLoadingInstance = false;
  isActioning = false;

  searchTerm = '';
  filterType: 'ALL' | 'PRODUCT' | 'SERVICE' = 'ALL';

  showApproveModal = false;
  showRejectModal = false;
  approveComment = '';
  rejectReason = '';

  private destroy$ = new Subject<void>();

  get pendingCount(): number { return this.requests.length; }

  constructor(
    private approvalService: ApprovalService,
    private messageService: MessageService
  ) {}

  ngOnInit(): void { this.load(); }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.isLoading = true;
    this.approvalService.getPendingProcurementRequests(0, 100)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.requests = res.data;
          this.applyFilters();
          this.isLoading = false;
          if (this.selected) {
            const refreshed = this.requests.find(r => r.id === this.selected!.id);
            if (refreshed) this.select(refreshed);
          }
        },
        error: () => { this.isLoading = false; }
      });
  }

  applyFilters(): void {
    let list = [...this.requests];
    if (this.filterType !== 'ALL') {
      list = list.filter(r => r.procurementType === this.filterType);
    }
    if (this.searchTerm.trim()) {
      const q = this.searchTerm.toLowerCase();
      list = list.filter(r =>
        r.title?.toLowerCase().includes(q) ||
        String(r.id).includes(q)
      );
    }
    this.filtered = list;
  }

  select(req: ProcurementRequest): void {
    this.selected = req;
    this.workflowInstance = null;
    const instanceId = req.approvalInstanceId;
    this.isLoadingInstance = true;
    if (instanceId) {
      this.approvalService.getWorkflowInstance(Number(instanceId))
        .pipe(takeUntil(this.destroy$))
        .subscribe({
          next: (inst) => { this.workflowInstance = inst; this.isLoadingInstance = false; },
          error: () => this.lookupByReference(req)
        });
    } else {
      this.lookupByReference(req);
    }
  }

  private lookupByReference(req: ProcurementRequest): void {
    this.approvalService.lookupWorkflowInstance('PROCUREMENT_REQUEST', String(req.id))
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (inst) => { this.workflowInstance = inst; this.isLoadingInstance = false; },
        error: () => this.retriggerThenFetch(req)
      });
  }

  private retriggerThenFetch(req: ProcurementRequest): void {
    this.approvalService.retriggerApproval(req.id)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated: any) => {
          const instanceId = updated?.approvalInstanceId;
          if (instanceId) {
            this.approvalService.getWorkflowInstance(Number(instanceId))
              .pipe(takeUntil(this.destroy$))
              .subscribe({
                next: (inst) => { this.workflowInstance = inst; this.isLoadingInstance = false; },
                error: () => { this.isLoadingInstance = false; }
              });
          } else {
            this.isLoadingInstance = false;
            this.messageService.add({
              severity: 'warn',
              summary: 'Approval Workflow Not Configured',
              detail: 'No approval workflow is configured for Procurement. Go to Settings → Approval Workflows and enable the Commerce Procurement workflow.'
            });
          }
        },
        error: () => { this.isLoadingInstance = false; }
      });
  }

  openApprove(): void { this.approveComment = ''; this.showApproveModal = true; }
  openReject(): void  { this.rejectReason = '';   this.showRejectModal = true; }

  confirmApprove(): void {
    if (!this.selected || !this.workflowInstance) return;
    this.isActioning = true;

    const userId = this.getCurrentUserId();
    const { roleCode, roleId } = this.getCurrentRole();

    const payload = new FormData();
    payload.append('actorUserId', String(userId));
    if (roleCode) payload.append('actorRoleCode', roleCode);
    if (roleId)   payload.append('actorRoleId', String(roleId));
    payload.append('comment', this.approveComment.trim());

    this.approvalService.approveWorkflowInstance(this.workflowInstance.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showApproveModal = false;
          this.isActioning = false;
          this.messageService.add({
            severity: 'success',
            summary: 'Stage Approved',
            detail: `"${this.selected?.title}" approval stage has been approved.`
          });
          this.load();
        },
        error: (err: any) => {
          const detail = err?.error?.message || err?.error?.detail || 'Could not approve. Please try again.';
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
          this.isActioning = false;
        }
      });
  }

  confirmReject(): void {
    if (!this.selected || !this.workflowInstance || !this.rejectReason.trim()) return;
    this.isActioning = true;

    const userId = this.getCurrentUserId();
    const { roleCode, roleId } = this.getCurrentRole();

    const payload: any = {
      actorUserId: userId,
      actorRoleCode: roleCode,
      comment: this.rejectReason.trim()
    };
    if (roleId) payload.actorRoleId = roleId;

    this.approvalService.rejectWorkflowInstance(this.workflowInstance.id, payload)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.showRejectModal = false;
          this.selected = null;
          this.workflowInstance = null;
          this.isActioning = false;
          this.messageService.add({
            severity: 'warn',
            summary: 'Rejected',
            detail: 'The procurement request has been rejected.'
          });
          this.load();
        },
        error: (err: any) => {
          const detail = err?.error?.message || err?.error?.detail || 'Could not reject. Please try again.';
          this.messageService.add({ severity: 'error', summary: 'Error', detail });
          this.isActioning = false;
        }
      });
  }

  // ── Workflow instance helpers ───────────────────────────

  get wfStages(): WorkflowStage[] {
    return this.workflowInstance?.approval?.stages ?? [];
  }

  get wfActions(): WorkflowAction[] {
    return this.workflowInstance?.actions ?? [];
  }

  get currentStageOrder(): number | null {
    return this.workflowInstance?.currentStage?.orderIndex ?? null;
  }

  getStageStatus(stage: WorkflowStage): 'done' | 'active' | 'waiting' {
    const actions = this.wfActions;
    const approved = actions.some(a => a.action === 'APPROVED' && a.stageOrderIndex === stage.orderIndex);
    const rejected = actions.some(a => a.action === 'REJECTED' && a.stageOrderIndex === stage.orderIndex);
    if (approved || rejected) return 'done';
    if (stage.orderIndex === this.currentStageOrder) return 'active';
    return 'waiting';
  }

  getStageActionStatus(stage: WorkflowStage): string {
    const actions = this.wfActions;
    const approved = actions.some(a => a.action === 'APPROVED' && a.stageOrderIndex === stage.orderIndex);
    const rejected = actions.some(a => a.action === 'REJECTED' && a.stageOrderIndex === stage.orderIndex);
    if (rejected) return 'REJECTED';
    if (approved) return 'APPROVED';
    if (stage.orderIndex === this.currentStageOrder) return 'AWAITING';
    return 'PENDING';
  }

  getStageActionAt(stage: WorkflowStage): string {
    const action = this.wfActions
      .filter(a => a.stageOrderIndex === stage.orderIndex && (a.action === 'APPROVED' || a.action === 'REJECTED'))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return action ? this.formatDate(action.createdAt) : '';
  }

  getStageComment(stage: WorkflowStage): string {
    const action = this.wfActions
      .filter(a => a.stageOrderIndex === stage.orderIndex)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
    return action?.comment || '';
  }

  progressPct(): number {
    const stages = this.wfStages;
    if (!stages.length) return 0;
    const done = stages.filter(s => this.getStageStatus(s) === 'done').length;
    return Math.round((done / stages.length) * 100);
  }

  // ── Formatters ─────────────────────────────────────────

  formatBudget(req: ProcurementRequest): string {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: req.currency || 'NGN', maximumFractionDigits: 0
    }).format((req as any).totalBudget || 0);
  }

  formatDate(d: any): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  urgencyClass(req: ProcurementRequest): { [key: string]: boolean } {
    return { 'urgency-normal': true };
  }

  // ── Session helpers ─────────────────────────────────────

  private getCurrentUserId(): number {
    return Number(sessionStorage.getItem('userId') || sessionStorage.getItem('id') || 0);
  }

  private getCurrentRole(): { roleCode: string | null; roleId: number | null } {
    let roleCode: string | null = sessionStorage.getItem('role') || null;
    let roleId: number | null = null;
    const raw = sessionStorage.getItem('userApplicationRole');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        roleCode = parsed?.appRole?.code || parsed?.appRole?.roleCode || parsed?.appRole?.name || roleCode;
        const rid = Number(parsed?.appRole?.id ?? parsed?.appRole?.roleId ?? 0);
        roleId = Number.isFinite(rid) && rid > 0 ? rid : null;
      } catch { /* ignore */ }
    }
    return { roleCode, roleId };
  }
}
