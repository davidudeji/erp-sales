import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';
import { ProcurementNotification, NotificationType } from '../../domain/procurement-request/procurement.dto';
import { environment } from '../../shared-component/service/environments/environment';

export interface NotificationTrigger {
  type: NotificationType;
  recipientId: string;
  recipientEmail: string;
  recipientName: string;
  relatedEntityId: string;
  relatedEntityType: string;
  templateData: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {

  private readonly baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';
  private notifications$$ = new BehaviorSubject<ProcurementNotification[]>([]);
  readonly notifications$ = this.notifications$$.asObservable();

  constructor(private http: HttpClient) {}

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  /** Turns a NotificationTrigger's raw type + templateData into a readable subject/body,
   *  since the real create endpoint takes a fully-formed notification, not a template ref. */
  private composeMessage(trigger: NotificationTrigger): { subject: string; body: string } {
    const label = trigger.type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const details = Object.entries(trigger.templateData || {})
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => `${k.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase()}: ${v}`)
      .join(', ');
    return {
      subject: `${label} — ${trigger.relatedEntityType} ${trigger.relatedEntityId}`,
      body: details ? `${label}. ${details}.` : `${label}.`
    };
  }

  /**
   * Triggers an email + in-app notification. Called by procurement components
   * at each lifecycle event (RFQ sent, LPO issued, GRN approved, payment done).
   */
  trigger(trigger: NotificationTrigger): Observable<ProcurementNotification[]> {
    const { subject, body } = this.composeMessage(trigger);
    const payload: Partial<ProcurementNotification> & { tenantId: string } = {
      type: trigger.type,
      channel: 'EMAIL',
      recipientId: trigger.recipientId,
      recipientEmail: trigger.recipientEmail,
      recipientName: trigger.recipientName,
      subject,
      body,
      status: 'PENDING',
      retryCount: 0,
      relatedEntityId: trigger.relatedEntityId,
      relatedEntityType: trigger.relatedEntityType,
      tenantId: this.tenantId
    };

    return this.http.post<ProcurementNotification>(`${this.baseUrl}/procurement-notifications/`, payload).pipe(
      map(res => [res]),
      tap(list => {
        const current = this.notifications$$.getValue();
        this.notifications$$.next([...list, ...current]);
      }),
      catchError(err => {
        console.error('[NotificationService] trigger failed:', err);
        return of([]);
      })
    );
  }

  /**
   * Directly sends an email using the SMTP configurations defined in Settings (User Services microservice).
   */
  sendDirectEmail(payload: {
    to: string;
    cc?: string;
    bcc?: string;
    subject: string;
    body: string;
    html: boolean;
    tenant: string;
  }): Observable<any> {
    const url = `${environment.apiBaseUrl}/x/api/v2/notification/send-email`;
    return this.http.post<any>(url, payload);
  }

  /** All procurement notifications, across every entity. */
  getAll(): Observable<ProcurementNotification[]> {
    const params = new HttpParams().set('tenantId', this.tenantId);
    return this.http.get<ProcurementNotification[]>(`${this.baseUrl}/procurement-notifications/`, { params }).pipe(
      map(res => Array.isArray(res) ? res : []),
      catchError(() => of([]))
    );
  }

  /**
   * Loads notification history for a specific entity. The real API only exposes a flat
   * list (no entityId/entityType query params), so this fetches that list and filters
   * client-side.
   */
  getForEntity(entityId: string, entityType: string): Observable<ProcurementNotification[]> {
    return this.getAll().pipe(
      map(list => list.filter(n =>
        String(n.relatedEntityId) === entityId && n.relatedEntityType === entityType
      )),
      tap(list => this.notifications$$.next(list))
    );
  }

  retryFailed(notificationId: number): Observable<ProcurementNotification> {
    return this.http.patch<ProcurementNotification>(
      `${this.baseUrl}/notifications/${notificationId}/retry`, {}
    ).pipe(catchError(err => { throw err; }));
  }

  getDeliveryStatus(notificationId: number): Observable<ProcurementNotification> {
    const params = new HttpParams().set('tenantId', this.tenantId);
    return this.http.get<ProcurementNotification>(
      `${this.baseUrl}/procurement-notifications/${notificationId}`, { params }
    ).pipe(catchError(err => { throw err; }));
  }
}
