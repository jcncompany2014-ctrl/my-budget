import { describe, expect, it } from 'vitest';
import { deriveTemplates } from './templates';
import type { Transaction } from './types';

const NOW = new Date(2026, 10, 8, 12);
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();
let seq = 0;
const tx = (o: Partial<Transaction>): Transaction => ({
  id: `t${seq++}`,
  date: daysAgo(1),
  amount: -4500,
  cat: 'cafe',
  merchant: '스타벅스',
  acc: 'a1',
  scope: 'personal',
  ...o,
});

const opts = { scope: 'personal' as const, kind: 'expense' as const, now: NOW };

describe('deriveTemplates', () => {
  it('needs at least 3 uses before a merchant becomes a template', () => {
    expect(deriveTemplates([tx({}), tx({})], opts)).toEqual([]);
    expect(deriveTemplates([tx({}), tx({}), tx({})], opts)).toHaveLength(1);
  });

  it('picks the most common amount for the merchant', () => {
    const r = deriveTemplates(
      [tx({ amount: -4500 }), tx({ amount: -4500 }), tx({ amount: -6100 })],
      opts,
    );
    expect(r[0]).toMatchObject({ merchant: '스타벅스', amount: 4500, cat: 'cafe', count: 3 });
  });

  it('groups merchants case/whitespace-insensitively', () => {
    const r = deriveTemplates(
      [tx({ merchant: 'GS25' }), tx({ merchant: 'gs25 ' }), tx({ merchant: ' Gs25' })],
      opts,
    );
    expect(r).toHaveLength(1);
    expect(r[0].count).toBe(3);
  });

  it('orders by frequency', () => {
    const r = deriveTemplates(
      [
        ...Array.from({ length: 3 }, () => tx({ merchant: 'A', cat: 'food', amount: -9000 })),
        ...Array.from({ length: 5 }, () => tx({ merchant: 'B', cat: 'cafe' })),
      ],
      opts,
    );
    expect(r.map((t) => t.merchant)).toEqual(['B', 'A']);
  });

  it('skips other scopes, income, recurring rows, transfers, and old history', () => {
    const r = deriveTemplates(
      [
        ...Array.from({ length: 3 }, () => tx({ scope: 'business' })),
        ...Array.from({ length: 3 }, () =>
          tx({ merchant: '회사', amount: 3_000_000, cat: 'salary' }),
        ),
        ...Array.from({ length: 3 }, () =>
          tx({ merchant: '넷플릭스', recurring: true, cat: 'subs' }),
        ),
        ...Array.from({ length: 3 }, () => tx({ merchant: '저축', cat: 'transfer' })),
        ...Array.from({ length: 3 }, () => tx({ merchant: '옛날집', date: daysAgo(200) })),
      ],
      opts,
    );
    expect(r).toEqual([]);
  });

  it('mines income templates when asked', () => {
    const r = deriveTemplates(
      Array.from({ length: 3 }, () => tx({ merchant: '과외', amount: 300_000, cat: 'side' })),
      { ...opts, kind: 'income' },
    );
    expect(r[0]).toMatchObject({ merchant: '과외', amount: 300_000 });
  });
});
