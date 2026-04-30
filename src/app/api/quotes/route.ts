import type { NextRequest } from 'next/server';

/**
 * Real-time quote aggregator.
 *
 *  GET /api/quotes?ids=upbit:BTC,upbit:ETH,yahoo:AAPL,yahoo:005930.KS,yahoo:USDKRW=X
 *
 * Sources:
 *   • upbit:<symbol>       → KRW pair from Upbit (crypto, ~real-time)
 *   • yahoo:<symbol>       → Yahoo Finance unofficial v7/quote (US/KR stocks, FX, crypto USD pairs)
 *
 * In-memory cache lives per V8 isolate. TTL is source-dependent so upstream
 * never gets hammered. On upstream failure we serve the previous cached value
 * (even if expired) instead of erroring — keeps the UI ticking.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Quote = {
  price: number;          // last/current price in source's native currency
  change: number;         // 24h change percent (e.g. -1.42)
  currency: string;       // ISO 4217 (KRW, USD, JPY, EUR, ...)
  name: string;           // human-readable name
  ts: number;             // when this quote was fetched (ms epoch)
};

type Source = 'upbit' | 'yahoo';
const TTL_MS: Record<Source, number> = {
  upbit: 20_000,   // 20s — crypto moves fast, Upbit allows 600 req/min
  yahoo: 60_000,   // 60s — stocks/FX, lighter source
};

// Per-isolate cache. Key = full id (e.g. "upbit:BTC"), value = quote + expiry.
const cache = new Map<string, { value: Quote; expires: number }>();

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function fetchWithTimeout(url: string, ms: number, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(t);
  }
}

/* ─── Upbit (KRW crypto pairs) ─── */
async function fetchUpbit(symbols: string[], out: Record<string, Quote>, now: number) {
  // Upbit market codes are e.g. "KRW-BTC" — we accept just "BTC" and prefix.
  const markets = symbols.map((s) => `KRW-${s.toUpperCase()}`).join(',');
  try {
    const r = await fetchWithTimeout(
      `https://api.upbit.com/v1/ticker?markets=${encodeURIComponent(markets)}`,
      4000,
      { headers: { Accept: 'application/json' } },
    );
    if (!r.ok) throw new Error(`upbit ${r.status}`);
    const arr = (await r.json()) as Array<{
      market: string;
      trade_price: number;
      signed_change_rate: number;
    }>;
    for (const row of arr) {
      const sym = row.market.replace(/^KRW-/, '');
      const id = `upbit:${sym}`;
      const q: Quote = {
        price: row.trade_price,
        change: +(row.signed_change_rate * 100).toFixed(2),
        currency: 'KRW',
        name: sym,
        ts: now,
      };
      out[id] = q;
      cache.set(id, { value: q, expires: now + TTL_MS.upbit });
    }
  } catch {
    // fall through — caller will use stale cache if available
  }
}

/* ─── Yahoo Finance unofficial v7 quote ─── */
async function fetchYahoo(symbols: string[], out: Record<string, Quote>, now: number) {
  const csv = symbols.join(',');
  try {
    const r = await fetchWithTimeout(
      `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(csv)}`,
      5000,
      { headers: { 'User-Agent': UA, Accept: 'application/json' } },
    );
    if (!r.ok) throw new Error(`yahoo ${r.status}`);
    const j = (await r.json()) as {
      quoteResponse?: {
        result?: Array<{
          symbol: string;
          regularMarketPrice?: number;
          regularMarketChangePercent?: number;
          currency?: string;
          shortName?: string;
          longName?: string;
        }>;
      };
    };
    const result = j.quoteResponse?.result ?? [];
    for (const row of result) {
      if (typeof row.regularMarketPrice !== 'number') continue;
      const id = `yahoo:${row.symbol}`;
      const q: Quote = {
        price: row.regularMarketPrice,
        change: +(row.regularMarketChangePercent ?? 0).toFixed(2),
        currency: (row.currency || 'USD').toUpperCase(),
        name: row.shortName || row.longName || row.symbol,
        ts: now,
      };
      out[id] = q;
      cache.set(id, { value: q, expires: now + TTL_MS.yahoo });
    }
  } catch {
    // Fallback per-symbol via v8 chart endpoint, in parallel
    await Promise.all(
      symbols.map(async (sym) => {
        try {
          const r = await fetchWithTimeout(
            `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`,
            4000,
            { headers: { 'User-Agent': UA, Accept: 'application/json' } },
          );
          if (!r.ok) return;
          const j = (await r.json()) as {
            chart?: {
              result?: Array<{
                meta?: {
                  regularMarketPrice?: number;
                  chartPreviousClose?: number;
                  currency?: string;
                  symbol?: string;
                  longName?: string;
                  shortName?: string;
                  instrumentType?: string;
                };
              }>;
            };
          };
          const meta = j.chart?.result?.[0]?.meta;
          if (!meta || typeof meta.regularMarketPrice !== 'number') return;
          const prev = meta.chartPreviousClose ?? meta.regularMarketPrice;
          const change = prev ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0;
          const id = `yahoo:${sym}`;
          const q: Quote = {
            price: meta.regularMarketPrice,
            change: +change.toFixed(2),
            currency: (meta.currency || 'USD').toUpperCase(),
            name: meta.longName || meta.shortName || sym,
            ts: now,
          };
          out[id] = q;
          cache.set(id, { value: q, expires: now + TTL_MS.yahoo });
        } catch {
          /* swallow */
        }
      }),
    );
  }
}

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids') || '';
  const ids = idsParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  if (ids.length === 0) {
    return Response.json({ quotes: {}, ts: Date.now() });
  }

  const now = Date.now();
  const result: Record<string, Quote> = {};
  const todoBySource: Record<Source, string[]> = { upbit: [], yahoo: [] };

  for (const id of ids) {
    const hit = cache.get(id);
    if (hit && hit.expires > now) {
      result[id] = hit.value;
      continue;
    }
    const idx = id.indexOf(':');
    if (idx <= 0) continue;
    const src = id.slice(0, idx);
    const sym = id.slice(idx + 1);
    if (src === 'upbit' || src === 'yahoo') {
      todoBySource[src].push(sym);
    }
  }

  await Promise.all([
    todoBySource.upbit.length ? fetchUpbit(todoBySource.upbit, result, now) : null,
    todoBySource.yahoo.length ? fetchYahoo(todoBySource.yahoo, result, now) : null,
  ]);

  // For ids whose upstream call failed, serve the (possibly expired) cached value.
  for (const id of ids) {
    if (!result[id]) {
      const stale = cache.get(id);
      if (stale) result[id] = stale.value;
    }
  }

  return Response.json(
    { quotes: result, ts: now },
    {
      headers: {
        // Browser may cache for a few seconds; CDN/edge for 20s.
        'Cache-Control': 'public, max-age=10, s-maxage=20, stale-while-revalidate=60',
      },
    },
  );
}
