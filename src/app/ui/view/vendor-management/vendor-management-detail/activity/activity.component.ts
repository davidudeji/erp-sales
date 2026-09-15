// activity/activity.component.ts
// ============================================================
// IMPORTS
// ============================================================

import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { FormBuilder, FormGroup } from '@angular/forms';
import {
  VendorLifecycleHistory,
  getVendorStatusColor,
  getVendorTierLabel,
  getRiskLevelColor
} from '../../../../domain/vendor-management/vendor-management.dto';
import { VendorService } from '../../../../service/vendor-management/vendor-management.service';

// ============================================================
// INTERFACES
// ============================================================

export interface ActivityEvent extends VendorLifecycleHistory {
  icon: string;
  color: string;
  typeLabel: string;
  category: 'onboarding' | 'performance' | 'risk' | 'documents' | 'status' | 'general';
}

// ============================================================
// COMPONENT
// ============================================================

@Component({
  selector: 'app-vendor-activity',
  templateUrl: './activity.component.html',
  styleUrls: ['./activity.component.scss']
})
export class ActivityComponent implements OnInit, OnDestroy {

  // ============================================================
  // INPUTS
  // ============================================================

  @Input() vendorId: string = '';
  @Input() lifecycleHistory: VendorLifecycleHistory[] = [];

  // ============================================================
  // STATE
  // ============================================================

  /** All activity events */
  events: ActivityEvent[] = [];

  /** Filtered events based on search and filters */
  filteredEvents: ActivityEvent[] = [];

  /** Loading state */
  isLoading: boolean = false;

  /** Filter form */
  filterForm: FormGroup;

  /** Selected event for detail view */
  selectedEvent: ActivityEvent | null = null;

  /** Show detail modal */
  showEventDetail: boolean = false;

  /** Filter categories */
  categories = [
    { value: 'all', label: 'All Events' },
    { value: 'onboarding', label: 'Onboarding' },
    { value: 'performance', label: 'Performance' },
    { value: 'risk', label: 'Risk & Compliance' },
    { value: 'documents', label: 'Documents' },
    { value: 'status', label: 'Status Changes' },
    { value: 'general', label: 'General' }
  ];

  /** Private */
  private destroy$ = new Subject<void>();

  // ============================================================
  // CONSTRUCTOR
  // ============================================================

  constructor(
    private vendorService: VendorService,
    private fb: FormBuilder
  ) {
    this.filterForm = this.buildFilterForm();
  }

  // ============================================================
  // LIFECYCLE HOOKS
  // ============================================================

