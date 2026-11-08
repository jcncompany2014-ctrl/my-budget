import type { CSSProperties } from 'react';
import type { Brand } from '@/lib/brands';
import { BRAND_GLYPHS } from './brand-glyphs';

/**
 * Round merchant brand mark — the real logo glyph when we have one, otherwise
 * the brand's colors with a short wordmark (same language as BankIcon).
 */

// Approximate advance width per character (in em) of a heavy sans, for
// fitting wordmarks — M/W are the wide outliers that clipped "MGC".
function labelEms(label: string): number {
  let ems = 0;
  for (const ch of label) {
    if (/[가-힣]/.test(ch)) ems += 1;
    else if (/[MW]/.test(ch)) ems += 0.86;
    else if (/[A-Z]/.test(ch)) ems += 0.7;
    else if (/[0-9]/.test(ch)) ems += 0.62;
    else if (/[mw]/.test(ch)) ems += 0.8;
    else ems += 0.56;
  }
  return Math.max(ems, 1);
}

export default function BrandIcon({
  brand,
  size = 40,
  style,
}: {
  brand: Brand;
  size?: number;
  style?: CSSProperties;
}) {
  const base: CSSProperties = {
    width: size,
    height: size,
    borderRadius: '50%',
    background: brand.bg,
    color: brand.fg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    overflow: 'hidden',
    boxShadow: brand.ring ? 'inset 0 0 0 1px rgba(20, 28, 40, 0.1)' : undefined,
    ...style,
  };

  if (brand.glyph) {
    const g = size * (brand.glyphScale ?? 0.56);
    return (
      <div role="img" aria-label={brand.name} style={base}>
        <svg viewBox="0 0 24 24" width={g} height={g} fill="currentColor" aria-hidden>
          <path d={BRAND_GLYPHS[brand.glyph]} />
        </svg>
      </div>
    );
  }

  const label = brand.label ?? brand.name.slice(0, 2);
  const hangul = /[가-힣]/.test(label);
  // Fit the wordmark inside the circle with a little air (Hangul glyph boxes
  // carry their own side bearing, so they get a bit more width), capped so
  // 1–2 character marks ("7", "CU") don't balloon.
  const fontSize = Math.min(size * 0.46, (size * (hangul ? 0.7 : 0.66)) / labelEms(label));
  return (
    <div
      role="img"
      aria-label={brand.name}
      style={{
        ...base,
        fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
        fontSize,
        fontWeight: 900,
        letterSpacing: hangul ? '-0.06em' : '-0.03em',
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
}
