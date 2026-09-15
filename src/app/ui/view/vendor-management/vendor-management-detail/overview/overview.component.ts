// overview.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { 
  Vendor, 
  VendorStatus, 
  VendorTier, 
  RiskLevel,
  getVendorStatusColor,
  getVendorTierLabel,
  getRiskLevelColor
} from '../../../../domain/vendor-management/vendor-management.dto';

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-overview',
  templateUrl: './overview.component.html',
  styleUrls: ['./overview.component.scss']
})
export class OverviewComponent {
  
  // ============================================================
  // INPUTS
  // ============================================================

  /** The vendor data to display */
  @Input() vendor!: Vendor;

  /** Emits when the user wants to navigate to the performance tab */
  @Output() navigateToPerformance = new EventEmitter<void>();

  /** Emits when the user wants to navigate to the risk tab */
  @Output() navigateToRisk = new EventEmitter<void>();

  /** Emits when the user wants to navigate to the documents tab */
  @Output() navigateToDocuments = new EventEmitter<void>();

  /** Emits when the user wants to navigate to the edit page */
  @Output() navigateToEdit = new EventEmitter<void>();

  // ============================================================
  // ENUMS FOR TEMPLATE
  // ============================================================

  VendorStatus = VendorStatus;
  VendorTier = VendorTier;
  RiskLevel = RiskLevel;

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

  formatDate(date: Date): string {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
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

  getPerformanceColor(score: number): string {
    if (score >= 80) return '#2EB270';
    if (score >= 60) return '#F5A623';
    if (score >= 40) return '#F97316';
    return '#DC2626';
  }

  // ============================================================
  // EVENT EMITTERS
  // ============================================================

  onNavigateToPerformance(): void {
    this.navigateToPerformance.emit();
  }

  onNavigateToRisk(): void {
    this.navigateToRisk.emit();
  }

  onNavigateToDocuments(): void {
    this.navigateToDocuments.emit();
  }

  onNavigateToEdit(): void {
    this.navigateToEdit.emit();
  }
}