'use client';

import { useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import TxRow from '@/components/TxRow';
import { fmt, isExpense } from '@/lib/format';
import { useTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

const fmtMonth = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;

const dayKey = (iso: string) => iso.slice(0, 10);
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
};

export default function ListPage() {
  const { tx, ready } = useTransactions();
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [query, setQuery] = useState('');

  const month = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset, 1);
    return d;
  }, [offset]);

  const monthTx = useMemo(() => {
    const filtered = tx.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
    });
    const byType = filtered.filter((t) => {
      if (filter === 'expense') return t.amount < 0;
      if (filter === 'income') return t.amount > 0;
      return true;
    });
    if (!query.trim()) return byType;
    const q = query.toLowerCase();
    return byType.filter(
      (t) =>
        t.merchant.toLowerCase().includes(q) ||
        (t.memo ?? '').toLowerCase().includes(q),
    );
  }, [tx, month, filter, query]);

  const expense = monthTx.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
  const income = monthTx.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  const groupedByDay = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    [...monthTx]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .forEach((t) => {
        const k = dayKey(t.date);
        if (!map.has(k)) map.set(k, []);
        map.get(k)!.push(t);
      });
    return Array.from(map.entries());
  }, [monthTx]);

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  return (
    <>
      <TopBar title="내역" />

      {/* Month switcher */}
      <section className="flex items-center justify-between px-5 pb-2 pt-1">
        <button
          type="button"
          onClick={() => setOffset((o) => o - 1)}
          className="tap flex h-9 w-9 items-center justify-center rounded-full"
          aria-label="이전 달"
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
            <path d="M15 6l-6 6 6 6" stroke="var(--color-text-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p className="text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
          {fmtMonth(month)}
        </p>
        <button
          type="button"
          onClick={() => setOffset((o) => Math.min(0, o + 1))}
          disabled={offset >= 0}
          className="tap flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30"
          aria-label="다음 달"
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
            <path d="M9 6l6 6-6 6" stroke="var(--color-text-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-2 gap-3 px-5 py-3">
        <div className="rounded-2xl p-3" style={{ background: 'var(--color-card)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
            지출
          </p>
          <p className="tnum mt-1 text-base font-bold" style={{ color: 'var(--color-danger)' }}>
            -{fmt(expense)}원
          </p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'var(--color-card)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
            수입
          </p>
          <p className="tnum mt-1 text-base font-bold" style={{ color: 'var(--color-primary)' }}>
            +{fmt(income)}원
          </p>
        </div>
      </section>

      {/* Filter pills */}
      <section className="flex gap-2 px-5 py-2">
        {(
          [
            ['all', '전체'],
            ['expense', '지출'],
            ['income', '수입'],
          ] as const
        ).map(([k, label]) => {
          const active = filter === k;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setFilter(k)}
              className="tap rounded-full px-4 py-1.5 text-xs font-bold"
              style={{
                background: active ? 'var(--color-text-1)' : 'var(--color-card)',
                color: active ? 'var(--color-card)' : 'var(--color-text-2)',
              }}
            >
              {label}
            </button>
          );
        })}
      </section>

      {/* Search */}
      <section className="px-5 pb-3 pt-1">
        <div
          className="flex items-center gap-2 rounded-xl px-3"
          style={{ background: 'var(--color-card)', height: 44 }}
        >
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
            <circle cx={11} cy={11} r={7} stroke="var(--color-text-3)" strokeWidth={1.8} />
            <path d="M16 16l4 4" stroke="var(--color-text-3)" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="가게, 메모 검색"
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: 'var(--color-text-1)' }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="tap flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: 'var(--color-gray-300)' }}
            >
              <svg viewBox="0 0 24 24" width={12} height={12} fill="none">
                <path d="M6 6l12 12M18 6l-12 12" stroke="white" strokeWidth={3} strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {/* Day groups */}
      <section className="space-y-3 px-5 pb-8">
        {groupedByDay.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl px-6 py-16 text-center" style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">📭</p>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
              내역이 없어요
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
              아래 + 버튼으로 거래를 추가하세요
            </p>
          </div>
        )}
        {groupedByDay.map(([day, items]) => {
          const total = items.reduce((s, t) => s + (isExpense(t) ? Math.abs(t.amount) : 0), 0);
          return (
            <div key={day}>
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--color-text-2)' }}>
                  {fmtDay(items[0].date)}
                </span>
                {total > 0 && (
                  <span className="tnum text-xs" style={{ color: 'var(--color-text-3)' }}>
                    -{fmt(total)}원
                  </span>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
                {items.map((t, i) => (
                  <TxRow key={t.id} tx={t} showTime borderBottom={i < items.length - 1} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </>
  );
}
