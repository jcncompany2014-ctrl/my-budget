'use client';

import { computeMonthlyPayment, splitMonthlyPayment } from '@/lib/loans';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { Account, Loan, Transaction } from '@/lib/types';

const LAST_RUN_KEY = 'asset/auto-loan-last/v1';

/**
 * For every loan with autoPayment enabled, generate a debit transaction on
 * each paymentDay that has passed since last run (within the trailing 3
 * months — same backfill window as recurring), and decrement the loan's
 * remaining balance by the principal portion of that payment.
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
  // Mutable copy so successive months see the decremented remaining.
  const updatedLoans = loans.map((l) => ({ ...l }));

  for (let monthBack = 2; monthBack >= 0; monthBack--) {
    const m = new Date(now.getFullYear(), now.getMonth() - monthBack, 1);
    for (const loan of updatedLoans) {
      if (
        !loan.autoPayment ||
        !loan.linkedAccountId ||
        !loan.paymentDay ||
        loan.remaining <= 0
      ) {
        continue;
      }

      const lastDayOfMonth = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const targetDay = Math.min(loan.paymentDay, lastDayOfMonth);
      const targetDate = new Date(m.getFullYear(), m.getMonth(), targetDay, 9, 0, 0);
      if (targetDate > now) continue;
      if (targetDate.getTime() <= lastRun) continue;

      const id = `loan-${m.getFullYear()}-${m.getMonth()}-${loan.id}`;
      if (existingIds.has(id)) continue;

      const acc = accounts.find((a) => a.id === loan.linkedAccountId);
      if (!acc) continue;

      const monthlyPayment =
        loan.monthlyPayment ??
        computeMonthlyPayment(loan.principal, loan.rate, loan.termMonths);
      const { interest, principal } = splitMonthlyPayment(
        loan.remaining,
        loan.rate,
        monthlyPayment,
      );
      const totalPaid = interest + principal;
      if (totalPaid <= 0) continue;

      newTxs.push({
        id,
        date: targetDate.toISOString(),
        amount: -totalPaid,
        cat: 'loan_payment',
        merchant: loan.name,
        memo: `원금 ${principal.toLocaleString('ko-KR')} + 이자 ${interest.toLocaleString('ko-KR')} (자동)`,
        acc: loan.linkedAccountId,
        scope: loan.scope,
        recurring: true,
      });

      loan.remaining = Math.max(0, loan.remaining - principal);
    }
  }

  if (newTxs.length === 0) return;

  writeStorageValue(KEYS.transactions, [...newTxs, ...txs]);
  writeStorageValue(KEYS.loans, updatedLoans);
  window.localStorage.setItem(LAST_RUN_KEY, now.toISOString());
}
