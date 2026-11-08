'use client';

import { useId } from 'react';

/**
 * Cumulative spending pace — this month (solid, filled) vs last month
 * (muted line) on a shared day-of-month axis. Copilot-Money-style.
 * The this-month line stops at today with a marker dot.
 */
export default function PaceChart({
  thisCum,
  lastCum,
  daysThis,
  height = 132,
}: {
  thisCum: number[];
  lastCum: number[];
  daysThis: number;
  height?: number;
}) {
  const gradId = useId();
  const width = 320;
  const padX = 6;
  const padTop = 10;
  const padBottom = 18;
  const days = Math.max(daysThis, lastCum.length, 2);
  const W = width - padX * 2;
  const H = height - padTop - padBottom;
  const max = Math.max(1, ...thisCum, ...lastCum);
  const xAt = (i: number) => padX + (i / (days - 1)) * W;
  const yAt = (v: number) => padTop + H - (v / max) * H;
  const toPath = (arr: number[]) =>
    arr.map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(' ');

  const todayIdx = thisCum.length - 1;
  const thisPath = toPath(thisCum);
  const area =
    thisCum.length > 1
      ? `${thisPath} L${xAt(todayIdx).toFixed(1)},${padTop + H} L${xAt(0).toFixed(1)},${padTop + H} Z`
      : '';
  const baseY = padTop + H;
  const todayX = todayIdx >= 0 ? xAt(todayIdx) : 0;

  // Axis labels — skip edge labels that would collide with the "today" label
  const showStart = todayIdx > 3;
  const showEnd = todayIdx < days - 4;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      height={height}
      style={{ display: 'block' }}
      role="img"
      aria-label="이번 달과 지난 달 누적 지출 비교"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.22} />
          <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
        </linearGradient>
      </defs>

      <line x1={padX} x2={width - padX} y1={baseY} y2={baseY} stroke="var(--color-divider)" />

      {lastCum.length > 1 && (
        <path
          d={toPath(lastCum)}
          fill="none"
          stroke="var(--color-gray-300)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {area && <path d={area} fill={`url(#${gradId})`} />}
      {thisCum.length > 1 && (
        <path
          d={thisPath}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={2.6}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      )}

      {todayIdx >= 0 && (
        <>
          <line
            x1={todayX}
            x2={todayX}
            y1={padTop}
            y2={baseY}
            stroke="var(--color-primary)"
            strokeWidth={1}
            strokeDasharray="2 3"
            opacity={0.35}
          />
          <circle
            cx={todayX}
            cy={yAt(thisCum[todayIdx])}
            r={4.5}
            fill="var(--color-primary)"
            stroke="var(--color-card)"
            strokeWidth={2}
          />
        </>
      )}

      {showStart && (
        <text x={xAt(0)} y={height - 3} fontSize={9} fill="var(--color-text-3)" fontWeight={600}>
          1일
        </text>
      )}
      {todayIdx >= 0 && (
        <text
          x={todayX}
          y={height - 3}
          fontSize={9}
          textAnchor={todayIdx < 2 ? 'start' : todayIdx > days - 3 ? 'end' : 'middle'}
          fill="var(--color-primary)"
          fontWeight={800}
        >
          오늘
        </text>
      )}
      {showEnd && (
        <text
          x={xAt(days - 1)}
          y={height - 3}
          fontSize={9}
          textAnchor="end"
          fill="var(--color-text-3)"
          fontWeight={600}
        >
          {days}일
        </text>
      )}
    </svg>
  );
}
