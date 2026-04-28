'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useInvestments } from '@/lib/investments';
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

  if (!ready) return <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>로딩 중...</div>;
  const list = items.filter((i) => i.scope === mode);
  const total = list.reduce((s, i) => s + i.currentValue, 0);
  const totalCost = list.reduce((s, i) => s + (i.shares ?? 0) * (i.avgPrice ?? 0), 0);
  const profit = total - totalCost;

  const startNew = () => {
    setEditing({
      id: 'inv-' + Date.now().toString(36),
      name: '',
      scope: mode,
      kind: 'stock',
      currentValue: 0,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
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
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
            평가액
          </p>
          <Money value={total} sign="never"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-1)' }} />
          {totalCost > 0 && (
            <p className="tnum mt-1" style={{ fontSize: 'var(--text-xs)', color: profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: 700 }}>
              {profit >= 0 ? '+' : '−'}
              {Math.abs(profit).toLocaleString('ko-KR')}원 ({totalCost > 0 ? Math.round((profit / totalCost) * 100) : 0}%)
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
          </div>
        ) : (
          <div className="space-y-2">
            {list.map((i) => {
              const cost = (i.shares ?? 0) * (i.avgPrice ?? 0);
              const p = i.currentValue - cost;
              return (
                <button key={i.id} type="button" onClick={() => { setEditing(i); setCreating(false); }}
                  className="tap w-full rounded-2xl px-4 py-4 text-left"
                  style={{ background: 'var(--color-card)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full text-base font-bold text-white"
                        style={{ background: i.color }}>{KIND_LABEL[i.kind][0]}</div>
                      <div>
                        <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                          {i.name}
                        </p>
                        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                          {KIND_LABEL[i.kind]}{i.ticker ? ` · ${i.ticker}` : ''}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Money value={i.currentValue} sign="never"
                        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }} />
                      {cost > 0 && (
                        <p className="tnum" style={{ fontSize: 'var(--text-xxs)', color: p >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontWeight: 700 }}>
                          {p >= 0 ? '+' : '−'}{Math.abs(p).toLocaleString('ko-KR')}
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
        <button type="button" onClick={startNew}
          className="tap w-full rounded-2xl border-2 border-dashed py-4"
          style={{ borderColor: 'var(--color-gray-300)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          + 투자 추가
        </button>
      </section>

      {editing && (
        <Editor i={editing} isNew={creating}
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

function Editor({ i, isNew, onSave, onDelete, onCancel }: {
  i: Investment; isNew: boolean;
  onSave: (i: Investment) => void; onDelete?: () => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(i);
  const valid = draft.name.trim().length > 0 && draft.currentValue >= 0;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <div className="max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl p-6"
        style={{ background: 'var(--color-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--color-gray-200)' }} />
        <h2 className="mb-4" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
          {isNew ? '투자 추가' : '투자 편집'}
        </h2>

        <Field label="종목명 *">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="예) 삼성전자"
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
        <Field label="티커 (선택)">
          <input value={draft.ticker ?? ''} onChange={(e) => setDraft({ ...draft, ticker: e.target.value })} placeholder="005930"
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
        </Field>
        <div className="grid grid-cols-2 gap-2">
          <Field label="평균가">
            <input type="number" inputMode="numeric"
              value={draft.avgPrice ?? ''} onChange={(e) => setDraft({ ...draft, avgPrice: Number(e.target.value) || 0 })} placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
          </Field>
          <Field label="수량">
            <input type="number" inputMode="numeric"
              value={draft.shares ?? ''} onChange={(e) => setDraft({ ...draft, shares: Number(e.target.value) || 0 })} placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
          </Field>
        </div>
        <Field label="현재 평가액 *">
          <input type="number" inputMode="numeric"
            value={draft.currentValue || ''} onChange={(e) => setDraft({ ...draft, currentValue: Number(e.target.value) || 0 })} placeholder="0"
            className="tnum h-12 w-full rounded-xl px-4 outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
        </Field>

        <div className="flex gap-2">
          {onDelete && (
            <button type="button" onClick={onDelete} className="tap h-12 rounded-xl px-4"
              style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              삭제
            </button>
          )}
          <button type="button" onClick={onCancel} className="tap h-12 flex-1 rounded-xl"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>취소</button>
          <button type="button" disabled={!valid} onClick={() => onSave(draft)} className="tap h-12 flex-1 rounded-xl"
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
