import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { BehaviorSubject, Observable, of, forkJoin } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import {
  VendorRegistration, RegistrationStatus,
  BusinessIdentity, LegalCompliance, ContactLocation,
  BankingFinance, CapabilitiesExperience, DocumentsDeclaration,
  UploadedDocument, DocumentUploadType,
} from '../../domain/vendor-portal/vendor-registration.dto';
import { environment } from '../../shared-component/service/environments/environment';
import {
  PendingVendorStore
} from '../vendor-management/vendor-management.service';
import { Vendor, VendorStatus, VendorTier, RiskLevel } from '../../domain/vendor-management/vendor-management.dto';

@Injectable({ providedIn: 'root' })
export class VendorRegistrationService {

  private readonly baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';

  private registration$$ = new BehaviorSubject<VendorRegistration | null>(null);

  readonly registration$ = this.registration$$.asObservable();

  constructor(private http: HttpClient) { }

  private get tenantId(): string {
    const h = window.location.hostname;
    return (h.includes('localhost') || h.includes('127.0.0.1')) ? 'optimax' : h.split('.')[0] || 'optimax';
  }

  // ── Draft persistence ─────────────────────────────────────────────────────
  /** Merges a partial update into the in-memory draft and fires the BehaviorSubject.
   *  No localStorage is used; the server is the source of truth once a record
   *  exists, but for pure draft state (before POST /vendors) we keep it in memory. */
  saveDraft(reg: Partial<VendorRegistration>): void {
    const current = this.registration$$.getValue() ?? this.blankRegistration();
    const updated = { ...current, ...reg, lastModified: new Date() };
    this.registration$$.next(updated as VendorRegistration);
  }

  getDraft(): VendorRegistration | null {
    return this.registration$$.getValue();
  }

  clearDraft(): void {
    this.registration$$.next(null);
  }

  // ── Step savers ───────────────────────────────────────────────────────────
  /** Saves step 1 (Business Identity) in memory and, if the vendor record
   *  already has a server-assigned id, persists via PUT /vendors/{id}/step1. */
  saveStep1(data: BusinessIdentity): void {
    this.saveDraft({ step1: data });
    const id = this.registration$$.getValue()?.id;
    if (id) {
      this.http.put(`${this.baseUrl}/vendors/${id}/step1`, data).pipe(
        catchError((err) => { console.error('[VendorRegistrationService] saveStep1 failed:', err); return of(null); }),
      ).subscribe();
    }
  }

  saveStep2(data: LegalCompliance): void {
    this.saveDraft({ step2: data });
    const id = this.registration$$.getValue()?.id;
    if (id) {
      this.http.put(`${this.baseUrl}/vendors/${id}/step2`, data).pipe(
        catchError((err) => { console.error('[VendorRegistrationService] saveStep2 failed:', err); return of(null); }),
      ).subscribe();
    }
  }

  saveStep3(data: ContactLocation): void {
    this.saveDraft({ step3: data });
    const id = this.registration$$.getValue()?.id;
    if (id) {
      this.http.put(`${this.baseUrl}/vendors/${id}/step3`, data).pipe(
        catchError((err) => { console.error('[VendorRegistrationService] saveStep3 failed:', err); return of(null); }),
      ).subscribe();
    }
  }

  saveStep4(data: BankingFinance): void {
    this.saveDraft({ step4: data });
    const id = this.registration$$.getValue()?.id;
    if (id) {
      this.http.put(`${this.baseUrl}/vendors/${id}/step4`, data).pipe(
        catchError((err) => { console.error('[VendorRegistrationService] saveStep4 failed:', err); return of(null); }),
      ).subscribe();
    }
  }

  saveStep5(data: CapabilitiesExperience): void {
    this.saveDraft({ step5: data });
    const id = this.registration$$.getValue()?.id;
    if (id) {
      this.http.put(`${this.baseUrl}/vendors/${id}/step5`, data).pipe(
        catchError((err) => { console.error('[VendorRegistrationService] saveStep5 failed:', err); return of(null); }),
      ).subscribe();
    }
  }

