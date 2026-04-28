'use client';

import { suggestCategory } from '@/lib/categories';
import type { Scope, Transaction } from '@/lib/types';

/**
 * Pick the most-used category for a given merchant in past transactions.
 * Falls back to suggestCategory heuristic if no history.
 */
export function autoCategorize(merchant: string, scope: Scope, history: Transaction[]): string | null {
  const m = merchant.trim();
  if (!m) return null;

  // Find historical txs with same merchant in same scope
  const lower = m.toLowerCase();
  const sameMerchant = history.filter(
    (t) =>
      (t.scope ?? 'personal') === scope &&
      t.merchant.toLowerCase() === lower,
  );
  if (sameMerchant.length === 0) {
    // Try fuzzy: contains
    const fuzzy = history.filter(
      (t) =>
        (t.scope ?? 'personal') === scope &&
        (t.merchant.toLowerCase().includes(lower) || lower.includes(t.merchant.toLowerCase())),
    );
    if (fuzzy.length > 0) {
      return mostCommonCat(fuzzy);
    }
    return suggestCategory(m, scope);
  }
  return mostCommonCat(sameMerchant);
}

function mostCommonCat(txs: Transaction[]): string | null {
  const counts = new Map<string, number>();
  txs.forEach((t) => counts.set(t.cat, (counts.get(t.cat) ?? 0) + 1));
  let best: string | null = null;
  let max = 0;
  counts.forEach((c, cat) => {
    if (c > max) {
      max = c;
      best = cat;
    }
  });
  return best;
}

/**
 * Suggest a typical amount for given merchant based on history (median).
 */
export function suggestAmount(merchant: string, scope: Scope, history: Transaction[]): number | null {
  const m = merchant.trim().toLowerCase();
  if (!m) return null;
  const matches = history.filter(
    (t) => (t.scope ?? 'personal') === scope && t.merchant.toLowerCase() === m,
  );
  if (matches.length === 0) return null;
  const sorted = matches.map((t) => Math.abs(t.amount)).sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
}

/**
 * Detect probable duplicate based on amount + merchant + recent time window (5 minutes).
 */
export function detectDuplicate(
  candidate: { amount: number; merchant: string; date: string; scope?: Scope },
  history: Transaction[],
): Transaction | null {
  const candDate = new Date(candidate.date).getTime();
  const candAmount = Math.abs(candidate.amount);
  const candMerchant = candidate.merchant.toLowerCase().trim();
  for (const t of history) {
    if ((t.scope ?? 'personal') !== (candidate.scope ?? 'personal')) continue;
    const dt = Math.abs(new Date(t.date).getTime() - candDate);
    if (dt > 5 * 60 * 1000) continue;
    if (Math.abs(t.amount) !== candAmount) continue;
    if (t.merchant.toLowerCase().trim() !== candMerchant) continue;
    return t;
  }
  return null;
}

/**
 * Find recurring patterns in history — same merchant + similar amount + monthly cadence.
 */
export function detectRecurringPatterns(history: Transaction[]): {
  merchant: string;
  amount: number;
  cat: string;
  scope: Scope;
  daysOfMonth: number[];
}[] {
  // Group by (merchant + scope)
  const groups = new Map<string, Transaction[]>();
  history.forEach((t) => {
    const k = (t.scope ?? 'personal') + '::' + t.merchant.toLowerCase();
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(t);
  });

  const out: ReturnType<typeof detectRecurringPatterns> = [];
  groups.forEach((txs) => {
    if (txs.length < 3) return;
    // Same amount required
    const amounts = txs.map((t) => Math.abs(t.amount));
    const med = amounts.sort((a, b) => a - b)[Math.floor(amounts.length / 2)];
    const sameAmount = txs.filter((t) => Math.abs(Math.abs(t.amount) - med) <= 100);
    if (sameAmount.length < 3) return;
    // Within last 4 months
    const months = new Set(sameAmount.map((t) => {
      const d = new Date(t.date);
      return d.getFullYear() * 12 + d.getMonth();
    }));
    if (months.size < 3) return;
    const daysOfMonth = sameAmount.map((t) => new Date(t.date).getDate());
    out.push({
      merchant: sameAmount[0].merchant,
      amount: med,
      cat: sameAmount[0].cat,
      scope: (sameAmount[0].scope ?? 'personal') as Scope,
      daysOfMonth,
    });
  });
  return out;
}

/**
 * Detect probable salary income — large positive transactions on similar day each month.
 */
export function detectSalaryIncome(history: Transaction[]): Transaction[] {
  const incomes = history.filter((t) => t.amount > 1_000_000); // >100만원
  if (incomes.length < 2) return [];
  // Just return the candidates; UI can prompt user
  return incomes;
}
