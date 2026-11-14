import { autoCategorize } from '@/lib/auto-categorize';
import { CATEGORIES, isIncomeCategory, isTransferCategory } from '@/lib/categories';
import type { Account, Scope, Transaction } from '@/lib/types';

/**
 * 사업 대납 — business expenses paid with personal money.
 *
 * The row moves to the business ledger (so it counts as a business expense and
 * stops counting as personal spending) but keeps its personal account, whose
 * balance it already reduced. Until the business pays it back it is an amount
 * the business owes me: an asset on the personal side, a liability on the
 * business side. Settling posts one business → personal transfer.
 */

/** Rows the business still owes me for. */
export const isDue = (t: Transaction) => t.reimburse === 'due' && t.amount < 0;

export const dueTotal = (txs: Transaction[]) =>
  txs.reduce((s, t) => (isDue(t) ? s - t.amount : s), 0);

/** Can this row be flagged as paid on behalf of the business? */
export function canReimburse(t: Transaction, accounts: Account[]): boolean {
  if (t.amount >= 0 || t.transferPairId || isTransferCategory(t.cat)) return false;
  if ((t.scope ?? 'personal') !== 'personal') return false;
  return accounts.find((a) => a.id === t.acc)?.scope === 'personal';
}

function categoryFor(merchant: string, scope: Scope, history: Transaction[]): string {
  const cat = autoCategorize(merchant, scope, history);
  const ok =
    !!cat && CATEGORIES[cat]?.scope === scope && !isTransferCategory(cat) && !isIncomeCategory(cat);
  return ok ? cat : scope === 'business' ? 'biz_etc' : 'living';
}

/**
 * Whether a new charge at `merchant` should be filed as 대납 without asking:
 * the last purchases there (two or more, up to three) were all paid for the
 * business. One personal purchase in between switches it off again.
 */
export function usuallyReimbursed(merchant: string, history: Transaction[]): boolean {
  const key = merchant.trim().toLowerCase();
  if (!key) return false;
  const last: Transaction[] = [];
  for (const t of history) {
    if (t.amount >= 0 || t.transferPairId || t.merchant.trim().toLowerCase() !== key) continue;
    let i = last.length;
    while (i > 0 && last[i - 1].date < t.date) i--;
    if (i < 3) {
      last.splice(i, 0, t);
      if (last.length > 3) last.pop();
    }
  }
  return last.length >= 2 && last.every((t) => t.reimburse !== undefined);
}

/**
 * A 대납 row is normally a business cost. One that is not — an instalment
 * purchase the business will pay back over time, say — is carried as debt only:
 * it stays on the 정산 list and in both ledgers' net worth, but under a transfer
 * category, so it is in nobody's spending or P&L.
 */
export const DEBT_ONLY_CAT = 'biz_transfer';
export const isCosted = (t: Transaction) => t.cat !== DEBT_ONLY_CAT;

/** Carry a 대납 row as debt only, or count it as a business cost again. */
export function costPatch(
  t: Transaction,
  costed: boolean,
  history: Transaction[],
): Partial<Transaction> {
  return { cat: costed ? categoryFor(t.merchant, 'business', history) : DEBT_ONLY_CAT };
}

/** The fields to change so a personal expense becomes a business one I am owed for. */
export function toBusinessPatch(t: Transaction, history: Transaction[]): Partial<Transaction> {
  return { scope: 'business', cat: categoryFor(t.merchant, 'business', history), reimburse: 'due' };
}

/** …and back: it was my own spending after all. */
export function toPersonalPatch(t: Transaction, history: Transaction[]): Partial<Transaction> {
  return {
    scope: 'personal',
    cat: categoryFor(t.merchant, 'personal', history),
    reimburse: undefined,
  };
}

/**
 * The transfer that settles `rows`: one leg out of the business account, one
 * into the personal account, both outside income and expense.
 */
export function buildSettlement(args: {
  rows: Transaction[];
  from: Account;
  to: Account;
  /** ISO timestamp for both legs. */
  date: string;
  /** Unique suffix for the ids (callers pass a timestamp). */
  seq: string;
}): Transaction[] {
  const { rows, from, to, date, seq } = args;
  const amount = dueTotal(rows);
  if (amount <= 0) return [];
  const pairId = `settle-${seq}`;
  const memo = `대납 ${rows.filter(isDue).length}건 정산`;
  const leg = (out: boolean): Transaction => ({
    id: `${pairId}-${out ? 'a' : 'b'}`,
    date,
    amount: out ? -amount : amount,
    // 사장 인출 / 사장 보수 are the cross-ledger transfer categories — neither is income nor expense.
    cat: out ? 'biz_owner_draw' : 'owner_pay',
    merchant: out ? `대납 정산 → ${to.name}` : `대납 정산 ← ${from.name}`,
    memo,
    acc: out ? from.id : to.id,
    scope: out ? from.scope : to.scope,
    transferPairId: pairId,
    transferTo: out ? to.id : from.id,
    transferCrossMode: from.scope !== to.scope,
  });
  return [leg(true), leg(false)];
}
