'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { applyTxToAccounts, reverseTxFromAccounts, transferPairIds } from '@/lib/integrity';
import { SEED_TRANSACTIONS } from '@/lib/seed';
import { KEYS } from '@/lib/storage-keys';
import type { Scope, Transaction } from '@/lib/types';

const KEY = KEYS.transactions;

function normalize(list: Transaction[]): Transaction[] {
  return list.map((t) => (t.scope ? t : { ...t, scope: 'personal' }));
}

function loadFromStorage(): Transaction[] {
  if (typeof window === 'undefined') return normalize(SEED_TRANSACTIONS);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw) as Transaction[]);
  } catch {
    // fall through
  }
  return normalize(SEED_TRANSACTIONS);
}

function saveToStorage(tx: Transaction[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(tx));
}

export function useTransactions() {
  const { mode } = useMode();
  const all = useAllTransactions();
  const tx = useMemo(
    () => all.tx.filter((t) => (t.scope ?? 'personal') === mode),
    [all.tx, mode],
  );
  return { ...all, tx, allTx: all.tx };
}

export function useAllTransactions() {
  const [tx, setTx] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const data = loadFromStorage();
    setTx(data);
    setReady(true);
    if (typeof window !== 'undefined' && !window.localStorage.getItem(KEY)) {
      saveToStorage(data);
    }
  }, []);

  const add = (t: Transaction) => {
    applyTxToAccounts(t);
    setTx((prev) => {
      const next = [t, ...prev];
      saveToStorage(next);
      return next;
    });
  };

  /**
   * Remove a transaction. If it's a transfer leg, the paired leg is removed too.
   * Returns the removed transaction(s) for undo support.
   */
  const remove = (id: string): Transaction[] => {
    let removed: Transaction[] = [];
    setTx((prev) => {
      const target = prev.find((t) => t.id === id);
      if (!target) return prev;
      const idsToRemove = target.transferPairId ? transferPairIds(target, prev) : [id];
      removed = prev.filter((t) => idsToRemove.includes(t.id));
      removed.forEach((t) => reverseTxFromAccounts(t));
      const next = prev.filter((t) => !idsToRemove.includes(t.id));
      saveToStorage(next);
      return next;
    });
    return removed;
  };

  const update = (id: string, patch: Partial<Transaction>) => {
    setTx((prev) => {
      const cur = prev.find((t) => t.id === id);
      if (!cur) return prev;
      const oldAmount = cur.amount;
      const oldAcc = cur.acc;
      const merged = { ...cur, ...patch };
      // Sync account balances if amount or account changed
      if (patch.amount !== undefined && patch.amount !== oldAmount) {
        // Reverse old, apply new
        reverseTxFromAccounts(cur);
        applyTxToAccounts(merged);
      } else if (patch.acc !== undefined && patch.acc !== oldAcc) {
        reverseTxFromAccounts(cur);
        applyTxToAccounts(merged);
      }
      const next = prev.map((t) => (t.id === id ? merged : t));
      saveToStorage(next);
      return next;
    });
  };

  /** Restore a previously removed transaction (used by undo). */
  const restore = (txs: Transaction[]) => {
    txs.forEach((t) => applyTxToAccounts(t));
    setTx((prev) => {
      const next = [...txs, ...prev];
      saveToStorage(next);
      return next;
    });
  };

  return { tx, ready, add, remove, update, restore };
}

export function txCountByScope(tx: Transaction[]): Record<Scope, number> {
  return tx.reduce(
    (acc, t) => {
      const s = t.scope ?? 'personal';
      acc[s] += 1;
      return acc;
    },
    { personal: 0, business: 0 } as Record<Scope, number>,
  );
}
