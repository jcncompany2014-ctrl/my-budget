import { isExpense, isIncome } from '@/lib/format';
import type { Scope, Transaction } from '@/lib/types';

export type TxTemplate = {
  merchant: string;
  amount: number; // absolute
  cat: string;
  count: number;
  lastUsed: string; // ISO
};

/**
 * Smart templates — habitual (merchant, category) pairs mined from history,
 * each with its most common amount. Zero setup: "스타벅스 4,500" appears after
 * the third visit and becomes a 2-tap entry (chip → 저장).
 *
 * Auto-generated recurring rows are excluded (they log themselves).
 */
export function deriveTemplates(
  history: Transaction[],
  opts: {
    scope: Scope;
    kind: 'expense' | 'income';
    limit?: number;
    minCount?: number;
    windowDays?: number;
    now?: Date;
  },
): TxTemplate[] {
  const limit = opts.limit ?? 6;
  const minCount = opts.minCount ?? 3;
  const cutoff = (opts.now ?? new Date()).getTime() - (opts.windowDays ?? 120) * 86400000;
  const matchesKind = opts.kind === 'expense' ? isExpense : isIncome;

  type Group = {
    merchant: string;
    cat: string;
    count: number;
    lastUsed: string;
    amounts: Map<number, { n: number; last: string }>;
  };
  const groups = new Map<string, Group>();

  for (const t of history) {
    if ((t.scope ?? 'personal') !== opts.scope) continue;
    if (t.recurring) continue;
    if (!matchesKind(t)) continue;
    const merchant = t.merchant.trim();
    if (!merchant) continue;
    if (new Date(t.date).getTime() < cutoff) continue;

    const key = `${merchant.toLowerCase()}\u0000${t.cat}`;
    let g = groups.get(key);
    if (!g) {
      g = { merchant, cat: t.cat, count: 0, lastUsed: t.date, amounts: new Map() };
      groups.set(key, g);
    }
    g.count += 1;
    if (t.date > g.lastUsed) {
      g.lastUsed = t.date;
      g.merchant = merchant; // keep the most recent spelling
    }
    const amt = Math.abs(t.amount);
    const a = g.amounts.get(amt);
    if (a) {
      a.n += 1;
      if (t.date > a.last) a.last = t.date;
    } else {
      g.amounts.set(amt, { n: 1, last: t.date });
    }
  }

  const out: TxTemplate[] = [];
  for (const g of groups.values()) {
    if (g.count < minCount) continue;
    // Most frequent amount; ties go to the most recently used one.
    let best: { amt: number; n: number; last: string } | null = null;
    for (const [amt, v] of g.amounts) {
      if (!best || v.n > best.n || (v.n === best.n && v.last > best.last)) {
        best = { amt, n: v.n, last: v.last };
      }
    }
    if (!best) continue;
    out.push({
      merchant: g.merchant,
      amount: best.amt,
      cat: g.cat,
      count: g.count,
      lastUsed: g.lastUsed,
    });
  }

  return out
    .sort((a, b) => b.count - a.count || b.lastUsed.localeCompare(a.lastUsed))
    .slice(0, limit);
}
