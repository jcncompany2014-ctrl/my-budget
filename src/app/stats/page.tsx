'use client';

import {
  BarChart3,
  CalendarDays,
  ChevronRight,
  Lightbulb,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import CategoryDonut from '@/components/CategoryDonut';
import CategoryIcon from '@/components/icons/CategoryIcon';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import LineChart from '@/components/LineChart';
import { useMode } from '@/components/ModeProvider';
import Money from '@/components/Money';
import PaceChart from '@/components/PaceChart';
import { SkeletonHome } from '@/components/Skeleton';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/ui/EmptyState';
import YearHeatmap from '@/components/YearHeatmap';
import { CATEGORIES } from '@/lib/categories';
import { localDayKey } from '@/lib/dates';
import { expandByCategory, fmt, fmtShort, isExpense } from '@/lib/format';
import {
  detectAnomalies,
  detectPatterns,
  monthPace,
  type SpendingPattern,
  WEEKDAY_LABEL,
} from '@/lib/insights';
import { useRecurring } from '@/lib/recurring';
import { useTransactions } from '@/lib/storage';

type Period = 'month' | 'week';

// Categories that are structurally fixed costs regardless of the recurring flag
const FIXED_CATS = new Set(['subs', 'biz_rent', 'biz_payroll', 'biz_utility', 'biz_insurance']);

export default function StatsPage() {
  const { tx, ready } = useTransactions();
  const { mode } = useMode();
  const { items: recurringItems } = useRecurring();
  const [period, setPeriod] = useState<Period>('month');

  const pace = useMemo(() => monthPace(tx), [tx]);
  const patterns = useMemo(() => detectPatterns(tx), [tx]);

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
      const income = monthTx
        .filter((t) => t.amount > 0 && !t.transferPairId)
        .reduce((s, t) => s + t.amount, 0);
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
      const key = localDayKey(t.date);
      map.set(key, (map.get(key) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [tx]);

  const expenses = filtered.filter(isExpense);
  const total = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);

  // Fixed (구독·정기결제·대출·임대료 등) vs variable spend — 뱅크샐러드-style split
  const fixedVar = useMemo(() => {
    const recurringNames = new Set(recurringItems.map((r) => r.name.trim().toLowerCase()));
    let fixed = 0;
    let variable = 0;
    for (const t of filtered) {
      if (!isExpense(t)) continue;
      const amt = Math.abs(t.amount);
      const isFixed =
        t.recurring === true ||
        FIXED_CATS.has(t.cat) ||
        recurringNames.has(t.merchant.trim().toLowerCase());
      if (isFixed) fixed += amt;
      else variable += amt;
    }
    return { fixed, variable };
  }, [filtered, recurringItems]);

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
        color: CATEGORIES[cat]?.color ?? '#94A3B8',
      }))
      .sort((a, b) => b.value - a.value);
  }, [expenses]);

  const heatmap = useMemo(() => {
    if (period !== 'month') return null;
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    // Bucket by LOCAL day once (the old per-day filter compared against the UTC
    // date, pushing 오전 spending onto the previous day).
    const byDay = new Map<string, number>();
    for (const t of tx) {
      if (!isExpense(t)) continue;
      const k = localDayKey(t.date);
      byDay.set(k, (byDay.get(k) ?? 0) + Math.abs(t.amount));
    }
    const days: { day: number; spend: number }[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const key = localDayKey(new Date(now.getFullYear(), now.getMonth(), d));
      days.push({ day: d, spend: byDay.get(key) ?? 0 });
    }
    const max = Math.max(...days.map((dd) => dd.spend), 1);
    return { days, max };
  }, [tx, period]);

  if (!ready) {
    return <SkeletonHome />;
  }

  return (
    <>
      <TopBar title="통계" />

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
                className="tap flex-1 rounded-full py-2"
                style={{
                  background: active ? 'var(--color-card)' : 'transparent',
                  color: active ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                {label}
              </button>
            );
          })}
        </div>
      </section>

      {total === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={BarChart3}
            iconColor="#3182F6"
            title={mode === 'business' ? '아직 분석할 비용이 없어요' : '아직 분석할 지출이 없어요'}
            hint="거래를 몇 건 추가하면 카테고리별 분포 + 추세가 나타납니다"
          />
        </div>
      ) : (
        <>
          {/* Spending pace — month-to-date vs last month at the same day */}
          {period === 'month' && (
            <section className="px-5 pb-3 pt-1">
              <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p
                      style={{
                        color: 'var(--color-text-3)',
                        fontSize: 11,
                        fontWeight: 800,
                        letterSpacing: '0.04em',
                      }}
                    >
                      소비 페이스
                    </p>
                    <p
                      className="mt-1"
                      style={{
                        color: 'var(--color-text-1)',
                        fontSize: 15,
                        fontWeight: 800,
                        letterSpacing: '-0.02em',
                        lineHeight: 1.35,
                      }}
                    >
                      {pace.deltaPct === null ? (
                        <>
                          이번 달 <span className="tnum">{fmt(pace.thisToDate)}원</span> 썼어요
                        </>
                      ) : pace.diff <= 0 ? (
                        <>
                          지난 달 이맘때보다{' '}
                          <span className="tnum" style={{ color: 'var(--color-primary)' }}>
                            {fmt(-pace.diff)}원
                          </span>{' '}
                          덜 썼어요
                        </>
                      ) : (
                        <>
                          지난 달 이맘때보다{' '}
                          <span className="tnum" style={{ color: 'var(--color-danger)' }}>
                            {fmt(pace.diff)}원
                          </span>{' '}
                          더 썼어요
                        </>
                      )}
                    </p>
                    <p
                      className="tnum mt-0.5"
                      style={{ color: 'var(--color-text-3)', fontSize: 11, fontWeight: 600 }}
                    >
                      이 페이스면 월말 약 {fmtShort(pace.projection)}원
                      {pace.lastTotal > 0 && ` · 지난 달 ${fmtShort(pace.lastTotal)}원`}
                    </p>
                  </div>
                  {pace.deltaPct !== null && (
                    <span
                      className="tnum shrink-0 rounded-full px-2.5 py-1"
                      style={{
                        background:
                          pace.diff <= 0 ? 'var(--color-primary-soft)' : 'var(--color-danger-soft)',
                        color: pace.diff <= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                        fontSize: 12,
                        fontWeight: 800,
                      }}
                    >
                      {pace.deltaPct > 0 ? '+' : ''}
                      {pace.deltaPct}%
                    </span>
                  )}
                </div>
                <PaceChart thisCum={pace.thisCum} lastCum={pace.lastCum} daysThis={pace.daysThis} />
                <div className="mt-1 flex items-center justify-center gap-4">
                  <span style={{ color: 'var(--color-text-3)', fontSize: 10, fontWeight: 600 }}>
                    <span style={{ color: 'var(--color-primary)', fontWeight: 800 }}>●</span> 이번
                    달
                  </span>
                  <span style={{ color: 'var(--color-text-3)', fontSize: 10, fontWeight: 600 }}>
                    <span style={{ color: 'var(--color-gray-300)', fontWeight: 800 }}>●</span> 지난
                    달
                  </span>
                </div>
              </div>
            </section>
          )}

          {/* Fixed vs variable */}
          {period === 'month' && fixedVar.fixed + fixedVar.variable > 0 && (
            <section className="px-5 pb-3">
              <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
                <p
                  style={{
                    color: 'var(--color-text-3)',
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                  }}
                >
                  고정 지출 vs 변동 지출
                </p>
                <div
                  className="mt-3 flex h-2.5 overflow-hidden rounded-full"
                  style={{ background: 'var(--color-gray-150)' }}
                >
                  <div
                    style={{
                      width: `${(fixedVar.fixed / (fixedVar.fixed + fixedVar.variable)) * 100}%`,
                      background: '#8B5CF6',
                      transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)',
                    }}
                  />
                  <div style={{ flex: 1, background: 'var(--color-primary)' }} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <SplitStat
                    color="#8B5CF6"
                    label="고정"
                    value={fixedVar.fixed}
                    pct={fixedVar.fixed / (fixedVar.fixed + fixedVar.variable)}
                    hint="구독·정기결제·대출"
                  />
                  <SplitStat
                    color="var(--color-primary)"
                    label="변동"
                    value={fixedVar.variable}
                    pct={fixedVar.variable / (fixedVar.fixed + fixedVar.variable)}
                    hint="식비·쇼핑·카페 등"
                    alignRight
                  />
                </div>
              </div>
            </section>
          )}

          {/* Spending patterns (90일) */}
          {patterns.length > 0 && (
            <section className="px-5 pb-3">
              <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
                <div className="mb-2.5 flex items-center gap-1.5">
                  <Lightbulb size={14} strokeWidth={2.4} color="#F59E0B" />
                  <p
                    style={{
                      color: 'var(--color-text-3)',
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.04em',
                    }}
                  >
                    소비 패턴 · 최근 90일
                  </p>
                </div>
                <div className="space-y-2.5">
                  {patterns.map((p) => (
                    <PatternRow key={patternKey(p)} p={p} />
                  ))}
                </div>
              </div>
            </section>
          )}

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <section className="px-5 pb-2 pt-1">
              <div className="rounded-2xl px-4 py-3" style={{ background: '#FFF6E5' }}>
                <p style={{ color: '#B45309', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
                  이상 지출 감지
                </p>
                <div className="mt-1.5 space-y-0.5">
                  {anomalies.map((a) => {
                    const c = CATEGORIES[a.cat];
                    return (
                      <div key={a.cat} className="flex items-center gap-2">
                        <CategoryIcon catId={a.cat} size={20} />
                        <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)' }}>
                          <span style={{ fontWeight: 700 }}>{c?.name ?? a.cat}</span> 평소 대비{' '}
                          <span className="tnum" style={{ color: '#B45309', fontWeight: 700 }}>
                            +{a.deltaPct}%
                          </span>
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
                <p
                  className="mb-3"
                  style={{
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 700,
                  }}
                >
                  일별 지출 히트맵
                </p>
                <div className="grid grid-cols-7 gap-1">
                  {heatmap.days.map((dd) => {
                    const intensity = dd.spend / heatmap.max;
                    return (
                      <div
                        key={dd.day}
                        className="flex aspect-square items-center justify-center rounded"
                        style={{
                          background:
                            intensity > 0
                              ? `color-mix(in oklab, var(--color-primary) ${Math.round(intensity * 80) + 8}%, var(--color-gray-100))`
                              : 'var(--color-gray-100)',
                          color: intensity > 0.5 ? '#fff' : 'var(--color-text-3)',
                          fontSize: 'var(--text-xxs)',
                          fontWeight: 700,
                        }}
                      >
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
              <p
                className="mb-3"
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                }}
              >
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
                        className="tnum"
                        style={{ color: 'var(--color-text-3)', fontSize: 9, fontWeight: 600 }}
                      >
                        {w.expense > 0 ? `${Math.round(w.expense / 10000)}만` : '−'}
                      </span>
                      <span
                        style={{
                          color: isThis ? 'var(--color-primary)' : 'var(--color-text-3)',
                          fontSize: 9,
                          fontWeight: 700,
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

          {/* 6-month trend line */}
          <section className="px-5 pb-3 pt-2">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
              <p
                className="mb-3"
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                }}
              >
                6개월 추이
              </p>
              <LineChart
                labels={sixMonthTrend.map((m) => m.label)}
                series={[
                  {
                    label: '지출',
                    values: sixMonthTrend.map((m) => m.expense),
                    color: 'var(--color-danger)',
                  },
                  {
                    label: '수입',
                    values: sixMonthTrend.map((m) => m.income),
                    color: 'var(--color-primary)',
                  },
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
              <p
                className="mb-3"
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                }}
              >
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
            <h2
              className="mb-3"
              style={{
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
              }}
            >
              카테고리별
            </h2>
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: 'var(--color-card)' }}
            >
              {byCat.map((s, i) => {
                const pct = Math.round((s.value / total) * 100);
                return (
                  <div
                    key={s.cat}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom:
                        i < byCat.length - 1 ? '1px solid var(--color-divider)' : 'none',
                    }}
                  >
                    <CategoryIcon catId={s.catId} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <p
                          style={{
                            color: 'var(--color-text-1)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 600,
                          }}
                        >
                          {s.name}
                        </p>
                        <Money
                          value={s.value}
                          sign="never"
                          style={{
                            color: 'var(--color-text-1)',
                            fontSize: 'var(--text-sm)',
                            fontWeight: 700,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className="relative h-1.5 flex-1 overflow-hidden rounded-full"
                          style={{ background: 'var(--color-gray-150)' }}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{ width: `${pct}%`, background: s.color }}
                          />
                        </div>
                        <span
                          className="tnum text-right"
                          style={{
                            color: 'var(--color-text-3)',
                            fontSize: 'var(--text-xxs)',
                            minWidth: 32,
                          }}
                        >
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

function SplitStat({
  color,
  label,
  value,
  pct,
  hint,
  alignRight,
}: {
  color: string;
  label: string;
  value: number;
  pct: number;
  hint: string;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? 'text-right' : ''}>
      <div className={`flex items-center gap-1.5 ${alignRight ? 'justify-end' : ''}`}>
        <span
          aria-hidden
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: 2,
            background: color,
          }}
        />
        <span style={{ color: 'var(--color-text-2)', fontSize: 12, fontWeight: 700 }}>
          {label} <span className="tnum">{Math.round(pct * 100)}%</span>
        </span>
      </div>
      <p
        className="tnum mt-0.5"
        style={{
          color: 'var(--color-text-1)',
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: '-0.02em',
        }}
      >
        {fmt(value)}원
      </p>
      <p style={{ color: 'var(--color-text-3)', fontSize: 10, fontWeight: 600 }}>{hint}</p>
    </div>
  );
}

function patternKey(p: SpendingPattern): string {
  if (p.kind === 'weekday-category') return `wd-${p.weekday}-${p.cat}`;
  if (p.kind === 'category-trend') return `tr-${p.cat}`;
  return 'weekend';
}

function PatternRow({ p }: { p: SpendingPattern }) {
  const strong = { color: 'var(--color-text-1)', fontWeight: 800 } as const;
  let icon: React.ReactNode;
  let body: React.ReactNode;

  if (p.kind === 'weekday-category') {
    const name = CATEGORIES[p.cat]?.name ?? p.cat;
    const ratio = p.ratio >= 10 ? Math.round(p.ratio).toString() : p.ratio.toFixed(1);
    icon = <CategoryIcon catId={p.cat} size={32} />;
    body = (
      <>
        매주 <span style={strong}>{WEEKDAY_LABEL(p.weekday)}요일</span>엔 {name} 지출이 다른
        요일보다{' '}
        <span className="tnum" style={strong}>
          {ratio}배
        </span>{' '}
        많아요
      </>
    );
  } else if (p.kind === 'weekend-vs-weekday') {
    const more = p.deltaPct > 0;
    icon = (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'rgba(59,130,246,0.12)', color: '#3182F6' }}
      >
        <CalendarDays size={16} strokeWidth={2.4} />
      </span>
    );
    body = more ? (
      <>
        주말엔 평일보다 하루{' '}
        <span className="tnum" style={strong}>
          {fmt(p.weekendAvg - p.weekdayAvg)}원
        </span>{' '}
        더 써요
      </>
    ) : (
      <>
        주말엔 평일보다 하루{' '}
        <span className="tnum" style={strong}>
          {fmt(p.weekdayAvg - p.weekendAvg)}원
        </span>{' '}
        덜 써요
      </>
    );
  } else {
    const name = CATEGORIES[p.cat]?.name ?? p.cat;
    const up = p.deltaPct > 0;
    icon = (
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{
          background: up ? 'var(--color-danger-soft)' : 'var(--color-primary-soft)',
          color: up ? 'var(--color-danger)' : 'var(--color-primary)',
        }}
      >
        {up ? (
          <TrendingUp size={16} strokeWidth={2.4} />
        ) : (
          <TrendingDown size={16} strokeWidth={2.4} />
        )}
      </span>
    );
    body = (
      <>
        {name} 지출이 두 달 전보다{' '}
        <span
          className="tnum"
          style={{ ...strong, color: up ? 'var(--color-danger)' : 'var(--color-primary)' }}
        >
          {Math.abs(p.deltaPct)}% {up ? '늘었어요' : '줄었어요'}
        </span>
      </>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {icon}
      <p
        className="leading-snug"
        style={{ color: 'var(--color-text-2)', fontSize: 13, fontWeight: 600 }}
      >
        {body}
      </p>
    </div>
  );
}

function TopMerchants({
  expenses,
}: {
  expenses: { merchant: string; amount: number; cat: string }[];
}) {
  const list = useMemo(() => {
    const map = new Map<string, { value: number; cat: string }>();
    expenses.forEach((t) => {
      const cur = map.get(t.merchant);
      map.set(t.merchant, {
        value: (cur?.value ?? 0) + Math.abs(t.amount),
        cat: cur?.cat ?? t.cat,
      });
    });
    return Array.from(map.entries())
      .map(([merchant, v]) => ({ merchant, ...v }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [expenses]);

  if (list.length === 0) return null;
  return (
    <section className="px-5 pb-10">
      <h2
        className="mb-3"
        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}
      >
        많이 쓴 곳
      </h2>
      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
        {list.map((m, i) => (
          <Link
            key={m.merchant}
            href={`/merchant/${encodeURIComponent(m.merchant.trim())}`}
            className="tap flex items-center justify-between gap-2 px-4 py-3"
            style={{
              borderBottom: i < list.length - 1 ? '1px solid var(--color-divider)' : 'none',
            }}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span
                className="tnum w-3 shrink-0 text-center"
                style={{
                  color: i === 0 ? 'var(--color-primary)' : 'var(--color-text-3)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 800,
                }}
              >
                {i + 1}
              </span>
              <MerchantAvatar merchant={m.merchant} catId={m.cat} size={32} />
              <p
                className="truncate"
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                }}
              >
                {m.merchant}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Money
                value={m.value}
                sign="never"
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              />
              <ChevronRight size={16} strokeWidth={2.4} color="var(--color-text-4)" />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
