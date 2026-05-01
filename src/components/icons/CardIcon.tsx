import type { CSSProperties } from 'react';

/**
 * Korean credit card brand icon — branded gradient rectangle (rounded
 * card-shaped) with the issuer's mark. Differs from BankIcon by being
 * card-shaped (subtle) rather than circular, and using brand gradients
 * where applicable (Hyundai Card, Samsung Card, etc.).
 */

type CardMeta = {
  bg: string;
  fg?: string;
  label: string;
  match: string[];
};

const CARDS: CardMeta[] = [
  { bg: 'linear-gradient(135deg,#0046FF,#001E90)', label: '신한', match: ['신한', 'shinhan'] },
  { bg: 'linear-gradient(135deg,#1428A0,#0A1860)', label: '삼성', match: ['삼성', 'samsung'] },
  { bg: 'linear-gradient(135deg,#1F1F1F,#000000)', label: '현대', match: ['현대', 'hyundai'] },
  { bg: 'linear-gradient(135deg,#ED1C24,#990F14)', label: '롯데', match: ['롯데', 'lotte'] },
  { bg: 'linear-gradient(135deg,#0090FF,#0066B3)', label: '우리', match: ['우리', 'woori'] },
  { bg: 'linear-gradient(135deg,#00B488,#005A41)', label: '하나', match: ['하나', 'hana'] },
  {
    bg: 'linear-gradient(135deg,#FFD000,#E6B600)',
    fg: '#000',
    label: 'KB',
    match: ['kb국민', 'kb', '국민', 'kookmin'],
  },
  { bg: 'linear-gradient(135deg,#E60013,#A0000D)', label: 'BC', match: ['bc', '비씨'] },
  { bg: 'linear-gradient(135deg,#27AE60,#16703D)', label: 'NH', match: ['nh', '농협'] },
  { bg: 'linear-gradient(135deg,#0064FF,#003BB3)', label: '토스', match: ['토스', 'toss'] },
  {
    bg: 'linear-gradient(135deg,#FAE100,#D6BD00)',
    fg: '#000',
    label: '카뱅',
    match: ['카카오', 'kakao'],
  },
  { bg: 'linear-gradient(135deg,#1A1F71,#0E1454)', label: 'VISA', match: ['visa', '비자'] },
  {
    bg: 'linear-gradient(135deg,#EB001B,#F79E1B)',
    label: 'MC',
    match: ['master', 'mastercard', '마스터'],
  },
  {
    bg: 'linear-gradient(135deg,#006FCF,#003E78)',
    label: 'AMEX',
    match: ['amex', 'american', '아멕스'],
  },
];

function findCard(name: string): CardMeta | null {
  const norm = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/카드|card/gi, '');
  if (!norm) return null;
  for (const c of CARDS) {
    for (const key of c.match) {
      if (norm.includes(key.toLowerCase())) return c;
    }
  }
  return null;
}

function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

export default function CardIcon({
  name,
  size = 44,
  style,
}: {
  name: string;
  size?: number;
  style?: CSSProperties;
}) {
  const meta = findCard(name);
  // Card-shaped: 1.55 aspect ratio (real credit card is 1.586)
  const w = size * 1.4;
  const h = size * 0.9;

  if (meta) {
    const fontSize =
      meta.label.length <= 2 ? h * 0.46 : meta.label.length === 3 ? h * 0.36 : h * 0.3;
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: 6,
          background: meta.bg,
          color: meta.fg ?? '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: '-apple-system, "SF Pro Display", system-ui, sans-serif',
          fontSize,
          fontWeight: 800,
          letterSpacing: '-0.02em',
          boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
          flexShrink: 0,
          position: 'relative',
          overflow: 'hidden',
          ...style,
        }}
      >
        {/* Subtle chip-shaped accent on top-left */}
        <span
          aria-hidden
          style={{
            position: 'absolute',
            top: 4,
            left: 5,
            width: h * 0.18,
            height: h * 0.13,
            borderRadius: 2,
            background: meta.fg === '#000' ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.28)',
          }}
        />
        {meta.label}
      </div>
    );
  }

  // Unknown card → generic gradient with first letter
  const initial = (name.trim()[0] || '?').toUpperCase();
  const hue = hashHue(name);
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        background: `linear-gradient(135deg, hsl(${hue}, 65%, 50%), hsl(${hue}, 65%, 30%))`,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: h * 0.46,
        fontWeight: 800,
        boxShadow: '0 1px 3px rgba(0,0,0,0.18)',
        flexShrink: 0,
        ...style,
      }}
    >
      {initial}
    </div>
  );
}
