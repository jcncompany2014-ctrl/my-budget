'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import Confetti from '@/components/Confetti';
import LineChart from '@/components/LineChart';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import { fmt } from '@/lib/format';
import { useGoals } from '@/lib/goals';

const dDay = (due: string) => {
  const target = new Date(due).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'D-day';
  return diff > 0 ? `D-${diff}` : `D+${-diff}`;
};

const weeksUntil = (due: string) => {
  const target = new Date(due).getTime();
  const now = Date.now();
  return Math.max(1, Math.ceil((target - now) / (1000 * 60 * 60 * 24 * 7)));
};

export default function GoalsPage() {
  const { goals, ready } = useGoals();
  const [confettiId, setConfettiId] = useState<string | null>(null);
  const [shown, setShown] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!ready) return;
    const completed = goals.find((g) => g.target > 0 && g.current >= g.target && !shown.has(g.id));
    if (completed) {
      setConfettiId(completed.id);
      setShown((s) => new Set(s).add(completed.id));
    }
  }, [goals, ready, shown]);

  return (
    <>
      <TopBar
        title="저축 목표"
        right={
          <Link href="/settings/goals" className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            관리
          </Link>
        }
      />

      <section className="px-5 pb-10 pt-2">
        {!ready ? null : goals.length === 0 ? (
          <Link href="/settings/goals"
            className="tap flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center"
            style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">🎯</p>
            <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              아직 목표가 없어요
            </p>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
              여행, 비상금 같은 첫 목표를 만들어 보세요
            </p>
          </Link>
        ) : (
          <div className="space-y-3">
            {goals.map((g) => {
              const pct = g.target > 0 ? Math.min(100, Math.round((g.current / g.target) * 100)) : 0;
              const remaining = Math.max(0, g.target - g.current);
              const completed = pct >= 100;
              const weeks = weeksUntil(g.due);
              const perWeek = Math.ceil(remaining / weeks);
              return (
                <Link href="/settings/goals" key={g.id}
                  className="tap block rounded-2xl p-5"
                  style={{ background: 'var(--color-card)' }}>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                        style={{ background: `${g.color}1f` }}>
                        {g.emoji}
                      </div>
                      <div>
                        <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                          {g.name}
                          {completed && <span className="ml-1.5">🎉</span>}
                        </p>
                        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                          목표일 · {dDay(g.due)}
                        </p>
                      </div>
                    </div>
                    <p className="tnum" style={{ color: g.color, fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                      {pct}%
                    </p>
                  </div>

                  <div className="mt-4 h-2 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-150)' }}>
                    <div className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: g.color }} />
                  </div>

                  <div className="mt-3 flex items-baseline justify-between" style={{ fontSize: 'var(--text-sm)' }}>
                    <span style={{ color: 'var(--color-text-3)' }}>
                      <Money value={g.current} sign="never"
                        className="font-bold"
                        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)' }} />
                      <span style={{ color: 'var(--color-text-3)' }}> / {fmt(g.target)}원</span>
                    </span>
                    <span className="tnum" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                      {fmt(remaining)}원 남음
                    </span>
                  </div>

                  {!completed && remaining > 0 && (
                    <div className="mt-3 rounded-xl px-3 py-2" style={{ background: 'var(--color-gray-50)' }}>
                      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}>
                        달성 페이스
                      </p>
                      <p className="tnum mt-0.5" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                        매주 {fmt(perWeek)}원 저축 시 달성 ({weeks}주 남음)
                      </p>
                    </div>
                  )}

                  {/* Gap chart: ideal vs actual progress */}
                  <GoalGapChart goal={g} />
                </Link>
              );
            })}
          </div>
        )}
      </section>

      {confettiId && <Confetti onDone={() => setConfettiId(null)} />}
    </>
  );
}

function GoalGapChart({ goal }: { goal: { target: number; current: number; due: string } }) {
  // Simple linear ideal vs current single-point projection
  const today = new Date();
  const due = new Date(goal.due);
  const totalDays = Math.max(1, Math.ceil((due.getTime() - new Date().setMonth(today.getMonth() - 3)) / (1000 * 60 * 60 * 24)));
  const elapsedDays = Math.max(0, Math.min(totalDays, Math.ceil((today.getTime() - new Date().setMonth(today.getMonth() - 3)) / (1000 * 60 * 60 * 24))));
  const points = 6;
  const ideal: number[] = [];
  const actual: number[] = [];
  const labels: string[] = [];
  for (let i = 0; i < points; i++) {
    const fraction = i / (points - 1);
    ideal.push(goal.target * fraction);
    actual.push(goal.current * (i === points - 1 ? 1 : Math.min(1, fraction * (elapsedDays / totalDays + 0.05))));
    labels.push(['시작', '', '', '', '', '오늘'][i] ?? '');
  }
  return (
    <div className="mt-3 rounded-xl px-2 py-2" style={{ background: 'var(--color-gray-50)' }}>
      <LineChart
        labels={labels}
        height={80}
        showAxis={false}
        series={[
          { values: ideal, color: 'var(--color-gray-300)' },
          { values: actual, color: goal && (goal as { color?: string }).color ? ((goal as { color?: string }).color as string) : 'var(--color-primary)' },
        ]}
      />
    </div>
  );
}
