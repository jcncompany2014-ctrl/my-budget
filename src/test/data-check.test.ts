import { describe, expect, it } from 'vitest';
import { applyRepair, checkDataIntegrity } from '@/lib/data-check';
import { KEYS } from '@/lib/storage-keys';

function seed<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}
function read<T>(key: string): T {
  return JSON.parse(window.localStorage.getItem(key) ?? '[]') as T;
}

describe('checkDataIntegrity + applyRepair', () => {
  it('flags a transaction whose account has been deleted', () => {
    seed(KEYS.accounts, [{ id: 'a1', balance: 0 }]);
    seed(KEYS.transactions, [
      { id: 't1', amount: -1000, cat: 'food', merchant: 'X', acc: 'ghost', date: '2026-04-30' },
    ]);
    const r = checkDataIntegrity();
    const issue = r.issues.find((i) => i.kind === 'tx_unknown_account');
    expect(issue).toBeDefined();
    expect(issue?.severity).toBe('error');
    expect(issue?.repair?.type).toBe('reassign_account');
  });

  it('flags a transaction with an unknown category and offers reassignment', () => {
    seed(KEYS.accounts, [{ id: 'a1', balance: 0 }]);
    seed(KEYS.transactions, [
      { id: 't1', amount: -1000, cat: 'unknown_cat', merchant: 'X', acc: 'a1', date: '2026-04-30' },
    ]);
    const r = checkDataIntegrity();
    const issue = r.issues.find((i) => i.kind === 'tx_unknown_category');
    expect(issue).toBeDefined();
    expect(issue?.repair?.type).toBe('reassign_category');
  });

  it('flags a transferPair that lost its mate', () => {
    seed(KEYS.accounts, [{ id: 'a1', balance: 0 }]);
    seed(KEYS.transactions, [
      // Only one half of a pair survives.
      {
        id: 't1',
        amount: -1000,
        cat: 'transfer',
        merchant: '이체',
        acc: 'a1',
        date: '2026-04-30',
        transferPairId: 'xfer-orphan',
      },
    ]);
    const r = checkDataIntegrity();
    const issue = r.issues.find((i) => i.kind === 'transfer_pair_missing');
    expect(issue).toBeDefined();
    expect(issue?.repair?.type).toBe('unpair_transfer');
  });

  it('reports zero issues on clean state', () => {
    seed(KEYS.accounts, [{ id: 'a1', balance: 0 }]);
    seed(KEYS.transactions, [
      { id: 't1', amount: -1000, cat: 'food', merchant: 'X', acc: 'a1', date: '2026-04-30' },
    ]);
    const r = checkDataIntegrity();
    expect(r.issues).toHaveLength(0);
  });

  it('applyRepair (reassign_category) actually rewrites the tx', () => {
    seed(KEYS.accounts, [{ id: 'a1' }]);
    seed(KEYS.transactions, [
      { id: 't1', amount: -1000, cat: 'unknown_cat', merchant: 'X', acc: 'a1', date: '2026-04-30' },
    ]);
    const issue = checkDataIntegrity().issues.find((i) => i.kind === 'tx_unknown_category');
    expect(issue).toBeDefined();
    expect(applyRepair(issue!)).toBe(true);
    const txs = read<{ id: string; cat: string }[]>(KEYS.transactions);
    expect(txs[0].cat).toBe('living'); // fallback category in the repair payload
  });
});
