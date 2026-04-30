'use client';

/**
 * Reusable date picker — 3 quick presets (오늘/어제/그제) + a 4th chip
 * that's a transparent native <input type="date"> overlay. The 4th
 * chip lights up + shows a smart label whenever a non-preset date is
 * selected. Used in /add and /tx/[id]/edit for consistency.
 */

import type { CSSProperties } from 'react';

export default function DatePickerSection({
  date,
  onChange,
  label = '날짜',
  /** Hide the section header label. */
  bare = false,
  /** Restrict picker to past dates only. */
  pastOnly = false,
  className,
  style,
}: {
  date: Date;
  onChange: (d: Date) => void;
  label?: string;
  bare?: boolean;
  pastOnly?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const twoDays = new Date(today); twoDays.setDate(today.getDate() - 2);

  const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  const dayKey = ymd(date);
  const isToday = dayKey === ymd(today);
  const isYesterday = dayKey === ymd(yesterday);
  const isTwoDays = dayKey === ymd(twoDays);
  const isCustom = !isToday && !isYesterday && !isTwoDays;

  const formatCustomLabel = () => {
    const now = new Date();
    const sameYear = date.getFullYear() === now.getFullYear();
    const opts: Intl.DateTimeFormatOptions = sameYear
      ? { month: 'long', day: 'numeric', weekday: 'short' }
      : { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('ko-KR', opts);
  };

  const presets: Array<{ label: string; sel: boolean; onClick: () => void }> = [
    { label: '오늘', sel: isToday, onClick: () => onChange(new Date()) },
    { label: '어제', sel: isYesterday, onClick: () => { const d = new Date(); d.setDate(d.getDate() - 1); onChange(d); } },
    { label: '그제', sel: isTwoDays, onClick: () => { const d = new Date(); d.setDate(d.getDate() - 2); onChange(d); } },
  ];

  const maxDate = pastOnly
    ? ymd(today)
    : ymd(new Date(today.getFullYear() + 5, today.getMonth(), today.getDate()));

  const inner = (
    <div className="flex gap-2">
      {presets.map((p) => (
        <button
          key={p.label}
          type="button"
          onClick={p.onClick}
          className="tap flex-1 rounded-xl py-2.5"
          style={{
            background: p.sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
            color: p.sel ? '#fff' : 'var(--color-text-2)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
          }}
        >
          {p.label}
        </button>
      ))}
      <label
        className="tap relative flex flex-1 cursor-pointer items-center justify-center rounded-xl py-2.5"
        style={{
          background: isCustom ? 'var(--color-primary)' : 'var(--color-gray-100)',
          color: isCustom ? '#fff' : 'var(--color-text-2)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
        }}
      >
        {isCustom ? formatCustomLabel() : '직접 선택'}
        <input
          type="date"
          value={dayKey}
          max={maxDate}
          onChange={(e) => {
            const v = e.target.value;
            if (!v) return;
            const [y, m, d] = v.split('-').map(Number);
            if (!y || !m || !d) return;
            const next = new Date(y, m - 1, d);
            // preserve current time so transactions logged on past dates
            // sort below same-day current entries
            const now = new Date();
            next.setHours(now.getHours(), now.getMinutes(), now.getSeconds());
            onChange(next);
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
          style={{ width: '100%', height: '100%' }}
          aria-label="날짜 직접 선택"
        />
      </label>
    </div>
  );

  if (bare) return <div className={className} style={style}>{inner}</div>;

  return (
    <section className={`px-4 pb-3 ${className ?? ''}`} style={style}>
      <label className="mb-2.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
        {label}
      </label>
      {inner}
    </section>
  );
}
