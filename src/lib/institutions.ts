import type { AccountType } from '@/lib/types';

/**
 * Korean card companies, banks and brokerages offered as one-tap choices when
 * adding an account, so its name, issuer, kind and colour need no typing.
 * Colours come from the account palette (they tint selected chips, so they
 * must read on both themes) rather than the exact brand colour — the icon
 * already carries the brand.
 */
export type Institution = { name: string; type: AccountType; color: string };

const BLUE = '#3182F6';
const GREEN = '#00B956';
const TEAL = '#14B8A6';
const ORANGE = '#FF8A1F';
const RED = '#EF4444';
const VIOLET = '#8B5CF6';
const SLATE = '#64748B';

const card = (name: string, color: string): Institution => ({ name, type: 'card', color });
const bank = (name: string, color: string): Institution => ({ name, type: 'bank', color });
const broker = (name: string, color: string): Institution => ({ name, type: 'investment', color });

export const INSTITUTIONS: Record<'card' | 'bank' | 'investment', Institution[]> = {
  card: [
    card('현대카드', SLATE),
    card('삼성카드', BLUE),
    card('신한카드', BLUE),
    card('KB국민카드', ORANGE),
    card('롯데카드', RED),
    card('하나카드', TEAL),
    card('우리카드', BLUE),
    card('NH농협카드', GREEN),
    card('BC카드', RED),
    card('아멕스', BLUE),
    card('토스뱅크 카드', BLUE),
    card('카카오뱅크 카드', ORANGE),
  ],
  bank: [
    bank('KB국민은행', ORANGE),
    bank('신한은행', BLUE),
    bank('우리은행', BLUE),
    bank('하나은행', TEAL),
    bank('NH농협은행', GREEN),
    bank('IBK기업은행', BLUE),
    bank('카카오뱅크', ORANGE),
    bank('토스뱅크', BLUE),
    bank('케이뱅크', BLUE),
    bank('새마을금고', ORANGE),
    bank('우체국', RED),
    bank('신협', BLUE),
    bank('수협은행', BLUE),
    bank('SC제일은행', GREEN),
    bank('iM뱅크', TEAL),
    bank('부산은행', BLUE),
    bank('경남은행', RED),
    bank('광주은행', RED),
    bank('전북은행', GREEN),
    bank('제주은행', BLUE),
  ],
  investment: [
    broker('토스증권', BLUE),
    broker('키움증권', VIOLET),
    broker('미래에셋증권', ORANGE),
    broker('삼성증권', BLUE),
    broker('KB증권', ORANGE),
    broker('NH투자증권', GREEN),
    broker('한국투자증권', TEAL),
    broker('신한투자증권', BLUE),
    broker('업비트', BLUE),
    broker('빗썸', ORANGE),
  ],
};

const ALL = [...INSTITUTIONS.card, ...INSTITUTIONS.bank, ...INSTITUTIONS.investment];

/** The distinctive part of a name: "KB국민카드" → "kb국민". */
function stem(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/카드|은행|뱅크|증권|투자/g, '');
}

/** Palette colour for an issuer or bank name; blue when it is not one of the above. */
export function colorFor(name: string): string {
  const s = stem(name);
  if (!s) return BLUE;
  return ALL.find((i) => stem(i.name) === s)?.color ?? BLUE;
}
