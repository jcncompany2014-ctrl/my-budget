import { describe, expect, it } from 'vitest';
import { monthlyClosing, parseMonthKey, previousMonthKey } from './closing';
import type { Transaction } from './types';

let seq = 0;
// October 2026 (31 days) — fully in the past relative to any test run date after it.
const oct = (day: number, o: Partial<Transaction>): Transaction => ({
  id: `c${seq++}`,
  date: new Date(2026, 9, day, 12).toISOString(),
  amount: -10_000,
  cat: 'food',
  merchant: '식당',
  acc: 'a1',
  scope: 'personal',
  ...o,
});
const sep = (day: number, o: Partial<Transaction>): Transaction => ({
  ...oct(day, o),
  date: new Date(2026, 8, day, 12).toISOString(),
});

describe('monthlyClosing', () => {
  const txs: Transaction[] = [
    oct(25, { amount: 3_000_000, cat: 'salary', merchant: '회사' }),
    oct(1, { amount: -50_000, cat: 'food', merchant: '고깃집' }),
    oct(2, { amount: -4_500, cat: 'cafe', merchant: '스타벅스' }),
    oct(3, { amount: -4_500, cat: 'cafe', merchant: '스타벅스' }),
    oct(4, { amount: -4_500, cat: 'cafe', merchant: '스타벅스' }),
    oct(10, { amount: -650_000, cat: 'living', merchant: '월세', recurring: true }),
    oct(11, { amount: -100_000, cat: 'transfer', merchant: '저축' }), // not an expense
    sep(5, { amount: -400_000, cat: 'food', merchant: '9월' }),
  ];
  const r = monthlyClosing(txs, 2026, 9);

  it('totals income, expense, net and savings rate (transfers excluded)', () => {
    expect(r.income).toBe(3_000_000);
    expect(r.expense).toBe(713_500);
    expect(r.net).toBe(2_286_500);
    expect(r.savingsRate).toBeCloseTo(2_286_500 / 3_000_000);
  });

  it('compares expense with the previous month', () => {
    expect(r.prevExpense).toBe(400_000);
    expect(r.expenseDeltaPct).toBe(78); // 713.5k vs 400k
  });

  it('counts logged days and no-spend days', () => {
    // logged: 1,2,3,4,10,11,25 → 7 days
    expect(r.loggedDays).toBe(7);
    // spend days: 1,2,3,4,10 → 31 - 5 = 26 no-spend days (transfer day 11 counts as no-spend)
    expect(r.noSpendDays).toBe(26);
  });

  it('finds the biggest expense and the most visited merchant (ignoring recurring)', () => {
    expect(r.biggest).toMatchObject({ merchant: '월세', amount: 650_000 });
    expect(r.favoriteMerchant).toMatchObject({ merchant: '스타벅스', visits: 3, total: 13_500 });
  });

  it('ranks top categories with previous-month deltas', () => {
    expect(r.topCategories[0]).toMatchObject({ cat: 'living', amount: 650_000, deltaPct: null });
    expect(r.topCategories[1]).toMatchObject({ cat: 'food', amount: 50_000, deltaPct: -87 });
  });
});

describe('month keys', () => {
  it('previousMonthKey crosses the year boundary', () => {
    expect(previousMonthKey(new Date(2027, 0, 15))).toBe('2026-12');
  });
  it('parseMonthKey validates', () => {
    expect(parseMonthKey('2026-10')).toEqual({ year: 2026, month: 9 });
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('oops')).toBeNull();
  });
});
