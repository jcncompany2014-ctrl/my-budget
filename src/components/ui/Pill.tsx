import type { ReactNode } from 'react';

type Tone = 'primary' | 'danger' | 'warn' | 'neutral' | 'dark';
type Size = 'sm' | 'md';

type Props = {
  children: ReactNode;
  tone?: Tone;
  active?: boolean;
  size?: Size;
  onClick?: () => void;
  className?: string;
};

const sizing: Record<Size, { px: number; py: number; fz: string }> = {
  sm: { px: 10, py: 4, fz: 'var(--text-xxs)' },
  md: { px: 12, py: 6, fz: 'var(--text-xs)' },
};

export default function Pill({ children, tone = 'neutral', active, size = 'md', onClick, className = '' }: Props) {
  const s = sizing[size];
  const colors = pillColors(tone, active);
  const Component = onClick ? 'button' : 'span';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full ${onClick ? 'tap' : ''} ${className}`}
      style={{
        paddingLeft: s.px,
        paddingRight: s.px,
        paddingTop: s.py,
        paddingBottom: s.py,
        fontSize: s.fz,
        fontWeight: 700,
        background: colors.bg,
        color: colors.fg,
        border: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </Component>
  );
}

function pillColors(tone: Tone, active?: boolean) {
  if (active) {
    if (tone === 'dark') return { bg: 'var(--color-text-1)', fg: 'var(--color-card)' };
    if (tone === 'primary') return { bg: 'var(--color-primary)', fg: '#fff' };
    if (tone === 'danger') return { bg: 'var(--color-danger)', fg: '#fff' };
    if (tone === 'warn') return { bg: '#B45309', fg: '#fff' };
    return { bg: 'var(--color-text-1)', fg: 'var(--color-card)' };
  }
  switch (tone) {
    case 'primary':
      return { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary)' };
    case 'danger':
      return { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)' };
    case 'warn':
      return { bg: '#FFF6E5', fg: '#B45309' };
    case 'dark':
      return { bg: 'var(--color-gray-100)', fg: 'var(--color-text-1)' };
    case 'neutral':
    default:
      return { bg: 'var(--color-gray-100)', fg: 'var(--color-text-2)' };
  }
}
