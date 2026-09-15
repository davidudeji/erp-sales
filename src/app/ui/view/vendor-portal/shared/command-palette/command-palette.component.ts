import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { VendorService } from '../../../../service/vendor-portal/vendor.service';
import { VendorPortalNavService, VendorSection } from '../../../../service/vendor-portal/vendor-portal-nav.service';

type ResultKind = 'nav' | 'rfq' | 'quotation' | 'lpo' | 'invoice';

interface PaletteResult {
  kind: ResultKind;
  id: string;          // recordId, or nav section name for nav entries
  title: string;
  subtitle: string;
  section: VendorSection;
  badge?: string;       // small trailing hint, e.g. status
}

// A lightweight, dependency-free command palette. Opens with ⌘K / Ctrl+K
// from anywhere in the vendor portal (a global keydown listener on the host,
// which sits at the shell level so it's always mounted), searches nav
// destinations plus live RFQ/Quotation/LPO/Invoice numbers & client names,
// and hands off the actual navigation to VendorPortalNavService so the shell
// and the target page component both react correctly.
@Component({
  selector: 'app-vp-command-palette',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './command-palette.component.html',
  styleUrl: './command-palette.component.scss',
})
export class CommandPaletteComponent implements OnInit, OnDestroy {
  open = false;
  query = '';
  activeIndex = 0;
  results: PaletteResult[] = [];

  private readonly navEntries: PaletteResult[] = [
    { kind: 'nav', id: 'dashboard', title: 'Dashboard', subtitle: 'Command centre — pipeline & performance', section: 'dashboard' },
    { kind: 'nav', id: 'rfq', title: 'RFQs & Quotations', subtitle: 'Browse requests, submit and manage quotations', section: 'rfq' },
    { kind: 'nav', id: 'finance', title: 'Finance', subtitle: 'LPOs and invoices', section: 'finance' },
    { kind: 'nav', id: 'performance', title: 'Performance', subtitle: 'Win rate, revenue trend, client breakdown', section: 'performance' },
    { kind: 'nav', id: 'documents', title: 'Documents', subtitle: 'Compliance documents & expiry tracking', section: 'documents' },
    { kind: 'nav', id: 'profile', title: 'Company profile', subtitle: 'Vendor details, bank info, branding', section: 'profile' },
  ];

  constructor(
    private vendorService: VendorService,
    private nav: VendorPortalNavService,
  ) {}

  ngOnInit(): void {
    this.results = this.navEntries;
  }

  ngOnDestroy(): void {}

  @HostListener('window:keydown', ['$event'])
  onKeydown(e: KeyboardEvent): void {
    const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k';
    if (isCmdK) {
      e.preventDefault();
      this.open ? this.close() : this.launch();
      return;
    }
    if (!this.open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.activeIndex = Math.min(this.activeIndex + 1, this.results.length - 1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const chosen = this.results[this.activeIndex];
      if (chosen) this.select(chosen);
    }
  }

  launch(): void {
    this.open = true;
    this.query = '';
    this.activeIndex = 0;
    this.results = this.navEntries;
  }

  close(): void {
    this.open = false;
  }

  onQueryChange(): void {
    this.activeIndex = 0;
    const q = this.query.trim().toLowerCase();
    if (!q) {
      this.results = this.navEntries;
      return;
    }

    const matchesNav = this.navEntries.filter(
      (n) => n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q),
    );

    const rfqResults: PaletteResult[] = this.vendorService
      .getRfqsSnapshot()
      .filter((r) => r.rfqNumber.toLowerCase().includes(q) || r.clientName.toLowerCase().includes(q))
      .slice(0, 6)
      .map((r) => ({
        kind: 'rfq',
        id: r.id,
        title: r.rfqNumber,
        subtitle: r.clientName,
        section: 'rfq',
        badge: r.status,
      }));

    const quoteResults: PaletteResult[] = this.vendorService
      .getQuotationsSnapshot()
      .filter((q2) => q2.quotationNumber.toLowerCase().includes(q) || q2.clientName.toLowerCase().includes(q))
      .slice(0, 6)
      .map((q2) => ({
        kind: 'quotation',
        id: q2.id,
        title: q2.quotationNumber,
        subtitle: q2.clientName,
        section: 'rfq',
        badge: q2.status.replace('_', ' '),
      }));

    const lpoResults: PaletteResult[] = this.vendorService
      .getLposSnapshot()
      .filter((l) => l.lpoNumber.toLowerCase().includes(q) || l.clientName.toLowerCase().includes(q))
      .slice(0, 6)
      .map((l) => ({
        kind: 'lpo',
        id: l.id,
        title: l.lpoNumber,
        subtitle: l.clientName,
        section: 'finance',
        badge: l.status,
      }));

    const invoiceResults: PaletteResult[] = this.vendorService
      .getInvoicesSnapshot()
      .filter((i) => i.invoiceNumber.toLowerCase().includes(q) || i.clientName.toLowerCase().includes(q))
      .slice(0, 6)
      .map((i) => ({
        kind: 'invoice',
        id: i.id,
        title: i.invoiceNumber,
        subtitle: i.clientName,
        section: 'finance',
        badge: i.status,
      }));

    this.results = [...matchesNav, ...rfqResults, ...quoteResults, ...lpoResults, ...invoiceResults];
  }

  select(result: PaletteResult): void {
    if (result.kind === 'nav') {
      this.nav.goToSection(result.section);
    } else {
      this.nav.focusRecord(result.kind, result.id, result.section);
    }
    this.close();
  }

  groupLabel(kind: ResultKind): string {
    const m: Record<ResultKind, string> = {
      nav: 'Go to',
      rfq: 'RFQs',
      quotation: 'Quotations',
      lpo: 'Orders (LPOs)',
      invoice: 'Invoices',
    };
    return m[kind];
  }

  // Group boundary — true when this result starts a new kind group, so the
  // template can print a section label without a separate data structure.
  isGroupStart(index: number): boolean {
    if (index === 0) return true;
    return this.results[index].kind !== this.results[index - 1].kind;
  }

  trackByResult(_i: number, r: PaletteResult): string {
    return r.kind + r.id;
  }
}
