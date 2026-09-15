// vendor-management-detail.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewInit, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import {
  VendorService
} from '../../../service/vendor-management/vendor-management.service';
import {
  Vendor,
  VendorStatus,
  VendorTier,
  RiskLevel,
  VendorDocument,
  VendorPerformanceMetrics,
  VendorLifecycleHistory,
  VendorContract,
  RiskAlert,
  DocumentCategory,  // <-- ADD THIS
  getVendorStatusColor,
  getVendorTierLabel,
  getRiskLevelColor,
  getDocumentStatusColor,
  DocumentStatus
} from '../../../domain/vendor-management/vendor-management.dto';
import {
  BUSINESS_TYPE_LABELS,
  BUSINESS_SIZE_LABELS,
  OWNERSHIP_TYPE_LABELS,
  SUPPLY_CATEGORY_LABELS
} from '../../../domain/vendor-portal/vendor-registration.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-vendor-management-detail',
  templateUrl: './vendor-management-detail.component.html',
  styleUrls: ['./vendor-management-detail.component.scss']
})
export class VendorManagementDetailComponent implements OnInit, OnDestroy, AfterViewInit, OnChanges {

  // ============================================================
  // VIEW CHILDREN & INPUTS / OUTPUTS
  // ============================================================

  @ViewChild('headerElement') headerElement!: ElementRef;
  @ViewChild('tabsContainer') tabsContainer!: ElementRef;

  @Input() vendorId: string = '';
  @Output() close = new EventEmitter<void>();

  // ============================================================
  // STATE
  // ============================================================

  // Core
  vendor: Vendor | null = null;
  isLoading: boolean = true;
  isSaving: boolean = false;
  error: string | null = null;

  // Tabs
  activeTab: 'overview' | 'registration' | 'performance' | 'risk' | 'documents' | 'contracts' | 'activity' = 'overview';
  tabLabels = {
    overview: 'Overview',
    registration: 'Registration',
    performance: 'Performance',
    risk: 'Risk & Compliance',
    documents: 'Documents',
    contracts: 'Contracts',
    activity: 'Activity'
  };

  // Data
  documents: VendorDocument[] = [];
  performance: VendorPerformanceMetrics | null = null;
  lifecycleHistory: VendorLifecycleHistory[] = [];
  contracts: VendorContract[] = [];
  riskAlerts: RiskAlert[] = [];

  // Edit Mode
  isEditing: boolean = false;
  editForm: FormGroup;

  // UI
  Math = Math;
  parseFloat = parseFloat;
  showConfirmDialog: boolean = false;
  confirmAction: 'suspend' | 'activate' | 'offboard' | 'delete' | null = null;
  confirmMessage: string = '';
  showStatusDropdown: boolean = false;

  // Enums for template
  VendorStatus = VendorStatus;
  VendorTier = VendorTier;
  RiskLevel = RiskLevel;
  DocumentStatus = DocumentStatus;

  // Performance chart
  performanceChartData: any = null;

