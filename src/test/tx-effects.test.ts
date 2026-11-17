import { beforeEach, describe, expect, it, vi } from 'vitest';
import { buildSettlement } from '@/lib/reimburse';
import { KEYS } from '@/lib/storage-keys';
import type { Account, Loan, Transaction } from '@/lib/types';

const account = (id: string, scope: Account['scope'], balance: number): Account => ({
  id,
  name: id,
  bank: '',
  type: 'bank',
  balance,
  color: '#000',
  scope,
});

const put = (key: string, value: unknown) =>
  window.localStorage.setItem(key, JSON.stringify(value));
const txs = () =>
  JSON.parse(window.localStorage.getItem(KEYS.transactions) ?? '[]') as Transaction[];
const balance = (id: string) =>
  (JSON.parse(window.localStorage.getItem(KEYS.accounts) ?? '[]') as Account[]).find(
    (a) => a.id === id,
  )?.balance;
const remaining = () =>
  (JSON.parse(window.localStorage.getItem(KEYS.loans) ?? '[]') as Loan[])[0].remaining;

describe('what a row carries beyond its own balance', () => {
  // Fresh module state per test — the transactions singleton caches at import.
  beforeEach(() => {
    vi.resetModules();
  });

  const paid = (id: string, amount: number): Transaction => ({
    id,
    date: new Date(2026, 10, 10, 12).toISOString(),
    amount,
    cat: 'biz_etc',
    merchant: '오피스디포',
    acc: 'mine',
    scope: 'business',
    reimburse: 'due',
  });

  it('a settlement marks its rows paid back; deleting it makes them owed again; undo settles them again', async () => {
    const accounts = [account('mine', 'personal', 0), account('biz', 'business', 100_000)];
    put(KEYS.accounts, accounts);
    put(KEYS.transactions, [paid('r1', -30_000), paid('r2', -10_000), paid('later', -5_000)]);
    const storage = await import('@/lib/storage');

    const legs = buildSettlement({
      rows: [paid('r1', -30_000), paid('r2', -10_000)],
      from: accounts[1],
      to: accounts[0],
      date: new Date(2026, 10, 20).toISOString(),
      seq: 't1',
    });
    storage.addTransactions(legs);
    const flags = () => Object.fromEntries(txs().map((t) => [t.id, t.reimburse]));
    expect(flags()).toMatchObject({ r1: 'done', r2: 'done', later: 'due' });
    expect(balance('mine')).toBe(40_000);
    expect(balance('biz')).toBe(60_000);

    // Deleting either leg takes the pair with it and the rows are owed again.
    const removed = storage.removeTransaction(legs[1].id);
    expect(removed).toHaveLength(2);
    expect(flags()).toMatchObject({ r1: 'due', r2: 'due', later: 'due' });
    expect(balance('mine')).toBe(0);
    expect(balance('biz')).toBe(100_000);

    // Undoing the delete.
    storage.addTransactions(removed);
    expect(flags()).toMatchObject({ r1: 'done', r2: 'done', later: 'due' });
    expect(balance('mine')).toBe(40_000);
  });

  it('deleting several rows at once unsettles too', async () => {
    const accounts = [account('mine', 'personal', 0), account('biz', 'business', 100_000)];
    put(KEYS.accounts, accounts);
    put(KEYS.transactions, [paid('r1', -30_000)]);
    const storage = await import('@/lib/storage');
    const legs = buildSettlement({
      rows: [paid('r1', -30_000)],
      from: accounts[1],
      to: accounts[0],
      date: new Date(2026, 10, 20).toISOString(),
      seq: 't2',
    });
    storage.addTransactions(legs);
    storage.removeTransactions([legs[0].id]);
    expect(txs().map((t) => [t.id, t.reimburse])).toEqual([['r1', 'due']]);
  });

  const loan: Loan = {
    id: 'loan-abc',
    name: '사업자대출',
    emoji: '',
    scope: 'business',
    lender: 'NH',
    principal: 10_000_000,
    remaining: 9_000_000,
    rate: 5,
    termMonths: 60,
    startDate: '2026-01-01',
    dueDate: '2031-01-01',
    color: '#000',
  };
  const principalRow: Transaction = {
    id: 'loan-2026-10-loan-abc-p',
    date: new Date(2026, 10, 5, 9).toISOString(),
    amount: -500_000,
    cat: 'biz_loan_principal',
    merchant: '사업자대출',
    acc: 'biz',
    scope: 'business',
    recurring: true,
  };

  it('deleting an auto-posted principal repayment gives the principal back; undo takes it again', async () => {
    put(KEYS.accounts, [account('biz', 'business', 1_000_000)]);
    put(KEYS.loans, [loan]);
    put(KEYS.transactions, [principalRow]);
    const storage = await import('@/lib/storage');

    const removed = storage.removeTransaction(principalRow.id);
    expect(remaining()).toBe(9_500_000);
    expect(balance('biz')).toBe(1_500_000);

    storage.addTransactions(removed);
    expect(remaining()).toBe(9_000_000);
    expect(balance('biz')).toBe(1_000_000);
  });

  it('re-pricing that row moves the loan by the difference; an interest row moves nothing', async () => {
    put(KEYS.accounts, [account('biz', 'business', 1_000_000)]);
    put(KEYS.loans, [loan]);
    const interest: Transaction = {
      ...principalRow,
      id: 'loan-2026-10-loan-abc',
      amount: -40_000,
      cat: 'loan_payment',
    };
    put(KEYS.transactions, [principalRow, interest]);
    const storage = await import('@/lib/storage');

    storage.updateTransaction(principalRow.id, { amount: -300_000 });
    expect(remaining()).toBe(9_200_000);
    storage.removeTransaction(interest.id);
    expect(remaining()).toBe(9_200_000);
  });

  it('a row imported from a statement never moves a balance — not when deleted, not when edited', async () => {
    put(KEYS.accounts, [account('mine', 'personal', 500_000)]);
    const imported: Transaction = {
      id: 'imp-abc-1',
      date: new Date(2026, 9, 1, 12).toISOString(),
      amount: -20_000,
      cat: 'food',
      merchant: '식당',
      acc: 'mine',
      scope: 'personal',
    };
    put(KEYS.transactions, [imported]);
    const storage = await import('@/lib/storage');

    storage.updateTransaction(imported.id, { amount: -25_000 });
    expect(balance('mine')).toBe(500_000);
    const removed = storage.removeTransaction(imported.id);
    expect(balance('mine')).toBe(500_000);
    storage.addTransactions(removed);
    expect(balance('mine')).toBe(500_000);
  });
});
