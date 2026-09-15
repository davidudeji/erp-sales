import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import { VendorService } from '../../../service/vendor-portal/vendor.service';
import { VendorPortalNavService } from '../../../service/vendor-portal/vendor-portal-nav.service';
import {
  Lpo, Invoice, FinanceStats, LpoStats,
  InvoiceLineItem, VendorProfile,
} from '../../../domain/vendor-portal/vendor.dto';
import { TableColumn } from '../../../shared-component/view/table/table.component';

type ActiveTable   = 'lpos' | 'invoices';
type LpoFilter     = 'all' | 'pending' | 'accepted' | 'rejected' | 'fulfilled';
type InvoiceFilter = 'all' | 'draft' | 'submitted' | 'approved' | 'paid' | 'overdue' | 'disputed';

@Component({
  selector: 'app-finance',
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.scss',
})
export class FinanceComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  // ── Data ─────────────────────────────────────────────────────────────────────
  lpos:        Lpo[]     = [];
  invoices:    Invoice[] = [];
  financeStats: FinanceStats | null = null;
  lpoStats:     LpoStats | null = null;
  profile:      VendorProfile | null = null;

  // ── Table toggle ──────────────────────────────────────────────────────────────
  activeTable: ActiveTable = 'lpos';

  // ── Card-driven filters ───────────────────────────────────────────────────────
  lpoFilter:     LpoFilter     = 'all';
  invoiceFilter: InvoiceFilter = 'all';

  filterCard(table: ActiveTable, lpoFilter?: LpoFilter, invoiceFilter?: InvoiceFilter): void {
    this.activeTable = table;
    if (lpoFilter     !== undefined) { this.lpoFilter     = lpoFilter; }
    if (invoiceFilter !== undefined) { this.invoiceFilter = invoiceFilter; }
  }

  clearLpoFilter():     void { this.lpoFilter     = 'all'; }
  clearInvoiceFilter(): void { this.invoiceFilter = 'all'; }

  get filteredLpos(): Lpo[] {
    if (this.lpoFilter === 'all') return this.lpos;
    return this.lpos.filter(l => l.status === this.lpoFilter);
  }

  get filteredInvoices(): Invoice[] {
    if (this.invoiceFilter === 'all') return this.invoices;
    return this.invoices.filter(i => i.status === this.invoiceFilter);
  }

  // ── LPO side panel ────────────────────────────────────────────────────────────
  showLpoPanel = false;
  selectedLpo: Lpo | null = null;

  // ── LPO Accept modal ──────────────────────────────────────────────────────────
  showAcceptModal = false;
  lpoToAccept: Lpo | null = null;

  // ── LPO Reject modal ──────────────────────────────────────────────────────────
  showRejectModal  = false;
  lpoToReject:     Lpo | null = null;
  rejectionReason  = '';
  rejectionError   = false;

  // ── Invoice side panel ────────────────────────────────────────────────────────
  showInvoicePanel  = false;
  selectedInvoice:  Invoice | null = null;

  // ── Create Invoice centre modal ───────────────────────────────────────────────
  // Opened from either the LPO panel (pre-filled, locked to the LPO's items) or standalone
  showInvoiceModal  = false;
  invoiceForm: Partial<Invoice> & { items: InvoiceLineItem[] } = { items: [] };
  invoiceFormErrors: Record<string, string> = {};
  sourceLpo: Lpo | null = null;                    // set when this draft was raised against an LPO
  private lpoRemaining: Record<string, number> = {}; // lpoItemId -> qty still invoiceable, snapshotted when the modal opened
  excludedFullyInvoicedCount = 0;                   // LPO lines left out of the draft because nothing remains to bill

  // ── LPO columns — 5 <td>s ────────────────────────────────────────────────────
  lpoColumns: TableColumn[] = [
    { header: 'LPO No.',       field: 'lpoNumber',    sortable: true },
    { header: 'Client',        field: 'clientName',   sortable: true },
    { header: 'Delivery Date', sortField: 'deliveryDate', sortable: true,
      formatter: (r: Lpo) => this.fmtDate(r.deliveryDate) },
    { header: 'Total Value',   align: 'right',
      formatter: (r: Lpo) => this.fmtCurrency(r.total, r.currency) },
    { header: 'Status',        field: 'status',       sortable: true },
  ];

  // ── Invoice columns — 5 <td>s ─────────────────────────────────────────────────
  invoiceColumns: TableColumn[] = [
    { header: 'Invoice No.',  field: 'invoiceNumber', sortable: true },
    { header: 'Client',       field: 'clientName',    sortable: true },
    { header: 'Issued / Due', sortField: 'issuedDate', sortable: true,
      formatter: (r: Invoice) => this.fmtDate(r.issuedDate) },
    { header: 'Total',        align: 'right',
      formatter: (r: Invoice) => this.fmtCurrency(r.total, r.currency) },
    { header: 'Status',       field: 'status',        sortable: true },
  ];

  constructor(
    private vendorService: VendorService,
    private nav: VendorPortalNavService,
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.vendorService.getLpos()
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => this.lpos = list);

    this.vendorService.getInvoices()
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => this.invoices = list);

    this.vendorService.getProfile()
      .pipe(takeUntil(this.destroy$))
      .subscribe(p => this.profile = p);

    this.refreshStats();

    // Command palette hand-off: "open LPO-2026-..." / "open INV-..." lands here.
    this.nav.focusRequest$.pipe(takeUntil(this.destroy$)).subscribe((req) => {
      if (!req) return;
      if (req.kind === 'lpo') {
        const lpo = this.lpos.find((l) => l.id === req.id);
        if (lpo) {
          this.activeTable = 'lpos';
          this.onLpoRowClick(lpo);
          this.nav.clearFocusRequest();
        }
      } else if (req.kind === 'invoice') {
        const inv = this.invoices.find((i) => i.id === req.id);
        if (inv) {
          this.activeTable = 'invoices';
          this.onInvoiceRowClick(inv);
          this.nav.clearFocusRequest();
        }
      }
    });
  }

  ngOnDestroy(): void { this.destroy$.next(); this.destroy$.complete(); }

  private refreshStats(): void {
    this.vendorService.getLpoStats().pipe(take(1)).subscribe(s => this.lpoStats = s);
    this.vendorService.getFinanceStats().pipe(take(1)).subscribe(s => this.financeStats = s);
  }

  // ── Toggle ────────────────────────────────────────────────────────────────────
  switchTable(t: ActiveTable): void { this.activeTable = t; }

  get lpoUnreadCount(): number { return this.lpos.filter(l => !l.isRead).length; }
  get invoiceOverdueCount(): number { return this.invoices.filter(i => i.status === 'overdue').length; }

  // ─────────────────────────────────────────────────────────────────────────────
  // LPO FLOW  ── row click → side panel → accept/reject OR create invoice
  // ─────────────────────────────────────────────────────────────────────────────
  onLpoRowClick(lpo: Lpo): void {
    this.selectedLpo  = lpo;
    this.showLpoPanel = true;
    if (!lpo.isRead) { this.vendorService.markLpoAsRead(lpo.id); }
  }

  closeLpoPanel(): void { this.showLpoPanel = false; this.selectedLpo = null; }

  // Accept
  openAcceptModal(lpo: Lpo): void { this.lpoToAccept = lpo; this.showAcceptModal = true; }
  closeAcceptModal(): void { this.showAcceptModal = false; this.lpoToAccept = null; }

  confirmAccept(): void {
    if (!this.lpoToAccept) return;
    this.vendorService.acceptLpo(this.lpoToAccept.id);
    if (this.selectedLpo?.id === this.lpoToAccept.id) {
      this.selectedLpo = { ...this.selectedLpo, status: 'accepted' };
    }
    this.closeAcceptModal();
    this.refreshStats();
  }

  // Reject
  openRejectModal(lpo: Lpo): void {
    this.lpoToReject     = lpo;
    this.rejectionReason = '';
    this.rejectionError  = false;
    this.showRejectModal = true;
  }

  closeRejectModal(): void {
    this.showRejectModal = false;
    this.lpoToReject     = null;
    this.rejectionReason = '';
    this.rejectionError  = false;
  }

  confirmReject(): void {
    if (!this.lpoToReject) return;
    if (!this.rejectionReason.trim()) { this.rejectionError = true; return; }
    this.vendorService.rejectLpo(this.lpoToReject.id, this.rejectionReason.trim());
    if (this.selectedLpo?.id === this.lpoToReject.id) {
      this.selectedLpo = { ...this.selectedLpo, status: 'rejected', rejectionReason: this.rejectionReason.trim() };
    }
    this.closeRejectModal();
    this.refreshStats();
  }

  // How much of this LPO is left to invoice, per line item (already-invoiced
  // quantity subtracted out). Used to decide whether "Create Invoice" should
  // even be offered, and to show a running total in the LPO panel.
  lpoRemainingByItem(lpo: Lpo): Record<string, number> {
    const invoiced = this.vendorService.getInvoicedQuantities(lpo.id);
    const out: Record<string, number> = {};
    lpo.items.forEach((li) => (out[li.id] = Math.max(0, li.quantity - (invoiced[li.id] ?? 0))));
    return out;
  }

  lpoFullyInvoiced(lpo: Lpo): boolean {
    const remaining = this.lpoRemainingByItem(lpo);
    return lpo.items.every((li) => remaining[li.id] <= 0);
  }

  // Create invoice from an accepted LPO — pre-fills the invoice form with the
  // LPO's items. Description and unit price are locked (they were already
  // agreed when the LPO was raised); quantity is editable but capped at
  // what's actually left to invoice, so staged/partial deliveries work
  // without ever letting an LPO be over-billed. Extra items can still be
  // added for things genuinely outside the LPO (e.g. freight).
  createInvoiceFromLpo(lpo: Lpo): void {
    const num = `INV-${new Date().getFullYear()}-${String(this.invoices.length + 1).padStart(3, '0')}`;
    const dueDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    this.lpoRemaining = this.lpoRemainingByItem(lpo);
    this.sourceLpo = lpo;

    const invoiceableItems = lpo.items.filter((li) => this.lpoRemaining[li.id] > 0);
    this.excludedFullyInvoicedCount = lpo.items.length - invoiceableItems.length;

    this.invoiceForm = {
      invoiceNumber: num,
      lpoId:         lpo.id,
      lpoNumber:     lpo.lpoNumber,
      quotationNumber: lpo.quotationNumber,
      clientName:    lpo.clientName,
      clientEmail:   lpo.clientEmail,
      currency:      lpo.currency,
      issuedDate:    new Date(),
      dueDate,
      status:        'draft',
      includeSignature: !!this.profile?.signatureDataUrl,
      notes:         '',
      items: invoiceableItems.map((item, idx) => {
        const qty = this.lpoRemaining[item.id];
        return {
          id:          `item-${idx}`,
          lpoItemId:   item.id,
          description: `${item.name} (${item.description})`,
          quantity:    qty,
          unit:        item.unit,
          unitPrice:   item.unitPrice,
          totalPrice:  item.unitPrice * qty,
        };
      }),
    };

    this.recalcInvoiceForm();
    this.invoiceFormErrors = {};
    this.showInvoiceModal  = true;
  }

  // Create blank invoice — fully free-form, not tied to any LPO (e.g. a
  // retainer or one-off charge that was never quoted through the portal).
  openBlankInvoiceModal(): void {
    const num = `INV-${new Date().getFullYear()}-${String(this.invoices.length + 1).padStart(3, '0')}`;
    this.sourceLpo = null;
    this.lpoRemaining = {};
    this.excludedFullyInvoicedCount = 0;
    this.invoiceForm = {
      invoiceNumber: num,
      clientName:    '',
      currency:      'NGN',
      issuedDate:    new Date(),
      dueDate:       new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status:        'draft',
      includeSignature: !!this.profile?.signatureDataUrl,
      subtotal:      0, tax: 0, total: 0,
      amountPaid:    0, amountOutstanding: 0,
      notes:         '',
      items:         [{ id: 'item-0', description: '', quantity: 1, unit: 'pcs', unitPrice: 0, totalPrice: 0 }],
    };
    this.invoiceFormErrors = {};
    this.showInvoiceModal  = true;
  }

  closeInvoiceModal(): void {
    this.showInvoiceModal = false;
    this.sourceLpo = null;
    this.lpoRemaining = {};
  }

  // An item is "locked" — description/price fixed, quantity capped — when it
  // came from an LPO. Manually-added lines (no lpoItemId) stay fully editable.
  isLockedItem(item: InvoiceLineItem): boolean {
    return !!item.lpoItemId;
  }

  maxQtyForItem(item: InvoiceLineItem): number | null {
    return item.lpoItemId ? (this.lpoRemaining[item.lpoItemId] ?? item.quantity) : null;
  }

  recalcInvoiceForm(): void {
    const subtotal = (this.invoiceForm.items || []).reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    this.invoiceForm.subtotal         = subtotal;
    this.invoiceForm.tax              = subtotal * 0.075;
    this.invoiceForm.total            = subtotal * 1.075;
    this.invoiceForm.amountOutstanding = this.invoiceForm.total;
  }

  updateItemPrice(item: InvoiceLineItem, raw: string): void {
    if (this.isLockedItem(item)) return; // price is fixed once it's tied to an LPO line
    item.unitPrice  = parseFloat(raw.replace(/,/g, '')) || 0;
    item.totalPrice = item.unitPrice * item.quantity;
    this.recalcInvoiceForm();
  }

  updateItemQty(item: InvoiceLineItem, raw: string): void {
    let qty = parseInt(raw, 10) || 1;
    const max = this.maxQtyForItem(item);
    if (max !== null) { qty = Math.min(Math.max(1, qty), Math.max(1, max)); }
    item.quantity   = qty;
    item.totalPrice = item.unitPrice * item.quantity;
    this.recalcInvoiceForm();
  }

  addInvoiceItem(): void {
    const idx = (this.invoiceForm.items?.length ?? 0);
    this.invoiceForm.items?.push({ id: `item-${idx}`, description: '', quantity: 1, unit: 'pcs', unitPrice: 0, totalPrice: 0 });
  }

  removeInvoiceItem(idx: number): void {
    const item = this.invoiceForm.items?.[idx];
    if (item && this.isLockedItem(item)) return; // can't drop an LPO line — reduce its quantity instead
    this.invoiceForm.items?.splice(idx, 1);
    this.recalcInvoiceForm();
  }

  submitInvoice(): void {
    this.invoiceFormErrors = {};
    if (!this.invoiceForm.clientName?.trim()) { this.invoiceFormErrors['clientName'] = 'Client name is required.'; }
    if (!this.invoiceForm.items?.length)      { this.invoiceFormErrors['items'] = 'At least one line item is required.'; }
    for (const item of this.invoiceForm.items ?? []) {
      const max = this.maxQtyForItem(item);
      if (max !== null && item.quantity > max) {
        this.invoiceFormErrors['items'] = `"${item.description}" exceeds what's left to invoice on this LPO.`;
      }
    }
    if (Object.keys(this.invoiceFormErrors).length > 0) return;

    const invoice: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: this.invoiceForm.invoiceNumber!,
      lpoId: this.invoiceForm.lpoId,
      lpoNumber: this.invoiceForm.lpoNumber,
      quotationNumber: this.invoiceForm.quotationNumber,
      clientName: this.invoiceForm.clientName!.trim(),
      clientEmail: this.invoiceForm.clientEmail,
      issuedDate: this.invoiceForm.issuedDate ?? new Date(),
      dueDate: this.invoiceForm.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      status: 'submitted',
      items: this.invoiceForm.items!,
      subtotal: this.invoiceForm.subtotal ?? 0,
      tax: this.invoiceForm.tax ?? 0,
      total: this.invoiceForm.total ?? 0,
      amountPaid: 0,
      amountOutstanding: this.invoiceForm.total ?? 0,
      currency: this.invoiceForm.currency ?? 'NGN',
      notes: this.invoiceForm.notes,
      includeSignature: this.invoiceForm.includeSignature,
    };

    this.vendorService.createInvoice(invoice);
    this.closeInvoiceModal();
    this.closeLpoPanel();
    this.activeTable = 'invoices';
    this.refreshStats();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // INVOICE FLOW  ── row click → side panel
  // ─────────────────────────────────────────────────────────────────────────────
  onInvoiceRowClick(inv: Invoice): void {
    this.selectedInvoice  = inv;
    this.showInvoicePanel = true;
  }

  closeInvoicePanel(): void { this.showInvoicePanel = false; this.selectedInvoice = null; }

  downloadLpo(lpo: Lpo, e: MouseEvent): void { e.stopPropagation(); console.log('[Finance] Download LPO:', lpo.lpoNumber); }
  downloadInvoice(inv: Invoice, e: MouseEvent): void { e.stopPropagation(); console.log('[Finance] Download Invoice:', inv.invoiceNumber); }

  paymentProgress(inv: Invoice): number {
    if (inv.total === 0) return 0;
    return Math.min(100, Math.round((inv.amountPaid / inv.total) * 100));
  }

  // ── Lifecycle visibility ─────────────────────────────────────────────────────
  // A quick "where does this sit in the pipeline" readout. RFQ/Quotation are
  // assumed complete by the time an LPO exists (that's the only way one gets
  // raised); everything past LPO is inferred from real invoice/payment data.
  lpoLifecycleStages(lpo: Lpo): { label: string; state: 'done' | 'current' | 'upcoming' | 'stopped' }[] {
    if (lpo.status === 'rejected') {
      return [
        { label: 'RFQ', state: 'done' },
        { label: 'Quotation', state: 'done' },
        { label: 'LPO', state: 'stopped' },
        { label: 'Invoice', state: 'upcoming' },
        { label: 'Paid', state: 'upcoming' },
      ];
    }
    const related = this.invoices.filter((i) => i.lpoId === lpo.id);
    const hasInvoice = related.length > 0;
    const fullyPaid  = hasInvoice && related.every((i) => i.status === 'paid');
    return [
      { label: 'RFQ', state: 'done' },
      { label: 'Quotation', state: 'done' },
      { label: 'LPO', state: lpo.status === 'pending' ? 'current' : 'done' },
      { label: 'Invoice', state: hasInvoice ? 'done' : (lpo.status === 'pending' ? 'upcoming' : 'current') },
      { label: 'Paid', state: fullyPaid ? 'done' : (hasInvoice ? 'current' : 'upcoming') },
    ];
  }

  invoiceLifecycleStages(inv: Invoice): { label: string; state: 'done' | 'current' | 'upcoming' | 'stopped' }[] {
    const paid = inv.status === 'paid';
    return [
      { label: 'RFQ', state: 'done' },
      { label: 'Quotation', state: 'done' },
      { label: 'LPO', state: inv.lpoNumber ? 'done' : 'upcoming' },
      { label: 'Invoice', state: paid ? 'done' : 'current' },
      { label: 'Paid', state: paid ? 'done' : 'upcoming' },
    ];
  }

  // ── Formatting ────────────────────────────────────────────────────────────────
  fmtDate(d: Date | undefined): string {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  fmtCurrency(n: number, cur = 'NGN'): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency', currency: cur, minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(n);
  }

  fmtNumber(n: number | null): string {
    if (!n) return '';
    return new Intl.NumberFormat('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(n);
  }

  isExpired(d: Date): boolean { return new Date(d) < new Date(); }
  isDueSoon(d: Date): boolean {
    const t = new Date(d).getTime(), now = Date.now();
    return t >= now && t <= now + 3 * 24 * 60 * 60 * 1000;
  }

  deliveryDateClass(lpo: Lpo): string {
    if (lpo.status !== 'pending' && lpo.status !== 'accepted') return '';
    if (this.isExpired(lpo.deliveryDate)) return 'text-danger';
    if (this.isDueSoon(lpo.deliveryDate)) return 'text-warning';
    return '';
  }

  lpoBadge(status: string): string {
    const m: Record<string, string> = {
      pending:   'badge-pending',
      accepted:  'badge-accepted',
      rejected:  'badge-rejected',
      fulfilled: 'badge-fulfilled',
      cancelled: 'badge-closed',
    };
    return `badge ${m[status] ?? ''}`;
  }

  invoiceBadge(status: string): string {
    const m: Record<string, string> = {
      draft:     'badge-draft',
      submitted: 'badge-submitted',
      approved:  'badge-approved',
      paid:      'badge-paid',
      overdue:   'badge-overdue',
      disputed:  'badge-disputed',
    };
    return `badge ${m[status] ?? ''}`;
  }
}
