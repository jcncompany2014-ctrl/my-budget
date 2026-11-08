import { describe, expect, it } from 'vitest';
import { dayKeyOffset, daysUntilKey, localDayKey, localTimeHHMM, parseLocalDay } from './dates';

describe('parseLocalDay', () => {
  it('returns LOCAL midnight (new Date("YYYY-MM-DD") would be UTC midnight)', () => {
    const d = parseLocalDay('2026-11-08');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(10);
    expect(d.getDate()).toBe(8);
    expect(d.getHours()).toBe(0);
  });

  it('returns an invalid date for garbage', () => {
    expect(Number.isNaN(parseLocalDay('nope').getTime())).toBe(true);
  });
});

describe('daysUntilKey', () => {
  const NOW = new Date(2026, 10, 8, 23, 30); // late evening still counts as "today"
  it('0 for today, 1 for tomorrow, negative for past', () => {
    expect(daysUntilKey('2026-11-08', NOW)).toBe(0);
    expect(daysUntilKey('2026-11-09', NOW)).toBe(1);
    expect(daysUntilKey('2026-11-01', NOW)).toBe(-7);
  });
});

describe('localDayKey', () => {
  it('uses the local calendar date, not the UTC date', () => {
    // 08:00 local is still "that day" locally, whatever the UTC date is.
    const morning = new Date(2026, 10, 8, 8, 0, 0);
    expect(localDayKey(morning)).toBe('2026-11-08');
    // An ISO string of the same instant resolves to the same local day.
    expect(localDayKey(morning.toISOString())).toBe('2026-11-08');
  });

  it('local midnight stays on its own day', () => {
    expect(localDayKey(new Date(2026, 0, 1, 0, 0, 0))).toBe('2026-01-01');
  });

  it('pads month and day', () => {
    expect(localDayKey(new Date(2026, 2, 5, 12))).toBe('2026-03-05');
  });
});

describe('localTimeHHMM', () => {
  it('formats local time with zero padding', () => {
    expect(localTimeHHMM(new Date(2026, 10, 8, 8, 5))).toBe('08:05');
  });
});

describe('dayKeyOffset', () => {
  it('crosses month boundaries', () => {
    expect(dayKeyOffset(-1, new Date(2026, 10, 1, 9))).toBe('2026-10-31');
    expect(dayKeyOffset(1, new Date(2026, 11, 31, 9))).toBe('2027-01-01');
  });
});
