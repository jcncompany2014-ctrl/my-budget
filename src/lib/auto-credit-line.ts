'use client';

import { computeMonthlyInterest } from '@/lib/credit-lines';
import { applyTxToAccounts } from '@/lib/integrity';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Account, LineOfCredit, Transaction } from '@/lib/types';

const isOn = (l: LineOfCredit) =>
  !!l.autoInterest &&
  !!l.linkedAccountId &&
  !!l.interestDay &&
  l.interestDay >= 1 &&
  l.interestDay <= 31;

/**
 * For every line of credit with autoInterest enabled, debit the linked
 * account once per month on interestDay for the interest accrued on the
 * outstanding balance.
 *
 * Each line carries its own `postedThrough` cursor. A line seen for the first
 * time (new, or auto interest just switched on) is stamped and nothing is
 * posted — only interest days from then on generate a row. Without that, a
 * line entered today was charged three months of interest at once. Switching
 * auto interest off drops the cursor, so switching it back on starts fresh.
 *
 * v1 'account mode' only: interest leaves linkedAccount, used is unchanged.
 * Categorised as 'loan_payment' (대출 이자); the memo tells it apart.
 */
export function ensureAutoCreditLine() {
  if (typeof window === 'undefined') return;

  const lines = readStorageValue<LineOfCredit[]>(KEYS.creditLines, []);
  if (lines.length === 0) return;

  const accounts = readStorageValue<Account[]>(KEYS.accounts, []);
  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const existingIds = new Set(txs.map((t) => t.id));
  const now = new Date();
  const stamp = now.toISOString();

  const newTxs: Transaction[] = [];
  let changed = false;

  const next = lines.map((line): LineOfCredit => {
    if (!isOn(line)) {
      if (!line.postedThrough) return line;
      changed = true;
      const off = { ...line };
      delete off.postedThrough;
      return off;
    }
    if (!line.postedThrough) {
      changed = true;
      return { ...line, postedThrough: stamp };
    }

    const settled = new Date(line.postedThrough).getTime();
    let due = false;
    // Up to the last 3 months — a long absence does not post a year of interest.
    for (let monthBack = 2; monthBack >= 0; monthBack--) {
      const m = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
      const lastDayOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(line.interestDay ?? 1, lastDayOfMonth);
      const targetDate = new Date(m.getFullYear(), m.getMonth(), targetDay, 9, 0, 0);
      if (targetDate > now || targetDate.getTime() <= settled) continue;
      // The day has passed either way: a month with nothing drawn must not be
      // charged later at whatever the balance has become by then.
      due = true;

      const id = `loc-${m.getFullYear()}-${m.getMonth()}-${line.id}`;
      if (existingIds.has(id)) continue;
      if (!accounts.some((a) => a.id === line.linkedAccountId)) continue;
      const interest = computeMonthlyInterest(line.used, line.rate);
      if (interest <= 0) continue;

      newTxs.push({
        id,
        date: targetDate.toISOString(),
        amount: -interest,
        cat: 'loan_payment',
        merchant: line.name,
        memo: '마이너스 통장 이자 (자동)',
        acc: line.linkedAccountId as string,
        scope: line.scope,
        recurring: true,
      });
    }
    if (!due) return line;
    changed = true;
    return { ...line, postedThrough: stamp };
  });

  if (newTxs.length > 0) {
    // Rows first: a failed save must not leave a balance moved by a row that is gone.
    writeStorageValue(KEYS.transactions, [...newTxs, ...txs]);
    newTxs.forEach(applyTxToAccounts);
  }
  if (changed) writeStorageValue(KEYS.creditLines, next);
}
