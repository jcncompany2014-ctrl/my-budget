'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useMode } from '@/components/ModeProvider';
import { applyTxToAccounts, reverseTxFromAccounts, transferPairIds } from '@/lib/integrity';
import { setStoredItem } from '@/lib/safe-storage';
import { SEED_TRANSACTIONS } from '@/lib/seed';
import { KEYS } from '@/lib/storage-keys';
import { subscribeToKey, useHydrated } from '@/lib/store-factory';
import type { Transaction } from '@/lib/types';

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
  setStoredItem(KEY, JSON.stringify(tx));
}

function getCachedTx(): Transaction[] {
  if (cachedTx === null) cachedTx = loadFromStorage();
  return cachedTx;
}

function commitTx(next: Transaction[]) {
  // Persist first: if the write fails the screen must not show rows that are not saved.
  saveToStorage(next);
  cachedTx = next;
  txListeners.forEach((fn) => fn());
}

// The ensureAuto* generators (recurring, payroll, loan payments, credit-line
// interest) and integrity helpers write this key through store-factory, which
// bypasses the singleton. Without this bridge the stale cache was written back
// on the next add/remove — silently deleting whatever they had generated.
if (typeof window !== 'undefined') {
  const invalidate = () => {
    cachedTx = null;
    txListeners.forEach((fn) => fn());
  };
  subscribeToKey(KEY, invalidate);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) invalidate();
  });
}

/** Snapshot of every transaction (all scopes) — for non-React callers. */
export function allTransactions(): Transaction[] {
  return getCachedTx();
}

/** Insert transactions (newest-first order kept) and apply their balance effect. */
export function addTransactions(list: Transaction[]) {
  if (list.length === 0) return;
  // Rows before balances — a failed save must not leave a balance moved by a row that is gone.
  commitTx([...list, ...getCachedTx()]);
  list.forEach((t) => applyTxToAccounts(t));
}

/**
 * Remove a transaction. If it's a transfer leg, the paired leg is removed too.
 * Returns the removed transaction(s) for undo support.
 */
export function removeTransaction(id: string): Transaction[] {
  const cur = getCachedTx();
  const target = cur.find((t) => t.id === id);
  if (!target) return [];
  const idsToRemove = target.transferPairId ? transferPairIds(target, cur) : [id];
  const removed = cur.filter((t) => idsToRemove.includes(t.id));
  commitTx(cur.filter((t) => !idsToRemove.includes(t.id)));
  removed.forEach((t) => reverseTxFromAccounts(t));
  return removed;
}

/**
 * Edit a transaction. A transfer is two rows: amount, date and memo stay
 * identical on both legs (the amount with opposite sign), so editing one side
 * cannot leave money unaccounted for.
 */
export function updateTransaction(id: string, patch: Partial<Transaction>) {
  const cur = getCachedTx();
  const target = cur.find((t) => t.id === id);
  if (!target) return;
  const changes: [Transaction, Transaction][] = [[target, { ...target, ...patch }]];
  const pair = target.transferPairId
    ? cur.find((t) => t.id !== id && t.transferPairId === target.transferPairId)
    : undefined;
  if (pair) {
    const mirrored: Partial<Transaction> = {};
    if (patch.amount !== undefined) mirrored.amount = -patch.amount;
    if (patch.date !== undefined) mirrored.date = patch.date;
    if (patch.memo !== undefined) mirrored.memo = patch.memo;
    if (patch.acc !== undefined) mirrored.transferTo = patch.acc;
    if (Object.keys(mirrored).length > 0) changes.push([pair, { ...pair, ...mirrored }]);
  }
  const edited = new Map(changes.map(([old, now]) => [old.id, now]));
  commitTx(cur.map((t) => edited.get(t.id) ?? t));
  for (const [old, now] of changes) {
    if (now.amount !== old.amount || now.acc !== old.acc) {
      reverseTxFromAccounts(old);
      applyTxToAccounts(now);
    }
  }
}

/**
 * Set the same non-monetary fields (flags, category, ledger) on several rows in
 * one write. Amount and account are excluded — those move balances and go
 * through updateTransaction.
 */
export function patchTransactions(
  ids: string[],
  patch: Omit<Partial<Transaction>, 'id' | 'amount' | 'acc'>,
) {
  if (ids.length === 0) return;
  const set = new Set(ids);
  commitTx(getCachedTx().map((t) => (set.has(t.id) ? { ...t, ...patch } : t)));
}

export function useTransactions() {
  const { mode } = useMode();
  const all = useAllTransactions();
  const tx = useMemo(() => all.tx.filter((t) => (t.scope ?? 'personal') === mode), [all.tx, mode]);
  return { ...all, tx, allTx: all.tx };
}

function subscribeTx(fn: () => void) {
  txListeners.add(fn);
  return () => {
    txListeners.delete(fn);
  };
}
const serverTx = () => EMPTY_TX;

export function useAllTransactions() {
  const tx = useSyncExternalStore(subscribeTx, getCachedTx, serverTx);
  const ready = useHydrated();

  const add = (t: Transaction) => addTransactions([t]);

  const remove = (id: string): Transaction[] => removeTransaction(id);

  const update = updateTransaction;

  /** Restore a previously removed transaction (used by undo). */
  const restore = (txs: Transaction[]) => addTransactions(txs);

  return { tx, ready, add, remove, update, restore };
}
