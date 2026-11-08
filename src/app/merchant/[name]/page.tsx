'use client';

import { ArrowLeft, Calendar, Receipt, Store, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { use, useMemo } from 'react';
import BrandIcon from '@/components/icons/BrandIcon';
import LineChart from '@/components/LineChart';
import { useMode } from '@/components/ModeProvider';
import { SkeletonHome } from '@/components/Skeleton';
import TopBar from '@/components/TopBar';
import TxRow from '@/components/TxRow';
import EmptyState from '@/components/ui/EmptyState';
import { findBrand } from '@/lib/brands';
import { CATEGORIES } from '@/lib/categories';
import { fmt, isExpense, isIncome } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

/**
 * Merchant drill-down page.
 *
 * Shows every transaction at a given merchant (case-insensitive exact match),
 * plus aggregated stats: total, visits, avg-per-visit, days-since-last,
 * monthly trend, favorite category.
 *
 * Linked from TxRow long-press and from reports pages' top-merchant lists.
 */
export default function MerchantPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = use(params);
  const router = useRouter();
  const { tx, ready } = useAllTransactions();
  const { mode } = useMode();

  const merchantName = decodeURIComponent(rawName);
  const key = merchantName.trim().toLowerCase();
  const brand = findBrand(merchantName);

  const list = useMemo(
    () =>
      tx
        .filter((t) => (t.scope ?? 'personal') === mode)
        .filter((t) => t.merchant.trim().toLowerCase() === key)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [tx, key, mode],
  );

  const stats = useMemo(() => {
    const spends = list.filter(isExpense);
    const incomes = list.filter(isIncome);
    const totalSpent = spends.reduce((s, t) => s + Math.abs(t.amount), 0);
    const totalIncome = incomes.reduce((s, t) => s + t.amount, 0);
    const visits = list.length;
    const avgPerVisit = visits > 0 ? totalSpent / Math.max(1, spends.length) : 0;
    const lastVisit = list[0] ? new Date(list[0].date) : null;
    const daysSinceLast = lastVisit
      ? Math.floor((Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24))
      : null;
    const first = list[list.length - 1];
    const firstDate = first ? new Date(first.date) : null;

    // Category frequency
    const catCount = new Map<string, number>();
    list.forEach((t) => catCount.set(t.cat, (catCount.get(t.cat) ?? 0) + 1));
    const topCat = Array.from(catCount.entries()).sort((a, b) => b[1] - a[1])[0];

    // Monthly trend: last 6 months of spending
    const months: { label: string; value: number }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthSpend = spends
        .filter((t) => {
          const d = new Date(t.date);
          return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
        })
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      months.push({ label: `${m.getMonth() + 1}월`, value: monthSpend });
    }
    const chartHasData = months.some((m) => m.value > 0);

    return {
      totalSpent,
      totalIncome,
      visits,
      avgPerVisit,
      daysSinceLast,
      firstDate,
      topCat: topCat ? CATEGORIES[topCat[0]] : null,
      months,
      chartHasData,
    };
  }, [list]);

  if (!ready) return <SkeletonHome />;

  if (list.length === 0) {
    return (
      <>
        <TopBar
          title={merchantName}
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
        <div className="px-5 pt-6">
          <EmptyState
            icon={Store}
            iconColor="#94A3B8"
            title="거래 기록이 없어요"
            hint={`'${merchantName}' 로 기록된 거래를 찾지 못했어요`}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TopBar
        title={merchantName}
        left={
          <button
            type="button"
            onClick={() => router.back()}
            className="tap flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="뒤로"
          >
            <ArrowLeft size={20} strokeWidth={2.4} color="var(--color-text-1)" />
          </button>
        }
      />

      {/* Hero: total + stats */}
      <section className="px-5 pb-3 pt-1">
        <div
          className="relative overflow-hidden rounded-2xl px-5 py-5"
          style={{
            background:
              'linear-gradient(135deg, var(--color-primary-grad-from) 0%, var(--color-primary-grad-to) 100%)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.16)',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.20) 0%, transparent 60%)',
              pointerEvents: 'none',
            }}
          />
          <div className="relative text-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                {brand && (
                  <BrandIcon
                    brand={brand}
                    size={34}
                    style={{ boxShadow: '0 0 0 2px rgba(255,255,255,0.4)' }}
                  />
                )}
                <p style={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.04em', opacity: 0.9 }}>
                  전체 지출
                </p>
              </div>
              {stats.topCat && (
                <span
                  className="rounded-full px-2 py-0.5"
                  style={{
                    background: 'rgba(255,255,255,0.22)',
                    fontSize: 10,
                    fontWeight: 800,
                    letterSpacing: '0.02em',
                  }}
                >
                  주로 {stats.topCat.name}
                </span>
              )}
            </div>
            <p
              className="tnum mt-1.5 tracking-tight"
              style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.025em' }}
            >
              {fmt(stats.totalSpent)}
              <span style={{ fontSize: 16, marginLeft: 4, fontWeight: 700, opacity: 0.85 }}>
                원
              </span>
            </p>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <HeroStat label="거래" value={`${stats.visits}건`} />
              <HeroStat label="평균" value={`${fmt(stats.avgPerVisit)}원`} />
              <HeroStat
                label="마지막"
                value={
                  stats.daysSinceLast === 0
                    ? '오늘'
                    : stats.daysSinceLast != null
                      ? `${stats.daysSinceLast}일 전`
                      : '—'
                }
              />
            </div>
          </div>
        </div>
      </section>

      {/* 6-month trend */}
      {stats.chartHasData && (
        <section className="px-5 pb-3 pt-2">
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
            <div className="mb-2 flex items-center gap-1.5">
              <TrendingUp size={14} strokeWidth={2.4} color="var(--color-text-2)" />
              <p
                style={{
                  color: 'var(--color-text-2)',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
              >
                최근 6개월 지출
              </p>
            </div>
            <LineChart
              labels={stats.months.map((m) => m.label)}
              height={120}
              series={[
                {
                  label: '지출',
                  values: stats.months.map((m) => m.value),
                  color: 'var(--color-primary)',
                },
              ]}
            />
          </div>
        </section>
      )}

      {/* Secondary stats */}
      {stats.firstDate && (
        <section className="px-5 pb-3">
          <div
            className="flex items-center gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'var(--color-card)' }}
          >
            <Calendar size={16} strokeWidth={2.4} color="var(--color-text-3)" />
            <div className="min-w-0 flex-1">
              <p
                style={{
                  color: 'var(--color-text-3)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.02em',
                }}
              >
                첫 방문
              </p>
              <p
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 13,
                  fontWeight: 700,
                  marginTop: 1,
                }}
              >
                {stats.firstDate.toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
                {' · '}
                <span style={{ color: 'var(--color-text-3)', fontWeight: 500 }}>
                  {sinceLabel(stats.firstDate)}
                </span>
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Transaction list */}
      <section className="px-5 pb-10 pt-1">
        <div className="mb-2 flex items-center gap-1.5">
          <Receipt size={14} strokeWidth={2.4} color="var(--color-text-2)" />
          <p
            style={{
              color: 'var(--color-text-2)',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.02em',
            }}
          >
            모든 거래 ({list.length}건)
          </p>
        </div>
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          {list.slice(0, 50).map((t: Transaction, i, arr) => (
            <TxRow key={t.id} tx={t} showDate showTime borderBottom={i < arr.length - 1} />
          ))}
        </div>
        {list.length > 50 && (
          <p className="mt-3 text-center" style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
            {list.length - 50}건 더 있어요 (최근 50건만 표시)
          </p>
        )}
      </section>
    </>
  );
}

function sinceLabel(first: Date): string {
  const days = Math.floor((Date.now() - first.getTime()) / 86400000);
  if (days < 1) return '오늘 처음';
  if (days < 30) return `${days}일째 단골`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}개월째 단골`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}년 ${rem}개월째 단골` : `${years}년째 단골`;
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p
        style={{
          opacity: 0.8,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: '0.02em',
        }}
      >
        {label}
      </p>
      <p className="tnum mt-0.5 truncate" style={{ fontSize: 13, fontWeight: 800 }}>
        {value}
      </p>
    </div>
  );
}
