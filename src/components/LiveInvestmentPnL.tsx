'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useMode } from '@/components/ModeProvider';
import { useInvestments } from '@/lib/investments';
import { type Currency, FX_IDS, type QuoteId, toKRW, useQuotes } from '@/lib/quotes';

/**
 * Compact live-PNL card for the home screen.
 * Renders nothing when the user has no investments in the current mode.
 *
 * Mirrors the subscription pattern from /settings/investments and /wallet
 * — instant render from cache, background polling while visible.
 */
export default function LiveInvestmentPnL() {
  const { mode } = useMode();
  const { items, ready } = useInvestments();

  const list = useMemo(() => items.filter((i) => i.scope === mode), [items, mode]);
  const liveIds = useMemo<QuoteId[]>(() => {
    const ids = new Set<QuoteId>();
    for (const i of list) {
      if (i.autoQuote && i.quoteId) ids.add(i.quoteId as QuoteId);
    }
    for (const fx of FX_IDS) ids.add(fx);
    return Array.from(ids);
  }, [list]);
  const { quotes } = useQuotes(liveIds);

  if (!ready || list.length === 0) return null;

  let totalKRW = 0;
  let totalCostKRW = 0;
  for (const i of list) {
    const live = i.autoQuote && i.quoteId ? quotes[i.quoteId as QuoteId] : undefined;
    const productCcy = (i.currency ?? 'KRW') as Currency;
    const livePriceKRW = live ? toKRW(live.price, live.currency) : undefined;
    const shares = i.shares ?? 0;
    const valueKRW = livePriceKRW != null ? livePriceKRW * shares : i.currentValue;
    const costKRW = toKRW(shares * (i.avgPrice ?? 0), productCcy);
    totalKRW += valueKRW;
    totalCostKRW += costKRW;
  }

  if (totalCostKRW === 0 && totalKRW === 0) return null;

  const pnl = totalKRW - totalCostKRW;
  const pct = totalCostKRW > 0 ? (pnl / totalCostKRW) * 100 : 0;
  const positive = pnl >= 0;

  // Find any live quote for the timestamp
  const lastTs = list.reduce((m, i) => {
    const q = i.quoteId ? quotes[i.quoteId as QuoteId] : undefined;
    return q?.ts ? Math.max(m, q.ts) : m;
  }, 0);
  const sec = lastTs ? Math.max(0, Math.floor((Date.now() - lastTs) / 1000)) : null;
  const freshness =
    sec === null
      ? '대기 중'
      : sec < 30
        ? '실시간'
        : sec < 60
          ? '방금'
          : `${Math.floor(sec / 60)}분 전`;

  return (
    <section className="px-5 pb-3">
      <Link
        href="/settings/investments"
        className="tap block overflow-hidden rounded-2xl"
        style={{
          background: positive
            ? 'linear-gradient(135deg, #00B956 0%, #008C40 100%)'
            : 'linear-gradient(135deg, #F04452 0%, #C71F2D 100%)',
          boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
        }}
      >
        <div className="flex items-center justify-between px-5 py-4 text-white">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span style={{ fontSize: 11, fontWeight: 800, opacity: 0.9 }}>
                투자 손익
              </span>
              <span style={{
                display: 'inline-block', width: 5, height: 5, borderRadius: 3,
                background: lastTs ? '#fff' : 'rgba(255,255,255,0.5)',
              }} />
              <span style={{ fontSize: 10, fontWeight: 700, opacity: 0.85 }}>
                {freshness}
              </span>
            </div>
            <p className="tnum mt-1 tracking-tight" style={{ fontSize: 'var(--text-xl)', fontWeight: 800 }}>
              {positive ? '+' : '−'}{Math.abs(Math.round(pnl)).toLocaleString('ko-KR')}원
            </p>
            <p className="tnum mt-0.5" style={{ fontSize: 11, opacity: 0.85 }}>
              평가 {Math.round(totalKRW / 10000).toLocaleString('ko-KR')}만 ·
              {' '}원금 {Math.round(totalCostKRW / 10000).toLocaleString('ko-KR')}만
            </p>
          </div>
          <div
            className="flex h-12 w-16 items-center justify-center rounded-xl"
            style={{ background: 'rgba(255,255,255,0.22)' }}
          >
            <p className="tnum" style={{ fontSize: 14, fontWeight: 800 }}>
              {positive ? '+' : '−'}{Math.abs(pct).toFixed(2)}%
            </p>
          </div>
        </div>
      </Link>
    </section>
  );
}
