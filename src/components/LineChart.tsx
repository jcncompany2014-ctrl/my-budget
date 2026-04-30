'use client';

import { useState } from 'react';
import { fmt } from '@/lib/format';

type Series = {
  label?: string;
  values: number[];
  color: string;
};

type Props = {
  series: Series[];
  labels: string[];
  height?: number;
  showAxis?: boolean;
};

export default function LineChart({ series, labels, height = 140, showAxis = true }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (series.length === 0 || labels.length === 0) return null;
  const allValues = series.flatMap((s) => s.values);
  const max = Math.max(...allValues, 1);
  const min = Math.min(...allValues, 0);
  const range = max - min || 1;
  const width = 320;
  const padX = 24;
  const padY = 14;
  const W = width - padX * 2;
  const H = height - padY * 2;

  const xAt = (i: number) => padX + (i / Math.max(labels.length - 1, 1)) * W;
  const yAt = (v: number) => padY + H - ((v - min) / range) * H;

  const onPointerMove = (clientX: number, rect: DOMRect) => {
    const x = ((clientX - rect.left) / rect.width) * width;
    const idx = Math.round(((x - padX) / W) * (labels.length - 1));
    setHovered(Math.max(0, Math.min(labels.length - 1, idx)));
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        style={{ display: 'block', touchAction: 'none' }}
        onMouseLeave={() => setHovered(null)}
        onMouseMove={(e) => onPointerMove(e.clientX, e.currentTarget.getBoundingClientRect())}
        onTouchStart={(e) => onPointerMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onTouchMove={(e) => onPointerMove(e.touches[0].clientX, e.currentTarget.getBoundingClientRect())}
        onTouchEnd={() => setTimeout(() => setHovered(null), 1500)}
      >
        {showAxis && (
          <>
            <line x1={padX} y1={padY} x2={padX} y2={height - padY} stroke="var(--color-divider)" strokeWidth={1} />
            <line
              x1={padX}
              y1={height - padY}
              x2={width - padX}
              y2={height - padY}
              stroke="var(--color-divider)"
              strokeWidth={1}
            />
          </>
        )}
        {series.map((s, si) => {
          const points = s.values.map((v, i) => [xAt(i), yAt(v)] as const);
          const path = points.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
          const area = `${path} L${padX + W},${height - padY} L${padX},${height - padY} Z`;
          return (
            <g key={si}>
              <path d={area} fill={s.color} opacity={0.12} />
              <path
                d={path}
                fill="none"
                stroke={s.color}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
              {points.map(([x, y], i) => (
                <circle
                  key={i}
                  cx={x}
                  cy={y}
                  r={hovered === i ? 5 : 3}
                  fill={hovered === i ? s.color : '#fff'}
                  stroke={s.color}
                  strokeWidth={hovered === i ? 2 : 1.6}
                />
              ))}
            </g>
          );
        })}
        {hovered !== null && (
          <line
            x1={xAt(hovered)}
            x2={xAt(hovered)}
            y1={padY}
            y2={height - padY}
            stroke="var(--color-text-3)"
            strokeWidth={1}
            strokeDasharray="3 3"
            opacity={0.5}
          />
        )}
        {labels.map((l, i) => (
          <text
            key={i}
            x={xAt(i)}
            y={height - 2}
            textAnchor="middle"
            fontSize={9}
            fill={hovered === i ? 'var(--color-text-1)' : 'var(--color-text-3)'}
            fontWeight={hovered === i ? 700 : 500}
          >
            {l}
          </text>
        ))}
      </svg>

      {hovered !== null && (() => {
        // Position tooltip above the hovered x-position, but clamp inside container
        const xPct = (xAt(hovered) / width) * 100;
        const left = `clamp(8px, calc(${xPct}% - 60px), calc(100% - 128px))`;
        return (
          <div
            style={{
              position: 'absolute',
              top: 0,
              left,
              pointerEvents: 'none',
              animation: 'fade-in 140ms var(--ease-out)',
            }}
          >
            <div
              className="rounded-xl px-3 py-2"
              style={{
                background: 'var(--color-text-1)',
                color: 'var(--color-card)',
                fontSize: 11,
                fontWeight: 700,
                boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                minWidth: 110,
              }}
            >
              <p style={{ opacity: 0.65, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}>
                {labels[hovered]}
              </p>
              <div className="mt-1 flex flex-col gap-0.5">
                {series.map((s, si) => (
                  <div key={si} className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5">
                      <span style={{
                        display: 'inline-block', width: 6, height: 6, borderRadius: 3,
                        background: s.color,
                      }} />
                      {s.label && (
                        <span style={{ opacity: 0.85, fontSize: 10, fontWeight: 600 }}>
                          {s.label}
                        </span>
                      )}
                    </div>
                    <span className="tnum" style={{ color: s.color, fontSize: 12, fontWeight: 800 }}>
                      {fmt(s.values[hovered])}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
