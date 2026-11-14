import type { NextRequest } from 'next/server';

/**
 * Real-time quote aggregator.
 *
 *  GET /api/quotes?ids=binance:BTCUSDT,upbit:BTC,yahoo:AAPL,yahoo:005930.KS,yahoo:7203.T,yahoo:USDKRW=X
 *
 * Sources:
 *   • binance:<symbol>     → USDT (or other) pair from Binance — crypto primary source
 *   • upbit:<symbol>       → KRW pair from Upbit — kept for legacy / KRW-quoted crypto
 *   • yahoo:<symbol>       → Yahoo Finance chart endpoint (US/KR/JP stocks, FX, indices)
 *
 * In-memory cache lives per V8 isolate. TTL is source-dependent so upstream
 * never gets hammered. On upstream failure we serve the previous cached value
 * (even if expired) instead of erroring — keeps the UI ticking.
 */

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

type Quote = {
  price: number; // last/current price in source's native currency
  change: number; // 24h change percent (e.g. -1.42)
  currency: string; // ISO 4217 (KRW, USD, JPY, EUR, USDT, ...)
  name: string; // human-readable name
  ts: number; // when this quote was fetched (ms epoch)
};

type Source = 'binance' | 'upbit' | 'yahoo';
const TTL_MS: Record<Source, number> = {
  binance: 20_000, // 20s — crypto moves fast, Binance is generous
  upbit: 20_000,
  yahoo: 60_000, // 60s — stocks/FX, lighter source
};

/** More than one portfolio ever asks for; keeps a crafted URL from fanning out upstream. */
const MAX_IDS = 60;

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

/* ─── Binance (USDT / BUSD / etc. crypto pairs) ─── */
async function fetchBinance(symbols: string[], out: Record<string, Quote>, now: number) {
  // symbols arrive as e.g. "BTCUSDT", "ETHUSDT" — pass through as-is, uppercased
  const ups = symbols.map((s) => s.toUpperCase());
  const symbolsParam = encodeURIComponent(JSON.stringify(ups));
  try {
    const r = await fetchWithTimeout(
      `https://api.binance.com/api/v3/ticker/24hr?symbols=${symbolsParam}`,
      4000,
      { headers: { Accept: 'application/json' } },
    );
    if (!r.ok) throw new Error(`binance ${r.status}`);
    const arr = (await r.json()) as Array<{
      symbol: string;
      lastPrice: string;
      priceChangePercent: string;
    }>;
    for (const row of arr) {
      const sym = row.symbol;
      // Determine quote currency by suffix (USDT/BUSD/USDC/BTC/ETH/...)
      const ccy = sym.endsWith('USDT')
        ? 'USDT'
        : sym.endsWith('USDC')
          ? 'USDC'
          : sym.endsWith('BUSD')
            ? 'BUSD'
            : 'USD';
      const id = `binance:${sym}`;
      const q: Quote = {
        price: Number(row.lastPrice) || 0,
        change: +Number(row.priceChangePercent).toFixed(2),
        currency: ccy,
        name: sym.replace(/(USDT|USDC|BUSD|USD)$/, ''),
        ts: now,
      };
      out[id] = q;
      cache.set(id, { value: q, expires: now + TTL_MS.binance });
    }
  } catch {
    /* swallow — caller falls back to cache */
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

/* ─── Yahoo Finance chart endpoint (one request per symbol, in parallel) ─── */
type YahooChart = {
  chart?: {
    result?: Array<{
      meta?: {
        regularMarketPrice?: number;
        chartPreviousClose?: number;
        currency?: string;
        longName?: string;
        shortName?: string;
      };
    }>;
  };
};

async function fetchYahooChart(sym: string): Promise<Response> {
  const url = `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=2d`;
  const r = await fetchWithTimeout(url, 4000, {
    headers: { 'User-Agent': UA, Accept: 'application/json' },
  });
  // Yahoo throttles by client signature; the same request without the browser
  // UA (or from the other host) usually goes through.
  if (r.status !== 429 && r.status !== 403) return r;
  return fetchWithTimeout(url.replace('query2.', 'query1.'), 4000, {
    headers: { Accept: 'application/json' },
  });
}

// The v7 batch quote endpoint now answers 401 without a session crumb, so every
// symbol goes through the chart endpoint.
async function fetchYahoo(symbols: string[], out: Record<string, Quote>, now: number) {
  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const r = await fetchYahooChart(sym);
        if (!r.ok) return;
        const meta = ((await r.json()) as YahooChart).chart?.result?.[0]?.meta;
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
        /* the caller serves the last known value */
      }
    }),
  );
}

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids') || '';
  const ids = [
    ...new Set(
      idsParam
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ].slice(0, MAX_IDS);

  if (ids.length === 0) {
    return Response.json({ quotes: {}, ts: Date.now() });
  }

  const now = Date.now();
  const result: Record<string, Quote> = {};
  const todoBySource: Record<Source, string[]> = { binance: [], upbit: [], yahoo: [] };

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
    if (src === 'binance' || src === 'upbit' || src === 'yahoo') {
      todoBySource[src].push(sym);
    }
  }

  await Promise.all([
    todoBySource.binance.length ? fetchBinance(todoBySource.binance, result, now) : null,
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

  // Only a complete answer may be cached. A partial one (an upstream hiccup)
  // would otherwise be replayed by the CDN for the next minute and the app
  // would show missing prices long after the source recovered.
  const complete = ids.every((id) => result[id]);
  return Response.json(
    { quotes: result, ts: now },
    {
      headers: {
        'Cache-Control': complete
          ? 'public, max-age=10, s-maxage=20, stale-while-revalidate=60'
          : 'no-store',
      },
    },
  );
}
