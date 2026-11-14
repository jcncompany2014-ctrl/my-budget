import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAutoCardPayment } from '@/lib/auto-card-payment';
import {
  billAmount,
  cycleBoundary,
  defaultCycleStart,
  nextBill,
  payDateOf,
  shortfalls,
} from '@/lib/card-billing';
import { isExpense, isIncome } from '@/lib/format';
import { KEYS } from '@/lib/storage-keys';
import type { Account, Transaction } from '@/lib/types';

const account = (id: string, extra: Partial<Account> = {}): Account => ({
  id,
  name: id,
  bank: '',
  type: 'bank',
  balance: 0,
  color: '#000',
  scope: 'personal',
  ...extra,
});
const card = (extra: Partial<Account> = {}) =>
  account('card', { type: 'card', billingDay: 14, balance: -500_000, ...extra });
const charge = (day: Date, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `c-${day.getTime()}-${amount}`,
  date: day.toISOString(),
  amount: -amount,
  cat: 'living',
  merchant: '가게',
  acc: 'card',
  scope: 'personal',
  ...extra,
});
const ymd = (d: Date) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;

describe('billing cycle', () => {
  it('follows the issuers’ table when no start day is given', () => {
    expect(defaultCycleStart(14)).toBe(1);
    expect(defaultCycleStart(25)).toBe(12);
    expect(defaultCycleStart(5)).toBe(22);
    expect(defaultCycleStart(1)).toBe(18);
  });

  it('a payment covers the period that closed most recently before it', () => {
    // 14일 결제 ← 전월 1일~말일
    expect(ymd(cycleBoundary(new Date(2026, 11, 14, 9), 1))).toBe('2026-12-1');
    // 25일 결제 ← 전월 12일~당월 11일
    expect(ymd(cycleBoundary(new Date(2026, 11, 25, 9), 12))).toBe('2026-12-12');
    // 1일 결제 ← 전전월 18일~전월 17일
    expect(ymd(cycleBoundary(new Date(2026, 11, 1, 9), 18))).toBe('2026-11-18');
  });

  it('clamps the 31st to shorter months', () => {
    expect(ymd(payDateOf(31, new Date(2027, 1, 10), 0))).toBe('2027-2-28');
  });
});

describe('nextBill', () => {
  it('before the payment day: everything outstanding except what was charged since the period closed', () => {
    const now = new Date(2026, 10, 10, 12);
    const txs = [charge(new Date(2026, 10, 3), 40_000), charge(new Date(2026, 9, 20), 100_000)];
    const bill = nextBill(card(), txs, now);
    expect(bill).toMatchObject({ daysUntil: 4, amount: 460_000, closed: true });
    expect(ymd(bill!.payDate)).toBe('2026-11-14');
  });

  it('after the payment day: next month’s bill, still growing', () => {
    const now = new Date(2026, 10, 20, 12);
    const bill = nextBill(card({ balance: -120_000 }), [], now);
    expect(ymd(bill!.payDate)).toBe('2026-12-14');
    expect(bill).toMatchObject({ amount: 120_000, closed: false });
  });

  it('on the payment day, once it has been posted, it is next month’s', () => {
    const now = new Date(2026, 10, 14, 15);
    const open = nextBill(card(), [], now);
    expect(open).toMatchObject({ daysUntil: 0 });
    const posted = nextBill(card({ billingPostedThrough: now.toISOString() }), [], now);
    expect(ymd(posted!.payDate)).toBe('2026-12-14');
  });

  it('a refund since the close does not raise the bill; a payment to the card is not a charge', () => {
    const now = new Date(2026, 10, 10, 12);
    const txs = [
      charge(new Date(2026, 10, 2), 50_000),
      charge(new Date(2026, 10, 4), -20_000),
      charge(new Date(2026, 10, 5), -300_000, { transferPairId: 'x' }),
    ];
    expect(billAmount(card(), txs, new Date(2026, 10, 14, 9), now)).toBe(470_000);
  });

  it('is null without a payment day', () => {
    expect(nextBill(card({ billingDay: undefined }), [])).toBeNull();
    expect(nextBill(account('bank', { billingDay: 14 }), [])).toBeNull();
  });
});

describe('shortfalls', () => {
  it('adds up what leaves each account, soonest first', () => {
    const accounts = [account('kb', { balance: 500_000 }), account('kakao', { balance: 900_000 })];
    const short = shortfalls(
      [
        { accountId: 'kb', amount: 459_285, daysUntil: 0 },
        { accountId: 'kb', amount: 700_000, daysUntil: 17 },
        { accountId: 'kakao', amount: 100_000, daysUntil: 3 },
      ],
      accounts,
    );
    expect(short.get('kb')).toEqual({ short: 659_285, daysUntil: 17 });
    expect(short.has('kakao')).toBe(false);
  });
});

describe('ensureAutoCardPayment', () => {
  const put = <T>(key: string, value: T) => window.localStorage.setItem(key, JSON.stringify(value));
  const read = <T>(key: string): T => JSON.parse(window.localStorage.getItem(key) ?? '[]') as T;
  const accounts = () => read<Account[]>(KEYS.accounts);
  const txs = () => read<Transaction[]>(KEYS.transactions);
  const auto = { autoBilling: true, billingAccountId: 'kb' };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('only stamps a card the first time it is seen', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 15));
    put(KEYS.accounts, [account('kb', { balance: 3_000_000, main: true }), card(auto)]);
    ensureAutoCardPayment();
    expect(txs()).toHaveLength(0);
    expect(accounts().find((a) => a.id === 'card')?.billingPostedThrough).toBeTruthy();
  });

  it('on the payment day moves the closed period’s bill from the bank to the card, once', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 15));
    put(KEYS.accounts, [account('kb', { balance: 3_000_000, main: true }), card(auto)]);
    ensureAutoCardPayment();

    // 500,000 outstanding from November; 80,000 charged on Dec 3 belongs to the next bill.
    put(KEYS.transactions, [charge(new Date(2026, 11, 3), 80_000)]);
    put(
      KEYS.accounts,
      accounts().map((a) => (a.id === 'card' ? { ...a, balance: -580_000 } : a)),
    );

    vi.setSystemTime(new Date(2026, 11, 14, 10));
    ensureAutoCardPayment();
    ensureAutoCardPayment();

    const legs = txs().filter((t) => t.transferPairId);
    expect(legs).toHaveLength(2);
    expect(legs.map((t) => [t.acc, t.amount]).sort()).toEqual(
      [
        ['card', 500_000],
        ['kb', -500_000],
      ].sort(),
    );
    // Paying the card is neither spending nor income.
    expect(legs.some(isExpense)).toBe(false);
    expect(legs.some(isIncome)).toBe(false);
    expect(accounts().find((a) => a.id === 'kb')?.balance).toBe(2_500_000);
    expect(accounts().find((a) => a.id === 'card')?.balance).toBe(-80_000);
  });

  it('switching auto payment off forgets the cursor', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 15));
    put(KEYS.accounts, [account('kb', { balance: 1 }), card(auto)]);
    ensureAutoCardPayment();
    put(
      KEYS.accounts,
      accounts().map((a) => (a.id === 'card' ? { ...a, autoBilling: false } : a)),
    );
    ensureAutoCardPayment();
    expect(accounts().find((a) => a.id === 'card')?.billingPostedThrough).toBeUndefined();
  });
});
