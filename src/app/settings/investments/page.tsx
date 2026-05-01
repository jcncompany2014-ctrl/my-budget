'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import AssetIcon from '@/components/icons/AssetIcon';
import { useMode } from '@/components/ModeProvider';
import Money from '@/components/Money';
import { SkeletonList } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import Sheet from '@/components/ui/Sheet';
import { useAccounts } from '@/lib/accounts';
import { useInvestments } from '@/lib/investments';
import {
  type Currency,
  defaultCurrencyForKind,
  FX_IDS,
  fxRateToKRW,
  type Quote,
  type QuoteId,
  tickerToQuoteId,
  toKRW,
  useQuotes,
} from '@/lib/quotes';
import type { Investment } from '@/lib/types';

const COLORS = ['#3182F6', '#00B956', '#F472B6', '#FF8A1F', '#8B5CF6', '#14B8A6'];
const KIND_LABEL: Record<Investment['kind'], string> = {
  stock: '주식',
  fund: '펀드',
  crypto: '암호화폐',
  other: '기타',
};
const CURRENCIES: Currency[] = ['KRW', 'USD', 'JPY', 'USDT', 'EUR', 'CNY', 'HKD'];
const CURRENCY_LABEL: Record<Currency, string> = {
  KRW: '원 (KRW)',
  USD: '달러 (USD)',
  JPY: '엔 (JPY)',
  USDT: '테더 (USDT)',
  EUR: '유로 (EUR)',
  CNY: '위안 (CNY)',
  HKD: '홍콩달러 (HKD)',
};
const LEVERAGES = [1, 2, 3, 5, 10, 20, 50, 100];

