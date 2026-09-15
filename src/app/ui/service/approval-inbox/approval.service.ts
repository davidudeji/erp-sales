import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
import {
  ApprovalStats,
  WorkflowInstance
} from '../../domain/approval-inbox/approval-request.dto';
import { ProcurementRequest } from '../../domain/procurement-request/procurement.dto';
import { environment } from '../../shared-component/service/environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {

  private readonly baseUrl = environment.apiBaseUrl;
  private readonly commerceUrl = this.baseUrl + '/x/api/v2/commerce';
  private readonly workflowUrl = this.baseUrl + '/x/api/v2/workflow';

  constructor(private http: HttpClient) {}

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  getPendingProcurementRequests(page = 0, size = 100): Observable<{ data: ProcurementRequest[]; totalElements: number }> {
    const params = new HttpParams()
      .set('page', String(page + 1))
      .set('size', String(size))
      .set('status', 'PENDING_APPROVAL');

    return this.http.get<any>(`${this.commerceUrl}/procurement-requests/`, { params }).pipe(
      map(res => {
        const arr: ProcurementRequest[] = Array.isArray(res) ? res : (res?.data ?? res?.content ?? []);
        return {
          data: arr,
          totalElements: res?.totalSize ?? res?.totalElements ?? arr.length
        };
      })
    );
  }

  getWorkflowInstance(instanceId: number): Observable<WorkflowInstance> {
    return this.http.get<WorkflowInstance>(`${this.workflowUrl}/approvalInstances/${instanceId}`);
  }

  lookupWorkflowInstance(referenceType: string, referenceId: string): Observable<WorkflowInstance> {
    const params = new HttpParams()
      .set('referenceType', referenceType)
      .set('referenceId', referenceId);
    return this.http.get<WorkflowInstance>(`${this.workflowUrl}/approvalInstances/find-by-reference`, { params });
  }

  retriggerApproval(id: number): Observable<any> {
    return this.http.patch<any>(`${this.commerceUrl}/procurement-requests/${id}/submit-for-approval`, {});
  }

  approveWorkflowInstance(instanceId: number, payload: FormData): Observable<any> {
    return this.http.post(`${this.workflowUrl}/approvalInstances/${instanceId}/approve`, payload);
  }

  rejectWorkflowInstance(instanceId: number, payload: any): Observable<any> {
    return this.http.post(`${this.workflowUrl}/approvalInstances/${instanceId}/reject`, payload);
  }

  getApprovalStats(): Observable<ApprovalStats> {
    return this.http.get<any>(`${this.commerceUrl}/procurement-requests/`, {
      params: new HttpParams().set('page', '1').set('size', '1').set('status', 'PENDING_APPROVAL')
    }).pipe(
      map(res => {
        const pending = res?.totalSize ?? res?.totalElements ?? 0;
        return {
          pendingCount: pending,
          approvedToday: 0,
          rejectedThisWeek: 0,
          averageApprovalTime: '—',
          urgentPending: 0
        } as ApprovalStats;
      })
    );
  }

  getDepartments(): Observable<string[]> {
    return of(['IT Department', 'Operations', 'Marketing', 'Finance', 'HR', 'Sales']);
  }
}
