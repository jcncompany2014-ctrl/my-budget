import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type NetWorthHistory, netWorthSeries, recordNetWorth } from '@/lib/net-worth-history';
import { KEYS } from '@/lib/storage-keys';

const stored = () =>
  JSON.parse(window.localStorage.getItem(KEYS.netWorthHistory) ?? '{}') as NetWorthHistory;

describe('recordNetWorth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 10, 0, 0));
  });

  it('keeps one value per local day and per ledger', () => {
    const t0 = Date.now() + 10 * 3_600_000; // module-level throttle state is shared across tests
    recordNetWorth('personal', 20_279_438.4, t0);
    recordNetWorth('business', -42_593_426, t0);
    expect(stored()).toEqual({
      personal: { '2026-11-14': 20_279_438 },
      business: { '2026-11-14': -42_593_426 },
    });
  });

  it('throttles rewrites of the same day but always takes a new day', () => {
    const t0 = Date.now() + 20 * 3_600_000;
    recordNetWorth('personal', 100, t0);
    recordNetWorth('personal', 200, t0 + 60_000);
    expect(stored().personal).toEqual({ '2026-11-14': 100 });

    recordNetWorth('personal', 200, t0 + 31 * 60_000);
    expect(stored().personal).toEqual({ '2026-11-14': 200 });

    vi.setSystemTime(new Date(2026, 10, 15, 0, 5, 0));
    recordNetWorth('personal', 300, t0 + 32 * 60_000);
    expect(stored().personal).toEqual({ '2026-11-14': 200, '2026-11-15': 300 });
  });

  it('ignores a figure that is not a number', () => {
    recordNetWorth('personal', Number.NaN);
    expect(window.localStorage.getItem(KEYS.netWorthHistory)).toBeNull();
  });
});

describe('netWorthSeries', () => {
  it('returns the days in range, oldest first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 10, 0, 0));
    const history: NetWorthHistory = {
      personal: { '2026-11-14': 3, '2026-08-01': 1, '2026-11-01': 2 },
    };
    expect(netWorthSeries(history, 'personal', 90)).toEqual([
      { day: '2026-11-01', value: 2 },
      { day: '2026-11-14', value: 3 },
    ]);
    expect(netWorthSeries(history, 'business', 90)).toEqual([]);
  });
});
