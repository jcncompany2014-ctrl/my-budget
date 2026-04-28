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

  // Last month comparison (only meaningful for month view)
  const lastMonthExpense = useMemo(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return tx
      .filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === last.getFullYear() && d.getMonth() === last.getMonth();
      })
      .filter(isExpense)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [tx]);

  // Weekly trend — last 4 weeks
  const weeklyTrend = useMemo(() => {
    const now = new Date();
    const weeks: { label: string; expense: number }[] = [];
    for (let i = 3; i >= 0; i--) {
      const start = new Date(now);
      start.setDate(now.getDate() - 7 * (i + 1) + 1);
      start.setHours(0, 0, 0, 0);
      const end = new Date(now);
      end.setDate(now.getDate() - 7 * i);
      end.setHours(23, 59, 59, 999);
      const sum = tx
        .filter((t) => {
          const d = new Date(t.date);
          return d >= start && d <= end;
        })
        .filter(isExpense)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const label = i === 0 ? '이번주' : i === 1 ? '지난주' : `${i + 1}주 전`;
      weeks.push({ label, expense: sum });
    }
    return weeks;
  }, [tx]);

  const expenses = filtered.filter(isExpense);
  const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthDelta = period === 'month' && lastMonthExpense > 0
    ? Math.round(((total - lastMonthExpense) / lastMonthExpense) * 100)
    : null;

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
          {/* Month-over-month comparison */}
          {period === 'month' && monthDelta !== null && (
            <section className="px-5 pb-2 pt-1">
              <div
                className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{
                  background:
                    monthDelta < 0 ? 'var(--color-primary-soft)' : 'var(--color-danger-soft)',
                }}
              >
                <div>
                  <p
                    className="text-[11px] font-bold"
                    style={{
                      color: monthDelta < 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                    }}
                  >
                    지난 달 대비
                  </p>
                  <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-2)' }}>
                    {monthDelta < 0
                      ? `${fmt(lastMonthExpense - total)}원 덜 썼어요`
                      : `${fmt(total - lastMonthExpense)}원 더 썼어요`}
                  </p>
                </div>
                <p
                  className="tnum text-base font-extrabold"
                  style={{ color: monthDelta < 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}
                >
                  {monthDelta > 0 ? '+' : ''}
                  {monthDelta}%
                </p>
              </div>
            </section>
          )}

          {/* Weekly trend */}
          <section className="px-5 pb-3 pt-1">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
              <p className="mb-3 text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
                주간 지출 추이
              </p>
              <div className="flex items-end justify-between gap-2" style={{ height: 80 }}>
                {weeklyTrend.map((w, i) => {
                  const max = Math.max(...weeklyTrend.map((x) => x.expense), 1);
                  const pct = (w.expense / max) * 100;
                  const isThis = i === weeklyTrend.length - 1;
                  return (
                    <div key={w.label} className="flex flex-1 flex-col items-center gap-1.5">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-md transition-all"
                          style={{
                            height: `${pct}%`,
                            minHeight: 2,
                            background: isThis ? 'var(--color-primary)' : 'var(--color-gray-200)',
                          }}
                        />
                      </div>
                      <span
                        className="tnum text-[10px] font-medium"
                        style={{ color: 'var(--color-text-3)' }}
                      >
                        {w.expense > 0 ? `${Math.round(w.expense / 10000)}만` : '-'}
                      </span>
                      <span
                        className="text-[10px] font-bold"
                        style={{
                          color: isThis ? 'var(--color-primary)' : 'var(--color-text-3)',
                        }}
                      >
                        {w.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

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