function formatNative(price: number, currency: string): string {
  const c = currency.toUpperCase();
  if (c === 'KRW') return Math.round(price).toLocaleString('ko-KR') + '원';
  if (c === 'JPY') return '¥' + Math.round(price).toLocaleString('ja-JP');
  if (c === 'USD')
    return (
      '$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  if (c === 'USDT' || c === 'USDC') {
    return (
      price.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: price < 1 ? 4 : 2,
      }) +
      ' ' +
      c
    );
  }
  if (c === 'EUR')
    return (
      '€' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  if (c === 'CNY')
    return (
      '¥' + price.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  if (c === 'HKD')
    return (
      'HK$' + price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    );
  return price.toString() + ' ' + c;
}

export default function InvestmentsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useInvestments();
  const { accounts } = useAccounts();
  const [editing, setEditing] = useState<Investment | null>(null);
  const [creating, setCreating] = useState(false);

  const list = useMemo(() => items.filter((i) => i.scope === mode), [items, mode]);
  const liveIds = useMemo<QuoteId[]>(() => {
    const ids = new Set<QuoteId>();
    for (const i of list) {
      if (i.autoQuote && i.quoteId) ids.add(i.quoteId as QuoteId);
    }
    if (editing?.autoQuote && editing.quoteId) ids.add(editing.quoteId as QuoteId);
    for (const fx of FX_IDS) ids.add(fx);
    return Array.from(ids);
  }, [list, editing]);
  const { quotes, refresh, loading } = useQuotes(liveIds);

  if (!ready) {
    return (
      <>
        <TopBar title="투자" />
        <SkeletonList rows={4} />
      </>
    );
  }

  const enriched = list.map((i) => {
    const live = i.autoQuote && i.quoteId ? quotes[i.quoteId as QuoteId] : undefined;
    const productCcy = (i.currency ?? 'KRW') as Currency;
    const livePriceProductCcy = live?.price;
    const livePriceKRW = live ? toKRW(live.price, live.currency) : undefined;

    const shares = i.shares ?? 0;
    const valueProductCcy = livePriceProductCcy != null ? livePriceProductCcy * shares : null;
    const valueKRW = livePriceKRW != null ? livePriceKRW * shares : i.currentValue;

    const costProductCcy = shares * (i.avgPrice ?? 0);
    const costKRW = toKRW(costProductCcy, productCcy);

    const lev = i.leverage ?? 1;
    const pnlProductCcy = valueProductCcy != null ? valueProductCcy - costProductCcy : 0;
    const pnlKRW = valueKRW - costKRW;
    const pnlPctSpot = costProductCcy > 0 ? (pnlProductCcy / costProductCcy) * 100 : 0;
    const pnlPctLeveraged = pnlPctSpot * lev;

    return {
      i,
      live,
      productCcy,
      livePriceProductCcy,
      livePriceKRW,
      valueProductCcy,
      valueKRW,
      costProductCcy,
      costKRW,
      pnlProductCcy,
      pnlKRW,
      pnlPctSpot,
      pnlPctLeveraged,
      lev,
    };
  });

  const totalKRW = enriched.reduce((s, e) => s + e.valueKRW, 0);
  const totalCostKRW = enriched.reduce((s, e) => s + e.costKRW, 0);
  const profitKRW = totalKRW - totalCostKRW;
  const profitPctKRW = totalCostKRW > 0 ? (profitKRW / totalCostKRW) * 100 : 0;

  const lastTs = enriched.reduce((m, e) => (e.live?.ts ? Math.max(m, e.live.ts) : m), 0);

  const startNew = () => {
    setEditing({
      id: 'inv-' + Date.now().toString(36),
      name: '',
      scope: mode,
      kind: 'stock',
      currentValue: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      autoQuote: true,
      currency: 'KRW',
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title="투자"
        right={
          <button
            type="button"
            onClick={() => router.back()}
            className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            완료
          </button>
        }
      />

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <div className="flex items-baseline justify-between">
            <p
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}
            >
              평가액 (KRW 환산)
            </p>
            <LiveBadge ts={lastTs} loading={loading} onRefresh={refresh} />
          </div>
          <Money
            value={totalKRW}
            sign="never"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}
          />
          {totalCostKRW > 0 && (
            <p
              className="tnum mt-1"
              style={{
                fontSize: 'var(--text-xs)',
                color: profitKRW >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                fontWeight: 700,
              }}
            >
              {profitKRW >= 0 ? '+' : '−'}
              {Math.abs(Math.round(profitKRW)).toLocaleString('ko-KR')}원 (
              {profitKRW >= 0 ? '+' : '−'}
              {Math.abs(profitPctKRW).toFixed(2)}%)
            </p>
          )}
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        {list.length === 0 ? (
          <div
            className="rounded-2xl px-6 py-12 text-center"
            style={{ background: 'var(--color-card)' }}
          >
            <p className="text-3xl">📈</p>
            <p
              className="mt-2"
              style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
            >
              투자 자산을 추가해 보세요
            </p>
            <p
              className="mt-1"
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}
            >
              주 통화로 평단을 입력하면 KRW 환산까지 실시간으로
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {enriched.map((e) => {
              const {
                i,
                live,
                productCcy,
                livePriceProductCcy,
                valueKRW,
                pnlKRW,
                pnlPctLeveraged,
                pnlPctSpot,
                lev,
              } = e;
              const showPct = lev > 1 ? pnlPctLeveraged : pnlPctSpot;
              return (
                <button
                  key={i.id}
                  type="button"
                  onClick={() => {
                    setEditing(i);
                    setCreating(false);
                  }}
                  className="tap w-full rounded-2xl px-4 py-4 text-left"
                  style={{ background: 'var(--color-card)' }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-3">
                      <AssetIcon investment={i} size={40} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p
                            className="truncate"
                            style={{
                              color: 'var(--color-text-1)',
                              fontSize: 'var(--text-base)',
                              fontWeight: 700,
                            }}
                          >
                            {i.name}
                          </p>
                          {lev > 1 && (
                            <span
                              className="shrink-0 rounded px-1.5 py-0.5"
                              style={{
                                background: 'var(--color-text-1)',
                                color: 'var(--color-card)',
                                fontSize: 9,
                                fontWeight: 800,
                                letterSpacing: '0.02em',
                              }}
                            >
                              {lev}x
                            </span>
                          )}
                          {i.autoQuote && i.quoteId && (
                            <span
                              title="실시간 시세 연동"
                              style={{
                                display: 'inline-block',
                                width: 6,
                                height: 6,
                                borderRadius: 3,
                                background: live ? '#00B956' : 'var(--color-gray-300)',
                              }}
                            />
                          )}
                        </div>
                        <p
                          className="truncate"
                          style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
                        >
                          {KIND_LABEL[i.kind]}
                          {i.ticker ? ` · ${i.ticker}` : ''}
                          {productCcy !== 'KRW' ? ` · ${productCcy}` : ''}
                          {live && (
                            <span className="tnum">
                              {' '}
                              · {live.change >= 0 ? '+' : ''}
                              {live.change}%
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Money
                        value={valueKRW}
                        sign="never"
                        style={{
                          color: 'var(--color-text-1)',
                          fontSize: 'var(--text-base)',
                          fontWeight: 700,
                        }}
                      />
                      {productCcy !== 'KRW' &&
                        livePriceProductCcy != null &&
                        (i.shares ?? 0) > 0 && (
                          <p className="tnum" style={{ color: 'var(--color-text-3)', fontSize: 9 }}>
                            {formatNative(livePriceProductCcy * (i.shares ?? 0), productCcy)}
                          </p>
                        )}
                      {Math.abs(pnlKRW) > 0.5 && (
                        <p
                          className="tnum mt-0.5"
                          style={{
                            fontSize: 'var(--text-xxs)',
                            color: pnlKRW >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                            fontWeight: 700,
                          }}
                        >
                          {pnlKRW >= 0 ? '+' : '−'}
                          {Math.abs(Math.round(pnlKRW)).toLocaleString('ko-KR')} (
                          {pnlKRW >= 0 ? '+' : '−'}
                          {Math.abs(showPct).toFixed(1)}%{lev > 1 ? `·${lev}x` : ''})
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="px-5 pb-10 pt-2">
        <button
          type="button"
          onClick={startNew}
          className="tap w-full rounded-2xl border-2 border-dashed py-4"
          style={{
            borderColor: 'var(--color-gray-300)',
            color: 'var(--color-text-2)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          + 투자 추가
        </button>
      </section>

      {editing && (
        <Editor
          i={editing}
          isNew={creating}
          accounts={accounts.filter(
            (a) => a.scope === mode && (a.type === 'investment' || a.type === 'bank'),
          )}
          previewQuote={
            editing.autoQuote && editing.quoteId ? quotes[editing.quoteId as QuoteId] : undefined
          }
          onSave={(i) => {
            if (creating) add(i);
            else update(i.id, i);
            toast.show(creating ? '투자 추가 완료' : '수정 완료', 'success');
            setEditing(null);
            setCreating(false);
          }}
          onDelete={
            creating
              ? undefined
              : () => {
                  remove(editing.id);
                  toast.show('삭제 완료', 'info');
                  setEditing(null);
                }
          }
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function LiveBadge({
  ts,
  loading,
  onRefresh,
}: {
  ts: number;
  loading: boolean;
  onRefresh: () => void;
}) {
  const [, force] = useState(0);
  useEffect(() => {
    const t = setInterval(() => force((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const label = !ts
    ? '시세 대기 중'
    : (() => {
        const sec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
        if (sec < 30) return '실시간';
        if (sec < 60) return '방금';
        const min = Math.floor(sec / 60);
        if (min < 60) return `${min}분 전`;
        return `${Math.floor(min / 60)}시간 전`;
      })();
  return (
    <button
      type="button"
      onClick={onRefresh}
      className="tap inline-flex items-center gap-1 rounded-full px-2 py-1"
      style={{
        background: 'var(--color-gray-100)',
        color: 'var(--color-text-3)',
        fontSize: 11,
        fontWeight: 700,
      }}
      aria-label="새로고침"
    >
      <span
        className={loading ? 'animate-pulse' : ''}
        style={{
          display: 'inline-block',
          width: 6,
          height: 6,
          borderRadius: 3,
          background: ts ? '#00B956' : 'var(--color-gray-300)',
        }}
      />
      {label}
    </button>
  );
}

function Editor({
  i,
  isNew,
  accounts,
  previewQuote,
  onSave,
  onDelete,
  onCancel,
}: {
  i: Investment;
  isNew: boolean;
  accounts: ReturnType<typeof useAccounts>['accounts'];
  previewQuote?: Quote;
  onSave: (i: Investment) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(i);
  const productCcy = (draft.currency ?? defaultCurrencyForKind(draft.kind)) as Currency;

  // When kind changes and currency is unset/no-longer-sensible, reset to a sensible default.
  useEffect(() => {
    if (!draft.currency) {
      setDraft((d) => ({ ...d, currency: defaultCurrencyForKind(d.kind) }));
    }
    // Crypto leverage only applies to crypto; reset when kind != crypto
    if (draft.kind !== 'crypto' && draft.leverage && draft.leverage > 1) {
      setDraft((d) => ({ ...d, leverage: 1 }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.kind]);

  // Keep quoteId in sync with ticker + kind + currency when autoQuote is on
  useEffect(() => {
    if (!draft.autoQuote) return;
    if (!draft.ticker) {
      if (draft.quoteId) setDraft((d) => ({ ...d, quoteId: undefined }));
      return;
    }
    const next = tickerToQuoteId(draft.ticker, draft.kind, productCcy);
    if (next !== (draft.quoteId ?? null)) {
      setDraft((d) => ({ ...d, quoteId: next ?? undefined }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ticker, draft.kind, draft.autoQuote, productCcy]);

  const livePriceKRW = previewQuote ? toKRW(previewQuote.price, previewQuote.currency) : undefined;
  const fxRate = fxRateToKRW(productCcy);

  const shares = draft.shares ?? 0;
  const liveValueProduct =
    draft.autoQuote && previewQuote != null && shares > 0 ? previewQuote.price * shares : null;
  const liveValueKRW =
    draft.autoQuote && livePriceKRW != null && shares > 0 ? livePriceKRW * shares : null;

  const lev = draft.leverage ?? 1;
  const isCrypto = draft.kind === 'crypto';

  // For crypto, the user enters MARGIN (capital they actually put in) in product
  // currency. Gross notional = margin × leverage. shares stays schema-of-record:
  //   shares = (margin × leverage) / avgPrice
  // avgPrice and leverage edits preserve the typed margin and re-derive shares —
  // the user's "I deposited 500 USDT" stays fixed; exposure flexes around it.
  const [marginInput, setMarginInput] = useState(() => {
    const s = i.shares ?? 0;
    const a = i.avgPrice ?? 0;
    const l = i.leverage ?? 1;
    return s > 0 && a > 0 ? String((s * a) / l) : '';
  });

  useEffect(() => {
    if (isCrypto) {
      const s = draft.shares ?? 0;
      const a = draft.avgPrice ?? 0;
      const l = draft.leverage ?? 1;
      setMarginInput(s > 0 && a > 0 ? String((s * a) / l) : '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.kind]);

  const handleAvgPriceChange = (raw: string) => {
    const newAvg = Number(raw) || 0;
    if (isCrypto) {
      const margin = parseFloat(marginInput) || 0;
      setDraft({
        ...draft,
        avgPrice: newAvg,
        shares: newAvg > 0 ? (margin * lev) / newAvg : draft.shares,
      });
    } else {
      setDraft({ ...draft, avgPrice: newAvg });
    }
  };

  const handleMarginChange = (raw: string) => {
    setMarginInput(raw);
    const margin = parseFloat(raw) || 0;
    const avg = draft.avgPrice ?? 0;
    if (avg > 0) {
      setDraft({ ...draft, shares: (margin * lev) / avg });
    } else if (raw === '' || margin === 0) {
      setDraft({ ...draft, shares: 0 });
    }
  };

  const handleLeverageChange = (L: number) => {
    const margin = parseFloat(marginInput) || 0;
    const avg = draft.avgPrice ?? 0;
    setDraft({
      ...draft,
      leverage: L,
      shares: avg > 0 ? (margin * L) / avg : draft.shares,
    });
  };

  const valid =
    draft.name.trim().length > 0 && (draft.autoQuote ? !!draft.quoteId : draft.currentValue >= 0);

  const handleSave = () => {
    const persisted: Investment = {
      ...draft,
      currency: productCcy,
      leverage: draft.kind === 'crypto' ? lev : undefined,
      currentValue:
        draft.autoQuote && liveValueKRW != null ? Math.round(liveValueKRW) : draft.currentValue,
    };
    onSave(persisted);
  };

  return (
    <Sheet open onClose={onCancel}>
      <h2
        className="mb-4"
        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}
      >
        {isNew ? '투자 추가' : '투자 편집'}
      </h2>

      <Field label="종목명 *">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="예) 삼성전자, 비트코인, Apple"
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </Field>

      <Field label="종류">
        <div className="flex gap-2">
          {(['stock', 'fund', 'crypto', 'other'] as const).map((k) => {
            const sel = draft.kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    kind: k,
                    currency: defaultCurrencyForKind(k),
                    leverage: k === 'crypto' ? (draft.leverage ?? 1) : undefined,
                  })
                }
                className="tap flex-1 rounded-xl py-3"
                style={{
                  background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                  color: sel ? '#fff' : 'var(--color-text-2)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                }}
              >
                {KIND_LABEL[k]}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="주 통화">
        <div className="flex flex-wrap gap-1.5">
          {CURRENCIES.map((c) => {
            const sel = productCcy === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setDraft({ ...draft, currency: c })}
                className="tap rounded-lg px-3 py-2"
                style={{
                  background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                  color: sel ? '#fff' : 'var(--color-text-2)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {c}
              </button>
            );
          })}
        </div>
        <p className="mt-1.5" style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
          {CURRENCY_LABEL[productCcy]}
          {productCcy !== 'KRW' && fxRate && (
            <span className="tnum">
              {' '}
              · 1 {productCcy} ≈ {Math.round(fxRate).toLocaleString('ko-KR')}원
            </span>
          )}
        </p>
      </Field>

      <Field
        label={
          draft.kind === 'crypto'
            ? '티커 (예: BTC, ETH, DOGE — Binance USDT 페어)'
            : draft.kind === 'stock'
              ? '티커 (예: 005930=삼성전자, AAPL=애플, 7203.T=토요타)'
              : '티커 (선택)'
        }
      >
        <input
          value={draft.ticker ?? ''}
          onChange={(e) => setDraft({ ...draft, ticker: e.target.value.toUpperCase() })}
          placeholder={
            draft.kind === 'crypto' ? 'BTC' : draft.kind === 'stock' ? '005930 / AAPL / 7203.T' : ''
          }
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </Field>

      {(draft.kind === 'stock' || draft.kind === 'crypto') && (
        <Field label="실시간 시세">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, autoQuote: !draft.autoQuote })}
            className="tap flex w-full items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'var(--color-gray-100)' }}
          >
            <div className="text-left">
              <p
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                {draft.autoQuote ? '자동 시세 사용 중' : '수동 평가액 입력'}
              </p>
              <p
                style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 2 }}
              >
                {draft.autoQuote
                  ? draft.quoteId
                    ? `소스: ${draft.quoteId}`
                    : '티커를 입력하세요'
                  : '시세 수동 관리'}
              </p>
            </div>
            <Switch on={!!draft.autoQuote} />
          </button>
          {draft.autoQuote && previewQuote && (
            <div
              className="mt-2 rounded-xl px-4 py-3"
              style={{ background: 'var(--color-primary-soft)' }}
            >
              <p
                style={{
                  color: 'var(--color-text-3)',
                  fontSize: 'var(--text-xxs)',
                  fontWeight: 700,
                }}
              >
                현재가
              </p>
              <p
                className="tnum mt-0.5"
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 800,
                }}
              >
                {formatNative(previewQuote.price, previewQuote.currency)}
                <span
                  className="ml-2"
                  style={{
                    color:
                      previewQuote.change >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                    fontSize: 'var(--text-xs)',
                  }}
                >
                  {previewQuote.change >= 0 ? '+' : ''}
                  {previewQuote.change}%
                </span>
              </p>
              {previewQuote.currency !== 'KRW' && livePriceKRW != null && (
                <p
                  className="tnum mt-0.5"
                  style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}
                >
                  ≈ {Math.round(livePriceKRW).toLocaleString('ko-KR')}원
                </p>
              )}
            </div>
          )}
        </Field>
      )}

      {draft.kind === 'crypto' && (
        <Field label="레버리지">
          <div className="flex flex-wrap gap-1.5">
            {LEVERAGES.map((L) => {
              const sel = lev === L;
              return (
                <button
                  key={L}
                  type="button"
                  onClick={() => handleLeverageChange(L)}
                  className="tap rounded-lg px-3 py-2"
                  style={{
                    background: sel
                      ? L === 1
                        ? 'var(--color-text-1)'
                        : 'var(--color-danger)'
                      : 'var(--color-gray-100)',
                    color: sel ? '#fff' : 'var(--color-text-2)',
                    fontSize: 12,
                    fontWeight: 800,
                  }}
                >
                  {L}x
                </button>
              );
            })}
          </div>
          {lev > 1 && (
            <p
              className="mt-1.5"
              style={{ color: 'var(--color-danger)', fontSize: 11, fontWeight: 600 }}
            >
              {lev}x 레버리지 — P&L 표시 % 가 {lev}배로 증폭됩니다
            </p>
          )}
        </Field>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Field label={`평균 매수가 (${productCcy})`}>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={draft.avgPrice ?? ''}
            onChange={(e) => handleAvgPriceChange(e.target.value)}
            placeholder="0"
            className="tnum h-12 w-full rounded-xl px-4 outline-none"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
            }}
          />
        </Field>
        {isCrypto ? (
          <Field label={`투입 자본 (${productCcy})`}>
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={marginInput}
              onChange={(e) => handleMarginChange(e.target.value)}
              placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
            {(draft.shares ?? 0) > 0 && (draft.avgPrice ?? 0) > 0 && (
              <p className="tnum mt-1" style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                ≈{' '}
                {((draft.shares ?? 0) * (draft.avgPrice ?? 0)).toLocaleString('ko-KR', {
                  maximumFractionDigits: 2,
                })}{' '}
                {productCcy} 포지션 · {(draft.shares ?? 0).toFixed(4)} coin
              </p>
            )}
          </Field>
        ) : (
          <Field label="수량 (주)">
            <input
              type="number"
              inputMode="decimal"
              step="any"
              value={draft.shares ?? ''}
              onChange={(e) => setDraft({ ...draft, shares: Number(e.target.value) || 0 })}
              placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
          </Field>
        )}
      </div>

      {accounts.length > 0 && (
        <Field label="연동 계좌 (선택)">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, linkedAccountId: undefined })}
              className="tap rounded-lg px-3 py-2"
              style={{
                background: !draft.linkedAccountId
                  ? 'var(--color-text-1)'
                  : 'var(--color-gray-100)',
                color: !draft.linkedAccountId ? '#fff' : 'var(--color-text-2)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              없음
            </button>
            {accounts.map((a) => {
              const sel = draft.linkedAccountId === a.id;
              return (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, linkedAccountId: a.id })}
                  className="tap rounded-lg px-3 py-2"
                  style={{
                    background: sel ? a.color : `${a.color}1f`,
                    color: sel ? '#fff' : a.color,
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {a.name}
                </button>
              );
            })}
          </div>
          <p className="mt-1.5" style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
            연동하면 시세 변할 때마다 그 계좌의 잔액도 같이 움직입니다
          </p>
        </Field>
      )}

      {!draft.autoQuote && (
        <Field label="현재 평가액 (KRW) *">
          <input
            type="number"
            inputMode="numeric"
            value={draft.currentValue || ''}
            onChange={(e) => setDraft({ ...draft, currentValue: Number(e.target.value) || 0 })}
            placeholder="0"
            className="tnum h-12 w-full rounded-xl px-4 outline-none"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
            }}
          />
        </Field>
      )}

      {draft.autoQuote &&
        liveValueKRW != null &&
        (() => {
          const hasPosition = (draft.shares ?? 0) > 0 && (draft.avgPrice ?? 0) > 0;
          const costProduct = hasPosition ? (draft.shares ?? 0) * (draft.avgPrice ?? 0) : 0;
          const costKRW = hasPosition ? toKRW(costProduct, productCcy) : 0;
          const marginKRW = lev > 1 ? costKRW / lev : costKRW;
          const p = hasPosition ? liveValueKRW - costKRW : 0;
          const equityKRW = hasPosition ? marginKRW + p : liveValueKRW;
          const pp =
            hasPosition && costProduct > 0
              ? (((liveValueProduct ?? 0) - costProduct) / costProduct) * 100
              : 0;
          const ppLev = pp * lev;
          const isLeveraged = lev > 1 && hasPosition;
          return (
            <div
              className="mb-3 rounded-xl px-4 py-3"
              style={{ background: 'var(--color-gray-100)' }}
            >
              <p
                style={{
                  color: 'var(--color-text-3)',
                  fontSize: 'var(--text-xxs)',
                  fontWeight: 700,
                }}
              >
                {isLeveraged ? '현재 자본' : '자동 평가액'}
              </p>
              <p
                className="tnum mt-0.5"
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-lg)',
                  fontWeight: 800,
                }}
              >
                {Math.round(equityKRW).toLocaleString('ko-KR')}원
              </p>
              {productCcy !== 'KRW' && liveValueProduct != null && (
                <p
                  className="tnum mt-0.5"
                  style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}
                >
                  = {formatNative(liveValueProduct, productCcy)}
                </p>
              )}
              {isLeveraged && (
                <p
                  className="tnum mt-0.5"
                  style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}
                >
                  포지션 {Math.round(liveValueKRW).toLocaleString('ko-KR')}원
                </p>
              )}
              {hasPosition && (
                <p
                  className="tnum mt-1"
                  style={{
                    color: p >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                  }}
                >
                  {p >= 0 ? '+' : '−'}
                  {Math.abs(Math.round(p)).toLocaleString('ko-KR')}원 ({p >= 0 ? '+' : '−'}
                  {Math.abs(lev > 1 ? ppLev : pp).toFixed(2)}%{lev > 1 ? ` · ${lev}x` : ''})
                </p>
              )}
            </div>
          );
        })()}

      <div className="flex gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="tap h-12 rounded-xl px-4"
            style={{
              background: 'var(--color-danger-soft)',
              color: 'var(--color-danger)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
            }}
          >
            삭제
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="tap h-12 flex-1 rounded-xl"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          취소
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={handleSave}
          className="tap h-12 flex-1 rounded-xl"
          style={{
            background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
            color: valid ? '#fff' : 'var(--color-text-4)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          저장
        </button>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label
        className="mb-1.5 block"
        style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--color-primary)' : 'var(--color-gray-300)' }}
    >
      <span
        className="absolute h-6 w-6 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </span>
  );
}
