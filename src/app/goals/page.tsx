'use client';

import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { fmt } from '@/lib/format';
import { SEED_GOALS } from '@/lib/seed';

const dDay = (due: string) => {
  const target = new Date(due).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'D-day';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
};

export default function GoalsPage() {
  const router = useRouter();

  return (
    <>
      <TopBar
        title="저축 목표"
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

      <section className="px-5 pb-10 pt-2">
        <div className="space-y-3">
          {SEED_GOALS.map((g) => {
            const pct = Math.min(100, Math.round((g.current / g.target) * 100));
            const remaining = g.target - g.current;
            return (
              <div key={g.id} className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                      style={{ background: `${g.color}1f` }}
                    >
                      {g.emoji}
                    </div>
                    <div>
                      <p className="text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
                        {g.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                        목표일 · {dDay(g.due)}
                      </p>
                    </div>
                  </div>
                  <p className="tnum text-sm font-bold" style={{ color: g.color }}>
                    {pct}%
                  </p>
                </div>

                <div
                  className="mt-4 h-2 overflow-hidden rounded-full"
                  style={{ background: 'var(--color-gray-150)' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: g.color }}
                  />
                </div>

                <div className="mt-3 flex items-baseline justify-between text-sm">
                  <span style={{ color: 'var(--color-text-3)' }}>
                    <span className="tnum font-bold" style={{ color: 'var(--color-text-1)' }}>
                      {fmt(g.current)}
                    </span>
                    <span style={{ color: 'var(--color-text-3)' }}> / {fmt(g.target)}원</span>
                  </span>
                  <span className="tnum text-xs" style={{ color: 'var(--color-text-3)' }}>
                    {fmt(remaining)}원 남음
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => router.push('/settings')}
          className="tap mt-4 w-full rounded-2xl border-2 border-dashed py-5 text-sm font-bold"
          style={{ borderColor: 'var(--color-gray-200)', color: 'var(--color-text-3)' }}
        >
          + 새 목표 추가 (다음 단계에서 지원)
        </button>
      </section>
    </>
  );
}
