/**
 * ───────────────────────────────────────────────────────────────────────
 * localStorage-backed persistence for the procurement (request-management)
 * module's simulated backend.
 * ───────────────────────────────────────────────────────────────────────
 * Mirrors the pattern used by the vendor portal
 * (service/vendor-portal/local-store.util.ts): every key lives under the
 * same `erp_sim` app namespace and a schema version, so a future breaking
 * change to a DTO can be rolled out by bumping the version instead of
 * writing a migration for old, differently-shaped data. Dates are revived
 * the same way too, so `ProcurementRequest.deliveryDeadline`,
 * `VendorQuotation.submittedAt`, etc. come back out as real `Date`
 * instances instead of strings.
 *
 * Procurement's own domain models (ProcurementRequest / VendorQuotation /
 * MasterOrder in procurement.dto.ts) are richer than — and shaped
 * differently from — the vendor portal's shared wire models (Rfq /
 * Quotation / Lpo in vendor.dto.ts), so this module intentionally keeps its
 * own key namespace rather than reading/writing the vendor portal's SHARED
 * keys directly. Unifying the two into one literal shared record (so a
 * vendor's action is instantly visible on the procurement side and vice
 * versa without a page refresh) is possible but would need a mapping layer
 * between the two shapes — that's a separate, bigger change and hasn't
 * been done here so neither side's existing DTOs or components had to
 * change shape.
 *
 * Previously, ProcurementRequestService and QuotationManagementService each
 * read/wrote a bare, unversioned localStorage key
 * ('procurement_requests' / 'vendor_quotations_db_v3') directly. The keys
 * below replace that, and loadFromStorage() falls back to reading the old
 * key (once) if the new one doesn't exist yet, so nobody's already-saved
 * demo data disappears on upgrade.
 */

const APP_NAMESPACE = 'erp_sim';
const STORAGE_SCHEMA_VERSION = 'v1';

function buildKey(name: string): string {
  return `${APP_NAMESPACE}:${STORAGE_SCHEMA_VERSION}:procurement:${name}`;
}

export const PROCUREMENT_STORAGE_KEYS = {
  REQUESTS: buildKey('requests'),
  ORDERS: buildKey('master-orders'),
  QUOTATIONS: buildKey('quotations'),
} as const;

/** Old, pre-migration keys — read once as a fallback, never written to again. */
const LEGACY_KEYS: Partial<Record<string, string>> = {
  [PROCUREMENT_STORAGE_KEYS.REQUESTS]: 'procurement_requests',
  [PROCUREMENT_STORAGE_KEYS.QUOTATIONS]: 'vendor_quotations_db_v3',
};

// Matches exactly what `JSON.stringify(new Date(...))` produces (i.e.
// Date#toJSON()), so this only ever revives strings that really were Date
// instances going in — a currency code, status string, or free-text note
// can never accidentally match this and get turned into a Date.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE_RE.test(value) ? new Date(value) : value;
}

/**
 * Reads a collection from localStorage under its namespaced key. Falls back
 * — in order — to (1) the legacy unversioned key this data used to live
 * under, if any, migrating it forward immediately, then (2) `seed()` if
 * neither is present or the stored value is corrupted. Either fallback is
 * written straight back out under the namespaced key so it's there for next
 * time (and, if applicable, so it can be treated as fully migrated).
 */
export function loadFromStorage<T>(storageKey: string, seed: () => T): T {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      return JSON.parse(raw, reviveDates) as T;
    }
  } catch (err) {
    console.error(`[procurement] couldn't read "${storageKey}" — reseeding.`, err);
  }

  const legacyKey = LEGACY_KEYS[storageKey];
  if (legacyKey) {
    try {
      const legacyRaw = localStorage.getItem(legacyKey);
      if (legacyRaw !== null) {
        const migrated = JSON.parse(legacyRaw, reviveDates) as T;
        saveToStorage(storageKey, migrated);
        return migrated;
      }
    } catch (err) {
      console.error(`[procurement] couldn't migrate legacy key "${legacyKey}" — reseeding.`, err);
    }
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
    // Storage full, private-browsing mode, SSR, etc. The in-memory copy is
    // still correct — it just won't survive a refresh.
    console.error(`[procurement] couldn't persist "${storageKey}".`, err);
  }
}

/** Removes every key this module owns (does not touch the legacy keys). */
export function clearAllProcurementStorage(): void {
  Object.values(PROCUREMENT_STORAGE_KEYS).forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* ignore */
    }
  });
}
