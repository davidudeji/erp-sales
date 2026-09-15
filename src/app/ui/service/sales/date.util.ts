// date.util.ts
//
// Central place to turn a raw date value coming back from the commerce API
// into a real JS Date. Backend records aren't consistent about whether a
// date field arrives as an ISO string, a millisecond epoch, or (for some
// records) a *seconds* epoch — passing a seconds value straight into
// `new Date(...)` lands ~20 days after 1 Jan 1970 instead of the real date.
// Every sales-hub component should parse/format API dates through here
// instead of calling `new Date(value)` directly.

/**
 * Parses a raw API date value into a valid Date, or null if it can't be
 * resolved to one. Handles: Date instances, ISO/parsable strings, numeric
 * strings, millisecond epochs, and second epochs (auto-detected and scaled
 * up — any real-world date in milliseconds is >= 1e12, so anything smaller
 * numeric value is treated as seconds).
 */
export function parseApiDate(value: unknown): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const ms = Math.abs(value) < 1e12 ? value * 1000 : value;
    const d = new Date(ms);
    return isNaN(d.getTime()) ? null : d;
  }

  if (typeof value === 'string') {
    // Purely numeric string ("1728000000") — same epoch-seconds ambiguity as above.
    if (/^-?\d+$/.test(value.trim())) {
      return parseApiDate(Number(value));
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }

  return null;
}

/** Formats a raw API date value as "21 Jan 2026", or `fallback` if it can't be parsed. */
export function formatApiDate(
  value: unknown,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' },
  locale = 'en-NG',
  fallback = 'N/A'
): string {
  const d = parseApiDate(value);
  return d ? d.toLocaleDateString(locale, options) : fallback;
}

/** Formats a raw API date value as a date+time string, or `fallback` if it can't be parsed. */
export function formatApiDateTime(
  value: unknown,
  options: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' },
  locale = 'en-NG',
  fallback = 'N/A'
): string {
  const d = parseApiDate(value);
  return d ? d.toLocaleString(locale, options) : fallback;
}

/** "yyyy-MM-dd" for populating a native <input type="date">, from a raw API date value or a local Date. */
export function toDateInputValue(value: unknown): string {
  const d = parseApiDate(value) ?? new Date();
  return d.toISOString().split('T')[0];
}
