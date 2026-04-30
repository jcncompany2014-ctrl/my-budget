'use client';

import { useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';

type Slice = {
  /** Optional CATEGORIES id — when present, renders a proper CategoryIcon
   *  in the center; otherwise falls back to `emoji` string. */
  catId?: string;
  name: string;
  emoji?: string;
  color: string;
  value: number;
};

type Props = {
  data: Slice[];
  total: number;
  size?: number;
  thickness?: number;
};

export default function CategoryDonut({ data, total, size = 220, thickness = 28 }: Props) {
  const [active, setActive] = useState<number | null>(null);

  const radius = (size - thickness) / 2;
  const center = size / 2;
  const circumference = 2 * Math.PI * radius;

  let offset = 0;
  const segments = data.map((s, i) => {
    const fraction = total > 0 ? s.value / total : 0;
    const length = circumference * fraction;
    const seg = {
      ...s,
      length,
      gap: circumference - length,
      offset,
      fraction,
      index: i,
    };
    offset += length;
    return seg;
  });

  const activeSlice = active !== null ? segments[active] : null;
  const fmt = (n: number) => Intl.NumberFormat('ko-KR').format(Math.round(n));

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <defs>
          {/* Subtle inner glow that brightens when a slice is active */}
          <filter id="donut-glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" />
          </filter>
        </defs>

        {/* Track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--color-gray-150)"
          strokeWidth={thickness}
        />
        {segments.map((s) => {
          const isActive = active === s.index;
          return (
            <circle
              key={s.index}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={s.color}
              strokeWidth={isActive ? thickness + 6 : thickness}
              strokeDasharray={`${s.length} ${s.gap}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt"
              opacity={active !== null && !isActive ? 0.28 : 1}
              style={{
                cursor: 'pointer',
                transition: 'stroke-width 200ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease',
              }}
              onClick={() => setActive(active === s.index ? null : s.index)}
              onMouseEnter={() => setActive(s.index)}
              onMouseLeave={() => setActive((cur) => (cur === s.index ? null : cur))}
            />
          );
        })}
      </svg>

      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{ pointerEvents: 'none' }}
      >
        {activeSlice ? (
          <>
            {activeSlice.catId ? (
              <CategoryIcon
                catId={activeSlice.catId}
                size={36}
                style={{ marginBottom: 8 }}
              />
            ) : activeSlice.emoji ? (
              <p style={{ fontSize: 24, lineHeight: 1, marginBottom: 6 }}>{activeSlice.emoji}</p>
            ) : null}
            <p style={{
              color: 'var(--color-text-3)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.02em',
            }}>
              {activeSlice.name}
            </p>
            <p
              className="tnum mt-0.5 tracking-tight"
              style={{
                color: activeSlice.color,
                fontSize: 22, fontWeight: 900, letterSpacing: '-0.025em',
              }}
            >
              {fmt(activeSlice.value)}원
            </p>
            <p style={{
              color: 'var(--color-text-3)',
              fontSize: 11, fontWeight: 700, marginTop: 2,
            }}>
              {Math.round(activeSlice.fraction * 100)}%
            </p>
          </>
        ) : (
          <>
            <p style={{
              color: 'var(--color-text-3)',
              fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
            }}>
              이번 달 지출
            </p>
            <p
              className="tnum mt-1 tracking-tight"
              style={{
                color: 'var(--color-text-1)',
                fontSize: 26, fontWeight: 900, letterSpacing: '-0.03em',
              }}
            >
              {fmt(total)}
            </p>
            <p style={{
              color: 'var(--color-text-3)',
              fontSize: 11, fontWeight: 600, marginTop: -2,
            }}>
              원 · {data.length}개 카테고리
            </p>
          </>
        )}
      </div>
    </div>
  );
}
