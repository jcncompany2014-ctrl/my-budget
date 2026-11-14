import { describe, expect, it } from 'vitest';
import { detectRecurringPatterns, detectSalaryIncome } from '@/lib/auto-categorize';
import type { Transaction } from '@/lib/types';

const NOW = new Date(2026, 10, 14, 12, 0, 0);
let n = 0;
const tx = (over: Partial<Transaction>): Transaction => ({
  id: `t${n++}`,
  date: NOW.toISOString(),
  amount: -17_000,
  cat: 'subs',
  merchant: '넷플릭스',
  memo: '',
  acc: 'card',
  scope: 'personal',
  ...over,
});
const on = (month: number, day: number) => new Date(2026, month - 1, day, 9).toISOString();

describe('detectRecurringPatterns', () => {
  it('finds a monthly charge and remembers its account', () => {
    const history = [9, 10, 11].map((m) => tx({ date: on(m, 3) }));
    expect(detectRecurringPatterns(history, NOW)).toEqual([
      { merchant: '넷플릭스', amount: 17_000, cat: 'subs', scope: 'personal', day: 3, acc: 'card' },
    ]);
  });

  it('ignores a daily coffee that happens to cost the same', () => {
    const history = [
      ...[2, 9, 16, 23].map((d) => tx({ merchant: '스타벅스', amount: -4_500, date: on(9, d) })),
      ...[1, 8, 20].map((d) => tx({ merchant: '스타벅스', amount: -4_500, date: on(10, d) })),
      ...[3, 11].map((d) => tx({ merchant: '스타벅스', amount: -4_500, date: on(11, d) })),
    ];
    expect(detectRecurringPatterns(history, NOW)).toEqual([]);
  });

  it('ignores income, transfers and rows the app posted itself', () => {
    const salary = [9, 10, 11].map((m) =>
      tx({ merchant: '회사', amount: 3_000_000, cat: 'salary', date: on(m, 10) }),
    );
    const transfer = [9, 10, 11].map((m) =>
      tx({
        merchant: '→ 적금',
        amount: -700_000,
        cat: 'transfer',
        transferPairId: `x${m}`,
        date: on(m, 1),
      }),
    );
    const posted = [9, 10, 11].map((m) =>
      tx({ merchant: '보험', recurring: true, date: on(m, 5) }),
    );
    expect(detectRecurringPatterns([...salary, ...transfer, ...posted], NOW)).toEqual([]);
  });

  it('ignores a subscription that already stopped', () => {
    const history = [5, 6, 7].map((m) => tx({ date: on(m, 3) }));
    expect(detectRecurringPatterns(history, NOW)).toEqual([]);
  });

  it('ignores the same amount on scattered days', () => {
    const history = [tx({ date: on(9, 2) }), tx({ date: on(10, 17) }), tx({ date: on(11, 9) })];
    expect(detectRecurringPatterns(history, NOW)).toEqual([]);
  });
});

describe('detectSalaryIncome', () => {
  it('needs the same payer in two different months', () => {
    const once = [tx({ merchant: '김성규', amount: 5_000_000, cat: 'income', date: on(11, 2) })];
    expect(detectSalaryIncome(once)).toEqual([]);

    const twice = [
      tx({ id: 'a', merchant: '(주)회사', amount: 3_100_000, cat: 'income', date: on(10, 25) }),
      tx({ id: 'b', merchant: '(주)회사', amount: 3_200_000, cat: 'income', date: on(11, 25) }),
    ];
    const [hint] = detectSalaryIncome(twice);
    expect(hint).toMatchObject({ merchant: '(주)회사', amount: 3_200_000 });
    expect([...hint.ids].sort()).toEqual(['a', 'b']);
  });

  it('skips transfers between my own accounts and rows already filed as salary', () => {
    const moves = [10, 11].map((m) =>
      tx({
        merchant: '← 국민은행',
        amount: 2_000_000,
        cat: 'transfer',
        transferPairId: `p${m}`,
        date: on(m, 1),
      }),
    );
    const filed = [10, 11].map((m) =>
      tx({ merchant: '회사', amount: 3_000_000, cat: 'salary', date: on(m, 25) }),
    );
    expect(detectSalaryIncome([...moves, ...filed])).toEqual([]);
  });
});
