// vendor-management.service.ts
// ============================================================
// IMPORTS
// ============================================================

import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError, forkJoin } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  Vendor,
  VendorDashboardStats,
  VendorListResponse,
  VendorPerformanceMetrics,
  VendorPerformanceResponse,
  VendorRiskResponse,
  VendorDocument,
  VendorKPI,
  RiskAlert,
  OnboardingData,
  OnboardingResult,
  OffboardingData,
  VendorRankingData,
  VendorPrediction,
  AnomalyDetection,
  VendorContract,
  VendorMessage,
  Dispute,
  VendorLifecycleHistory,
  VendorLifecycleEvent,
  VendorRecentActivity,
  VendorStatus,
  VendorTier,
  RiskLevel,
  DocumentCategory,
  DocumentStatus,
  SentinelInsight,
  InsightType,
  InsightSeverity,
  InsightActionStatus,
  VendorRiskTrajectory,
  FraudFlag,
  OnboardingCopilotSession,
  ExtractedField,
  SentinelSummaryStats,
  AlertSeverity
} from '../../domain/vendor-management/vendor-management.dto';
import { environment } from '../../shared-component/service/environments/environment';

const API_BASE = environment.apiBaseUrl;

function parseSafeDate(val: any): Date {
  if (!val) return new Date();
  if (typeof val === 'string') {
    const num = Number(val);
    if (!isNaN(num)) {
      val = num;
    }
  }
  if (typeof val === 'number') {
    return new Date(val < 10000000000 ? val * 1000 : val);
  }
  const parsed = new Date(val);
  return isNaN(parsed.getTime()) ? new Date() : parsed;
}
// MOCK DATA — AI VENDOR INTELLIGENCE (SENTINEL)
// ============================================================

const MOCK_SENTINEL_INSIGHTS: SentinelInsight[] = [
  {
    id: 1,
    type: InsightType.PERFORMANCE_DECLINE,
    severity: InsightSeverity.HIGH,
    vendorId: '204',
    vendorName: 'Vanguard Security Services',
    finding: 'Delivery performance down 15% over the last 3 RFQs.',
    reason: 'On-time delivery rate fell from 94% to 79% across the last three fulfilled RFQs, with two consecutive late shipments flagged in the last 21 days.',
    evidence: ['RFQ-2291: delivered 4 days late', 'RFQ-2305: delivered 2 days late', 'RFQ-2318: delivered on time but partial shipment'],
    suggestedActions: [
      { label: 'Review', action: 'REVIEW', style: 'PRIMARY' },
      { label: 'Message Vendor', action: 'MESSAGE', style: 'SECONDARY' },
      { label: 'Dismiss', action: 'DISMISS', style: 'SECONDARY' }
    ],
    status: InsightActionStatus.OPEN,
    detectedAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    confidence: 87
  },
  {
    id: 2,
    type: InsightType.FRAUD_ANOMALY,
    severity: InsightSeverity.CRITICAL,
    vendorId: '217',
    vendorName: 'OmniCorp Facilities Ltd',
    finding: 'Bank details changed 2 days before the latest invoice.',
    reason: 'Bank account number and account name were updated 2 days prior to submission of a ₦4.2M invoice, a pattern statistically associated with payment redirection fraud.',
    evidence: ['Bank details modified: 26 Jul 2026, 11:42 PM', 'Invoice INV-88213 submitted: 28 Jul 2026, 09:10 AM', 'New account name partially mismatches registered company name'],
    suggestedActions: [
      { label: 'Investigate', action: 'INVESTIGATE', style: 'PRIMARY' },
      { label: 'Approve', action: 'APPROVE', style: 'SECONDARY' },
      { label: 'Escalate', action: 'ESCALATE', style: 'DANGER' }
    ],
    status: InsightActionStatus.OPEN,
    detectedAt: new Date(Date.now() - 45 * 60 * 1000),
    confidence: 92
  },
  {
    id: 3,
    type: InsightType.TIER_UPGRADE,
    severity: InsightSeverity.LOW,
    vendorId: '101',
    vendorName: 'Apex Industrial Supplies Ltd',
    finding: '6 straight months above 95%. Eligible for tier upgrade.',
    reason: 'Overall performance score has remained above 95% for 6 consecutive months, with zero compliance flags and a 98% on-time delivery rate, qualifying it for the Preferred tier upgrade criteria.',
    evidence: ['Feb–Jul 2026: performance score 95.1%–98.4%', 'Zero compliance flags in 6 months', 'On-time delivery steady at 98%'],
    suggestedActions: [
      { label: 'Approve', action: 'APPROVE', style: 'PRIMARY' },
      { label: 'Review', action: 'REVIEW', style: 'SECONDARY' }
    ],
    status: InsightActionStatus.OPEN,
    detectedAt: new Date(Date.now() - 6 * 60 * 60 * 1000),
    confidence: 95
  },
  {
    id: 4,
    type: InsightType.DOCUMENT_EXPIRY,
    severity: InsightSeverity.MEDIUM,
    vendorId: '233',
    vendorName: 'Northbridge Cold Chain Logistics',
    finding: 'Insurance certificate expires in 9 days with no renewal on file.',
    reason: 'Public liability insurance policy expires in 9 days. No renewal document has been submitted and two automated reminders have gone unanswered.',
    evidence: ['Policy expiry: 06 Aug 2026', 'Reminder sent 14 Jul 2026 — no response', 'Reminder sent 21 Jul 2026 — no response'],
    suggestedActions: [
      { label: 'Message Vendor', action: 'MESSAGE', style: 'PRIMARY' },
      { label: 'Review', action: 'REVIEW', style: 'SECONDARY' },
      { label: 'Dismiss', action: 'DISMISS', style: 'SECONDARY' }
    ],
    status: InsightActionStatus.OPEN,
    detectedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
    confidence: 99
  },
  {
    id: 5,
    type: InsightType.RISK_ESCALATION,
    severity: InsightSeverity.HIGH,
    vendorId: '241',
    vendorName: 'Coastline Marine Freight Co.',
    finding: 'Dispute frequency has tripled in the last 90 days.',
    reason: '3 new disputes opened in the last 90 days versus an average of 1 per quarter historically, two of which cite short-delivery of goods.',
    evidence: ['Dispute #D-4021: short delivery', 'Dispute #D-4058: invoice mismatch', 'Dispute #D-4090: short delivery'],
    suggestedActions: [
      { label: 'Review', action: 'REVIEW', style: 'PRIMARY' },
      { label: 'Message Vendor', action: 'MESSAGE', style: 'SECONDARY' },
      { label: 'Dismiss', action: 'DISMISS', style: 'SECONDARY' }
    ],
    status: InsightActionStatus.OPEN,
    detectedAt: new Date(Date.now() - 30 * 60 * 60 * 1000),
    confidence: 81
  }
];

const MOCK_RISK_TRAJECTORIES: VendorRiskTrajectory[] = [
  {
    vendorId: '204',
    vendorName: 'Vanguard Security Services',
    currentRiskLevel: RiskLevel.MEDIUM,
    direction: 'RISING',
    confidence: 84,
    reason: 'Declining delivery trend combined with a recent dispute and no compensating quality improvement.',
    drivers: [
      { label: 'Delivery trend', impact: 'NEGATIVE', weight: 45 },
      { label: 'Dispute frequency', impact: 'NEGATIVE', weight: 25 },
      { label: 'Document renewals current', impact: 'POSITIVE', weight: 10 }
    ],
    projections: [
      { horizonDays: 30, projectedRiskScore: 52, confidence: 88 },
      { horizonDays: 60, projectedRiskScore: 61, confidence: 82 },
      { horizonDays: 90, projectedRiskScore: 68, confidence: 76 }
    ],
    lastUpdated: new Date()
  },
  {
    vendorId: '217',
    vendorName: 'OmniCorp Facilities Ltd',
    currentRiskLevel: RiskLevel.MEDIUM,
    direction: 'RISING',
    confidence: 90,
    reason: 'Unresolved fraud flag on bank details plus a prior late compliance renewal.',
    drivers: [
      { label: 'Fraud flag pending', impact: 'NEGATIVE', weight: 55 },
      { label: 'Compliance history', impact: 'NEGATIVE', weight: 15 }
    ],
    projections: [
      { horizonDays: 30, projectedRiskScore: 66, confidence: 90 },
      { horizonDays: 60, projectedRiskScore: 74, confidence: 85 },
      { horizonDays: 90, projectedRiskScore: 79, confidence: 79 }
    ],
    lastUpdated: new Date()
  },
  {
    vendorId: '101',
    vendorName: 'Apex Industrial Supplies Ltd',
    currentRiskLevel: RiskLevel.LOW,
    direction: 'IMPROVING',
    confidence: 93,
    reason: 'Sustained high performance, zero disputes, and all documents current with early renewals.',
    drivers: [
      { label: 'Performance trend', impact: 'POSITIVE', weight: 50 },
      { label: 'Document renewals', impact: 'POSITIVE', weight: 20 },
      { label: 'Dispute frequency', impact: 'POSITIVE', weight: 15 }
    ],
    projections: [
      { horizonDays: 30, projectedRiskScore: 8, confidence: 94 },
      { horizonDays: 60, projectedRiskScore: 6, confidence: 91 },
      { horizonDays: 90, projectedRiskScore: 5, confidence: 88 }
    ],
    lastUpdated: new Date()
  },
  {
    vendorId: '233',
    vendorName: 'Northbridge Cold Chain Logistics',
    currentRiskLevel: RiskLevel.LOW,
    direction: 'STABLE',
    confidence: 72,
    reason: 'Solid delivery record offset by an unresolved insurance renewal lapse risk.',
    drivers: [
      { label: 'Delivery trend', impact: 'POSITIVE', weight: 30 },
      { label: 'Document renewal lapse risk', impact: 'NEGATIVE', weight: 30 }
    ],
    projections: [
      { horizonDays: 30, projectedRiskScore: 28, confidence: 75 },
      { horizonDays: 60, projectedRiskScore: 31, confidence: 70 },
      { horizonDays: 90, projectedRiskScore: 30, confidence: 66 }
    ],
    lastUpdated: new Date()
  },
  {
    vendorId: '241',
    vendorName: 'Coastline Marine Freight Co.',
    currentRiskLevel: RiskLevel.MEDIUM,
    direction: 'RISING',
    confidence: 79,
    reason: 'Tripling dispute frequency is the dominant signal, with delivery metrics still nominally acceptable.',
    drivers: [
      { label: 'Dispute frequency', impact: 'NEGATIVE', weight: 60 },
      { label: 'Delivery trend', impact: 'POSITIVE', weight: 10 }
    ],
    projections: [
      { horizonDays: 30, projectedRiskScore: 48, confidence: 82 },
      { horizonDays: 60, projectedRiskScore: 55, confidence: 77 },
      { horizonDays: 90, projectedRiskScore: 59, confidence: 71 }
    ],
    lastUpdated: new Date()
  }
];

