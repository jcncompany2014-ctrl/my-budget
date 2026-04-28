'use client';

import { useMemo, useState } from 'react';
import CategoryDonut from '@/components/CategoryDonut';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { CATEGORIES } from '@/lib/categories';
import { fmt, fmtKRW, isExpense } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

type Period = 'month' | 'week';

export default function StatsPage() {
  const { tx, ready } = useTransactions();
  const { mode } = useMode();
  const [period, setPeriod] = useState<Period>('month');

  const filtered = useMemo(() => {
    const now = new Date();
    if (period === 'month') {
      return tx.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      });
    }
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return tx.filter((t) => new Date(t.date) >= weekAgo);
  }, [tx, period]);

  const expenses = filtered.filter(isExpense);
  const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((t) => {
      map.set(t.cat, (map.get(t.cat) ?? 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries())
      .map(([cat, value]) => ({
        cat,
        value,
        name: CATEGORIES[cat]?.name ?? '기타',
        emoji: CATEGORIES[cat]?.emoji ?? '💰',
        color: CATEGORIES[cat]?.color ?? '#94A3B8',
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  return (
    <>
      <TopBar title="통계" />

      {/* Period switcher */}
      <section className="px-5 pb-3 pt-1">
        <div className="flex rounded-full p-[3px]" style={{ background: 'var(--color-gray-100)' }}>
          {(
            [
              ['month', '이번 달'],
              ['week', '최근 7일'],
            ] as const
          ).map(([k, label]) => {
            const active = period === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setPeriod(k)}
                className="tap flex-1 rounded-full py-2 text-[13px] font-bold"
                style={{
                  background: active ? 'var(--color-card)' : 'transparent',
                  color: active ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {total === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl px-6 py-16 mx-5 text-center" style={{ background: 'var(--color-card)' }}>
          <p className="text-3xl">📊</p>
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
            {mode === 'business' ? '아직 분석할 비용이 없어요' : '아직 분석할 지출이 없어요'}
          </p>
        </div>
      ) : (
        <>
          <section className="flex justify-center px-5 py-6">
            <CategoryDonut data={byCat} total={total} />
          </section>

          {/* Category list */}
          <section className="px-5 pb-8">
            <h2 className="mb-3 text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
              카테고리별
            </h2>
            <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
              {byCat.map((s, i) => {
                const pct = Math.round((s.value / total) * 100);
                return (
                  <div
                    key={s.cat}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < byCat.length - 1 ? '1px solid var(--color-divider)' : 'none' }}
                  >
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-lg"
                      style={{ background: `${s.color}1f` }}
                    >
                      {s.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <p className="text-[15px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
                          {s.name}
                        </p>
                        <p className="tnum text-[15px] font-bold" style={{ color: 'var(--color-text-1)' }}>
                          {fmt(s.value)}원
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-150)' }}>
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${pct}%`, background: s.color }}
                          />
                        </div>
                        <span className="tnum w-10 text-right text-xs" style={{ color: 'var(--color-text-3)' }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Top merchants */}
          <TopMerchants expenses={expenses} />
        </>
      )}
    </>
  );
}

function TopMerchants({ expenses }: { expenses: { merchant: string; amount: number }[] }) {
  const list = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((t) => {
      map.set(t.merchant, (map.get(t.merchant) ?? 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries())
      .map(([merchant, value]) => ({ merchant, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [expenses]);

  if (list.length === 0) return null;

  return (
    <section className="px-5 pb-10">
      <h2 className="mb-3 text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
        많이 쓴 곳
      </h2>
      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
        {list.map((m, i) => (
          <div
            key={m.merchant}
            className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: i < list.length - 1 ? '1px solid var(--color-divider)' : 'none' }}
          >
            <div className="flex items-center gap-3">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold"
                style={{
                  background: i === 0 ? 'var(--color-primary)' : 'var(--color-gray-150)',
                  color: i === 0 ? '#fff' : 'var(--color-text-2)',
                }}
              >
                {i + 1}
              </div>
              <p className="text-[15px] font-medium" style={{ color: 'var(--color-text-1)' }}>
                {m.merchant}
              </p>
            </div>
            <span className="tnum text-[15px] font-bold" style={{ color: 'var(--color-text-1)' }}>
              {fmtKRW(m.value)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
