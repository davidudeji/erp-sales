export type CorrectionStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type IssueType = 'MISSED_CLOCK' | 'WRONG_TIME' | 'OTHER';

export interface CorrectionRequest {
  id: string;
  employeeId: string;
  employeeName?: string;
  department: string;
  date: string; // ISO date
  issueType: IssueType;
  description?: string;
  status: CorrectionStatus;
  rejectionReason?: string;
  createdAt: string;
}
