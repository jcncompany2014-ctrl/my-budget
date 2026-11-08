import { describe, expect, it } from 'vitest';
import {
  detectAnomalies,
  detectOutlierTransaction,
  detectPatterns,
  monthPace,
  weeklyDigest,
} from './insights';
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

  // Pinned "now": Wednesday 2026-11-11 15:00 local. Monday-start week.
  const WED = new Date(2026, 10, 11, 15, 0, 0);
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m, d, h).toISOString();

  it('compares week-to-date against the same elapsed span of last week', () => {
    const txs: Transaction[] = [
      tx({ amount: -50_000, date: at(2026, 10, 10), cat: 'food' }), // Tue this week
      tx({ amount: -25_000, date: at(2026, 10, 3), cat: 'food' }), // Tue last week (in span)
      tx({ amount: -99_000, date: at(2026, 10, 6), cat: 'food' }), // Fri last week (out of span)
    ];
    const r = weeklyDigest(txs, WED);
    expect(r.thisWeek).toBe(50_000);
    expect(r.lastWeek).toBe(25_000);
    expect(r.lastWeekFull).toBe(124_000);
    expect(r.delta).toBe(100);
  });

  it('treats Sunday as the END of the week (Monday-start)', () => {
    const SUN = new Date(2026, 10, 8, 10, 0, 0); // Sun 2026-11-08
    const txs: Transaction[] = [
      tx({ amount: -40_000, date: at(2026, 10, 3), cat: 'food' }), // Tue 11-03 — same week as SUN
    ];
    expect(weeklyDigest(txs, SUN).thisWeek).toBe(40_000);
  });
});

describe('monthPace', () => {
  it('compares month-to-date against the same day of last month', () => {
    const NOW = new Date(2026, 10, 10, 18, 0, 0); // Nov 10
    const at = (m: number, d: number) => new Date(2026, m, d, 12).toISOString();
    const txs: Transaction[] = [
      tx({ amount: -30_000, date: at(10, 2) }), // Nov 2
      tx({ amount: -20_000, date: at(10, 9) }), // Nov 9
      tx({ amount: -40_000, date: at(9, 5) }), // Oct 5 — counts toward "same day"
      tx({ amount: -100_000, date: at(9, 25) }), // Oct 25 — after day 10, excluded
    ];
    const p = monthPace(txs, NOW);
    expect(p.thisToDate).toBe(50_000);
    expect(p.lastAtSameDay).toBe(40_000);
    expect(p.lastTotal).toBe(140_000);
    expect(p.deltaPct).toBe(25);
    expect(p.thisCum).toHaveLength(10);
    expect(p.projection).toBe(150_000); // 50k / 10 days × 30
  });

  it('returns null deltaPct when last month had nothing by this day', () => {
    const NOW = new Date(2026, 10, 3, 12);
    const p = monthPace(
      [tx({ amount: -10_000, date: new Date(2026, 10, 1, 12).toISOString() })],
      NOW,
    );
    expect(p.deltaPct).toBeNull();
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

describe('detectPatterns', () => {
  it('returns nothing with fewer than 10 recent expenses', () => {
    const txs = Array.from({ length: 5 }, (_, i) => tx({ date: daysAgo(i), amount: -10_000 }));
    expect(detectPatterns(txs)).toEqual([]);
  });

  it('compares weekend vs weekday spend per CALENDAR day, not per transaction', () => {
    // 28 consecutive days, one tx per day: weekends 30k, weekdays 10k → +200%
    const txs: Transaction[] = Array.from({ length: 28 }, (_, i) => {
      const date = daysAgo(i);
      const w = new Date(date).getDay();
      const weekend = w === 0 || w === 6;
      return tx({ date, amount: weekend ? -30_000 : -10_000, cat: 'food', id: `wk-${i}` });
    });
    const found = detectPatterns(txs).find((p) => p.kind === 'weekend-vs-weekday');
    expect(found).toBeDefined();
    if (found?.kind === 'weekend-vs-weekday') {
      expect(Math.round(found.weekendAvg)).toBe(30_000);
      expect(Math.round(found.weekdayAvg)).toBe(10_000);
      expect(found.deltaPct).toBe(200);
    }
  });

  it('detects a recurring weekday bias for one category', () => {
    // Mondays: cafe 12k. Every other day: cafe 1.5k.
    const txs: Transaction[] = Array.from({ length: 28 }, (_, i) => {
      const date = daysAgo(i);
      const monday = new Date(date).getDay() === 1;
      return tx({ date, amount: monday ? -12_000 : -1_500, cat: 'cafe', id: `mon-${i}` });
    });
    const found = detectPatterns(txs).find((p) => p.kind === 'weekday-category');
    expect(found).toBeDefined();
    if (found?.kind === 'weekday-category') {
      expect(found.weekday).toBe(1);
      expect(found.cat).toBe('cafe');
      expect(found.ratio).toBeGreaterThan(1.6);
    }
  });

  it('detects a 3-month category trend', () => {
    const txs: Transaction[] = [
      // 60–90 days ago: cafe 15k total
      tx({ date: daysAgo(65), amount: -5_000, cat: 'cafe' }),
      tx({ date: daysAgo(70), amount: -5_000, cat: 'cafe' }),
      tx({ date: daysAgo(75), amount: -5_000, cat: 'cafe' }),
      // last 30 days: cafe 45k total → +200%
      tx({ date: daysAgo(5), amount: -15_000, cat: 'cafe' }),
      tx({ date: daysAgo(10), amount: -15_000, cat: 'cafe' }),
      tx({ date: daysAgo(15), amount: -15_000, cat: 'cafe' }),
      // filler so we cross the 10-tx minimum (no baseline in oldest bucket → no trend)
      ...[20, 25, 35, 40, 45, 50].map((d) => tx({ date: daysAgo(d), amount: -8_000, cat: 'food' })),
    ];
    const found = detectPatterns(txs).find((p) => p.kind === 'category-trend');
    expect(found).toBeDefined();
    if (found?.kind === 'category-trend') {
      expect(found.cat).toBe('cafe');
      expect(found.deltaPct).toBe(200);
    }
  });
});
