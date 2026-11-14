'use client';

import { applyTxToAccounts } from '@/lib/integrity';
import { computeMonthlyPayment, splitMonthlyPayment } from '@/lib/loans';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Account, Loan, Transaction } from '@/lib/types';

const LAST_RUN_KEY = 'asset/auto-loan-last/v1';

/**
 * For every loan with autoPayment enabled, generate a debit transaction on
 * each paymentDay that has passed since the loan was last settled (within the
 * trailing 3 months — same backfill window as recurring), debit the linked
 * account (interest and principal as separate rows), and decrement the loan's
 * remaining balance by the principal portion of that payment. `postedThrough` is stamped when auto payment is
 * switched on, so payments the entered `remaining` already reflects are skipped.
 *
 * Idempotent: each (loan id, year, month) combo creates at most one tx,
 * keyed by `loan-{year}-{month}-{loanId}`. If the user changes paymentDay
 * later, already-processed months are not retried.
 */
export function ensureAutoLoanPayment() {
  if (typeof window === 'undefined') return;

  const loans = readStorageValue<Loan[]>(KEYS.loans, []);
  const eligible = loans.filter(
    (l) =>
      l.autoPayment &&
      !!l.linkedAccountId &&
      !!l.paymentDay &&
      l.paymentDay >= 1 &&
      l.paymentDay <= 31 &&
      l.remaining > 0,
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
  const posted = new Set<string>();
  // Mutable copy so successive months see the decremented remaining.
  const updatedLoans = loans.map((l) => ({ ...l }));

  for (let monthBack = 2; monthBack >= 0; monthBack--) {
    const m = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    for (const loan of updatedLoans) {
      if (!loan.autoPayment || !loan.linkedAccountId || !loan.paymentDay || loan.remaining <= 0) {
        continue;
      }

      const lastDayOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(loan.paymentDay, lastDayOfMonth);
      const targetDate = new Date(m.getFullYear(), m.getMonth(), targetDay, 9, 0, 0);
      if (targetDate > now) continue;
      // Loans saved before postedThrough existed share the global last-run stamp.
      const settled = loan.postedThrough ? new Date(loan.postedThrough).getTime() : lastRun;
      if (targetDate.getTime() <= settled) continue;

      const id = `loan-${m.getFullYear()}-${m.getMonth()}-${loan.id}`;
      if (existingIds.has(id)) continue;

      const acc = accounts.find((a) => a.id === loan.linkedAccountId);
      if (!acc) continue;

      const monthlyPayment =
        loan.monthlyPayment ?? computeMonthlyPayment(loan.principal, loan.rate, loan.termMonths);
      const { interest, principal } = splitMonthlyPayment(
        loan.remaining,
        loan.rate,
        monthlyPayment,
      );
      if (interest + principal <= 0) continue;

      // Two rows: the interest is spending, the principal only moves money to the debt.
      const row = {
        date: targetDate.toISOString(),
        merchant: loan.name,
        acc: loan.linkedAccountId,
        scope: loan.scope,
        recurring: true,
      };
      if (interest > 0) {
        newTxs.push({ ...row, id, amount: -interest, cat: 'loan_payment', memo: '이자 (자동)' });
      }
      if (principal > 0) {
        newTxs.push({
          ...row,
          id: interest > 0 ? `${id}-p` : id,
          amount: -principal,
          cat: 'loan_principal',
          memo: '원금 상환 (자동)',
        });
      }

      loan.remaining = Math.max(0, loan.remaining - principal);
      posted.add(loan.id);
    }
  }

  if (newTxs.length === 0) return;

  newTxs.forEach(applyTxToAccounts);
  writeStorageValue(KEYS.transactions, [...newTxs, ...txs]);
  const stamp = now.toISOString();
  writeStorageValue(
    KEYS.loans,
    updatedLoans.map((l) => (posted.has(l.id) ? { ...l, postedThrough: stamp } : l)),
  );
  window.localStorage.setItem(LAST_RUN_KEY, stamp);
}
