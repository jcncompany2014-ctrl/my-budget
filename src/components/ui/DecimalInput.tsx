'use client';

import type { CSSProperties } from 'react';
import { useEffect, useState } from 'react';

type Props = {
  value: number;
  onChange: (n: number) => void;
  placeholder?: string;
  className?: string;
  style?: CSSProperties;
};

/**
 * Numeric input that lets the user type fractional values like "5.0" or "5."
 * without losing the trailing dot on re-render.
 *
 * The bug we're fixing: a controlled `<input type="number">` whose value is
 * derived from a parent `number` state can't keep an in-progress decimal
 * point. As soon as the user types "5.", the parent normalizes via
 * `Number(text)` → 5, the input re-renders showing "5", and the dot vanishes.
 *
 * Strategy: keep the raw text locally, parse to number for the parent, and
 * only resync local text when the parent value changes to something that
 * doesn't match the current parsed text (e.g. external reset to 0).
 */
export default function DecimalInput({
  value,
  onChange,
  placeholder = '0',
  className,
  style,
}: Props) {
  const [text, setText] = useState(() => (value ? String(value) : ''));

  useEffect(() => {
    const parsed = Number.parseFloat(text);
    const same = Number.isNaN(parsed) ? value === 0 : parsed === value;
    if (!same) {
      setText(value ? String(value) : '');
    }
    // We intentionally don't depend on `text` — that would rewrite while typing.
  }, [value]);

  return (
    <input
      type="text"
      inputMode="decimal"
      pattern="[0-9.]*"
      value={text}
      onChange={(e) => {
        const raw = e.target.value.replace(/[^0-9.]/g, '');
        // Collapse multiple dots — keep only the first
        const firstDot = raw.indexOf('.');
        const cleaned =
          firstDot === -1
            ? raw
            : raw.slice(0, firstDot + 1) + raw.slice(firstDot + 1).replace(/\./g, '');
        setText(cleaned);
        const n = Number.parseFloat(cleaned);
        onChange(Number.isFinite(n) ? n : 0);
      }}
      placeholder={placeholder}
      className={className}
      style={style}
    />
  );
}
