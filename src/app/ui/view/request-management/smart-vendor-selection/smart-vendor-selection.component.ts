import { Component, Input, Output, EventEmitter, OnInit } from '@angular/core';
import { VendorSuggestion } from '../../../domain/procurement-request/procurement.dto';

@Component({
  selector: 'app-smart-vendor-selection',
  templateUrl: './smart-vendor-selection.component.html',
  styleUrls: ['./smart-vendor-selection.component.scss']
})
export class SmartVendorSelectionComponent implements OnInit {
  @Input() vendors: VendorSuggestion[] = [];
  @Input() requestData: any = {};
  @Output() vendorSelected = new EventEmitter<string>();
  @Output() closed = new EventEmitter<void>();

  activeTab: 'ai-ranking' | 'performance' | 'risk' = 'ai-ranking';
  expandedVendor: string | null = null;
  sortField: 'matchScore' | 'rating' | 'totalProjects' | 'completionRate' = 'matchScore';
  sortDir: 'asc' | 'desc' = 'desc';
  panelVisible = false;

  ngOnInit(): void {
    // Trigger slide-in animation after mount
    setTimeout(() => { this.panelVisible = true; }, 10);
  }

  get sortedVendors(): VendorSuggestion[] {
    return [...this.vendors].sort((a, b) => {
      const aVal = (a as any)[this.sortField] ?? 0;
      const bVal = (b as any)[this.sortField] ?? 0;
      const diff = (bVal as number) - (aVal as number);
      return this.sortDir === 'desc' ? diff : -diff;
    });
  }

  getScoreBreakdown(v: VendorSuggestion): { label: string; score: number; color: string; icon: string; weight: number }[] {
    const catScore = v.isRecommended ? Math.min(100, v.matchScore + 8) : Math.round(v.matchScore * 0.55);
    const perfScore = Math.min(100, v.completionRate);
    const tierScore = v.isRecommended ? 85 : v.matchScore >= 60 ? 65 : 45;
    const respScore = v.averageResponseTime > 0 ? Math.max(20, 100 - v.averageResponseTime * 6) : 72;

    return [
      { label: 'Category Match',   score: catScore,  color: '#184440', icon: 'fa-tag',       weight: 40 },
      { label: 'Past Performance', score: perfScore,  color: '#2a736e', icon: 'fa-chart-bar', weight: 30 },
      { label: 'Tier Status',      score: tierScore,  color: '#7c3aed', icon: 'fa-shield-alt',weight: 15 },
      { label: 'Response Rate',    score: respScore,  color: '#e8a838', icon: 'fa-bolt',      weight: 15 },
    ];
  }

  getRiskLevel(v: VendorSuggestion): 'LOW' | 'MEDIUM' | 'HIGH' {
    if (v.matchScore >= 78) return 'LOW';
    if (v.matchScore >= 55) return 'MEDIUM';
    return 'HIGH';
  }

  getDeliveryGrade(v: VendorSuggestion): 'A' | 'B' | 'C' | 'D' {
    if (v.completionRate >= 90) return 'A';
    if (v.completionRate >= 75) return 'B';
    if (v.completionRate >= 55) return 'C';
    return 'D';
  }

  getRiskFactors(v: VendorSuggestion): string[] {
    const factors: string[] = [];
    if (v.matchScore < 60)          factors.push('Low category alignment');
    if (v.completionRate < 70)      factors.push('Below-average delivery rate');
    if (v.totalProjects < 5)        factors.push('Limited project history');
    if (v.averageResponseTime > 48) factors.push('Slow response time');
    if (!v.isRecommended)           factors.push('Not AI-recommended for this category');
    return factors.length ? factors : ['No significant risk factors identified'];
  }

  getRiskMitigation(v: VendorSuggestion): string {
    const risk = this.getRiskLevel(v);
    if (risk === 'LOW') return 'Standard procurement process applies. Monitor delivery timeline.';
    if (risk === 'MEDIUM') return 'Include performance clauses in the LPO. Schedule mid-delivery check-in.';
    return 'Consider requiring a performance bond or partial-payment structure. Add penalty clauses for late delivery.';
  }

