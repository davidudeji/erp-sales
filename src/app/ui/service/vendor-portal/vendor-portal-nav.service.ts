import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

// The vendor portal's section ids — kept as plain strings (not an enum) so the
// shell, the command palette, and each page component can all reference the
// same literal without a circular import.
export type VendorSection =
  | 'dashboard'
  | 'rfq'
  | 'finance'
  | 'performance'
  | 'documents'
  | 'profile'
  | 'registration';

export type VendorFocusKind = 'rfq' | 'quotation' | 'lpo' | 'invoice' | 'document';

export interface VendorFocusRequest {
  kind: VendorFocusKind;
  id: string;
  // A monotonically increasing token so a repeat request for the same id
  // (e.g. selecting the same command-palette result twice) is still detected
  // as "new" by a page component watching this stream.
  requestedAt: number;
}

// Coordinates cross-cutting navigation concerns for the vendor portal shell:
//  - which top-level section is active (so both the sidebar and the command
//    palette can drive navigation)
//  - a "focus request" — e.g. "open RFQ-2026-004's detail panel" — raised by
//    the command palette and consumed once by the RFQ/Finance page components.
//
// Deliberately tiny and framework-light: no routing dependency, so it works
// with the existing ngComponentOutlet-based shell without a wider refactor.
@Injectable({ providedIn: 'root' })
export class VendorPortalNavService {
  private readonly activeSection$$ = new BehaviorSubject<VendorSection>('dashboard');
  readonly activeSection$ = this.activeSection$$.asObservable();

  private readonly focusRequest$$ = new BehaviorSubject<VendorFocusRequest | null>(null);
  readonly focusRequest$ = this.focusRequest$$.asObservable();

  get activeSection(): VendorSection {
    return this.activeSection$$.getValue();
  }

  goToSection(section: VendorSection): void {
    this.activeSection$$.next(section);
  }

  // Ask the shell to switch to the section that owns `kind`, then ask that
  // section's page component to open the matching record once it's ready.
  focusRecord(kind: VendorFocusKind, id: string, section: VendorSection): void {
    this.activeSection$$.next(section);
    this.focusRequest$$.next({ kind, id, requestedAt: Date.now() });
  }

  // Called by a page component after it has acted on (or ruled out) the
  // current request, so it isn't re-consumed on the next navigation back to
  // the same section.
  clearFocusRequest(): void {
    this.focusRequest$$.next(null);
  }
}
