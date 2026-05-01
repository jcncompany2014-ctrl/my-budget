import { describe, expect, it } from 'vitest';
import { detectAnomalies, detectOutlierTransaction, weeklyDigest } from './insights';
import type { Transaction } from './types';

function tx(overrides: Partial<Transaction>): Transaction {
  return {
    id: overrides.id ?? `t-${Math.random().toString(36).slice(2, 8)}`,
    date: overrides.date ?? new Date().toISOString(),
    amount: overrides.amount ?? -10_000,
    cat: overrides.cat ?? 'food',
    merchant: overrides.merchant ?? '카페',
    acc: overrides.acc ?? 'a1',
    scope: overrides.scope ?? 'personal',
    ...overrides,
  };
}

const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

describe('detectAnomalies', () => {
  it('returns nothing when there is no expense data', () => {
    expect(detectAnomalies([])).toEqual([]);
  });

  it('flags a category whose current month is ≥30% above the trailing 3-month average', () => {
    // Past 3 months: 100k each. This month: 200k. → +100% anomaly.
    const txs: Transaction[] = [
      // 1 month ago
      tx({ amount: -100_000, cat: 'food', date: monthsAgoIso(1, 5) }),
      // 2 months ago
      tx({ amount: -100_000, cat: 'food', date: monthsAgoIso(2, 5) }),
      // 3 months ago
      tx({ amount: -100_000, cat: 'food', date: monthsAgoIso(3, 5) }),
      // this month
      tx({ amount: -200_000, cat: 'food', date: thisMonthIso(5) }),
    ];
    const a = detectAnomalies(txs);
    expect(a.length).toBeGreaterThan(0);
    expect(a[0].cat).toBe('food');
    expect(a[0].deltaPct).toBeGreaterThanOrEqual(80);
  });

  it('ignores tiny categories (< ₩10k average)', () => {
    const txs: Transaction[] = [
      tx({ amount: -1000, cat: 'food', date: monthsAgoIso(1, 5) }),
      tx({ amount: -2000, cat: 'food', date: thisMonthIso(5) }),
    ];
    expect(detectAnomalies(txs)).toEqual([]);
  });
});

describe('detectOutlierTransaction', () => {
  it('returns null when no category has enough samples', () => {
    const txs = Array.from({ length: 4 }, (_, i) =>
      tx({ amount: -10_000, cat: 'food', date: daysAgo(i + 1), id: `f-${i}` }),
    );
    expect(detectOutlierTransaction(txs)).toBeNull();
  });

  it('flags a transaction more than 3σ above the category mean', () => {
    // 8 routine ₩10k food txs + 1 huge ₩500k → mean ~64k, std ~155k, z ~2.8 (just under 3σ).
    // Using larger spike ensures we cross 3σ deterministically.
    const routine = Array.from({ length: 10 }, (_, i) =>
      tx({ amount: -10_000, cat: 'food', date: daysAgo(i + 1), id: `r-${i}` }),
    );
    const spike = tx({
      id: 'spike',
      amount: -2_000_000,
      cat: 'food',
      date: daysAgo(2),
      merchant: '큰 거래',
    });
    const result = detectOutlierTransaction([...routine, spike]);
    expect(result).not.toBeNull();
    expect(result?.tx.id).toBe('spike');
    expect(result?.zScore).toBeGreaterThanOrEqual(3);
  });

  it('does not flag inside a category with very tight variance', () => {
    // All same amount → std = 0 → can't be outlier-by-σ.
    const txs = Array.from({ length: 10 }, (_, i) =>
      tx({ amount: -10_000, cat: 'food', date: daysAgo(i + 1), id: `c-${i}` }),
    );
    expect(detectOutlierTransaction(txs)).toBeNull();
  });
});

describe('weeklyDigest', () => {
  it('returns 0/0/0 when there are no recent transactions', () => {
    const r = weeklyDigest([]);
    expect(r.thisWeek).toBe(0);
    expect(r.lastWeek).toBe(0);
    expect(r.delta).toBe(0);
  });

  it('computes a positive delta when this week is higher', () => {
    // This week +50k, last week +25k → delta = +100%
    const txs: Transaction[] = [
      tx({ amount: -50_000, date: daysAgo(1), cat: 'food' }),
      tx({ amount: -25_000, date: daysAgo(8), cat: 'food' }),
    ];
    const r = weeklyDigest(txs);
    expect(r.thisWeek).toBe(50_000);
    expect(r.lastWeek).toBe(25_000);
    expect(r.delta).toBe(100);
  });
});

// ─── helpers ───
function monthsAgoIso(months: number, day: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, day, 12, 0, 0);
  return d.toISOString();
}
function thisMonthIso(day: number): string {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth(), day, 12, 0, 0);
  return d.toISOString();
}
