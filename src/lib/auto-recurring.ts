'use client';

import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Account, RecurringItem, Transaction } from '@/lib/types';

const LAST_RUN_KEY = 'asset/auto-recurring-last/v1';

/**
 * Generates transactions for any recurring item whose monthly day has passed
 * since last run (within the last 3 months — avoids huge backfill on first install).
 *
 * Idempotent: each (recurring id, year, month) combo creates at most one tx.
 */
export function ensureAutoRecurring() {
  if (typeof window === 'undefined') return;

  const items = readStorageValue<RecurringItem[]>(KEYS.recurring, []);
  if (items.length === 0) return;

  const accounts = readStorageValue<Account[]>(KEYS.accounts, []);
  if (accounts.length === 0) return;

  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const existingIds = new Set(txs.map((t) => t.id));

  const lastRunStr = window.localStorage.getItem(LAST_RUN_KEY);
  const lastRun = lastRunStr ? new Date(lastRunStr).getTime() : 0;
  const now = new Date();

  const newTxs: Transaction[] = [];
  // Iterate up to last 3 months (avoid huge backfill)
  for (let monthBack = 2; monthBack >= 0; monthBack--) {
    const m = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    for (const r of items) {
      const lastDayOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(r.day, lastDayOfMonth);
      const targetDate = new Date(m.getFullYear(), m.getMonth(), targetDay, 9, 0, 0);
      if (targetDate > now) continue;
      // Already past last run? skip
      if (targetDate.getTime() <= lastRun) continue;
      // Find a default account for this scope
      const acc =
        accounts.find((a) => a.scope === r.scope && a.main) ??
        accounts.find((a) => a.scope === r.scope) ??
        accounts[0];
      if (!acc) continue;
      const id = `recur-${m.getFullYear()}-${m.getMonth()}-${r.id}`;
      if (existingIds.has(id)) continue;
      newTxs.push({
        id,
        date: targetDate.toISOString(),
        amount: -r.amount,
        cat: r.cat,
        merchant: r.name,
        memo: '정기결제 (자동)',
        acc: acc.id,
        scope: r.scope,
        recurring: true,
      });
    }
  }

  if (newTxs.length === 0) return;

  writeStorageValue(KEYS.transactions, [...newTxs, ...txs]);
  window.localStorage.setItem(LAST_RUN_KEY, now.toISOString());
}
