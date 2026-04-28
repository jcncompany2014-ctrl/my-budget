'use client';

import Link from 'next/link';
import { useMode } from '@/components/ModeProvider';
import ModeToggle from '@/components/ModeToggle';
import TxRow from '@/components/TxRow';
import { fmt, fmtKRW, isExpense } from '@/lib/format';
import { useTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

export default function HomePage() {
  const { tx, ready } = useTransactions();
  const { mode } = useMode();

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  return (
    <>
      <header
        className="sticky top-0 z-30 flex h-14 items-center justify-between px-4"
        style={{ background: 'var(--color-bg)' }}
      >
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

      {mode === 'personal' ? <PersonalHome tx={tx} /> : <BusinessHome tx={tx} />}
    </>
  );
}

function PersonalHome({ tx }: { tx: Transaction[] }) {
  const now = new Date();
  const monthTx = tx.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const expense = monthTx.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const net = income - expense;

  return (
    <>
      <section className="px-5 pb-6 pt-2">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
          이번 달 지출
        </p>
        <p className="tnum mt-1 text-[34px] font-bold leading-tight" style={{ color: 'var(--color-text-1)' }}>
          {fmtKRW(expense)}
        </p>
        <p
          className="tnum mt-1 text-sm"
          style={{ color: net >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}
        >
          {net >= 0 ? '+' : '-'}
          {fmtKRW(Math.abs(net))} 순{net >= 0 ? '수익' : '지출'}
        </p>
      </section>

      <section className="px-5">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-2)' }}>수입</span>
            <span className="tnum font-semibold" style={{ color: 'var(--color-primary)' }}>
              +{fmtKRW(income)}
            </span>
          </div>
          <div className="my-3 h-px" style={{ background: 'var(--color-divider)' }} />
          <div className="flex items-center justify-between">
            <span style={{ color: 'var(--color-text-2)' }}>지출</span>
            <span className="tnum font-semibold" style={{ color: 'var(--color-danger)' }}>
              -{fmtKRW(expense)}
            </span>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-5 pt-5">
        <Link href="/budget" className="tap rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-2xl">📊</p>
          <p className="mt-1 text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>예산</p>
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>카테고리별 한도</p>
        </Link>
        <Link href="/goals" className="tap rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-2xl">🎯</p>
          <p className="mt-1 text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>저축 목표</p>
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>목표를 향해</p>
        </Link>
      </section>

      <RecentTransactions tx={tx} />
    </>
  );
}

function BusinessHome({ tx }: { tx: Transaction[] }) {
  const now = new Date();
  const monthTx = tx.filter((t) => {
    const d = new Date(t.date);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const revenue = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const expense = monthTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const profit = revenue - expense;
  const vatEstimate = Math.round((revenue / 11) * 1); // 매출의 1/11 ≈ 부가세 추정
  const profitMargin = revenue > 0 ? Math.round((profit / revenue) * 100) : 0;

  return (
    <>
      <section className="px-5 pb-6 pt-2">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
          이번 달 매출
        </p>
        <p className="tnum mt-1 text-[34px] font-bold leading-tight" style={{ color: 'var(--color-text-1)' }}>
          {fmtKRW(revenue)}
        </p>
        <p
          className="tnum mt-1 text-sm"
          style={{ color: profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}
        >
          영업이익 {profit >= 0 ? '+' : '-'}
          {fmtKRW(Math.abs(profit))}
          {revenue > 0 ? ` · 마진 ${profitMargin}%` : ''}
        </p>
      </section>

      <section className="grid grid-cols-3 gap-2 px-5">
        <KPI label="매출" value={fmt(revenue)} unit="원" tone="primary" />
        <KPI label="비용" value={fmt(expense)} unit="원" tone="danger" />
        <KPI label="이익" value={fmt(profit)} unit="원" tone={profit >= 0 ? 'primary' : 'danger'} />
      </section>

      <section className="px-5 pt-4">
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
            {fmtKRW(vatEstimate)}
          </p>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 px-5 pt-4">
        <Link href="/budget" className="tap rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-2xl">🧾</p>
          <p className="mt-1 text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>고정비</p>
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>임대료·인건비·공과금</p>
        </Link>
        <Link href="/stats" className="tap rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-2xl">📈</p>
          <p className="mt-1 text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>매출 분석</p>
          <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>채널별 매출 추이</p>
        </Link>
      </section>

      <RecentTransactions tx={tx} />
    </>
  );
}

function KPI({
  label,
  value,
  unit,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  tone: 'primary' | 'danger' | 'neutral';
}) {
  const color =
    tone === 'primary'
      ? 'var(--color-primary)'
      : tone === 'danger'
        ? 'var(--color-danger)'
        : 'var(--color-text-1)';
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--color-card)' }}>
      <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>
        {label}
      </p>
      <p className="tnum mt-1 truncate text-base font-bold" style={{ color }}>
        {value}
        <span className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>
          {' '}
          {unit}
        </span>
      </p>
    </div>
  );
}

function RecentTransactions({ tx }: { tx: Transaction[] }) {
  return (
    <section className="px-5 pb-8 pt-7">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
          최근 내역
        </h2>
        <Link href="/list" className="text-sm font-semibold" style={{ color: 'var(--color-text-3)' }}>
          전체 {tx.length}건 →
        </Link>
      </div>

      {tx.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          {tx.slice(0, 8).map((t, i, arr) => (
            <TxRow key={t.id} tx={t} borderBottom={i < arr.length - 1} />
          ))}
        </div>
      )}
    </section>
  );
}

function EmptyState() {
  return (
    <Link
      href="/add"
      className="tap flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center"
      style={{ background: 'var(--color-card)' }}
    >
      <p className="text-3xl">📝</p>
      <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
        첫 거래를 추가해 보세요
      </p>
      <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
        가운데 + 버튼을 누르면 시작할 수 있어요
      </p>
    </Link>
  );
}
