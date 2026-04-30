'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Real-time quote client.
 *
 * Design goals (in order):
 *   1. Never block render — page paints immediately from localStorage cache
 *   2. Background refresh while tab is visible; pause when hidden
 *   3. Coalesce all visible holdings into a single network call
 *   4. Server-side cache (in /api/quotes) absorbs upstream rate limits
 *
 * Refresh cadence (visible tab):
 *   • upbit (crypto): 30s
 *   • yahoo (stocks/FX): 90s
 *   The cadence is per-id, but a single coalesced fetch fulfills all due ids.
 */

export type QuoteId = `binance:${string}` | `upbit:${string}` | `yahoo:${string}`;

export type Quote = {
  price: number;     // native currency
  change: number;    // 24h % change
  currency: string;  // KRW / USD / JPY / EUR / ...
  name: string;
  ts: number;        // when fetched (ms epoch)
};

const CACHE_KEY = 'asset/quotes-cache/v1';

/** Per-id refresh interval while tab visible. */
function refreshMs(id: QuoteId): number {
  if (id.startsWith('binance:')) return 30_000;
  if (id.startsWith('upbit:')) return 30_000;
  // FX Yahoo symbols (USDKRW=X, JPYKRW=X, ...) refresh slower
  if (id.startsWith('yahoo:') && id.endsWith('=X')) return 30 * 60_000; // 30 min
  return 90_000;
}

type CacheShape = Record<QuoteId, Quote>;

function loadCache(): CacheShape {
  if (typeof window === 'undefined') return {} as CacheShape;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (raw) return JSON.parse(raw) as CacheShape;
  } catch {
    /* ignore */
  }
  return {} as CacheShape;
}

function saveCache(c: CacheShape) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(c));
  } catch {
    /* quota — drop silently */
  }
}

/* ─── Module-level shared state ──────────────────────────────────────── */

// In-memory mirror of the localStorage cache. Lets multiple useQuotes()
// instances share data without thrashing storage.
let memCache: CacheShape = typeof window !== 'undefined' ? loadCache() : ({} as CacheShape);

// Set of subscriber callbacks. Each one re-renders when memCache updates.
const subscribers = new Set<() => void>();

function notifyAll() {
  for (const fn of subscribers) {
    try {
      fn();
    } catch {
      /* ignore */
    }
  }
}

// In-flight fetches (id-set key → promise) to coalesce concurrent calls.
let inFlight: Promise<void> | null = null;
let lastFetchAt = 0;
const MIN_GAP_MS = 1000; // never fire two requests within 1s

