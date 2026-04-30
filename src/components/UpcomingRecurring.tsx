'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { fmt } from '@/lib/format';
import { daysUntilDay, useRecurring } from '@/lib/recurring';

export default function UpcomingRecurring() {
  const { items, ready } = useRecurring();

  const upcoming = useMemo(() => {
    return [...items]
      .map((r) => ({ ...r, daysUntil: daysUntilDay(r.day) }))
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 4);
  }, [items]);

  if (!ready || upcoming.length === 0) return null;

  return (
    <section className="px-5 pb-3">
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
        <Link href="/settings/recurring" className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
            곧 빠져나갈 정기결제
          </p>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
            <path
              d="M9 6l6 6-6 6"
              stroke="var(--color-text-3)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {upcoming.map((r) => {
            const urgent = r.daysUntil <= 3;
            return (
              <div
                key={r.id}
                className="flex w-[150px] shrink-0 flex-col gap-2 rounded-2xl p-3.5"
                style={{
                  background: 'var(--color-gray-50)',
                  boxShadow: urgent ? 'inset 0 0 0 1.5px var(--color-danger)' : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <CategoryIcon catId={r.cat} size={32} />
                  <span
                    className="tnum rounded-full px-2 py-0.5"
                    style={{
                      background: urgent ? 'var(--color-danger)' : 'var(--color-gray-100)',
                      color: urgent ? '#fff' : 'var(--color-text-2)',
                      fontSize: 10, fontWeight: 800, letterSpacing: '-0.01em',
                    }}
                  >
                    {r.daysUntil === 0 ? '오늘' : `D-${r.daysUntil}`}
                  </span>
                </div>
                <p className="truncate text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
                  {r.name}
                </p>
                <p className="tnum text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>
                  {fmt(r.amount)}원
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
