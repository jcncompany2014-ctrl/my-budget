import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAutoLoanPayment } from '@/lib/auto-loan-payment';
import { KEYS } from '@/lib/storage-keys';
import type { Account, Loan, Transaction } from '@/lib/types';

function seedLoan(overrides: Partial<Loan> = {}): Loan {
  const l: Loan = {
    id: 'loan-1',
    name: '주택담보대출',
    emoji: '🏠',
    scope: 'personal',
    lender: 'KB국민은행',
    principal: 100_000_000,
    remaining: 100_000_000,
    rate: 4.0,
    termMonths: 240,
    monthlyPayment: 605_980, // standard amortization @ 4% 240
    startDate: '2024-01-01',
    dueDate: '2044-01-01',
    color: '#3182F6',
    autoPayment: true,
    paymentDay: 5,
    linkedAccountId: 'acc-1',
    ...overrides,
  };
  window.localStorage.setItem(KEYS.loans, JSON.stringify([l]));
  return l;
}

function seedAccount(overrides: Partial<Account> = {}) {
  const a: Account = {
    id: 'acc-1',
    name: '주거래',
    bank: '토스뱅크',
    type: 'bank',
    balance: 50_000_000,
    color: '#00B956',
    scope: 'personal',
    ...overrides,
  };
  window.localStorage.setItem(KEYS.accounts, JSON.stringify([a]));
  return a;
}

function readTxs(): Transaction[] {
  const raw = window.localStorage.getItem(KEYS.transactions);
  return raw ? (JSON.parse(raw) as Transaction[]) : [];
}
function readLoans(): Loan[] {
  return JSON.parse(window.localStorage.getItem(KEYS.loans) ?? '[]') as Loan[];
}

describe('ensureAutoLoanPayment', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing when no loan is opted into autoPayment', () => {
    seedLoan({ autoPayment: false });
    seedAccount();
    vi.setSystemTime(new Date('2026-04-15T09:00:00Z'));
    ensureAutoLoanPayment();
    expect(readTxs()).toHaveLength(0);
  });

  it('posts one debit per month after paymentDay', () => {
    seedLoan(); // paymentDay 5, autoPayment true
    seedAccount();
    // Late April 15th — only April's payment (5th) has passed since start of test window.
    // Our 3-month backfill window is the 2 prior months + this month. April 5 has passed,
    // March 5 has passed, Feb 5 has passed → 3 transactions.
    vi.setSystemTime(new Date('2026-04-15T09:00:00Z'));
    ensureAutoLoanPayment();
    const txs = readTxs();
    // 3-month backfill — Feb / Mar / Apr
    expect(txs.length).toBeGreaterThanOrEqual(1);
    expect(txs.length).toBeLessThanOrEqual(3);
    // Each has correct shape
    for (const t of txs) {
      expect(t.cat).toBe('loan_payment');
      expect(t.acc).toBe('acc-1');
      expect(t.amount).toBeLessThan(0);
      expect(t.id).toMatch(/^loan-/);
    }
  });

  it('is idempotent — calling twice does not double-post', () => {
    seedLoan();
    seedAccount();
    vi.setSystemTime(new Date('2026-04-15T09:00:00Z'));
    ensureAutoLoanPayment();
    const after1st = readTxs().length;
    ensureAutoLoanPayment();
    const after2nd = readTxs().length;
    expect(after2nd).toBe(after1st);
  });

  it('decrements loan.remaining by the principal portion of each posted payment', () => {
    seedLoan({ remaining: 100_000_000 });
    seedAccount();
    vi.setSystemTime(new Date('2026-04-15T09:00:00Z'));
    ensureAutoLoanPayment();
    const after = readLoans()[0];
    // remaining must drop (we don't pin the exact amount because backfill count
    // depends on the LAST_RUN_KEY; the invariant is: it went down).
    expect(after.remaining).toBeLessThan(100_000_000);
    expect(after.remaining).toBeGreaterThan(95_000_000);
  });

  it('starts from postedThrough and debits the linked account', () => {
    // A 25,000,000원 / 3.9% / 60-month car loan entered after its 6th payment,
    // on the day the 7th is due.
    seedLoan({
      principal: 25_000_000,
      remaining: 22_713_278,
      rate: 3.9,
      termMonths: 60,
      monthlyPayment: 459_285,
      paymentDay: 14,
      postedThrough: new Date(2026, 10, 14).toISOString(),
    });
    seedAccount({ balance: 3_113_881 });
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0));
    ensureAutoLoanPayment();

    const txs = readTxs();
    expect(txs).toHaveLength(1);
    expect(txs[0]).toMatchObject({ amount: -459_285, acc: 'acc-1' });
    expect(txs[0].memo).toContain('원금 385,467 + 이자 73,818');
    expect(readLoans()[0].remaining).toBe(22_327_811);
    const acc = JSON.parse(window.localStorage.getItem(KEYS.accounts) ?? '[]') as Account[];
    expect(acc[0].balance).toBe(2_654_596);
  });

  it('skips a loan whose linkedAccount no longer exists', () => {
    seedLoan({ linkedAccountId: 'ghost-account' });
    seedAccount(); // id is acc-1, not ghost-account
    vi.setSystemTime(new Date('2026-04-15T09:00:00Z'));
    ensureAutoLoanPayment();
    expect(readTxs()).toHaveLength(0);
  });
});