  saveStep6(data: DocumentsDeclaration): void {
    this.saveDraft({ step6: data });
    const id = this.registration$$.getValue()?.id;
    if (id) {
      this.http.put(`${this.baseUrl}/vendors/${id}/step6`, data).pipe(
        catchError((err) => { console.error('[VendorRegistrationService] saveStep6 failed:', err); return of(null); }),
      ).subscribe();
    }
  }

  // ── Create vendor record on backend ──────────────────────────────────────
  /** POST /vendors — call once (e.g. on step 1 completion) to get a server-assigned
   *  vendor id, then subsequent step saves use PUT /vendors/{id}/stepN. */
  createVendorRecord(initial: Partial<VendorRegistration>): Observable<string> {
    const step1Payload = { ...(initial.step1 ?? {}), tenantId: this.tenantId };
    return this.http.post<any>(`${this.baseUrl}/vendors`, step1Payload).pipe(
      tap(res => {
        const id = typeof res === 'object' ? (res?.id ?? String(res)) : String(res);
        const current = this.registration$$.getValue() ?? this.blankRegistration();
        this.registration$$.next({ ...current, ...initial, id } as VendorRegistration);
      }),
      map(res => {
        const id = typeof res === 'object' ? (res?.id ?? String(res)) : String(res);
        return id;
      }),
      catchError((err) => {
        console.error('[VendorRegistrationService] createVendorRecord failed:', err);
        return of('');
      }),
    );
  }

