// sales-email.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import {
  SendSalesEmailRequest,
  SalesEmailNotification,
  SalesEmailDocumentType
} from '../../domain/sales/sales.dto';
import { environment } from '../../shared-component/service/environments/environment';

/**
 * Dedicated email delivery service for sales documents (quotes/invoices).
 * Replaces the generic procurement NotificationService.sendDirectEmail() call
 * that quote-form/invoice-form used before this endpoint existed — that one
 * had no document/attachment tracking, just raw to/subject/body.
 */
@Injectable({ providedIn: 'root' })
export class SalesEmailService {

  private readonly baseUrl = `${environment.apiBaseUrl}/x/api/v2/commerce/sales/email`;

  constructor(private http: HttpClient) {}

  /** POST /sales/email/send — emails a quote or invoice to a customer. */
  send(payload: SendSalesEmailRequest): Observable<SalesEmailNotification> {
    return this.http.post<SalesEmailNotification>(`${this.baseUrl}/send`, payload);
  }

  /** GET /sales/email — full send history log (all documents, all customers). */
  getAll(): Observable<SalesEmailNotification[]> {
    return this.http.get<SalesEmailNotification[]>(this.baseUrl).pipe(
      map(res => Array.isArray(res) ? res : []),
      catchError(err => {
        console.error('[SalesEmailService] Failed to load email history:', err);
        return of([]);
      })
    );
  }

  /** GET /sales/email/{id} — a single logged send (e.g. to poll delivery status). */
  getById(id: number): Observable<SalesEmailNotification> {
    return this.http.get<SalesEmailNotification>(`${this.baseUrl}/${id}`);
  }

  /**
   * GET /sales/email/document — every email sent for one quote/invoice, e.g.
   * to back a "Sent" tab on the quote/invoice detail view.
   */
  getByDocument(documentType: SalesEmailDocumentType, documentId: number): Observable<SalesEmailNotification[]> {
    const params = new HttpParams()
      .set('documentType', documentType)
      .set('documentId', String(documentId));

    return this.http.get<SalesEmailNotification[]>(`${this.baseUrl}/document`, { params }).pipe(
      map(res => Array.isArray(res) ? res : []),
      catchError(err => {
        console.error('[SalesEmailService] Failed to load email history for document:', err);
        return of([]);
      })
    );
  }
}
