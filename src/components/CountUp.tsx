'use client';

type Props = {
  value: number;
  duration?: number;
  format: (n: number) => string;
  className?: string;
  style?: React.CSSProperties;
};

/**
 * Instant-render number (no animation) — animation removed for snappier mobile feel.
 * Kept the same API so consumers don't need to change.
 */
export default function CountUp({ value, format, className, style }: Props) {
  return (
    <span className={`tnum ${className ?? ''}`} style={style}>
      {format(value)}
    </span>
  );
}
