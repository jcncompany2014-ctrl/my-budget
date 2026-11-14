import { describe, expect, it } from 'vitest';
import { isPaymentMonth, loanPayment, nextLoanDue } from '@/lib/loans';
import type { Loan } from '@/lib/types';

const loan = (extra: Partial<Loan> = {}): Loan => ({
  id: 'l',
  name: '농협 사업자대출',
  emoji: '',
  scope: 'business',
  lender: 'NH농협은행',
  principal: 40_000_000,
  remaining: 40_000_000,
  rate: 3.9,
  termMonths: 60,
  startDate: '2025-12-20',
  dueDate: '2030-12-20',
  color: '#000',
  paymentDay: 20,
  paymentEveryMonths: 3,
  paymentAnchor: '2026-12-20',
  graceUntil: '2027-12-20',
  ...extra,
});

describe('loan schedule', () => {
  it('a quarterly loan pays every third month counted from a known payment date', () => {
    const l = loan();
    const months = [8, 9, 10, 11].map((m) => isPaymentMonth(l, 2026, m));
    expect(months).toEqual([true, false, false, true]); // Sep, Dec
    expect(isPaymentMonth(l, 2027, 2)).toBe(true); // Mar
    expect(isPaymentMonth(loan({ paymentEveryMonths: undefined }), 2026, 9)).toBe(true);
  });

  it('interest only during the grace period: 4,000만 × 3.9% ÷ 4', () => {
    expect(loanPayment(loan(), new Date(2026, 11, 20, 9))).toEqual({
      interest: 390_000,
      principal: 0,
    });
    // The last interest-only payment falls on the grace date itself.
    expect(loanPayment(loan(), new Date(2027, 11, 20, 9)).principal).toBe(0);
  });

  it('after the grace period the balance is spread over the payments left', () => {
    // 2028-03 … 2030-12 → 12 quarterly payments.
    const first = loanPayment(loan(), new Date(2028, 2, 20, 9));
    expect(first.interest).toBe(390_000);
    expect(first.principal).toBeGreaterThan(3_100_000);
    expect(first.principal).toBeLessThan(3_300_000);

    // Walking the whole schedule pays the loan off exactly.
    let remaining = 40_000_000;
    for (let i = 0; i < 12; i++) {
      const due = new Date(2028, 2 + i * 3, 20, 9);
      remaining -= loanPayment(loan({ remaining }), due).principal;
    }
    expect(remaining).toBe(0);
  });

  it('a plain monthly loan keeps its fixed payment', () => {
    const car = loan({
      principal: 25_000_000,
      remaining: 22_713_278,
      termMonths: 60,
      monthlyPayment: 459_285,
      paymentEveryMonths: undefined,
      paymentAnchor: undefined,
      graceUntil: undefined,
      paymentDay: 14,
    });
    expect(loanPayment(car, new Date(2026, 10, 14, 9))).toEqual({
      interest: 73_818,
      principal: 385_467,
    });
  });

  it('nextLoanDue skips months without a payment and a payment already posted today', () => {
    const now = new Date(2026, 10, 14, 15);
    expect(nextLoanDue(loan(), now)).toMatchObject({ daysUntil: 36, interest: 390_000 });

    const car = loan({
      paymentEveryMonths: undefined,
      paymentAnchor: undefined,
      graceUntil: undefined,
      paymentDay: 14,
      autoPayment: true,
    });
    expect(nextLoanDue(car, now)?.daysUntil).toBe(0);
    expect(nextLoanDue({ ...car, postedThrough: now.toISOString() }, now)?.daysUntil).toBe(30);
  });
});
