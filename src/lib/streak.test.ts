import { describe, expect, it } from 'vitest';
import { computeStreak } from './streak';
import type { Transaction } from './types';

// Noon local time N days ago — avoids midnight/timezone edge flakiness.
const daysAgo = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - n);
  return d.toISOString();
};

const tx = (n: number): Transaction => ({
  id: `t-${n}-${Math.random().toString(36).slice(2, 6)}`,
  date: daysAgo(n),
  amount: -5000,
  cat: 'food',
  merchant: '식당',
  acc: 'a1',
  scope: 'personal',
});

describe('computeStreak', () => {
  it('returns zeros for empty history', () => {
    expect(computeStreak([])).toEqual({
      current: 0,
      best: 0,
      loggedToday: false,
      lastLoggedKey: null,
    });
  });

  it('counts today as a 1-day streak', () => {
    const r = computeStreak([tx(0)]);
    expect(r.current).toBe(1);
    expect(r.loggedToday).toBe(true);
  });

  it('counts consecutive days ending today', () => {
    const r = computeStreak([tx(0), tx(1), tx(2), tx(3)]);
    expect(r.current).toBe(4);
    expect(r.best).toBe(4);
  });

  it('multiple transactions on the same day count once', () => {
    const r = computeStreak([tx(0), tx(0), tx(0), tx(1)]);
    expect(r.current).toBe(2);
  });

  it('keeps the streak alive through today when only yesterday is logged (grace)', () => {
    const r = computeStreak([tx(1), tx(2), tx(3)]);
    expect(r.current).toBe(3);
    expect(r.loggedToday).toBe(false);
  });

  it('breaks the streak when neither today nor yesterday is logged', () => {
    const r = computeStreak([tx(2), tx(3), tx(4)]);
    expect(r.current).toBe(0);
    expect(r.best).toBe(3);
  });

  it('a gap resets the current run but best remembers the longer one', () => {
    // 5-day run long ago, gap, then 2-day run ending today
    const r = computeStreak([tx(0), tx(1), tx(10), tx(11), tx(12), tx(13), tx(14)]);
    expect(r.current).toBe(2);
    expect(r.best).toBe(5);
  });
});
