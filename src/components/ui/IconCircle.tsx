import type { CSSProperties, ReactNode } from 'react';

type Props = {
  children: ReactNode;
  size?: 28 | 32 | 36 | 40 | 44 | 48 | 52 | 56;
  background?: string;
  color?: string;
  fontSize?: string | number;
  style?: CSSProperties;
  className?: string;
};

/**
 * Standardized circular icon container.
 * - Forces line-height: 1 so emoji/glyphs are vertically centered
 * - Forces flex centering both axes
 * - Forces square aspect ratio
 * - shrink-0 prevents flex parent from squishing
 */
export default function IconCircle({
  children,
  size = 40,
  background,
  color,
  fontSize,
  style,
  className = '',
}: Props) {
  const inferredFontSize = fontSize ?? Math.round(size * 0.5);
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${className}`}
      style={{
        width: size,
        height: size,
        background,
        color,
        lineHeight: 1,
        fontSize: inferredFontSize,
        fontVariantEmoji: 'emoji',
        ...style,
      }}
    >
      {children}
    </span>
  );
}
