import { Briefcase } from 'lucide-react';
import type { CSSProperties } from 'react';
import type { Investment } from '@/lib/types';
import CryptoIcon from './CryptoIcon';
import CurrencyIcon from './CurrencyIcon';

/**
 * Smart icon picker for an Investment.
 *
 *   crypto + ticker → CryptoIcon (BTC, ETH, ...)
 *   stock           → CurrencyIcon (USD/KRW/JPY ...) — represents the market
 *   fund / other    → generic briefcase
 */
export default function AssetIcon({
  investment,
  size = 40,
  style,
}: {
  investment: Pick<Investment, 'kind' | 'ticker' | 'currency' | 'color'>;
  size?: number;
  style?: CSSProperties;
}) {
  const { kind, ticker, currency, color } = investment;

  if (kind === 'crypto' && ticker) {
    return <CryptoIcon symbol={ticker} size={size} style={style} />;
  }

  if (kind === 'stock' && currency) {
    return <CurrencyIcon currency={currency} size={size} style={style} />;
  }

  // fund / other / no ticker
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: color || '#8B95A1',
        color: 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <Briefcase size={size * 0.5} strokeWidth={2.4} />
    </div>
  );
}
