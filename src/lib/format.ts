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

export const isExpense = (t: { amount: number; cat: string }) =>
  t.amount < 0 && t.cat !== 'saving' && t.cat !== 'transfer';
