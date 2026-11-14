import type { Account, Transaction } from '@/lib/types';

/**
 * Credit-card billing.
 *
 * A card has a payment day (결제일) and a usage period (이용기간) that closes
 * about two weeks before it: paying on the 14th covers the whole previous
 * month, paying on the 25th covers the 12th of last month to the 11th of this
 * one. `cycleStartDay` is the day a new usage period begins; each payment
 * covers the period that closed most recently before it.
 *
 * Instalments are not modelled — what is outstanding is treated as due.
 */

/** The issuers' usual table: the period closes 13 days before the payment day. */
export function defaultCycleStart(billingDay: number): number {
  return ((((billingDay - 14) % 30) + 30) % 30) + 1;
}

const clamp = (year: number, month: number, day: number) =>
  Math.min(day, new Date(year, month + 1, 0).getDate());

/** `day` of the given month at local midnight, clamped to the month's length. */
const dayOf = (year: number, month: number, day: number) =>
  new Date(year, month, clamp(year, month, day), 0, 0, 0, 0);

/** The billing date of the month `monthsFromNow` away, at 09:00 like the other auto rows. */
export function payDateOf(billingDay: number, now: Date, monthsFromNow: number): Date {
  const first = new Date(now.getFullYear(), now.getMonth() + monthsFromNow, 1);
  const d = dayOf(first.getFullYear(), first.getMonth(), billingDay);
  d.setHours(9, 0, 0, 0);
  return d;
}

/**
 * First instant of the usage period that is still open on `payDate` — every
 * charge before it is covered by that payment, every charge from it on belongs
 * to the next one.
 */
export function cycleBoundary(payDate: Date, cycleStartDay: number): Date {
  const y = payDate.getFullYear();
  const m = payDate.getMonth();
  const thisMonth = dayOf(y, m, cycleStartDay);
  const payDay = new Date(y, m, payDate.getDate());
  return thisMonth.getTime() <= payDay.getTime() ? thisMonth : dayOf(y, m - 1, cycleStartDay);
}

export type CardBill = {
  /** When the money leaves the paying account. */
  payDate: Date;
  /** Whole days until then (0 = today). */
  daysUntil: number;
  /** What that payment will take. */
  amount: number;
  /** The usage period has closed — the amount is final. */
  closed: boolean;
};

export const hasBilling = (a: Account) =>
  a.type === 'card' && !!a.billingDay && a.billingDay >= 1 && a.billingDay <= 31;

/** Net charges on the card from `from` on (refunds reduce it; payments to the card don't count). */
function chargesSince(card: Account, txs: Transaction[], from: Date): number {
  const iso = from.toISOString();
  let sum = 0;
  for (const t of txs) {
    if (t.acc !== card.id || t.transferPairId || t.date < iso) continue;
    sum -= t.amount;
  }
  return sum;
}

/** What the payment on `payDate` takes, given the card's balance and ledger as they stand. */
export function billAmount(card: Account, txs: Transaction[], payDate: Date, now: Date): number {
  const outstanding = Math.max(0, -card.balance);
  const boundary = cycleBoundary(
    payDate,
    card.cycleStartDay ?? defaultCycleStart(card.billingDay ?? 14),
  );
  // Until the period closes everything outstanding is in it; after that, what
  // was charged since belongs to the next bill.
  if (now.getTime() < boundary.getTime()) return outstanding;
  return Math.max(0, outstanding - Math.max(0, chargesSince(card, txs, boundary)));
}

/** The card's next payment, or null when the card has no payment day. */
export function nextBill(
  card: Account,
  txs: Transaction[],
  now: Date = new Date(),
): CardBill | null {
  if (!hasBilling(card)) return null;
  const billingDay = card.billingDay as number;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const settled = card.billingPostedThrough ? new Date(card.billingPostedThrough).getTime() : 0;

  let payDate = payDateOf(billingDay, now, 0);
  const payDay = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate());
  // This month's day has gone by, or its payment has already been posted.
  if (payDay.getTime() < today.getTime() || payDate.getTime() <= settled) {
    payDate = payDateOf(billingDay, now, 1);
  }
  const boundary = cycleBoundary(payDate, card.cycleStartDay ?? defaultCycleStart(billingDay));
  const until = new Date(payDate.getFullYear(), payDate.getMonth(), payDate.getDate());
  return {
    payDate,
    daysUntil: Math.round((until.getTime() - today.getTime()) / 86_400_000),
    amount: billAmount(card, txs, payDate, now),
    closed: now.getTime() >= boundary.getTime(),
  };
}

export type Outflow = { accountId: string; amount: number; daysUntil: number };

/**
 * Accounts that will not cover what is about to leave them: for each paying
 * account, the running total of upcoming debits (soonest first) against its
 * balance. Returns how much each account falls short, and on which debit.
 */
export function shortfalls(
  outflows: Outflow[],
  accounts: Account[],
): Map<string, { short: number; daysUntil: number }> {
  const out = new Map<string, { short: number; daysUntil: number }>();
  const left = new Map(accounts.map((a) => [a.id, a.balance]));
  for (const o of [...outflows].sort((a, b) => a.daysUntil - b.daysUntil)) {
    const before = left.get(o.accountId);
    if (before === undefined) continue;
    const after = before - o.amount;
    left.set(o.accountId, after);
    if (after < 0 && !out.has(o.accountId)) {
      out.set(o.accountId, { short: -after, daysUntil: o.daysUntil });
    } else if (after < 0) {
      const cur = out.get(o.accountId) as { short: number; daysUntil: number };
      out.set(o.accountId, { short: -after, daysUntil: cur.daysUntil });
    }
  }
  return out;
}
