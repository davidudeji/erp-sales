// risk.component.ts - Fixed version

import { Component, Input } from '@angular/core';
import {
  Vendor,
  VendorStatus,
  VendorTier,
  RiskLevel,
  RiskAlert,
  AlertSeverity,
  getVendorStatusColor,
  getVendorTierLabel,
  getRiskLevelColor
} from '../../../../domain/vendor-management/vendor-management.dto';

@Component({
  selector: 'app-vendor-risk',
  templateUrl: './risk.component.html',
  styleUrls: ['./risk.component.scss']
})
export class RiskComponent {

  @Input() vendor: Vendor | null = null;
  @Input() riskAlerts: RiskAlert[] = [];

  RiskLevel = RiskLevel;
  AlertSeverity = AlertSeverity;
  Math = Math;

  getRiskLevelColor(level: RiskLevel): string {
    return getRiskLevelColor(level);
  }

  getVendorStatusColor(status: VendorStatus): string {
    return getVendorStatusColor(status);
  }

  getVendorTierLabel(tier: VendorTier): string {
    return getVendorTierLabel(tier);
  }

  getRiskSeverityClass(severity: string): string {
    const map: Record<string, string> = {
      'CRITICAL': 'critical',
      'WARNING': 'warning',
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
      'WARNING': 'fa-exclamation-circle',
      'HIGH': 'fa-exclamation-circle',
      'MEDIUM': 'fa-exclamation',
      'LOW': 'fa-info-circle',
      'INFO': 'fa-info'
    };
    return map[severity] || 'fa-info';
  }

  getAlertSeverityClass(severity: string): string {
    const map: Record<string, string> = {
      'CRITICAL': 'critical',
      'WARNING': 'warning',
      'HIGH': 'high',
      'MEDIUM': 'medium',
      'LOW': 'low',
      'INFO': 'info'
    };
    return map[severity] || 'info';
  }

  formatDateTime(date: Date | undefined): string {
    if (!date) return '—';
    return new Date(date).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getStatusLabel(status: string): string {
    return status.replace(/_/g, ' ').toLowerCase()
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  // ============================================================
  // COMPUTED PROPERTIES - Using string comparisons
  // ============================================================

  get openRiskAlertsCount(): number {
    return this.riskAlerts ? this.riskAlerts.filter(a => a.status === 'OPEN' || a.status === 'IN_PROGRESS').length : 0;
  }

  get criticalRiskAlerts(): RiskAlert[] {
  return this.riskAlerts ? this.riskAlerts.filter(a => 
    a.severity === AlertSeverity.CRITICAL
  ) : [];
}

  get warningRiskAlerts(): RiskAlert[] {
  return this.riskAlerts ? this.riskAlerts.filter(a => 
    a.severity === AlertSeverity.WARNING
  ) : [];
}

get infoRiskAlerts(): RiskAlert[] {
  return this.riskAlerts ? this.riskAlerts.filter(a => 
    a.severity === AlertSeverity.INFO
  ) : [];
}

get highRiskAlerts(): RiskAlert[] {
  return this.riskAlerts ? this.riskAlerts.filter(a => 
    (a.severity as string) === 'HIGH'
  ) : [];
}

get mediumRiskAlerts(): RiskAlert[] {
  return this.riskAlerts ? this.riskAlerts.filter(a => 
    (a.severity as string) === 'MEDIUM'
  ) : [];
}

get lowRiskAlerts(): RiskAlert[] {
  return this.riskAlerts ? this.riskAlerts.filter(a => 
    (a.severity as string) === 'LOW'
  ) : [];
}

  get openAlertsBySeverity(): { severity: string; count: number; color: string }[] {
    const openAlerts = this.riskAlerts.filter(a => a.status === 'OPEN' || a.status === 'IN_PROGRESS');
    const severityMap: Record<string, { count: number; color: string }> = {
      'CRITICAL': { count: 0, color: '#DC2626' },
      'WARNING': { count: 0, color: '#F97316' },
      'HIGH': { count: 0, color: '#F97316' },
      'MEDIUM': { count: 0, color: '#F59E0B' },
      'LOW': { count: 0, color: '#184440' },
      'INFO': { count: 0, color: '#3B82F6' }
    };

    openAlerts.forEach(alert => {
      const severity = alert.severity || 'INFO';
      if (severityMap[severity]) {
        severityMap[severity].count++;
      }
    });

    return Object.entries(severityMap)
      .filter(([_, data]) => data.count > 0)
      .map(([severity, data]) => ({ severity, count: data.count, color: data.color }));
  }

  get hasComplianceStatus(): boolean {
    return !!this.vendor?.complianceStatus;
  }

  get complianceStatus() {
    return this.vendor?.complianceStatus;
  }

  get documentsVerifiedPercentage(): number {
    const status = this.vendor?.complianceStatus;
    if (!status || !status.totalRequiredDocuments || status.totalRequiredDocuments === 0) {
      return 0;
    }
    return (status.documentsVerified / status.totalRequiredDocuments) * 100;
  }

  get docsVerified(): number {
    return this.vendor?.complianceStatus?.documentsVerified || 0;
  }

  get totalRequiredDocs(): number {
    return this.vendor?.complianceStatus?.totalRequiredDocuments || 0;
  }

  get expiredDocs(): number {
    return this.vendor?.complianceStatus?.expiredDocuments || 0;
  }

  get expiringDocs(): number {
    return this.vendor?.complianceStatus?.expiringDocuments || 0;
  }

  get lastComplianceCheck(): Date | undefined {
    return this.vendor?.complianceStatus?.lastComplianceCheck;
  }
}