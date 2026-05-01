'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useBudgets } from '@/lib/budgets';
import { CATEGORIES } from '@/lib/categories';
import { fmt } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

export default function BudgetPage() {
  const router = useRouter();
  const { tx, ready } = useTransactions();
  const { mode } = useMode();
  const { budgets, ready: budgetsReady } = useBudgets();

  const spent = useMemo(() => {
    if (!ready) return new Map<string, number>();
    const map = new Map<string, number>();
    const now = new Date();
    tx.forEach((t) => {
      if (t.amount >= 0) return;
      const d = new Date(t.date);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      map.set(t.cat, (map.get(t.cat) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [tx, ready]);

  const personalBudgets = Object.entries(budgets).map(([cat, b]) => {
    const used = spent.get(cat) ?? 0;
    const pct = b.limit > 0 ? Math.min(100, Math.round((used / b.limit) * 100)) : 0;
    return { cat, limit: b.limit, used, pct, info: CATEGORIES[cat] };
  });

  const businessBreakdown = useMemo(() => {
    const arr = Array.from(spent.entries())
      .map(([cat, used]) => ({ cat, used, info: CATEGORIES[cat] }))
      .filter((x) => x.info?.scope === 'business')
      .sort((a, b) => b.used - a.used);
    const total = arr.reduce((s, i) => s + i.used, 0);
    return { arr, total };
  }, [spent]);

  if (mode === 'business') {
    return (
      <>
        <TopBar
          title="고정비·비용"
          right={
            <button
              type="button"
              onClick={() => router.back()}
              className="tap rounded-full px-3 py-2 text-sm font-semibold"
              style={{ color: 'var(--color-text-3)' }}
            >
              완료
            </button>
          }
        />

        <section className="px-5 pb-3 pt-1">
          <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
              이번 달 비용 합계
            </p>
            <p
              className="tnum mt-1 text-2xl font-extrabold"
              style={{ color: 'var(--color-danger)' }}
            >
              -{fmt(businessBreakdown.total)}원
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-3)' }}>
              {businessBreakdown.arr.length === 0
                ? '아직 비용 거래가 없어요'
                : `${businessBreakdown.arr.length}개 카테고리`}
            </p>
          </div>
        </section>

        <section className="px-5 pb-10 pt-4">
          <h2 className="mb-3 text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
            카테고리별 지출
          </h2>

          {businessBreakdown.arr.length === 0 ? (
            <div
              className="flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center"
              style={{ background: 'var(--color-card)' }}
            >
              <p className="text-3xl">🧾</p>
              <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
                사업 비용 거래를 추가해 보세요
              </p>
              <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                + 버튼으로 임대료, 인건비, 매입을 기록하면 분석돼요
              </p>
            </div>
          ) : (
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: 'var(--color-card)' }}
            >
              {businessBreakdown.arr.map((i, idx) => {
                const pct = Math.round((i.used / businessBreakdown.total) * 100);
                return (
                  <div
                    key={i.cat}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom:
                        idx < businessBreakdown.arr.length - 1
                          ? '1px solid var(--color-divider)'
                          : 'none',
                    }}
                  >
                    <CategoryIcon catId={i.cat} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <p
                          className="text-[15px] font-semibold"
                          style={{ color: 'var(--color-text-1)' }}
                        >
                          {i.info?.name ?? i.cat}
                        </p>
                        <p
                          className="tnum text-[15px] font-bold"
                          style={{ color: 'var(--color-text-1)' }}
                        >
                          {fmt(i.used)}원
                        </p>
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className="relative h-1.5 flex-1 overflow-hidden rounded-full"
                          style={{ background: 'var(--color-gray-150)' }}
                        >
                          <div
                            className="absolute inset-y-0 left-0 rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: i.info?.color ?? 'var(--color-primary)',
                            }}
                          />
                        </div>
                        <span
                          className="tnum w-10 text-right text-xs"
                          style={{ color: 'var(--color-text-3)' }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </>
    );
  }

  // ─── Personal mode ───
  const totalLimit = personalBudgets.reduce((s, i) => s + i.limit, 0);
  const totalUsed = personalBudgets.reduce((s, i) => s + i.used, 0);
  const totalPct = totalLimit > 0 ? Math.min(100, Math.round((totalUsed / totalLimit) * 100)) : 0;

  return (
    <>
      <TopBar
        title="예산"
        right={
          <Link
            href="/settings/budgets"
            className="tap rounded-full px-3 py-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            설정
          </Link>
        }
      />

      {!budgetsReady ? null : personalBudgets.length === 0 ? (
        <section className="px-5 pb-10 pt-4">
          <Link
            href="/settings/budgets"
            className="tap flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center"
            style={{ background: 'var(--color-card)' }}
          >
            <p className="text-3xl">📊</p>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
              예산을 설정해 보세요
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
              카테고리별로 한 달 한도를 정해두면 진행률이 보여요
            </p>
          </Link>
        </section>
      ) : (
        <>
          <section className="px-5 pb-3 pt-1">
            <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
              <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
                이번 달 총 예산
              </p>
              <p
                className="tnum mt-1 text-2xl font-extrabold"
                style={{ color: 'var(--color-text-1)' }}
              >
                {fmt(totalUsed)}
                <span className="text-base font-semibold" style={{ color: 'var(--color-text-3)' }}>
                  {' '}
                  / {fmt(totalLimit)}원
                </span>
              </p>
              <div
                className="mt-3 h-2 overflow-hidden rounded-full"
                style={{ background: 'var(--color-gray-150)' }}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${totalPct}%`,
                    background:
                      totalPct >= 100
                        ? 'var(--color-danger)'
                        : totalPct >= 80
                          ? 'var(--color-orange-500)'
                          : 'var(--color-primary)',
                  }}
                />
              </div>
            </div>
          </section>

          <section className="px-5 pb-10 pt-4">
            <h2 className="mb-3 text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
              카테고리별
            </h2>
            <div className="space-y-2">
              {personalBudgets.map((i) => (
                <BudgetCard key={i.cat} item={i} />
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}

type Item = {
  cat: string;
  limit: number;
  used: number;
  pct: number;
  info?: { name: string; emoji: string; color: string };
};

function BudgetCard({ item }: { item: Item }) {
  const remaining = item.limit - item.used;
  const over = item.used > item.limit;
  const color =
    item.pct >= 100
      ? 'var(--color-danger)'
      : item.pct >= 80
        ? 'var(--color-orange-500)'
        : 'var(--color-primary)';

  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: 'var(--color-card)' }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <CategoryIcon catId={item.cat} size={40} />
          <div>
            <p className="text-[15px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
              {item.info?.name ?? item.cat}
            </p>
            <p
              className="text-xs"
              style={{ color: over ? 'var(--color-danger)' : 'var(--color-text-3)' }}
            >
              {over ? `${fmt(item.used - item.limit)}원 초과` : `${fmt(remaining)}원 남음`}
            </p>
          </div>
        </div>
        <p className="tnum text-[14px] font-bold" style={{ color: 'var(--color-text-1)' }}>
          {fmt(item.used)}
          <span style={{ color: 'var(--color-text-3)' }}> / {fmt(item.limit)}</span>
        </p>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'var(--color-gray-150)' }}
      >
        <div className="h-full rounded-full" style={{ width: `${item.pct}%`, background: color }} />
      </div>
    </div>
  );
}
