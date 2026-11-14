import { describe, expect, it } from 'vitest';
import { runDataFixes } from '@/lib/data-fixes';
import { isExpense } from '@/lib/format';
import { dueTotal } from '@/lib/reimburse';
import { KEYS } from '@/lib/storage-keys';
import type { Transaction } from '@/lib/types';

const read = () =>
  JSON.parse(window.localStorage.getItem(KEYS.transactions) ?? '[]') as Transaction[];

describe('runDataFixes', () => {
  it('turns the opening 대납 row into debt only, once, and leaves other rows alone', () => {
    const opening: Transaction = {
      id: 'reimb-open-20261114',
      date: '2026-11-14T03:00:00.000Z',
      amount: -1_597_722,
      cat: 'biz_etc',
      merchant: '이전 카드 대납분',
      acc: 'acc-card',
      scope: 'business',
      reimburse: 'due',
    };
    const other: Transaction = { ...opening, id: 'x', amount: -45_000, merchant: '오피스디포' };
    window.localStorage.setItem(KEYS.transactions, JSON.stringify([opening, other]));

    runDataFixes();
    const [fixed, untouched] = read();
    expect(isExpense(fixed)).toBe(false);
    expect(dueTotal([fixed])).toBe(1_597_722);
    expect(untouched).toEqual(other);

    // The user counts it as a cost again later — the fix must not undo that.
    window.localStorage.setItem(KEYS.transactions, JSON.stringify([opening, other]));
    runDataFixes();
    expect(read()[0].cat).toBe('biz_etc');
  });

  it('does nothing on a device without that row', () => {
    runDataFixes();
    expect(read()).toEqual([]);
  });
});
