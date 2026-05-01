import { describe, expect, it } from 'vitest';
import { exportAll, importBackup } from '@/lib/backup';
import { KEYS } from '@/lib/storage-keys';

function seed(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
function read<T>(key: string): T | null {
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

// importBackup eats a File object; build one from a JS object.
function asFile(obj: unknown): File {
  return new File([JSON.stringify(obj)], 'backup.json', { type: 'application/json' });
}

describe('backup integration', () => {
  it('exports + imports credit-lines round-trip (regression for missing-creditLines bug)', async () => {
    seed(KEYS.creditLines, [
      {
        id: 'loc-1',
        name: '토스뱅크 마이너스',
        emoji: '💳',
        scope: 'personal',
        bank: '토스뱅크',
        limit: 5_000_000,
        used: 1_200_000,
        rate: 6,
        color: '#DC2626',
      },
    ]);

    const dump = exportAll();
    expect(dump.creditLines).toHaveLength(1);
    expect(dump.creditLines?.[0].name).toBe('토스뱅크 마이너스');

    // Wipe storage, then re-import. The line should reappear.
    window.localStorage.clear();
    const result = await importBackup(asFile(dump));
    expect(result.creditLines).toBe(1);
    const restored = read<{ id: string }[]>(KEYS.creditLines);
    expect(restored).toHaveLength(1);
    expect(restored?.[0].id).toBe('loc-1');
  });

  it('does NOT wipe transactions when an import file has no transactions field (regression)', async () => {
    // User had 2 transactions saved already
    seed(KEYS.transactions, [
      { id: 't1', amount: -1000, cat: 'food', merchant: 'A', acc: 'a', date: '2026-04-30T00:00:00Z' },
      { id: 't2', amount: -2000, cat: 'food', merchant: 'B', acc: 'a', date: '2026-04-30T00:00:00Z' },
    ]);
    // Import a partial backup that only has accounts
    await importBackup(
      asFile({
        version: 5,
        accounts: [{ id: 'a', name: 'X', balance: 0, type: 'bank', color: '#000', scope: 'personal' }],
      }),
    );
    // Transactions must survive
    expect(read<unknown[]>(KEYS.transactions)).toHaveLength(2);
  });

  it('legacy v4 backups (no creditLines field) still import cleanly', async () => {
    // Pre-existing creditLines should NOT be wiped by an older backup that
    // doesn't carry them.
    seed(KEYS.creditLines, [{ id: 'pre-existing' }]);
    await importBackup(
      asFile({
        version: 4,
        transactions: [],
        accounts: [],
      }),
    );
    // creditLines untouched
    expect(read<unknown[]>(KEYS.creditLines)).toHaveLength(1);
  });
});
