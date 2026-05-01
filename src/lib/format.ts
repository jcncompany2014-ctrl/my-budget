const formatter = new Intl.NumberFormat('ko-KR');

export const fmt = (n: number) => formatter.format(Math.round(Math.abs(n)));
export const fmtKRW = (n: number) => fmt(n) + '원';
export const fmtSigned = (n: number) => (n < 0 ? '-' : '+') + fmt(n) + '원';

export const fmtShort = (n: number) => {
  const a = Math.abs(n);
  if (a >= 100_000_000) return (n / 100_000_000).toFixed(1).replace(/\.0$/, '') + '억';
  if (a >= 10_000) return Math.round(n / 10_000) + '만';
  return fmt(n);
};

const TRANSFER_LIKE_CATS = new Set([
  'transfer',
  'biz_transfer',
  'biz_owner_draw',
  'biz_capital',
  'owner_pay',
  'saving',
]);

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
