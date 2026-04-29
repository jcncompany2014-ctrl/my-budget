'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import TopBar from '@/components/TopBar';
import TxRow from '@/components/TxRow';
import { fmt, fmtKRW, fmtShort, isExpense, isIncome } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export default function CalendarPage() {
  const router = useRouter();
  const { tx, ready } = useTransactions();
  const [offset, setOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const month = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + offset, 1);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [offset]);

  const monthLabel = `${month.getFullYear()}년 ${month.getMonth() + 1}월`;

  const cells = useMemo(() => {
    const firstDay = new Date(month);
    const startWeekday = firstDay.getDay();
    const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const rows: { day: number | null; key: string | null }[][] = [];
    let row: { day: number | null; key: string | null }[] = [];

    for (let i = 0; i < startWeekday; i++) row.push({ day: null, key: null });
    for (let d = 1; d <= lastDay; d++) {
      const date = new Date(month.getFullYear(), month.getMonth(), d);
      row.push({ day: d, key: date.toISOString().slice(0, 10) });
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }
    while (row.length > 0 && row.length < 7) row.push({ day: null, key: null });
    if (row.length > 0) rows.push(row);

    return rows;
  }, [month]);

  const totalsByDay = useMemo(() => {
    const map = new Map<string, { expense: number; income: number; count: number }>();
    tx.forEach((t) => {
      const k = t.date.slice(0, 10);
      if (!map.has(k)) map.set(k, { expense: 0, income: 0, count: 0 });
      const v = map.get(k)!;
      if (isExpense(t)) v.expense += Math.abs(t.amount);
      else if (isIncome(t)) v.income += t.amount;
      v.count += 1;
    });
    return map;
  }, [tx]);

  const monthExpense = useMemo(() => {
    return tx
      .filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
      })
      .filter(isExpense)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [tx, month]);

  const monthIncome = useMemo(() => {
    return tx
      .filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === month.getFullYear() && d.getMonth() === month.getMonth();
      })
      .filter(isIncome)
      .reduce((s, t) => s + t.amount, 0);
  }, [tx, month]);

  const dayTx = selectedDay
    ? tx.filter((t) => t.date.slice(0, 10) === selectedDay).sort((a, b) => b.date.localeCompare(a.date))
    : [];

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  return (
    <>
      <TopBar
        title="캘린더"
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

      {/* Month switcher */}
      <section className="flex items-center justify-between px-5 pb-2">
        <button
          type="button"
          onClick={() => {
            setOffset((o) => o - 1);
            setSelectedDay(null);
          }}
          className="tap flex h-9 w-9 items-center justify-center rounded-full"
          aria-label="이전 달"
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
            <path
              d="M15 6l-6 6 6 6"
              stroke="var(--color-text-2)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <p className="text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
          {monthLabel}
        </p>
        <button
          type="button"
          onClick={() => {
            setOffset((o) => Math.min(0, o + 1));
            setSelectedDay(null);
          }}
          disabled={offset >= 0}
          className="tap flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30"
          aria-label="다음 달"
        >
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
            <path
              d="M9 6l6 6-6 6"
              stroke="var(--color-text-2)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </section>

      {/* Month summary */}
      <section className="grid grid-cols-2 gap-2 px-5 pb-3">
        <div className="rounded-2xl p-3" style={{ background: 'var(--color-card)' }}>
          <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>
            지출
          </p>
          <p className="tnum mt-0.5 text-sm font-extrabold" style={{ color: 'var(--color-danger)' }}>
            -{fmt(monthExpense)}원
          </p>
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'var(--color-card)' }}>
          <p className="text-[11px] font-medium" style={{ color: 'var(--color-text-3)' }}>
            수입
          </p>
          <p className="tnum mt-0.5 text-sm font-extrabold" style={{ color: 'var(--color-primary)' }}>
            +{fmt(monthIncome)}원
          </p>
        </div>
      </section>

      {/* Calendar grid */}
      <section className="px-3 pb-3">
        <div
          className="overflow-hidden rounded-2xl px-2 pb-2 pt-3"
          style={{ background: 'var(--color-card)' }}
        >
          <div className="grid grid-cols-7 pb-2">
            {WEEKDAYS.map((w, i) => (
              <div
                key={w}
                className="text-center text-[11px] font-bold"
                style={{
                  color:
                    i === 0
                      ? 'var(--color-danger)'
                      : i === 6
                        ? 'var(--color-blue-500)'
                        : 'var(--color-text-3)',
                }}
              >
                {w}
              </div>
            ))}
          </div>
          <div className="space-y-1">
            {cells.map((row, ri) => (
              <div key={ri} className="grid grid-cols-7 gap-1">
                {row.map((cell, ci) => {
                  if (!cell.day || !cell.key) {
                    return <div key={ci} />;
                  }
                  const data = totalsByDay.get(cell.key);
                  const isSelected = selectedDay === cell.key;
                  const todayKey = new Date().toISOString().slice(0, 10);
                  const isToday = cell.key === todayKey;
                  return (
                    <button
                      key={ci}
                      type="button"
                      onClick={() => setSelectedDay(isSelected ? null : cell.key)}
                      className="tap flex flex-col items-center justify-start rounded-xl p-1.5"
                      style={{
                        background: isSelected
                          ? 'var(--color-primary)'
                          : isToday
                            ? 'var(--color-primary-soft)'
                            : 'transparent',
                        minHeight: 56,
                      }}
                    >
                      <span
                        className={`text-xs font-bold ${isSelected ? 'text-white' : ''}`}
                        style={{
                          color: isSelected
                            ? '#fff'
                            : isToday
                              ? 'var(--color-primary)'
                              : ci === 0
                                ? 'var(--color-danger)'
                                : ci === 6
                                  ? 'var(--color-blue-500)'
                                  : 'var(--color-text-1)',
                        }}
                      >
                        {cell.day}
                      </span>
                      {data && (
                        <div className="mt-0.5 flex flex-col items-center gap-0.5 text-[9px] leading-tight">
                          {data.expense > 0 && (
                            <span
                              className="tnum font-bold"
                              style={{
                                color: isSelected ? 'rgba(255,255,255,0.95)' : 'var(--color-danger)',
                              }}
                            >
                              -{fmtShort(data.expense)}
                            </span>
                          )}
                          {data.income > 0 && (
                            <span
                              className="tnum font-bold"
                              style={{
                                color: isSelected ? 'rgba(255,255,255,0.95)' : 'var(--color-primary)',
                              }}
                            >
                              +{fmtShort(data.income)}
                            </span>
                          )}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Selected day list */}
      {selectedDay && (
        <section className="px-5 pb-10">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
              {(() => {
                const d = new Date(selectedDay);
                return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
              })()}
            </h2>
            <span className="text-xs" style={{ color: 'var(--color-text-3)' }}>
              {dayTx.length}건
            </span>
          </div>
          {dayTx.length === 0 ? (
            <div
              className="rounded-2xl px-6 py-12 text-center"
              style={{ background: 'var(--color-card)' }}
            >
              <p className="text-3xl">📭</p>
              <p className="mt-2 text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
                이 날 거래가 없어요
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
              {dayTx.map((t, i) => (
                <TxRow
                  key={t.id}
                  tx={t}
                  showTime
                  showAccount
                  borderBottom={i < dayTx.length - 1}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!selectedDay && (
        <p className="px-5 pb-10 text-center text-xs" style={{ color: 'var(--color-text-3)' }}>
          날짜를 누르면 그 날 거래가 보여요 · 오늘은{' '}
          <span style={{ color: 'var(--color-primary)' }}>{fmtKRW(0)}</span>
        </p>
      )}
    </>
  );
}