  private uploadRegistrationDocuments(vendorId: string, docs: UploadedDocument[]): Observable<any[]> {
    if (!docs || docs.length === 0) {
      return of([]);
    }

    const parseFileSize = (sizeStr: string): number => {
      if (!sizeStr) return 0;
      const match = sizeStr.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)?$/i);
      if (!match) return 0;
      const val = parseFloat(match[1]);
      const unit = match[2]?.toUpperCase();
      if (unit === 'KB') return val * 1024;
      if (unit === 'MB') return val * 1024 * 1024;
      if (unit === 'GB') return val * 1024 * 1024 * 1024;
      return val;
    };

    const getCategoryForType = (type: string): string => {
      const t = String(type || '').toLowerCase();
      if (t === 'cac_certificate' || t === 'company_profile' || t === 'bank_reference_letter' || t === 'annual_accounts') {
        return 'REGISTRATION';
      } else if (t === 'tax_clearance' || t === 'vat_certificate') {
        return 'TAX';
      } else if (t === 'nafdac_cert' || t === 'son_cert' || t === 'iso_certificate') {
        return 'CERTIFICATION';
      } else if (t === 'public_liability_insurance' || t === 'professional_indemnity') {
        return 'INSURANCE';
      }
      return 'REGISTRATION';
    };

    const requests = docs.map(doc => {
      const payload = {
        vendorId: Number(vendorId) || vendorId,
        type: String(doc.type || '').toUpperCase(),
        label: doc.label || this.docTypeLabel(doc.type),
        fileName: doc.fileName || '',
        fileSize: doc.file ? doc.file.size : parseFileSize(doc.fileSize),
        fileUrl: doc.fileUrl || '',
        uploadedDate: doc.uploadedDate ? new Date(doc.uploadedDate).toISOString() : new Date().toISOString(),
        expiryDate: doc.expiryDate ? new Date(doc.expiryDate).toISOString() : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        isRequired: !!doc.isRequired,
        status: 'PENDING',
        category: getCategoryForType(doc.type),
        notes: 'Submitted during registration'
      };

      return this.http.post(`${this.baseUrl}/vendors/${vendorId}/documents`, payload).pipe(
        catchError(err => {
          console.error('[VendorRegistrationService] Failed to upload doc:', doc.fileName, err);
          return of(null);
        })
      );
    });

    return forkJoin(requests);
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  submit(reg: VendorRegistration): Observable<{ applicationNumber: string }> {
    const vendorId = reg.id;
    const docs = reg.step6?.uploadedDocuments ?? [];

    // Helper: map registration form data to the Vendor DTO used by the
    // management side, then write it into PendingVendorStore.
    const mapAndStore = (id: string): string => {
      const s1 = reg.step1 ?? {} as any;
      const s2 = reg.step2 ?? {} as any;
      const s3 = reg.step3 ?? {} as any;
      const s4 = reg.step4 ?? {} as any;
      const s5 = reg.step5 ?? {} as any;
      const s6 = reg.step6 ?? {} as any;

      const appNum = id || `APP-${Date.now()}`;
      const categories: string[] = (s5.supplyCategories ?? []).map((c: string) =>
        c.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())
      );

      const vendor: Vendor = {
        id: appNum,
        companyName: s1.businessName || '',
        registrationNumber: s2.cacRegistrationNumber || '',
        taxId: s2.tinNumber || '',
        email: s3.primaryContactEmail || '',
        phone: s3.primaryContactPhone || '',
        website: s1.websiteUrl || undefined,
        address: {
          street: s3.registeredAddressLine1 || '',
          city: s3.registeredCity || '',
          state: s3.registeredState || '',
          country: s3.registeredCountry || 'Nigeria',
          postalCode: s3.registeredPostalCode || ''
        },
        status: VendorStatus.PENDING_ONBOARDING,
        tier: VendorTier.APPROVED,
        riskLevel: RiskLevel.LOW,
        performanceScore: 0,
        totalProjects: s5.completedProjectsCount ?? 0,
        winRate: 0,
        averageRating: 0,
        categories,
        description: s1.businessDescription || '',
        paymentTerms: s4.preferredPaymentTerms || 'Net 30',
        bankDetails: {
          bankName: s4.primaryBankName || '',
          accountNumber: s4.primaryAccountNumber || '',
          accountName: s4.primaryAccountName || '',
          accountType: s4.primaryAccountType || 'current',
          sortCode: s4.primarySortCode || '',
          swiftCode: s4.primarySwiftCode || '',
          currency: s4.primaryCurrency || 'NGN',
          bankBranch: s4.primaryBankBranch || '',
          isPrimary: true
        },
        contacts: s3.primaryContactName ? [{
          id: `c-${appNum}`,
          name: s3.primaryContactName || '',
          title: s3.primaryContactTitle || '',
          email: s3.primaryContactEmail || '',
          phone: s3.primaryContactPhone || '',
          isPrimary: true
        }] : [],
        documents: (s6.uploadedDocuments ?? []).map((d: any) => ({
          id: d.id,
          name: d.label || d.fileName,
          type: d.type,
          category: 'compliance' as any,
          status: 'PENDING_VERIFICATION' as any,
          uploadedDate: d.uploadedDate ? new Date(d.uploadedDate) : new Date(),
          expiryDate: undefined,
          fileUrl: d.fileUrl,
          fileSize: d.fileSize,
          vendorId: appNum,
          isRequired: d.isRequired ?? false
        })),
        complianceStatus: {
          isCompliant: false,
          documentsVerified: 0,
          totalRequiredDocuments: 3,
          expiredDocuments: 0,
          expiringDocuments: 0,
          lastComplianceCheck: new Date(),
          sanctionsClear: !(s2.hasBeenBlacklisted ?? false)
        },
        performanceMetrics: {
          overallScore: 0, onTimeDeliveryRate: 0, qualityScore: 0,
          costCompetitiveness: 0, complianceScore: 0, ratingScore: 0,
          winRate: 0, totalProjects: s5.completedProjectsCount ?? 0,
          totalRevenue: 0, averageOrderValue: 0,
          lastUpdated: new Date(), trendData: []
        },
        lifecycleHistory: [{
          id: `lh-${appNum}`,
          event: 'Registration Submitted',
          fromStatus: null as any,
          toStatus: VendorStatus.PENDING_ONBOARDING,
          performedBy: s6.declarantName || 'Vendor',
          timestamp: new Date(),
          notes: 'Submitted via Vendor Portal'
        }],
        riskAlerts: [],
        joinedDate: new Date(),
        lastActivityDate: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        applicationNumber: appNum,
        // Keep the full submission so the approval queue / vendor directory can
        // display everything the vendor entered, not just the summary fields above.
        registration: { ...reg, id: appNum, applicationNumber: appNum }
      } as any as Vendor;

      PendingVendorStore.add(vendor);
      return appNum;
    };

    // ── Real API path ────────────────────────────────────────────────────────
    const saveAllSteps = (id: string): Observable<any> => {
      const saves: Observable<any>[] = [];
      if (reg.step2) saves.push(this.http.put(`${this.baseUrl}/vendors/${id}/step2`, reg.step2).pipe(catchError(() => of(null))));
      if (reg.step3) saves.push(this.http.put(`${this.baseUrl}/vendors/${id}/step3`, reg.step3).pipe(catchError(() => of(null))));
      if (reg.step4) saves.push(this.http.put(`${this.baseUrl}/vendors/${id}/step4`, reg.step4).pipe(catchError(() => of(null))));
      if (reg.step5) saves.push(this.http.put(`${this.baseUrl}/vendors/${id}/step5`, reg.step5).pipe(catchError(() => of(null))));
      if (reg.step6) saves.push(this.http.put(`${this.baseUrl}/vendors/${id}/step6`, reg.step6).pipe(catchError(() => of(null))));
      return saves.length > 0 ? forkJoin(saves) : of([]);
    };

    const patchSubmit = (id: string, appNum: string): Observable<{ applicationNumber: string }> => {
      return this.http.patch<{ applicationNumber: string }>(`${this.baseUrl}/vendors/${id}/submit`, {}).pipe(
        tap(res => {
          const current = this.registration$$.getValue();
          if (current) {
            this.registration$$.next({
              ...current, status: 'submitted',
              submittedDate: new Date(), applicationNumber: res.applicationNumber,
            } as VendorRegistration);
          }
        }),
        map(res => ({ applicationNumber: res.applicationNumber })),
        catchError(() => of({ applicationNumber: appNum }))
      );
    };

    if (!vendorId) {
      const step1Payload = { ...(reg.step1 ?? {}), tenantId: this.tenantId };
      return this.http.post<any>(`${this.baseUrl}/vendors`, step1Payload).pipe(
        switchMap(res => {
          const id = typeof res === 'object' ? (res?.id ?? String(res)) : String(res);
          this.registration$$.next({ ...reg, id } as VendorRegistration);
          const appNum = mapAndStore(id);
          return saveAllSteps(id).pipe(switchMap(() => patchSubmit(id, appNum)));
        }),
        catchError(() => {
          const appNum = mapAndStore(`APP-${Date.now()}`);
          this.registration$$.next({ ...reg, id: appNum, status: 'submitted', submittedDate: new Date(), applicationNumber: appNum } as VendorRegistration);
          return of({ applicationNumber: appNum });
        })
      );
    }

    return saveAllSteps(vendorId).pipe(
      switchMap(() => patchSubmit(vendorId, mapAndStore(vendorId))),
      catchError(() => {
        const appNum = mapAndStore(vendorId);
        return of({ applicationNumber: appNum });
      })
    );
  }

  // ── File upload ───────────────────────────────────────────────────────────
  uploadFile(file: File, type: DocumentUploadType): Observable<UploadedDocument> {
    const objectUrl = URL.createObjectURL(file);
    const doc: UploadedDocument = {
      id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      label: this.docTypeLabel(type),
      fileName: file.name,
      fileSize: this.formatSize(file.size),
      fileUrl: objectUrl,
      uploadedDate: new Date(),
      isRequired: this.isRequiredDoc(type),
      status: 'pending',
      file,
    };
    return of(doc);
  }

  /** After the vendor record exists, persist a document to the backend. */
  persistDocument(vendorId: string, doc: UploadedDocument): Observable<any> {
    const payload = {
      vendorId: Number(vendorId),
      type: doc.type,
      label: doc.label,
      fileName: doc.fileName,
      fileSize: doc.file ? doc.file.size : null,
      fileUrl: doc.fileUrl,
      uploadedDate: new Date().toISOString(),
      isRequired: doc.isRequired,
      status: 'PENDING_VERIFICATION',
      category: 'COMPLIANCE'
    };
    return this.http.post<any>(`${this.baseUrl}/vendors/${vendorId}/documents`, payload).pipe(
      catchError(err => { console.error('[VendorRegistrationService] persistDocument failed:', err); return of(null); })
    );
  }

  // ── Fetch existing registration ───────────────────────────────────────────
  loadRegistration(vendorId: string): Observable<VendorRegistration> {
    return this.http.get<VendorRegistration>(`${this.baseUrl}/vendors/${vendorId}`).pipe(
      tap((reg) => this.registration$$.next(reg)),
      catchError((err) => {
        console.error('[VendorRegistrationService] loadRegistration failed:', err);
        return of(this.blankRegistration());
      }),
    );
  }

  // ── Application number check (for routing guard) ──────────────────────────
  checkStatus(applicationNumber: string): Observable<RegistrationStatus> {
    return this.http.get<{ status: RegistrationStatus }>(
      `${this.baseUrl}/vendors/${applicationNumber}`,
    ).pipe(
      map((res) => res.status),
      catchError((err) => {
        console.error('[VendorRegistrationService] checkStatus failed:', err);
        return of('under_review' as RegistrationStatus);
      }),
    );
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private blankRegistration(): VendorRegistration {
    return {
      status: 'draft',
      step1: {
        businessName: '', businessType: 'limited_liability',
        businessSize: 'small', ownershipType: 'indigenous',
        yearEstablished: new Date().getFullYear(),
        numberOfEmployees: '', annualTurnoverRange: '',
        currency: 'NGN', businessDescription: '',
      },
      step2: {
        cacRegistrationNumber: '', cacRegistrationDate: '',
        tinNumber: '', vatRegistered: false,
        hasPublicLiabilityInsurance: false,
        hasProfessionalIndemnity: false,
        isoStandards: [],
        hasBeenBlacklisted: false,
        hasLitigationPending: false,
        hasCriminalConviction: false,
      },
      step3: {
        primaryContactName: '', primaryContactTitle: '',
        primaryContactEmail: '', primaryContactPhone: '',
        hasSecondaryContact: false,
        registeredAddressLine1: '', registeredCity: '',
        registeredState: '', registeredCountry: 'Nigeria',
        operatingAddressSameAsRegistered: true,
        hasWarehouse: false,
        deliveryRegions: [],
        hasOwnDeliveryFleet: false,
        deliveryLeadTimeDays: 7,
        canDeliverNationwide: false,
        canDeliverInternationally: false,
      },
      step4: {
        primaryBankName: '', primaryAccountName: '',
        primaryAccountNumber: '', primaryAccountType: 'current',
        primaryCurrency: 'NGN',
        hasSecondaryBankAccount: false,
        preferredPaymentTerms: 'Net 30',
        acceptsAdvancePayment: false,
        acceptsLetterOfCredit: false,
        acceptsMobileMoney: false,
        annualAuditedAccounts: false,
      },
      step5: {
        supplyCategories: [], primaryCategory: 'other',
        categoryDescription: '',
        canHandleEmergencyOrders: false,
        bulkDiscountAvailable: false,
        hasQualityManagementSystem: false,
        hasInspectionFacility: false,
        isManufacturer: false,
        isDistributor: false,
        isServiceProvider: false,
        isImporter: false,
        majorClients: [],
        completedProjectsCount: 0,
        keyPersonnelList: [],
      },
      step6: {
        uploadedDocuments: [],
        declarantName: '', declarantTitle: '',
        declarantEmail: '', declarantPhone: '',
        declarationDate: new Date().toISOString().split('T')[0],
        agreedToTerms: false,
        agreedToPrivacyPolicy: false,
        agreedToCodeOfConduct: false,
        agreedToAntiCorruption: false,
        confirmedAccuracy: false,
      },
    };
  }

  formatSize(bytes: number): string {
    if (!bytes) return '0 B';
    const k = 1024, s = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / k ** i).toFixed(1)} ${s[i]}`;
  }

  isRequiredDoc(type: DocumentUploadType): boolean {
    return ['cac_certificate', 'tax_clearance', 'public_liability_insurance'].includes(type);
  }

  docTypeLabel(type: DocumentUploadType): string {
    const m: Record<DocumentUploadType, string> = {
      cac_certificate: 'CAC Certificate of Incorporation',
      tax_clearance: 'Tax Clearance Certificate',
      vat_certificate: 'VAT Registration Certificate',
      nafdac_cert: 'NAFDAC Registration Certificate',
      son_cert: 'SON Certification',
      public_liability_insurance: 'Public Liability Insurance Policy',
      professional_indemnity: 'Professional Indemnity Insurance',
      iso_certificate: 'ISO Certification',
      annual_accounts: 'Audited Annual Accounts',
      company_profile: 'Company Profile Document',
      bank_reference_letter: 'Bank Reference Letter',
      other: 'Other Document',
    };
    return m[type] ?? 'Document';
  }
}
