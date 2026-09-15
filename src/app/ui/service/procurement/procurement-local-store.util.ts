/**
 * ───────────────────────────────────────────────────────────────────────
 * localStorage persistence helpers for the procurement / request-management
 * module
 * ───────────────────────────────────────────────────────────────────────
 * ProcurementRequestService and QuotationManagementService already persisted
 * to localStorage before this file existed — each hand-parsed a short list
 * of known Date fields back out of the JSON it had stored. That works, but
 * it's easy to silently forget to add a field to the list (which is exactly
 * what happened: neither service revived dates nested inside array fields
 * like `history[].timestamp`). This file replaces the hand-rolled parsing
 * with a generic reviver so any Date field — present now or added later —
 * survives the round trip automatically.
 *
 * This does not change *where* anything is stored: each service keeps its
 * own existing localStorage key (`procurement_requests`,
 * `vendor_quotations_db_v3`, unchanged). It only changes *how* the JSON for
 * that key is read back.
 * ───────────────────────────────────────────────────────────────────────
 */

// Matches exactly what `JSON.stringify(new Date(...))` produces (i.e.
// Date#toJSON()), so this only ever revives strings that really were Date
// instances going in — a status string or free-text note can never
// accidentally match this and get turned into a Date.
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function reviveDates(_key: string, value: unknown): unknown {
  return typeof value === 'string' && ISO_DATE_RE.test(value) ? new Date(value) : value;
}

/**
 * Reads a collection (array or single record) from localStorage at
 * `storageKey`, reviving Date fields at any depth. Returns `null` if the key
 * is missing or the stored JSON is corrupt, so the caller can fall back to
 * its own default/seed data — this module doesn't know what a sensible
 * default looks like for any given key, that's still each service's job.
 */
export function loadFromStorage<T>(storageKey: string): T | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw === null) return null;
    return JSON.parse(raw, reviveDates) as T;
  } catch (err) {
    console.error(`[procurement] couldn't read "${storageKey}" from storage.`, err);
    return null;
  }
}

/** Writes a value to localStorage at `storageKey`. Never throws. */
export function saveToStorage<T>(storageKey: string, value: T): void {
  try {
    localStorage.setItem(storageKey, JSON.stringify(value));
  } catch (err) {
    // Storage full, private-browsing mode, SSR, etc. The in-memory copy is
    // still correct — it just won't survive a refresh.
    console.error(`[procurement] couldn't persist "${storageKey}".`, err);
  }
}
