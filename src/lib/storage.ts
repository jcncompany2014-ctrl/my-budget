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

// ─── Module-level singleton ───
// Many components call useAllTransactions independently. Without a shared
// cache each one parses the entire transaction array on mount, and an
// add/remove only updates its own useState — other consumers see stale data
// until they remount. The singleton fixes both: one parse, one source of
// truth, listener fan-out on writes.

let cachedTx: Transaction[] | null = null;
const txListeners = new Set<() => void>();
const EMPTY_TX: Transaction[] = [];

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

function getCachedTx(): Transaction[] {
  if (cachedTx === null) cachedTx = loadFromStorage();
  return cachedTx;
}

function commitTx(next: Transaction[]) {
  cachedTx = next;
  saveToStorage(next);
  txListeners.forEach((fn) => fn());
}

export function useTransactions() {
  const { mode } = useMode();
  const all = useAllTransactions();
  const tx = useMemo(() => all.tx.filter((t) => (t.scope ?? 'personal') === mode), [all.tx, mode]);
  return { ...all, tx, allTx: all.tx };
}

export function useAllTransactions() {
  const [tx, setTx] = useState<Transaction[]>(EMPTY_TX);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setTx(getCachedTx());
    setReady(true);
    if (typeof window !== 'undefined' && !window.localStorage.getItem(KEY)) {
      saveToStorage(cachedTx!);
    }
    const refresh = () => setTx(getCachedTx());
    txListeners.add(refresh);
    return () => {
      txListeners.delete(refresh);
    };
  }, []);

  const add = (t: Transaction) => {
    applyTxToAccounts(t);
    commitTx([t, ...getCachedTx()]);
  };

  /**
   * Remove a transaction. If it's a transfer leg, the paired leg is removed too.
   * Returns the removed transaction(s) for undo support.
   */
  const remove = (id: string): Transaction[] => {
    const cur = getCachedTx();
    const target = cur.find((t) => t.id === id);
    if (!target) return [];
    const idsToRemove = target.transferPairId ? transferPairIds(target, cur) : [id];
    const removed = cur.filter((t) => idsToRemove.includes(t.id));
    removed.forEach((t) => reverseTxFromAccounts(t));
    commitTx(cur.filter((t) => !idsToRemove.includes(t.id)));
    return removed;
  };

  const update = (id: string, patch: Partial<Transaction>) => {
    const cur = getCachedTx();
    const target = cur.find((t) => t.id === id);
    if (!target) return;
    const oldAmount = target.amount;
    const oldAcc = target.acc;
    const merged = { ...target, ...patch };
    if (patch.amount !== undefined && patch.amount !== oldAmount) {
      reverseTxFromAccounts(target);
      applyTxToAccounts(merged);
    } else if (patch.acc !== undefined && patch.acc !== oldAcc) {
      reverseTxFromAccounts(target);
      applyTxToAccounts(merged);
    }
    commitTx(cur.map((t) => (t.id === id ? merged : t)));
  };

  /** Restore a previously removed transaction (used by undo). */
  const restore = (txs: Transaction[]) => {
    txs.forEach((t) => applyTxToAccounts(t));
    commitTx([...txs, ...getCachedTx()]);
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
