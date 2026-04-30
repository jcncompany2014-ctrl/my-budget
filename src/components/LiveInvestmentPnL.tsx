'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { useInvestments } from '@/lib/investments';
import { type Currency, FX_IDS, type QuoteId, toKRW, useQuotes } from '@/lib/quotes';

/**
 * Hero-style live P&L card for the home screen.
 *
 * Design:
 *   • Card-on-card surface (no garish full gradient)
 *   • Subtle aurora wash from one corner — color-coded but quiet
 *   • Big bold P&L number with directional caret
 *   • Pill % indicator handles huge values gracefully (151343% → 151,343%)
 *   • Stats row separated by hairline
 *   • Pulsing live dot + freshness ticker
 *
 * Renders nothing if there are no investments in the current mode.
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

  // Re-render every 30s so freshness label stays accurate
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  if (!ready || list.length === 0) return null;

  let totalKRW = 0;
  let totalCostKRW = 0;
  let topMover: { name: string; change: number } | null = null;
  let lastTs = 0;
  for (const i of list) {
    const live = i.autoQuote && i.quoteId ? quotes[i.quoteId as QuoteId] : undefined;
    const productCcy = (i.currency ?? 'KRW') as Currency;
    const livePriceKRW = live ? toKRW(live.price, live.currency) : undefined;
    const shares = i.shares ?? 0;
    const valueKRW = livePriceKRW != null ? livePriceKRW * shares : i.currentValue;
    const costKRW = toKRW(shares * (i.avgPrice ?? 0), productCcy);
    totalKRW += valueKRW;
    totalCostKRW += costKRW;
    if (live?.ts) lastTs = Math.max(lastTs, live.ts);
    if (live && (!topMover || Math.abs(live.change) > Math.abs(topMover.change))) {
      topMover = { name: i.name, change: live.change };
    }
  }

  if (totalCostKRW === 0 && totalKRW === 0) return null;

  const pnl = totalKRW - totalCostKRW;
  const pct = totalCostKRW > 0 ? (pnl / totalCostKRW) * 100 : 0;
  const positive = pnl >= 0;
  const accent = positive ? '#00B956' : '#F04452';

  const sec = lastTs ? Math.max(0, Math.floor((Date.now() - lastTs) / 1000)) : null;
  const freshness =
    sec === null
      ? '시세 대기'
      : sec < 30
        ? '실시간'
        : sec < 60
          ? '방금'
          : sec < 3600
            ? `${Math.floor(sec / 60)}분 전`
            : `${Math.floor(sec / 3600)}시간 전`;

  return (
    <section className="px-5 pb-3">
      <Link
        href="/settings/investments"
        className="tap relative block overflow-hidden rounded-2xl"
        style={{
          background: 'var(--color-card)',
          boxShadow:
            '0 1px 2px rgba(20, 28, 40, 0.04), 0 4px 18px rgba(20, 28, 40, 0.06)',
        }}
      >
        {/* Aurora wash — top-right, color-coded, very subtle */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            background: positive
              ? 'radial-gradient(120% 80% at 100% 0%, rgba(0, 185, 86, 0.14) 0%, rgba(0, 185, 86, 0.04) 35%, transparent 70%)'
              : 'radial-gradient(120% 80% at 100% 0%, rgba(240, 68, 82, 0.14) 0%, rgba(240, 68, 82, 0.04) 35%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />
        {/* Accent edge — vertical bar on the left */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0, top: 16, bottom: 16,
            width: 3,
            borderRadius: 2,
            background: accent,
            opacity: 0.85,
          }}
        />

        <div className="relative px-5 py-4">
          {/* Header row */}
          <div className="mb-1 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span
                className="animate-pulse"
                style={{
                  display: 'inline-block',
                  width: 6, height: 6, borderRadius: 999,
                  background: accent,
                }}
              />
              <span style={{
                color: 'var(--color-text-3)',
                fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
              }}>
                실시간 투자 손익
              </span>
              <span style={{
                color: 'var(--color-text-4)',
                fontSize: 11, fontWeight: 600,
              }}>
                · {freshness}
              </span>
            </div>
            <span
              className="tnum"
              style={{
                padding: '4px 10px',
                borderRadius: 999,
                background: positive ? 'rgba(0, 185, 86, 0.12)' : 'rgba(240, 68, 82, 0.12)',
                color: accent,
                fontSize: 12,
                fontWeight: 800,
                whiteSpace: 'nowrap',
                letterSpacing: '-0.01em',
              }}
            >
              {fmtPct(pct)}
            </span>
          </div>

          {/* Main number */}
          <div className="mt-2 flex items-baseline gap-1">
            <span style={{ color: accent, fontSize: 16, fontWeight: 900, lineHeight: 1 }}>
              {positive ? '▲' : '▼'}
            </span>
            <span
              className="tnum"
              style={{
                color: 'var(--color-text-1)',
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
              }}
            >
              {positive ? '+' : '−'}{Math.abs(Math.round(pnl)).toLocaleString('ko-KR')}
            </span>
            <span style={{
              color: 'var(--color-text-3)',
              fontSize: 14, fontWeight: 700,
              marginLeft: 2,
            }}>
              원
            </span>
          </div>

          {/* Top mover line — only if we have one and abs change > 0.1% */}
          {topMover && Math.abs(topMover.change) >= 0.1 && (
            <p className="mt-1.5 truncate" style={{
              color: 'var(--color-text-3)',
              fontSize: 11, fontWeight: 600,
            }}>
              <span style={{
                color: topMover.change >= 0 ? '#00B956' : '#F04452',
                fontWeight: 800,
              }}>
                {topMover.change >= 0 ? '▲' : '▼'} {topMover.name}
              </span>
              {' '}
              <span className="tnum">{topMover.change >= 0 ? '+' : ''}{topMover.change.toFixed(2)}%</span>
              <span style={{ color: 'var(--color-text-4)' }}> 가장 큰 변동</span>
            </p>
          )}

          {/* Hairline + stats */}
          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--color-divider)' }}>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p style={{
                  color: 'var(--color-text-4)',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                }}>
                  원금
                </p>
                <p className="tnum" style={{
                  color: 'var(--color-text-2)',
                  fontSize: 13, fontWeight: 700, marginTop: 2,
                }}>
                  {fmtCompactKRW(totalCostKRW)}
                </p>
              </div>
              <div className="flex-1" style={{
                height: 1, background: 'var(--color-divider)', marginBottom: 6,
              }} />
              <div className="text-right">
                <p style={{
                  color: 'var(--color-text-4)',
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.05em',
                }}>
                  평가액
                </p>
                <p className="tnum" style={{
                  color: 'var(--color-text-1)',
                  fontSize: 13, fontWeight: 800, marginTop: 2,
                }}>
                  {fmtCompactKRW(totalKRW)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Link>
    </section>
  );
}

/** Format % with graceful overflow handling for absurd values. */
function fmtPct(p: number): string {
  const abs = Math.abs(p);
  const sign = p >= 0 ? '+' : '−';
  if (abs >= 10_000) return sign + Math.round(abs).toLocaleString('en-US') + '%';
  if (abs >= 1000) return sign + abs.toFixed(0) + '%';
  if (abs >= 100) return sign + abs.toFixed(1) + '%';
  return sign + abs.toFixed(2) + '%';
}

/** Compact KRW: 1억 미만 → 만원, 1억 이상 → 억원 (소수 1자리). */
function fmtCompactKRW(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '';
  if (abs >= 100_000_000) {
    const v = abs / 100_000_000;
    const fixed = v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2);
    return sign + fixed.replace(/\.?0+$/, '') + '억원';
  }
  if (abs >= 10_000) {
    return sign + Math.round(abs / 10_000).toLocaleString('ko-KR') + '만원';
  }
  return sign + Math.round(abs).toLocaleString('ko-KR') + '원';
}