  ngOnInit(): void {
    this.processEvents();

    // Listen for filter changes
    this.filterForm.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.applyFilters();
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ============================================================
  // FORM BUILDING
  // ============================================================

  private buildFilterForm(): FormGroup {
    return this.fb.group({
      search: [''],
      category: ['all'],
      dateFrom: [''],
      dateTo: ['']
    });
  }

  // ============================================================
  // EVENT PROCESSING
  // ============================================================

  private processEvents(): void {
    this.events = this.lifecycleHistory.map(event => {
      const mapped = this.mapEventToActivity(event);
      return {
        ...event,
        ...mapped
      };
    });

    // Sort by date (newest first)
    this.events.sort((a, b) => {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });

    this.applyFilters();
  }

  private mapEventToActivity(event: VendorLifecycleHistory): Omit<ActivityEvent, keyof VendorLifecycleHistory> {
    const eventType = (event.event ?? 'GENERAL').toUpperCase();

    const map: Record<string, { icon: string; color: string; typeLabel: string; category: ActivityEvent['category'] }> = {
      'APPLIED': { icon: 'fa-user-plus', color: '#F5A623', typeLabel: 'Application Submitted', category: 'onboarding' },
      'DOCUMENTS_SUBMITTED': { icon: 'fa-file-upload', color: '#184440', typeLabel: 'Documents Submitted', category: 'documents' },
      'UNDER_REVIEW': { icon: 'fa-search', color: '#F97316', typeLabel: 'Under Review', category: 'onboarding' },
      'APPROVED': { icon: 'fa-check-circle', color: '#2EB270', typeLabel: 'Approved', category: 'onboarding' },
      'REJECTED': { icon: 'fa-times-circle', color: '#DC2626', typeLabel: 'Rejected', category: 'onboarding' },
      'ACTIVATED': { icon: 'fa-play-circle', color: '#2EB270', typeLabel: 'Activated', category: 'status' },
      'SUSPENDED': { icon: 'fa-pause-circle', color: '#DC2626', typeLabel: 'Suspended', category: 'status' },
      'REINSTATED': { icon: 'fa-undo', color: '#2EB270', typeLabel: 'Reinstated', category: 'status' },
      'OFFBOARDED': { icon: 'fa-stop-circle', color: '#6B7280', typeLabel: 'Offboarded', category: 'status' },
      'PERFORMANCE_UPDATE': { icon: 'fa-chart-line', color: '#184440', typeLabel: 'Performance Update', category: 'performance' },
      'RISK_ALERT': { icon: 'fa-exclamation-triangle', color: '#F59E0B', typeLabel: 'Risk Alert', category: 'risk' },
      'DOCUMENT_VERIFIED': { icon: 'fa-file-check', color: '#2EB270', typeLabel: 'Document Verified', category: 'documents' },
      'DOCUMENT_EXPIRED': { icon: 'fa-file-exclamation', color: '#DC2626', typeLabel: 'Document Expired', category: 'documents' },
      'CONTRACT_SIGNED': { icon: 'fa-file-signature', color: '#184440', typeLabel: 'Contract Signed', category: 'general' },
      'CONTRACT_RENEWED': { icon: 'fa-sync-alt', color: '#184440', typeLabel: 'Contract Renewed', category: 'general' },
      'TIER_CHANGED': { icon: 'fa-trophy', color: '#F5A623', typeLabel: 'Tier Changed', category: 'performance' },
      'GENERAL': { icon: 'fa-circle', color: '#6B7280', typeLabel: 'General Event', category: 'general' }
    };

    // Try to find exact match, fallback to partial match or default
    let mapping = map[eventType];
    if (!mapping) {
      // Try partial match
      const key = Object.keys(map).find(k => eventType.includes(k));
      mapping = key ? map[key] : map['GENERAL'];
    }

    return mapping;
  }

  // ============================================================
  // FILTERING
  // ============================================================

  applyFilters(): void {
    const formValue = this.filterForm.value;
    const search = formValue.search?.toLowerCase() || '';
    const category = formValue.category || 'all';
    const dateFrom = formValue.dateFrom ? new Date(formValue.dateFrom) : null;
    const dateTo = formValue.dateTo ? new Date(formValue.dateTo) : null;

    this.filteredEvents = this.events.filter(event => {
      // Search filter
      if (search) {
        const searchableText = [
          event.event,
          event.description,
          event.performedBy,
          event.typeLabel
        ].join(' ').toLowerCase();
        if (!searchableText.includes(search)) {
          return false;
        }
      }

      // Category filter
      if (category !== 'all' && event.category !== category) {
        return false;
      }

      // Date range filter
      const eventDate = new Date(event.timestamp);
      if (dateFrom && eventDate < dateFrom) {
        return false;
      }
      if (dateTo && eventDate > dateTo) {
        return false;
      }

      return true;
    });
  }

  resetFilters(): void {
    this.filterForm.reset({
      search: '',
      category: 'all',
      dateFrom: '',
      dateTo: ''
    });
  }

  getActiveFilterCount(): number {
    let count = 0;
    const formValue = this.filterForm.value;
    if (formValue.search) count++;
    if (formValue.category && formValue.category !== 'all') count++;
    if (formValue.dateFrom) count++;
    if (formValue.dateTo) count++;
    return count;
  }

  // ============================================================
  // EVENT DETAILS
  // ============================================================

  openEventDetail(event: ActivityEvent): void {
    this.selectedEvent = event;
    this.showEventDetail = true;
  }

  closeEventDetail(): void {
    this.showEventDetail = false;
    this.selectedEvent = null;
  }

  // ============================================================
  // UTILITY HELPERS
  // ============================================================

  formatDate(date: Date | string | null | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  }

  formatDateTime(date: Date | string | null | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatTime(date: Date | string | null | undefined): string {
    if (!date) return '—';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getCategoryLabel(category: string): string {
    const found = this.categories.find(c => c.value === category);
    return found ? found.label : category;
  }

  getEventBadgeColor(event: ActivityEvent): string {
    return event.color;
  }

  getEventBadgeStyle(event: ActivityEvent): { [key: string]: string } {
    return {
      'background': event.color + '20',
      'color': event.color,
      'border-color': event.color
    };
  }

  // ============================================================
  // TRACK BY
  // ============================================================

  trackByEventId(index: number, event: ActivityEvent): number {
    return event.id;
  }
}