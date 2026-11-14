import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS } from '@/lib/storage-keys';
import type { Transaction } from '@/lib/types';

const tx = (id: string): Transaction => ({
  id,
  date: new Date(2026, 10, 1, 12).toISOString(),
  amount: -1_000,
  cat: 'food',
  merchant: id,
  acc: 'a1',
  scope: 'personal',
});

const savedIds = () =>
  (JSON.parse(window.localStorage.getItem(KEYS.transactions) ?? '[]') as Transaction[]).map(
    (t) => t.id,
  );

describe('transactions singleton', () => {
  // Fresh module state per test — the singleton registers its bridge at import.
  beforeEach(() => {
    vi.resetModules();
  });

  it('keeps rows written through store-factory (ensureAuto*) when the next add commits', async () => {
    window.localStorage.setItem(KEYS.transactions, JSON.stringify([tx('a')]));
    const storage = await import('@/lib/storage');
    const factory = await import('@/lib/store-factory');

    expect(storage.allTransactions().map((t) => t.id)).toEqual(['a']); // cache warm
    factory.writeStorageValue(KEYS.transactions, [tx('recur'), tx('a')]); // e.g. auto-recurring
    storage.addTransactions([tx('new')]);

    expect(savedIds()).toEqual(['new', 'recur', 'a']);
  });

  it('removeTransaction returns the removed row and persists the rest', async () => {
    window.localStorage.setItem(KEYS.transactions, JSON.stringify([tx('a'), tx('b')]));
    const storage = await import('@/lib/storage');
    expect(storage.removeTransaction('a').map((t) => t.id)).toEqual(['a']);
    expect(savedIds()).toEqual(['b']);
    expect(storage.removeTransaction('missing')).toEqual([]);
  });

  it('editing one leg of a transfer keeps the other leg and both balances in step', async () => {
    const account = (id: string, balance: number) => ({
      id,
      name: id,
      bank: '',
      type: 'bank',
      balance,
      color: '#000',
      scope: 'personal',
    });
    const leg = (id: string, acc: string, amount: number): Transaction => ({
      ...tx(id),
      acc,
      amount,
      cat: 'transfer',
      transferPairId: 'p1',
    });
    window.localStorage.setItem(
      KEYS.accounts,
      JSON.stringify([account('a1', 900_000), account('a2', 100_000)]),
    );
    window.localStorage.setItem(
      KEYS.transactions,
      JSON.stringify([leg('out', 'a1', -100_000), leg('in', 'a2', 100_000)]),
    );
    const storage = await import('@/lib/storage');

    storage.updateTransaction('out', { amount: -150_000, memo: '수정' });

    const saved = JSON.parse(
      window.localStorage.getItem(KEYS.transactions) ?? '[]',
    ) as Transaction[];
    expect(saved.map((t) => [t.id, t.amount, t.memo])).toEqual([
      ['out', -150_000, '수정'],
      ['in', 150_000, '수정'],
    ]);
    const balances = (
      JSON.parse(window.localStorage.getItem(KEYS.accounts) ?? '[]') as { balance: number }[]
    ).map((a) => a.balance);
    expect(balances).toEqual([850_000, 150_000]);
  });

  it('does not show a row whose save failed', async () => {
    const storage = await import('@/lib/storage');
    const real = window.localStorage.setItem.bind(window.localStorage);
    window.localStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    (window as unknown as { dispatchEvent: () => void }).dispatchEvent = () => {};
    expect(() => storage.addTransactions([tx('lost')])).toThrow();
    window.localStorage.setItem = real;
    expect(storage.allTransactions()).toEqual([]);
  });
});
