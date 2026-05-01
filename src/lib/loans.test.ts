import { describe, expect, it } from 'vitest';
import { computeMonthlyPayment, splitMonthlyPayment } from './loans';

describe('computeMonthlyPayment', () => {
  it('returns 0 when term is 0 or negative', () => {
    expect(computeMonthlyPayment(1_000_000, 5, 0)).toBe(0);
    expect(computeMonthlyPayment(1_000_000, 5, -3)).toBe(0);
  });

  it('handles 0% interest as straight-line division', () => {
    expect(computeMonthlyPayment(1_200_000, 0, 12)).toBe(100_000);
  });

  it('matches the standard amortization formula at 6% / 360 months', () => {
    // P = 100M, r = 6% APR, n = 360 (30 years). Standard mortgage.
    // Monthly: 599,550 (rounded) — within ±5원 of the textbook value.
    const m = computeMonthlyPayment(100_000_000, 6, 360);
    expect(m).toBeGreaterThan(599_540);
    expect(m).toBeLessThan(599_560);
  });

  it('drops to a smaller payment as the rate falls', () => {
    const a = computeMonthlyPayment(50_000_000, 8, 60);
    const b = computeMonthlyPayment(50_000_000, 4, 60);
    expect(a).toBeGreaterThan(b);
  });
});

describe('splitMonthlyPayment', () => {
  it('puts all of a 0-rate payment toward principal', () => {
    const r = splitMonthlyPayment(1_000_000, 0, 100_000);
    expect(r.interest).toBe(0);
    expect(r.principal).toBe(100_000);
  });

  it('charges interest on the remaining balance and principal is the rest', () => {
    // remaining 12M @ 6% APR → monthly interest 60,000원
    // monthly payment 200,000 → principal 140,000
    const r = splitMonthlyPayment(12_000_000, 6, 200_000);
    expect(r.interest).toBe(60_000);
    expect(r.principal).toBe(140_000);
  });

  it('caps principal at remaining so the last installment never overshoots', () => {
    // remaining 50,000 @ 5% APR → interest 208 (rounded). monthly 1,000,000 way exceeds
    // remaining + interest. Principal capped at 50,000, interest stays.
    const r = splitMonthlyPayment(50_000, 5, 1_000_000);
    expect(r.principal).toBe(50_000);
    expect(r.interest).toBeLessThan(1000); // tiny
  });

  it('never returns a negative interest or principal', () => {
    const r = splitMonthlyPayment(0, 5, 100_000);
    expect(r.interest).toBe(0);
    expect(r.principal).toBe(0);
  });
});
