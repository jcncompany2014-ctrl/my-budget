'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useMode } from '@/components/ModeProvider';
import ModeToggle from '@/components/ModeToggle';
import TxRow from '@/components/TxRow';
import { useAccounts } from '@/lib/accounts';
import { useBudgets } from '@/lib/budgets';
import { CATEGORIES } from '@/lib/categories';
import { fmt, fmtShort } from '@/lib/format';
import { useGoals } from '@/lib/goals';
import { useProfile } from '@/lib/profile';
import { useTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

const isExpenseTx = (t: Transaction) =>
  t.amount < 0 && t.cat !== 'saving' && t.cat !== 'transfer';
const isIncomeTx = (t: Transaction) => t.amount > 0;

export default function HomePage() {
  const { tx, ready } = useTransactions();
  const { accounts } = useAccounts();
  const { budgets } = useBudgets();
  const { goals } = useGoals();
  const { profile } = useProfile();
  const { mode } = useMode();

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const now = new Date();
  const monthName = now.getMonth() + 1;

  return (
    <div className="pb-6">
      {/* Top: mode toggle + settings */}
      <header className="sticky top-0 z-30 flex items-center justify-between px-4 pb-2 pt-3" style={{ background: 'var(--color-bg)' }}>
        <ModeToggle />
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
      </header>

      {/* Greeting */}
      <section className="px-5 pb-3 pt-2">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
          {profile.name ? `안녕하세요, ${profile.name}님 👋` : '안녕하세요 👋'}
        </p>
        <h1 className="mt-0.5 text-[22px] font-extrabold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
          {mode === 'business' ? `${monthName}월 사업 가계부` : `${monthName}월의 가계부`}
        </h1>
      </section>

      {mode === 'personal' ? (
        <PersonalHome tx={tx} accounts={accounts} budgets={budgets} goals={goals} />
      ) : (
        <BusinessHome tx={tx} accounts={accounts} />
      )}
    </div>
  );
}

// ─── Personal Home ───
function PersonalHome({
  tx,
  accounts,
  budgets,
  goals,
}: {
  tx: Transaction[];
  accounts: ReturnType<typeof useAccounts>['accounts'];
  budgets: ReturnType<typeof useBudgets>['budgets'];
  goals: ReturnType<typeof useGoals>['goals'];
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

  // Top categories
  const topCats = useMemo(() => {
    const map = new Map<string, number>();
    monthTx.filter(isExpenseTx).forEach((t) => {
      map.set(t.cat, (map.get(t.cat) ?? 0) + Math.abs(t.amount));
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
  }, [monthTx]);

  // Budget summary
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

  return (
    <>
      {/* Hero card */}
      <section className="px-5 pb-3">
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #00B956 0%, #00853C 100%)',
            boxShadow: '0 4px 18px rgba(0, 185, 86, 0.25)',
          }}
        >
          <div className="px-5 py-5 text-white">
            <p className="text-[13px] font-medium opacity-90">이번 달 순수익</p>
            <p className="tnum mt-1 text-[32px] font-extrabold tracking-tight">
              {net >= 0 ? '+' : '−'}
              {fmt(net)}원
            </p>
            <div className="mt-4 flex gap-3 text-xs">
              <Stat label="수입" value={`+${fmtShort(income)}원`} />
              <Divider />
              <Stat label="지출" value={`−${fmtShort(expense)}원`} />
              <Divider />
              <Stat label="저축" value={`${fmtShort(saving)}원`} />
            </div>
          </div>
          <Link
            href="/stats"
            className="tap flex items-center justify-between px-5 py-3 text-[13px] font-semibold text-white"
            style={{ background: 'rgba(0,0,0,0.18)' }}
          >
            <span>자세히 보기</span>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
              <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Today + Total assets */}
      <section className="grid grid-cols-2 gap-2.5 px-5 pb-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
            오늘 쓴 돈
          </p>
          <p className="tnum mt-1.5 text-lg font-extrabold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
            {fmt(todaySpend)}원
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            {todayTx.length === 0 ? '거래 없음' : `${todayTx.length}건의 지출`}
          </p>
        </div>
        <Link href="/wallet" className="tap rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
            전체 자산
          </p>
          <p className="tnum mt-1.5 text-lg font-extrabold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
            {fmtShort(totalAssets)}원
          </p>
          <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--color-primary)' }}>
            {accounts.length === 0 ? '계좌 추가하기' : `${accounts.length}개 계좌·카드 연결`}
          </p>
        </Link>
      </section>

      {/* Budget */}
      <section className="px-5 pb-3">
        <Link href="/budget" className="tap block rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          {budgetEntries.length === 0 ? (
            <EmptyInline
              icon="📊"
              title="예산을 설정해 보세요"
              hint="카테고리별 한 달 한도를 정하면 진행률이 보여요"
            />
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
                    이번 달 예산
                  </p>
                  <p className="tnum mt-1 truncate text-lg font-extrabold" style={{ color: 'var(--color-text-1)' }}>
                    {fmtShort(Math.max(0, budgetTotal - budgetUsed))}원 남음
                  </p>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-[11px] font-bold"
                  style={{
                    background:
                      budgetUsed > budgetTotal
                        ? 'var(--color-danger-soft)'
                        : 'var(--color-primary-soft)',
                    color:
                      budgetUsed > budgetTotal ? 'var(--color-danger)' : 'var(--color-primary)',
                  }}
                >
                  {budgetTotal > 0 ? Math.round((budgetUsed / budgetTotal) * 100) : 0}% 사용
                </span>
              </div>
              <ProgressBar
                value={budgetUsed}
                max={budgetTotal}
                color={
                  budgetUsed > budgetTotal
                    ? 'var(--color-danger)'
                    : budgetUsed / budgetTotal > 0.8
                      ? 'var(--color-orange-500)'
                      : 'var(--color-primary)'
                }
              />
              <div className="mt-2 flex justify-between text-[11px]" style={{ color: 'var(--color-text-3)' }}>
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
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
              많이 쓴 카테고리
            </p>
            <Link href="/stats" className="text-xs font-semibold" style={{ color: 'var(--color-text-3)' }}>
              전체보기 ›
            </Link>
          </div>
          {topCats.length === 0 ? (
            <EmptyInline icon="🛒" title="이번 달 지출이 없어요" hint="+ 버튼으로 첫 거래를 추가하세요" />
          ) : (
            <div className="flex flex-col gap-3">
              {topCats.map(([catId, amt]) => {
                const c = CATEGORIES[catId];
                const pct = expense > 0 ? (amt / expense) * 100 : 0;
                return (
                  <div key={catId} className="flex items-center gap-3">
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                      style={{ background: c ? `${c.color}1f` : 'var(--color-gray-150)' }}
                    >
                      {c?.emoji ?? '💰'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-baseline justify-between">
                        <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>
                          {c?.name ?? catId}
                        </span>
                        <span className="tnum text-[13px] font-bold" style={{ color: 'var(--color-text-1)' }}>
                          {fmt(amt)}원
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-100)' }}>
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{ width: `${pct}%`, background: c?.color ?? 'var(--color-primary)' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Goals */}
      <section className="px-5 pb-3">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <Link href="/goals" className="mb-3.5 flex items-center justify-between">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
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
            <div className="flex gap-2.5 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
              {goals.map((g) => {
                const pct = g.target > 0 ? (g.current / g.target) * 100 : 0;
                return (
                  <Link
                    href="/goals"
                    key={g.id}
                    className="tap shrink-0 rounded-2xl p-3.5"
                    style={{ background: 'var(--color-gray-50)', width: '60%' }}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-full text-base"
                        style={{ background: `${g.color}22` }}
                      >
                        {g.emoji}
                      </div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--color-text-1)' }}>
                        {g.name}
                      </p>
                    </div>
                    <p className="tnum text-sm font-extrabold" style={{ color: 'var(--color-text-1)' }}>
                      {fmtShort(g.current)}
                      <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>
                        /{fmtShort(g.target)}원
                      </span>
                    </p>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full"
                      style={{ background: 'var(--color-gray-150)' }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, pct)}%`, background: g.color }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>
                      {Math.round(pct)}% 달성
                    </p>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Recent transactions */}
      <section className="px-5 pb-2">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
              최근 내역
            </p>
            <Link href="/list" className="text-xs font-semibold" style={{ color: 'var(--color-text-3)' }}>
              전체보기 ›
            </Link>
          </div>
          {tx.length === 0 ? (
            <div className="px-5 pb-6">
              <EmptyInline icon="📝" title="첫 거래를 추가해 보세요" hint="가운데 + 버튼을 누르면 시작" />
            </div>
          ) : (
            <>
              {tx.slice(0, 4).map((t, i, arr) => (
                <TxRow
                  key={t.id}
                  tx={t}
                  showTime
                  showAccount
                  compact
                  borderBottom={i < arr.length - 1}
                />
              ))}
              <div className="h-2" />
            </>
          )}
        </div>
      </section>
    </>
  );
}

// ─── Business Home ───
function BusinessHome({
  tx,
  accounts,
}: {
  tx: Transaction[];
  accounts: ReturnType<typeof useAccounts>['accounts'];
}) {
  const now = new Date();
  const monthTx = tx.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const revenue = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const profit = revenue - expense;
  const vatEstimate = Math.round(revenue / 11);
  const margin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  const todayKey = now.toISOString().slice(0, 10);
  const todayTx = tx.filter((t) => t.date.slice(0, 10) === todayKey);
  const todayRevenue = todayTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const totalAssets = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <>
      {/* Business hero card */}
      <section className="px-5 pb-3">
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #191F28 0%, #4E5968 100%)',
            boxShadow: '0 4px 18px rgba(25, 31, 40, 0.25)',
          }}
        >
          <div className="px-5 py-5 text-white">
            <p className="text-[13px] font-medium opacity-90">이번 달 영업이익</p>
            <p className="tnum mt-1 text-[32px] font-extrabold tracking-tight">
              {profit >= 0 ? '+' : '−'}
              {fmt(Math.abs(profit))}원
            </p>
            <div className="mt-4 flex gap-3 text-xs">
              <Stat label="매출" value={`+${fmtShort(revenue)}원`} />
              <Divider />
              <Stat label="비용" value={`−${fmtShort(expense)}원`} />
              <Divider />
              <Stat label="마진" value={`${margin}%`} />
            </div>
          </div>
          <Link
            href="/stats"
            className="tap flex items-center justify-between px-5 py-3 text-[13px] font-semibold text-white"
            style={{ background: 'rgba(255,255,255,0.1)' }}
          >
            <span>자세히 보기</span>
            <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
              <path d="M9 6l6 6-6 6" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        </div>
      </section>

      {/* Today revenue + Assets */}
      <section className="grid grid-cols-2 gap-2.5 px-5 pb-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
            오늘 매출
          </p>
          <p className="tnum mt-1.5 text-lg font-extrabold tracking-tight" style={{ color: 'var(--color-primary)' }}>
            +{fmt(todayRevenue)}원
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            {todayTx.length}건 거래
          </p>
        </div>
        <Link href="/wallet" className="tap rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
            전체 자산
          </p>
          <p className="tnum mt-1.5 text-lg font-extrabold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
            {fmtShort(totalAssets)}원
          </p>
          <p className="mt-1 text-[11px] font-semibold" style={{ color: 'var(--color-primary)' }}>
            {accounts.length === 0 ? '계좌 추가하기' : `${accounts.length}개 연결`}
          </p>
        </Link>
      </section>

      {/* VAT estimate */}
      <section className="px-5 pb-3">
        <div
          className="flex items-center justify-between rounded-2xl px-5 py-4"
          style={{ background: 'var(--color-primary-soft)' }}
        >
          <div>
            <p className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>
              부가세 예상액
            </p>
            <p className="mt-0.5 text-[11px]" style={{ color: 'var(--color-text-2)' }}>
              매출의 약 1/11 · 분기말 신고 준비
            </p>
          </div>
          <p className="tnum text-lg font-extrabold" style={{ color: 'var(--color-text-1)' }}>
            {fmtShort(vatEstimate)}원
          </p>
        </div>
      </section>

      {/* Recent business transactions */}
      <section className="px-5 pb-2">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          <div className="flex items-center justify-between px-5 pb-3 pt-5">
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
              최근 거래
            </p>
            <Link href="/list" className="text-xs font-semibold" style={{ color: 'var(--color-text-3)' }}>
              전체보기 ›
            </Link>
          </div>
          {tx.length === 0 ? (
            <div className="px-5 pb-6">
              <EmptyInline icon="🧾" title="첫 거래를 기록해 보세요" hint="매출/비용 둘 다 추적할 수 있어요" />
            </div>
          ) : (
            <>
              {tx.slice(0, 4).map((t, i, arr) => (
                <TxRow
                  key={t.id}
                  tx={t}
                  showTime
                  showAccount
                  compact
                  borderBottom={i < arr.length - 1}
                />
              ))}
              <div className="h-2" />
            </>
          )}
        </div>
      </section>
    </>
  );
}

// ─── helpers ───
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="opacity-80">{label}</p>
      <p className="tnum mt-0.5 truncate text-[13px] font-bold">{value}</p>
    </div>
  );
}

function Divider() {
  return <div className="w-px" style={{ background: 'rgba(255,255,255,0.2)' }} />;
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-150)' }}>
      <div
        className="h-full rounded-full transition-all duration-700"
        style={{ width: `${pct}%`, background: color }}
      />
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
      <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
        {title}
      </p>
      {hint && (
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
          {hint}
        </p>
      )}
      {cta && (
        <Link
          href={cta.href}
          className="tap mt-2 rounded-full px-3 py-1.5 text-xs font-bold"
          style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}
