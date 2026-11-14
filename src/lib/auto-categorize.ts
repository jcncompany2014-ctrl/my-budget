'use client';

import { classifyBayes, getBayesModel } from '@/lib/bayes';
import { suggestCategory } from '@/lib/categories';
import { isExpense, isIncome } from '@/lib/format';
import type { Scope, Transaction } from '@/lib/types';

const BAYES_MIN_HISTORY = 10;
const BAYES_MIN_CONFIDENCE = 0.1;

/**
 * Resolve a category for the given merchant. Layered strategy, fastest +
 * highest-confidence signals first:
 *
 *   1. Exact merchant match in history → recency-weighted vote.
 *   2. Naive Bayes over the user's history (≥10 txs) — generalizes to
 *      unseen merchants that share tokens with seen ones (e.g. a new
 *      branch of a known chain).
 *   3. Fuzzy contains match.
 *   4. Built-in merchant→category heuristic table.
 */
export function autoCategorize(
  merchant: string,
  scope: Scope,
  history: Transaction[],
): string | null {
  const m = merchant.trim();
  if (!m) return null;

  const lower = m.toLowerCase();
  const sameMerchant = history.filter(
    (t) => (t.scope ?? 'personal') === scope && t.merchant.toLowerCase() === lower,
  );
  if (sameMerchant.length > 0) {
    return mostCommonCat(sameMerchant);
  }

  // Naive Bayes — only if there's enough signal to be worth training
  if (history.length >= BAYES_MIN_HISTORY) {
    const model = getBayesModel(history, scope);
    const result = classifyBayes(m, model);
    if (result && result.confidence >= BAYES_MIN_CONFIDENCE) {
      return result.cat;
    }
  }

  // Fuzzy fallback
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

function mostCommonCat(txs: Transaction[]): string | null {
  // Recency-weighted vote. A merchant the user re-categorized last week should
  // win over a stale category they used five months ago. Weight decays with a
  // 180-day half-life-ish exponential (clamped so very old txs still count a
  // bit instead of going to zero).
  const now = Date.now();
  const counts = new Map<string, number>();
  for (const t of txs) {
    const ageDays = (now - new Date(t.date).getTime()) / 86400000;
    const weight = Math.max(0.2, Math.exp(-ageDays / 180));
    counts.set(t.cat, (counts.get(t.cat) ?? 0) + weight);
  }
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
export function suggestAmount(
  merchant: string,
  scope: Scope,
  history: Transaction[],
): number | null {
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

export type RecurringPattern = {
  merchant: string;
  amount: number;
  cat: string;
  scope: Scope;
  /** Typical day of the month. */
  day: number;
  /** Account the latest payment left. */
  acc: string;
};

/**
 * Subscriptions and bills hiding in the ledger: the same merchant charging the
 * same amount once a month, around the same day, for three months running and
 * still going. Real spending only — salary, transfers and rows the app posted
 * itself are not "payments to register". The once-a-month and same-day tests
 * keep a daily coffee at a fixed price from being called a subscription.
 */
export function detectRecurringPatterns(
  history: Transaction[],
  now: Date = new Date(),
): RecurringPattern[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of history) {
    if (!isExpense(t) || t.recurring || !t.merchant.trim()) continue;
    const k = `${t.scope ?? 'personal'}::${t.merchant.trim().toLowerCase()}`;
    const g = groups.get(k);
    if (g) g.push(t);
    else groups.set(k, [t]);
  }

  const out: RecurringPattern[] = [];
  groups.forEach((txs) => {
    if (txs.length < 3) return;
    const amounts = txs.map((t) => Math.abs(t.amount)).sort((a, b) => a - b);
    const med = amounts[Math.floor(amounts.length / 2)];
    const same = txs
      .filter((t) => Math.abs(Math.abs(t.amount) - med) <= Math.max(100, med * 0.02))
      .sort((a, b) => b.date.localeCompare(a.date));
    if (same.length < 3) return;

    const monthOf = (t: Transaction) => {
      const d = new Date(t.date);
      return d.getFullYear() * 12 + d.getMonth();
    };
    const months = new Set(same.map(monthOf));
    // Once a month — not several times in some of them.
    if (months.size < 3 || same.length > months.size + 1) return;
    // Still running: charged within the last 45 days, in three consecutive months.
    const latest = new Date(same[0].date);
    if (now.getTime() - latest.getTime() > 45 * 86_400_000) return;
    const last = monthOf(same[0]);
    if (!months.has(last - 1) || !months.has(last - 2)) return;

    const days = same.map((t) => new Date(t.date).getDate()).sort((a, b) => a - b);
    const day = days[Math.floor(days.length / 2)];
    // Around the same day (month-end days wrap: the 31st and the 1st are neighbours).
    const off = (d: number) => Math.min(Math.abs(d - day), 31 - Math.abs(d - day));
    if (days.some((d) => off(d) > 4)) return;

    out.push({
      merchant: same[0].merchant.trim(),
      amount: Math.abs(same[0].amount),
      cat: same[0].cat,
      scope: (same[0].scope ?? 'personal') as Scope,
      day,
      acc: same[0].acc,
    });
  });
  return out;
}

export type SalaryPattern = { merchant: string; amount: number; ids: string[] };

/**
 * Pay that is filed as something else: the same payer sending over 100만원 into
 * the personal ledger in two or more different months. One large deposit — a
 * friend paying back a loan, a refund — is not a salary.
 */
export function detectSalaryIncome(history: Transaction[]): SalaryPattern[] {
  const groups = new Map<string, Transaction[]>();
  for (const t of history) {
    if ((t.scope ?? 'personal') !== 'personal' || !isIncome(t)) continue;
    if (t.amount <= 1_000_000 || !t.merchant.trim()) continue;
    const k = t.merchant.trim().toLowerCase();
    const g = groups.get(k);
    if (g) g.push(t);
    else groups.set(k, [t]);
  }
  const out: SalaryPattern[] = [];
  groups.forEach((txs) => {
    const months = new Set(txs.map((t) => t.date.slice(0, 7)));
    if (months.size < 2) return;
    const unfiled = txs.filter((t) => t.cat !== 'salary');
    if (unfiled.length === 0) return;
    const latest = [...txs].sort((a, b) => b.date.localeCompare(a.date))[0];
    out.push({
      merchant: latest.merchant.trim(),
      amount: latest.amount,
      ids: unfiled.map((t) => t.id),
    });
  });
  return out;
}