const MOCK_FRAUD_FLAGS: FraudFlag[] = [
  {
    id: 1,
    vendorId: '217',
    vendorName: 'OmniCorp Facilities Ltd',
    type: 'BANK_DETAIL_CHANGE',
    title: 'Sudden bank detail change before large invoice',
    description: 'Bank account changed 2 days before a ₦4.2M invoice was submitted, with a partial mismatch between the new account name and registered company name.',
    severity: 'HIGH',
    evidence: [
      { label: 'Previous account name', value: 'OMNICORP FACILITIES LTD' },
      { label: 'New account name', value: 'OMNICORP FAC. SERVICES' },
      { label: 'Time between change and invoice', value: '2 days' },
      { label: 'Invoice amount', value: '₦4,200,000' }
    ],
    detectedAt: new Date(Date.now() - 45 * 60 * 1000),
    status: 'PENDING_REVIEW'
  },
  {
    id: 2,
    vendorId: '256',
    vendorName: 'BrightPath Office Supplies',
    type: 'DUPLICATE_INVOICE',
    title: 'Duplicate invoice number detected',
    description: 'Invoice INV-77120 was submitted twice within 48 hours against two different purchase orders, with identical line-item totals.',
    severity: 'MEDIUM',
    evidence: [
      { label: 'Invoice number', value: 'INV-77120' },
      { label: 'First submission', value: '24 Jul 2026, PO-9981' },
      { label: 'Second submission', value: '26 Jul 2026, PO-9998' }
    ],
    detectedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
    status: 'INVESTIGATING'
  },
  {
    id: 3,
    vendorId: '262',
    vendorName: 'Sterling Print & Packaging',
    type: 'SUSPICIOUSLY_LOW_BID',
    title: 'Bid 41% below category average',
    description: 'Submitted RFQ bid is 41% below the 90-day category average for equivalent scope, well outside the normal competitive range.',
    severity: 'MEDIUM',
    evidence: [
      { label: 'Bid amount', value: '₦1,180,000' },
      { label: 'Category average (90 days)', value: '₦2,010,000' },
      { label: 'Deviation', value: '-41%' }
    ],
    detectedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    status: 'PENDING_REVIEW'
  },
  {
    id: 4,
    vendorId: '270',
    vendorName: 'Delta Waterworks Engineering',
    type: 'DOCUMENT_METADATA_MISMATCH',
    title: 'Document metadata inconsistency on license upload',
    description: 'Uploaded operating license PDF metadata shows a creation date after the stated issue date, and font inconsistencies suggest partial editing.',
    severity: 'LOW',
    evidence: [
      { label: 'Stated issue date', value: '02 Jan 2025' },
      { label: 'File metadata creation date', value: '19 Jun 2026' },
      { label: 'Font consistency check', value: 'Failed on page 1' }
    ],
    detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
    status: 'PENDING_REVIEW'
  }
];

const MOCK_ONBOARDING_COPILOT: OnboardingCopilotSession = {
  id: 'onb-copilot-1',
  vendorId: '301',
  vendorName: 'Meridian Cold Storage Ltd',
  extractedFields: [
    { fieldName: 'Registration Number', extractedValue: 'RC-1182042', confidence: 97, sourceDocument: 'business_registration.pdf', confirmed: false },
    { fieldName: 'Tax ID', extractedValue: 'TIN-6620194', confidence: 95, sourceDocument: 'tax_certificate.pdf', confirmed: false },
    { fieldName: 'License Expiry', extractedValue: '14 Nov 2027', confidence: 89, sourceDocument: 'operating_license.pdf', confirmed: false },
    { fieldName: 'Registered Address', extractedValue: '22 Freight Lane, Apapa, Lagos', confidence: 78, sourceDocument: 'business_registration.pdf', confirmed: false },
    { fieldName: 'Insurance Policy Number', extractedValue: 'PLI-88213-NG', confidence: 91, sourceDocument: 'insurance_policy.pdf', confirmed: false }
  ],
  proposedRiskClassification: RiskLevel.MEDIUM,
  riskReasoning: [
    'No prior trading history with the marketplace (new applicant)',
    'All submitted documents verified as authentic with high OCR confidence',
    'Registered address could not be cross-matched against a third-party business registry',
    'Category (Cold Chain Logistics) carries moderate baseline risk due to compliance-sensitive handling requirements'
  ],
  overallExtractionConfidence: 90,
  status: 'AWAITING_CONFIRMATION'
};

// ============================================================
// PENDING VENDOR STORE — shared in-memory bridge between the
// Vendor Portal and the Vendor Management side so that portal
// submissions appear in the Approval Queue even when the backend
// API is unavailable (dev / mock mode).  The store also persists
// to localStorage so entries survive a page refresh.
// ============================================================

export class PendingVendorStore {
  private static readonly STORAGE_KEY = 'erp_pending_vendors';
  private static store: Map<number, Vendor> = PendingVendorStore.rehydrate();

  private static rehydrate(): Map<number, Vendor> {
    try {
      const raw = localStorage.getItem(PendingVendorStore.STORAGE_KEY);
      if (!raw) return new Map();
      const arr: Vendor[] = JSON.parse(raw);
      return new Map(arr.map(v => [v.id, v]));
    } catch {
      return new Map();
    }
  }

  private static persist(): void {
    try {
      localStorage.setItem(
        PendingVendorStore.STORAGE_KEY,
        JSON.stringify(Array.from(PendingVendorStore.store.values()))
      );
    } catch { /* ignore quota errors */ }
  }

  static add(vendor: Vendor): void {
    PendingVendorStore.store.set(vendor.id, vendor);
    PendingVendorStore.persist();
  }

  static getAll(): Vendor[] {
    return Array.from(PendingVendorStore.store.values());
  }

  static getById(id: number): Vendor | undefined {
    return PendingVendorStore.store.get(id);
  }

  static updateStatus(id: number, status: VendorStatus): Vendor | null {
    const vendor = PendingVendorStore.store.get(id);
    if (!vendor) return null;
    const updated: Vendor = { ...vendor, status, updatedAt: new Date() };
    PendingVendorStore.store.set(id, updated);
    PendingVendorStore.persist();
    return updated;
  }

  static remove(id: number): void {
    PendingVendorStore.store.delete(id);
    PendingVendorStore.persist();
  }

  static clear(): void {
    PendingVendorStore.store.clear();
    localStorage.removeItem(PendingVendorStore.STORAGE_KEY);
  }
}

export class TenantVendorApprovalStore {
  private static readonly STORAGE_KEY = 'erp_tenant_vendor_approvals';
  private static store: Map<string, Map<string, VendorStatus>> = TenantVendorApprovalStore.rehydrate();

  private static rehydrate(): Map<string, Map<string, VendorStatus>> {
    try {
      const raw = localStorage.getItem(TenantVendorApprovalStore.STORAGE_KEY);
      if (!raw) return new Map();
      const parsed: Record<string, Record<string, VendorStatus>> = JSON.parse(raw);
      const newStore = new Map<string, Map<string, VendorStatus>>();
      for (const [tenantId, approvals] of Object.entries(parsed)) {
        newStore.set(tenantId, new Map(Object.entries(approvals)));
      }
      return newStore;
    } catch {
      return new Map();
    }
  }

  private static persist(): void {
    try {
      const obj: Record<string, Record<string, VendorStatus>> = {};
      for (const [tenantId, innerMap] of TenantVendorApprovalStore.store.entries()) {
        obj[tenantId] = Object.fromEntries(innerMap.entries());
      }
      localStorage.setItem(TenantVendorApprovalStore.STORAGE_KEY, JSON.stringify(obj));
    } catch { /* ignore */ }
  }

  static getStatus(tenantId: string, vendorId: string): VendorStatus | null {
    const tenantMap = TenantVendorApprovalStore.store.get(tenantId);
    return tenantMap ? tenantMap.get(vendorId) || null : null;
  }

  static setStatus(tenantId: string, vendorId: string, status: VendorStatus): void {
    if (!TenantVendorApprovalStore.store.has(tenantId)) {
      TenantVendorApprovalStore.store.set(tenantId, new Map());
    }
    TenantVendorApprovalStore.store.get(tenantId)!.set(vendorId, status);
    TenantVendorApprovalStore.persist();
  }

  static clear(): void {
    TenantVendorApprovalStore.store.clear();
    localStorage.removeItem(TenantVendorApprovalStore.STORAGE_KEY);
  }
}

// ============================================================
// VENDOR SERVICE
// ============================================================

@Injectable({
  providedIn: 'root'
})
export class VendorService {

  private readonly baseUrl = environment.apiBaseUrl + '/x/api/v2/commerce';

  // ============================================================
  // TENANT ID HELPER
  // ============================================================

  private readonly useMockData: boolean = false;

  private get tenantId(): string {
    return 'optimax';
  }

  // ============================================================
  // STATE MANAGEMENT (BehaviorSubjects)
  // ============================================================

  private vendorsSubject = new BehaviorSubject<Vendor[]>([]);
  vendors$ = this.vendorsSubject.asObservable();

  private selectedVendorSubject = new BehaviorSubject<Vendor | null>(null);
  selectedVendor$ = this.selectedVendorSubject.asObservable();

  private dashboardStatsSubject = new BehaviorSubject<VendorDashboardStats | null>(null);
  dashboardStats$ = this.dashboardStatsSubject.asObservable();

  private loadingSubject = new BehaviorSubject<boolean>(false);
  loading$ = this.loadingSubject.asObservable();

  private errorSubject = new BehaviorSubject<string | null>(null);
  error$ = this.errorSubject.asObservable();

  // ============================================================
  // MOCK DATA INSIDE THE CLASS
  // ============================================================

