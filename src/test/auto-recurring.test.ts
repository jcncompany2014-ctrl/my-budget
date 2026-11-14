import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAutoRecurring } from '@/lib/auto-recurring';
import { isExpense, isIncome } from '@/lib/format';
import { KEYS } from '@/lib/storage-keys';
import type { Account, RecurringItem, Transaction } from '@/lib/types';

const account = (id: string, balance: number, extra: Partial<Account> = {}): Account => ({
  id,
  name: id,
  bank: '',
  type: 'bank',
  balance,
  color: '#000',
  scope: 'personal',
  ...extra,
});

const item = (extra: Partial<RecurringItem> = {}): RecurringItem => ({
  id: 'r1',
  name: '넷플릭스',
  emoji: '',
  amount: 17_000,
  day: 1,
  cat: 'subs',
  scope: 'personal',
  ...extra,
});

function seed(items: RecurringItem[], accounts: Account[]) {
  window.localStorage.setItem(KEYS.recurring, JSON.stringify(items));
  window.localStorage.setItem(KEYS.accounts, JSON.stringify(accounts));
}
const read = <T>(key: string): T => JSON.parse(window.localStorage.getItem(key) ?? '[]') as T;
const txs = () => read<Transaction[]>(KEYS.transactions);
const balance = (id: string) => read<Account[]>(KEYS.accounts).find((a) => a.id === id)?.balance;

describe('ensureAutoRecurring', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('does not backfill months before the item was created', () => {
    const created = new Date(2026, 10, 14, 15, 0, 0);
    seed([item({ postedThrough: created.toISOString() })], [account('main', 100_000)]);

    vi.setSystemTime(created);
    ensureAutoRecurring();
    expect(txs()).toHaveLength(0);

    vi.setSystemTime(new Date(2026, 11, 1, 10, 0, 0));
    ensureAutoRecurring();
    expect(txs().map((t) => t.id)).toEqual(['recur-2026-11-r1']);
  });

  it('debits the paying account', () => {
    seed(
      [item({ postedThrough: new Date(2026, 10, 14).toISOString() })],
      [account('main', 100_000, { main: true })],
    );
    vi.setSystemTime(new Date(2026, 11, 1, 10, 0, 0));
    ensureAutoRecurring();
    expect(balance('main')).toBe(83_000);
  });

  it('posts a transfer pair when the item pays into another account', () => {
    seed(
      [
        item({
          name: '청년도약계좌',
          amount: 700_000,
          cat: 'saving',
          acc: 'kb',
          toAcc: 'leap',
          postedThrough: new Date(2026, 10, 14).toISOString(),
        }),
      ],
      [account('kakao', 500_000, { main: true }), account('kb', 3_000_000), account('leap', 0)],
    );
    vi.setSystemTime(new Date(2026, 11, 1, 10, 0, 0));
    ensureAutoRecurring();

    const [out, into] = txs();
    expect(out).toMatchObject({ acc: 'kb', amount: -700_000, cat: 'saving', transferTo: 'leap' });
    expect(into).toMatchObject({ acc: 'leap', amount: 700_000, cat: 'transfer', transferTo: 'kb' });
    expect(into.transferPairId).toBe(out.transferPairId);
    expect(balance('kb')).toBe(2_300_000);
    expect(balance('leap')).toBe(700_000);
    expect(balance('kakao')).toBe(500_000);
    // Money moved between my own accounts — neither spending nor income.
    expect(txs().some((t) => isExpense(t) || isIncome(t))).toBe(false);
  });

  it('never regenerates an occurrence the user deleted', () => {
    seed(
      [item({ postedThrough: new Date(2026, 10, 14).toISOString() })],
      [account('main', 100_000)],
    );
    vi.setSystemTime(new Date(2026, 11, 1, 10, 0, 0));
    ensureAutoRecurring();
    window.localStorage.setItem(KEYS.transactions, '[]');

    vi.setSystemTime(new Date(2026, 11, 2, 10, 0, 0));
    ensureAutoRecurring();
    expect(txs()).toHaveLength(0);
  });

  it('keeps catching up items saved before postedThrough existed', () => {
    seed([item()], [account('main', 100_000)]);
    vi.setSystemTime(new Date(2026, 10, 14, 15, 0, 0));
    ensureAutoRecurring();
    // Sep / Oct / Nov — the 3-month window.
    expect(txs()).toHaveLength(3);
    expect(read<RecurringItem[]>(KEYS.recurring)[0].postedThrough).toBeDefined();
  });
});