async function fetchQuotes(ids: QuoteId[]) {
  if (ids.length === 0) return;
  const since = Date.now() - lastFetchAt;
  if (since < MIN_GAP_MS) {
    // throttle — wait out remaining gap
    await new Promise((r) => setTimeout(r, MIN_GAP_MS - since));
  }
  if (inFlight) return inFlight; // join existing
  lastFetchAt = Date.now();
  const url = `/api/quotes?ids=${encodeURIComponent(ids.join(','))}`;
  inFlight = (async () => {
    try {
      const r = await fetch(url, { cache: 'no-store' });
      if (!r.ok) return;
      const j = (await r.json()) as { quotes: Record<string, Quote>; ts: number };
      let changed = false;
      for (const [id, q] of Object.entries(j.quotes)) {
        memCache[id as QuoteId] = q;
        changed = true;
      }
      if (changed) {
        saveCache(memCache);
        notifyAll();
      }
    } catch {
      /* swallow — keep showing cached values */
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/* ─── Hooks ──────────────────────────────────────────────────────────── */

/**
 * Subscribe to live quotes for a set of ids.
 * Returns the latest known quotes (instantly from cache on first render).
 */
export function useQuotes(ids: QuoteId[]): {
  quotes: CacheShape;
  refresh: () => void;
  loading: boolean;
} {
  // Stable serialization so an id list with same contents doesn't re-trigger.
  const key = ids.slice().sort().join('|');
  const [, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const idsRef = useRef(ids);
  idsRef.current = ids;

  // Subscribe / unsubscribe
  useEffect(() => {
    const sub = () => setTick((n) => (n + 1) % 1_000_000);
    subscribers.add(sub);
    return () => {
      subscribers.delete(sub);
    };
  }, []);

  // Initial + visibility-aware polling
  useEffect(() => {
    if (ids.length === 0) return;

    let stopped = false;
    let timer: number | null = null;

    const tick = async () => {
      if (stopped) return;
      if (typeof document !== 'undefined' && document.hidden) {
        // Schedule a check when tab becomes visible
        return;
      }
      const now = Date.now();
      const due = idsRef.current.filter((id) => {
        const q = memCache[id];
        if (!q) return true;
        return now - q.ts >= refreshMs(id);
      });
      if (due.length > 0) {
        setLoading(true);
        await fetchQuotes(due);
        setLoading(false);
      }
      // Schedule next check at the soonest upcoming refresh, min 5s
      const next = idsRef.current.reduce((m, id) => {
        const q = memCache[id];
        const due = q ? q.ts + refreshMs(id) - Date.now() : 0;
        return Math.min(m, Math.max(5000, due));
      }, 60_000);
      timer = window.setTimeout(tick, next);
    };

    tick();

    const onVis = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        if (timer) {
          window.clearTimeout(timer);
          timer = null;
        }
        tick();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVis);
    }

    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVis);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Snapshot only the requested ids
  const quotes: CacheShape = {} as CacheShape;
  for (const id of ids) {
    const q = memCache[id];
    if (q) quotes[id] = q;
  }

  const refresh = () => {
    void fetchQuotes(idsRef.current);
  };

  return { quotes, refresh, loading };
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

export type Currency = 'KRW' | 'USD' | 'JPY' | 'USDT' | 'EUR' | 'CNY' | 'HKD';

/**
 * Heuristically build a QuoteId from a user-typed ticker + kind + currency.
 * Routes to the most authoritative source for that combination.
 *
 *   crypto + USDT → Binance USDT pair (real-time, deepest liquidity)
 *   crypto + KRW  → Upbit (KRW direct, Korean market)
 *   stock  + KRW  → Yahoo with .KS suffix (KOSPI/KOSDAQ)
 *   stock  + JPY  → Yahoo with .T suffix (Tokyo)
 *   stock  + USD  → Yahoo (NYSE/Nasdaq)
 *   stock  + HKD  → Yahoo with .HK suffix
 */
export function tickerToQuoteId(
  ticker: string,
  kind: 'stock' | 'fund' | 'crypto' | 'other',
  currency?: Currency,
): QuoteId | null {
  const t = ticker.trim().toUpperCase();
  if (!t) return null;

  if (kind === 'crypto') {
    if (currency === 'KRW') return `upbit:${t}` as QuoteId;
    // Default crypto: USDT pair on Binance
    return `binance:${t}USDT` as QuoteId;
  }

  if (kind === 'stock') {
    // If user already typed a Yahoo-suffixed symbol, respect it
    if (/\.(KS|KQ|T|HK|L|TO|SS|SZ)$/i.test(t)) return `yahoo:${t}` as QuoteId;
    // 6-digit numeric → KOSPI by default (KOSDAQ uses .KQ but Yahoo accepts .KS for both via auto-fallback)
    if (/^\d{6}$/.test(t)) return `yahoo:${t}.KS` as QuoteId;
    // 4-digit numeric + JPY → Tokyo
    if (/^\d{4}$/.test(t) && currency === 'JPY') return `yahoo:${t}.T` as QuoteId;
    if (/^\d{4,5}$/.test(t) && currency === 'HKD') return `yahoo:${t}.HK` as QuoteId;
    // Letters → US (NYSE/Nasdaq)
    if (/^[A-Z][A-Z0-9.\-]{0,9}$/.test(t)) return `yahoo:${t}` as QuoteId;
  }
  return null;
}

/** Default currency for a freshly-created investment of given kind. */
export function defaultCurrencyForKind(kind: 'stock' | 'fund' | 'crypto' | 'other'): Currency {
  if (kind === 'crypto') return 'USDT';
  if (kind === 'stock') return 'KRW'; // user changes this if they buy US/JP
  return 'KRW';
}

/** Convert a price in any currency to KRW using the FX cache. */
export function toKRW(price: number, currency: string): number {
  const c = currency.toUpperCase();
  if (c === 'KRW') return price;
  // USDT trades within ±0.5% of USD; use USDKRW as approximation
  const fxBase = c === 'USDT' || c === 'USDC' || c === 'BUSD' ? 'USD' : c;
  const id = `yahoo:${fxBase}KRW=X` as QuoteId;
  const fx = memCache[id];
  if (fx?.price) return price * fx.price;
  return price; // best-effort fallback (don't pretend)
}

/** Get the live FX rate (1 unit of `currency` = N KRW). */
export function fxRateToKRW(currency: string): number | null {
  const c = currency.toUpperCase();
  if (c === 'KRW') return 1;
  const fxBase = c === 'USDT' || c === 'USDC' || c === 'BUSD' ? 'USD' : c;
  const id = `yahoo:${fxBase}KRW=X` as QuoteId;
  return memCache[id]?.price ?? null;
}

/** Standard FX symbols to subscribe to alongside any holdings. */
export const FX_IDS: QuoteId[] = [
  'yahoo:USDKRW=X',
  'yahoo:JPYKRW=X',
  'yahoo:EURKRW=X',
  'yahoo:CNYKRW=X',
  'yahoo:HKDKRW=X',
];
