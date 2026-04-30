import type { CSSProperties } from 'react';

/**
 * Korean bank brand icon.
 *
 * Maps a (possibly fuzzy) bank name string to its official brand color +
 * a 1-2 char Korean monogram. Falls back to a hash-colored monogram for
 * unknown banks. Inspired by Toss/카카오뱅크 account-row aesthetics.
 *
 *   "KB국민은행" → 노란 원 + "KB"
 *   "신한"       → 파란 원 + "신한"
 *   "토스뱅크"   → 토스 파랑 + "토스"
 */

type BankMeta = {
  bg: string;
  fg?: string;
  label: string;
  /** Alternate match keys (lowercase, no spaces). */
  match: string[];
};

const BANKS: BankMeta[] = [
  { bg: '#FFCC00', fg: '#000', label: 'KB',   match: ['kb국민', 'kb', '국민', 'kookmin'] },
  { bg: '#0046FF', label: '신한', match: ['신한', 'shinhan'] },
  { bg: '#0090FF', label: '우리', match: ['우리', 'woori'] },
  { bg: '#00857F', label: '하나', match: ['하나', 'hana', 'keb'] },
  { bg: '#27AE60', label: '농협', match: ['농협', 'nh', 'nonghyup'] },
  { bg: '#0064B5', label: '기업', match: ['ibk', '기업'] },
  { bg: '#0166FF', label: 'K뱅', match: ['케이뱅크', 'kbank', '케뱅'] },
  { bg: '#FAE100', fg: '#000', label: '카뱅', match: ['카카오뱅크', '카카오', 'kakaobank', 'kakao'] },
  { bg: '#0064FF', label: '토스', match: ['토스뱅크', '토스', 'toss'] },
  { bg: '#E60013', label: '우체', match: ['우체국', 'epost', 'post'] },
  { bg: '#007D5B', label: 'SC',   match: ['sc제일', 'sc', '제일', 'standard'] },
  { bg: '#FF6633', label: '새마', match: ['새마을', '새마을금고', 'mg'] },
  { bg: '#0072BC', label: '수협', match: ['수협', 'suhyup'] },
  { bg: '#0078A8', label: '신협', match: ['신협', 'cu'] },
  { bg: '#B50000', label: 'DGB',  match: ['dgb', '대구은행', '대구', 'iM뱅크', 'im뱅크'] },
  { bg: '#035997', label: '부산', match: ['부산', 'busan', 'bnk'] },
  { bg: '#C8102E', label: '광주', match: ['광주', 'kjbank'] },
  { bg: '#008C44', label: '전북', match: ['전북', 'jbbank'] },
  { bg: '#003F69', label: '제주', match: ['제주', 'jeju'] },
  { bg: '#0033A0', label: 'CITI', match: ['씨티', 'citi'] },
  { bg: '#D71E28', label: 'HSBC', match: ['hsbc'] },
];

function findBank(name: string): BankMeta | null {
  const norm = name.trim().toLowerCase().replace(/\s+/g, '').replace(/은행|bank/gi, '');
  if (!norm) return null;
  for (const b of BANKS) {
    for (const key of b.match) {
      if (norm.includes(key.toLowerCase())) return b;
    }
  }
  return null;
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export default function BankIcon({
  name,
  size = 44,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  const meta = findBank(name);

  if (meta) {
    const fontSize =
      meta.label.length <= 2 ? size * 0.4 : meta.label.length === 3 ? size * 0.32 : size * 0.27;
    return (
      <div
        style={{
          width: size, height: size,
          borderRadius: '50%',
          background: meta.bg,
          color: meta.fg ?? '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          fontSize,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          flexShrink: 0,
          ...style,
        }}
      >
        {meta.label}
      </div>
    );
  }

  // Unknown bank → hash-color circle with first character
  const initial = (name.trim()[0] || '?').toUpperCase();
  const hue = hashHue(name);
  return (
    <div
      style={{
        width: size, height: size,
        borderRadius: '50%',
        background: `hsl(${hue}, 65%, 45%)`,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.42,
        fontWeight: 800,
        flexShrink: 0,
        ...style,
      }}
    >
      {initial}
    </div>
  );
}
