export interface ApprovalRequest {
  id: string;
  requestId: string;
  requestType: 'PROCUREMENT' | 'SERVICE' | 'ORDER';
  requestTitle: string;
  requesterId: string;
  requesterName: string;
  requesterDepartment: string;
  createdAt: Date;
  submittedAt: Date;
  budget: number;
  currency: string;
  items?: ApprovalItem[];
  currentLevel: number;
  status: ApprovalStatus;
  approvals: ApprovalLevel[];
  urgency: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  reason?: string;
  comments?: ApprovalComment[];
}

export interface ApprovalItem {
  id: string;
  productName: string;
  quantity: number;
  budget: number;
  currency?: string;
}

export interface ApprovalLevel {
  level: number;
  approverId: string;
  approverName: string;
  approverRole: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'SKIPPED';
  actionAt?: Date;
  comments?: string;
  required: boolean;
}

export interface ApprovalComment {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  comment: string;
  createdAt: Date;
  isInternal: boolean;
}

export type ApprovalStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'IN_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'CANCELLED'
  | 'EXPIRED';

export interface ApprovalStats {
  pendingCount: number;
  approvedToday: number;
  rejectedThisWeek: number;
  averageApprovalTime: string;
  urgentPending: number;
}

export interface ApprovalFilters {
  status?: ApprovalStatus | 'ALL';
  urgency?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'ALL';
  department?: string;
  dateFrom?: Date;
  dateTo?: Date;
  searchTerm?: string;
  page: number;
  size: number;
}

// ── Workflow Instance types (mirrors OptimaXWorkflowServices ApprovalInstanceFullDTO) ──

export interface WorkflowStage {
  id: number;
  orderIndex: number;
  name: string;
  description?: string;
  approvalType: 'ANY' | 'ALL' | 'QUORUM';
  quorumCount?: number;
  roles?: WorkflowStageRole[];
}

export interface WorkflowStageRole {
  id: number;
  roleCode: string;
  roleName?: string;
}

export interface WorkflowAction {
  id: number;
  actorUserId: number;
  actorRoleCode?: string;
  actorName?: string;
  action: 'APPROVED' | 'REJECTED' | 'COMMENTED';
  comment?: string;
  stageOrderIndex?: number;
  createdAt: string;
}

export interface WorkflowInstance {
  id: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
  referenceId: string;
  referenceType: string;
  approval?: {
    stages: WorkflowStage[];
  };
  currentStage?: WorkflowStage;
  actions?: WorkflowAction[];
  createdAt?: string;
  updatedAt?: string;
}
