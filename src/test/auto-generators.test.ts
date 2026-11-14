import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAutoCreditLine } from '@/lib/auto-credit-line';
import { ensureAutoPayroll } from '@/lib/auto-payroll';
import type { BusinessProfile } from '@/lib/business-profile';
import { applyRepair, checkDataIntegrity } from '@/lib/data-check';
import { KEYS } from '@/lib/storage-keys';
import type { Account, Employee, LineOfCredit, Transaction } from '@/lib/types';

const put = <T>(key: string, value: T) => window.localStorage.setItem(key, JSON.stringify(value));
const read = <T>(key: string, fallback: T): T => {
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
};
const txs = () => read<Transaction[]>(KEYS.transactions, []);
const balance = (id: string) =>
  read<Account[]>(KEYS.accounts, []).find((a) => a.id === id)?.balance;

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

const line = (extra: Partial<LineOfCredit> = {}): LineOfCredit => ({
  id: 'l1',
  name: '마통',
  emoji: '',
  scope: 'personal',
  bank: '',
  limit: 50_000_000,
  used: 12_000_000,
  rate: 6,
  interestDay: 5,
  linkedAccountId: 'main',
  autoInterest: true,
  color: '#000',
  ...extra,
});

describe('ensureAutoCreditLine', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('a line seen for the first time is stamped, not charged for past months', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 15, 0, 0));
    put(KEYS.creditLines, [line()]);
    put(KEYS.accounts, [account('main', 1_000_000)]);

    ensureAutoCreditLine();
    expect(txs()).toHaveLength(0);
    expect(balance('main')).toBe(1_000_000);
    expect(read<LineOfCredit[]>(KEYS.creditLines, [])[0].postedThrough).toBeTruthy();
  });

  it('charges once on the next interest day', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 15, 0, 0));
    put(KEYS.creditLines, [line()]);
    put(KEYS.accounts, [account('main', 1_000_000)]);
    ensureAutoCreditLine();

    vi.setSystemTime(new Date(2026, 11, 5, 10, 0, 0));
    ensureAutoCreditLine();
    ensureAutoCreditLine();
    expect(txs()).toHaveLength(1);
    // 12,000,000 × 6% ÷ 12
    expect(txs()[0].amount).toBe(-60_000);
    expect(balance('main')).toBe(940_000);
  });

  it('a month with nothing drawn is not charged later at the new balance', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 15, 0, 0));
    put(KEYS.creditLines, [line({ used: 0 })]);
    put(KEYS.accounts, [account('main', 1_000_000)]);
    ensureAutoCreditLine();

    vi.setSystemTime(new Date(2026, 11, 6, 10, 0, 0));
    ensureAutoCreditLine();
    expect(txs()).toHaveLength(0);

    // Drawn after the December interest day.
    put(KEYS.creditLines, [{ ...read<LineOfCredit[]>(KEYS.creditLines, [])[0], used: 5_000_000 }]);
    vi.setSystemTime(new Date(2026, 11, 20, 10, 0, 0));
    ensureAutoCreditLine();
    expect(txs()).toHaveLength(0);
  });

  it('switching auto interest off and on again starts from that day', () => {
    vi.setSystemTime(new Date(2026, 7, 1, 10, 0, 0));
    put(KEYS.creditLines, [line()]);
    put(KEYS.accounts, [account('main', 1_000_000)]);
    ensureAutoCreditLine();

    put(KEYS.creditLines, [
      { ...read<LineOfCredit[]>(KEYS.creditLines, [])[0], autoInterest: false },
    ]);
    vi.setSystemTime(new Date(2026, 8, 1, 10, 0, 0));
    ensureAutoCreditLine();
    expect(read<LineOfCredit[]>(KEYS.creditLines, [])[0].postedThrough).toBeUndefined();

    put(KEYS.creditLines, [
      { ...read<LineOfCredit[]>(KEYS.creditLines, [])[0], autoInterest: true },
    ]);
    vi.setSystemTime(new Date(2026, 10, 14, 10, 0, 0));
    ensureAutoCreditLine();
    expect(txs()).toHaveLength(0);
  });
});

