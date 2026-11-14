'use client';

import { DEBT_ONLY_CAT } from '@/lib/reimburse';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Transaction } from '@/lib/types';

const DONE_KEY = 'asset/data-fixes/v1';

type Fix = { id: string; run: () => void };

/**
 * One-off corrections to data that is already on the device. Each runs once
 * (its id is remembered) and does nothing where its rows do not exist.
 */
const FIXES: Fix[] = [
  {
    // The opening 사업 대납 balance (a business purchase on the personal card,
    // paid in instalments) was loaded as a November business cost. It is a
    // debt the business owes, not this month's expense.
    id: '2026-11-14-opening-reimburse-as-debt',
    run() {
      const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
      const i = txs.findIndex((t) => t.id === 'reimb-open-20261114');
      if (i < 0 || txs[i].cat === DEBT_ONLY_CAT || !txs[i].reimburse) return;
      const next = [...txs];
      next[i] = { ...txs[i], cat: DEBT_ONLY_CAT };
      writeStorageValue(KEYS.transactions, next);
    },
  },
];

export function runDataFixes() {
  if (typeof window === 'undefined') return;
  let done: string[] = [];
  try {
    done = JSON.parse(window.localStorage.getItem(DONE_KEY) ?? '[]') as string[];
  } catch {
    done = [];
  }
  const pending = FIXES.filter((f) => !done.includes(f.id));
  if (pending.length === 0) return;
  for (const fix of pending) {
    try {
      fix.run();
      done.push(fix.id);
    } catch {
      // Left pending: it is tried again on the next launch.
    }
  }
  try {
    window.localStorage.setItem(DONE_KEY, JSON.stringify(done));
  } catch {
    /* storage full — the fixes are idempotent and simply run again */
  }
}
