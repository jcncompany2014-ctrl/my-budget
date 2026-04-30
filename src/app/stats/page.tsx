'use client';

import { useMemo, useState } from 'react';
import CategoryDonut from '@/components/CategoryDonut';
import CategoryIcon from '@/components/icons/CategoryIcon';
import LineChart from '@/components/LineChart';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import YearHeatmap from '@/components/YearHeatmap';
import { CATEGORIES } from '@/lib/categories';
import { expandByCategory, fmt, isExpense } from '@/lib/format';
import { detectAnomalies } from '@/lib/insights';
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

  const anomalies = useMemo(() => detectAnomalies(tx), [tx]);

  // 6-month trend
  const sixMonthTrend = useMemo(() => {
    const now = new Date();
    const months: { label: string; expense: number; income: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthTx = tx.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
      });
      const expense = monthTx.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
      const income = monthTx.filter((t) => t.amount > 0 && !t.transferPairId).reduce((s, t) => s + t.amount, 0);
      months.push({
        label: `${m.getMonth() + 1}월`,
        expense,
        income,
      });
    }
    return months;
  }, [tx]);

  // 12-month heatmap data
  const heatmapData = useMemo(() => {
    const map = new Map<string, number>();
    tx.forEach((t) => {
      if (!isExpense(t)) return;
      const key = t.date.slice(0, 10);
      map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [tx]);

  const expenses = filtered.filter(isExpense);
  const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const monthDelta = period === 'month' && lastMonthExpense > 0
    ? Math.round(((total - lastMonthExpense) / lastMonthExpense) * 100)
    : null;

  const byCat = useMemo(() => {
    const map = new Map<string, number>();
    expenses.forEach((t) => {
      // Honor splits: distribute amount across split categories
      expandByCategory(t).forEach((s) => {
        map.set(s.cat, (map.get(s.cat) ?? 0) + Math.abs(s.amount));
      });
    });
    return Array.from(map.entries())
      .map(([cat, value]) => ({
        cat,
        catId: cat,
        value,
        name: CATEGORIES[cat]?.name ?? '기타',
        emoji: CATEGORIES[cat]?.emoji ?? '💰',
        color: CATEGORIES[cat]?.color ?? '#94A3B8',
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const heatmap = useMemo(() => {
    if (period !== 'month') return null;
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const days: { day: number; spend: number }[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const spend = tx
        .filter((t) => t.date.slice(0, 10) === dateStr)
        .filter(isExpense)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      days.push({ day: d, spend });
    }
    const max = Math.max(...days.map((dd) => dd.spend), 1);
    return { days, max };
  }, [tx, period]);

  if (!ready) {
    return <div className="flex h-[calc(100dvh-72px)] items-center justify-center"><span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span></div>;
  }

  return (
    <>
      <TopBar title="통계" />

      <section className="px-5 pb-3 pt-1">
        <div className="flex rounded-full p-[3px]" style={{ background: 'var(--color-gray-100)' }}>
          {([['month', '이번 달'], ['week', '최근 7일']] as const).map(([k, label]) => {
            const active = period === k;
            return (
              <button key={k} type="button" onClick={() => setPeriod(k)}
                className="tap flex-1 rounded-full py-2"
                style={{
                  background: active ? 'var(--color-card)' : 'transparent',
                  color: active ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {total === 0 ? (
        <div className="mx-5 rounded-2xl px-6 py-16 text-center" style={{ background: 'var(--color-card)' }}>
          <p className="text-3xl">📊</p>
          <p className="mt-2" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            {mode === 'business' ? '아직 분석할 비용이 없어요' : '아직 분석할 지출이 없어요'}
          </p>
        </div>
      ) : (
        <>
          {/* Month-over-month */}
          {period === 'month' && monthDelta !== null && (
            <section className="px-5 pb-2 pt-1">
              <div className="flex items-center justify-between rounded-2xl px-4 py-3"
                style={{ background: monthDelta < 0 ? 'var(--color-primary-soft)' : 'var(--color-danger-soft)' }}>
                <div>
                  <p style={{ color: monthDelta < 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
                    지난 달 대비
                  </p>
                  <p className="mt-0.5" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)' }}>
                    {monthDelta < 0 ? `${fmt(lastMonthExpense - total)}원 덜 썼어요` : `${fmt(total - lastMonthExpense)}원 더 썼어요`}
                  </p>
                </div>
                <p className="tnum" style={{ color: monthDelta < 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: 'var(--text-base)', fontWeight: 800 }}>
                  {monthDelta > 0 ? '+' : ''}{monthDelta}%
                </p>
              </div>
            </section>
          )}

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <section className="px-5 pb-2 pt-1">
              <div className="rounded-2xl px-4 py-3" style={{ background: '#FFF6E5' }}>
                <p style={{ color: '#B45309', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>이상 지출 감지</p>
                <div className="mt-1.5 space-y-0.5">
                  {anomalies.map((a) => {
                    const c = CATEGORIES[a.cat];
                    return (
                      <div key={a.cat} className="flex items-center gap-2">
                        <CategoryIcon catId={a.cat} size={20} />
                        <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)' }}>
                          <span style={{ fontWeight: 700 }}>{c?.name ?? a.cat}</span>{' '}
                          평소 대비 <span className="tnum" style={{ color: '#B45309', fontWeight: 700 }}>+{a.deltaPct}%</span>
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Heatmap */}
          {heatmap && (
            <section className="px-5 pb-3 pt-2">
              <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
                <p className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                  일별 지출 히트맵
                </p>
                <div className="grid grid-cols-7 gap-1">
                  {heatmap.days.map((dd) => {
                    const intensity = dd.spend / heatmap.max;
                    return (
                      <div key={dd.day}
                        className="flex aspect-square items-center justify-center rounded"
                        style={{
                          background: intensity > 0
                            ? `color-mix(in oklab, var(--color-primary) ${Math.round(intensity * 80) + 8}%, var(--color-gray-100))`
                            : 'var(--color-gray-100)',
                          color: intensity > 0.5 ? '#fff' : 'var(--color-text-3)',
                          fontSize: 'var(--text-xxs)',
                          fontWeight: 700,
                        }}>
                        {dd.day}
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          )}

          {/* Weekly trend */}
          <section className="px-5 pb-3 pt-2">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
              <p className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
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
                        <div className="w-full rounded-t-md transition-all"
                          style={{
                            height: `${pct}%`,
                            minHeight: 2,
                            background: isThis ? 'var(--color-primary)' : 'var(--color-gray-200)',
                          }} />
                      </div>
                      <span className="tnum" style={{ color: 'var(--color-text-3)', fontSize: 9, fontWeight: 600 }}>
                        {w.expense > 0 ? `${Math.round(w.expense / 10000)}만` : '−'}
                      </span>
                      <span style={{ color: isThis ? 'var(--color-primary)' : 'var(--color-text-3)', fontSize: 9, fontWeight: 700 }}>
                        {w.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* 6-month trend line */}
          <section className="px-5 pb-3 pt-2">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
              <p className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                6개월 추이
              </p>
              <LineChart
                labels={sixMonthTrend.map((m) => m.label)}
                series={[
                  { label: '지출', values: sixMonthTrend.map((m) => m.expense), color: 'var(--color-danger)' },
                  { label: '수입', values: sixMonthTrend.map((m) => m.income), color: 'var(--color-primary)' },
                ]}
                height={140}
              />
              <div className="mt-2 flex items-center justify-center gap-4">
                <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                  <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>●</span> 지출
                </span>
                <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>●</span> 수입
                </span>
              </div>
            </div>
          </section>

          {/* 12-month heatmap */}
          <section className="px-5 pb-3 pt-2">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
              <p className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                1년 지출 히트맵
              </p>
              <div className="overflow-x-auto no-scrollbar">
                <YearHeatmap daySpend={heatmapData} cellSize={10} gap={2} />
              </div>
            </div>
          </section>

          <section className="flex justify-center px-5 py-6">
            <CategoryDonut data={byCat} total={total} />
          </section>

          <section className="px-5 pb-8">
            <h2 className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
              카테고리별
            </h2>
            <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
              {byCat.map((s, i) => {
                const pct = Math.round((s.value / total) * 100);
                return (
                  <div key={s.cat} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < byCat.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full text-base"
                      style={{ background: `${s.color}1f` }}>
                      {s.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                          {s.name}
                        </p>
                        <Money value={s.value} sign="never"
                          style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }} />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-150)' }}>
                          <div className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${pct}%`, background: s.color }} />
                        </div>
                        <span className="tnum text-right" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', minWidth: 32 }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

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
    return Array.from(map.entries()).map(([merchant, value]) => ({ merchant, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [expenses]);

  if (list.length === 0) return null;
  return (
    <section className="px-5 pb-10">
      <h2 className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
        많이 쓴 곳
      </h2>
      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
        {list.map((m, i) => (
          <div key={m.merchant} className="flex items-center justify-between px-4 py-3"
            style={{ borderBottom: i < list.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
            <div className="flex items-center gap-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-full font-bold"
                style={{
                  background: i === 0 ? 'var(--color-primary)' : 'var(--color-gray-150)',
                  color: i === 0 ? '#fff' : 'var(--color-text-2)',
                  fontSize: 'var(--text-xxs)',
                }}>{i + 1}</div>
              <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                {m.merchant}
              </p>
            </div>
            <Money value={m.value} sign="never" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }} />
          </div>
        ))}
      </div>
    </section>
  );
}
