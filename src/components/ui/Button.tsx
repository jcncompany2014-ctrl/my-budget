import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type Size = 'sm' | 'md' | 'lg';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
};

const sizeMap: Record<Size, { h: number; px: number; fz: string; r: string }> = {
  sm: { h: 36, px: 12, fz: 'var(--text-xs)', r: '10px' },
  md: { h: 48, px: 16, fz: 'var(--text-sm)', r: '12px' },
  lg: { h: 56, px: 20, fz: 'var(--text-base)', r: '16px' },
};

export default function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  leadingIcon,
  trailingIcon,
  children,
  disabled,
  style,
  className = '',
  ...rest
}: Props) {
  const s = sizeMap[size];
  const v = variantStyle(variant, !!disabled);

  return (
    <button
      {...rest}
      disabled={disabled}
      className={`tap inline-flex items-center justify-center gap-1.5 ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{
        height: s.h,
        paddingLeft: s.px,
        paddingRight: s.px,
        borderRadius: s.r,
        fontSize: s.fz,
        fontWeight: 700,
        background: v.bg,
        color: v.fg,
        border: v.border ?? 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {leadingIcon}
      {children}
      {trailingIcon}
    </button>
  );
}

function variantStyle(v: Variant, disabled: boolean) {
  if (disabled) {
    return {
      bg: 'var(--color-gray-200)',
      fg: 'var(--color-text-4)',
      border: undefined as string | undefined,
    };
  }
  switch (v) {
    case 'primary':
      return { bg: 'var(--color-primary)', fg: '#fff', border: undefined };
    case 'secondary':
      return { bg: 'var(--color-text-1)', fg: 'var(--color-card)', border: undefined };
    case 'soft':
      return { bg: 'var(--color-primary-soft)', fg: 'var(--color-primary)', border: undefined };
    case 'ghost':
      return { bg: 'var(--color-gray-100)', fg: 'var(--color-text-1)', border: undefined };
    case 'danger':
      return { bg: 'var(--color-danger-soft)', fg: 'var(--color-danger)', border: undefined };
  }
}
