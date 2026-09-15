import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, map, switchMap, tap } from 'rxjs/operators';
import { environment } from '../environments/environment';

export interface CompanyProfile {
  userId: number;
  companyName: string;
  industry: string;
  domain: string;
  address: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  currency: string;
  language: string;
  timeZone: string;
  logoUrl: string | null;
  email?: string;
  phone?: string;
  bankName?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
}

@Injectable({ providedIn: 'root' })
export class CompanyProfileService {
  private readonly baseUrl = environment.apiBaseUrl;
  private readonly storageKey = 'companyProfile';

  private readonly _profile$ = new BehaviorSubject<CompanyProfile | null>(this.fromStorage());

  readonly companyProfile$ = this._profile$.asObservable();

  constructor(private http: HttpClient) {
    const userId = sessionStorage.getItem('userid');
    if (userId) {
      this.load(+userId).subscribe();
    }
  }

  load(userId: number): Observable<CompanyProfile> {
    return this.http
      .get<any>(`${this.baseUrl}/x/api/v2/us/ur/get/company/profile/${userId}`)
      .pipe(
        switchMap(raw => {
          const logoUrl: string | null = raw.logoUrl || raw.companyLogo || null;
          if (logoUrl) {
            return of({ ...raw, logoUrl } as CompanyProfile);
          }
          return this.http
            .get<any>(`${this.baseUrl}/x/api/v2/us/ur/get/user/primary/info/${userId}`)
            .pipe(
              map(userInfo => ({ ...raw, logoUrl: userInfo?.companyLogo || userInfo?.logoUrl || null } as CompanyProfile)),
              catchError(() => of({ ...raw, logoUrl: null } as CompanyProfile))
            );
        }),
        tap(profile => this.store(profile)),
        catchError(() => of(this._profile$.value as CompanyProfile))
      );
  }

  updateLogoUrl(logoUrl: string | null): void {
    const current = this._profile$.value;
    if (current) {
      this.store({ ...current, logoUrl });
    }
  }

  updateBankDetails(bank: { bankName: string; bankAccountName: string; bankAccountNumber: string }): void {
    const current = this._profile$.value;
    const updated: CompanyProfile = current
      ? { ...current, ...bank }
      : { userId: 0, companyName: '', industry: '', domain: '', address: '', city: '', state: '', country: '', postalCode: '', currency: '', language: '', timeZone: '', logoUrl: null, ...bank };
    this.store(updated);
  }

  updateContactDetails(contact: { email?: string; phone?: string; address?: string }): void {
    const current = this._profile$.value;
    if (current) {
      this.store({ ...current, ...contact });
    }
  }

  refresh(): void {
    const userId = sessionStorage.getItem('userid');
    if (userId) {
      this.load(+userId).subscribe();
    }
  }

  get(): CompanyProfile | null {
    return this._profile$.value;
  }

  clear(): void {
    sessionStorage.removeItem(this.storageKey);
    this._profile$.next(null);
  }

  private store(profile: CompanyProfile): void {
    const existing = this._profile$.value;
    const merged: CompanyProfile = {
      ...profile,
      logoUrl: profile.logoUrl ?? existing?.logoUrl ?? null,
    };
    sessionStorage.setItem(this.storageKey, JSON.stringify(merged));
    this._profile$.next(merged);
  }

  private fromStorage(): CompanyProfile | null {
    const raw = sessionStorage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : null;
  }
}
