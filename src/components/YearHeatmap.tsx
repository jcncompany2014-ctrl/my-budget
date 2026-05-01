'use client';

import { useMemo, useState } from 'react';

type Props = {
  /** Map of date (YYYY-MM-DD) → spend */
  daySpend: Map<string, number>;
  /** Reference date — heatmap shows the 364 days ending here. */
  endDate?: Date;
  cellSize?: number;
  gap?: number;
};

const WEEKDAY_LABELS = ['일', '', '화', '', '목', '', '토'];
const MONTH_LABELS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];

// 5 levels: L0=empty, L1..L4 = increasing spend bucket
const LEVEL_PCT = [0, 20, 40, 65, 95] as const;
const levelColor = (level: 0 | 1 | 2 | 3 | 4): string =>
  level === 0
    ? 'var(--color-gray-100)'
    : `color-mix(in oklab, var(--color-primary) ${LEVEL_PCT[level]}%, var(--color-gray-100))`;

export default function YearHeatmap({
  daySpend,
  endDate = new Date(),
  cellSize = 11,
  gap = 2,
}: Props) {
  const [hover, setHover] = useState<{
    ci: number;
    ri: number;
    date: Date;
    spend: number;
  } | null>(null);

  const data = useMemo(() => {
    const end = new Date(endDate);
    end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(end.getDate() - 364);
    // Pad start back to Sunday
    const startDow = start.getDay();
    start.setDate(start.getDate() - startDow);

    const days: { date: Date; key: string; spend: number }[] = [];
    const cursor = new Date(start);
    while (cursor <= end) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({
        date: new Date(cursor),
        key,
        spend: daySpend.get(key) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    // Quartile thresholds from active days only — robust to outliers.
    // A single huge transaction no longer flattens the rest of the year to
    // one shade because thresholds are based on rank, not the maximum.
    const active = days
      .map((d) => d.spend)
      .filter((s) => s > 0)
      .sort((a, b) => a - b);
    const q = (p: number) =>
      active.length === 0 ? 0 : active[Math.min(active.length - 1, Math.floor(active.length * p))];
    return { days, start, t1: q(0.25), t2: q(0.5), t3: q(0.75) };
  }, [daySpend, endDate]);

  const levelOf = (spend: number): 0 | 1 | 2 | 3 | 4 => {
    if (spend === 0) return 0;
    if (spend <= data.t1) return 1;
    if (spend <= data.t2) return 2;
    if (spend <= data.t3) return 3;
    return 4;
  };

  // Group days into weeks (columns)
  const columns = useMemo(() => {
    const cols: { date: Date; key: string; spend: number }[][] = [];
    for (let i = 0; i < data.days.length; i += 7) {
      cols.push(data.days.slice(i, i + 7));
    }
    return cols;
  }, [data]);

  const colWidth = cellSize + gap;
  const gridHeight = cellSize * 7 + gap * 6;
  const totalWidth = columns.length * colWidth + 14;

  const monthPositions = useMemo(() => {
    const out: { x: number; label: string }[] = [];
    let prevMonth = -1;
    columns.forEach((col, ci) => {
      const first = col[0]?.date;
      if (!first) return;
      const m = first.getMonth();
      if (m !== prevMonth && first.getDate() <= 7) {
        out.push({ x: ci * colWidth, label: MONTH_LABELS[m] });
        prevMonth = m;
      }
    });
    return out;
  }, [columns, colWidth]);

  return (
    <div style={{ width: totalWidth }}>
      <div className="relative" style={{ height: gridHeight + 22 }}>
        {/* month labels */}
        {monthPositions.map((m, i) => (
          <span
            key={i}
            className="tnum"
            style={{
              position: 'absolute',
              left: m.x + 12,
              top: 0,
              fontSize: 9,
              color: 'var(--color-text-3)',
              fontWeight: 600,
            }}
          >
            {m.label}
          </span>
        ))}
        {/* weekday labels */}
        {WEEKDAY_LABELS.map((w, i) =>
          w ? (
            <span
              key={i}
              style={{
                position: 'absolute',
                left: 0,
                top: 14 + i * (cellSize + gap),
                fontSize: 9,
                color: 'var(--color-text-3)',
                width: 10,
                textAlign: 'left',
              }}
            >
              {w}
            </span>
          ) : null,
        )}
        {/* grid */}
        <svg
          width={columns.length * colWidth}
          height={gridHeight}
          style={{ position: 'absolute', top: 14, left: 12, display: 'block' }}
          onMouseLeave={() => setHover(null)}
        >
          {columns.map((col, ci) =>
            col.map((d, ri) => (
              <rect
                key={`${ci}-${ri}`}
                x={ci * colWidth}
                y={ri * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={levelColor(levelOf(d.spend))}
                onMouseEnter={() => setHover({ ci, ri, date: d.date, spend: d.spend })}
                onTouchStart={() => setHover({ ci, ri, date: d.date, spend: d.spend })}
                onTouchEnd={() => setTimeout(() => setHover(null), 1500)}
                style={{ cursor: 'pointer' }}
              />
            )),
          )}
        </svg>

        {/* tooltip */}
        {hover &&
          (() => {
            const cellLeft = hover.ci * colWidth + 12;
            const cellTop = hover.ri * (cellSize + gap) + 14;
            // Flip below cell when too close to the top label row
            const above = cellTop > 30;
            const top = above ? cellTop - 38 : cellTop + cellSize + 6;
            const cellCenter = cellLeft + cellSize / 2;
            const tooltipHalfWidth = 56;
            const left = Math.max(
              4,
              Math.min(totalWidth - tooltipHalfWidth * 2 - 4, cellCenter - tooltipHalfWidth),
            );
            const dateStr = `${hover.date.getMonth() + 1}월 ${hover.date.getDate()}일`;
            const valStr =
              hover.spend === 0 ? '거래 없음' : `${hover.spend.toLocaleString('ko-KR')}원`;
            return (
              <div
                style={{
                  position: 'absolute',
                  top,
                  left,
                  pointerEvents: 'none',
                  animation: 'fade-in 140ms var(--ease-out)',
                  zIndex: 1,
                }}
              >
                <div
                  className="rounded-xl px-3 py-2"
                  style={{
                    background: 'var(--color-text-1)',
                    color: 'var(--color-card)',
                    boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <p
                    style={{
                      opacity: 0.65,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                    }}
                  >
                    {dateStr}
                  </p>
                  <p className="tnum" style={{ fontSize: 12, fontWeight: 800, marginTop: 2 }}>
                    {valStr}
                  </p>
                </div>
              </div>
            );
          })()}
      </div>

      {/* Legend */}
      <div
        className="mt-2 flex items-center justify-end gap-1"
        style={{ fontSize: 10, color: 'var(--color-text-3)' }}
      >
        <span>적음</span>
        {([0, 1, 2, 3, 4] as const).map((l) => (
          <span
            key={l}
            style={{
              display: 'inline-block',
              width: cellSize,
              height: cellSize,
              borderRadius: 2,
              background: levelColor(l),
            }}
          />
        ))}
        <span>많음</span>
      </div>
    </div>
  );
}