  // Private
  private destroy$ = new Subject<void>();
  private returnTo: 'registry' | 'directory' | 'dashboard' = 'registry';

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private location: Location,
    private vendorService: VendorService,
    private fb: FormBuilder
  ) {
    this.editForm = this.buildEditForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    if (this.vendorId) {
      this.loadVendorData();
    } else {
      this.route.params.pipe(
        takeUntil(this.destroy$)
      ).subscribe(params => {
        if (params['id']) {
          this.vendorId = params['id'];
          this.loadVendorData();
        }
      });
    }

    // Subscribe to vendor updates from service
    this.vendorService.selectedVendor$
      .pipe(takeUntil(this.destroy$))
      .subscribe(vendor => {
        if (vendor && String(vendor.id) === this.vendorId) {
          this.vendor = vendor;
          this.updateEditForm(vendor);
          this.isLoading = false;
        }
      });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['vendorId'] && !changes['vendorId'].firstChange && this.vendorId) {
      this.loadVendorData();
    }
  }

  goBack(): void {
    if (this.close.observed) {
      this.close.emit();
    } else {
      const tabName = this.returnTo === 'directory'
        ? 'Vendor Directory'
        : this.returnTo === 'dashboard'
          ? 'Dashboard'
          : 'Vendor Global Registry';
      sessionStorage.setItem('dashboard-vendor global registry-vendor directory', tabName);
      this.router.navigate(['/commerce/manage-vendors']);
    }
  }

  ngAfterViewInit(): void {
    // Check for tab from URL
    this.route.queryParams.pipe(takeUntil(this.destroy$)).subscribe(params => {
      const tab = params['tab'];
      if (params['returnTo'] === 'directory' || params['returnTo'] === 'dashboard' || params['returnTo'] === 'registry') {
        this.returnTo = params['returnTo'];
      }
      if (tab && this.tabLabels[tab as keyof typeof this.tabLabels]) {
        this.activeTab = tab as typeof this.activeTab;
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // FORM
  // ============================================================

  private buildEditForm(): FormGroup {
    return this.fb.group({
      companyName: ['', Validators.required],
      registrationNumber: ['', Validators.required],
      taxId: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', Validators.required],
      website: [''],
      description: [''],
      paymentTerms: [''],
      tier: ['', Validators.required],
      status: ['', Validators.required],
      address: this.fb.group({
        street: ['', Validators.required],
        city: ['', Validators.required],
        state: ['', Validators.required],
        country: ['', Validators.required],
        postalCode: ['', Validators.required]
      }),
      bankDetails: this.fb.group({
        bankName: [''],
        accountNumber: [''],
        accountName: [''],
        swiftCode: ['']
      }),
      contacts: this.fb.array([])
    });
  }

  private updateEditForm(vendor: Vendor): void {
    this.editForm.patchValue({
      companyName: vendor.companyName,
      registrationNumber: vendor.registrationNumber,
      taxId: vendor.taxId,
      email: vendor.email,
      phone: vendor.phone,
      website: vendor.website || '',
      description: vendor.description || '',
      paymentTerms: vendor.paymentTerms || '',
      tier: vendor.tier,
      status: vendor.status,
      address: {
        street: vendor.address.street,
        city: vendor.address.city,
        state: vendor.address.state,
        country: vendor.address.country,
        postalCode: vendor.address.postalCode
      },
      bankDetails: {
        bankName: vendor.bankDetails?.bankName || '',
        accountNumber: vendor.bankDetails?.accountNumber || '',
        accountName: vendor.bankDetails?.accountName || '',
        swiftCode: vendor.bankDetails?.swiftCode || ''
      }
    });
  }

  // ============================================================
  // DATA LOADING
  // ============================================================

  loadVendorData(): void {
    this.isLoading = true;
    this.error = null;

    // Load vendor details
    this.vendorService.getVendorById(this.vendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (vendor) => {
          this.vendor = vendor;
          // Seed immediately from the vendor's own record — loadRelatedData()'s
          // dedicated documents call may fail/fall back before it resolves, and
          // this is the vendor's real registration data either way.
          this.documents = vendor.documents || [];
          this.updateEditForm(vendor);
          this.isLoading = false;
          // Load related data
          this.loadRelatedData();
        },
        error: (err) => {
          console.error('Failed to load vendor:', err);
          this.error = 'Failed to load vendor details';
          this.isLoading = false;
        }
      });
  }

  loadRelatedData(): void {
    // Load documents
    this.vendorService.getVendorDocuments(this.vendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (docs) => {
          this.documents = docs;
        },
        error: (err) => console.error('Failed to load documents:', err)
      });

    // Load performance
    this.vendorService.getVendorPerformance(this.vendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          console.log('Performance data received:', response);
          this.performance = response.metrics;
          this.preparePerformanceChart();
        },
        error: (err) => console.error('Failed to load performance:', err)
      });

    // Load lifecycle
    this.vendorService.getLifecycleHistory(this.vendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (history) => {
          this.lifecycleHistory = history;
        },
        error: (err) => console.error('Failed to load lifecycle:', err)
      });

    // Load contracts
    this.vendorService.getVendorContracts(this.vendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (contracts) => {
          this.contracts = contracts;
        },
        error: (err) => console.error('Failed to load contracts:', err)
      });

    // Load risk alerts - FIXED: Pass vendorId
    this.vendorService.getRiskAlerts(this.vendorId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (alerts) => {
          console.log('Risk alerts received:', alerts);
          this.riskAlerts = alerts;
        },
        error: (err) => console.error('Failed to load risk alerts:', err)
      });
  }

  // ============================================================
  // PERFORMANCE CHART
  // ============================================================

  preparePerformanceChart(): void {
    if (!this.performance?.trendData) return;

    this.performanceChartData = {
      labels: this.performance.trendData.map(d => d.period),
      datasets: [
        {
          label: 'Overall Score',
          data: this.performance.trendData.map(d => d.score),
          color: '#184440'
        },
        {
          label: 'On-Time Delivery',
          data: this.performance.trendData.map(d => d.onTimeDelivery),
          color: '#2EB270'
        },
        {
          label: 'Quality',
          data: this.performance.trendData.map(d => d.quality),
          color: '#F5A623'
        }
      ]
    };
  }

  // ============================================================
  // TAB MANAGEMENT
  // ============================================================

  setActiveTab(tab: any): void {
    this.activeTab = tab;
    // Update URL query param
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab: tab },
      queryParamsHandling: 'merge'
    });
  }

  getTabClass(tab: typeof this.activeTab): string {
    return this.activeTab === tab ? 'active' : '';
  }

  // ============================================================
  // EDIT MODE
  // ============================================================

  toggleEdit(): void {
    if (this.isEditing) {
      // Cancel editing
      this.isEditing = false;
      if (this.vendor) {
        this.updateEditForm(this.vendor);
      }
    } else {
      this.isEditing = true;
    }
  }

  saveVendor(): void {
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.isSaving = true;
    const formValue = this.editForm.value;

    this.vendorService.updateVendor(this.vendorId, formValue)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.vendor = updated;
          this.isEditing = false;
          this.isSaving = false;
          console.log('Vendor updated successfully');
        },
        error: (err) => {
          console.error('Failed to update vendor:', err);
          this.isSaving = false;
        }
      });
  }

  // ============================================================
  // STATUS MANAGEMENT
  // ============================================================

  changeStatus(status: VendorStatus): void {
    this.showStatusDropdown = false;

    const statusLabels: Record<VendorStatus, string> = {
      [VendorStatus.ACTIVE]: 'Activate',
      [VendorStatus.INACTIVE]: 'Deactivate',
      [VendorStatus.PENDING_ONBOARDING]: 'Set to Pending',
      [VendorStatus.UNDER_REVIEW]: 'Set to Under Review',
      [VendorStatus.SUSPENDED]: 'Suspend',
      [VendorStatus.OFFBOARDED]: 'Offboard',
      [VendorStatus.CONDITIONAL]: 'Set to Conditional',
      [VendorStatus.REJECTED]: 'Reject'
    };

    if (status === VendorStatus.SUSPENDED) {
      this.showConfirmDialog = true;
      this.confirmAction = 'suspend';
      this.confirmMessage = `Are you sure you want to suspend ${this.vendor?.companyName}? This will prevent them from participating in new opportunities.`;
    } else if (status === VendorStatus.OFFBOARDED) {
      this.showConfirmDialog = true;
      this.confirmAction = 'offboard';
      this.confirmMessage = `Are you sure you want to offboard ${this.vendor?.companyName}? This will revoke all access and finalize all orders.`;
    } else {
      this.executeStatusChange(status);
    }
  }

  executeStatusChange(status: VendorStatus): void {
    if (!this.vendor) return;

    this.isSaving = true;
    this.vendorService.updateVendorStatus(this.vendorId, status)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (updated) => {
          this.vendor = updated;
          this.isSaving = false;
          this.showConfirmDialog = false;
          this.confirmAction = null;
          console.log(`Vendor status updated to ${status}`);
        },
        error: (err) => {
          console.error('Failed to update status:', err);
          this.isSaving = false;
          this.showConfirmDialog = false;
          this.confirmAction = null;
        }
      });
  }

  confirmDialogAction(): void {
    if (!this.confirmAction) return;

    switch (this.confirmAction) {
      case 'suspend':
        this.executeStatusChange(VendorStatus.SUSPENDED);
        break;
      case 'activate':
        this.executeStatusChange(VendorStatus.ACTIVE);
        break;
      case 'offboard':
        this.executeStatusChange(VendorStatus.OFFBOARDED);
        break;
      case 'delete':
        this.deleteVendor();
        break;
      default:
        break;
    }
  }

  cancelDialog(): void {
    this.showConfirmDialog = false;
    this.confirmAction = null;
    this.confirmMessage = '';
  }

  // ============================================================
  // DELETE
  // ============================================================

  deleteVendor(): void {
    console.log('Deleting vendor...');
    this.showConfirmDialog = false;
    this.confirmAction = null;
    this.router.navigate(['/admin/sales/commerce/manage-vendors']);
  }

  // ============================================================
  // TEMPLATE HELPERS & GETTERS
  // ============================================================

  getTabLabel(tab: string): string {
    return this.tabLabels[tab as keyof typeof this.tabLabels] || tab;
  }

  // ============================================================
  // REGISTRATION TAB HELPERS
  // ============================================================

  get registration() {
    return this.vendor?.registration ?? null;
  }

  getBusinessTypeLabel(type?: string): string {
    return (type && BUSINESS_TYPE_LABELS[type as keyof typeof BUSINESS_TYPE_LABELS]) || type || '—';
  }

  getBusinessSizeLabel(size?: string): string {
    return (size && BUSINESS_SIZE_LABELS[size as keyof typeof BUSINESS_SIZE_LABELS]) || size || '—';
  }

  getOwnershipTypeLabel(type?: string): string {
    return (type && OWNERSHIP_TYPE_LABELS[type as keyof typeof OWNERSHIP_TYPE_LABELS]) || type || '—';
  }

  getSupplyCategoryLabel(cat?: string): string {
    return (cat && SUPPLY_CATEGORY_LABELS[cat as keyof typeof SUPPLY_CATEGORY_LABELS]) || cat || '—';
  }

  getSupplyCategoryLabels(cats?: string[]): string {
    return (cats || []).map(c => this.getSupplyCategoryLabel(c)).join(', ') || '—';
  }

  getDeliveryRegionLabels(regions?: string[]): string {
    return (regions || []).map(r => r.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())).join(', ') || '—';
  }

  yesNo(val?: boolean): string {
    return val ? 'Yes' : 'No';
  }

  get openRiskAlertsCount(): number {
    return this.riskAlerts ? this.riskAlerts.filter(a => a.status === 'OPEN').length : 0;
  }

  get expiringOrExpiredDocsCount(): number {
    return this.documents ? this.documents.filter(d => d.status === DocumentStatus.EXPIRING_SOON || d.status === DocumentStatus.EXPIRED).length : 0;
  }

  getPerformanceScores(): number[] {
    return this.performance?.trendData?.map(d => d.score) || [];
  }

  parseKpiValue(val: any): number {
    if (typeof val === 'number') return val;
    return parseFloat(val) || 0;
  }

  // ============================================================
  // NAVIGATION
  // ============================================================

  navigateToEdit(): void {
    this.router.navigate(['/admin/sales/commerce/manage-vendors', this.vendorId, 'edit']);
  }

  navigateToPerformance(): void {
    this.setActiveTab('performance');
  }

  navigateToRisk(): void {
    this.setActiveTab('risk');
  }

  navigateToDocuments(): void {
    this.setActiveTab('documents');
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  getVendorStatusColor(status: VendorStatus): string {
    return getVendorStatusColor(status);
  }

  getVendorTierLabel(tier: VendorTier): string {
    return getVendorTierLabel(tier);
  }

  getRiskLevelColor(level: RiskLevel): string {
    return getRiskLevelColor(level);
  }

  getDocumentStatusColor(status: DocumentStatus): string {
    return getDocumentStatusColor(status);
  }

  getDocumentStatusLabel(status: DocumentStatus): string {
    const map: Record<DocumentStatus, string> = {
      [DocumentStatus.ACTIVE]: 'Active',
      [DocumentStatus.EXPIRING_SOON]: 'Expiring Soon',
      [DocumentStatus.EXPIRED]: 'Expired',
      [DocumentStatus.PENDING_VERIFICATION]: 'Pending',
      [DocumentStatus.REJECTED]: 'Rejected'
    };
    return map[status] || status;
  }

  getStatusLabel(status: VendorStatus): string {
    const map: Record<VendorStatus, string> = {
      [VendorStatus.ACTIVE]: 'Active',
      [VendorStatus.INACTIVE]: 'Inactive',
      [VendorStatus.PENDING_ONBOARDING]: 'Pending Onboarding',
      [VendorStatus.UNDER_REVIEW]: 'Under Review',
      [VendorStatus.SUSPENDED]: 'Suspended',
      [VendorStatus.OFFBOARDED]: 'Offboarded',
      [VendorStatus.CONDITIONAL]: 'Conditional',
      [VendorStatus.REJECTED]: 'Rejected'
    };
    return map[status] || status;
  }

  getTierLabel(tier: VendorTier): string {
    const map: Record<VendorTier, string> = {
      [VendorTier.PREFERRED]: '⭐ Preferred',
      [VendorTier.APPROVED]: '✓ Approved',
      [VendorTier.CONDITIONAL]: '⚠️ Conditional'
    };
    return map[tier] || tier;
  }

  formatDate(date: any): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(date: any): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatCurrency(value: number): string {
    if (!value) return '—';
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  }

  formatNumber(value: number): string {
    if (!value) return '—';
    if (value >= 1000000) {
      return (value / 1000000).toFixed(1) + 'M';
    }
    if (value >= 1000) {
      return (value / 1000).toFixed(1) + 'K';
    }
    return value.toString();
  }

  getDaysUntilExpiry(date: Date): number {
    const now = new Date();
    const expiry = new Date(date);
    const diff = expiry.getTime() - now.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  getPerformanceColor(score: number): string {
    if (score >= 80) return '#2EB270';
    if (score >= 60) return '#F5A623';
    if (score >= 40) return '#F97316';
    return '#DC2626';
  }

  getPerformanceLabel(score: number): string {
    if (score >= 80) return 'Excellent';
    if (score >= 60) return 'Good';
    if (score >= 40) return 'Fair';
    return 'Poor';
  }

  getRiskSeverityClass(severity: string): string {
    const map: Record<string, string> = {
      'CRITICAL': 'critical',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low',
      'INFO': 'info'
    };
    return map[severity] || 'info';
  }

  getRiskSeverityIcon(severity: string): string {
    const map: Record<string, string> = {
      'CRITICAL': 'fa-exclamation-triangle',
      'HIGH': 'fa-exclamation-circle',
      'MEDIUM': 'fa-exclamation',
      'LOW': 'fa-info-circle',
      'INFO': 'fa-info'
    };
    return map[severity] || 'fa-info';
  }

  getLifecycleEventIcon(event: string): string {
    const map: Record<string, string> = {
      'APPLIED': 'fa-user-plus',
      'DOCUMENTS_SUBMITTED': 'fa-file-upload',
      'UNDER_REVIEW': 'fa-search',
      'APPROVED': 'fa-check-circle',
      'REJECTED': 'fa-times-circle',
      'ACTIVATED': 'fa-play-circle',
      'SUSPENDED': 'fa-pause-circle',
      'OFFBOARDED': 'fa-stop-circle'
    };
    return map[event] || 'fa-circle';
  }

  getLifecycleEventColor(event: string): string {
    const map: Record<string, string> = {
      'APPLIED': '#F5A623',
      'DOCUMENTS_SUBMITTED': '#184440',
      'UNDER_REVIEW': '#F97316',
      'APPROVED': '#2EB270',
      'REJECTED': '#DC2626',
      'ACTIVATED': '#2EB270',
      'SUSPENDED': '#DC2626',
      'OFFBOARDED': '#6B7280'
    };
    return map[event] || '#6B7280';
  }

  getContractStatusClass(status: string): string {
    const map: Record<string, string> = {
      'ACTIVE': 'active',
      'EXPIRING': 'expiring',
      'EXPIRED': 'expired',
      'TERMINATED': 'terminated'
    };
    return map[status] || 'active';
  }

  getAlertSeverityClass(severity: string): string {
    const map: Record<string, string> = {
      'CRITICAL': 'critical',
      'WARNING': 'warning',
      'INFO': 'info'
    };
    return map[severity] || 'info';
  }

  getStatusOptions(): VendorStatus[] {
    return [
      VendorStatus.ACTIVE,
      VendorStatus.INACTIVE,
      VendorStatus.PENDING_ONBOARDING,
      VendorStatus.UNDER_REVIEW,
      VendorStatus.SUSPENDED,
      VendorStatus.CONDITIONAL,
      VendorStatus.OFFBOARDED
    ];
  }

  // ============================================================
  // CHART HELPERS (for inline SVG charts)
  // ============================================================

  getMaxPerformance(): number {
    if (!this.performance?.trendData || this.performance.trendData.length === 0) return 100;
    const max = Math.max(...this.performance.trendData.map(d => d.score));
    return Math.ceil(max / 10) * 10 + 10;
  }

  getPointX(index: number, total: number): number {
    const padding = 40;
    const width = 500 - padding * 2;
    return padding + (index / (total - 1 || 1)) * width;
  }

  getPointY(value: number, max: number): number {
    const padding = 20;
    const height = 260 - padding * 2;
    return padding + height - (value / max) * height;
  }

  getPerformanceChartPath(data: number[], max: number): string {
    if (!data || data.length === 0) return '';

    return data.map((d, i) => {
      const x = this.getPointX(i, data.length);
      const y = this.getPointY(d, max);
      return (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }).join(' ');
  }

  getPerformanceChartAreaPath(data: number[], max: number): string {
    if (!data || data.length === 0) return '';

    const path = data.map((d, i) => {
      const x = this.getPointX(i, data.length);
      const y = this.getPointY(d, max);
      return (i === 0 ? 'M' : 'L') + `${x},${y}`;
    }).join(' ');

    const lastX = this.getPointX(data.length - 1, data.length);
    const firstX = this.getPointX(0, data.length);
    const baseY = this.getPointY(0, max);
    return path + ` L${lastX},${baseY} L${firstX},${baseY} Z`;
  }

  // ============================================================
  // DOCUMENT HANDLERS
  // ============================================================

  handleDocumentUpload(event: { file: File; category: DocumentCategory; issueDate: Date; expiryDate: Date }): void {
    this.vendorService.uploadDocument(
      this.vendorId,
      event.file,
      event.category,
      event.issueDate,
      event.expiryDate
    ).pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (doc) => {
          console.log('Document uploaded:', doc);
          this.loadRelatedData();
        },
        error: (err) => {
          console.error('Failed to upload document:', err);
        }
      });
  }

  handleDocumentDelete(documentId: string): void {
    this.vendorService.deleteDocument(documentId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('Document deleted');
          this.loadRelatedData();
        },
        error: (err) => {
          console.error('Failed to delete document:', err);
        }
      });
  }

  handleDocumentVerify(event: { documentId: string; verified: boolean; notes?: string }): void {
    this.vendorService.verifyDocument(event.documentId, event.verified, event.notes)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          console.log('Document verified:', event.verified);
          this.loadRelatedData();
        },
        error: (err) => {
          console.error('Failed to verify document:', err);
        }
      });
  }

  // ============================================================
  // REFRESH
  // ============================================================

  refresh(): void {
    this.loadVendorData();
  }

  // ============================================================
  // ERROR HANDLING
  // ============================================================

  retry(): void {
    this.loadVendorData();
  }
}