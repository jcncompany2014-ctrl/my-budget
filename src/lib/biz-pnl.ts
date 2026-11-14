import { CATEGORIES } from '@/lib/categories';
import { expandByCategory, isSpendingCategory } from '@/lib/format';
import type { Transaction } from '@/lib/types';

/** 매출원가 */
const COGS_CATS = new Set(['biz_purchase']);
/** 고정비 — owed whatever the month's sales: rent, wages, utilities, insurance, loan interest. */
const FIXED_CATS = new Set([
  'biz_rent',
  'biz_payroll',
  'biz_utility',
  'biz_insurance',
  'loan_payment',
]);

export type Pnl = {
  revenue: number;
  cogs: number;
  fixed: number;
  variable: number;
  gross: number;
  operating: number;
  /** Costs by category (매출원가 excluded), largest first. */
  byCategory: [string, number][];
  /** Sales needed to cover fixed costs; null when sales don't cover their own variable cost. */
  breakEven: number | null;
};

/**
 * Profit and loss from what is actually in the business ledger.
 *
 * Every figure comes from recorded rows — wages count when they are posted
 * (the 인건비 auto-post does that), never from an estimate on top, which used
 * to count payroll twice. Transfers, owner draws and capital are not income or
 * cost. A refund lowers the cost it came from.
 */
export function computePnl(txs: Transaction[], from: Date, to: Date): Pnl {
  const start = from.toISOString();
  const end = to.toISOString();
  let revenue = 0;
  let cogs = 0;
  let fixed = 0;
  let variable = 0;
  const cats = new Map<string, number>();

  for (const t of txs) {
    if (t.date < start || t.date > end || t.transferPairId) continue;
    for (const part of expandByCategory(t)) {
      if (!isSpendingCategory(part.cat)) continue;
      if (CATEGORIES[part.cat]?.kind === 'income') {
        revenue += part.amount;
        continue;
      }
      const cost = -part.amount;
      if (COGS_CATS.has(part.cat)) {
        cogs += cost;
        continue;
      }
      if (FIXED_CATS.has(part.cat)) fixed += cost;
      else variable += cost;
      cats.set(part.cat, (cats.get(part.cat) ?? 0) + cost);
    }
  }

  const gross = revenue - cogs;
  // Each won of sales leaves this share after the costs that scale with it.
  const marginRate = revenue > 0 ? (revenue - cogs - variable) / revenue : 0;
  return {
    revenue,
    cogs,
    fixed,
    variable,
    gross,
    operating: gross - fixed - variable,
    byCategory: [...cats.entries()].filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]),
    breakEven: marginRate > 0 ? Math.round(fixed / marginRate) : null,
  };
}
