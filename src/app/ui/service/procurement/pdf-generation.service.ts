import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../shared-component/service/environments/environment';

export type PdfDocumentType = 'LPO' | 'GRN' | 'PAYMENT_VOUCHER' | 'PAYMENT_RECEIPT' | 'RFQ' | 'QUOTATION' | 'INVOICE';

export interface PdfGenerationRequest {
  documentType: PdfDocumentType;
  documentId: string;
  documentNumber: string;
  tenantId: string;
  data?: Record<string, any>;
}

export interface PdfGenerationResult {
  url?: string;
  blob?: Blob;
  success: boolean;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class PdfGenerationService {

  private readonly baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';

  constructor(private http: HttpClient) {}

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  /**
   * Requests PDF generation from the backend. On success this emits the raw Blob directly
   * (the `PdfGenerationResult` return type is aspirational, not what the server actually
   * returns with `responseType: 'blob'`). On failure this now re-throws instead of quietly
   * emitting a `{success:false}` placeholder object through `next()` — every caller's
   * `.subscribe({next, error})` treats whatever `next` receives as a real Blob and hands it
   * straight to `downloadBlob()`, which calls `URL.createObjectURL()` on it; a placeholder
   * object there throws "Overload resolution failed" and silently kills the download with no
   * user-facing feedback. Re-throwing lets callers' existing `error:` handlers do what they
   * already correctly attempt: fall back to client-side PDF generation.
   */
  generatePdf(req: PdfGenerationRequest): Observable<PdfGenerationResult> {
    return this.http.post<any>(`${this.baseUrl}/documents/generate-pdf`, {
      ...req, tenantId: this.tenantId
    }, { responseType: 'blob' as any }).pipe(
      catchError(err => {
        console.warn('[PdfGenerationService] Server PDF generation unavailable, falling back to client-side generation:', err);
        return throwError(() => err);
      })
    );
  }

  /**
   * Browser-native print as fallback. Opens a print-optimized version of the current view.
   */
  printDocument(elementId?: string): void {
    if (elementId) {
      const el = document.getElementById(elementId);
      if (el) {
        const win = window.open('', '_blank');
        if (win) {
          win.document.write(`
            <html>
              <head>
                <title>OptimaX Document</title>
                <style>
                  * { box-sizing: border-box; font-family: 'Segoe UI', Arial, sans-serif; }
                  body { margin: 0; padding: 20px; color: #1a1a2e; }
                  table { width: 100%; border-collapse: collapse; }
                  th, td { border: 1px solid #e5e7eb; padding: 8px 12px; text-align: left; }
                  th { background: #f8fafc; font-weight: 600; }
                  .print-hide { display: none !important; }
                  @page { margin: 15mm; }
                </style>
              </head>
              <body>${el.innerHTML}</body>
            </html>
          `);
          win.document.close();
          win.print();
        }
        return;
      }
    }
    window.print();
  }

  /**
   * Downloads a file from a URL.
   */
  downloadFile(url: string, fileName: string): void {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Converts a Blob to a download.
   */
  downloadBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    this.downloadFile(url, fileName);
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  }
}
