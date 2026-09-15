// vendor-management.dto.ts
import { VendorRegistration } from '../vendor-portal/vendor-registration.dto';

// ============================================================
// ENUMS
// ============================================================

export enum VendorStatus {
    ACTIVE = 'ACTIVE',
    INACTIVE = 'INACTIVE',
    PENDING_ONBOARDING = 'PENDING_ONBOARDING',
    UNDER_REVIEW = 'UNDER_REVIEW',
    SUSPENDED = 'SUSPENDED',
    OFFBOARDED = 'OFFBOARDED',
    CONDITIONAL = 'CONDITIONAL',
    REJECTED = 'REJECTED'
}

export enum VendorTier {
    PREFERRED = 'PREFERRED',
    APPROVED = 'APPROVED',
    CONDITIONAL = 'CONDITIONAL'
}

export enum RiskLevel {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH'
}

export enum DocumentStatus {
    ACTIVE = 'ACTIVE',
    EXPIRING_SOON = 'EXPIRING_SOON',
    EXPIRED = 'EXPIRED',
    PENDING_VERIFICATION = 'PENDING_VERIFICATION',
    REJECTED = 'REJECTED'
}

export enum DocumentCategory {
    REGISTRATION = 'REGISTRATION',
    TAX = 'TAX',
    LICENCE = 'LICENCE',
    INSURANCE = 'INSURANCE',
    CERTIFICATION = 'CERTIFICATION'
}

export enum VendorLifecycleEvent {
  APPLIED = 'APPLIED',
  DOCUMENTS_SUBMITTED = 'DOCUMENTS_SUBMITTED',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  ACTIVATED = 'ACTIVATED',
  SUSPENDED = 'SUSPENDED',
  OFFBOARDED = 'OFFBOARDED',
  PERFORMANCE_UPDATE = 'PERFORMANCE_UPDATE',  
  RISK_ALERT = 'RISK_ALERT',                 
  DOCUMENT_VERIFIED = 'DOCUMENT_VERIFIED',    
  TIER_CHANGED = 'TIER_CHANGED'               
}


export enum AlertSeverity {
    INFO = 'INFO',
    WARNING = 'WARNING',
    CRITICAL = 'CRITICAL'
}

// ============================================================
// CORE MODELS
// ============================================================

export interface Vendor {
    id: number;
    companyName: string;
    registrationNumber: string;
    taxId: string;
    email: string;
    phone: string;
    website?: string;
    address: VendorAddress;
    status: VendorStatus;
    tier: VendorTier;
    riskLevel: RiskLevel;
    performanceScore: number;
    totalProjects: number;
    winRate: number;
    averageRating: number;
    joinedDate: Date;
    lastActivityDate: Date;
    categories: string[]; // Service/product categories
    logo?: string;
    description?: string;
    paymentTerms?: string;
    bankDetails?: BankDetails;
    contacts: VendorContact[];
    documents: VendorDocument[];
    complianceStatus: ComplianceStatus;
    performanceMetrics: VendorPerformanceMetrics;
    lifecycleHistory: VendorLifecycleHistory[];
    riskAlerts: RiskAlert[];
    createdAt: Date;
    updatedAt: Date;
    applicationNumber?: string;
    // The full 6-step vendor portal submission this vendor originated from, if any.
    // The slim fields above are a mapped summary of this — kept alongside it so
    // approval-queue/vendor-directory views can display everything the vendor
    // actually entered (not just what was carried over into the summary shape).
    registration?: VendorRegistration;
}

export interface VendorAddress {
    street: string;
    city: string;
    state: string;
    country: string;
    postalCode: string;
}

export interface BankDetails {
    bankName: string;
    accountNumber: string;
    accountName: string;
    swiftCode?: string;
    verified: boolean;
}

export interface VendorContact {
    id: number;
    name: string;
    email: string;
    phone: string;
    role: string;
    isPrimary: boolean;
}

// ============================================================
// DOCUMENT MODELS
// ============================================================

export interface VendorDocument {
    id: number;
    category: DocumentCategory;
    name: string;
    fileName: string;
    fileUrl: string;
    fileSize: number;
    fileType: string;
    issueDate: Date;
    expiryDate: Date;
    status: DocumentStatus;
    isRequired: boolean;
    verifiedBy?: string;
    verifiedDate?: Date;
    verificationNotes?: string;
    daysUntilExpiry: number;
    uploadedAt: Date;
    uploadedBy: string;
    vendorId?: string;
    vendorName?: string;
}

export interface ComplianceStatus {
    isCompliant: boolean;
    documentsVerified: number;
    totalRequiredDocuments: number;
    expiredDocuments: number;
    expiringDocuments: number;
    lastComplianceCheck: Date;
    sanctionsClear: boolean;
}

