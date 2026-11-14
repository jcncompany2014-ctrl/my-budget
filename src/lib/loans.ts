'use client';

import { localDayKey, parseLocalDay } from '@/lib/dates';
import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { Loan } from '@/lib/types';

/** Standard amortized monthly payment given P, annual rate %, term months. */
export function computeMonthlyPayment(principal: number, annualRate: number, months: number) {
  if (months <= 0) return 0;
  if (annualRate <= 0) return Math.round(principal / months);
  const r = annualRate / 100 / 12;
  return Math.round((principal * r) / (1 - (1 + r) ** -months));
}

/**
 * Split a single monthly payment into interest and principal portions for an
 * amortized loan, given the remaining balance and annual rate. Caps principal
 * at remaining so the final installment doesn't underflow when monthlyPayment
 * is slightly larger than what's left to amortize.
 */
export function splitMonthlyPayment(remaining: number, annualRate: number, monthlyPayment: number) {
  const interest = Math.max(0, Math.round(remaining * (annualRate / 100 / 12)));
  const principal = Math.max(0, Math.min(remaining, monthlyPayment - interest));
  return { interest, principal };
}

type Schedule = Pick<
  Loan,
  | 'principal'
  | 'remaining'
  | 'rate'
  | 'termMonths'
  | 'monthlyPayment'
  | 'startDate'
  | 'paymentEveryMonths'
  | 'paymentAnchor'
  | 'graceUntil'
>;

const toDate = (s: string | undefined): Date | null => {
  if (!s) return null;
  const d = /^\d{4}-\d{1,2}-\d{1,2}$/.test(s) ? parseLocalDay(s) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
};

/** Months between payments: 1 = monthly, 3 = quarterly (정책자금 등 분기 이자). */
export const paymentEvery = (loan: Pick<Loan, 'paymentEveryMonths'>) => {
  const n = Math.round(loan.paymentEveryMonths ?? 1);
  return n >= 1 ? n : 1;
};

/**
 * Whether the loan pays in the given month. A loan paid every N months is
 * counted from one known payment date (`paymentAnchor`, else the loan date).
 */
export function isPaymentMonth(loan: Schedule, year: number, month: number): boolean {
  const every = paymentEvery(loan);
  if (every === 1) return true;
  const anchor = toDate(loan.paymentAnchor) ?? toDate(loan.startDate);
  // No date to count from: quarter ends, the usual convention.
  if (!anchor) return (month + 1) % every === 0;
  const diff = (year - anchor.getFullYear()) * 12 + month - anchor.getMonth();
  return ((diff % every) + every) % every === 0;
}

/**
 * Interest and principal of the payment due on `due`.
 *
 * - 거치 기간 (`graceUntil`): interest only.
 * - Monthly loan with no grace period: the fixed monthly payment (원리금균등).
 * - Otherwise — after a grace period, or paid every few months — what is left
 *   is spread evenly over the payments remaining until the loan ends.
 */
export function loanPayment(loan: Schedule, due: Date): { interest: number; principal: number } {
  const every = paymentEvery(loan);
  const periodRate = (loan.rate / 100 / 12) * every;
  const interest = Math.max(0, Math.round(loan.remaining * periodRate));
  if (loan.graceUntil && localDayKey(due) <= loan.graceUntil) return { interest, principal: 0 };

  if (every === 1 && !loan.graceUntil) {
    const monthly =
      loan.monthlyPayment ?? computeMonthlyPayment(loan.principal, loan.rate, loan.termMonths);
    return splitMonthlyPayment(loan.remaining, loan.rate, monthly);
  }

  const start = toDate(loan.startDate);
  let payments = 1;
  if (start) {
    const end = new Date(start.getFullYear(), start.getMonth() + loan.termMonths, 1);
    const monthsLeft =
      (end.getFullYear() - due.getFullYear()) * 12 + end.getMonth() - due.getMonth();
    payments = Math.max(1, Math.floor(monthsLeft / every) + 1);
  }
  const pay =
    periodRate > 0
      ? (loan.remaining * periodRate) / (1 - (1 + periodRate) ** -payments)
      : loan.remaining / payments;
  return {
    interest,
    principal: Math.max(0, Math.min(loan.remaining, Math.round(pay) - interest)),
  };
}

export type LoanDue = { date: Date; daysUntil: number; interest: number; principal: number };

/** The next payment that has not been posted yet, or null without a payment day. */
export function nextLoanDue(loan: Loan, now: Date = new Date()): LoanDue | null {
  if (!loan.paymentDay || loan.remaining <= 0) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const settled = loan.autoPayment && loan.postedThrough ? Date.parse(loan.postedThrough) : 0;
  for (let i = 0; i <= 24; i++) {
    const first = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const y = first.getFullYear();
    const m = first.getMonth();
    if (!isPaymentMonth(loan, y, m)) continue;
    const day = Math.min(loan.paymentDay, new Date(y, m + 1, 0).getDate());
    const dueDay = new Date(y, m, day);
    if (dueDay.getTime() < today.getTime()) continue;
    const date = new Date(y, m, day, 9, 0, 0);
    // Today's payment has already been posted — the next one is a period away.
    if (date.getTime() <= settled) continue;
    return {
      date,
      daysUntil: Math.round((dueDay.getTime() - today.getTime()) / 86_400_000),
      ...loanPayment(loan, date),
    };
  }
  return null;
}

export const useLoans = createListStore<Loan>(KEYS.loans);
