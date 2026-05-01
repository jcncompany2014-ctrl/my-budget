'use client';

import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { Loan } from '@/lib/types';

/** Standard amortized monthly payment given P, annual rate %, term months. */
export function computeMonthlyPayment(principal: number, annualRate: number, months: number) {
  if (months <= 0) return 0;
  if (annualRate <= 0) return Math.round(principal / months);
  const r = annualRate / 100 / 12;
  return Math.round((principal * r) / (1 - Math.pow(1 + r, -months)));
}

/**
 * Split a single monthly payment into interest and principal portions for an
 * amortized loan, given the remaining balance and annual rate. Caps principal
 * at remaining so the final installment doesn't underflow when monthlyPayment
 * is slightly larger than what's left to amortize.
 */
export function splitMonthlyPayment(
  remaining: number,
  annualRate: number,
  monthlyPayment: number,
) {
  const interest = Math.max(0, Math.round(remaining * (annualRate / 100 / 12)));
  const principal = Math.max(0, Math.min(remaining, monthlyPayment - interest));
  return { interest, principal };
}

export const useLoans = createListStore<Loan>(KEYS.loans);
