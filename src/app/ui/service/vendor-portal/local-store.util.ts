/**
 * ───────────────────────────────────────────────────────────────────────
 * localStorage-backed persistence for the vendor portal's simulated backend
 * ───────────────────────────────────────────────────────────────────────
 * There's no real API yet, so VendorService keeps its state in a handful of
 * BehaviorSubjects. This module is what makes that state survive a page
 * refresh — and, since localStorage is shared by every tab on the same
 * origin, what lets a second tab (or the procurement side, once it's wired
 * up the same way) see the same data too.
 *
 * Two namespaces are used, matching who owns each piece of data in the real
 * system:
 *
 *   SHARED  Rfq / Quotation / Lpo — the records that cross the vendor <->
 *           procurement boundary. The client (via the request-management
 *           module) raises the RFQ and issues the LPO; the vendor raises
 *           and revises the Quotation; both sides act on a Quotation's
 *           status over its lifetime (send / request revision / resubmit /
 *           accept / reject / withdraw). In production these would be rows
 *           in one backend database that both portals read and write
 *           through a single API. Until that API exists, both portals can
 *           read/write these same localStorage keys directly and get the
 *           same effect — this is the "contract" the request-management
 *           module should target once it's wired up to the same simulated
 *           backend (see the shape of Rfq/Quotation/Lpo in vendor.dto.ts).
 *
 *   VENDOR  Invoice / Payment / VendorDocument / VendorProfile /
 *           DocumentTemplate — nobody outside the vendor portal needs to
 *           read or write these for the simulation to work, so they live in
 *           their own namespace instead of the shared one.
 *
 * Every key is prefixed with a schema version so a future breaking change
 * to one of the DTOs can be rolled out by bumping the version rather than
 * writing a migration for old, differently-shaped data.
 * ───────────────────────────────────────────────────────────────────────
 */

const APP_NAMESPACE = 'erp_sim';
const STORAGE_SCHEMA_VERSION = 'v1';

function buildKey(scope: 'shared' | 'vendor', name: string): string {
  return `${APP_NAMESPACE}:${STORAGE_SCHEMA_VERSION}:${scope}:${name}`;
}

export const STORAGE_KEYS = {
  // shared "wire" data — see file header
  RFQS: buildKey('shared', 'rfqs'),
  QUOTATIONS: buildKey('shared', 'quotations'),
  LPOS: buildKey('shared', 'lpos'),

  // vendor-private data — see file header
  INVOICES: buildKey('vendor', 'invoices'),
  PAYMENTS: buildKey('vendor', 'payments'),
  DOCUMENTS: buildKey('vendor', 'documents'),
  PROFILE: buildKey('vendor', 'profile'),
  TEMPLATES: buildKey('vendor', 'templates'),
} as const;

// Matches exactly what `JSON.stringify(new Date(...))` produces (i.e.
// Date#toJSON()), so this only ever revives strings that really were Date
// instances going in — a currency code, status string, or free-text note
// can never accidentally match this and get turned into a Date.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE_RE.test(value) ? new Date(value) : value;
}

/**
 * Reads a collection (array or single record) from localStorage. The first
 * time this key has ever been read in this browser — or if the stored value
 * is missing/corrupted — it falls back to `seed()` and immediately writes
 * that seed back out, so the key exists right away for another tab/portal
 * to read.
 */
export function loadFromStorage<T>(storageKey: string, seed: () => T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      return JSON.parse(raw, reviveDates) as T;
    }
  } catch (err) {
    console.error(`[vendor-portal] couldn't read "${storageKey}" — reseeding.`, err);
  }
  const seeded = seed();
  saveToStorage(storageKey, seeded);
  return seeded;
}

/** Writes a value back to localStorage. Never throws. */
export function saveToStorage<T>(storageKey: string, value: T): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (err) {
    // Storage full, private-browsing mode, SSR, etc. The in-memory
    // BehaviorSubject is still correct — it just won't survive a refresh.
    console.error(`[vendor-portal] couldn't persist "${storageKey}".`, err);
  }
}

/** Removes every key this module owns. Used by VendorService.resetDemoData(). */
export function clearAllStorage(): void {
  Object.values(STORAGE_KEYS).forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}
