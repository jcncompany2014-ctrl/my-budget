'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useInvestments } from '@/lib/investments';
import {
  FX_IDS,
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

export default function InvestmentsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useInvestments();
  const [editing, setEditing] = useState<Investment | null>(null);
  const [creating, setCreating] = useState(false);

  // Subscribe to all live quotes for current-mode holdings + FX baselines
  const list = useMemo(() => items.filter((i) => i.scope === mode), [items, mode]);
  const liveIds = useMemo<QuoteId[]>(() => {
    const ids = new Set<QuoteId>();
    for (const i of list) {
      if (i.autoQuote && i.quoteId) ids.add(i.quoteId as QuoteId);
    }
    // Always include FX so non-KRW prices can be converted
    for (const fx of FX_IDS) ids.add(fx);
    return Array.from(ids);
  }, [list]);
  const { quotes, refresh, loading } = useQuotes(liveIds);

  if (!ready)
    return <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>로딩 중...</div>;

  // Compute live values per holding
  const enriched = list.map((i) => {
    const live = i.autoQuote && i.quoteId ? quotes[i.quoteId as QuoteId] : undefined;
    const livePriceKRW = live ? toKRW(live.price, live.currency) : undefined;
    const currentKRW =
      live && i.shares != null
        ? livePriceKRW! * i.shares
        : i.currentValue;
    const cost = (i.shares ?? 0) * (i.avgPrice ?? 0);
    const profit = currentKRW - cost;
    const profitPct = cost > 0 ? (profit / cost) * 100 : 0;
    return { i, live, livePriceKRW, currentKRW, cost, profit, profitPct };
  });

  const total = enriched.reduce((s, e) => s + e.currentKRW, 0);
  const totalCost = enriched.reduce((s, e) => s + e.cost, 0);
  const profit = total - totalCost;
  const profitPct = totalCost > 0 ? (profit / totalCost) * 100 : 0;

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
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title="투자"
        right={
          <button type="button" onClick={() => router.back()} className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            완료
          </button>
        }
      />

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <div className="flex items-baseline justify-between">
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
              평가액
            </p>
            <LiveBadge ts={lastTs} loading={loading} onRefresh={refresh} />
          </div>
          <Money value={total} sign="never"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-1)' }} />
          {totalCost > 0 && (
            <p className="tnum mt-1" style={{ fontSize: 'var(--text-xs)', color: profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: 700 }}>
              {profit >= 0 ? '+' : '−'}
              {Math.abs(Math.round(profit)).toLocaleString('ko-KR')}원 ({profit >= 0 ? '+' : '−'}{Math.abs(profitPct).toFixed(2)}%)
            </p>
          )}
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        {list.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center" style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">📈</p>
            <p className="mt-2" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              투자 자산을 추가해 보세요
            </p>
            <p className="mt-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
              티커만 입력하면 실시간 시세로 자동 평가됩니다
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {enriched.map(({ i, live, currentKRW, cost, profit, profitPct }) => (
              <button key={i.id} type="button" onClick={() => { setEditing(i); setCreating(false); }}
                className="tap w-full rounded-2xl px-4 py-4 text-left"
                style={{ background: 'var(--color-card)' }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white"
                      style={{ background: i.color }}>{KIND_LABEL[i.kind][0]}</div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                          {i.name}
                        </p>
                        {i.autoQuote && i.quoteId && (
                          <span title="실시간 시세 연동" style={{
                            display: 'inline-block', width: 6, height: 6, borderRadius: 3,
                            background: live ? '#00B956' : 'var(--color-gray-300)',
                          }} />
                        )}
                      </div>
                      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                        {KIND_LABEL[i.kind]}{i.ticker ? ` · ${i.ticker}` : ''}
                        {live && (
                          <span className="tnum"> · {live.change >= 0 ? '+' : ''}{live.change}%</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <Money value={currentKRW} sign="never"
                      style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }} />
                    {cost > 0 && (
                      <p className="tnum" style={{ fontSize: 'var(--text-xxs)', color: profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: 700 }}>
                        {profit >= 0 ? '+' : '−'}{Math.abs(Math.round(profit)).toLocaleString('ko-KR')} ({profit >= 0 ? '+' : '−'}{Math.abs(profitPct).toFixed(1)}%)
                      </p>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="px-5 pb-10 pt-2">
        <button type="button" onClick={startNew}
          className="tap w-full rounded-2xl border-2 border-dashed py-4"
          style={{ borderColor: 'var(--color-gray-300)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          + 투자 추가
        </button>
      </section>

      {editing && (
        <Editor i={editing} isNew={creating}
          previewQuote={editing.autoQuote && editing.quoteId ? quotes[editing.quoteId as QuoteId] : undefined}
          onSave={(i) => {
            if (creating) add(i); else update(i.id, i);
            toast.show(creating ? '투자 추가 완료' : '수정 완료', 'success');
            setEditing(null); setCreating(false);
          }}
          onDelete={creating ? undefined : () => { remove(editing.id); toast.show('삭제 완료', 'info'); setEditing(null); }}
          onCancel={() => { setEditing(null); setCreating(false); }}
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
  // Re-render every 30s to update the "방금/n분 전" label
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
          display: 'inline-block', width: 6, height: 6, borderRadius: 3,
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
  previewQuote,
  onSave,
  onDelete,
  onCancel,
}: {
  i: Investment;
  isNew: boolean;
  previewQuote?: Quote;
  onSave: (i: Investment) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(i);

  // Keep quoteId in sync with ticker + kind when autoQuote is on
  useEffect(() => {
    if (!draft.autoQuote) return;
    if (!draft.ticker) {
      if (draft.quoteId) setDraft((d) => ({ ...d, quoteId: undefined }));
      return;
    }
    const next = tickerToQuoteId(draft.ticker, draft.kind);
    if (next !== (draft.quoteId ?? null)) {
      setDraft((d) => ({ ...d, quoteId: next ?? undefined }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.ticker, draft.kind, draft.autoQuote]);

  const livePriceKRW = previewQuote ? toKRW(previewQuote.price, previewQuote.currency) : undefined;
  const liveValue =
    draft.autoQuote && livePriceKRW != null && draft.shares != null
      ? livePriceKRW * draft.shares
      : null;

  const valid =
    draft.name.trim().length > 0 &&
    (draft.autoQuote ? !!draft.quoteId : draft.currentValue >= 0);

  const handleSave = () => {
    // If autoQuote on and we have a live value, write it as the persisted snapshot
    // so wallet pages without live access still see something sensible.
    const persisted: Investment = {
      ...draft,
      currentValue:
        draft.autoQuote && liveValue != null ? Math.round(liveValue) : draft.currentValue,
    };
    onSave(persisted);
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <div className="max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl p-6"
        style={{ background: 'var(--color-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--color-gray-200)' }} />
        <h2 className="mb-4" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
          {isNew ? '투자 추가' : '투자 편집'}
        </h2>

        <Field label="종목명 *">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="예) 삼성전자, 비트코인, Apple"
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
        </Field>
        <Field label="종류">
          <div className="flex gap-2">
            {(['stock', 'fund', 'crypto', 'other'] as const).map((k) => {
              const sel = draft.kind === k;
              return (
                <button key={k} type="button" onClick={() => setDraft({ ...draft, kind: k })}
                  className="tap flex-1 rounded-xl py-3"
                  style={{
                    background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                    color: sel ? '#fff' : 'var(--color-text-2)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                  }}>
                  {KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label={
          draft.kind === 'crypto' ? '티커 (예: BTC, ETH, DOGE)'
            : draft.kind === 'stock' ? '티커 (한국 6자리, 미국 영문 예: AAPL)'
              : '티커 (선택)'
        }>
          <input
            value={draft.ticker ?? ''}
            onChange={(e) => setDraft({ ...draft, ticker: e.target.value.toUpperCase() })}
            placeholder={draft.kind === 'crypto' ? 'BTC' : draft.kind === 'stock' ? '005930 또는 AAPL' : ''}
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
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
                <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                  {draft.autoQuote ? '자동 시세 사용 중' : '수동 평가액 입력'}
                </p>
                <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 2 }}>
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
              <div className="mt-2 rounded-xl px-4 py-3" style={{ background: 'var(--color-primary-soft)' }}>
                <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
                  현재가 ({previewQuote.currency})
                </p>
                <p className="tnum mt-0.5" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 800 }}>
                  {previewQuote.price.toLocaleString('ko-KR')} {previewQuote.currency}
                  <span className="ml-2" style={{
                    color: previewQuote.change >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                    fontSize: 'var(--text-xs)',
                  }}>
                    {previewQuote.change >= 0 ? '+' : ''}{previewQuote.change}%
                  </span>
                </p>
                {previewQuote.currency !== 'KRW' && livePriceKRW != null && (
                  <p className="tnum mt-0.5" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                    ≈ {Math.round(livePriceKRW).toLocaleString('ko-KR')}원
                  </p>
                )}
              </div>
            )}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Field label="평균 매수가 (원)">
            <input type="number" inputMode="numeric"
              value={draft.avgPrice ?? ''} onChange={(e) => setDraft({ ...draft, avgPrice: Number(e.target.value) || 0 })} placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
          </Field>
          <Field label="수량">
            <input type="number" inputMode="decimal"
              value={draft.shares ?? ''} onChange={(e) => setDraft({ ...draft, shares: Number(e.target.value) || 0 })} placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
          </Field>
        </div>

        {!draft.autoQuote && (
          <Field label="현재 평가액 *">
            <input type="number" inputMode="numeric"
              value={draft.currentValue || ''} onChange={(e) => setDraft({ ...draft, currentValue: Number(e.target.value) || 0 })} placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
          </Field>
        )}

        {draft.autoQuote && liveValue != null && (
          <div className="mb-3 rounded-xl px-4 py-3" style={{ background: 'var(--color-gray-100)' }}>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
              자동 평가액
            </p>
            <p className="tnum mt-0.5" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 800 }}>
              {Math.round(liveValue).toLocaleString('ko-KR')}원
            </p>
            {(draft.shares ?? 0) > 0 && (draft.avgPrice ?? 0) > 0 && (() => {
              const cost = (draft.shares ?? 0) * (draft.avgPrice ?? 0);
              const p = liveValue - cost;
              const pp = (p / cost) * 100;
              return (
                <p className="tnum mt-1" style={{
                  color: p >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                  fontSize: 'var(--text-xs)', fontWeight: 700,
                }}>
                  {p >= 0 ? '+' : '−'}{Math.abs(Math.round(p)).toLocaleString('ko-KR')}원 ({p >= 0 ? '+' : '−'}{Math.abs(pp).toFixed(2)}%)
                </p>
              );
            })()}
          </div>
        )}

        <div className="flex gap-2">
          {onDelete && (
            <button type="button" onClick={onDelete} className="tap h-12 rounded-xl px-4"
              style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              삭제
            </button>
          )}
          <button type="button" onClick={onCancel} className="tap h-12 flex-1 rounded-xl"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>취소</button>
          <button type="button" disabled={!valid} onClick={handleSave} className="tap h-12 flex-1 rounded-xl"
            style={{
              background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
              color: valid ? '#fff' : 'var(--color-text-4)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
            }}>저장</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{label}</label>
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