// ============================================================
// PERFORMANCE MODELS
// ============================================================

export interface VendorPerformanceMetrics {
    overallScore: number;
    onTimeDeliveryRate: number; // 0-100
    qualityScore: number; // 0-100
    costCompetitiveness: number; // 0-100
    complianceScore: number; // 0-100
    ratingScore: number; // 0-100
    winRate: number; // 0-100
    totalProjects: number;
    totalRevenue: number;
    averageOrderValue: number;
    lastUpdated: Date;
    trendData: PerformanceTrendPoint[];
}

export interface PerformanceTrendPoint {
    period: string; // e.g., 'Jan 2026'
    score: number;
    onTimeDelivery: number;
    quality: number;
}

export interface VendorKPI {
    label: string;
    value: number | string;
    unit?: string;
    color: string;
    icon: string;
    trend: 'up' | 'down' | 'stable';
    percentChange: number;
}

// ============================================================
// RISK MODELS
// ============================================================

export interface RiskProfile {
    riskLevel: RiskLevel;
    overallScore: number; // 0-100
    factors: RiskFactor[];
    lastAssessed: Date;
    recommendations: string[];
}

export interface RiskFactor {
    name: string;
    score: number; // 0-100
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    description: string;
}

export interface RiskAlert {
    id: number;
    vendorId: string;
    severity: AlertSeverity;
    type: string;
    title: string;
    description: string;
    detectedAt: Date;
    resolvedAt?: Date;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED';
    actionRequired: boolean;
    assignedTo?: string;
    resolutionNotes?: string;
}

export interface SanctionsCheckResult {
    vendorId: string;
    cleared: boolean;
    checkedAt: Date;
    matchesFound: number;
    details?: string;
    referenceId: string;
}

// ============================================================
// LIFECYCLE MODELS
// ============================================================

export interface VendorLifecycleHistory {
    id: number;
    vendorId?: string;
    event: VendorLifecycleEvent;
    description: string;
    performedBy: string;
    timestamp: Date;
    metadata?: Record<string, any>;
}

export interface OnboardingData {
    companyName: string;
    registrationNumber: string;
    taxId: string;
    email: string;
    phone: string;
    address: VendorAddress;
    bankDetails: BankDetails;
    categories: string[];
    contacts: Omit<VendorContact, 'id'>[];
    documents: FileUploadData[];
    paymentTerms?: string;
    description?: string;
    website?: string;
}

export interface FileUploadData {
    category: DocumentCategory;
    fileName: string;
    file: File;
    issueDate: Date;
    expiryDate: Date;
}

export interface OnboardingResult {
    vendorId: string;
    status: VendorStatus;
    message: string;
    warnings: string[];
}

export interface OffboardingData {
    reason: string;
    finalizeOrders: boolean;
    finalPaymentIssued: boolean;
    notes: string;
    revokeAccess: boolean;
}

// ============================================================
// AI & PREDICTIVE MODELS
// ============================================================

export interface VendorPrediction {
    vendorId: string;
    metric: string;
    predictedValue: number;
    confidence: number;
    timeframe: string;
    actionable: boolean;
    suggestion?: string;
}

export interface VendorRankingData {
    vendorId: string;
    rank: number;
    score: number;
    factors: {
        price: number;
        delivery: number;
        performance: number;
        compliance: number;
    };
    recommendation: 'STRONG' | 'MODERATE' | 'WEAK';
}

export interface AnomalyDetection {
    vendorId: string;
    detected: boolean;
    type: 'PRICE_DEVIATION' | 'BANK_DETAIL_CHANGE' | 'DELIVERY_PATTERN' | 'QUOTATION_BEHAVIOR';
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    detectedAt: Date;
    reviewed: boolean;
    actionTaken?: string;
}

// ============================================================
// DASHBOARD STATS
// ============================================================

export interface VendorDashboardStats {
    totalVendors: number;
    activeVendors: number;
    pendingOnboarding: number;
    pendingReview: number;
    highRiskVendors: number;
    expiringDocuments: number;
    averagePerformanceScore: number;
    vendorsByTier: {
        preferred: number;
        approved: number;
        conditional: number;
    };
    recentActivity: VendorRecentActivity[];
    expiringDocumentsList: VendorDocument[];
    topPerformers: Vendor[];
    riskAlertsCount: number;
    monthOverMonthGrowth: number;
}

export interface VendorRecentActivity {
    id: number;
    vendorId: string;
    vendorName: string;
    event: string;
    description: string;
    timestamp: Date;
    type: 'ONBOARDING' | 'PERFORMANCE' | 'RISK' | 'DOCUMENT' | 'ORDER' | 'GENERAL';
    icon: string;
    color: string;
}

