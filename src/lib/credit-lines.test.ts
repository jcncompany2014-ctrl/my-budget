import { describe, expect, it } from 'vitest';
import { computeMonthlyInterest } from './credit-lines';

describe('computeMonthlyInterest', () => {
  it('returns 0 when balance is 0 or negative', () => {
    expect(computeMonthlyInterest(0, 5)).toBe(0);
    expect(computeMonthlyInterest(-100_000, 5)).toBe(0);
  });

  it('returns 0 when annual rate is 0 or negative', () => {
    expect(computeMonthlyInterest(1_000_000, 0)).toBe(0);
    expect(computeMonthlyInterest(1_000_000, -1)).toBe(0);
  });

  it('computes principal × annualRate / 12 / 100, rounded to KRW', () => {
    // 1,000,000 × 0.06 / 12 = 5,000
    expect(computeMonthlyInterest(1_000_000, 6)).toBe(5_000);
    // 500,000 × 0.072 / 12 = 3,000
    expect(computeMonthlyInterest(500_000, 7.2)).toBe(3_000);
  });

  it('rounds half-up like the rest of the app', () => {
    // 100,000 × 0.05 / 12 = 416.67 → 417
    expect(computeMonthlyInterest(100_000, 5)).toBe(417);
  });
});
