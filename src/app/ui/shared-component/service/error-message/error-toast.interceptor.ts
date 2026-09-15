import { Injectable } from '@angular/core';
import {
  HttpContextToken,
  HttpEvent,
  HttpHandler,
  HttpInterceptor,
  HttpRequest,
} from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';
import { MessageService } from 'primeng/api';
import { ErrorMessageService } from './error-message.service';

export const SUPPRESS_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

@Injectable()
export class ErrorToastInterceptor implements HttpInterceptor {
  constructor(
    private messageService: MessageService,
    private errorMessageService: ErrorMessageService
  ) {}

  intercept(req: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(req).pipe(
      catchError((error: unknown) => {
        if (!req.context.get(SUPPRESS_ERROR_TOAST)) {
          const detail = this.errorMessageService.getUserMessage(
            error,
            'Something went wrong. Please try again.'
          );

          this.messageService.add({
            severity: 'error',
            summary: 'Error',
            detail,
            key: 'global',
            life: 4000,
          });
        }

        return throwError(() => error);
      })
    );
  }
}
