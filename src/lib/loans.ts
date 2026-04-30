'use client';

import { useEffect, useState } from 'react';
import type { Loan } from '@/lib/types';

const KEY = 'asset/loans/v1';

function load(): Loan[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Loan[];
  } catch {
    /* */
  }
  return [];
}
function save(list: Loan[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

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

export function useLoans() {
  const [items, setItems] = useState<Loan[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (l: Loan) => {
    setItems((prev) => {
      const next = [...prev, l];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<Loan>) => {
    setItems((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((l) => l.id !== id);
      save(next);
      return next;
    });
  };

  return { items, ready, add, update, remove };
}
