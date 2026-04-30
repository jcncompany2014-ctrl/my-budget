'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import { SkeletonHome } from '@/components/Skeleton';
import TopBar from '@/components/TopBar';
import TxRow from '@/components/TxRow';
import { useToast } from '@/components/Toast';
import { CATEGORIES, expenseCategoriesByScope, incomeCategoriesByScope } from '@/lib/categories';
import { fmt, isExpense } from '@/lib/format';
import { useAllTransactions, useTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

const fmtMonth = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월`;

const dayKey = (iso: string) => iso.slice(0, 10);
const fmtDay = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
};

export default function ListPage() {
  const { tx, ready } = useTransactions();
  const { update, remove } = useAllTransactions();
  const { mode } = useMode();
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const [filter, setFilter] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [query, setQuery] = useState('');
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkCatPicker, setBulkCatPicker] = useState(false);

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
      if (filter === 'expense') return t.amount < 0 && !t.transferPairId;
      if (filter === 'income') return t.amount > 0 && !t.transferPairId;
      if (filter === 'transfer') return !!t.transferPairId;
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
  const income = monthTx.filter((t) => t.amount > 0 && !t.transferPairId).reduce((s, t) => s + t.amount, 0);

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

  const cats = mode === 'business' ? expenseCategoriesByScope('business') : expenseCategoriesByScope('personal');

  const toggleSelected = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitBulk = () => {
    setBulkMode(false);
    setSelected(new Set());
    setBulkCatPicker(false);
  };

  const bulkChangeCategory = (catId: string) => {
    selected.forEach((id) => update(id, { cat: catId }));
    toast.show(`${selected.size}건 카테고리 변경 완료`, 'success');
    exitBulk();
  };

  const bulkDelete = () => {
    const allRemoved: typeof tx = [];
    selected.forEach((id) => {
      const r = remove(id);
      allRemoved.push(...r);
    });
    const count = selected.size;
    toast.show(`${count}건 삭제 완료`, {
      variant: 'info',
      durationMs: 5000,
      action: {
        label: '되돌리기',
        onClick: () => {
          // restore all
          // Since useTransactions exposes restore via useAllTransactions, fall back: re-add
          // But list page used scoped useTransactions. Using simple update via storage:
          if (typeof window !== 'undefined') {
            try {
              const raw = window.localStorage.getItem('asset/transactions/v2');
              const cur = raw ? JSON.parse(raw) : [];
              const next = [...allRemoved, ...cur];
              window.localStorage.setItem('asset/transactions/v2', JSON.stringify(next));
              window.location.reload();
            } catch {
              /* ignore */
            }
          }
        },
      },
    });
    exitBulk();
  };

  if (!ready) {
    return <SkeletonHome />;
  }

  return (
    <>
      <TopBar
        title={bulkMode ? `${selected.size}건 선택` : '내역'}
        right={
          bulkMode ? (
            <button type="button" onClick={exitBulk} className="tap rounded-full px-3 py-2"
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              취소
            </button>
          ) : (
            <button type="button" onClick={() => setBulkMode(true)} className="tap rounded-full px-3 py-2"
              style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              선택
            </button>
          )
        }
      />

      {/* Month switcher */}
      <section className="flex items-center justify-between px-5 pb-2 pt-1">
        <button type="button" onClick={() => setOffset((o) => o - 1)}
          className="tap flex h-9 w-9 items-center justify-center rounded-full" aria-label="이전 달">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
            <path d="M15 6l-6 6 6 6" stroke="var(--color-text-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
          {fmtMonth(month)}
        </p>
        <button type="button" onClick={() => setOffset((o) => Math.min(0, o + 1))} disabled={offset >= 0}
          className="tap flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-30" aria-label="다음 달">
          <svg viewBox="0 0 24 24" width={20} height={20} fill="none">
            <path d="M9 6l6 6-6 6" stroke="var(--color-text-2)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </section>

      {/* Summary */}
      <section className="grid grid-cols-2 gap-3 px-5 py-3">
        <div className="rounded-2xl p-3" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>지출</p>
          <Money value={expense} sign="negative"
            className="mt-1 block"
            style={{ color: 'var(--color-danger)', fontSize: 'var(--text-base)', fontWeight: 800 }} />
        </div>
        <div className="rounded-2xl p-3" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>수입</p>
          <Money value={income} sign="positive"
            className="mt-1 block"
            style={{ color: 'var(--color-primary)', fontSize: 'var(--text-base)', fontWeight: 800 }} />
        </div>
      </section>

      {/* Filter pills */}
      <section className="flex gap-2 px-5 py-2">
        {([
          ['all', '전체'],
          ['expense', '지출'],
          ['income', '수입'],
          ['transfer', '이체'],
        ] as const).map(([k, label]) => {
          const active = filter === k;
          return (
            <button key={k} type="button" onClick={() => setFilter(k)}
              className="tap rounded-full px-3 py-1.5"
              style={{
                background: active ? 'var(--color-text-1)' : 'var(--color-card)',
                color: active ? 'var(--color-card)' : 'var(--color-text-2)',
                fontSize: 'var(--text-xxs)',
                fontWeight: 700,
              }}>
              {label}
            </button>
          );
        })}
      </section>

      {/* Search */}
      <section className="px-5 pb-3 pt-1">
        <div className="flex items-center gap-2 rounded-xl px-3"
          style={{ background: 'var(--color-card)', height: 44 }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
            <circle cx={11} cy={11} r={7} stroke="var(--color-text-3)" strokeWidth={1.8} />
            <path d="M16 16l4 4" stroke="var(--color-text-3)" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="소비처, 메모 검색"
            className="flex-1 bg-transparent outline-none"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)' }} />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="tap flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: 'var(--color-gray-300)' }}>
              <svg viewBox="0 0 24 24" width={12} height={12} fill="none">
                <path d="M6 6l12 12M18 6l-12 12" stroke="white" strokeWidth={3} strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </section>

      {/* Day groups */}
      <section className="space-y-3 px-5 pb-24">
        {groupedByDay.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl px-6 py-16 text-center"
            style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">📭</p>
            <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              내역이 없어요
            </p>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
              아래 + 버튼으로 거래를 추가하세요
            </p>
          </div>
        )}
        {groupedByDay.map(([day, items]) => {
          const total = items.reduce((s, t) => s + (isExpense(t) ? Math.abs(t.amount) : 0), 0);
          return (
            <div key={day}>
              <div className="mb-1.5 flex items-center justify-between px-1">
                <span style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
                  {fmtDay(items[0].date)}
                </span>
                {total > 0 && (
                  <span className="tnum" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                    −{fmt(total)}원
                  </span>
                )}
              </div>
              <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
                {items.map((t, i) => (
                  bulkMode ? (
                    <button key={t.id} type="button" onClick={() => toggleSelected(t.id)}
                      className="tap flex w-full items-center gap-3 px-4 py-3 text-left"
                      style={{
                        borderBottom: i < items.length - 1 ? '1px solid var(--color-divider)' : 'none',
                        background: selected.has(t.id) ? 'var(--color-primary-soft)' : 'transparent',
                      }}>
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded border-2"
                        style={{
                          borderColor: selected.has(t.id) ? 'var(--color-primary)' : 'var(--color-gray-300)',
                          background: selected.has(t.id) ? 'var(--color-primary)' : 'transparent',
                        }}>
                        {selected.has(t.id) && (
                          <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
                            <path d="M5 12l5 5L20 7" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      <CategoryIcon catId={t.cat} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                          {t.merchant}
                        </p>
                        <p className="truncate" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                          {CATEGORIES[t.cat]?.name ?? '기타'}
                        </p>
                      </div>
                      <Money value={t.amount} sign="auto"
                        style={{
                          color: t.amount > 0 ? 'var(--color-primary)' : 'var(--color-text-1)',
                          fontSize: 'var(--text-sm)',
                          fontWeight: 700,
                        }} />
                    </button>
                  ) : (
                    <TxRow key={t.id} tx={t} showTime borderBottom={i < items.length - 1} />
                  )
                ))}
              </div>
            </div>
          );
        })}
      </section>

      {/* Bulk action bar */}
      {bulkMode && selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[60]"
          style={{
            background: 'var(--color-card)',
            borderTop: '1px solid var(--color-divider)',
            paddingBottom: 'env(safe-area-inset-bottom)',
          }}>
          <div className="mx-auto flex max-w-[440px] gap-2 p-3">
            <button type="button" onClick={() => setBulkCatPicker(true)}
              className="tap h-12 flex-1 rounded-xl"
              style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              카테고리 변경
            </button>
            <button type="button" onClick={bulkDelete}
              className="tap h-12 flex-1 rounded-xl"
              style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              {selected.size}건 삭제
            </button>
          </div>
        </div>
      )}

      {bulkCatPicker && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
          <div className="max-h-[75dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl p-5"
            style={{ background: 'var(--color-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--color-gray-200)' }} />
            <h3 className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
              카테고리 선택
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {cats.map((c) => (
                <button key={c.id} type="button" onClick={() => bulkChangeCategory(c.id)}
                  className="tap flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3"
                  style={{ background: 'var(--color-gray-100)' }}>
                  <CategoryIcon catId={c.id} size={28} />
                  <span style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}>
                    {c.name}
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setBulkCatPicker(false)}
              className="tap mt-3 h-12 w-full rounded-xl"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              취소
            </button>
          </div>
        </div>
      )}
    </>
  );
}
