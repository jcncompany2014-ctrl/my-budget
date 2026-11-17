'use client';

import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Loan, Transaction } from '@/lib/types';

/**
 * What a row means beyond its own account balance — kept in step when the row
 * is deleted, restored or re-priced:
 *
 *  - a 대납 settlement transfer marks the rows it paid back as done, so taking
 *    the transfer out makes them owed again (and an undo settles them again);
 *  - an auto-posted principal repayment lowered its loan's remaining balance,
 *    so taking the row out gives that principal back.
 */

function settledBy(rows: Transaction[]): Set<string> {
  const ids = new Set<string>();
  for (const t of rows) for (const id of t.settles ?? []) ids.add(id);
  return ids;
}

function flip(ledger: Transaction[], ids: Set<string>, to: 'due' | 'done'): Transaction[] {
  if (ids.size === 0) return ledger;
  const from = to === 'due' ? 'done' : 'due';
  return ledger.map((t) => (ids.has(t.id) && t.reimburse === from ? { ...t, reimburse: to } : t));
}

/** `removed` left the ledger: what they had settled is owed again. */
export const unsettle = (ledger: Transaction[], removed: Transaction[]) =>
  flip(ledger, settledBy(removed), 'due');

/** `added` joined the ledger (a new settlement, or an undone delete): its rows are paid back. */
export const settle = (ledger: Transaction[], added: Transaction[]) =>
  flip(ledger, settledBy(added), 'done');

const PRINCIPAL_CATS = new Set(['loan_principal', 'biz_loan_principal']);

/** The generator's own principal rows: `loan-{year}-{month}-{loanId}` or `…-p`. */
const isAutoPrincipal = (t: Transaction) => t.id.startsWith('loan-') && PRINCIPAL_CATS.has(t.cat);

/**
 * Give back (`+1`, the rows were removed) or take again (`-1`, they were
 * restored) the principal that auto-posted repayment rows moved on their loans.
 */
export function movePrincipal(rows: Transaction[], sign: 1 | -1) {
  const mine = rows.filter(isAutoPrincipal);
  if (mine.length === 0) return;
  const loans = readStorageValue<Loan[]>(KEYS.loans, []);
  let changed = false;
  const next = loans.map((l) => {
    let delta = 0;
    for (const t of mine) {
      if (t.id.endsWith(`-${l.id}`) || t.id.endsWith(`-${l.id}-p`)) delta += Math.abs(t.amount);
    }
    if (delta === 0) return l;
    changed = true;
    return { ...l, remaining: Math.max(0, l.remaining + sign * delta) };
  });
  if (changed) writeStorageValue(KEYS.loans, next);
}
