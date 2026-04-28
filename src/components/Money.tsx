'use client';

import { fmt } from '@/lib/format';

type Sign = 'auto' | 'never' | 'always' | 'positive' | 'negative';

type Props = {
  value: number;
  sign?: Sign;
  unit?: string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Renders a currency amount with consistent typography:
 * - Always tabular-nums
 * - Always right-aligned in flex/grid contexts
 * - Sign formatting controlled explicitly
 */
export default function Money({
  value,
  sign = 'auto',
  unit = '원',
  className = '',
  style,
}: Props) {
  const abs = Math.abs(value);
  const num = fmt(abs);

  let prefix = '';
  if (sign === 'always') prefix = value >= 0 ? '+' : '−';
  else if (sign === 'positive') prefix = '+';
  else if (sign === 'negative') prefix = '−';
  else if (sign === 'auto') prefix = value < 0 ? '−' : '';

  return (
    <span className={`tnum ${className}`} style={{ whiteSpace: 'nowrap', ...style }}>
      {prefix}
      {num}
      {unit ? <span style={{ marginLeft: 1, opacity: 0.85 }}>{unit}</span> : null}
    </span>
  );
}
