import { type Currency, fxRateToKRW, type Quote, type QuoteId } from '@/lib/quotes';
import type { Account, Investment, LineOfCredit, Loan } from '@/lib/types';

type Quotes = Partial<Record<QuoteId, Quote>>;

/**
 * KRW value and cost of one holding. Value falls back to the cached
 * `currentValue` until both the quote and its FX rate are in; cost is null
 * while the product currency's rate is unknown (a foreign cost read as KRW
 * would swing the P&L wildly for the first second after a cold start).
 */
export function valueInvestment(i: Investment, quotes: Quotes) {
  const live = i.autoQuote && i.quoteId ? quotes[i.quoteId as QuoteId] : undefined;
  const shares = i.shares ?? 0;
  const liveRate = live ? fxRateToKRW(live.currency) : null;
  const valueKRW = live && liveRate !== null ? live.price * liveRate * shares : i.currentValue;
  const costRate = fxRateToKRW((i.currency ?? 'KRW') as Currency);
  const costKRW = costRate !== null ? shares * (i.avgPrice ?? 0) * costRate : null;
  return { live, valueKRW, costKRW };
}

export type NetWorth = {
  /** Bank + cash balances. */
  cash: number;
  /** Investment accounts (live value of linked holdings, else the entered balance) + unlinked holdings. */
  investment: number;
  /** What the holdings cost; null while an FX rate is missing or nothing has a cost. */
  investmentCost: number | null;
  /** Money owed to me — receivable accounts plus 사업 대납 the business has not paid back. */
  receivable: number;
  /** 대납 the business still owes its owner (a liability of the business ledger). */
  ownerPayable: number;
  /** Card balances — zero or negative. */
  cardDebt: number;
  loanDebt: number;
  creditLineUsed: number;
  net: number;
  /** What each investment account is worth right now. */
  accountValue: (a: Account) => number;
  accountCost: (a: Account) => number | null;
  /** How many holdings are attached to an investment account. */
  accountHoldings: (a: Account) => number;
  /** Holdings not attached to any account in `accounts`. */
  unlinked: Investment[];
  unlinkedValue: number;
};

/** Net worth of one ledger. Pass collections already filtered to that scope. */
export function computeNetWorth(args: {
  accounts: Account[];
  investments: Investment[];
  loans: Loan[];
  creditLines: LineOfCredit[];
  quotes: Quotes;
  /**
   * Unsettled 사업 대납 (business costs paid with personal money): pass it as
   * `owedToMe` for the personal ledger, `owedToOwner` for the business one.
   */
  owedToMe?: number;
  owedToOwner?: number;
}): NetWorth {
  const { accounts, investments, loans, creditLines, quotes } = args;
  const ownerPayable = args.owedToOwner ?? 0;
  const invAccounts = accounts.filter((a) => a.type === 'investment');
  const invAccountIds = new Set(invAccounts.map((a) => a.id));

  const byAccount = new Map<string, { value: number; cost: number | null; count: number }>();
  const unlinked: Investment[] = [];
  let unlinkedValue = 0;
  let unlinkedCost: number | null = 0;
  const add = (a: number | null, b: number | null) => (a === null || b === null ? null : a + b);
  for (const i of investments) {
    const { valueKRW, costKRW } = valueInvestment(i, quotes);
    if (i.linkedAccountId && invAccountIds.has(i.linkedAccountId)) {
      const cur = byAccount.get(i.linkedAccountId) ?? { value: 0, cost: 0, count: 0 };
      byAccount.set(i.linkedAccountId, {
        value: cur.value + valueKRW,
        cost: add(cur.cost, costKRW),
        count: cur.count + 1,
      });
    } else {
      unlinked.push(i);
      unlinkedValue += valueKRW;
      unlinkedCost = add(unlinkedCost, costKRW);
    }
  }

  // A linked account is worth its holdings; an unlinked one, the balance typed in.
  const accountValue = (a: Account) => {
    const linked = a.type === 'investment' ? byAccount.get(a.id) : undefined;
    return linked ? Math.round(linked.value) : a.balance;
  };
  const accountCost = (a: Account) => {
    const linked = byAccount.get(a.id);
    return linked ? linked.cost : 0;
  };

  const sum = (list: Account[]) => list.reduce((s, a) => s + a.balance, 0);
  const cash = sum(accounts.filter((a) => a.type === 'bank' || a.type === 'cash'));
  const receivable = sum(accounts.filter((a) => a.type === 'receivable')) + (args.owedToMe ?? 0);
  const cardDebt = sum(accounts.filter((a) => a.type === 'card'));
  const investment =
    invAccounts.reduce((s, a) => s + accountValue(a), 0) + Math.round(unlinkedValue);
  const totalCost = invAccounts.reduce<number | null>(
    (s, a) => add(s, accountCost(a)),
    unlinkedCost,
  );
  const loanDebt = loans.reduce((s, l) => s + l.remaining, 0);
  const creditLineUsed = creditLines.reduce((s, l) => s + l.used, 0);

  return {
    cash,
    investment,
    investmentCost: totalCost !== null && totalCost > 0 ? Math.round(totalCost) : null,
    receivable,
    ownerPayable,
    cardDebt,
    loanDebt,
    creditLineUsed,
    net: cash + investment + receivable + cardDebt - loanDebt - creditLineUsed - ownerPayable,
    accountValue,
    accountCost,
    accountHoldings: (a) => byAccount.get(a.id)?.count ?? 0,
    unlinked,
    unlinkedValue: Math.round(unlinkedValue),
  };
}
