'use client';

import { useState } from 'react';

type Slice = {
  name: string;
  emoji: string;
  color: string;
  value: number;
};

type Props = {
  data: Slice[];
  total: number;
  size?: number;
  thickness?: number;
};

export default function CategoryDonut({ data, total, size = 200, thickness = 26 }: Props) {
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

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
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
              strokeWidth={isActive ? thickness + 4 : thickness}
              strokeDasharray={`${s.length} ${s.gap}`}
              strokeDashoffset={-s.offset}
              strokeLinecap="butt"
              opacity={active !== null && !isActive ? 0.35 : 1}
              style={{
                cursor: 'pointer',
                transition: 'stroke-width 120ms ease, opacity 120ms ease',
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
            <p style={{ fontSize: 22, lineHeight: 1, marginBottom: 4 }}>{activeSlice.emoji}</p>
            <p
              className="text-xs font-medium"
              style={{ color: 'var(--color-text-3)' }}
            >
              {activeSlice.name}
            </p>
            <p
              className="tnum mt-0.5 text-2xl font-extrabold tracking-tight"
              style={{ color: activeSlice.color }}
            >
              {Intl.NumberFormat('ko-KR').format(Math.round(activeSlice.value))}원
            </p>
            <p style={{ color: 'var(--color-text-3)', fontSize: 11, fontWeight: 600 }}>
              {Math.round(activeSlice.fraction * 100)}%
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
              이번 달 지출
            </p>
            <p
              className="tnum mt-0.5 text-2xl font-extrabold tracking-tight"
              style={{ color: 'var(--color-text-1)' }}
            >
              {Intl.NumberFormat('ko-KR').format(Math.round(total))}원
            </p>
          </>
        )}
      </div>
    </div>
  );
}
