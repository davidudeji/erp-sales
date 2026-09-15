import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import {
  VendorService,
  computeQuotationTotals,
  isQuotationSubmittable,
  isItemValid,
  lineTotal,
} from '../../../service/vendor-portal/vendor.service';
import { VendorPortalNavService } from '../../../service/vendor-portal/vendor-portal-nav.service';
import {
  Rfq,
  Quotation,
  QuotationItem,
  VendorStats,
  ItemAvailability,
  MAX_REVISION_ROUNDS,
  Lpo,
  Invoice,
  FinanceStats,
  LpoStats,
  VendorProfile,
  RfqAttachment,
  RfqAttachmentType,
} from '../../../domain/vendor-portal/vendor.dto';

// ── View mode for the right-hand panel ───────────────────────────────────────
type RightPanelView = 'welcome' | 'rfq-detail' | 'quotation-editor';

@Component({
  selector: 'app-pipeline',
  templateUrl: './pipeline.component.html',
  styleUrl: './pipeline.component.scss',
})
export class PipelineComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly MAX_REVISION_ROUNDS = MAX_REVISION_ROUNDS;

  // ── Data ─────────────────────────────────────────────────────────────────────
  rfqs: Rfq[] = [];
  quotations: Quotation[] = [];
  lpos: Lpo[] = [];
  invoices: Invoice[] = [];
  stats: VendorStats | null = null;
  financeStats: FinanceStats | null = null;
  lpoStats: LpoStats | null = null;
  profile: VendorProfile | null = null;

  // ── RFQ Inbox state ───────────────────────────────────────────────────────────
  selectedRfq: Rfq | null = null;
  activeQuotation: Quotation | null = null;
  quotationMode: 'view' | 'edit' | 'submit' = 'view';
  rfqSearchTerm = '';
  rfqFilter: 'all' | 'unread' | 'expiring' | 'converted' = 'all';
  submitting = false;
  expandedRfqId: string | null = null;
  validityDays = 14;
  quotationNotes = '';
  showSubmitConfirm = false;

  // ── Right panel view ──────────────────────────────────────────────────────────
  rightPanelView: RightPanelView = 'welcome';

  // ── Lightbox ─────────────────────────────────────────────────────────────────
  lightboxImage: { url: string; label: string } | null = null;

  constructor(
    private vendorService: VendorService,
    private nav: VendorPortalNavService,
  ) {}

  // ════════════════════════════════════════════════════════════════════════════
  //  LIFECYCLE
  // ════════════════════════════════════════════════════════════════════════════
  ngOnInit(): void {
    this.vendorService.loadRfqs();

    this.vendorService.getRfqs().pipe(takeUntil(this.destroy$)).subscribe((list) => {
      this.rfqs = list;
      // Keep selected RFQ in sync
      if (this.selectedRfq) {
        const fresh = list.find((r) => r.id === this.selectedRfq!.id);
        if (!fresh) { this.selectedRfq = null; this.rightPanelView = 'welcome'; }
      }
    });

    this.vendorService.getQuotations().pipe(takeUntil(this.destroy$)).subscribe((list) => {
      this.quotations = list;
      // Keep active quotation in sync with store updates
      if (this.activeQuotation) {
        const fresh = list.find((q) => q.id === this.activeQuotation!.id);
        if (fresh) {
          // Only sync if not in active edit mode — don't clobber user input
          if (this.rightPanelView !== 'quotation-editor') {
            this.activeQuotation = JSON.parse(JSON.stringify(fresh));
          }
        } else {
          this.activeQuotation = null;
        }
      }
    });

    this.vendorService.getLpos().pipe(takeUntil(this.destroy$)).subscribe((list) => (this.lpos = list));
    this.vendorService.getInvoices().pipe(takeUntil(this.destroy$)).subscribe((list) => (this.invoices = list));
    this.vendorService.getProfile().pipe(takeUntil(this.destroy$)).subscribe((p) => (this.profile = p));

    this.refreshStats();

    // Command palette hand-off
    this.nav.focusRequest$.pipe(takeUntil(this.destroy$)).subscribe((req) => {
      if (!req) return;
      if (req.kind === 'rfq') {
        const rfq = this.rfqs.find((r) => r.id === req.id);
        if (rfq) { this.selectRfq(rfq); this.nav.clearFocusRequest(); }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refreshStats(): void {
    this.vendorService.getVendorStats().pipe(take(1)).subscribe((s) => (this.stats = s));
    this.vendorService.getLpoStats().pipe(take(1)).subscribe((s) => (this.lpoStats = s));
    this.vendorService.getFinanceStats().pipe(take(1)).subscribe((s) => (this.financeStats = s));
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  RFQ INBOX — SELECTION & FILTERING
  // ════════════════════════════════════════════════════════════════════════════

  /** Select an RFQ from the sidebar; marks as read and loads its quotation. */
  selectRfq(rfq: Rfq): void {
    this.selectedRfq = rfq;
    if (!rfq.isRead) { this.vendorService.markRfqAsRead(rfq.id); }

    // Look for an existing quotation, or start with none
    const existing = this.quotations.find((q) => q.rfqId === rfq.id) ?? null;
    this.activeQuotation = existing ? JSON.parse(JSON.stringify(existing)) : null;
    this.quotationNotes = this.activeQuotation?.notes ?? '';
    this.validityDays = 14;
    this.rightPanelView = 'rfq-detail';
  }

  /** Clear selection and return to welcome screen. */
  clearSelection(): void {
    this.selectedRfq = null;
    this.activeQuotation = null;
    this.quotationMode = 'view';
    this.rightPanelView = 'welcome';
    this.showSubmitConfirm = false;
  }

  /** Filter and search the RFQ list. */
  getFilteredRfqs(): Rfq[] {
    let list = this.rfqs;

    switch (this.rfqFilter) {
      case 'unread':
        list = list.filter((r) => !r.isRead);
        break;
      case 'expiring':
        list = list.filter((r) => r.status === 'open' && this.isExpiringSoon(r));
        break;
      case 'converted':
        list = list.filter((r) => r.status === 'converted');
        break;
    }

    if (this.rfqSearchTerm.trim()) {
      const term = this.rfqSearchTerm.toLowerCase();
      list = list.filter(
        (r) =>
          r.rfqNumber.toLowerCase().includes(term) ||
          r.clientName.toLowerCase().includes(term) ||
          r.category.toLowerCase().includes(term),
      );
    }

    return list;
  }

  /** Number of days until the RFQ due date (negative if overdue). */
  getDueInDays(date: Date): number {
    const ms = new Date(date).getTime() - Date.now();
    return Math.ceil(ms / (1000 * 60 * 60 * 24));
  }

  /** True when the RFQ is due within 3 days and still open. */
  isExpiringSoon(rfq: Rfq): boolean {
    if (rfq.status !== 'open') return false;
    const days = this.getDueInDays(rfq.dueDate);
    return days >= 0 && days <= 3;
  }

  get unreadCount(): number { return this.rfqs.filter((r) => !r.isRead).length; }
  get expiringCount(): number { return this.rfqs.filter((r) => this.isExpiringSoon(r)).length; }
  get convertedCount(): number { return this.rfqs.filter((r) => r.status === 'converted').length; }
  get openCount(): number { return this.rfqs.filter((r) => r.status === 'open').length; }
  get totalRfqCount(): number { return this.rfqs.length; }

  rfqHasQuotation(rfqId: string): boolean { return this.vendorService.rfqHasQuotation(rfqId); }

  // ════════════════════════════════════════════════════════════════════════════
  //  QUOTATION EDITOR
  // ════════════════════════════════════════════════════════════════════════════

  /** Open the quotation editor. Creates a new quotation if none exists yet. */
  openQuotationEditor(): void {
    if (!this.selectedRfq) return;

    if (!this.activeQuotation) {
      // Create a fresh quotation from this RFQ
      const q = this.vendorService.createQuotationFromRfq(this.selectedRfq);
      this.activeQuotation = JSON.parse(JSON.stringify(q));
      this.refreshStats();
    }

    this.quotationNotes = this.activeQuotation!.notes ?? '';
    this.quotationMode = 'edit';
    this.rightPanelView = 'quotation-editor';
  }

  /** Go back to RFQ detail from the editor. */
  backToRfqDetail(): void {
    this.quotationMode = 'view';
    this.rightPanelView = 'rfq-detail';
    this.showSubmitConfirm = false;
  }

  // ── Item-level mutations ─────────────────────────────────────────────────────

  updateItemAvailability(item: QuotationItem, avail: ItemAvailability): void {
    item.availability = avail;
    if (avail === 'available') {
      item.offeredQuantity = null;
      item.substituteDescription = null;
    } else if (avail === 'unavailable') {
      item.unitPrice = null;
      item.offeredQuantity = null;
      item.substituteDescription = null;
    } else if (avail === 'partial') {
      item.substituteDescription = null;
      if (item.offeredQuantity !== null && item.offeredQuantity >= item.quantity) {
        item.offeredQuantity = null;
      }
    } else if (avail === 'substitute') {
      item.offeredQuantity = null;
    }
    this.recalcActiveQuotation();
  }

  updateItemPrice(item: QuotationItem, price: number): void {
    item.unitPrice = isNaN(price) || price < 0 ? null : price;
    this.recalcActiveQuotation();
  }

  updateItemOfferedQty(item: QuotationItem, qty: number): void {
    item.offeredQuantity = isNaN(qty) || qty <= 0 ? null : Math.floor(qty);
    this.recalcActiveQuotation();
  }

  onRawPriceChange(item: QuotationItem, raw: string): void {
    const v = parseFloat(raw.replace(/,/g, ''));
    this.updateItemPrice(item, v);
  }

  onRawQtyChange(item: QuotationItem, raw: string): void {
    const v = parseInt(raw.replace(/,/g, ''), 10);
    this.updateItemOfferedQty(item, v);
  }

  private recalcActiveQuotation(): void {
    if (!this.activeQuotation) return;
    this.activeQuotation = computeQuotationTotals(this.activeQuotation);
  }

  itemLineTotal(item: QuotationItem): number | null {
    return lineTotal(item);
  }

  isItemValid(item: QuotationItem): boolean {
    return isItemValid(item);
  }

  // ── Totals ───────────────────────────────────────────────────────────────────

  calculateSubtotal(): number {
    return this.activeQuotation?.subtotal ?? 0;
  }

  calculateTax(): number {
    return this.activeQuotation?.tax ?? 0;
  }

  calculateTotal(): number {
    return this.activeQuotation?.total ?? 0;
  }

  // ── Validation / submit ──────────────────────────────────────────────────────

  canSubmit(): boolean {
    return !!this.activeQuotation && isQuotationSubmittable(this.activeQuotation);
  }

  /** Items that are not yet valid — used to build a validation summary. */
  get invalidItems(): QuotationItem[] {
    return (this.activeQuotation?.items ?? []).filter((i) => !isItemValid(i));
  }

  get isResubmitFlow(): boolean {
    return this.activeQuotation?.status === 'revision_requested';
  }

  /** Save draft without submitting. */
  saveDraft(): void {
    if (!this.activeQuotation) return;
    this.activeQuotation.notes = this.quotationNotes;
    this.vendorService.updateQuotation(this.activeQuotation);
    this.refreshStats();
  }

  /** Show the submit confirmation modal. */
  onSubmitQuotation(): void {
    if (!this.canSubmit()) return;
    if (this.activeQuotation) { this.activeQuotation.notes = this.quotationNotes; }
    this.showSubmitConfirm = true;
  }

  /** Execute the actual submit after user confirms. */
  confirmSubmit(): void {
    if (!this.activeQuotation || !this.canSubmit()) return;
    this.submitting = true;

    // Persist any unsaved notes
    this.activeQuotation.notes = this.quotationNotes;
    this.vendorService.updateQuotation(this.activeQuotation);

    if (this.isResubmitFlow) {
      this.onResubmit();
    } else {
      this.vendorService.sendQuotation(this.activeQuotation.id);
    }

    this.showSubmitConfirm = false;
    this.submitting = false;
    this.refreshStats();
    this.backToRfqDetail();
    // Re-fetch the now-sent quotation so the detail view reflects 'sent' status
    const fresh = this.quotations.find((q) => q.id === this.activeQuotation?.id) ?? null;
    if (fresh) { this.activeQuotation = JSON.parse(JSON.stringify(fresh)); }
  }

  /** Resubmit after a revision request. */
  onResubmit(): void {
    if (!this.activeQuotation) return;
    this.vendorService.resubmitQuotation(this.activeQuotation);
  }

  // ════════════════════════════════════════════════════════════════════════════
  //  FORMATTING & HELPERS
  // ════════════════════════════════════════════════════════════════════════════

  allItemsUnavailable(): boolean {
    return !!this.activeQuotation && this.activeQuotation.items.every(i => i.availability === 'unavailable');
  }

  getAvailabilityLabel(a: ItemAvailability): string {
    const m: Record<ItemAvailability, string> = {
      available: 'Available',
      partial: 'Partial',
      substitute: 'Substitute',
      unavailable: 'Unavailable',
    };
    return m[a];
  }

  formatCurrency(amount: number, currency = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  }

  fmtDate(d: Date | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fmtDateTime(d: Date | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  fmtNumber(n: number | null): string {
    if (n === null || n === undefined) return '';
    return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  }

  /** CSS class for the due-date countdown pill in the sidebar. */
  dueDateClass(rfq: Rfq): string {
    if (rfq.status !== 'open') return 'vp-due--neutral';
    const days = this.getDueInDays(rfq.dueDate);
    if (days < 0) return 'vp-due--expired';
    if (days <= 3) return 'vp-due--urgent';
    if (days <= 7) return 'vp-due--soon';
    return 'vp-due--ok';
  }

  /** CSS class for the due-date countdown in the detail header. */
  detailDueDateClass(rfq: Rfq): string {
    if (rfq.status !== 'open') return '';
    const days = this.getDueInDays(rfq.dueDate);
    if (days < 0) return 'text-[--vp-danger]';
    if (days <= 3) return 'text-[--vp-warning] font-semibold';
    return 'text-[--vp-success]';
  }

  /** Human readable countdown label for the RFQ header. */
  dueDateLabel(rfq: Rfq): string {
    if (rfq.status !== 'open') return this.fmtDate(rfq.dueDate);
    const days = this.getDueInDays(rfq.dueDate);
    if (days < 0) return `Expired ${Math.abs(days)} day${Math.abs(days) !== 1 ? 's' : ''} ago`;
    if (days === 0) return 'Due today';
    if (days === 1) return 'Due tomorrow';
    return `${days} days left`;
  }

  /** Status chip tone for an RFQ. */
  rfqStatusTone(s: string): string {
    const m: Record<string, string> = {
      open: 'info', converted: 'success', expired: 'danger', closed: 'neutral',
    };
    return m[s] ?? 'neutral';
  }

  /** Status chip tone for a quotation. */
  quotStatusTone(s: string): string {
    const m: Record<string, string> = {
      draft: 'neutral', sent: 'info', revision_requested: 'warning',
      accepted: 'success', rejected: 'danger', withdrawn: 'neutral',
    };
    return m[s] ?? 'neutral';
  }

  quotStatusLabel(s: string): string {
    const m: Record<string, string> = {
      draft: 'Draft', sent: 'Sent', revision_requested: 'Needs Revision',
      accepted: 'Accepted', rejected: 'Rejected', withdrawn: 'Withdrawn',
    };
    return m[s] ?? s;
  }

  attachmentIconBg(type: RfqAttachmentType): string {
    const map: Record<RfqAttachmentType, string> = {
      pdf: 'bg-[#fceeed] text-[#c02c2c]',
      doc: 'bg-[#eaf1fd] text-[#2461d9]',
      xls: 'bg-[#e7f6ef] text-[#17845a]',
      image: 'bg-[#f3ecfb] text-[#7c3aed]',
      dwg: 'bg-[#fdf1e0] text-[#b3690a]',
      zip: 'bg-[#eef2f5] text-[#566670]',
      other: 'bg-[#eef2f5] text-[#566670]',
    };
    return map[type] ?? map.other;
  }

  downloadRfqPdf(): void {
    window.print();
  }

  downloadAttachment(file: RfqAttachment, e: MouseEvent): void {
    e.stopPropagation();
    window.open(file.url, '_blank', 'noopener');
  }

  openLightbox(img: { url: string; label?: string }, e: MouseEvent): void {
    e.stopPropagation();
    this.lightboxImage = { url: img.url, label: img.label || 'Reference image' };
  }

  closeLightbox(): void { this.lightboxImage = null; }

  resetDemoData(): void {
    const confirmed = window.confirm(
      'This clears every locally-simulated RFQ, quotation, LPO and invoice and reloads the starting demo dataset. This cannot be undone. Continue?',
    );
    if (!confirmed) return;
    this.vendorService.resetDemoData();
    this.clearSelection();
    this.refreshStats();
  }

  // ── Track-by helpers ─────────────────────────────────────────────────────────
  trackByRfqId(_i: number, rfq: Rfq): string { return rfq.id; }
  trackByItemId(_i: number, item: QuotationItem): string { return item.rfqItemId; }
}
