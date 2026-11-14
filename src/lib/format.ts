const formatter = new Intl.NumberFormat('ko-KR');

export const fmt = (n: number) => formatter.format(Math.round(Math.abs(n)));
export const fmtKRW = (n: number) => fmt(n) + '원';
export const fmtSigned = (n: number) => (n < 0 ? '-' : '+') + fmt(n) + '원';

export const fmtShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 100_000_000) return (n / 100_000_000).toFixed(1).replace(/\.0$/, '') + '억';
  // One decimal below 100만 — whole-만 rounding showed 14,900 as "1만" and 15,000 as "2만".
  if (a >= 1_000_000) return formatter.format(Math.round(n / 10_000)) + '만';
  if (a >= 10_000) return (n / 10_000).toFixed(1).replace(/\.0$/, '') + '만';
  return fmt(n);
};

const TRANSFER_LIKE_CATS = new Set([
  'transfer',
  'biz_transfer',
  'biz_owner_draw',
  'biz_capital',
  'owner_pay',
  'saving',
  'loan_principal',
  'adjust',
]);

/** Categories a budget can meaningfully cap — i.e. ones whose rows count as spending. */
export const isSpendingCategory = (catId: string) => !TRANSFER_LIKE_CATS.has(catId);

/**
 * Returns true when the transaction represents real spending (operating expense).
 * Excludes transfers, owner draws/contributions, and saving moves.
 */
export const isExpense = (t: { amount: number; cat: string; transferPairId?: string }) =>
  t.amount < 0 && !TRANSFER_LIKE_CATS.has(t.cat) && !t.transferPairId;

/**
 * Returns true when the transaction represents real income (operating revenue).
 */
export const isIncome = (t: { amount: number; cat: string; transferPairId?: string }) =>
  t.amount > 0 && !TRANSFER_LIKE_CATS.has(t.cat) && !t.transferPairId;

/**
 * Expand a transaction into category-amount pairs, honoring splits if present.
 * If splits exist, each split is its own (cat, amount). Otherwise the whole tx.
 */
export function expandByCategory(t: {
  cat: string;
  amount: number;
  splits?: { cat: string; amount: number }[];
}): { cat: string; amount: number }[] {
  if (t.splits && t.splits.length > 0) {
    return t.splits.map((s) => ({
      cat: s.cat,
      amount: t.amount < 0 ? -Math.abs(s.amount) : Math.abs(s.amount),
    }));
  }
  return [{ cat: t.cat, amount: t.amount }];
}

/**
 * Spending per category: real expenses only, each split counted under its own
 * category. The one definition behind budgets, alerts and category rankings.
 */
export function spendByCategory(
  txs: {
    amount: number;
    cat: string;
    transferPairId?: string;
    splits?: { cat: string; amount: number }[];
  }[],
): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of txs) {
    if (!isExpense(t)) continue;
    for (const part of expandByCategory(t)) {
      map.set(part.cat, (map.get(part.cat) ?? 0) + Math.abs(part.amount));
    }
  }
  return map;
}
