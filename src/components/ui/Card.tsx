import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  padding?: 0 | 12 | 16 | 20 | 24;
  radius?: 12 | 16 | 20 | 24;
  elevation?: 'flat' | 'sm' | 'md';
  background?: string;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
  href?: string;
};

/**
 * Standardized card container.
 * - Padding/radius limited to design tokens
 * - Elevation tiers via shadow tokens
 */
export default function Card({
  children,
  padding = 20,
  radius = 16,
  elevation = 'flat',
  background,
  className = '',
  style,
  onClick,
}: Props) {
  const shadow =
    elevation === 'md'
      ? '0 4px 12px rgba(0,0,0,0.06), 0 12px 32px rgba(17,24,39,0.06)'
      : elevation === 'sm'
        ? '0 1px 2px rgba(0,0,0,0.04), 0 4px 12px rgba(17,24,39,0.04)'
        : 'none';
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={`${onClick ? 'tap text-left' : ''} ${className}`}
      style={{
        padding,
        borderRadius: radius,
        background: background ?? 'var(--color-card)',
        boxShadow: shadow,
        width: '100%',
        ...style,
      }}
    >
      {children}
    </Component>
  );
}
