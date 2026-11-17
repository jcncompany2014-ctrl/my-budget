/**
 * What the search screen is showing. The screen remounts every time a result
 * is opened and closed, and other screens open it already filtered ("this
 * category this month", "this account") — both go through here.
 */
export type SearchView = {
  query: string;
  minAmount: string;
  maxAmount: string;
  cat: string | null;
  acc: string | null;
  /** 'YYYY-MM-DD', used when `datePreset` is 'custom'. */
  dateFrom: string;
  dateTo: string;
  datePreset: 'all' | '7d' | '30d' | '3m' | 'custom';
  showFilters: boolean;
};

const BLANK: SearchView = {
  query: '',
  minAmount: '',
  maxAmount: '',
  cat: null,
  acc: null,
  dateFrom: '',
  dateTo: '',
  datePreset: 'all',
  showFilters: false,
};

/** Opening a result and coming back is quick; after this long it is a new search. */
const HOLD_MS = 15 * 60_000;

let current: SearchView = BLANK;
let heldAt = 0;

/**
 * The view to open the screen with: the held one (a result was opened from it,
 * or another screen asked for a filtered list), otherwise a blank search.
 * Safe to call more than once per mount; `releaseSearchView` ends the hold.
 */
export function takeSearchView(): SearchView {
  if (Date.now() - heldAt >= HOLD_MS) current = BLANK;
  return current;
}

/** The screen is up: the next visit starts blank unless something holds it again. */
export function releaseSearchView() {
  heldAt = 0;
}

export function rememberSearchView(v: SearchView) {
  current = v;
}

/** Leaving for a result — coming back finds the search as it was. */
export function holdSearchView() {
  heldAt = Date.now();
}

/** Open the search screen on a filtered list (call right before navigating to /search). */
export function presetSearch(preset: Partial<SearchView>) {
  current = { ...BLANK, ...preset };
  heldAt = Date.now();
}

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** First and last day of the month `offset` months from now, as a custom range. */
export function monthRange(
  offset = 0,
  now = new Date(),
): Pick<SearchView, 'datePreset' | 'dateFrom' | 'dateTo'> {
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { datePreset: 'custom', dateFrom: dayKey(first), dateTo: dayKey(last) };
}