  getAiNarrative(v: VendorSuggestion): string {
    const tier = this.getTierLabel(v);
    const grade = this.getDeliveryGrade(v);
    const category = v.categories[0] || 'this category';
    const risk = this.getRiskLevel(v);

    if (v.isRecommended && v.matchScore >= 80) {
      return `${v.vendorName} is a top-tier match for your procurement request with a ${v.matchScore}% alignment score. ` +
        `As a ${tier} vendor specialising in ${category}, they have completed ${v.totalProjects} projects with a ` +
        `${v.completionRate}% on-time delivery rate (Grade ${grade}). Their rapid response time and consistent performance ` +
        `data make them the AI's primary recommendation. Risk level is ${risk}, indicating a high-confidence selection.`;
    }
    if (v.isRecommended) {
      return `${v.vendorName} is recommended by OptimaX AI based on a strong ${v.matchScore}% match score for ${category} requirements. ` +
        `With ${v.totalProjects} completed projects and a delivery grade of ${grade}, they represent a reliable choice. ` +
        `Their ${tier} tier status further validates their standing in your approved vendor list.`;
    }
    return `${v.vendorName} is an ${tier} vendor with a ${v.matchScore}% match score. While not the primary recommendation, ` +
      `they have demonstrated ${v.completionRate}% delivery reliability across ${v.totalProjects} projects. ` +
      `Including this vendor widens your competitive quoting pool and can yield better pricing. Risk level: ${risk}.`;
  }

  private getTierLabel(v: VendorSuggestion): string {
    if (v.matchScore >= 90) return 'Platinum';
    if (v.matchScore >= 75) return 'Gold';
    if (v.matchScore >= 60) return 'Silver';
    return 'Standard';
  }

  getRankMedal(index: number): string {
    if (index === 0) return 'gold';
    if (index === 1) return 'silver';
    if (index === 2) return 'bronze';
    return '';
  }

  getMedalIcon(index: number): string {
    if (index === 0) return 'fa-trophy';
    if (index === 1) return 'fa-medal';
    if (index === 2) return 'fa-award';
    return 'fa-circle';
  }

  getPerformanceColor(value: number, maxVal: number): 'green' | 'yellow' | 'red' {
    const pct = (value / maxVal) * 100;
    if (pct >= 70) return 'green';
    if (pct >= 40) return 'yellow';
    return 'red';
  }

  getMatchColor(score: number): string {
    if (score >= 90) return '#7c3aed';
    if (score >= 75) return '#184440';
    if (score >= 60) return '#2a736e';
    return '#e8a838';
  }

  getInitials(name: string): string {
    return name.split(' ').slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('');
  }

  getAvatarGradient(name: string): string {
    const gradients = [
      'linear-gradient(135deg, #184440 0%, #2a736e 100%)',
      'linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)',
      'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)',
      'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
      'linear-gradient(135deg, #065f46 0%, #059669 100%)',
    ];
    return gradients[name.charCodeAt(0) % gradients.length];
  }

  toggleExpand(id: string): void {
    this.expandedVendor = this.expandedVendor === id ? null : id;
  }

  selectVendor(vendorId: string): void {
    this.vendorSelected.emit(vendorId);
  }

  setSort(field: typeof this.sortField): void {
    if (this.sortField === field) {
      this.sortDir = this.sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      this.sortField = field;
      this.sortDir = 'desc';
    }
  }

  closePanel(): void {
    this.panelVisible = false;
    setTimeout(() => { this.closed.emit(); }, 300);
  }

  trackByVendorId(_index: number, v: VendorSuggestion): string {
    return v.vendorId;
  }

  getPerformanceCols(): { label: string; key: string; max: number; unit: string }[] {
    return [
      { label: 'Match Score',   key: 'matchScore',       max: 100, unit: '%' },
      { label: 'Projects',      key: 'totalProjects',    max: 50,  unit: ''  },
      { label: 'Delivery Rate', key: 'completionRate',   max: 100, unit: '%' },
      { label: 'Rating',        key: 'rating',           max: 5,   unit: '/5' },
      { label: 'Response (h)',  key: 'averageResponseTime', max: 100, unit: 'h' },
    ];
  }

  getVendorColValue(vendor: VendorSuggestion, key: string): number {
    return Number((vendor as any)[key]) || 0;
  }

  getBestVendorForCol(key: string): string {
    if (this.sortedVendors.length === 0) return '';
    const best = [...this.sortedVendors].sort((a, b) => {
      if (key === 'averageResponseTime') {
        return (a as any)[key] - (b as any)[key];
      }
      return (b as any)[key] - (a as any)[key];
    })[0];
    return best.vendorId;
  }
}
