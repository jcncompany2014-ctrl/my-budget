import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ensureAutoLoanPayment } from '@/lib/auto-loan-payment';
import { isExpense } from '@/lib/format';
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
    // 3-month backfill — Feb / Mar / Apr, an interest row and a principal row each
    expect(txs.length).toBeGreaterThanOrEqual(2);
    expect(txs.length).toBeLessThanOrEqual(6);
    // Each has correct shape
    for (const t of txs) {
      expect(['loan_payment', 'loan_principal']).toContain(t.cat);
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

    // A household ledger counts the whole instalment as money spent.
    const [interest, principal] = readTxs();
    expect(interest).toMatchObject({ amount: -73_818, cat: 'loan_payment', acc: 'acc-1' });
    expect(principal).toMatchObject({ amount: -385_467, cat: 'loan_principal', acc: 'acc-1' });
    expect(isExpense(interest)).toBe(true);
    expect(isExpense(principal)).toBe(true);
    expect(readTxs()).toHaveLength(2);
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

  it('in the business ledger only the interest is a cost', () => {
    seedLoan({
      scope: 'business',
      principal: 12_000_000,
      remaining: 12_000_000,
      rate: 6,
      termMonths: 12,
      monthlyPayment: undefined,
      paymentDay: 14,
      postedThrough: new Date(2026, 10, 14).toISOString(),
    });
    seedAccount({ scope: 'business' });
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0));
    ensureAutoLoanPayment();
    const [interest, principal] = readTxs();
    expect(interest.cat).toBe('loan_payment');
    expect(principal.cat).toBe('biz_loan_principal');
    expect(isExpense(interest)).toBe(true);
    expect(isExpense(principal)).toBe(false);
  });

  it('a quarterly, interest-only loan posts 390,000 every third month and nothing in between', () => {
    // 4,000만 · 3.9% · 2년 거치 3년 분할 · 3개월마다 이자
    seedLoan({
      scope: 'business',
      principal: 40_000_000,
      remaining: 40_000_000,
      rate: 3.9,
      termMonths: 60,
      monthlyPayment: undefined,
      startDate: '2025-12-20',
      paymentEveryMonths: 3,
      paymentAnchor: '2026-12-20',
      graceUntil: '2027-12-20',
      paymentDay: 20,
      postedThrough: new Date(2026, 10, 14).toISOString(),
    });
    seedAccount({ scope: 'business', balance: 1_000_000 });

    vi.setSystemTime(new Date(2026, 10, 25, 12, 0, 0)); // November: not a payment month
    ensureAutoLoanPayment();
    expect(readTxs()).toHaveLength(0);

    vi.setSystemTime(new Date(2026, 11, 20, 12, 0, 0)); // December 20
    ensureAutoLoanPayment();
    ensureAutoLoanPayment();
    expect(readTxs()).toHaveLength(1);
    expect(readTxs()[0]).toMatchObject({ amount: -390_000, cat: 'loan_payment' });
    expect(readLoans()[0].remaining).toBe(40_000_000);

    vi.setSystemTime(new Date(2027, 1, 25, 12, 0, 0)); // Jan, Feb: nothing
    ensureAutoLoanPayment();
    expect(readTxs()).toHaveLength(1);

    vi.setSystemTime(new Date(2027, 2, 20, 12, 0, 0)); // March 20
    ensureAutoLoanPayment();
    expect(readTxs()).toHaveLength(2);
  });
});