// ============================================================
// CONTRACT MODELS
// ============================================================

export interface VendorContract {
    id: number;
    vendorId: string;
    title: string;
    contractNumber: string;
    startDate: Date;
    endDate: Date;
    renewalDate: Date;
    status: 'ACTIVE' | 'EXPIRING' | 'EXPIRED' | 'TERMINATED';
    value: number;
    terms: string;
    documentUrl?: string;
    autoRenew: boolean;
    renewalReminderSent: boolean;
}

// ============================================================
// MESSAGING MODELS
// ============================================================

export interface VendorMessage {
    id: string;
    vendorId: string;
    senderId: string;
    senderName: string;
    senderType: 'INTERNAL' | 'VENDOR';
    subject: string;
    content: string;
    read: boolean;
    createdAt: Date;
    attachments?: string[];
}

export interface Dispute {
    id: string;
    vendorId: string;
    orderId?: string;
    title: string;
    description: string;
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'ESCALATED';
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    createdBy: string;
    assignedTo?: string;
    createdAt: Date;
    resolvedAt?: Date;
    resolution?: string;
    messages: DisputeMessage[];
}

export interface DisputeMessage {
    id: string;
    disputeId: string;
    senderId: string;
    senderName: string;
    content: string;
    createdAt: Date;
    attachments?: string[];
}

// ============================================================
// DTO RESPONSE TYPES
// ============================================================

