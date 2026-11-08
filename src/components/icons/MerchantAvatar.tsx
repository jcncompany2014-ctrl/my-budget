import type { CSSProperties } from 'react';
import { findBrand } from '@/lib/brands';
import BrandIcon from './BrandIcon';
import CategoryIcon from './CategoryIcon';

/**
 * Avatar for a merchant: its brand mark when it's a known franchise,
 * otherwise the category icon. With `badge`, a brand mark gets a small
 * category chip in the corner so the category stays visible at a glance.
 */
export default function MerchantAvatar({
  merchant,
  catId,
  size = 40,
  badge = false,
  style,
}: {
  merchant: string;
  catId: string;
  size?: number;
  badge?: boolean;
  style?: CSSProperties;
}) {
  const brand = findBrand(merchant);
  if (!brand) return <CategoryIcon catId={catId} size={size} style={style} />;
  if (!badge) return <BrandIcon brand={brand} size={size} style={style} />;

  const chip = Math.max(14, Math.round(size * 0.42));
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      <BrandIcon brand={brand} size={size} />
      <span
        aria-hidden
        style={{
          position: 'absolute',
          right: -3,
          bottom: -3,
          display: 'inline-flex',
          borderRadius: '50%',
          background: 'var(--color-card)',
          padding: 1.5,
        }}
      >
        <CategoryIcon catId={catId} size={chip} />
      </span>
    </span>
  );
}
