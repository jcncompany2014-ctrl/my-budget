'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  type LucideIcon,
  Sparkles,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import CountUp from '@/components/CountUp';
import CategoryIcon from '@/components/icons/CategoryIcon';
import LiveInvestmentPnL from '@/components/LiveInvestmentPnL';
import { SkeletonHome } from '@/components/Skeleton';
import { useMode } from '@/components/ModeProvider';
import ModeToggle from '@/components/ModeToggle';
import SmartPrompts from '@/components/SmartPrompts';
import Sparkline from '@/components/Sparkline';
import TxRow from '@/components/TxRow';
import UpcomingRecurring from '@/components/UpcomingRecurring';
import { useAccounts } from '@/lib/accounts';
import { useBudgets } from '@/lib/budgets';
import { CATEGORIES } from '@/lib/categories';
import { fmt, fmtKRW, fmtShort, isExpense, isIncome } from '@/lib/format';
import { useGoals } from '@/lib/goals';
import { budgetAlerts, detectAnomalies, forecastMonthEnd, weeklyDigest } from '@/lib/insights';
import { useLoans } from '@/lib/loans';
import { useProfile } from '@/lib/profile';
import { useTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

const isExpenseTx = isExpense;
const isIncomeTx = isIncome;

export default function HomePage() {
  const { tx, ready } = useTransactions();
  const { accounts } = useAccounts();
  const { budgets } = useBudgets();
  const { goals } = useGoals();
  const { items: loans } = useLoans();
  const { profile } = useProfile();
  const { mode } = useMode();

  if (!ready) {
    return <SkeletonHome />;
  }

  const now = new Date();
  const monthName = now.getMonth() + 1;

  return (
    <div className="pb-6">
      {/* Top bar — mode toggle + calendar + settings */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between px-4 pb-2 pt-3"
        style={{ background: 'var(--color-bg)' }}
      >
        <ModeToggle />
        <div className="flex items-center gap-1">
          <Link
            href="/calendar"
            className="tap relative flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="캘린더"
          >
            <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
              <rect x={3.5} y={5.5} width={17} height={15} rx={3} stroke="var(--color-text-1)" strokeWidth={1.8} />
              <path d="M3.5 10h17M8 3v4M16 3v4" stroke="var(--color-text-1)" strokeWidth={1.8} strokeLinecap="round" />
            </svg>
            {tx.some((t) => t.date.slice(0, 10) === new Date().toISOString().slice(0, 10)) && (
              <span
                className="absolute"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: 999,
                  background: 'var(--color-primary)',
                  top: 8,
                  right: 8,
                }}
              />
            )}
          </Link>
          <Link
            href="/settings"
            className="tap flex h-10 w-10 items-center justify-center rounded-full"
            aria-label="설정"
          >
            <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
              <circle cx={12} cy={12} r={3} stroke="var(--color-text-1)" strokeWidth={1.8} />
              <path
                d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 4.29l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
                stroke="var(--color-text-1)"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </header>

      {/* Greeting */}
      <section className="px-5 pb-3 pt-2">
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
          {profile.name ? `안녕하세요, ${profile.name}님 👋` : '안녕하세요 👋'}
        </p>
        <h1
          className="mt-0.5 tracking-tight"
          style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xl)', fontWeight: 800 }}
        >
          {mode === 'business' ? `${monthName}월 사업 가계부` : `${monthName}월의 가계부`}
        </h1>
      </section>

      <SmartPrompts />

      {mode === 'personal' ? (
        <PersonalHome tx={tx} accounts={accounts} budgets={budgets} goals={goals} loanCount={loans.filter((l) => l.scope === 'personal').length} />
      ) : (
        <BusinessHome tx={tx} accounts={accounts} loanCount={loans.filter((l) => l.scope === 'business').length} />
      )}
    </div>
  );
}

function lastNDaysCategory(tx: Transaction[], catId: string, n: number): number[] {
  const result: number[] = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const day = new Date(today);
    day.setDate(today.getDate() - i);
    const key = day.toISOString().slice(0, 10);
    const sum = tx
      .filter((t) => t.cat === catId && t.date.slice(0, 10) === key && t.amount < 0)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    result.push(sum);
  }
  return result;
}

