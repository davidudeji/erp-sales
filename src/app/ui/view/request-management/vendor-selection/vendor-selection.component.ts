import { Component, EventEmitter, Output, Input, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { VendorSuggestion } from '../../../domain/procurement-request/procurement.dto';
import { ExtendedProcurementRequest, parseIdToNumber } from '../../../service/procurement/rfq-quotation-bridge.util';
import { ProcurementRequestService } from '../../../service/procurement/procurement.service';
import { MessageService } from 'primeng/api';

@Component({
  selector: 'app-vendor-selection',
  templateUrl: './vendor-selection.component.html',
  styleUrls: ['./vendor-selection.component.scss']
})
export class VendorSelectionComponent implements OnInit {
  @Input() requestId: string = '';
  @Input() requestData: any = {};
  @Output() vendorsSelected = new EventEmitter<string[]>();
  @Output() back = new EventEmitter<void>();

  vendors: VendorSuggestion[] = [];
  selectedVendors: Set<string> = new Set();
  isLoading = false;
  searchTerm = '';
  filterCategory = '';
  filterTier: 'ALL' | 'PREFERRED' | 'APPROVED' = 'ALL';
  viewMode: 'grid' | 'list' | 'compare' = 'grid';
  showSmartPanel = false;
  comparisonVendors: VendorSuggestion[] = [];
  showAiBanner = true;
  shakeVendorId: string | null = null;
  vendorNotifCounts: Map<string, number> = new Map();

  get categories(): string[] {
    const allCategories = this.vendors.flatMap(v => v.categories);
    return [...new Set(allCategories)];
  }

  get recommendedCount(): number {
    return this.vendors.filter(v => v.isRecommended).length;
  }

  get filteredVendors(): VendorSuggestion[] {
    let filtered = this.vendors;

    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      filtered = filtered.filter(v =>
        v.vendorName.toLowerCase().includes(term) ||
        v.vendorCode.toLowerCase().includes(term) ||
        v.categories.some(c => c.toLowerCase().includes(term))
      );
    }

    if (this.filterCategory) {
      filtered = filtered.filter(v => v.categories.includes(this.filterCategory));
    }

    if (this.filterTier !== 'ALL') {
      const tier = this.filterTier;
      filtered = filtered.filter(v => v.reason.toUpperCase().includes(tier));
    }

    return filtered;
  }

  constructor(
    private procurementService: ProcurementRequestService,
    private router: Router,
    private route: ActivatedRoute,
    private messageService: MessageService
  ) {}

  ngOnInit(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid');
    if (uuid) {
      this.requestId = uuid;
    }
    this.loadVendorSuggestions();
  }

  loadVendorSuggestions(): void {
    this.isLoading = true;
    if (this.requestId) {
      this.procurementService.getRequest(parseIdToNumber(this.requestId)).subscribe({
        next: (req) => {
          const extendedReq = req as ExtendedProcurementRequest;
          this.procurementService.getVendorSuggestions(parseIdToNumber(this.requestId)).subscribe({
            next: (suggestions) => {
              this.vendors = suggestions;
              this.vendorNotifCounts.clear();
              this.vendors.forEach(v => {
                this.vendorNotifCounts.set(v.vendorId, Math.floor(Math.random() * 3));
              });
              this.selectedVendors.clear();
              if (extendedReq && extendedReq.selectedVendors && extendedReq.selectedVendors.length > 0) {
                extendedReq.selectedVendors.forEach((vId: any) => this.selectedVendors.add(vId));
              } else {
                const recommended = this.vendors.filter(v => v.isRecommended).slice(0, 3);
                recommended.forEach(v => this.selectedVendors.add(v.vendorId));
              }
              this.isLoading = false;
            },
            error: (err: any) => {
              console.error('Error loading vendor suggestions:', err);
              this.vendors = [];
              this.isLoading = false;
            }
          });
        },
        error: (err: any) => {
          console.error('Error loading request for vendor suggestions:', err);
          this.vendors = [];
          this.isLoading = false;
        }
      });
    } else {
      this.vendors = [];
      this.isLoading = false;
    }
  }

  toggleVendor(vendorId: string): void {
    if (this.selectedVendors.has(vendorId)) {
      this.selectedVendors.delete(vendorId);
    } else {
      if (this.selectedVendors.size < 3) {
        this.selectedVendors.add(vendorId);
        this.messageService.add({ severity: 'success', summary: 'Vendor Added', detail: 'Vendor added to your selection.' });
      } else {
        this.shakeVendorId = vendorId;
        setTimeout(() => { this.shakeVendorId = null; }, 600);
        this.messageService.add({ severity: 'warn', summary: 'Selection Full', detail: 'You can select a maximum of 3 vendors.' });
      }
    }
  }

  isVendorSelected(vendorId: string): boolean {
    return this.selectedVendors.has(vendorId);
  }

  getSelectedCount(): number {
    return this.selectedVendors.size;
  }

  addToCompare(vendor: VendorSuggestion): void {
    if (this.comparisonVendors.find(v => v.vendorId === vendor.vendorId)) {
      this.removeFromCompare(vendor);
      return;
    }
    if (this.comparisonVendors.length >= 3) {
      this.messageService.add({ severity: 'warn', summary: 'Compare Limit', detail: 'You can compare up to 3 vendors at a time.' });
      return;
    }
    this.comparisonVendors = [...this.comparisonVendors, vendor];
  }

  removeFromCompare(vendor: VendorSuggestion): void {
    this.comparisonVendors = this.comparisonVendors.filter(v => v.vendorId !== vendor.vendorId);
  }

  isInCompare(vendorId: string): boolean {
    return !!this.comparisonVendors.find(v => v.vendorId === vendorId);
  }

  getScoreBreakdown(vendor: VendorSuggestion): { category: string; score: number; weight: number }[] {
    return [
      { category: 'Category Match', score: vendor.isRecommended ? Math.min(100, vendor.matchScore + 5) : vendor.matchScore * 0.6, weight: 40 },
      { category: 'Past Performance', score: vendor.completionRate, weight: 30 },
      { category: 'Tier Status', score: vendor.isRecommended ? 85 : 55, weight: 15 },
      { category: 'Response Rate', score: vendor.averageResponseTime > 0 ? Math.max(30, 100 - vendor.averageResponseTime * 5) : 70, weight: 15 }
    ];
  }

  selectTopRecommended(): void {
    this.selectedVendors.clear();
    const top = this.vendors
      .filter(v => v.isRecommended)
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 3);
    top.forEach(v => this.selectedVendors.add(v.vendorId));
    this.messageService.add({ severity: 'success', summary: 'AI Selection Applied', detail: `${top.length} top recommended vendors selected.` });
  }

  getMatchTier(score: number): 'PLATINUM' | 'GOLD' | 'SILVER' | 'STANDARD' {
    if (score >= 90) return 'PLATINUM';
    if (score >= 75) return 'GOLD';
    if (score >= 60) return 'SILVER';
    return 'STANDARD';
  }

  getNotifCount(vendorId: string): number {
    return this.vendorNotifCounts.get(vendorId) ?? 0;
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
    const idx = name.charCodeAt(0) % gradients.length;
    return gradients[idx];
  }

  getStarArray(rating: number): number[] {
    return Array.from({ length: 5 }, (_, i) => i);
  }

  getStarFill(index: number, rating: number): 'full' | 'half' | 'empty' {
    if (index < Math.floor(rating)) return 'full';
    if (index < rating) return 'half';
    return 'empty';
  }

  dismissBanner(): void {
    this.showAiBanner = false;
  }

  setViewMode(mode: 'grid' | 'list' | 'compare'): void {
    this.viewMode = mode;
    if (mode === 'compare' && this.comparisonVendors.length === 0) {
      const top3 = this.filteredVendors.slice(0, 3);
      this.comparisonVendors = [...top3];
    }
  }

  getCompareRows(): { label: string; key: string; format: string }[] {
    return [
      { label: 'Match Score', key: 'matchScore', format: 'percent' },
      { label: 'Rating', key: 'rating', format: 'stars' },
      { label: 'Total Projects', key: 'totalProjects', format: 'number' },
      { label: 'Delivery Rate', key: 'completionRate', format: 'percent' },
      { label: 'Response Time', key: 'averageResponseTime', format: 'hours' },
      { label: 'Recommended', key: 'isRecommended', format: 'boolean' },
    ];
  }

  getCompareValue(vendor: VendorSuggestion, key: string, format: string): string {
    const val = (vendor as any)[key];
    if (format === 'percent') return `${val}%`;
    if (format === 'hours') return `${val}h`;
    if (format === 'boolean') return val ? 'Yes' : 'No';
    if (format === 'stars') return `${Number(val).toFixed(1)} / 5`;
    return String(val);
  }

  isBestInRow(vendor: VendorSuggestion, key: string): boolean {
    if (this.comparisonVendors.length < 2) return false;
    const vals = this.comparisonVendors.map(v => Number((v as any)[key]) || 0);
    return Number((vendor as any)[key]) === Math.max(...vals);
  }

  onNext(): void {
    if (this.selectedVendors.size === 0) {
      this.messageService.add({ severity: 'warn', summary: 'No Vendor Selected', detail: 'Please select at least one vendor to continue.' });
      return;
    }
    const uuid = this.route.snapshot.paramMap.get('uuid') || this.requestId;
    if (!uuid) return;

    this.procurementService.updateRequest(parseIdToNumber(uuid), {
      vendorsToNotify: Array.from(this.selectedVendors)
    } as any).subscribe({
      next: () => {
        const typePath = this.router.url.includes('/service') ? 'service' : 'product';
        this.router.navigate(['/admin/sales/commerce/requests/new', typePath, uuid, 'preview']);
      },
      error: (err) => {
        console.error('Failed to save selected vendors', err);
        this.messageService.add({ severity: 'error', summary: 'Error', detail: 'Failed to save your vendor selection. Please try again.' });
      }
    });
  }

  onBack(): void {
    const uuid = this.route.snapshot.paramMap.get('uuid') || this.requestId;
    if (uuid) {
      const typePath = this.router.url.includes('/service') ? 'service' : 'product';
      this.router.navigate(['/admin/sales/commerce/requests/new', typePath, uuid, 'template']);
    } else {
      this.router.navigate(['/admin/sales/commerce/requests/new']);
    }
  }

  handleSmartPanelSelect(vendorId: string): void {
    if (!this.selectedVendors.has(vendorId)) {
      if (this.selectedVendors.size < 3) {
        this.selectedVendors.add(vendorId);
      }
    }
    this.showSmartPanel = false;
  }

  trackByVendorId(_index: number, v: VendorSuggestion): string {
    return v.vendorId;
  }
}
