'use client';

import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Account, Transaction } from '@/lib/types';

/**
 * Compute net balance change for an account from a set of transactions.
 */
export function computeAccountDelta(accId: string, txs: Transaction[]): number {
  return txs
    .filter((t) => t.acc === accId)
    .reduce((s, t) => s + t.amount, 0);
}

/**
 * Recompute every account's balance from initial seed + all transactions.
 * Called after bulk operations or repair.
 *
 * Note: We don't have "initial balance" separate from transactions yet, so
 * this assumes balance reflects what user manually entered. We keep balance
 * in sync by adjusting it on add/remove/update of a transaction.
 */
export function adjustAccountBalance(accId: string, delta: number) {
  if (!accId) return;
  const accounts = readStorageValue<Account[]>(KEYS.accounts, []);
  const next = accounts.map((a) =>
    a.id === accId ? { ...a, balance: Math.round((a.balance + delta) * 100) / 100 } : a,
  );
  writeStorageValue(KEYS.accounts, next);
}

/**
 * Apply transaction delta to source/destination accounts.
 * Use when adding a tx.
 */
export function applyTxToAccounts(tx: Transaction) {
  // Single tx (income/expense): balance += amount (negative for expense)
  // Transfer leg already has sign baked in
  adjustAccountBalance(tx.acc, tx.amount);
}

/** Reverse the effect of a transaction (use when deleting / undoing) */
export function reverseTxFromAccounts(tx: Transaction) {
  adjustAccountBalance(tx.acc, -tx.amount);
}

/**
 * Find the paired leg of a transfer transaction.
 */
export function findTransferPair(tx: Transaction, all: Transaction[]): Transaction | null {
  if (!tx.transferPairId) return null;
  return all.find((t) => t.id !== tx.id && t.transferPairId === tx.transferPairId) ?? null;
}

/**
 * When deleting a transfer leg, also delete its pair.
 * Returns ids to remove.
 */
export function transferPairIds(tx: Transaction, all: Transaction[]): string[] {
  if (!tx.transferPairId) return [tx.id];
  const ids = all
    .filter((t) => t.transferPairId === tx.transferPairId)
    .map((t) => t.id);
  return ids;
}

/**
 * If an account is deleted, mark its transactions as orphaned.
 * Uses placeholder accId 'deleted-account'.
 */
export const ORPHAN_ACCOUNT_ID = 'deleted-account';

export function reassignTxsForDeletedAccount(deletedAccId: string) {
  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const next = txs.map((t) => (t.acc === deletedAccId ? { ...t, acc: ORPHAN_ACCOUNT_ID } : t));
  writeStorageValue(KEYS.transactions, next);
}
