import { describe, expect, it } from 'vitest';
import { dailyAllowance } from './daily-allowance';

// Nov 2026 has 30 days. On Nov 21 there are 10 days left including today.
const NOV21 = new Date(2026, 10, 21, 15, 0, 0);

describe('dailyAllowance', () => {
  it('splits the remaining budget evenly across the days left, including today', () => {
    const r = dailyAllowance({
      budgetTotal: 600_000,
      spentBeforeToday: 400_000,
      spentToday: 0,
      now: NOV21,
    });
    expect(r.daysLeft).toBe(10);
    expect(r.todayAllowance).toBe(20_000);
    expect(r.todayLeft).toBe(20_000);
    expect(r.exhausted).toBe(false);
  });

  it("doesn't shrink the allowance as you spend today — it subtracts from it", () => {
    const r = dailyAllowance({
      budgetTotal: 600_000,
      spentBeforeToday: 400_000,
      spentToday: 7_500,
      now: NOV21,
    });
    expect(r.todayAllowance).toBe(20_000);
    expect(r.todayLeft).toBe(12_500);
  });

  it('goes negative when today overspends', () => {
    const r = dailyAllowance({
      budgetTotal: 600_000,
      spentBeforeToday: 400_000,
      spentToday: 26_000,
      now: NOV21,
    });
    expect(r.todayLeft).toBe(-6_000);
  });

  it('flags an exhausted budget and allows nothing', () => {
    const r = dailyAllowance({
      budgetTotal: 300_000,
      spentBeforeToday: 320_000,
      spentToday: 0,
      now: NOV21,
    });
    expect(r.exhausted).toBe(true);
    expect(r.todayAllowance).toBe(0);
  });

  it('on the last day of the month, the whole remainder is today', () => {
    const r = dailyAllowance({
      budgetTotal: 100_000,
      spentBeforeToday: 70_000,
      spentToday: 0,
      now: new Date(2026, 10, 30, 9),
    });
    expect(r.daysLeft).toBe(1);
    expect(r.todayAllowance).toBe(30_000);
  });
});
