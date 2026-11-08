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
});