function PersonalHome({
  tx,
  accounts,
  budgets,
  goals,
  loanCount,
}: {
  tx: Transaction[];
  accounts: ReturnType<typeof useAccounts>['accounts'];
  budgets: ReturnType<typeof useBudgets>['budgets'];
  goals: ReturnType<typeof useGoals>['goals'];
  loanCount: number;
}) {
  const now = new Date();
  const monthTx = useMemo(
    () =>
      tx.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }),
    [tx, now],
  );

  const expense = monthTx.filter(isExpenseTx).reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTx.filter(isIncomeTx).reduce((s, t) => s + t.amount, 0);
  const saving = monthTx.filter((t) => t.cat === 'saving').reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = income - expense;

  const todayKey = now.toISOString().slice(0, 10);
  const todayTx = tx.filter((t) => t.date.slice(0, 10) === todayKey && isExpenseTx(t));
  const todaySpend = todayTx.reduce((s, t) => s + Math.abs(t.amount), 0);

  const totalAssets = accounts.reduce((s, a) => s + a.balance, 0);

  const topCats = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter(isExpenseTx).forEach((t) => {
      map.set(t.cat, (map.get(t.cat) ?? 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3);
  }, [monthTx]);

  const budgetEntries = Object.entries(budgets);
  const budgetTotal = budgetEntries.reduce((s, [, b]) => s + b.limit, 0);
  const spentByCat = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter(isExpenseTx).forEach((t) => {
      map.set(t.cat, (map.get(t.cat) ?? 0) + Math.abs(t.amount));
    });
    return map;
  }, [monthTx]);
  const budgetUsed = budgetEntries.reduce((s, [k]) => s + (spentByCat.get(k) ?? 0), 0);

  const anomalies = useMemo(() => detectAnomalies(tx), [tx]);
  const forecast = useMemo(() => forecastMonthEnd(tx), [tx]);
  const alerts = useMemo(() => budgetAlerts(tx, budgets), [tx, budgets]);
  const weekly = useMemo(() => weeklyDigest(tx), [tx]);

  return (
    <>
      <HeroCard
        label="이번 달 순수익"
        value={net}
        income={income}
        expense={expense}
        third={{ label: '저축', value: saving }}
      />

      {/* Today + Total assets */}
      <section className="grid grid-cols-2 gap-2.5 px-5 pb-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
            오늘 쓴 돈
          </p>
          <p
            className="tnum mt-1.5 tracking-tight"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 800 }}
          >
            {fmt(todaySpend)}원
          </p>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            {todayTx.length === 0 ? '거래 없음' : `${todayTx.length}건의 지출`}
          </p>
        </div>
        <Link href="/wallet" className="tap rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
            전체 자산
          </p>
          <p
            className="tnum mt-1.5 tracking-tight"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 800 }}
          >
            {fmtShort(totalAssets)}원
          </p>
          <p style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xxs)', marginTop: 4, fontWeight: 600 }}>
            {accounts.length === 0 ? '계좌 추가' : `${accounts.length}개 계좌${loanCount > 0 ? ` · 대출 ${loanCount}` : ''}`}
          </p>
        </Link>
      </section>

      {/* Live investment P&L — only if user has investments */}
      <LiveInvestmentPnL />

      {/* Insights — anomaly, forecast, alerts */}
      <InsightsRow
        anomalies={anomalies}
        forecast={forecast}
        alerts={alerts}
        weekly={weekly}
        budgetTotal={budgetTotal}
        currentExpense={expense}
      />

      {/* Budget */}
      <section className="px-5 pb-3">
        <Link href="/budget" className="tap block rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          {budgetEntries.length === 0 ? (
            <EmptyInline icon="📊" title="예산을 설정해 보세요" hint="카테고리별 한 달 한도를 정하면 진행률이 보여요" />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
                    이번 달 예산
                  </p>
                  <p
                    className="tnum mt-1 truncate"
                    style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 800 }}
                  >
                    {fmtShort(Math.max(0, budgetTotal - budgetUsed))}원 남음
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1"
                  style={{
                    background: budgetUsed > budgetTotal ? 'var(--color-danger-soft)' : 'var(--color-primary-soft)',
                    color: budgetUsed > budgetTotal ? 'var(--color-danger)' : 'var(--color-primary)',
                    fontSize: 'var(--text-xxs)',
                    fontWeight: 700,
                  }}
                >
                  {budgetTotal > 0 ? Math.round((budgetUsed / budgetTotal) * 100) : 0}% 사용
                </span>
              </div>
              <ProgressBar
                value={budgetUsed}
                max={budgetTotal}
                color={budgetUsed > budgetTotal ? 'var(--color-danger)' : budgetUsed / budgetTotal > 0.8 ? 'var(--color-orange-500)' : 'var(--color-primary)'}
              />
              <div className="mt-2 flex justify-between" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                <span className="tnum">{fmt(budgetUsed)}원</span>
                <span className="tnum">목표 {fmt(budgetTotal)}원</span>
              </div>
            </>
          )}
        </Link>
      </section>

      {/* Top categories */}
      <section className="px-5 pb-3">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <div className="mb-3.5 flex items-center justify-between">
            <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
              많이 쓴 카테고리
            </p>
            <Link href="/stats" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
              전체보기 ›
            </Link>
          </div>
          {topCats.length === 0 ? (
            <EmptyInline icon="🛒" title="이번 달 지출이 없어요" hint="+ 버튼으로 첫 거래를 추가하세요" />
          ) : (
            <div className="flex flex-col gap-3">
              {topCats.map(([catId, amt]) => {
                const c = CATEGORIES[catId];
                const sparkValues = lastNDaysCategory(tx, catId, 14);
                return (
                  <div key={catId} className="flex items-center gap-3">
                    <CategoryIcon catId={catId} size={36} />
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                          {c?.name ?? catId}
                        </span>
                        <span className="tnum" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                          {fmt(amt)}원
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-100)' }}>
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${expense > 0 ? (amt / expense) * 100 : 0}%`, background: c?.color ?? 'var(--color-primary)' }} />
                        </div>
                        <Sparkline values={sparkValues} color={c?.color ?? 'var(--color-primary)'} width={48} height={18} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <UpcomingRecurring />

      {/* Goals */}
      <section className="px-5 pb-3">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <Link href="/goals" className="mb-3.5 flex items-center justify-between">
            <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
              저축 목표
            </p>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
              <path d="M9 6l6 6-6 6" stroke="var(--color-text-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {goals.length === 0 ? (
            <EmptyInline
              icon="🎯"
              title="첫 목표를 만들어 보세요"
              hint="제주도 여행, 비상금 같은 목표"
              cta={{ href: '/settings/goals', label: '목표 만들기' }}
            />
          ) : (
            <div className="flex gap-2.5 overflow-x-auto pb-1 no-scrollbar">
              {goals.map((g) => {
                const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
                return (
                  <Link href="/goals" key={g.id}
                    className="tap shrink-0 rounded-2xl p-3.5"
                    style={{ background: 'var(--color-gray-50)', width: '60%' }}>
                    <div className="mb-2 flex items-center gap-2">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full text-base"
                        style={{ background: `${g.color}22` }}>
                        {g.emoji}
                      </div>
                      <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
                        {g.name}
                      </p>
                    </div>
                    <p className="tnum" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 800 }}>
                      {fmtShort(g.current)}
                      <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
                        /{fmtShort(g.target)}원
                      </span>
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-150)' }}>
                      <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: g.color }} />
                    </div>
                    <p className="mt-1.5" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
                      {Math.round(pct)}% 달성
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <RecentTransactions tx={tx} />
    </>
  );
}

function BusinessHome({
  tx,
  accounts,
  loanCount,
}: {
  tx: Transaction[];
  accounts: ReturnType<typeof useAccounts>['accounts'];
  loanCount: number;
}) {
  const now = new Date();
  const monthTx = tx.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const revenue = monthTx.filter(isIncomeTx).reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.amount < 0 && t.cat !== 'biz_transfer' && t.cat !== 'biz_owner_draw').reduce((s, t) => s + Math.abs(t.amount), 0);
  const profit = revenue - expense;
  const vatEstimate = Math.round(revenue / 11);
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const todayKey = now.toISOString().slice(0, 10);
  const todayTx = tx.filter((t) => t.date.slice(0, 10) === todayKey);
  const todayRevenue = todayTx.filter(isIncomeTx).reduce((s, t) => s + t.amount, 0);
  const totalAssets = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      <HeroCard
        label="이번 달 영업이익"
        value={profit}
        income={revenue}
        expense={expense}
        third={{ label: '마진', value: margin, suffix: '%', isPercent: true }}
      />

      <section className="grid grid-cols-2 gap-2.5 px-5 pb-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
            오늘 매출
          </p>
          <p className="tnum mt-1.5 tracking-tight"
            style={{ color: 'var(--color-primary)', fontSize: 'var(--text-lg)', fontWeight: 800 }}>
            +{fmt(todayRevenue)}원
          </p>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            {todayTx.length}건 거래
          </p>
        </div>
        <Link href="/wallet" className="tap rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
            전체 자산
          </p>
          <p className="tnum mt-1.5 tracking-tight"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 800 }}>
            {fmtShort(totalAssets)}원
          </p>
          <p style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xxs)', marginTop: 4, fontWeight: 600 }}>
            {accounts.length === 0 ? '계좌 추가' : `${accounts.length}개${loanCount > 0 ? ` · 대출 ${loanCount}` : ''}`}
          </p>
        </Link>
      </section>

      <LiveInvestmentPnL />

      {/* VAT */}
      <section className="px-5 pb-3">
        <Link href="/business/vat" className="tap flex items-center justify-between rounded-2xl px-5 py-4"
          style={{ background: 'var(--color-primary-soft)' }}>
          <div>
            <p style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
              부가세 예상액
            </p>
            <p style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xxs)', marginTop: 2 }}>
              매출의 약 1/11 · 분기말 신고 준비
            </p>
          </div>
          <p className="tnum tracking-tight"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 800 }}>
            {fmtShort(vatEstimate)}원
          </p>
        </Link>
      </section>

      {/* Quick links */}
      <section className="grid grid-cols-3 gap-2 px-5 pb-3">
        <Link href="/business/channels" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22 }}>📈</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>매출 채널</p>
        </Link>
        <Link href="/business/pnl" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22 }}>📊</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>손익계산서</p>
        </Link>
        <Link href="/business/ar-ap" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22 }}>🧾</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>외상</p>
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-2 px-5 pb-3">
        <Link href="/business/vendors" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22, lineHeight: 1 }}>🤝</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>거래처</p>
        </Link>
        <Link href="/settings/employees" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22, lineHeight: 1 }}>👥</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>인건비</p>
        </Link>
        <Link href="/settings/locations" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22, lineHeight: 1 }}>🏪</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>사업장</p>
        </Link>
      </section>

      <section className="grid grid-cols-3 gap-2 px-5 pb-3">
        <Link href="/business/cashflow" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22, lineHeight: 1 }}>💹</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>현금흐름</p>
        </Link>
        <Link href="/business/income-tax" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22, lineHeight: 1 }}>💰</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>소득세</p>
        </Link>
        <Link href="/business/inventory" className="tap rounded-2xl px-3 py-4 text-center"
          style={{ background: 'var(--color-card)' }}>
          <p style={{ fontSize: 22, lineHeight: 1 }}>📦</p>
          <p className="mt-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>재고</p>
        </Link>
      </section>

      <UpcomingRecurring />

      <RecentTransactions tx={tx} businessLabel />
    </>
  );
}

// ─── Reusable Hero card ───
function HeroCard({
  label,
  value,
  income,
  expense,
  third,
}: {
  label: string;
  value: number;
  income: number;
  expense: number;
  third: { label: string; value: number; suffix?: string; isPercent?: boolean };
}) {
  // Proportional bar: income vs expense (relative to their sum so the bar
  // always fills, regardless of magnitude). Gives a quick "where my money
  // went" visual without taking column real-estate.
  const total = income + expense;
  const incomePct = total > 0 ? (income / total) * 100 : 50;

  return (
    <section className="px-5 pb-3">
      <div
        className="relative overflow-hidden rounded-2xl"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-grad-from) 0%, var(--color-primary-grad-to) 100%)',
          boxShadow: '0 4px 18px rgba(0, 0, 0, 0.18)',
        }}
      >
        {/* Subtle aurora highlight in the top-right */}
        <div aria-hidden style={{
          position: 'absolute',
          top: -40, right: -40,
          width: 180, height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.20) 0%, transparent 60%)',
          pointerEvents: 'none',
        }} />

        <div className="relative px-5 py-5 text-white">
          <div className="flex items-center justify-between">
            <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.85, letterSpacing: '0.04em' }}>
              {label.toUpperCase()}
            </p>
            {value !== 0 && (
              <span
                className="tnum"
                style={{
                  padding: '3px 8px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.18)',
                  fontSize: 10, fontWeight: 800, letterSpacing: '-0.01em',
                }}
              >
                {value >= 0 ? '흑자' : '적자'}
              </span>
            )}
          </div>
          <CountUp
            value={value}
            format={(n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) + '원'}
            className="mt-1.5 block tracking-tight"
            style={{ fontSize: 'var(--text-2xl)', fontWeight: 900, letterSpacing: '-0.025em' }}
          />

          {/* Proportional income vs expense bar */}
          {total > 0 && (
            <div className="mt-4">
              <div className="flex h-[4px] w-full overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.22)' }}>
                <div style={{
                  width: `${incomePct}%`,
                  background: 'rgba(255,255,255,0.95)',
                  transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)',
                }} />
                <div style={{
                  width: `${100 - incomePct}%`,
                  background: 'rgba(255,255,255,0.36)',
                }} />
              </div>
            </div>
          )}

          <div className="mt-3 grid grid-cols-3 gap-2" style={{ fontSize: 'var(--text-xs)' }}>
            <Stat label="수입" value={`+${fmtShort(income)}원`} dotOpacity={0.95} />
            <Stat label="지출" value={`−${fmtShort(expense)}원`} dotOpacity={0.36} />
            <Stat
              label={third.label}
              value={third.isPercent ? `${third.value}%` : `${fmtShort(third.value)}원`}
            />
          </div>
        </div>
        <Link
          href="/stats"
          className="tap relative flex items-center justify-between px-5 py-3 text-white"
          style={{ background: 'rgba(0,0,0,0.18)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
        >
          <span>자세히 보기</span>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
            <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </section>
  );
}

function Stat({
  label,
  value,
  dotOpacity,
}: {
  label: string;
  value: string;
  dotOpacity?: number;
}) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1">
        {dotOpacity != null && (
          <span aria-hidden style={{
            display: 'inline-block', width: 6, height: 6, borderRadius: 3,
            background: '#fff', opacity: dotOpacity,
          }} />
        )}
        <span style={{ opacity: 0.8, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em' }}>
          {label}
        </span>
      </div>
      <p className="tnum mt-0.5 truncate" style={{ fontSize: 13, fontWeight: 800 }}>
        {value}
      </p>
    </div>
  );
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-150)' }}>
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}

function EmptyInline({
  icon,
  title,
  hint,
  cta,
}: {
  icon: string;
  title: string;
  hint?: string;
  cta?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-4 text-center">
      <p className="text-2xl">{icon}</p>
      <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
        {title}
      </p>
      {hint && (
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          {hint}
        </p>
      )}
      {cta && (
        <Link href={cta.href} className="tap mt-2 rounded-full px-3 py-1.5"
          style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
          {cta.label}
        </Link>
      )}
    </div>
  );
}

function RecentTransactions({ tx, businessLabel }: { tx: Transaction[]; businessLabel?: boolean }) {
  return (
    <section className="px-5 pb-3 pt-1">
      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
        <div className="flex items-center justify-between px-5 pb-3 pt-5">
          <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
            {businessLabel ? '최근 거래' : '최근 내역'}
          </p>
          <Link href="/list" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            전체보기 ›
          </Link>
        </div>
        {tx.length === 0 ? (
          <div className="px-5 pb-6">
            <EmptyInline
              icon={businessLabel ? '🧾' : '📝'}
              title={businessLabel ? '첫 거래를 기록해 보세요' : '첫 거래를 추가해 보세요'}
              hint={businessLabel ? '매출/비용 둘 다 추적할 수 있어요' : '가운데 + 버튼을 누르면 시작'}
            />
          </div>
        ) : (
          <>
            {tx.slice(0, 4).map((t, i, arr) => (
              <TxRow key={t.id} tx={t} showTime showAccount compact borderBottom={i < arr.length - 1} />
            ))}
            <div className="h-2" />
          </>
        )}
      </div>
    </section>
  );
}

function InsightsRow({
  anomalies,
  forecast,
  alerts,
  weekly,
  budgetTotal,
  currentExpense,
}: {
  anomalies: ReturnType<typeof detectAnomalies>;
  forecast: ReturnType<typeof forecastMonthEnd>;
  alerts: ReturnType<typeof budgetAlerts>;
  weekly: ReturnType<typeof weeklyDigest>;
  budgetTotal: number;
  currentExpense: number;
}) {
  type Card = { tone: 'primary' | 'danger' | 'warn'; Icon: LucideIcon; title: string; body: string };
  const cards: Card[] = [];

  // Forecast
  if (forecast.day >= 5 && forecast.projection > 0) {
    cards.push({
      tone: budgetTotal > 0 && forecast.projection > budgetTotal ? 'warn' : 'primary',
      Icon: Sparkles,
      title: '월말 예상',
      body: `이대로 가면 ${fmtKRW(forecast.projection)}`,
    });
  }

  // Alerts
  alerts.slice(0, 1).forEach((a) => {
    const cat = CATEGORIES[a.cat];
    cards.push({
      tone: a.level === 'over' ? 'danger' : 'warn',
      Icon: a.level === 'over' ? AlertCircle : AlertTriangle,
      title: `${cat?.name ?? a.cat} ${a.level === 'over' ? '예산 초과' : '곧 한도'}`,
      body: `${a.pct}% 사용`,
    });
  });

  // Anomalies
  anomalies.slice(0, 1).forEach((a) => {
    const cat = CATEGORIES[a.cat];
    cards.push({
      tone: 'warn',
      Icon: TrendingUp,
      title: `${cat?.name ?? a.cat} 이상 지출`,
      body: `평소보다 +${a.deltaPct}%`,
    });
  });

  // Weekly
  if (weekly.thisWeek > 0 && weekly.lastWeek > 0) {
    cards.push({
      tone: weekly.delta < 0 ? 'primary' : weekly.delta > 20 ? 'warn' : 'primary',
      Icon: weekly.delta < 0 ? TrendingDown : Activity,
      title: '이번 주',
      body: `${fmtKRW(weekly.thisWeek)} (${weekly.delta >= 0 ? '+' : ''}${weekly.delta}% vs 지난주)`,
    });
  }

  if (cards.length === 0 || currentExpense === 0) return null;

  return (
    <section className="px-5 pb-3 pt-1">
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {cards.map((c, i) => {
          const fg =
            c.tone === 'danger'
              ? 'var(--color-danger)'
              : c.tone === 'warn'
                ? '#B45309'
                : 'var(--color-primary)';
          const tintBg =
            c.tone === 'danger'
              ? 'rgba(240, 68, 82, 0.10)'
              : c.tone === 'warn'
                ? 'rgba(180, 83, 9, 0.10)'
                : 'rgba(0, 185, 86, 0.10)';
          return (
            <div key={i}
              className="relative shrink-0 overflow-hidden rounded-2xl p-3.5"
              style={{
                background: 'var(--color-card)',
                minWidth: 220,
                boxShadow: '0 1px 2px rgba(20, 28, 40, 0.04)',
              }}>
              {/* Aurora wash from top-right, color-coded */}
              <div aria-hidden style={{
                position: 'absolute', inset: 0,
                background: `radial-gradient(120% 80% at 100% 0%, ${tintBg} 0%, transparent 70%)`,
                pointerEvents: 'none',
              }} />
              <div className="relative">
                <div className="flex items-center gap-2">
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 24, height: 24,
                    borderRadius: 6,
                    background: tintBg,
                    color: fg,
                    flexShrink: 0,
                  }}>
                    <c.Icon size={14} strokeWidth={2.4} />
                  </span>
                  <p style={{
                    color: fg,
                    fontSize: 11,
                    fontWeight: 800,
                    letterSpacing: '-0.01em',
                  }}>
                    {c.title}
                  </p>
                </div>
                <p className="mt-2 leading-snug" style={{
                  color: 'var(--color-text-1)',
                  fontSize: 13,
                  fontWeight: 700,
                }}>
                  {c.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
