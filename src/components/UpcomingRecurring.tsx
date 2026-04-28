'use client';

import { useMemo } from 'react';
import { fmt } from '@/lib/format';
import { SEED_RECURRING } from '@/lib/seed';

const todayDay = () => new Date().getDate();

export default function UpcomingRecurring() {
  const upcoming = useMemo(() => {
    const today = todayDay();
    return [...SEED_RECURRING]
      .map((r) => {
        const daysUntil = r.day >= today ? r.day - today : 30 - today + r.day;
        return { ...r, daysUntil };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil)
      .slice(0, 3);
  }, []);

  if (upcoming.length === 0) return null;

  return (
    <section className="px-5 pb-2 pt-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
          곧 빠져나갈 정기결제
        </h2>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {upcoming.map((r) => (
          <div
            key={r.id}
            className="flex w-[160px] shrink-0 flex-col gap-2 rounded-2xl p-4"
            style={{ background: 'var(--color-card)' }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl">{r.emoji}</span>
              <span
                className="rounded-full px-2 py-0.5 text-[10px] font-bold"
                style={{
                  background: r.daysUntil <= 3 ? 'var(--color-danger-soft)' : 'var(--color-gray-100)',
                  color: r.daysUntil <= 3 ? 'var(--color-danger)' : 'var(--color-text-2)',
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
        ))}
      </div>
    </section>
  );
}