const profile = (extra: Partial<BusinessProfile> = {}): BusinessProfile => ({
  companyName: '',
  registrationNumber: '',
  ownerName: '',
  industry: '',
  taxClass: 'general',
  cardFeeRate: 2.5,
  deliveryFeeRate: 13,
  socialInsuranceRate: 10,
  autoPayroll: true,
  payrollDay: 25,
  ...extra,
});
const employee = (extra: Partial<Employee> = {}): Employee => ({
  id: 'e1',
  name: '김직원',
  baseSalary: 2_000_000,
  startDate: '2026-01-02',
  active: true,
  color: '#000',
  ...extra,
});

describe('ensureAutoPayroll', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('switching it on posts nothing for past months', () => {
    vi.setSystemTime(new Date(2026, 10, 26, 10, 0, 0));
    put(KEYS.businessProfile, profile());
    put(KEYS.employees, [employee()]);
    put(KEYS.accounts, [account('biz', 10_000_000, { scope: 'business', main: true })]);

    ensureAutoPayroll();
    expect(txs()).toHaveLength(0);
    expect(balance('biz')).toBe(10_000_000);
  });

  it('pays from the business main account on the next payday, once', () => {
    vi.setSystemTime(new Date(2026, 10, 14, 10, 0, 0));
    put(KEYS.businessProfile, profile());
    put(KEYS.employees, [
      employee(),
      employee({ id: 'e2', name: '신입', startDate: '2026-11-27' }),
      employee({ id: 'e3', name: '퇴사', active: false }),
    ]);
    put(KEYS.accounts, [
      account('card', -50_000, { scope: 'business', type: 'card' }),
      account('biz', 10_000_000, { scope: 'business', main: true }),
      account('mine', 1_000_000, { main: true }),
    ]);
    ensureAutoPayroll();

    vi.setSystemTime(new Date(2026, 10, 25, 12, 0, 0));
    ensureAutoPayroll();
    ensureAutoPayroll();
    const rows = txs();
    // Only the employee already working on the 25th.
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ acc: 'biz', amount: -2_200_000, scope: 'business' });
    expect(balance('biz')).toBe(7_800_000);
    expect(balance('mine')).toBe(1_000_000);
  });
});

describe('data-check repairs', () => {
  it('moves an orphaned row to the main account of its own ledger', () => {
    put(KEYS.accounts, [
      account('mine', 0, { main: true }),
      account('biz-card', 0, { scope: 'business', type: 'card' }),
      account('biz', 0, { scope: 'business', main: true }),
    ]);
    put(KEYS.transactions, [
      {
        id: 't1',
        amount: -1000,
        cat: 'biz_etc',
        merchant: 'X',
        acc: 'ghost',
        date: '2026-04-30',
        scope: 'business',
      },
    ]);
    const issue = checkDataIntegrity().issues.find((i) => i.kind === 'tx_unknown_account');
    expect(issue?.repair).toMatchObject({ toAccId: 'biz' });
    expect(applyRepair(issue!)).toBe(true);
    expect(txs()[0].acc).toBe('biz');
  });

  it('does not flag a refund or a balance correction', () => {
    put(KEYS.accounts, [account('mine', 0)]);
    put(KEYS.transactions, [
      {
        id: 't1',
        amount: 15000,
        cat: 'shopping',
        merchant: '쿠팡 환불',
        acc: 'mine',
        date: '2026-04-30',
      },
      {
        id: 't2',
        amount: 3200,
        cat: 'adjust',
        merchant: '잔액 보정',
        acc: 'mine',
        date: '2026-04-30',
      },
      {
        id: 't3',
        amount: 500000,
        cat: 'saving',
        merchant: '적금 해지',
        acc: 'mine',
        date: '2026-04-30',
      },
    ]);
    expect(checkDataIntegrity().issues).toHaveLength(0);
  });

  it('unpairing a lone transfer leg clears every transfer field', () => {
    put(KEYS.accounts, [account('mine', 0)]);
    put(KEYS.transactions, [
      {
        id: 't1',
        amount: -1000,
        cat: 'transfer',
        merchant: '→ 어딘가',
        acc: 'mine',
        date: '2026-04-30',
        transferPairId: 'x1',
        transferTo: 'gone',
      },
    ]);
    const issue = checkDataIntegrity().issues.find((i) => i.kind === 'transfer_pair_missing');
    expect(applyRepair(issue!)).toBe(true);
    expect(txs()[0]).not.toHaveProperty('transferPairId');
    expect(txs()[0]).not.toHaveProperty('transferTo');
  });
});
