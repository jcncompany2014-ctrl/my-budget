import type { CSSProperties } from 'react';

/**
 * Brand-styled crypto icons. Each ticker maps to its official brand color
 * + a simplified SVG mark on a circular background. Falls back to a 3-letter
 * monogram when the ticker isn't in the catalog.
 *
 * Marks are simplified (single-path white shapes) so they render crisply
 * at any size and stay legible at 24-32px home/list usage.
 */

type CoinMeta = {
  bg: string;
  /** Inline SVG fragment, white-filled, for use inside a 32×32 viewBox. */
  mark: React.ReactNode;
};

const COINS: Record<string, CoinMeta> = {
  BTC: {
    bg: '#F7931A',
    mark: (
      <text
        x="16" y="22.5"
        textAnchor="middle"
        fontFamily='-apple-system, "SF Pro Display", system-ui, "Helvetica Neue", Arial, sans-serif'
        fontSize="22"
        fontWeight="900"
        fill="white"
      >
        ₿
      </text>
    ),
  },
  ETH: {
    bg: '#627EEA',
    mark: (
      <g fill="white">
        <path d="M16 4 L16 12.7 L23.5 16 Z" opacity="0.9" />
        <path d="M16 4 L8.5 16 L16 12.7 Z" opacity="0.6" />
        <path d="M16 21.7 L16 28 L23.5 17.5 Z" opacity="0.9" />
        <path d="M16 28 L16 21.7 L8.5 17.5 Z" opacity="0.6" />
        <path d="M16 19.5 L23.5 16 L16 12.7 Z" opacity="1" />
        <path d="M8.5 16 L16 19.5 L16 12.7 Z" opacity="0.7" />
      </g>
    ),
  },
  USDT: {
    bg: '#26A17B',
    mark: (
      <g fill="white">
        <path d="M9 9.5 h14 v3 h-5.5 v2.2 c3.5 .2 6 .9 6 1.7 c0 .9 -2.5 1.6 -6 1.7 v6.4 h-3 V18.1 c-3.5 -.1 -6 -.8 -6 -1.7 c0 -.8 2.5 -1.5 6 -1.7 V12.5 H9 V9.5 z M16 17.2 c2.7 -.1 4.7 -.5 4.7 -.9 c0 -.4 -2 -.8 -4.7 -.9 c-2.7 .1 -4.7 .5 -4.7 .9 c0 .4 2 .8 4.7 .9 z" />
      </g>
    ),
  },
  USDC: {
    bg: '#2775CA',
    mark: (
      <text x="16" y="22" textAnchor="middle" fontFamily="system-ui" fontSize="20" fontWeight="900" fill="white">$</text>
    ),
  },
  BNB: {
    bg: '#F0B90B',
    mark: (
      <g fill="white">
        <path d="M16 6 L19 9 L16 12 L13 9 Z" />
        <path d="M16 20 L19 23 L16 26 L13 23 Z" />
        <path d="M9 13 L12 16 L9 19 L6 16 Z" />
        <path d="M23 13 L26 16 L23 19 L20 16 Z" />
        <path d="M16 13 L19 16 L16 19 L13 16 Z" />
      </g>
    ),
  },
  SOL: {
    bg: '#000000',
    mark: (
      <g>
        <defs>
          <linearGradient id="sol-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#9945FF" />
            <stop offset="1" stopColor="#14F195" />
          </linearGradient>
        </defs>
        <path d="M9 11 L21.5 11 L23 13 L10.5 13 Z" fill="url(#sol-grad)" />
        <path d="M9 15 L21.5 15 L23 17 L10.5 17 Z" fill="url(#sol-grad)" />
        <path d="M9 19 L21.5 19 L23 21 L10.5 21 Z" fill="url(#sol-grad)" />
      </g>
    ),
  },
  XRP: {
    bg: '#23292F',
    mark: (
      <g fill="none" stroke="white" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 9 L16 16 L23 9" />
        <path d="M9 23 L16 16 L23 23" />
      </g>
    ),
  },
  DOGE: {
    bg: '#C2A633',
    mark: (
      <text x="16" y="22.5" textAnchor="middle" fontFamily="Georgia, serif" fontSize="20" fontWeight="900" fontStyle="italic" fill="white">D</text>
    ),
  },
  ADA: {
    bg: '#0033AD',
    mark: (
      <g fill="white">
        <circle cx="16" cy="9" r="1.4" />
        <circle cx="16" cy="23" r="1.4" />
        <circle cx="9" cy="12" r="1.4" />
        <circle cx="23" cy="12" r="1.4" />
        <circle cx="9" cy="20" r="1.4" />
        <circle cx="23" cy="20" r="1.4" />
        <circle cx="11" cy="16" r="1.2" />
        <circle cx="21" cy="16" r="1.2" />
      </g>
    ),
  },
  MATIC: {
    bg: '#8247E5',
    mark: (
      <g fill="white">
        <path d="M11 11 L16 8 L21 11 L21 13.5 L17.5 11.5 L17.5 17 L21 19 L21 21 L16 24 L11 21 L11 18.5 L14.5 20.5 L14.5 15 L11 13 Z" />
      </g>
    ),
  },
  POL: {
    bg: '#8247E5',
    mark: (
      <g fill="white">
        <path d="M11 11 L16 8 L21 11 L21 13.5 L17.5 11.5 L17.5 17 L21 19 L21 21 L16 24 L11 21 L11 18.5 L14.5 20.5 L14.5 15 L11 13 Z" />
      </g>
    ),
  },
  AVAX: {
    bg: '#E84142',
    mark: (
      <g fill="white">
        <path d="M16 7 L25 23 L19 23 L17 19.5 L15 23 L7 23 Z" />
      </g>
    ),
  },
  DOT: {
    bg: '#E6007A',
    mark: (
      <g fill="white">
        <ellipse cx="16" cy="8" rx="3" ry="1.6" />
        <ellipse cx="16" cy="24" rx="3" ry="1.6" />
        <ellipse cx="9" cy="12" rx="3" ry="1.6" transform="rotate(-60 9 12)" />
        <ellipse cx="23" cy="12" rx="3" ry="1.6" transform="rotate(60 23 12)" />
        <ellipse cx="9" cy="20" rx="3" ry="1.6" transform="rotate(60 9 20)" />
        <ellipse cx="23" cy="20" rx="3" ry="1.6" transform="rotate(-60 23 20)" />
      </g>
    ),
  },
  LINK: {
    bg: '#2A5ADA',
    mark: (
      <g fill="white">
        <path d="M16 6 L25 11 L25 21 L16 26 L7 21 L7 11 Z M16 11 L11 14 L11 18 L16 21 L21 18 L21 14 Z" />
      </g>
    ),
  },
  LTC: {
    bg: '#345D9D',
    mark: (
      <g fill="white">
        <path d="M14 8 L17 8 L15 17 L20 16 L19.5 19 L14.5 20 L13.5 24 L23 24 L22.5 27 L9 27 L11 19 L8.5 19.5 L9 17 L11.5 16.5 Z" />
      </g>
    ),
  },
  TRX: {
    bg: '#FF060A',
    mark: (
      <g fill="white">
        <path d="M7 9 L25 13 L18 25 L7 9 z M10 11 L17 21.5 L21 14 L10 11 Z" />
      </g>
    ),
  },
  SHIB: {
    bg: '#FFA409',
    mark: (
      <text x="16" y="22" textAnchor="middle" fontFamily="system-ui" fontSize="13" fontWeight="900" fill="white">SHIB</text>
    ),
  },
  ATOM: {
    bg: '#2E3148',
    mark: (
      <g fill="none" stroke="white" strokeWidth="1.5">
        <ellipse cx="16" cy="16" rx="9" ry="3.5" />
        <ellipse cx="16" cy="16" rx="9" ry="3.5" transform="rotate(60 16 16)" />
        <ellipse cx="16" cy="16" rx="9" ry="3.5" transform="rotate(120 16 16)" />
        <circle cx="16" cy="16" r="1.6" fill="white" />
      </g>
    ),
  },
};

export default function CryptoIcon({
  symbol,
  size = 28,
  style,
}: {
  symbol: string;
  size?: number;
  style?: CSSProperties;
}) {
  const key = symbol.trim().toUpperCase();
  const meta = COINS[key];

  if (!meta) {
    // Fallback: monogram circle
    const initials = key.slice(0, 3);
    const hue = hashHue(key);
    return (
      <div
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: `hsl(${hue}, 70%, 45%)`,
          color: 'white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, system-ui, sans-serif',
          fontSize: size * (initials.length === 3 ? 0.34 : 0.42),
          fontWeight: 800,
          letterSpacing: '-0.02em',
          flexShrink: 0,
          ...style,
        }}
      >
        {initials}
      </div>
    );
  }

  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: meta.bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      <svg
        viewBox="0 0 32 32"
        width={size}
        height={size}
        style={{ display: 'block' }}
      >
        {meta.mark}
      </svg>
    </div>
  );
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}
