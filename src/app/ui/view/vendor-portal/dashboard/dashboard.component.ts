import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import { VendorService, computeQuotationTotals, isQuotationSubmittable } from '../../../service/vendor-portal/vendor.service';
import { VendorPortalNavService } from '../../../service/vendor-portal/vendor-portal-nav.service';
import {
  Rfq,
  Quotation,
  QuotationItem,
  VendorStats,
  ItemAvailability,
  MAX_REVISION_ROUNDS,
  Lpo,
  VendorProfile,
  RfqAttachment,
  RfqAttachmentType,
} from '../../../domain/vendor-portal/vendor.dto';
import { TableColumn } from '../../../shared-component/view/table/table.component';

type ActiveTable = 'rfqs' | 'quotations';
type RfqFilter   = 'all' | 'open' | 'converted' | 'expired' | 'closed' | 'due_soon';
type QuotFilter  = 'all' | 'draft' | 'sent' | 'revision_requested' | 'accepted' | 'rejected' | 'withdrawn';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  readonly MAX_REVISION_ROUNDS = MAX_REVISION_ROUNDS;

  rfqs: Rfq[] = [];
  quotations: Quotation[] = [];
  // Not shown as a table here — just used to tell whether an LPO has already
  // been raised against a given quotation, for the lifecycle stepper.
  private lpos: Lpo[] = [];
  stats: VendorStats | null = null;
  profile: VendorProfile | null = null;

  activeTable: ActiveTable = 'rfqs';

  // ── Card-driven filters ───────────────────────────────────────────────────────
  rfqFilter:  RfqFilter  = 'all';
  quotFilter: QuotFilter = 'all';

  // ── RFQ side panel ────────────────────────────────────────────────────────────
  showRfqPanel = false;
  selectedRfq: Rfq | null = null;

  // ── Quotation side panel ──────────────────────────────────────────────────────
  showQuotationPanel = false;
  selectedQuotation: Quotation | null = null;

  // ── Quotation editor centre modal (shared for both Convert, Edit and Revise flows) ──
  showQuotationModal = false;
  editingQuotation: Quotation | null = null;
  isQuotationReadOnly = false;

  // ── Send / resubmit confirm modal ─────────────────────────────────────────────
  showSendConfirm = false;
  quotationToSend: Quotation | null = null;

  // ── Withdraw confirm modal ────────────────────────────────────────────────────
  showWithdrawConfirm = false;
  quotationToWithdraw: Quotation | null = null;
  withdrawReason = '';

  // ── Simulate client decision modal (demo stand-in — see method docs) ─────────
  showSimulateDecisionModal = false;
  quotationToSimulate: Quotation | null = null;
  simulateDecisionType: 'accept' | 'revision' | 'reject' = 'revision';
  simulateDecisionNote = '';
  simulateDecisionError: string | null = null;

  // ── RFQ columns
  // Each column has a formatter so resolveCell() always returns a value.
  // appTableBody overrides the <td> rendering but the headers must match exactly.
  // 6 columns → 6 <td>s in the template.
  rfqColumns: TableColumn[] = [
    {
      header: 'RFQ No.',
      field: 'rfqNumber',
      sortable: true,
    },
    {
      header: 'Client',
      field: 'clientName',
      sortable: true,
    },
    {
      header: 'Category',
      field: 'category',
      sortable: true,
    },
    {
      header: 'Due Date',
      sortable: true,
      sortField: 'dueDate',
      formatter: (row: Rfq) => this.fmtDate(row.dueDate),
    },
    {
      header: 'Est. Value',
      align: 'right',
      formatter: (row: Rfq) =>
        row.totalEstimatedValue ? this.fmtCurrency(row.totalEstimatedValue, row.currency) : '—',
    },
    {
      header: 'Status',
      field: 'status',
      sortable: true,
    },
  ];

  // ── Quotation columns
  // 5 columns → 5 <td>s in the template.
  quotationColumns: TableColumn[] = [
    {
      header: 'Quotation No.',
      field: 'quotationNumber',
      sortable: true,
    },
    {
      header: 'Client',
      field: 'clientName',
      sortable: true,
    },
    {
      header: 'Due / Created',
      sortable: true,
      sortField: 'createdDate',
      formatter: (row: Quotation) => this.fmtDate(row.createdDate),
    },
    {
      header: 'Total',
      align: 'right',
      formatter: (row: Quotation) =>
        row.total > 0 ? this.fmtCurrency(row.total, row.currency) : '—',
    },
    {
      header: 'Status',
      field: 'status',
      sortable: true,
    },
  ];

  constructor(
    private vendorService: VendorService,
    private nav: VendorPortalNavService,
  ) {}

  ngOnInit(): void {
    this.vendorService.loadRfqs();
    this.vendorService
      .getRfqs()
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => (this.rfqs = list));

    this.vendorService
      .getLpos()
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => (this.lpos = list));

    this.vendorService
      .getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe((p) => (this.profile = p));

    this.vendorService
      .getQuotations()
      .pipe(takeUntil(this.destroy$))
      .subscribe((list) => {
        this.quotations = list;
        // Keep the open side-panel in sync if the underlying record changed
        // (e.g. after a simulated client revision request or a withdrawal).
        if (this.selectedQuotation) {
          const fresh = list.find((q) => q.id === this.selectedQuotation!.id);
          this.selectedQuotation = fresh ? JSON.parse(JSON.stringify(fresh)) : null;
          if (!fresh) this.showQuotationPanel = false;
        }
      });

    this.refreshStats();

    // Command palette hand-off: "open RFQ-2026-004" / "open QT-..." lands here.
    this.nav.focusRequest$.pipe(takeUntil(this.destroy$)).subscribe((req) => {
      if (!req) return;
      if (req.kind === 'rfq') {
        const rfq = this.rfqs.find((r) => r.id === req.id);
        if (rfq) {
          this.activeTable = 'rfqs';
          this.onRfqRowClick(rfq);
          this.nav.clearFocusRequest();
        }
      } else if (req.kind === 'quotation') {
        const q = this.quotations.find((x) => x.id === req.id);
        if (q) {
          this.activeTable = 'quotations';
          this.openQuotationSidePanel(q);
          this.nav.clearFocusRequest();
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refreshStats(): void {
    this.vendorService
      .getVendorStats()
      .pipe(take(1))
      .subscribe((s) => (this.stats = s));
  }

  switchTable(t: ActiveTable): void {
    this.activeTable = t;
  }

  // Called by stat cards — switches table and sets the relevant filter
  filterCard(table: ActiveTable, rfqFilter?: RfqFilter, quotFilter?: QuotFilter): void {
    this.activeTable = table;
    if (rfqFilter  !== undefined) { this.rfqFilter  = rfqFilter; }
    if (quotFilter !== undefined) { this.quotFilter = quotFilter; }
  }

  clearRfqFilter():  void { this.rfqFilter  = 'all'; }
  clearQuotFilter(): void { this.quotFilter = 'all'; }

  get filteredRfqs(): Rfq[] {
    if (this.rfqFilter === 'all')      return this.rfqs;
    if (this.rfqFilter === 'due_soon') return this.rfqs.filter(r => r.status === 'open' && this.isDueSoon(r.dueDate));
    return this.rfqs.filter(r => r.status === this.rfqFilter);
  }

  get filteredQuotations(): Quotation[] {
    if (this.quotFilter === 'all') return this.quotations;
    return this.quotations.filter(q => q.status === this.quotFilter);
  }

  get unreadCount(): number {
    return this.rfqs.filter((r) => !r.isRead).length;
  }
  get draftCount(): number {
    return this.quotations.filter((q) => q.status === 'draft').length;
  }
  get needsRevisionCount(): number {
    return this.quotations.filter((q) => q.status === 'revision_requested').length;
  }

  // ── RFQ panel ─────────────────────────────────────────────────────────────────
  onRfqRowClick(rfq: Rfq): void {
    this.selectedRfq = rfq;
    this.showRfqPanel = true;
    if (!rfq.isRead) {
      this.vendorService.markRfqAsRead(rfq.id);
    }
  }

  closeRfqPanel(): void {
    this.showRfqPanel = false;
    this.selectedRfq = null;
  }

  rfqHasQuotation(rfqId: string): boolean {
    return this.vendorService.rfqHasQuotation(rfqId);
  }

  openConvertModal(rfq: Rfq): void {
    const q = this.vendorService.createQuotationFromRfq(rfq);
    this.refreshStats();
    this.editingQuotation = JSON.parse(JSON.stringify(q));
    this.isQuotationReadOnly = false;
    this.showQuotationModal = true;
  }

  viewQuotationFromRfq(rfq: Rfq): void {
    const q = this.quotations.find((x) => x.rfqId === rfq.id) ?? null;
    this.closeRfqPanel();
    this.activeTable = 'quotations';
    if (q) {
      this.openQuotationSidePanel(q);
    }
  }

  // ── Quotation panel ───────────────────────────────────────────────────────────
  onQuotationRowClick(q: Quotation): void {
    this.openQuotationSidePanel(q);
  }

  openQuotationSidePanel(q: Quotation): void {
    this.selectedQuotation = q;
    this.showQuotationPanel = true;
  }

  closeQuotationPanel(): void {
    this.showQuotationPanel = false;
    this.selectedQuotation = null;
  }

  // Where this quotation sits in the RFQ → Quotation → LPO → Invoice chain.
  // LPO awareness comes from a lightweight lpos subscription (see ngOnInit) —
  // dashboard.component doesn't own LPO/Invoice data, so "Invoice" is a
  // conservative signal (current once an LPO exists) rather than a hard fact.
  quotationLifecycleStages(q: Quotation): { label: string; state: 'done' | 'current' | 'upcoming' | 'stopped' }[] {
    if (q.status === 'rejected' || q.status === 'withdrawn') {
      return [
        { label: 'RFQ', state: 'done' },
        { label: 'Quotation', state: 'stopped' },
        { label: 'LPO', state: 'upcoming' },
        { label: 'Invoice', state: 'upcoming' },
        { label: 'Paid', state: 'upcoming' },
      ];
    }
    const relatedLpo = this.lpos.find((l) => l.quotationNumber === q.quotationNumber);
    const quotDone = q.status === 'accepted';
    return [
      { label: 'RFQ', state: 'done' },
      { label: 'Quotation', state: quotDone ? 'done' : 'current' },
      { label: 'LPO', state: relatedLpo ? 'done' : quotDone ? 'current' : 'upcoming' },
      { label: 'Invoice', state: relatedLpo ? 'current' : 'upcoming' },
      { label: 'Paid', state: 'upcoming' },
    ];
  }

  // Jump from a quotation straight to the RFQ it was raised from.
  viewRfqFromQuotation(q: Quotation): void {
    const rfq = this.rfqs.find((r) => r.id === q.rfqId);
    if (!rfq) return;
    this.closeQuotationPanel();
    this.activeTable = 'rfqs';
    this.onRfqRowClick(rfq);
  }

  // Draft quotations, and quotations the client sent back for changes, are
  // both editable — everything else (sent / accepted / rejected / withdrawn)
  // opens read-only.
  isEditableStatus(q: Quotation): boolean {
    return q.status === 'draft' || q.status === 'revision_requested';
  }

  openQuotationEditor(q: Quotation): void {
    this.editingQuotation = JSON.parse(JSON.stringify(q));
    this.isQuotationReadOnly = false;
    this.showQuotationModal = true;
  }

  openQuotationViewer(q: Quotation): void {
    this.editingQuotation = JSON.parse(JSON.stringify(q));
    this.isQuotationReadOnly = true;
    this.showQuotationModal = true;
  }

  closeQuotationModal(): void {
    this.showQuotationModal = false;
    this.editingQuotation = null;
  }

  // ── Item editing ──────────────────────────────────────────────────────────────
  onPriceChange(item: QuotationItem, raw: string): void {
    const v = parseFloat(raw.replace(/,/g, ''));
    item.unitPrice = isNaN(v) || v < 0 ? null : v;
    this.recalcEditing();
  }

  onOfferedQtyChange(item: QuotationItem, raw: string): void {
    const v = parseInt(raw.replace(/,/g, ''), 10);
    item.offeredQuantity = isNaN(v) || v <= 0 ? null : v;
    this.recalcEditing();
  }

  // Switches a line item between Full / Partial / Substitute / Unavailable
  // and resets whichever fields don't apply to the new state so stale data
  // (e.g. a substitute description left over from a previous choice) can't
  // leak into the submitted quotation.
  setAvailability(item: QuotationItem, availability: ItemAvailability): void {
    item.availability = availability;
    if (availability === 'available') {
      item.offeredQuantity = null;
      item.substituteDescription = null;
    } else if (availability === 'unavailable') {
      item.unitPrice = null;
      item.offeredQuantity = null;
      item.substituteDescription = null;
    } else if (availability === 'partial') {
      item.substituteDescription = null;
      if (item.offeredQuantity !== null && item.offeredQuantity >= item.quantity) {
        item.offeredQuantity = null;
      }
    }
    // 'substitute' — unitPrice/offeredQuantity are left as-is; vendor fills in substituteDescription.
    this.recalcEditing();
  }

  itemAvailabilityLabel(a: ItemAvailability): string {
    const m: Record<ItemAvailability, string> = {
      available: 'Full qty',
      partial: 'Partial',
      substitute: 'Substitute',
      unavailable: 'Unavailable',
    };
    return m[a];
  }

  // computeQuotationTotals() rebuilds every item object on each recalc (see its
  // doc comment). Without a stable trackBy, Angular's *ngFor treats that as an
  // entirely new list on every keystroke/click and tears down + rebuilds every
  // item card's DOM — inputs included — which is what caused fields to
  // intermittently render blank while editing. rfqItemId never changes for a
  // given line, so it's a safe, stable identity for Angular to track against.
  trackByRfqItemId(_index: number, item: QuotationItem): string {
    return item.rfqItemId;
  }

  private recalcEditing(): void {
    if (!this.editingQuotation) return;
    this.editingQuotation = computeQuotationTotals(this.editingQuotation);
  }

  isComplete(q: Quotation): boolean {
    return isQuotationSubmittable(q);
  }

  get editingComplete(): boolean {
    return !!this.editingQuotation && this.isComplete(this.editingQuotation);
  }

  // ── Save / Send / Resubmit ────────────────────────────────────────────────────
  saveDraft(): void {
    if (!this.editingQuotation) return;
    this.vendorService.updateQuotation(this.editingQuotation);
    if (this.selectedQuotation?.id === this.editingQuotation.id) {
      this.selectedQuotation = JSON.parse(JSON.stringify(this.editingQuotation));
    }
    this.refreshStats();
    this.closeQuotationModal();
  }

  get isResubmitFlow(): boolean {
    return this.quotationToSend?.status === 'revision_requested';
  }

  openSendConfirm(q: Quotation): void {
    this.quotationToSend = q;
    this.showSendConfirm = true;
  }
  cancelSend(): void {
    this.showSendConfirm = false;
    this.quotationToSend = null;
  }

  requestSendFromModal(): void {
    if (this.editingQuotation && this.editingComplete) {
      this.vendorService.updateQuotation(this.editingQuotation);
      this.openSendConfirm(this.editingQuotation);
    }
  }

  executeSend(): void {
    if (!this.quotationToSend) return;
    if (this.quotationToSend.status === 'revision_requested') {
      this.vendorService.resubmitQuotation(this.quotationToSend);
    } else {
      this.vendorService.sendQuotation(this.quotationToSend.id);
    }
    this.showSendConfirm = false;
    this.quotationToSend = null;
    this.closeQuotationModal();
    this.closeQuotationPanel();
    this.refreshStats();
  }

  // ── Withdraw ──────────────────────────────────────────────────────────────────
  openWithdrawConfirm(q: Quotation): void {
    this.quotationToWithdraw = q;
    this.withdrawReason = '';
    this.showWithdrawConfirm = true;
  }
  cancelWithdraw(): void {
    this.showWithdrawConfirm = false;
    this.quotationToWithdraw = null;
  }
  executeWithdraw(): void {
    if (!this.quotationToWithdraw) return;
    this.vendorService.withdrawQuotation(this.quotationToWithdraw.id, this.withdrawReason.trim() || undefined);
    this.showWithdrawConfirm = false;
    this.quotationToWithdraw = null;
    this.closeQuotationPanel();
    this.refreshStats();
  }

  // ── Simulate client decision ──────────────────────────────────────────────────
  // The real trigger for these actions lives on the client side
  // (request-management module), which currently talks to a separate
  // backend-backed quotation model. Until both sides share one API, this
  // lets the vendor portal exercise and demo the full negotiation loop —
  // accept, request revision, or reject — against its own mock data.
  // Swap this out for real inbound events once the two are wired together.
  openSimulateDecision(q: Quotation): void {
    this.quotationToSimulate = q;
    this.simulateDecisionType = 'revision';
    this.simulateDecisionNote = '';
    this.simulateDecisionError = null;
    this.showSimulateDecisionModal = true;
  }
  setSimulateDecisionType(type: 'accept' | 'revision' | 'reject'): void {
    this.simulateDecisionType = type;
    this.simulateDecisionError = null;
  }
  cancelSimulateDecision(): void {
    this.showSimulateDecisionModal = false;
    this.quotationToSimulate = null;
  }
  canExecuteSimulateDecision(): boolean {
    return this.simulateDecisionType === 'accept' || !!this.simulateDecisionNote.trim();
  }
  simDecisionNoteLabel(): string {
    switch (this.simulateDecisionType) {
      case 'accept':
        return 'Note to vendor (optional)';
      case 'reject':
        return 'Why is the client rejecting this?';
      default:
        return 'What is the client asking to change?';
    }
  }
  simDecisionPlaceholder(): string {
    switch (this.simulateDecisionType) {
      case 'accept':
        return 'e.g. Looks good, please proceed.';
      case 'reject':
        return 'e.g. Going with another vendor on this one.';
      default:
        return 'e.g. Can you match the full quantity on item 2? The price on item 4 is above our budget…';
    }
  }
  simDecisionCtaLabel(): string {
    switch (this.simulateDecisionType) {
      case 'accept':
        return 'Accept Quotation';
      case 'reject':
        return 'Reject Quotation';
      default:
        return 'Send Back for Revision';
    }
  }
  simDecisionTabClass(type: 'accept' | 'revision' | 'reject'): string {
    const active = this.simulateDecisionType === type;
    const activeColor = { accept: 'text-emerald-700', revision: 'text-orange-700', reject: 'text-red-700' }[type];
    return `px-2 py-1.5 text-xs font-semibold rounded-md transition-colors ${
      active ? `bg-white shadow-sm ${activeColor}` : 'text-[#94a9b3] hover:text-[#5a7380]'
    }`;
  }
  simDecisionCtaClass(): string {
    const colorClass = {
      accept: 'bg-emerald-500 hover:bg-emerald-600',
      revision: 'bg-orange-500 hover:bg-orange-600',
      reject: 'bg-red-500 hover:bg-red-600',
    }[this.simulateDecisionType];
    return `px-5 py-2.5 text-sm font-semibold rounded-xl text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${colorClass}`;
  }
  executeSimulateDecision(): void {
    if (!this.quotationToSimulate || !this.canExecuteSimulateDecision()) return;
    const note = this.simulateDecisionNote.trim();
    const id = this.quotationToSimulate.id;
    let result: { ok: boolean; reason?: string };
    switch (this.simulateDecisionType) {
      case 'accept':
        result = this.vendorService.acceptQuotation(id, note || undefined);
        break;
      case 'reject':
        result = this.vendorService.rejectQuotation(id, note);
        break;
      default:
        result = this.vendorService.requestRevision(id, note);
    }
    if (!result.ok) {
      this.simulateDecisionError = result.reason ?? 'Could not complete this action.';
      return;
    }
    this.showSimulateDecisionModal = false;
    this.quotationToSimulate = null;
    this.closeQuotationPanel();
    this.refreshStats();
  }

  // ── Reset demo data ───────────────────────────────────────────────────────────
  // Dev/demo tooling only — clears everything this portal has persisted to
  // localStorage and reloads the original seed dataset. See
  // VendorService.resetDemoData().
  resetDemoData(): void {
    const confirmed = window.confirm(
      "This clears every locally-simulated RFQ, quotation, LPO and invoice in this browser and reloads the starting demo dataset. This can't be undone. Continue?",
    );
    if (!confirmed) return;
    this.vendorService.resetDemoData();
    this.closeRfqPanel();
    this.closeQuotationPanel();
    this.refreshStats();
  }

  // ── Downloads ─────────────────────────────────────────────────────────────────
  downloadRfq(rfq: Rfq, e: MouseEvent): void {
    e.stopPropagation();
    console.log('Download RFQ', rfq.rfqNumber);
  }
  downloadQuotation(q: Quotation, e: MouseEvent): void {
    e.stopPropagation();
    console.log('Download Quotation', q.quotationNumber);
  }

  // Full spec viewing — opens/downloads an RFQ attachment (spec sheet,
  // drawing, terms doc, etc). In this demo environment files are mock URLs,
  // so we just surface the intent; a real backend would stream the file.
  downloadAttachment(file: RfqAttachment, e: MouseEvent): void {
    e.stopPropagation();
    window.open(file.url, '_blank', 'noopener');
  }

  // ── Status → (tone, icon) mapping for <app-vp-status> ──────────────────────────
  // Shape (icon) carries the meaning; tone (color) reinforces it — see
  // status-badge.component.ts for the rationale.
  rfqStatusTone(s: string): 'info' | 'success' | 'danger' | 'neutral' {
    const map: Record<string, 'info' | 'success' | 'danger' | 'neutral'> = {
      open: 'info',
      converted: 'success',
      expired: 'danger',
      closed: 'neutral',
    };
    return map[s] ?? 'neutral';
  }
  rfqStatusIcon(s: string): 'dot' | 'check' | 'x' | 'dash' {
    const map: Record<string, 'dot' | 'check' | 'x' | 'dash'> = {
      open: 'dot',
      converted: 'check',
      expired: 'x',
      closed: 'dash',
    };
    return map[s] ?? 'dot';
  }
  quotStatusTone(s: string): 'neutral' | 'info' | 'warning' | 'success' | 'danger' {
    const map: Record<string, 'neutral' | 'info' | 'warning' | 'success' | 'danger'> = {
      draft: 'neutral',
      sent: 'info',
      revision_requested: 'warning',
      accepted: 'success',
      rejected: 'danger',
      withdrawn: 'neutral',
    };
    return map[s] ?? 'neutral';
  }
  quotStatusIcon(s: string): 'dash' | 'clock' | 'half' | 'check' | 'x' {
    const map: Record<string, 'dash' | 'clock' | 'half' | 'check' | 'x'> = {
      draft: 'dash',
      sent: 'clock',
      revision_requested: 'half',
      accepted: 'check',
      rejected: 'x',
      withdrawn: 'dash',
    };
    return map[s] ?? 'dash';
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

  // ── Formatting ────────────────────────────────────────────────────────────────
  fmtDate(d: Date | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  }

  fmtDateTime(d: Date | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleString('en-NG', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  fmtCurrency(n: number, cur = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: cur,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n);
  }

  fmtNumber(n: number | null): string {
    if (n === null || n === undefined) return '';
    return new Intl.NumberFormat('en-NG', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n);
  }

  isExpired(d: Date): boolean {
    return new Date(d) < new Date();
  }
  isDueSoon(d: Date): boolean {
    const t = new Date(d).getTime(),
      now = Date.now();
    return t >= now && t <= now + 3 * 24 * 60 * 60 * 1000;
  }

  dueDateClass(rfq: Rfq): string {
    if (rfq.status !== 'open') return '';
    if (this.isExpired(rfq.dueDate)) return 'text-danger';
    if (this.isDueSoon(rfq.dueDate)) return 'text-warning';
    return '';
  }

  rfqBadge(s: string): string {
    const m: Record<string, string> = {
      open: 'badge-open',
      converted: 'badge-converted',
      expired: 'badge-expired',
      closed: 'badge-closed',
    };
    return `badge ${m[s] ?? ''}`;
  }

  quotBadge(s: string): string {
    const m: Record<string, string> = {
      draft: 'badge-draft',
      sent: 'badge-sent',
      revision_requested: 'badge-revision_requested',
      accepted: 'badge-accepted',
      rejected: 'badge-rejected',
      withdrawn: 'badge-withdrawn',
    };
    return `badge ${m[s] ?? ''}`;
  }

  quotStatusLabel(s: string): string {
    const m: Record<string, string> = {
      draft: 'Draft',
      sent: 'Sent',
      revision_requested: 'Needs Revision',
      accepted: 'Accepted',
      rejected: 'Rejected',
      withdrawn: 'Withdrawn',
    };
    return m[s] ?? s;
  }
}
