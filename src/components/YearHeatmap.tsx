'use client';

import { useMemo } from 'react';

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

export default function YearHeatmap({
  daySpend,
  endDate = new Date(),
  cellSize = 11,
  gap = 2,
}: Props) {
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
    const max = Math.max(...days.map((d) => d.spend), 1);
    return { days, max, start };
  }, [daySpend, endDate]);

  // Group days into weeks (columns)
  const columns = useMemo(() => {
    const cols: { date: Date; key: string; spend: number }[][] = [];
    for (let i = 0; i < data.days.length; i += 7) {
      cols.push(data.days.slice(i, i + 7));
    }
    return cols;
  }, [data]);

  const colWidth = cellSize + gap;
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
    <div className="relative" style={{ height: cellSize * 7 + gap * 6 + 22 }}>
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
        height={cellSize * 7 + gap * 6}
        style={{ position: 'absolute', top: 14, left: 12, display: 'block' }}
      >
        {columns.map((col, ci) =>
          col.map((d, ri) => {
            const intensity = d.spend / data.max;
            const fill =
              d.spend === 0
                ? 'var(--color-gray-100)'
                : `color-mix(in oklab, var(--color-primary) ${Math.round(intensity * 80) + 12}%, var(--color-gray-100))`;
            return (
              <rect
                key={`${ci}-${ri}`}
                x={ci * colWidth}
                y={ri * (cellSize + gap)}
                width={cellSize}
                height={cellSize}
                rx={2}
                fill={fill}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}
