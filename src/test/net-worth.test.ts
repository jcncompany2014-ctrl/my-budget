import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Account, Investment, Loan } from '@/lib/types';

const account = (id: string, type: Account['type'], balance: number): Account => ({
  id,
  name: id,
  bank: '',
  type,
  balance,
  color: '#000',
  scope: 'personal',
});
const holding = (extra: Partial<Investment>): Investment => ({
  id: 'i',
  name: 'x',
  scope: 'personal',
  kind: 'stock',
  currentValue: 0,
  color: '#000',
  ...extra,
});
const quote = (price: number, currency: string) => ({
  price,
  currency,
  change: 0,
  name: '',
  ts: 1,
});

async function load(cache: Record<string, unknown> = {}) {
  vi.resetModules();
  window.localStorage.setItem('asset/quotes-cache/v1', JSON.stringify(cache));
  return import('@/lib/net-worth');
}

describe('computeNetWorth', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('adds cash, receivables and holdings, subtracts cards, loans and credit lines', async () => {
    const { computeNetWorth } = await load();
    const nw = computeNetWorth({
      accounts: [
        account('kb', 'bank', 3_000_000),
        account('wallet', 'cash', 50_000),
        account('friend', 'receivable', 5_000_000),
        account('card', 'card', -2_337_650),
        account('sec', 'investment', 0),
        account('noran', 'investment', 1_850_000),
      ],
      investments: [
        holding({
          id: 'a',
          shares: 30,
          avgPrice: 69_172,
          currentValue: 1_405_500,
          linkedAccountId: 'sec',
        }),
        holding({ id: 'b', shares: 1, avgPrice: 100, currentValue: 90 }),
      ],
      loans: [{ remaining: 22_327_811 } as Loan],
      creditLines: [],
      quotes: {},
    });
    expect(nw.cash).toBe(3_050_000);
    expect(nw.receivable).toBe(5_000_000);
    // Linked account = its holdings; unlinked account = typed balance; plus the loose holding.
    expect(nw.investment).toBe(1_405_500 + 1_850_000 + 90);
    expect(nw.investmentCost).toBe(30 * 69_172 + 100);
    expect(nw.unlinked.map((i) => i.id)).toEqual(['b']);
    expect(nw.net).toBe(3_050_000 + 5_000_000 + 3_255_590 - 2_337_650 - 22_327_811);
  });

  it('counts a holding linked to a non-investment account instead of dropping it', async () => {
    const { computeNetWorth } = await load();
    const nw = computeNetWorth({
      accounts: [account('kb', 'bank', 1000)],
      investments: [holding({ currentValue: 500, linkedAccountId: 'kb' })],
      loans: [],
      creditLines: [],
      quotes: {},
    });
    expect(nw.net).toBe(1500);
  });

  it('converts live foreign quotes, and holds back until the FX rate is known', async () => {
    const usd = holding({
      shares: 108,
      avgPrice: 13.952,
      currentValue: 670_570,
      currency: 'USD',
      quoteId: 'yahoo:SMR',
      autoQuote: true,
    });
    const quotes = { 'yahoo:SMR': quote(4.66, 'USD') };

    const cold = await load();
    const before = cold.valueInvestment(usd, quotes);
    expect(before.valueKRW).toBe(670_570);
    expect(before.costKRW).toBeNull();

    const warm = await load({ 'yahoo:USDKRW=X': quote(1336.2, 'KRW') });
    const after = warm.valueInvestment(usd, quotes);
    expect(Math.round(after.valueKRW)).toBe(Math.round(4.66 * 1336.2 * 108));
    expect(Math.round(after.costKRW ?? 0)).toBe(Math.round(13.952 * 1336.2 * 108));
  });
});

describe('computeNetWorth — 사업 대납', () => {
  const base = { accounts: [], investments: [], loans: [], creditLines: [], quotes: {} };

  it('is money owed to me on the personal side', async () => {
    const { computeNetWorth } = await load();
    const nw = computeNetWorth({ ...base, owedToMe: 1_597_722 });
    expect(nw.receivable).toBe(1_597_722);
    expect(nw.ownerPayable).toBe(0);
    expect(nw.net).toBe(1_597_722);
  });

  it('is a debt of the business on the other side', async () => {
    const { computeNetWorth } = await load();
    const nw = computeNetWorth({ ...base, owedToOwner: 1_597_722 });
    expect(nw.receivable).toBe(0);
    expect(nw.ownerPayable).toBe(1_597_722);
    expect(nw.net).toBe(-1_597_722);
  });
});
