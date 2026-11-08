'use client';

import { useMemo } from 'react';
import type { Transaction } from '@/lib/types';

/**
 * Consecutive-day logging streak.
 *
 * A "day" is a local calendar day with at least one non-recurring, non-
 * imported transaction. Transfers count as logging activity.
 *
 * `streak` = current consecutive days including today-or-yesterday.
 *    If today has no entry but yesterday does, we keep counting (gives the
 *    user until end of day to log something and not break the streak).
 *    If neither today nor yesterday has an entry, the current streak is 0.
 *
 * `best` = longest streak ever found in the history.
 */

function localDayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function yesterdayKey(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function prevDay(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - 1);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

export function computeStreak(tx: Transaction[]): {
  current: number;
  best: number;
  loggedToday: boolean;
  lastLoggedKey: string | null;
} {
  if (tx.length === 0) {
    return { current: 0, best: 0, loggedToday: false, lastLoggedKey: null };
  }

  const dayset = new Set<string>();
  for (const t of tx) {
    dayset.add(localDayKey(t.date));
  }

  const today = todayKey();
  const yest = yesterdayKey();
  const loggedToday = dayset.has(today);
  const loggedYesterday = dayset.has(yest);

  // Current streak — start from today (or yesterday if today empty but grace)
  let current = 0;
  if (loggedToday) {
    let cursor = today;
    while (dayset.has(cursor)) {
      current += 1;
      cursor = prevDay(cursor);
    }
  } else if (loggedYesterday) {
    // grace: today empty but yesterday had entry — streak still alive, don't +1
    let cursor = yest;
    while (dayset.has(cursor)) {
      current += 1;
      cursor = prevDay(cursor);
    }
  }

  // Best streak — scan all days in order
  const sortedDays = Array.from(dayset).sort();
  let best = 0;
  let run = 0;
  let prev: string | null = null;
  for (const day of sortedDays) {
    if (prev && prevDay(day) === prev) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    prev = day;
  }

  return {
    current,
    best,
    loggedToday,
    lastLoggedKey: sortedDays[sortedDays.length - 1] ?? null,
  };
}

/** React hook wrapping computeStreak with memoization. */
export function useStreak(tx: Transaction[]) {
  return useMemo(() => computeStreak(tx), [tx]);
}
