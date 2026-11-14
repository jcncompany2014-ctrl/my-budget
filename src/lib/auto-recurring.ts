'use client';

import { applyTxToAccounts } from '@/lib/integrity';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Account, RecurringItem, Transaction } from '@/lib/types';

const LAST_RUN_KEY = 'asset/auto-recurring-last/v1';

/**
 * Generates transactions for any recurring item whose monthly day has passed
 * since the item was last settled (within the last 3 months — avoids huge
 * backfill after a long absence). A new item is stamped `postedThrough` at
 * creation, so months before it existed are never generated.
 *
 * Idempotent: each (recurring id, year, month) combo creates at most one tx
 * (two legs when the item moves money into another account).
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
  const posted = new Set<string>();
  // Iterate up to last 3 months (avoid huge backfill)
  for (let monthBack = 2; monthBack >= 0; monthBack--) {
    const m = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    for (const r of items) {
      const lastDayOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(r.day, lastDayOfMonth);
      const targetDate = new Date(m.getFullYear(), m.getMonth(), targetDay, 9, 0, 0);
      if (targetDate > now) continue;
      // Items saved before postedThrough existed share the global last-run stamp.
      const settled = r.postedThrough ? new Date(r.postedThrough).getTime() : lastRun;
      if (targetDate.getTime() <= settled) continue;
      const from =
        accounts.find((a) => a.id === r.acc) ??
        accounts.find((a) => a.scope === r.scope && a.main) ??
        accounts.find((a) => a.scope === r.scope) ??
        accounts[0];
      if (!from) continue;
      const id = `recur-${m.getFullYear()}-${m.getMonth()}-${r.id}`;
      if (existingIds.has(id)) continue;
      const out: Transaction = {
        id,
        date: targetDate.toISOString(),
        amount: -r.amount,
        cat: r.cat,
        merchant: r.name,
        memo: '정기결제 (자동)',
        acc: from.id,
        scope: r.scope,
        recurring: true,
      };
      const to = r.toAcc ? accounts.find((a) => a.id === r.toAcc && a.id !== from.id) : undefined;
      if (to) {
        // 적금·공제 납입: the money lands in another of my accounts, so post both legs.
        out.transferPairId = id;
        out.transferTo = to.id;
        newTxs.push(out, {
          id: `${id}-in`,
          date: out.date,
          amount: r.amount,
          // Not r.cat — a '저축' deposit leg would count the same saving twice.
          cat: to.scope === 'business' ? 'biz_transfer' : 'transfer',
          merchant: r.name,
          memo: out.memo,
          acc: to.id,
          scope: to.scope,
          recurring: true,
          transferPairId: id,
          transferTo: from.id,
        });
      } else {
        newTxs.push(out);
      }
      posted.add(r.id);
    }
  }

  if (newTxs.length === 0) return;

  newTxs.forEach(applyTxToAccounts);
  writeStorageValue(KEYS.transactions, [...newTxs, ...txs]);
  const stamp = now.toISOString();
  writeStorageValue(
    KEYS.recurring,
    items.map((r) => (posted.has(r.id) ? { ...r, postedThrough: stamp } : r)),
  );
  window.localStorage.setItem(LAST_RUN_KEY, stamp);
}
