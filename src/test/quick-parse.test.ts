import { describe, expect, it } from 'vitest';
import { parseQuickText, resolveQuick } from '@/lib/quick-parse';
import type { Transaction } from '@/lib/types';

// Saturday 14 Nov 2026, 13:30 local.
const NOW = new Date(2026, 10, 14, 13, 30, 0);
const p = (s: string) => parseQuickText(s, NOW);
const day = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('parseQuickText — amounts', () => {
  it('reads plain, comma and unit amounts', () => {
    expect(p('스타벅스 4500')?.amount).toBe(4500);
    expect(p('점심 12,000')?.amount).toBe(12000);
    expect(p('스타벅스 5천원')?.amount).toBe(5000);
    expect(p('회식 1만5천')?.amount).toBe(15000);
    expect(p('월세 3.5만')?.amount).toBe(35000);
    expect(p('전세 1억2000만')?.amount).toBe(120_000_000);
    expect(p('택시 1만2500원')?.amount).toBe(12500);
  });

  it('joins a unit typed after a space', () => {
    expect(p('커피 5 천원')).toMatchObject({ amount: 5000, merchant: '커피' });
    expect(p('커피 4500 원')).toMatchObject({ amount: 4500, merchant: '커피' });
  });

  it('does not read a following word as a unit', () => {
    // Used to become 80,000,000 ("8000 만" + "두").
    expect(p('8000 만두')).toMatchObject({ amount: 8000, merchant: '만두' });
    expect(p('만두 8000')).toMatchObject({ amount: 8000, merchant: '만두' });
    expect(p('천원샵 3000')).toMatchObject({ amount: 3000, merchant: '천원샵' });
  });

  it('keeps digits and 원 that belong to the name', () => {
    expect(p('GS25 3500')).toMatchObject({ amount: 3500, merchant: 'GS25' });
    expect(p('11번가 25000')).toMatchObject({ amount: 25000, merchant: '11번가' });
    expect(p('이마트24 1,200')).toMatchObject({ amount: 1200, merchant: '이마트24' });
    expect(p('원할머니보쌈 32000')).toMatchObject({ amount: 32000, merchant: '원할머니보쌈' });
    expect(p('아이폰 15 1500000')).toMatchObject({ amount: 1_500_000, merchant: '아이폰 15' });
  });

  it('splits an amount glued to the name, but not a name ending in two digits', () => {
    expect(p('스타벅스5천원')).toMatchObject({ amount: 5000, merchant: '스타벅스' });
    expect(p('CU1500')).toMatchObject({ amount: 1500, merchant: 'CU' });
    expect(p('GS25')).toBeNull();
    expect(p('이마트24')).toBeNull();
  });

  it('returns null without an amount', () => {
    expect(p('')).toBeNull();
    expect(p('스타벅스')).toBeNull();
    expect(p('커피 5')).toBeNull();
  });

  it('a spelled-out amount wins over a bare number', () => {
    expect(p('버스 2000 3천')).toMatchObject({ amount: 3000, merchant: '버스 2000' });
  });
});

describe('parseQuickText — dates', () => {
  it('defaults to now', () => {
    expect(p('커피 4500')?.date.getTime()).toBe(NOW.getTime());
  });

  it('understands 어제 · 그제 as whole words only', () => {
    expect(day(p('어제 스타벅스 5천')!.date)).toBe('2026-11-13');
    expect(day(p('스타벅스 5천 그제')!.date)).toBe('2026-11-12');
    // "오늘의집" is a shop, not today + "의집".
    expect(p('오늘의집 35000')).toMatchObject({ amount: 35000, merchant: '오늘의집' });
  });

  it('reads a leading day or month/day, moving back when it has not come yet', () => {
    expect(day(p('12일 관리비 15만')!.date)).toBe('2026-11-12');
    expect(p('12일 관리비 15만')).toMatchObject({ amount: 150_000, merchant: '관리비' });
    expect(day(p('20일 월세 50만')!.date)).toBe('2026-10-20');
    expect(day(p('11/3 병원 12000')!.date)).toBe('2026-11-3');
    expect(day(p('12/25 선물 30000')!.date)).toBe('2025-12-25');
    expect(day(p('10월 2일 택시 9800')!.date)).toBe('2026-10-2');
  });

  it('leaves a day in the middle of the line as part of the name', () => {
    expect(p('제주 3일 여행 30만')).toMatchObject({ amount: 300_000, merchant: '제주 3일 여행' });
  });
});

