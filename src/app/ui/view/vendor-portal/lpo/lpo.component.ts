import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil, take } from 'rxjs/operators';

import { VendorService } from '../../../service/vendor-portal/vendor.service';
import { Lpo, LpoStats } from '../../../domain/vendor-portal/vendor.dto';
import { TableColumn } from '../../../shared-component/view/table/table.component';

type LpoFilter = 'all' | 'pending' | 'accepted' | 'rejected' | 'fulfilled';

@Component({
  selector: 'app-lpo',
  templateUrl: './lpo.component.html',
  styleUrl: './lpo.component.scss',
})
export class LpoComponent implements OnInit, OnDestroy {

  private destroy$ = new Subject<void>();

  lpos:  Lpo[]      = [];
  stats: LpoStats | null = null;

  // ── Card-driven filter ────────────────────────────────────────────────────────
  lpoFilter: LpoFilter = 'all';

  filterCard(f: LpoFilter): void { this.lpoFilter = f; }
  clearFilter(): void { this.lpoFilter = 'all'; }

  get filteredLpos(): Lpo[] {
    if (this.lpoFilter === 'all') return this.lpos;
    return this.lpos.filter(l => l.status === this.lpoFilter);
  }

  // ── LPO side panel ────────────────────────────────────────────────────────────
  showLpoPanel  = false;
  selectedLpo:  Lpo | null = null;

  // ── Accept confirm modal ──────────────────────────────────────────────────────
  showAcceptModal = false;
  lpoToAccept:    Lpo | null = null;

  // ── Reject modal ──────────────────────────────────────────────────────────────
  showRejectModal  = false;
  lpoToReject:     Lpo | null = null;
  rejectionReason  = '';
  rejectionError   = false;

  // ── 5 columns → 5 <td>s in template ──────────────────────────────────────────
  lpoColumns: TableColumn[] = [
    {
      header: 'LPO No.', field: 'lpoNumber', sortable: true,
    },
    {
      header: 'Client', field: 'clientName', sortable: true,
    },
    {
      header: 'Delivery Date', sortable: true, sortField: 'deliveryDate',
      formatter: (row: Lpo) => this.fmtDate(row.deliveryDate),
    },
    {
      header: 'Total Value', align: 'right',
      formatter: (row: Lpo) => this.fmtCurrency(row.total, row.currency),
    },
    {
      header: 'Status', field: 'status', sortable: true,
    },
  ];

  constructor(private vendorService: VendorService) {}

  ngOnInit(): void {
    this.vendorService.getLpos()
      .pipe(takeUntil(this.destroy$))
      .subscribe(list => this.lpos = list);

    this.refreshStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private refreshStats(): void {
    this.vendorService.getLpoStats().pipe(take(1)).subscribe(s => this.stats = s);
  }

  get unreadCount(): number { return this.lpos.filter(l => !l.isRead).length; }

  // ── Side panel ────────────────────────────────────────────────────────────────
  onLpoRowClick(lpo: Lpo): void {
    this.selectedLpo  = lpo;
    this.showLpoPanel = true;
    if (!lpo.isRead) { this.vendorService.markLpoAsRead(lpo.id); }
  }

  closeLpoPanel(): void { this.showLpoPanel = false; this.selectedLpo = null; }

  // ── Accept flow ───────────────────────────────────────────────────────────────
  openAcceptModal(lpo: Lpo): void { this.lpoToAccept = lpo; this.showAcceptModal = true; }
  closeAcceptModal(): void { this.showAcceptModal = false; this.lpoToAccept = null; }

  confirmAccept(): void {
    if (!this.lpoToAccept) return;
    this.vendorService.acceptLpo(this.lpoToAccept.id);
    // Refresh selectedLpo so the panel reflects new status
    if (this.selectedLpo?.id === this.lpoToAccept.id) {
      this.selectedLpo = { ...this.selectedLpo, status: 'accepted' };
    }
    this.closeAcceptModal();
    this.refreshStats();
  }

  // ── Reject flow ───────────────────────────────────────────────────────────────
  openRejectModal(lpo: Lpo): void {
    this.lpoToReject    = lpo;
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

  // ── Download stub ─────────────────────────────────────────────────────────────
  downloadLpo(lpo: Lpo, e: MouseEvent): void {
    e.stopPropagation();
    console.log('[VendorPortal] Download LPO:', lpo.lpoNumber);
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
}