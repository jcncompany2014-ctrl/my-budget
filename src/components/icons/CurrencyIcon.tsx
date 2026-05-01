import type { CSSProperties } from 'react';

/**
 * Currency-symbol icon — stock/fiat investments display the currency they
 * trade in (USD/JPY/KRW/EUR/CNY/HKD) on a flag-tinted background.
 *
 * Used for stock/fund investments where the issuer is more meaningful as
 * "this is a US stock" than as the company logo (which we don't try to
 * draw — that'd require thousands of brand SVGs).
 */

type CurrencyMeta = {
  bg: string;
  fg?: string;
  symbol: string;
  /** Optional subtle accent stripe (flag-inspired). */
  accent?: { color: string; height: number };
};

const META: Record<string, CurrencyMeta> = {
  USD: { bg: '#0E7C42', symbol: '$' }, // greenback
  KRW: { bg: '#1B64DA', symbol: '₩' }, // KOSPI blue
  JPY: { bg: '#BC002D', symbol: '¥' }, // Japan red
  EUR: { bg: '#003399', symbol: '€' }, // EU blue
  CNY: { bg: '#DE2910', symbol: '¥' }, // China red
  HKD: { bg: '#DE2910', symbol: 'HK$' }, // HK red
  GBP: { bg: '#012169', symbol: '£' },
};

export default function CurrencyIcon({
  currency,
  size = 28,
  style,
}: {
  currency: string;
  size?: number;
  style?: CSSProperties;
}) {
  const key = currency.trim().toUpperCase();
  const meta = META[key];

  if (!meta) {
    return (
      <div
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: '#94A3B8',
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: size * 0.32,
          fontWeight: 800,
          flexShrink: 0,
          ...style,
        }}
      >
        {key.slice(0, 3)}
      </div>
    );
  }

  // Wider symbol (e.g. "HK$") needs smaller font
  const fontSize =
    meta.symbol.length === 1 ? size * 0.55 : meta.symbol.length === 2 ? size * 0.4 : size * 0.32;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: meta.bg,
        color: meta.fg ?? 'white',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
        fontSize,
        fontWeight: 900,
        letterSpacing: meta.symbol.length === 1 ? '0' : '-0.04em',
        lineHeight: 1,
        flexShrink: 0,
        ...style,
      }}
    >
      {meta.symbol}
    </div>
  );
}