describe('parseQuickText — income', () => {
  it('flips on explicit words and a plus sign only', () => {
    expect(p('월급 300만 입금')).toMatchObject({
      amount: 3_000_000,
      merchant: '월급',
      income: true,
    });
    expect(p('+50000 중고거래')).toMatchObject({
      amount: 50000,
      merchant: '중고거래',
      income: true,
    });
    expect(p('입금 50만')).toMatchObject({ amount: 500_000, merchant: '입금', income: true });
    // "받" inside a word used to flip the sign.
    expect(p('밥받침 3000')).toMatchObject({ merchant: '밥받침', income: false });
  });
});

const tx = (over: Partial<Transaction>): Transaction => ({
  id: Math.random().toString(36),
  date: '2026-11-01T03:00:00.000Z',
  amount: -5000,
  cat: 'living',
  merchant: '',
  memo: '',
  acc: 'a',
  scope: 'personal',
  ...over,
});

describe('resolveQuick', () => {
  it('uses the built-in guess for a new merchant', () => {
    const r = resolveQuick(p('스타벅스 5천')!, 'personal', [], []);
    expect(r).toEqual({ cat: 'cafe', type: 'expense', merchant: '스타벅스' });
  });

  it('follows how the merchant was filed before', () => {
    const history = [
      tx({ merchant: '동네마트', cat: 'food' }),
      tx({ merchant: '동네마트', cat: 'food' }),
    ];
    expect(resolveQuick(p('동네마트 8000')!, 'personal', history, []).cat).toBe('food');
  });

  it('a user rule beats history', () => {
    const history = [tx({ merchant: '동네마트', cat: 'food' })];
    const rules = [{ id: 'r', match: '마트', cat: 'shopping' }];
    expect(resolveQuick(p('동네마트 8000')!, 'personal', history, rules).cat).toBe('shopping');
  });

  it('treats a merchant that always paid in as income', () => {
    const history = [
      tx({ merchant: '월급', cat: 'salary', amount: 3_000_000 }),
      tx({ merchant: '월급', cat: 'salary', amount: 3_000_000 }),
    ];
    expect(resolveQuick(p('월급 300만')!, 'personal', history, [])).toEqual({
      cat: 'salary',
      type: 'income',
      merchant: '월급',
    });
  });

  it('one refund does not turn a shop into income', () => {
    const history = [
      tx({ merchant: '쿠팡', cat: 'shopping', amount: -20000 }),
      tx({ merchant: '쿠팡', cat: 'shopping', amount: -15000 }),
      tx({ merchant: '쿠팡', cat: 'shopping', amount: 15000 }),
    ];
    expect(resolveQuick(p('쿠팡 9900')!, 'personal', history, []).type).toBe('expense');
  });

  it('never files under a transfer or a category of the other ledger', () => {
    const history = [tx({ merchant: '적금', cat: 'saving' })];
    expect(resolveQuick(p('적금 70만')!, 'personal', history, []).cat).toBe('living');
    expect(resolveQuick(p('스타벅스 5천')!, 'business', [], []).cat).toBe('biz_etc');
    expect(resolveQuick(p('입금 50만')!, 'business', [], []).cat).toBe('biz_other');
  });

  it('names a bare amount after its category', () => {
    expect(resolveQuick(p('5000')!, 'personal', [], []).merchant).toBe('생활');
  });
});
