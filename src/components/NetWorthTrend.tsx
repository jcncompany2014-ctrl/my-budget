'use client';

import { useMemo } from 'react';
import { daysUntilKey, todayKey } from '@/lib/dates';
import { fmt } from '@/lib/format';
import { netWorthSeries, useNetWorthHistory } from '@/lib/net-worth-history';
import type { Scope } from '@/lib/types';

const W = 320;
const H = 44;

/**
 * Net worth over the last 90 days as a sparkline, with the change since the
 * oldest day in view. Renders nothing until there is an earlier day to compare
 * with. The line ends at `current` (the live figure), not at today's stored
 * value, so it always agrees with the headline number above it.
 */
export default function NetWorthTrend({ scope, current }: { scope: Scope; current: number }) {
  const { value: history } = useNetWorthHistory();
  const today = todayKey();
  const past = useMemo(
    () => netWorthSeries(history, scope, 90).filter((p) => p.day < today),
    [history, scope, today],
  );
  if (past.length === 0) return null;

  const values = [...past.map((p) => p.value), Math.round(current)];
  const delta = values[values.length - 1] - values[0];
  const min = Math.min(...values);
  const span = Math.max(...values) - min || 1;
  const x = (i: number) => (i / (values.length - 1)) * W;
  const y = (v: number) => H - 4 - ((v - min) / span) * (H - 8);
  const line = values
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`)
    .join(' ');
  const up = delta >= 0;
  const color = up ? 'var(--color-primary)' : 'var(--color-danger)';
  const days = -daysUntilKey(past[0].day);

  return (
    <div className="mt-2">
      <p className="tnum" style={{ color, fontSize: 'var(--text-xs)', fontWeight: 700 }}>
        {days}일 전보다 {up ? '+' : '−'}
        {fmt(delta)}원
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-1 block w-full"
        style={{ height: H }}
        aria-hidden="true"
      >
        <path d={`${line} L${W},${H} L0,${H} Z`} fill={color} opacity={0.08} />
        <path
          d={line}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
