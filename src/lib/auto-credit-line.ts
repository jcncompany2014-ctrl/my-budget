'use client';

import { computeMonthlyInterest } from '@/lib/credit-lines';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Account, LineOfCredit, Transaction } from '@/lib/types';

const LAST_RUN_KEY = 'asset/auto-credit-line-last/v1';

/**
 * For every line of credit with autoInterest enabled, debit the linked
 * account once per month on interestDay for the interest accrued on the
 * outstanding balance. Mirrors auto-loan-payment.ts in shape and idempotency
 * model.
 *
 * v1 'account mode' only: interest leaves linkedAccount, used is unchanged.
 * A future iteration may add 'rolling mode' where interest gets added to
 * `used` instead — but that needs UI to pick the mode and it's out of scope.
 *
 * Categorization reuses 'loan_payment' rather than introducing a separate
 * credit-line category; the memo distinguishes ('마이너스 통장 이자').
 */
export function ensureAutoCreditLine() {
  if (typeof window === 'undefined') return;

  const lines = readStorageValue<LineOfCredit[]>(KEYS.creditLines, []);
  const eligible = lines.filter(
    (l) =>
      l.autoInterest &&
      !!l.linkedAccountId &&
      !!l.interestDay &&
      l.interestDay >= 1 &&
      l.interestDay <= 31 &&
      l.used > 0 &&
      l.rate > 0,
  );
  if (eligible.length === 0) return;

  const accounts = readStorageValue<Account[]>(KEYS.accounts, []);
  if (accounts.length === 0) return;

  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const existingIds = new Set(txs.map((t) => t.id));

  const lastRunStr = window.localStorage.getItem(LAST_RUN_KEY);
  const lastRun = lastRunStr ? new Date(lastRunStr).getTime() : 0;
  const now = new Date();

  const newTxs: Transaction[] = [];

  for (let monthBack = 2; monthBack >= 0; monthBack--) {
    const m = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    for (const line of eligible) {
      const lastDayOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(line.interestDay ?? 1, lastDayOfMonth);
      const targetDate = new Date(m.getFullYear(), m.getMonth(), targetDay, 9, 0, 0);
      if (targetDate > now) continue;
      if (targetDate.getTime() <= lastRun) continue;

      const id = `loc-${m.getFullYear()}-${m.getMonth()}-${line.id}`;
      if (existingIds.has(id)) continue;

      const acc = accounts.find((a) => a.id === line.linkedAccountId);
      if (!acc) continue;

      const interest = computeMonthlyInterest(line.used, line.rate);
      if (interest <= 0) continue;

      newTxs.push({
        id,
        date: targetDate.toISOString(),
        amount: -interest,
        cat: 'loan_payment',
        merchant: line.name,
        memo: `마이너스 통장 이자 (자동)`,
        acc: line.linkedAccountId!,
        scope: line.scope,
        recurring: true,
      });
    }
  }

  if (newTxs.length === 0) return;

  writeStorageValue(KEYS.transactions, [...newTxs, ...txs]);
  window.localStorage.setItem(LAST_RUN_KEY, now.toISOString());
}