  private readonly MOCK_DASHBOARD_STATS: VendorDashboardStats = {
    totalVendors: 145,
    activeVendors: 120,
    pendingOnboarding: 15,
    pendingReview: 10,
    highRiskVendors: 5,
    expiringDocuments: 12,
    averagePerformanceScore: 92.5,
    vendorsByTier: {
      preferred: 40,
      approved: 70,
      conditional: 35
    },
    recentActivity: [
      {
        id: 1,
        vendorId: '101',
        vendorName: 'TechCorp Solutions',
        event: 'Onboarding completed',
        description: 'Vendor profile was approved and moved to active status.',
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
        type: 'ONBOARDING',
        icon: 'fa-user-check',
        color: '#2EB270'
      },
      {
        id: 2,
        vendorId: '204',
        vendorName: 'Vanguard Security Services',
        event: 'Risk alert raised',
        description: 'A performance decline alert was triggered for this vendor.',
        timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000),
        type: 'RISK',
        icon: 'fa-exclamation-triangle',
        color: '#F59E0B'
      }
    ],
    expiringDocumentsList: [
      {
        id: 1,
        category: DocumentCategory.REGISTRATION,
        name: 'Business Registration',
        fileName: 'registration.pdf',
        fileUrl: '#',
        fileSize: 2048,
        fileType: 'pdf',
        issueDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 12 * 24 * 60 * 60 * 1000),
        status: DocumentStatus.EXPIRING_SOON,
        isRequired: true,
        daysUntilExpiry: 12,
        uploadedAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        uploadedBy: 'Ops Team',
        vendorId: '102',
        vendorName: 'Global Logistics Ltd'
      } as VendorDocument,
      {
        id: 2,
        category: DocumentCategory.INSURANCE,
        name: 'Insurance Certificate',
        fileName: 'insurance.pdf',
        fileUrl: '#',
        fileSize: 1536,
        fileType: 'pdf',
        issueDate: new Date(Date.now() - 180 * 24 * 60 * 60 * 1000),
        expiryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        status: DocumentStatus.EXPIRING_SOON,
        isRequired: false,
        daysUntilExpiry: 5,
        uploadedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        uploadedBy: 'Compliance',
        vendorId: '101',
        vendorName: 'TechCorp Solutions'
      } as VendorDocument
    ],
    topPerformers: [
      {
        id: 101,
        companyName: 'TechCorp Solutions',
        registrationNumber: 'RC1029384',
        taxId: 'TIN-483920',
        email: 'contact@techcorp.com',
        phone: '+2348012345678',
        status: VendorStatus.ACTIVE,
        tier: VendorTier.PREFERRED,
        riskLevel: RiskLevel.LOW,
        performanceScore: 95.4,
        totalProjects: 42,
        winRate: 65,
        averageRating: 4.8,
        categories: ['IT Services', 'Hardware'],
        address: { street: '12 Tech Ave', city: 'Lagos', state: 'Lagos', country: 'Nigeria', postalCode: '100001' },
        createdAt: new Date(),
        updatedAt: new Date(),
        contacts: [],
        documents: [],
        complianceStatus: {
          isCompliant: true,
          documentsVerified: 5,
          totalRequiredDocuments: 5,
          expiredDocuments: 0,
          expiringDocuments: 0,
          lastComplianceCheck: new Date(),
          sanctionsClear: true
        },
        performanceMetrics: {
          overallScore: 95.4,
          onTimeDeliveryRate: 98,
          qualityScore: 94,
          costCompetitiveness: 90,
          complianceScore: 97,
          ratingScore: 95,
          winRate: 65,
          totalProjects: 42,
          totalRevenue: 12500000,
          averageOrderValue: 297619,
          lastUpdated: new Date(),
          trendData: []
        },
        lifecycleHistory: [],
        riskAlerts: [],
        joinedDate: new Date(),
        lastActivityDate: new Date()
      } as unknown as Vendor,
      {
        id: 203,
        companyName: 'Apex Industrial Supplies Ltd',
        registrationNumber: 'RC7765421',
        taxId: 'TIN-332198',
        email: 'sales@apex.com',
        phone: '+2348123456789',
        status: VendorStatus.ACTIVE,
        tier: VendorTier.APPROVED,
        riskLevel: RiskLevel.LOW,
        performanceScore: 92.8,
        totalProjects: 28,
        winRate: 61,
        averageRating: 4.6,
        categories: ['Manufacturing'],
        address: { street: '88 Factory Rd', city: 'Abuja', state: 'FCT', country: 'Nigeria', postalCode: '900001' },
        createdAt: new Date(),
        updatedAt: new Date(),
        contacts: [],
        documents: [],
        complianceStatus: {
          isCompliant: true,
          documentsVerified: 5,
          totalRequiredDocuments: 5,
          expiredDocuments: 0,
          expiringDocuments: 0,
          lastComplianceCheck: new Date(),
          sanctionsClear: true
        },
        performanceMetrics: {
          overallScore: 92.8,
          onTimeDeliveryRate: 95,
          qualityScore: 91,
          costCompetitiveness: 89,
          complianceScore: 94,
          ratingScore: 93,
          winRate: 61,
          totalProjects: 28,
          totalRevenue: 8500000,
          averageOrderValue: 303571,
          lastUpdated: new Date(),
          trendData: []
        },
        lifecycleHistory: [],
        riskAlerts: [],
        joinedDate: new Date(),
        lastActivityDate: new Date()
      } as unknown as Vendor
    ],
    riskAlertsCount: 8,
    monthOverMonthGrowth: 4.5
  };

  private readonly MOCK_VENDORS: Vendor[] = [
    {
      id: 101,
      companyName: 'TechCorp Solutions',
      registrationNumber: 'RC1029384',
      taxId: 'TIN-483920',
      email: 'contact@techcorp.com',
      phone: '+2348012345678',
      status: VendorStatus.ACTIVE,
      tier: VendorTier.PREFERRED,
      riskLevel: RiskLevel.LOW,
      performanceScore: 95.4,
      totalProjects: 42,
      winRate: 65,
      averageRating: 4.8,
      categories: ['IT Services', 'Hardware'],
      address: { street: '12 Tech Ave', city: 'Lagos', state: 'Lagos', country: 'Nigeria', postalCode: '100001' },
      contacts: [], documents: [],
      complianceStatus: { isCompliant: true, documentsVerified: 5, totalRequiredDocuments: 5, expiredDocuments: 0, expiringDocuments: 0, lastComplianceCheck: new Date(), sanctionsClear: true },
      performanceMetrics: { overallScore: 95.4, onTimeDeliveryRate: 98, qualityScore: 94, costCompetitiveness: 90, complianceScore: 97, ratingScore: 95, winRate: 65, totalProjects: 42, totalRevenue: 12500000, averageOrderValue: 297619, lastUpdated: new Date(), trendData: [] },
      lifecycleHistory: [], riskAlerts: [],
      joinedDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      lastActivityDate: new Date(),
      createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    } as Vendor,
    {
      id: 102,
      companyName: 'Global Logistics Ltd',
      registrationNumber: 'RC5544332',
      taxId: 'TIN-994823',
      email: 'info@globallogistics.com',
      phone: '+2348099887766',
      status: VendorStatus.PENDING_ONBOARDING,
      tier: VendorTier.CONDITIONAL,
      riskLevel: RiskLevel.MEDIUM,
      performanceScore: 0,
      totalProjects: 0,
      winRate: 0,
      averageRating: 0,
      categories: ['Logistics', 'Supply Chain'],
      address: { street: '45 Trade Rd', city: 'Abuja', state: 'FCT', country: 'Nigeria', postalCode: '900001' },
      contacts: [], documents: [],
      complianceStatus: { isCompliant: false, documentsVerified: 2, totalRequiredDocuments: 5, expiredDocuments: 0, expiringDocuments: 0, lastComplianceCheck: new Date(), sanctionsClear: true },
      performanceMetrics: { overallScore: 0, onTimeDeliveryRate: 0, qualityScore: 0, costCompetitiveness: 0, complianceScore: 0, ratingScore: 0, winRate: 0, totalProjects: 0, totalRevenue: 0, averageOrderValue: 0, lastUpdated: new Date(), trendData: [] },
      lifecycleHistory: [], riskAlerts: [],
      joinedDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      lastActivityDate: new Date(),
      createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    } as Vendor,
    {
      id: 103,
      companyName: 'Meridian Cold Storage Ltd',
      registrationNumber: 'RC8876543',
      taxId: 'TIN-112233',
      email: 'admin@meridiancs.com',
      phone: '+2348077665544',
      status: VendorStatus.UNDER_REVIEW,
      tier: VendorTier.APPROVED,
      riskLevel: RiskLevel.MEDIUM,
      performanceScore: 0,
      totalProjects: 0,
      winRate: 0,
      averageRating: 0,
      categories: ['Cold Chain', 'Logistics'],
      address: { street: '22 Freight Lane', city: 'Lagos', state: 'Lagos', country: 'Nigeria', postalCode: '100003' },
      contacts: [], documents: [],
      complianceStatus: { isCompliant: false, documentsVerified: 4, totalRequiredDocuments: 5, expiredDocuments: 0, expiringDocuments: 0, lastComplianceCheck: new Date(), sanctionsClear: true },
      performanceMetrics: { overallScore: 0, onTimeDeliveryRate: 0, qualityScore: 0, costCompetitiveness: 0, complianceScore: 0, ratingScore: 0, winRate: 0, totalProjects: 0, totalRevenue: 0, averageOrderValue: 0, lastUpdated: new Date(), trendData: [] },
      lifecycleHistory: [], riskAlerts: [],
      joinedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      lastActivityDate: new Date(),
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    } as Vendor,
    {
      id: 204,
      companyName: 'Vanguard Security Services',
      registrationNumber: 'RC2034567',
      taxId: 'TIN-567890',
      email: 'ops@vanguardsecurity.com',
      phone: '+2348056789012',
      status: VendorStatus.ACTIVE,
      tier: VendorTier.APPROVED,
      riskLevel: RiskLevel.MEDIUM,
      performanceScore: 79.0,
      totalProjects: 18,
      winRate: 55,
      averageRating: 4.1,
      categories: ['Security', 'Facility Management'],
      address: { street: '34 Guard Lane', city: 'Lagos', state: 'Lagos', country: 'Nigeria', postalCode: '100002' },
      contacts: [], documents: [],
      complianceStatus: { isCompliant: true, documentsVerified: 5, totalRequiredDocuments: 5, expiredDocuments: 0, expiringDocuments: 0, lastComplianceCheck: new Date(), sanctionsClear: true },
      performanceMetrics: { overallScore: 79.0, onTimeDeliveryRate: 79, qualityScore: 80, costCompetitiveness: 75, complianceScore: 82, ratingScore: 80, winRate: 55, totalProjects: 18, totalRevenue: 5400000, averageOrderValue: 300000, lastUpdated: new Date(), trendData: [] },
      lifecycleHistory: [], riskAlerts: [],
      joinedDate: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      lastActivityDate: new Date(),
      createdAt: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    } as Vendor,
    {
      id: 233,
      companyName: 'Northbridge Cold Chain Logistics',
      registrationNumber: 'RC3344556',
      taxId: 'TIN-778899',
      email: 'logistics@northbridge.com',
      phone: '+2348034567890',
      status: VendorStatus.ACTIVE,
      tier: VendorTier.APPROVED,
      riskLevel: RiskLevel.LOW,
      performanceScore: 88.5,
      totalProjects: 31,
      winRate: 60,
      averageRating: 4.4,
      categories: ['Logistics', 'Cold Chain', 'Warehousing'],
      address: { street: '7 Cold Storage Ave', city: 'Port Harcourt', state: 'Rivers', country: 'Nigeria', postalCode: '500001' },
      contacts: [], documents: [],
      complianceStatus: { isCompliant: true, documentsVerified: 5, totalRequiredDocuments: 5, expiredDocuments: 0, expiringDocuments: 1, lastComplianceCheck: new Date(), sanctionsClear: true },
      performanceMetrics: { overallScore: 88.5, onTimeDeliveryRate: 90, qualityScore: 87, costCompetitiveness: 84, complianceScore: 88, ratingScore: 89, winRate: 60, totalProjects: 31, totalRevenue: 9300000, averageOrderValue: 300000, lastUpdated: new Date(), trendData: [] },
      lifecycleHistory: [], riskAlerts: [],
      joinedDate: new Date(Date.now() - 280 * 24 * 60 * 60 * 1000),
      lastActivityDate: new Date(),
      createdAt: new Date(Date.now() - 280 * 24 * 60 * 60 * 1000),
      updatedAt: new Date()
    } as Vendor
  ];

  // ADD THIS - Mock performance metrics inside the class
  private readonly MOCK_PERFORMANCE_METRICS: VendorPerformanceMetrics = {
    overallScore: 87.5,
    onTimeDeliveryRate: 92,
    qualityScore: 85,
    costCompetitiveness: 78,
    complianceScore: 94,
    ratingScore: 4.5,
    winRate: 68,
    totalProjects: 42,
    totalRevenue: 12500000,
    averageOrderValue: 297619,
    lastUpdated: new Date(),
    trendData: [
      { period: 'Aug 2025', score: 78, onTimeDelivery: 82, quality: 75 },
      { period: 'Sep 2025', score: 80, onTimeDelivery: 85, quality: 78 },
      { period: 'Oct 2025', score: 83, onTimeDelivery: 88, quality: 80 },
      { period: 'Nov 2025', score: 85, onTimeDelivery: 90, quality: 82 },
      { period: 'Dec 2025', score: 86, onTimeDelivery: 91, quality: 84 },
      { period: 'Jan 2026', score: 88, onTimeDelivery: 93, quality: 86 },
      { period: 'Feb 2026', score: 87, onTimeDelivery: 92, quality: 85 },
      { period: 'Mar 2026', score: 90, onTimeDelivery: 94, quality: 88 },
      { period: 'Apr 2026', score: 92, onTimeDelivery: 95, quality: 90 },
      { period: 'May 2026', score: 91, onTimeDelivery: 94, quality: 89 },
      { period: 'Jun 2026', score: 93, onTimeDelivery: 96, quality: 91 },
      { period: 'Jul 2026', score: 95, onTimeDelivery: 97, quality: 93 }
    ]
  };



  private readonly MOCK_RISK_ALERTS: RiskAlert[] = [
    {
      id: 1,
      vendorId: '101',
      severity: AlertSeverity.CRITICAL,
      type: 'COMPLIANCE',
      title: 'Expired Insurance Certificate',
      description: 'The vendor\'s insurance certificate has expired. Immediate action required.',
      detectedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
      status: 'OPEN',
      actionRequired: true,
      assignedTo: 'Compliance Team'
    },
    {
      id: 2,
      vendorId: '101',
      severity: AlertSeverity.WARNING,
      type: 'PERFORMANCE',
      title: 'Performance Decline Detected',
      description: 'On-time delivery rate dropped below 90% in the last 30 days.',
      detectedAt: new Date(Date.now() - 5 * 60 * 60 * 1000),
      status: 'IN_PROGRESS',
      actionRequired: true
    },
    {
      id: 3,
      vendorId: '101',
      severity: AlertSeverity.INFO,
      type: 'DOCUMENT',
      title: 'Document Renewal Reminder',
      description: 'Business registration certificate expires in 30 days.',
      detectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'OPEN',
      actionRequired: false
    },
    // Add alerts for other vendors
    {
      id: 4,
      vendorId: '102',
      severity: AlertSeverity.WARNING,
      type: 'COMPLIANCE',
      title: 'Missing Tax Certificate',
      description: 'Tax certificate has not been uploaded for this vendor.',
      detectedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      status: 'OPEN',
      actionRequired: true,
      assignedTo: 'Compliance Team'
    },
    {
      id: 5,
      vendorId: '203',
      severity: AlertSeverity.INFO,
      type: 'DOCUMENT',
      title: 'Document Review Required',
      description: 'Operating license needs to be reviewed for renewal.',
      detectedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      status: 'OPEN',
      actionRequired: false
    }
  ];

  // vendor-management.service.ts - Add this inside the VendorService class

  private readonly MOCK_DOCUMENTS: VendorDocument[] = [
    {
      id: 1,
      vendorId: '101',
      category: DocumentCategory.REGISTRATION,
      name: 'Business Registration Certificate',
      fileName: 'business_registration_v101.pdf',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 2457600,
      fileType: 'application/pdf',
      issueDate: new Date('2024-01-15'),
      expiryDate: new Date('2027-01-14'),
      status: DocumentStatus.ACTIVE,
      isRequired: true,
      daysUntilExpiry: 162,
      uploadedAt: new Date('2024-01-20'),
      uploadedBy: 'Vendor User'
    },
    {
      id: 2,
      vendorId: '101',
      category: DocumentCategory.TAX,
      name: 'Tax Certificate (TIN)',
      fileName: 'tax_certificate_v101.pdf',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 1843200,
      fileType: 'application/pdf',
      issueDate: new Date('2024-02-01'),
      expiryDate: new Date('2027-01-31'),
      status: DocumentStatus.ACTIVE,
      isRequired: true,
      daysUntilExpiry: 159,
      uploadedAt: new Date('2024-02-05'),
      uploadedBy: 'Vendor User'
    },
    {
      id: 3,
      vendorId: '101',
      category: DocumentCategory.LICENCE,
      name: 'Business Operating Licence',
      fileName: 'operating_licence_v101.pdf',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 3072000,
      fileType: 'application/pdf',
      issueDate: new Date('2023-06-01'),
      expiryDate: new Date('2024-11-30'),
      status: DocumentStatus.EXPIRING_SOON,
      isRequired: true,
      daysUntilExpiry: 28,
      uploadedAt: new Date('2023-06-10'),
      uploadedBy: 'Vendor User'
    },
    {
      id: 4,
      vendorId: '101',
      category: DocumentCategory.INSURANCE,
      name: 'Public Liability Insurance',
      fileName: 'insurance_policy_v101.pdf',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 1560000,
      fileType: 'application/pdf',
      issueDate: new Date('2023-08-15'),
      expiryDate: new Date('2024-08-14'),
      status: DocumentStatus.EXPIRED,
      isRequired: false,
      daysUntilExpiry: -5,
      uploadedAt: new Date('2023-08-20'),
      uploadedBy: 'Vendor User'
    },
    {
      id: 5,
      vendorId: '101',
      category: DocumentCategory.CERTIFICATION,
      name: 'ISO 9001 Certification',
      fileName: 'iso_certification_v101.pdf',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 2048000,
      fileType: 'application/pdf',
      issueDate: new Date('2024-03-01'),
      expiryDate: new Date('2025-03-01'),
      status: DocumentStatus.PENDING_VERIFICATION,
      isRequired: false,
      daysUntilExpiry: 210,
      uploadedAt: new Date('2024-03-05'),
      uploadedBy: 'Vendor User'
    },
    {
      id: 6,
      vendorId: '102',
      category: DocumentCategory.REGISTRATION,
      name: 'Business Registration Certificate',
      fileName: 'business_registration_v102.pdf',
      fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
      fileSize: 2355200,
      fileType: 'application/pdf',
      issueDate: new Date('2024-02-10'),
      expiryDate: new Date('2027-02-09'),
      status: DocumentStatus.ACTIVE,
      isRequired: true,
      daysUntilExpiry: 175,
      uploadedAt: new Date('2024-02-15'),
      uploadedBy: 'Vendor User'
    }
  ];

  private readonly MOCK_LIFECYCLE_HISTORY: VendorLifecycleHistory[] = [
    {
      id: 1,
      vendorId: '101',
      event: VendorLifecycleEvent.APPLIED,
      description: 'Vendor application submitted via the Vendor Portal',
      performedBy: 'Vendor User',
      timestamp: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      metadata: { source: 'portal', applicationId: 'APP-2026-001' }
    },
    {
      id: 2,
      vendorId: '101',
      event: VendorLifecycleEvent.DOCUMENTS_SUBMITTED,
      description: 'Business registration, tax certificate, and operating licence uploaded',
      performedBy: 'Vendor User',
      timestamp: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000),
      metadata: { documents: ['registration.pdf', 'tax.pdf', 'licence.pdf'] }
    },
    {
      id: 3,
      vendorId: '101',
      event: VendorLifecycleEvent.UNDER_REVIEW,
      description: 'Application moved to under review by procurement team',
      performedBy: 'A. Okoro (Procurement Lead)',
      timestamp: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000),
      metadata: { assignedTo: 'A. Okoro' }
    },
    {
      id: 4,
      vendorId: '101',
      event: VendorLifecycleEvent.APPROVED,
      description: 'Vendor application approved after document verification',
      performedBy: 'A. Okoro (Procurement Lead)',
      timestamp: new Date(Date.now() - 22 * 24 * 60 * 60 * 1000),
      metadata: { approvedBy: 'A. Okoro', notes: 'All documents verified successfully' }
    },
    {
      id: 5,
      vendorId: '101',
      event: VendorLifecycleEvent.ACTIVATED,
      description: 'Vendor account activated in the marketplace',
      performedBy: 'System',
      timestamp: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000),
      metadata: { status: 'ACTIVE' }
    },
    {
      id: 6,
      vendorId: '101',
      event: VendorLifecycleEvent.PERFORMANCE_UPDATE,
      description: 'Performance score updated to 95.4% - Vendor upgraded to Preferred Tier',
      performedBy: 'Sentinel AI',
      timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
      metadata: { oldScore: 88, newScore: 95.4, oldTier: 'APPROVED', newTier: 'PREFERRED' }
    },
    {
      id: 7,
      vendorId: '101',
      event: VendorLifecycleEvent.DOCUMENT_VERIFIED,
      description: 'Insurance certificate verified and approved',
      performedBy: 'D. Balogun (Compliance)',
      timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
      metadata: { documentId: 'doc-insurance-101', status: 'VERIFIED' }
    },
    {
      id: 8,
      vendorId: '101',
      event: VendorLifecycleEvent.RISK_ALERT,
      description: 'Performance decline alert triggered - On-time delivery rate dropped below 90%',
      performedBy: 'Sentinel AI',
      timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
      metadata: { alertId: 'alert-101', type: 'PERFORMANCE_DECLINE', severity: 'WARNING' }
    }
  ];


  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(private http: HttpClient) { }

  // ============================================================
  // DASHBOARD
  // ============================================================

  getDashboardStats(): Observable<VendorDashboardStats> {
    this.loadingSubject.next(true);
    this.errorSubject.next(null);

    return this.http.get<VendorDashboardStats>(`${this.baseUrl}/vendor-management/dashboard/stats`)
      .pipe(
        tap(stats => {
          this.dashboardStatsSubject.next(stats);
          this.loadingSubject.next(false);
        }),
        catchError(err => {
          this.loadingSubject.next(false);
          this.dashboardStatsSubject.next(this.MOCK_DASHBOARD_STATS);
          return of(this.MOCK_DASHBOARD_STATS);
        })
      );
  }

  getRecentActivity(limit: number = 10): Observable<any[]> {
    return of([] as any[]);
  }

  // ============================================================
  // FIELD MAPPING — normalises raw API response to Vendor interface
  // ============================================================

  private mapVendor(raw: any): Vendor {
    const performanceScore = raw.performanceScore ?? raw.performance_score ?? raw.score ?? 0;
    const totalProjects = raw.totalProjects ?? raw.total_projects ?? raw.projectCount ?? 0;
    return {
      id: raw.id || raw._id || raw.vendorId || '',
      companyName: raw.companyName || raw.company_name || raw.name || raw.company || `Pending Registration (ID: ${raw.id || 'N/A'})`,
      registrationNumber: raw.registrationNumber || raw.registration_number || raw.regNumber || raw.rc_number || 'Pending',
      taxId: raw.taxId || raw.tax_id || raw.tin || raw.taxNumber || 'Pending',
      email: raw.email || raw.emailAddress || raw.email_address || 'Pending',
      phone: raw.phone || raw.phoneNumber || raw.phone_number || raw.mobile || 'Pending',
      website: raw.website || raw.websiteUrl || raw.web_site || undefined,
      address: raw.address || { street: '', city: '', state: '', country: 'Nigeria', postalCode: '' },
      status: (() => {
        const s = raw.status || raw.vendorStatus;
        return (s === 'DRAFT' || !s) ? VendorStatus.PENDING_ONBOARDING : s as VendorStatus;
      })(),
      tier: (raw.tier || raw.vendorTier || VendorTier.APPROVED) as VendorTier,
      riskLevel: (raw.riskLevel || raw.risk_level || raw.risk || RiskLevel.LOW) as RiskLevel,
      performanceScore,
      totalProjects,
      winRate: raw.winRate ?? raw.win_rate ?? 0,
      averageRating: raw.averageRating ?? raw.average_rating ?? raw.rating ?? 0,
      joinedDate: parseSafeDate(raw.joinedDate || raw.createdAt),
      lastActivityDate: parseSafeDate(raw.lastActivityDate || raw.updatedAt),
      categories: Array.isArray(raw.categories) ? raw.categories : [],
      logo: raw.logo || raw.logoUrl || undefined,
      description: raw.description || '',
      paymentTerms: raw.paymentTerms || raw.payment_terms || 'Net 30',
      bankDetails: raw.bankDetails || raw.bank_details || undefined,
      contacts: Array.isArray(raw.contacts) ? raw.contacts : [],
      documents: Array.isArray(raw.documents) ? raw.documents : [],
      complianceStatus: raw.complianceStatus || raw.compliance_status || {
        isCompliant: true, documentsVerified: 0, totalRequiredDocuments: 0,
        expiredDocuments: 0, expiringDocuments: 0, lastComplianceCheck: new Date(), sanctionsClear: true
      },
      performanceMetrics: raw.performanceMetrics || raw.performance_metrics || {
        overallScore: performanceScore, onTimeDeliveryRate: 0, qualityScore: 0,
        costCompetitiveness: 0, complianceScore: 0, ratingScore: 0,
        winRate: raw.winRate ?? 0, totalProjects,
        totalRevenue: raw.totalRevenue ?? raw.total_revenue ?? 0,
        averageOrderValue: 0, lastUpdated: new Date(), trendData: []
      },
      lifecycleHistory: Array.isArray(raw.lifecycleHistory) ? raw.lifecycleHistory : [],
      riskAlerts: Array.isArray(raw.riskAlerts) ? raw.riskAlerts : [],
      createdAt: parseSafeDate(raw.createdAt),
      updatedAt: parseSafeDate(raw.updatedAt),
      applicationNumber: raw.applicationNumber || raw.application_number || undefined,
      // The backend was originally POSTed the full 6-step registration payload
      // (see VendorRegistrationService.submit) — preserve it here too if the
      // GET response still carries it, under either shape.
      registration: raw.registration || (raw.step1 ? {
        id: raw.id, applicationNumber: raw.applicationNumber, status: raw.registrationStatus || raw.status,
        submittedDate: raw.submittedDate, lastModified: raw.updatedAt,
        step1: raw.step1, step2: raw.step2, step3: raw.step3,
        step4: raw.step4, step5: raw.step5, step6: raw.step6,
      } : undefined),
    } as Vendor;
  }

  // ============================================================
  // VENDOR CRUD OPERATIONS
  // ============================================================

  getVendors(
    page: number = 1,
    limit: number = 20,
    filters?: {
      status?: VendorStatus;
      statuses?: VendorStatus[];
      tier?: VendorTier;
      riskLevel?: RiskLevel;
      search?: string;
      category?: string;
      dateFrom?: string;
      dateTo?: string;
    }
  ): Observable<VendorListResponse> {
    this.loadingSubject.next(true);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', limit.toString());

    if (filters) {
      if (filters.statuses) {
        const statuses = Array.isArray(filters.statuses) ? filters.statuses : [filters.statuses];
        params = params.set('statuses', statuses.join(','));
      } else if (filters.status) {
        params = params.set('status', filters.status);
      }
      if (filters.search) params = params.set('search', filters.search);
      if (filters.tier) params = params.set('tier', filters.tier);
      if (filters.riskLevel) params = params.set('riskLevel', filters.riskLevel);
      if (filters.category) params = params.set('category', filters.category);
      if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
    }

    console.log('[VendorService] getVendors request params:', params.toString(), 'Filters:', filters);

    return this.http.get<any>(`${this.baseUrl}/vendor-management/vendors`, { params })
      .pipe(
        map(res => {
          console.log('[VendorService] getVendors raw response:', res);
          const rawVendors: any[] = Array.isArray(res)
            ? res
            : (res?.vendors ?? res?.data ?? res?.content ?? []);
          const backendVendors: Vendor[] = rawVendors.map(v => this.mapVendor(v));
          console.log('[VendorService] getVendors mapped backend vendors:', backendVendors);

          let finalVendors = backendVendors;

          if (this.useMockData) {
            // Merge backend vendors with mock data and local store data
            const allMock = [
              ...backendVendors,
              ...this.MOCK_VENDORS,
              ...PendingVendorStore.getAll()
            ];
            // Deduplicate by ID - backend and store entries take priority
            const seen = new Set<number>();
            finalVendors = allMock.filter(v => {
              if (!v.id || seen.has(v.id)) return false;
              seen.add(v.id);
              return true;
            });
            console.log('[VendorService] getVendors merged mock data vendors (useMockData=true):', finalVendors);
          }

          // Apply tenant-specific status override
          finalVendors = finalVendors.map(v => {
            const tenantStatus = TenantVendorApprovalStore.getStatus(this.tenantId, String(v.id));
            if (tenantStatus) {
              return { ...v, status: tenantStatus };
            }
            return v;
          });

          // Apply filters
          if (filters?.statuses && Array.isArray(filters.statuses)) {
            finalVendors = finalVendors.filter(v => filters.statuses!.includes(v.status));
            console.log('[VendorService] filtered by statuses:', filters.statuses, 'Count:', finalVendors.length);
          } else if (filters?.status) {
            finalVendors = finalVendors.filter(v => v.status === filters.status);
            console.log('[VendorService] filtered by status:', filters.status, 'Count:', finalVendors.length);
          }

          if (filters?.tier) {
            finalVendors = finalVendors.filter(v => v.tier === filters.tier);
          }

          if (filters?.riskLevel) {
            finalVendors = finalVendors.filter(v => v.riskLevel === filters.riskLevel);
          }

          if (filters?.category) {
            const category = String(filters.category).toLowerCase();
            finalVendors = finalVendors.filter(v => (v.categories || []).some((cat: string) => cat.toLowerCase().includes(category)));
          }

          if (filters?.search) {
            const search = String(filters.search).toLowerCase();
            finalVendors = finalVendors.filter(v =>
              (v.companyName || '').toLowerCase().includes(search) ||
              (v.email || '').toLowerCase().includes(search) ||
              (v.registrationNumber || '').toLowerCase().includes(search)
            );
          }

          console.log('[VendorService] getVendors final visible vendors:', finalVendors);

          const totalCount = res?.total ?? res?.totalCount ?? res?.totalElements ?? finalVendors.length;
          const totalPages = res?.totalPages ?? res?.pages ?? Math.max(Math.ceil(totalCount / limit), 1);
          const listResponse: VendorListResponse = {
            vendors: finalVendors,
            total: totalCount,
            page,
            limit,
            totalPages
          };
          return listResponse;
        }),
        tap(response => {
          this.vendorsSubject.next(response.vendors);
          this.loadingSubject.next(false);
        }),
        catchError(err => {
          console.error('[VendorService] getVendors API failed:', err);
          this.loadingSubject.next(false);
          // Fallback entirely to mock data if API call fails
          const allMock = [
            ...this.MOCK_VENDORS,
            ...PendingVendorStore.getAll()
          ];
          const seen = new Set<number>();
          let fallbackVendors = allMock.filter(v => {
            if (!v.id || seen.has(v.id)) return false;
            seen.add(v.id);
            return true;
          });

          // Apply tenant-specific status override
          fallbackVendors = fallbackVendors.map(v => {
            const tenantStatus = TenantVendorApprovalStore.getStatus(this.tenantId, String(v.id));
            return tenantStatus ? { ...v, status: tenantStatus } : v;
          });

          // Apply filters to fallback list
          if (filters?.statuses && Array.isArray(filters.statuses)) {
            fallbackVendors = fallbackVendors.filter(v => filters.statuses!.includes(v.status));
          } else if (filters?.status) {
            fallbackVendors = fallbackVendors.filter(v => v.status === filters.status);
          }

          if (filters?.tier) {
            fallbackVendors = fallbackVendors.filter(v => v.tier === filters.tier);
          }

          if (filters?.riskLevel) {
            fallbackVendors = fallbackVendors.filter(v => v.riskLevel === filters.riskLevel);
          }

          if (filters?.category) {
            const category = String(filters.category).toLowerCase();
            fallbackVendors = fallbackVendors.filter(v => (v.categories || []).some((cat: string) => cat.toLowerCase().includes(category)));
          }

          if (filters?.search) {
            const search = String(filters.search).toLowerCase();
            fallbackVendors = fallbackVendors.filter(v =>
              (v.companyName || '').toLowerCase().includes(search) ||
              (v.email || '').toLowerCase().includes(search) ||
              (v.registrationNumber || '').toLowerCase().includes(search)
            );
          }

          const listResponse: VendorListResponse = { vendors: fallbackVendors, total: fallbackVendors.length, page, limit, totalPages: 1 };
          this.vendorsSubject.next(fallbackVendors);
          return of(listResponse);
        })
      );
  }

  getVendorById(id: string): Observable<Vendor> {
    this.loadingSubject.next(true);

    // Route params always arrive as strings — Vendor.id is a number, so coerce
    // once here rather than at every comparison below.
    const numericId = Number(id);

    // Check the live cache first, then the shared portal store
    const cachedVendor = this.vendorsSubject.value.find(v => v.id === numericId)
      ?? PendingVendorStore.getById(numericId);
    if (cachedVendor) {
      this.selectedVendorSubject.next(cachedVendor);
      this.loadingSubject.next(false);
      return of(cachedVendor);
    }

    return this.http.get<Vendor>(`${this.baseUrl}/vendor-management/vendors/${id}`)
      .pipe(
        tap(vendor => {
          this.selectedVendorSubject.next(vendor);
          this.loadingSubject.next(false);
        }),
        catchError(err => {
          this.loadingSubject.next(false);
          // Check the portal store first, then fall back to static mocks
          const storeVendor = PendingVendorStore.getById(numericId);
          const fallbackVendor = storeVendor || this.MOCK_VENDORS.find(v => v.id === numericId) || this.MOCK_VENDORS[0];
          if (fallbackVendor) {
            const vendorWithDefaults: Vendor = {
              ...fallbackVendor,
              id: numericId,
              companyName: fallbackVendor.companyName || 'Mock Vendor',
              registrationNumber: fallbackVendor.registrationNumber || 'RC000000',
              taxId: fallbackVendor.taxId || 'TAX-000',
              email: fallbackVendor.email || 'vendor@example.com',
              phone: fallbackVendor.phone || '+2348000000000',
              status: fallbackVendor.status || VendorStatus.ACTIVE,
              tier: fallbackVendor.tier || VendorTier.APPROVED,
              riskLevel: fallbackVendor.riskLevel || RiskLevel.LOW,
              performanceScore: fallbackVendor.performanceScore || 90,
              totalProjects: fallbackVendor.totalProjects || 10,
              winRate: fallbackVendor.winRate || 60,
              averageRating: fallbackVendor.averageRating || 4.5,
              categories: fallbackVendor.categories || ['General'],
              address: fallbackVendor.address || { street: 'N/A', city: 'N/A', state: 'N/A', country: 'Nigeria', postalCode: '000000' },
              contacts: fallbackVendor.contacts || [],
              documents: fallbackVendor.documents || [],
              complianceStatus: fallbackVendor.complianceStatus || {
                isCompliant: true,
                documentsVerified: 3,
                totalRequiredDocuments: 3,
                expiredDocuments: 0,
                expiringDocuments: 0,
                lastComplianceCheck: new Date(),
                sanctionsClear: true
              },
              performanceMetrics: fallbackVendor.performanceMetrics || {
                overallScore: 90,
                onTimeDeliveryRate: 92,
                qualityScore: 90,
                costCompetitiveness: 88,
                complianceScore: 91,
                ratingScore: 90,
                winRate: 60,
                totalProjects: 10,
                totalRevenue: 5000000,
                averageOrderValue: 250000,
                lastUpdated: new Date(),
                trendData: []
              },
              lifecycleHistory: fallbackVendor.lifecycleHistory || [],
              riskAlerts: fallbackVendor.riskAlerts || [],
              createdAt: fallbackVendor.createdAt || new Date(),
              updatedAt: fallbackVendor.updatedAt || new Date(),
              joinedDate: fallbackVendor.joinedDate || new Date(),
              lastActivityDate: fallbackVendor.lastActivityDate || new Date(),
              paymentTerms: fallbackVendor.paymentTerms || 'Net 30',
              bankDetails: fallbackVendor.bankDetails || {
                bankName: 'First Bank',
                accountNumber: '0000000000',
                accountName: 'Vendor Account',
                swiftCode: 'FBNINGLA',
                verified: true
              },
              description: fallbackVendor.description || 'Mock vendor profile loaded locally.'
            } as Vendor;
            this.selectedVendorSubject.next(vendorWithDefaults);
            return of(vendorWithDefaults);
          }
          this.errorSubject.next('Failed to load vendor');
          return throwError(() => err);
        })
      );
  }

  deleteVendor(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/vendors/${id}`).pipe(
      catchError((err) => { console.error('[VendorManagementService] deleteVendor failed:', err); return of(void 0); })
    );
  }

  onboardVendor(data: OnboardingData): Observable<OnboardingResult> {
    this.loadingSubject.next(true);

    const payload = {
      companyName: data.companyName,
      registrationNumber: data.registrationNumber,
      taxId: data.taxId,
      email: data.email,
      phone: data.phone,
      website: data.website ?? null,
      address: data.address,
      categories: data.categories,
      contacts: data.contacts,
      description: data.description ?? null,
      paymentTerms: data.paymentTerms ?? null,
      tenantId: this.tenantId
    };

    return this.http.post<OnboardingResult>(`${this.baseUrl}/vendors`, payload)
      .pipe(
        tap(() => {
          this.loadingSubject.next(false);
          this.getVendors(1, 20).subscribe();
        }),
        catchError(err => {
          this.loadingSubject.next(false);
          this.errorSubject.next('Failed to onboard vendor');
          return throwError(() => err);
        })
      );
  }

  updateVendor(id: string, data: Partial<Vendor>): Observable<Vendor> {
    this.loadingSubject.next(true);

    return this.http.put<Vendor>(`${this.baseUrl}/vendors/${id}/step1`, data)
      .pipe(
        tap(vendor => {
          this.selectedVendorSubject.next(vendor);
          this.loadingSubject.next(false);
          this.updateVendorInList(vendor);
        }),
        catchError(err => {
          this.loadingSubject.next(false);
          this.errorSubject.next('Failed to update vendor');
          return throwError(() => err);
        })
      );
  }

  offboardVendor(id: string, data: OffboardingData): Observable<any> {
    this.loadingSubject.next(true);

    const payload = {
      status: VendorStatus.SUSPENDED,
      rejectionReason: (data as any).reason ?? (data as any).offboardingReason ?? null
    };

    return this.http.patch(`${this.baseUrl}/vendors/${id}/review`, payload)
      .pipe(
        tap(() => {
          this.loadingSubject.next(false);
          this.getVendors(1, 20).subscribe();
        }),
        catchError(err => {
          this.loadingSubject.next(false);
          this.errorSubject.next('Failed to offboard vendor');
          return throwError(() => err);
        })
      );
  }

  updateVendorStatus(id: string, status: VendorStatus): Observable<Vendor> {
    // Route params always arrive as strings — Vendor.id is a number, so coerce
    // once here rather than at every comparison below. `id` (string) is kept
    // for the HTTP URL and the tenant-approval store, which is keyed by string.
    const numericId = Number(id);

    return this.http.patch<Vendor>(`${this.baseUrl}/vendor-management/vendors/${id}/status`, { status })
      .pipe(
        map(raw => this.mapVendor(raw)),
        tap(vendor => {
          this.selectedVendorSubject.next(vendor);
          this.updateVendorInList(vendor);
          // Sync the status change into the shared store so both sides stay consistent
          PendingVendorStore.updateStatus(numericId, status);
          TenantVendorApprovalStore.setStatus(this.tenantId, id, status);
        }),
        catchError(() => {
          // Mock fallback — update the shared store and emit the changed vendor
          TenantVendorApprovalStore.setStatus(this.tenantId, id, status);
          const updated = PendingVendorStore.updateStatus(numericId, status);
          if (updated) {
            const tenantUpdated = { ...updated, status };
            this.updateVendorInList(tenantUpdated);
            this.selectedVendorSubject.next(tenantUpdated);
            return of(tenantUpdated);
          }
          // Vendor might only be in MOCK_VENDORS — patch it inline
          const mockIdx = (this.MOCK_VENDORS as Vendor[]).findIndex(v => v.id === numericId);
          if (mockIdx !== -1) {
            const patched: Vendor = { ...(this.MOCK_VENDORS as Vendor[])[mockIdx], status, updatedAt: new Date() };
            (this.MOCK_VENDORS as Vendor[])[mockIdx] = patched;
            this.updateVendorInList(patched);
            return of(patched);
          }
          this.errorSubject.next('Failed to update vendor status');
          return throwError(() => new Error('Vendor not found in local store'));
        })
      );
  }

  // ============================================================
  // PERFORMANCE
  // ============================================================

  /**
   * The real performance endpoint returns VendorPerformanceMetrics directly —
   * kpis/ranking aren't part of the API contract, so they're derived here
   * client-side (kpis purely for display, ranking as a best-effort estimate
   * since the backend doesn't expose a vendor's rank among peers).
   */
  private buildPerformanceResponse(metrics: VendorPerformanceMetrics, vendorId: string): VendorPerformanceResponse {
    return {
      metrics,
      kpis: [
        { label: 'Overall Score', value: metrics.overallScore, unit: '%', color: '#2EB270', icon: 'fa-chart-line', trend: 'up', percentChange: 3.2 },
        { label: 'On-Time Delivery', value: metrics.onTimeDeliveryRate, unit: '%', color: '#2EB270', icon: 'fa-clock', trend: 'up', percentChange: 1.5 },
        { label: 'Quality Score', value: metrics.qualityScore, unit: '%', color: '#F5A623', icon: 'fa-star', trend: 'up', percentChange: 2.1 },
        { label: 'Cost Competitiveness', value: metrics.costCompetitiveness, unit: '%', color: '#F97316', icon: 'fa-tags', trend: 'stable', percentChange: 0.5 },
        { label: 'Compliance Score', value: metrics.complianceScore, unit: '%', color: '#2EB270', icon: 'fa-shield-alt', trend: 'up', percentChange: 4.8 },
        { label: 'Rating Score', value: metrics.ratingScore, unit: '/5', color: '#8B5CF6', icon: 'fa-star-half-alt', trend: 'up', percentChange: 2.3 },
        { label: 'Win Rate', value: metrics.winRate, unit: '%', color: '#2E6276', icon: 'fa-trophy', trend: 'up', percentChange: 5.0 },
        { label: 'Total Projects', value: metrics.totalProjects, unit: '', color: '#6B7280', icon: 'fa-project-diagram', trend: 'up', percentChange: 12.0 }
      ],
      ranking: {
        vendorId,
        rank: 0, // Not provided by the backend — no cross-vendor ranking endpoint exists
        score: metrics.overallScore,
        factors: {
          price: metrics.costCompetitiveness,
          delivery: metrics.onTimeDeliveryRate,
          performance: metrics.overallScore,
          compliance: metrics.complianceScore
        },
        recommendation: metrics.overallScore >= 85 ? 'STRONG' : metrics.overallScore >= 70 ? 'MODERATE' : 'WEAK'
      }
    };
  }

  getVendorPerformance(vendorId: string): Observable<VendorPerformanceResponse> {
    this.loadingSubject.next(true);

    return this.http.get<VendorPerformanceMetrics>(`${this.baseUrl}/vendor-management/vendors/${vendorId}/performance`)
      .pipe(
        map(metrics => this.buildPerformanceResponse(metrics, vendorId)),
        tap(() => this.loadingSubject.next(false)),
        catchError((err) => {
          console.warn('Performance API failed, using mock data for vendor:', vendorId);
          this.loadingSubject.next(false);

          // Create a copy of the mock metrics with the vendor ID
          const metrics = { ...this.MOCK_PERFORMANCE_METRICS };
          return of(this.buildPerformanceResponse(metrics, vendorId));
        })
      );
  }

  getVendorKPIs(vendorId: string): Observable<VendorKPI[]> {
    return of([] as any);
  }

  getPerformanceTrend(vendorId: string, period: 'monthly' | 'quarterly' = 'monthly'): Observable<any> {
    return of({} as any);
  }

  refreshAIPerformance(vendorId: string): Observable<any> {
    return of({} as any);
  }

  // ============================================================
  // RISK & COMPLIANCE
  // ============================================================

  getVendorRisk(vendorId: string): Observable<VendorRiskResponse> {
    return of({} as any);
  }

  private mockRiskAlertsFor(vendorId?: string): RiskAlert[] {
    if (!vendorId) return this.MOCK_RISK_ALERTS;

    const filtered = this.MOCK_RISK_ALERTS.filter(a => a.vendorId === vendorId);
    if (filtered.length > 0) return filtered;

    // No alerts found for this vendor — return a default "all clear" entry.
    return [
      {
        id: 0,
        vendorId: vendorId,
        severity: AlertSeverity.INFO,
        type: 'GENERAL',
        title: 'No specific alerts for this vendor',
        description: 'All compliance checks are up to date.',
        detectedAt: new Date(),
        status: 'RESOLVED',
        actionRequired: false
      }
    ];
  }

  getRiskAlerts(vendorId?: string): Observable<RiskAlert[]> {
    if (!vendorId) {
      return of(this.MOCK_RISK_ALERTS);
    }

    return this.http.get<RiskAlert[]>(`${this.baseUrl}/vendor-management/vendors/${vendorId}/risk-alerts`)
      .pipe(
        map(res => Array.isArray(res) ? res : []),
        catchError(() => of(this.mockRiskAlertsFor(vendorId)))
      );
  }


  resolveRiskAlert(alertId: string, resolution: string): Observable<any> {
    return of({} as any);
  }

  initiateSanctionsCheck(vendorId: string): Observable<any> {
    return of({} as any);
  }


  // ============================================================
  // DOCUMENTS
  // ============================================================

  /** The vendor's own documents — from the live cache or the portal store — take
   *  priority over anything else, since these are what the vendor actually
   *  uploaded during registration (as opposed to generic placeholder mocks). */
  private getOwnVendorDocuments(vendorId: string): VendorDocument[] | null {
    const numericId = Number(vendorId);
    const vendor = this.vendorsSubject.value.find(v => v.id === numericId)
      ?? this.selectedVendorSubject.value
      ?? PendingVendorStore.getById(numericId);
    if (vendor?.id === numericId && vendor.documents?.length) {
      return vendor.documents;
    }
    return null;
  }

  /** Normalises a raw compliance/documents API record onto the VendorDocument shape. */
  private mapComplianceDocument(raw: any, fallbackVendorId?: string): VendorDocument {
    const expDate = parseSafeDate(raw.expiryDate);
    const uploadedAtDate = parseSafeDate(raw.uploadedAt || raw.uploadedDate || raw.createdAt);
    const timeDiff = expDate.getTime() - new Date().getTime();
    const computedDaysUntilExpiry = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)));

    let docStatus = DocumentStatus.PENDING_VERIFICATION;
    const statusUpper = String(raw.status || '').toUpperCase();
    if (statusUpper === 'ACTIVE' || statusUpper === 'APPROVED') {
      docStatus = DocumentStatus.ACTIVE;
    } else if (statusUpper === 'EXPIRED') {
      docStatus = DocumentStatus.EXPIRED;
    } else if (statusUpper === 'EXPIRING_SOON') {
      docStatus = DocumentStatus.EXPIRING_SOON;
    } else if (statusUpper === 'REJECTED') {
      docStatus = DocumentStatus.REJECTED;
    } else if (statusUpper === 'PENDING' || statusUpper === 'PENDING_VERIFICATION') {
      docStatus = DocumentStatus.PENDING_VERIFICATION;
    }

    let category = DocumentCategory.REGISTRATION;
    const categoryUpper = String(raw.category || '').toUpperCase();
    if (categoryUpper === 'REGISTRATION') {
      category = DocumentCategory.REGISTRATION;
    } else if (categoryUpper === 'TAX') {
      category = DocumentCategory.TAX;
    } else if (categoryUpper === 'LICENCE' || categoryUpper === 'LICENSE') {
      category = DocumentCategory.LICENCE;
    } else if (categoryUpper === 'INSURANCE') {
      category = DocumentCategory.INSURANCE;
    } else if (categoryUpper === 'CERTIFICATION') {
      category = DocumentCategory.CERTIFICATION;
    }

    return {
      id: Number(raw.id),
      vendorId: String(raw.vendorId ?? fallbackVendorId ?? ''),
      vendorName: raw.vendorName || undefined,
      category,
      name: raw.name || raw.label || raw.fileName || 'Unnamed Document',
      fileName: raw.fileName || '',
      fileUrl: raw.fileUrl || '',
      fileSize: Number(raw.fileSize || 0),
      fileType: raw.fileType || (raw.fileName?.endsWith('.pdf') ? 'application/pdf' : 'image/png'),
      issueDate: parseSafeDate(raw.issueDate || raw.createdAt || uploadedAtDate),
      expiryDate: expDate,
      status: docStatus,
      isRequired: !!raw.isRequired,
      verifiedBy: raw.verifiedBy || undefined,
      verifiedDate: raw.verifiedDate ? parseSafeDate(raw.verifiedDate) : undefined,
      verificationNotes: raw.verificationNotes || undefined,
      daysUntilExpiry: raw.daysUntilExpiry ?? computedDaysUntilExpiry,
      uploadedAt: uploadedAtDate,
      uploadedBy: raw.uploadedBy || 'Vendor User'
    } as VendorDocument;
  }

  /** All compliance documents across every vendor. */
  getComplianceDocuments(): Observable<VendorDocument[]> {
    return this.http.get<any[]>(`${this.baseUrl}/vendor-management/compliance/documents`)
      .pipe(
        map(res => (Array.isArray(res) ? res : []).map(raw => this.mapComplianceDocument(raw)))
      );
  }

  getVendorDocuments(vendorId: string): Observable<VendorDocument[]> {
    this.loadingSubject.next(true);

    const ownDocs = this.getOwnVendorDocuments(vendorId);
    if (this.useMockData) {
      this.loadingSubject.next(false);
      return of(ownDocs ?? []);
    }

    return this.getComplianceDocuments()
      .pipe(
        map(docs => docs.filter(d => d.vendorId === vendorId)),
        tap(() => this.loadingSubject.next(false)),
        catchError(err => {
          this.loadingSubject.next(false);
          console.warn('Documents API failed for vendor:', vendorId);

          // Prefer the vendor's own uploaded documents over any generic mock —
          // these are what was actually submitted during registration.
          if (ownDocs) {
            return of(ownDocs);
          }

          // Filter mock documents for this vendor
          const mockDocs = this.MOCK_DOCUMENTS.filter(doc => doc.vendorId === vendorId);

          // If no specific documents for this vendor, return some default ones
          if (mockDocs.length === 0) {
            // Create vendor-specific mock documents
            const vendorSpecificDocs: VendorDocument[] = [
              {
                id: Number(vendorId) * 100 + 1,
                vendorId: vendorId,
                category: DocumentCategory.REGISTRATION,
                name: 'Business Registration Certificate',
                fileName: `registration_${vendorId}.pdf`,
                fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                fileSize: 2457600,
                fileType: 'application/pdf',
                issueDate: new Date('2024-01-15'),
                expiryDate: new Date('2027-01-14'),
                status: DocumentStatus.ACTIVE,
                isRequired: true,
                daysUntilExpiry: 162,
                uploadedAt: new Date('2024-01-20'),
                uploadedBy: 'Vendor User'
              },
              {
                id: Number(vendorId) * 100 + 2,
                vendorId: vendorId,
                category: DocumentCategory.TAX,
                name: 'Tax Certificate',
                fileName: `tax_${vendorId}.pdf`,
                fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                fileSize: 1843200,
                fileType: 'application/pdf',
                issueDate: new Date('2024-02-01'),
                expiryDate: new Date('2027-01-31'),
                status: DocumentStatus.PENDING_VERIFICATION,
                isRequired: true,
                daysUntilExpiry: 159,
                uploadedAt: new Date('2024-02-05'),
                uploadedBy: 'Vendor User'
              },
              {
                id: Number(vendorId) * 100 + 3,
                vendorId: vendorId,
                category: DocumentCategory.LICENCE,
                name: 'Operating Licence',
                fileName: `licence_${vendorId}.pdf`,
                fileUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
                fileSize: 3072000,
                fileType: 'application/pdf',
                issueDate: new Date('2023-06-01'),
                expiryDate: new Date('2024-11-30'),
                status: DocumentStatus.EXPIRING_SOON,
                isRequired: true,
                daysUntilExpiry: 28,
                uploadedAt: new Date('2023-06-10'),
                uploadedBy: 'Vendor User'
              }
            ];
            return of(vendorSpecificDocs);
          }

          return of(mockDocs);
        })
      );
  }

  uploadDocument(
    vendorId: string,
    file: File,
    category: DocumentCategory,
    issueDate: Date,
    expiryDate: Date
  ): Observable<VendorDocument> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    formData.append('issueDate', issueDate.toISOString());
    formData.append('expiryDate', expiryDate.toISOString());

    return this.http.post<VendorDocument>(`${this.baseUrl}/vendors/${vendorId}/documents`, formData)
      .pipe(
        tap(() => {
          this.getVendorDocuments(vendorId).subscribe();
        }),
        catchError(err => {
          this.errorSubject.next('Failed to upload document');
          return throwError(() => err);
        })
      );
  }

  verifyDocument(documentId: string, verified: boolean, notes?: string): Observable<any> {
    const payload: any = {
      status: verified ? DocumentStatus.ACTIVE : DocumentStatus.REJECTED
    };
    if (notes) payload.notes = notes;

    return this.http.patch(`${this.baseUrl}/vendors/documents/${documentId}/status`, payload)
      .pipe(
        catchError(err => {
          this.errorSubject.next('Failed to verify document');
          return throwError(() => err);
        })
      );
  }

  deleteDocument(documentId: string): Observable<any> {
    return this.http.delete(`${this.baseUrl}/vendors/documents/${documentId}`)
      .pipe(
        catchError(err => {
          this.errorSubject.next('Failed to delete document');
          return throwError(() => err);
        })
      );
  }

  // ============================================================
  // AI & PREDICTIVE (stubs)
  // ============================================================

  getVendorRanking(vendorId: string): Observable<VendorRankingData> {
    return of({} as any);
  }

  getVendorPredictions(vendorId: string): Observable<VendorPrediction[]> {
    return of([] as any);
  }

  getAnomalies(vendorId?: string): Observable<AnomalyDetection[]> {
    return of([] as any);
  }

  acknowledgeAnomaly(anomalyId: string): Observable<any> {
    return of({} as any);
  }

  // ============================================================
  // LIFECYCLE
  // ============================================================

  getLifecycleHistory(vendorId: string): Observable<VendorLifecycleHistory[]> {
    this.loadingSubject.next(true);

    return this.http.get<VendorLifecycleHistory[]>(`${this.baseUrl}/vendor-management/vendors/${vendorId}/lifecycle-history`)
      .pipe(
        tap(() => this.loadingSubject.next(false)),
        catchError(err => {
          this.loadingSubject.next(false);
          console.warn('Lifecycle API failed, using mock data for vendor:', vendorId);

          // Filter mock data for this vendor or return all if no specific data
          const mockData = this.MOCK_LIFECYCLE_HISTORY.filter(h => h.vendorId === vendorId);
          if (mockData.length === 0) {
            // Return generic mock data for this vendor
            const genericData: VendorLifecycleHistory[] = [
              {
                id: Number(vendorId) * 100 + 1,
                vendorId: vendorId,
                event: VendorLifecycleEvent.APPLIED,
                description: 'Vendor application submitted',
                performedBy: 'Vendor User',
                timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
              },
              {
                id: Number(vendorId) * 100 + 2,
                vendorId: vendorId,
                event: VendorLifecycleEvent.DOCUMENTS_SUBMITTED,
                description: 'Required documents uploaded',
                performedBy: 'Vendor User',
                timestamp: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000)
              },
              {
                id: Number(vendorId) * 100 + 3,
                vendorId: vendorId,
                event: VendorLifecycleEvent.UNDER_REVIEW,
                description: 'Application under review',
                performedBy: 'Procurement Team',
                timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000)
              },
              {
                id: Number(vendorId) * 100 + 4,
                vendorId: vendorId,
                event: VendorLifecycleEvent.ACTIVATED,
                description: 'Vendor activated in the marketplace',
                performedBy: 'System',
                timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
              }
            ];
            return of(genericData);
          }
          return of(mockData);
        })
      );
  }

  // ============================================================
  // CONTRACTS
  // ============================================================

  /** All contracts across every vendor. */
  getContracts(): Observable<VendorContract[]> {
    return this.http.get<VendorContract[]>(`${this.baseUrl}/vendor-management/contracts`)
      .pipe(
        map(res => Array.isArray(res) ? res : []),
        catchError(() => of([]))
      );
  }

  getVendorContracts(vendorId: string): Observable<VendorContract[]> {
    return this.getContracts().pipe(
      map(contracts => contracts.filter(c => String(c.vendorId) === vendorId))
    );
  }

  createContract(vendorId: string, contract: Partial<VendorContract>): Observable<VendorContract> {
    return of({} as any);
  }

  // ============================================================
  // MESSAGING
  // ============================================================

  getVendorMessages(vendorId: string): Observable<VendorMessage[]> {
    return of([] as any);
  }

  sendMessage(vendorId: string, message: Partial<VendorMessage>): Observable<VendorMessage> {
    return of({} as any);
  }

  markMessageRead(messageId: string): Observable<any> {
    return of({} as any);
  }

  // ============================================================
  // DISPUTES
  // ============================================================

  getDisputes(vendorId?: string): Observable<Dispute[]> {
    return of([] as any);
  }

  createDispute(vendorId: string, dispute: Partial<Dispute>): Observable<Dispute> {
    return of({} as any);
  }

  resolveDispute(disputeId: string, resolution: string): Observable<any> {
    return of({} as any);
  }

  // ============================================================
  // EXPORT / REPORT
  // ============================================================

  exportVendors(filters?: any): Observable<Blob> {
    let params = new HttpParams();

    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) params = params.set(key, filters[key]);
      });
    }

    return this.http.get(`${this.baseUrl}/vendors/export`, {
      params,
      responseType: 'blob'
    });
  }

  // ============================================================
  // PRIVATE HELPERS
  // ============================================================

  private updateVendorInList(vendor: Vendor): void {
    const current = this.vendorsSubject.getValue();
    const index = current.findIndex(v => v.id === vendor.id);
    if (index !== -1) {
      current[index] = vendor;
      this.vendorsSubject.next([...current]);
    }
  }

  // ============================================================
  // AI VENDOR INTELLIGENCE (SENTINEL)
  // ============================================================

  private sentinelInsightsSubject = new BehaviorSubject<SentinelInsight[]>([]);
  sentinelInsights$ = this.sentinelInsightsSubject.asObservable();

  private fraudFlagsSubject = new BehaviorSubject<FraudFlag[]>([]);
  fraudFlags$ = this.fraudFlagsSubject.asObservable();

  getSentinelInsights(): Observable<SentinelInsight[]> {
    return this.http.get<SentinelInsight[]>(`${this.baseUrl}/vendor-management/sentinel/insights`)
      .pipe(
        tap(data => this.sentinelInsightsSubject.next(data)),
        catchError(() => {
          this.sentinelInsightsSubject.next(MOCK_SENTINEL_INSIGHTS);
          return of(MOCK_SENTINEL_INSIGHTS);
        })
      );
  }

  actOnInsight(insightId: number, action: string): Observable<SentinelInsight[]> {
    const current = this.sentinelInsightsSubject.value.length
      ? this.sentinelInsightsSubject.value
      : MOCK_SENTINEL_INSIGHTS;

    const updated = current.map(insight => {
      if (insight.id !== insightId) return insight;
      const normalizedAction = action.toUpperCase();
      const status: InsightActionStatus = normalizedAction === 'DISMISS'
        ? InsightActionStatus.DISMISSED
        : normalizedAction === 'REVIEW' || normalizedAction === 'INVESTIGATE'
          ? InsightActionStatus.REVIEWED
          : InsightActionStatus.ACTIONED;
      return { ...insight, status };
    });

    return this.http.post<SentinelInsight[]>(`${API_BASE}/ai/sentinel/insights/${insightId}/action`, { action })
      .pipe(
        tap(() => this.sentinelInsightsSubject.next(updated)),
        catchError(() => {
          this.sentinelInsightsSubject.next(updated);
          return of(updated);
        })
      );
  }

  /** A single vendor's AI-projected risk trend — the only shape the real API exposes. */
  getVendorRiskTrajectory(vendorId: string): Observable<VendorRiskTrajectory> {
    return this.http.get<VendorRiskTrajectory>(`${this.baseUrl}/vendor-management/vendors/${vendorId}/risk-trajectory`)
      .pipe(
        catchError(() => of(
          MOCK_RISK_TRAJECTORIES.find(t => t.vendorId === vendorId) || MOCK_RISK_TRAJECTORIES[0]
        ))
      );
  }

  /**
   * Trajectories for a set of vendors, fanned out over the per-vendor endpoint
   * (there's no bulk trajectory endpoint). Without `vendorIds` this just returns
   * the mock set, for callers that haven't been updated to pass a vendor list.
   */
  getRiskTrajectories(vendorIds?: string[]): Observable<VendorRiskTrajectory[]> {
    if (vendorIds === undefined) {
      return of(MOCK_RISK_TRAJECTORIES);
    }
    if (vendorIds.length === 0) {
      return of([]);
    }
    return forkJoin(vendorIds.map(id => this.getVendorRiskTrajectory(id)));
  }

  getFraudFlags(): Observable<FraudFlag[]> {
    return this.http.get<FraudFlag[]>(`${this.baseUrl}/vendor-management/fraud-flags`)
      .pipe(
        tap(data => this.fraudFlagsSubject.next(data)),
        catchError(() => {
          this.fraudFlagsSubject.next(MOCK_FRAUD_FLAGS);
          return of(MOCK_FRAUD_FLAGS);
        })
      );
  }

  updateFraudFlagStatus(flagId: number, status: FraudFlag['status']): Observable<FraudFlag[]> {
    const current = this.fraudFlagsSubject.value.length ? this.fraudFlagsSubject.value : MOCK_FRAUD_FLAGS;
    const updated = current.map(f => f.id === flagId ? { ...f, status } : f);

    return this.http.post<FraudFlag[]>(`${API_BASE}/ai/sentinel/fraud-flags/${flagId}/status`, { status })
      .pipe(
        tap(() => this.fraudFlagsSubject.next(updated)),
        catchError(() => {
          this.fraudFlagsSubject.next(updated);
          return of(updated);
        })
      );
  }

  getOnboardingCopilotSession(vendorId?: string): Observable<OnboardingCopilotSession> {
    // The real endpoint is always scoped to a vendor — fall straight to mock without it.
    if (!vendorId) {
      return of(MOCK_ONBOARDING_COPILOT);
    }

    return this.http.get<OnboardingCopilotSession>(`${this.baseUrl}/vendor-management/onboarding-copilot/${vendorId}`)
      .pipe(
        catchError(() => of(MOCK_ONBOARDING_COPILOT))
      );
  }

  confirmExtractedField(sessionId: string, fieldName: string, correctedValue?: string): Observable<ExtractedField> {
    const field = MOCK_ONBOARDING_COPILOT.extractedFields.find(f => f.fieldName === fieldName);
    const result: ExtractedField = field
      ? { ...field, confirmed: true, corrected: !!correctedValue, extractedValue: correctedValue || field.extractedValue }
      : { fieldName, extractedValue: correctedValue || '', confidence: 100, sourceDocument: '', confirmed: true, corrected: !!correctedValue };

    return this.http.post<ExtractedField>(`${API_BASE}/ai/sentinel/onboarding-copilot/${sessionId}/fields/${fieldName}/confirm`, { correctedValue })
      .pipe(
        catchError(() => of(result))
      );
  }

  getSentinelSummaryStats(): Observable<SentinelSummaryStats> {
    return this.http.get<SentinelSummaryStats>(`${this.baseUrl}/vendor-management/sentinel/stats`)
      .pipe(
        catchError(() => of({
          activeInsights: MOCK_SENTINEL_INSIGHTS.filter(i => i.status === InsightActionStatus.OPEN).length,
          criticalInsights: MOCK_SENTINEL_INSIGHTS.filter(i => i.severity === InsightSeverity.CRITICAL).length,
          fraudFlagsPending: MOCK_FRAUD_FLAGS.filter(f => f.status === 'PENDING_REVIEW').length,
          actionsAutoThisWeek: 0,
          actionsStaffApprovedThisWeek: 0,
          averagePredictionConfidence: Math.round(
            MOCK_RISK_TRAJECTORIES.reduce((sum, t) => sum + t.confidence, 0) / MOCK_RISK_TRAJECTORIES.length
          )
        }))
      );
  }

  getPendingVendors(page: number = 1, limit: number = 20, filters?: any): Observable<VendorListResponse> {
    this.loadingSubject.next(true);

    let params = new HttpParams()
      .set('page', page.toString())
      .set('limit', limit.toString())
      .set('statuses', `${VendorStatus.PENDING_ONBOARDING},${VendorStatus.UNDER_REVIEW}`);

    if (filters) {
      if (filters.search) params = params.set('search', filters.search);
      if (filters.status) params = params.set('status', filters.status);
      if (filters.tier) params = params.set('tier', filters.tier);
      if (filters.riskLevel) params = params.set('riskLevel', filters.riskLevel);
      if (filters.category) params = params.set('category', filters.category);
      if (filters.dateFrom) params = params.set('dateFrom', filters.dateFrom);
      if (filters.dateTo) params = params.set('dateTo', filters.dateTo);
    }

    return this.http.get<VendorListResponse>(`${API_BASE}/vendors/pending`, { params })
      .pipe(
        tap(response => {
          this.loadingSubject.next(false);
        }),
        catchError(err => {
          this.loadingSubject.next(false);
          this.errorSubject.next('Failed to load pending vendors');
          return throwError(() => err);
        })
      );
  }

  /**
   * Approve a vendor (admin action)
   */
  approveVendor(id: string, notes?: string): Observable<Vendor> {
    this.loadingSubject.next(true);

    return this.http.patch<Vendor>(`${API_BASE}/vendors/${id}/approve`, { notes })
      .pipe(
        tap(vendor => {
          this.loadingSubject.next(false);
        }),
        catchError(err => {
          this.loadingSubject.next(false);
          this.errorSubject.next('Failed to approve vendor');
          return throwError(() => err);
        })
      );
  }

  /**
   * Reject a vendor (admin action)
   */
  rejectVendor(id: string, reason: string): Observable<Vendor> {
    this.loadingSubject.next(true);

    return this.http.patch<Vendor>(`${API_BASE}/vendors/${id}/reject`, { reason })
      .pipe(
        tap(vendor => {
          this.loadingSubject.next(false);
        }),
        catchError(err => {
          this.loadingSubject.next(false);
          this.errorSubject.next('Failed to reject vendor');
          return throwError(() => err);
        })
      );
  }


  // ============================================================
  // CLEAR STATE
  // ============================================================

  clearState(): void {
    this.vendorsSubject.next([]);
    this.selectedVendorSubject.next(null);
    this.dashboardStatsSubject.next(null);
    this.loadingSubject.next(false);
    this.errorSubject.next(null);
  }
}