import { describe, expect, it } from 'vitest';
import { computePnl } from '@/lib/biz-pnl';
import type { Transaction } from '@/lib/types';

const from = new Date(2026, 10, 1);
const to = new Date(2026, 10, 30, 23, 59, 59, 999);
let n = 0;
const tx = (cat: string, amount: number, extra: Partial<Transaction> = {}): Transaction => ({
  id: `t${n++}`,
  date: new Date(2026, 10, 10, 12).toISOString(),
  amount,
  cat,
  merchant: 'x',
  acc: 'biz',
  scope: 'business',
  ...extra,
});

describe('computePnl', () => {
  it('builds the statement from recorded rows only', () => {
    const p = computePnl(
      [
        tx('biz_sales_card', 10_000_000),
        tx('biz_purchase', -4_000_000),
        tx('biz_rent', -1_000_000),
        tx('biz_payroll', -2_200_000),
        tx('loan_payment', -130_000),
        tx('biz_marketing', -500_000),
        tx('biz_etc', -170_000),
      ],
      from,
      to,
    );
    expect(p).toMatchObject({
      revenue: 10_000_000,
      cogs: 4_000_000,
      gross: 6_000_000,
      fixed: 3_330_000,
      variable: 670_000,
      operating: 2_000_000,
    });
    // (고정비) ÷ (1 − 변동비율): 3,330,000 ÷ (5,330,000 / 10,000,000)
    expect(p.breakEven).toBe(Math.round(3_330_000 / 0.533));
    expect(p.byCategory[0]).toEqual(['biz_payroll', 2_200_000]);
  });

  it('leaves out transfers, owner draws, capital and loan principal', () => {
    const p = computePnl(
      [
        tx('biz_sales_cash', 1_000_000),
        tx('biz_transfer', -300_000, { transferPairId: 'a' }),
        tx('biz_owner_draw', -500_000, { transferPairId: 'b' }),
        tx('biz_capital', 3_150_000, { transferPairId: 'c' }),
        tx('biz_loan_principal', -400_000),
      ],
      from,
      to,
    );
    expect(p).toMatchObject({ revenue: 1_000_000, fixed: 0, variable: 0, operating: 1_000_000 });
  });

  it('a refund lowers the cost it came from; other months are ignored', () => {
    const p = computePnl(
      [
        tx('biz_supplies', -200_000),
        tx('biz_supplies', 50_000),
        tx('biz_supplies', -999_999, { date: new Date(2026, 9, 31, 23).toISOString() }),
      ],
      from,
      to,
    );
    expect(p.variable).toBe(150_000);
    expect(p.breakEven).toBeNull();
  });

  it('counts 사업 대납 paid with a personal card as a business cost', () => {
    const p = computePnl([tx('biz_etc', -120_000, { acc: 'my-card', reimburse: 'due' })], from, to);
    expect(p.variable).toBe(120_000);
  });
});
