/**
 * Local-calendar day keys ('YYYY-MM-DD').
 *
 * Never derive a day key with `toISOString().slice(0, 10)` — that's the UTC
 * date, which in Korea (UTC+9) is YESTERDAY for anything before 09:00. That
 * mismatch put 오전 transactions on the wrong day and made the edit form move
 * a transaction back a day every time it was saved.
 */
export function localDayKey(input: Date | string = new Date()): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Today's local day key. */
export const todayKey = () => localDayKey(new Date());

/** Local 'HH:MM' for an ISO timestamp or Date. */
export function localTimeHHMM(input: Date | string): string {
  const d = typeof input === 'string' ? new Date(input) : input;
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Parse a 'YYYY-MM-DD' key as LOCAL midnight.
 * `new Date('2026-11-08')` is UTC midnight per spec — 09:00 in Korea — which
 * silently drops the first 9 hours of a start date.
 */
export function parseLocalDay(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  if (!y || !m || !d) return new Date(Number.NaN);
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

/** Whole local calendar days from today until `key` (0 = today, negative = past). */
export function daysUntilKey(key: string, from: Date = new Date()): number {
  const target = parseLocalDay(key);
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  return Math.round((target.getTime() - start.getTime()) / 86400000);
}

/** Local day key N days from today (negative = past). */
export function dayKeyOffset(days: number, from: Date = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return localDayKey(d);
}
