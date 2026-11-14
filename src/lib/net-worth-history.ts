'use client';

import { useEffect } from 'react';
import { dayKeyOffset, todayKey } from '@/lib/dates';
import { KEYS } from '@/lib/storage-keys';
import { createValueStore, readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Scope } from '@/lib/types';

/** One closing value per local day, per ledger: { personal: { '2026-11-14': 20279438 } }. */
export type NetWorthHistory = Partial<Record<Scope, Record<string, number>>>;

const KEEP_DAYS = 800;
const REWRITE_MS = 30 * 60_000;

export const useNetWorthHistory = createValueStore<NetWorthHistory>(KEYS.netWorthHistory, {});

// Quotes move the figure every minute or two; one write per half hour is plenty
// for a per-day series and keeps storage (and the cloud mirror) quiet.
const lastWrite: Partial<Record<Scope, number>> = {};

/** Remember today's net worth for `scope`. Cheap to call on every render-effect. */
export function recordNetWorth(scope: Scope, net: number, now = Date.now()) {
  if (typeof window === 'undefined' || !Number.isFinite(net)) return;
  const value = Math.round(net);
  const day = todayKey();
  const history = readStorageValue<NetWorthHistory>(KEYS.netWorthHistory, {});
  const series = history[scope] ?? {};
  if (series[day] === value) return;
  if (series[day] !== undefined && now - (lastWrite[scope] ?? 0) < REWRITE_MS) return;
  lastWrite[scope] = now;

  const cutoff = dayKeyOffset(-KEEP_DAYS);
  const kept = Object.fromEntries(Object.entries(series).filter(([d]) => d >= cutoff));
  writeStorageValue(KEYS.netWorthHistory, { ...history, [scope]: { ...kept, [day]: value } });
}

/** The last `days` days that have a value, oldest first. */
export function netWorthSeries(
  history: NetWorthHistory,
  scope: Scope,
  days: number,
): { day: string; value: number }[] {
  const from = dayKeyOffset(-days);
  return Object.entries(history[scope] ?? {})
    .filter(([d]) => d >= from)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, value]) => ({ day, value }));
}

/**
 * Record `net` once it has settled: stores hydrate and quotes arrive in the
 * first seconds after launch, and each of those steps changes the figure.
 * `ready` must be false until every store is loaded — an early 0 would be
 * recorded as a real value.
 */
export function useRecordNetWorth(scope: Scope, net: number, ready: boolean) {
  useEffect(() => {
    if (!ready) return;
    const t = window.setTimeout(() => recordNetWorth(scope, net), 4000);
    return () => window.clearTimeout(t);
  }, [scope, net, ready]);
}