export interface VendorListResponse {
    vendors: Vendor[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface VendorPerformanceResponse {
    metrics: VendorPerformanceMetrics;
    kpis: VendorKPI[];
    ranking: VendorRankingData;
}

export interface VendorRiskResponse {
    riskProfile: RiskProfile;
    alerts: RiskAlert[];
    sanctionsStatus: SanctionsCheckResult;
    documentStatus: VendorDocument[];
}

// ============================================================
// HELPER FUNCTIONS
// ============================================================

export function getVendorStatusColor(status: VendorStatus): string {
    const map: Record<VendorStatus, string> = {
        [VendorStatus.ACTIVE]: '#2EB270',
        [VendorStatus.INACTIVE]: '#6B7280',
        [VendorStatus.PENDING_ONBOARDING]: '#F59E0B',
        [VendorStatus.UNDER_REVIEW]: '#F97316',
        [VendorStatus.SUSPENDED]: '#DC2626',
        [VendorStatus.OFFBOARDED]: '#6B7280',
        [VendorStatus.CONDITIONAL]: '#8B5CF6',
        [VendorStatus.REJECTED]: '#DC2626'
    };
    return map[status] || '#6B7280';
}

export function getVendorTierLabel(tier: VendorTier): string {
    const map: Record<VendorTier, string> = {
        [VendorTier.PREFERRED]: '⭐ Preferred',
        [VendorTier.APPROVED]: '✓ Approved',
        [VendorTier.CONDITIONAL]: '⚠️ Conditional'
    };
    return map[tier] || tier;
}

export function getRiskLevelColor(level: RiskLevel): string {
    const map: Record<RiskLevel, string> = {
        [RiskLevel.LOW]: '#2EB270',
        [RiskLevel.MEDIUM]: '#F59E0B',
        [RiskLevel.HIGH]: '#DC2626'
    };
    return map[level] || '#6B7280';
}

export function getDocumentStatusColor(status: DocumentStatus): string {
    const map: Record<DocumentStatus, string> = {
        [DocumentStatus.ACTIVE]: '#2EB270',
        [DocumentStatus.EXPIRING_SOON]: '#F59E0B',
        [DocumentStatus.EXPIRED]: '#DC2626',
        [DocumentStatus.PENDING_VERIFICATION]: '#F97316',
        [DocumentStatus.REJECTED]: '#DC2626'
    };
    return map[status] || '#6B7280';
}

// ============================================================
// VENDOR INTELLIGENCE (AI INSIGHT & AUTOMATION CENTER) MODELS
// ============================================================

export enum InsightType {
    PERFORMANCE_DECLINE = 'PERFORMANCE_DECLINE',
    FRAUD_ANOMALY = 'FRAUD_ANOMALY',
    TIER_UPGRADE = 'TIER_UPGRADE',
    DOCUMENT_EXPIRY = 'DOCUMENT_EXPIRY',
    RISK_ESCALATION = 'RISK_ESCALATION',
    OPPORTUNITY = 'OPPORTUNITY'
}

export enum InsightSeverity {
    CRITICAL = 'CRITICAL',
    HIGH = 'HIGH',
    MEDIUM = 'MEDIUM',
    LOW = 'LOW'
}

export enum InsightActionStatus {
    OPEN = 'OPEN',
    REVIEWED = 'REVIEWED',
    ACTIONED = 'ACTIONED',
    DISMISSED = 'DISMISSED'
}

export interface SentinelInsightAction {
    label: string;
    action: 'REVIEW' | 'MESSAGE' | 'DISMISS' | 'INVESTIGATE' | 'APPROVE' | 'ESCALATE';
    style: 'PRIMARY' | 'SECONDARY' | 'DANGER';
}

export interface SentinelInsight {
    id: number;
    type: InsightType;
    severity: InsightSeverity;
    vendorId: string;
    vendorName: string;
    finding: string;
    reason: string;
    evidence: string[];
    suggestedActions: SentinelInsightAction[];
    status: InsightActionStatus;
    detectedAt: Date;
    confidence: number; // 0-100
}

export type RiskTrajectoryDirection = 'IMPROVING' | 'STABLE' | 'RISING';

export interface RiskTrajectoryPoint {
    horizonDays: 30 | 60 | 90;
    projectedRiskScore: number; // 0-100, higher = riskier
    confidence: number; // 0-100
}

export interface VendorRiskTrajectory {
    vendorId: string;
    vendorName: string;
    currentRiskLevel: RiskLevel;
    direction: RiskTrajectoryDirection;
    confidence: number; // 0-100
    reason: string;
    drivers: { label: string; impact: 'POSITIVE' | 'NEGATIVE'; weight: number }[];
    projections: RiskTrajectoryPoint[];
    lastUpdated: Date;
}

export type FraudFlagType = 'BANK_DETAIL_CHANGE' | 'DUPLICATE_INVOICE' | 'SUSPICIOUSLY_LOW_BID' | 'DOCUMENT_METADATA_MISMATCH' | 'INCONSISTENT_INVOICE';

export interface FraudEvidenceItem {
    label: string;
    value: string;
}

export interface FraudFlag {
    id: number;
    vendorId: string;
    vendorName: string;
    type: FraudFlagType;
    title: string;
    description: string;
    severity: 'LOW' | 'MEDIUM' | 'HIGH';
    evidence: FraudEvidenceItem[];
    detectedAt: Date;
    status: 'PENDING_REVIEW' | 'INVESTIGATING' | 'APPROVED' | 'ESCALATED' | 'CLEARED';
}

export interface ExtractedField {
    fieldName: string;
    extractedValue: string;
    confidence: number; // 0-100
    sourceDocument: string;
    confirmed: boolean;
    corrected?: boolean;
}

export interface OnboardingCopilotSession {
    id: string;
    vendorId: string;
    vendorName: string;
    extractedFields: ExtractedField[];
    proposedRiskClassification: RiskLevel;
    riskReasoning: string[];
    overallExtractionConfidence: number;
    status: 'IN_PROGRESS' | 'AWAITING_CONFIRMATION' | 'CONFIRMED';
}

export interface SentinelSummaryStats {
    activeInsights: number;
    criticalInsights: number;
    fraudFlagsPending: number;
    actionsAutoThisWeek: number;
    actionsStaffApprovedThisWeek: number;
    averagePredictionConfidence: number;
}

export function getInsightSeverityColor(severity: InsightSeverity): string {
    const map: Record<InsightSeverity, string> = {
        [InsightSeverity.CRITICAL]: '#DC2626',
        [InsightSeverity.HIGH]: '#F97316',
        [InsightSeverity.MEDIUM]: '#F59E0B',
        [InsightSeverity.LOW]: '#2E6276'
    };
    return map[severity] || '#6B7280';
}

export function getRiskTrajectoryColor(direction: RiskTrajectoryDirection): string {
    const map: Record<RiskTrajectoryDirection, string> = {
        IMPROVING: '#2EB270',
        STABLE: '#F59E0B',
        RISING: '#DC2626'
    };
    return map[direction] || '#6B7280';
}

export function getRiskTrajectoryIcon(direction: RiskTrajectoryDirection): string {
    const map: Record<RiskTrajectoryDirection, string> = {
        IMPROVING: 'fa-arrow-trend-down',
        STABLE: 'fa-arrows-left-right',
        RISING: 'fa-arrow-trend-up'
    };
    return map[direction] || 'fa-minus';
}

// Add approval response type
export interface ApprovalResult {
  vendorId: string;
  status: VendorStatus;
  message: string;
  notes?: string;
  reason?: string;
  approvedAt?: Date;
  rejectedAt?: Date;
  approvedBy?: string;
  rejectedBy?: string;
}