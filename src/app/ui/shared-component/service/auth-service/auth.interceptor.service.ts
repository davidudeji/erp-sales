import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
} from '@angular/common/http';
import { Observable } from 'rxjs';
import { Router } from '@angular/router';
import { NavigationLinksService } from '../navigation-links/navigation-links.service';


@Injectable()
export class AuthInterceptor implements HttpInterceptor {
    constructor(private router: Router, private navigationLink: NavigationLinksService) {}
    intercept(
        request: HttpRequest<any>,
        next: HttpHandler
    ): Observable<HttpEvent<any>> {
        if (
            request.url.startsWith('https://automation.optimaxsuites.com') ||
            request.url.startsWith('https://n8n.royalvilletechnologies.com')
        ) {
            return next.handle(request);
        }
        const accessToken = sessionStorage.getItem("Token");
//  

const host = window.location.hostname;
const isLocalhost = host.includes('localhost') || host.includes('127.0.0.1');
let tenantId = 'optimax'; 

if (!isLocalhost) {
  const parts = host.split('.');
  tenantId = parts[0] || 'optimax';
}

const defaultTenantEndpoints = ['/auth/register', '/auth/forgot-password'];
const isDefaultTenantEndpoint = defaultTenantEndpoints.some((url) =>
  request.url.includes(url)
);

let updatedRequest = request.clone({
  setHeaders: {
    'X-Tenant-ID': isDefaultTenantEndpoint ? 'optimax' : tenantId,
  },
});

if (accessToken) {
  updatedRequest = updatedRequest.clone({
    setHeaders: {
      ...updatedRequest.headers.keys().reduce((acc, key) => {
        acc[key] = updatedRequest.headers.get(key)!;
        return acc;
      }, {} as Record<string, string>),
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

return next.handle(updatedRequest);
  }
}

