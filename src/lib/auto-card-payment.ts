'use client';

import { billAmount, hasBilling, payDateOf } from '@/lib/card-billing';
import { applyTxToAccounts } from '@/lib/integrity';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Account, Transaction } from '@/lib/types';

const isOn = (a: Account) => hasBilling(a) && !!a.autoBilling && !!a.billingAccountId;

/**
 * 카드대금 자동 결제. On a card's payment day the bill for the usage period
 * that just closed moves from the paying account to the card — a transfer, not
 * spending: each purchase was already counted on the day it was made.
 *
 * `billingPostedThrough` on the card is the cursor. A card seen for the first
 * time with auto payment on is only stamped; payment days from then on post.
 * Switching it off drops the cursor. After a long absence only the latest
 * payment day is settled, with the bill as it stands now.
 */
export function ensureAutoCardPayment() {
  if (typeof window === 'undefined') return;

  const accounts = readStorageValue<Account[]>(KEYS.accounts, []);
  if (!accounts.some((a) => a.type === 'card' && (a.autoBilling || a.billingPostedThrough))) return;

  const now = new Date();
  const stamp = now.toISOString();
  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const existingIds = new Set(txs.map((t) => t.id));

  const newTxs: Transaction[] = [];
  const cursor = new Map<string, string | undefined>();

  for (const card of accounts) {
    if (card.type !== 'card') continue;
    if (!isOn(card)) {
      if (card.billingPostedThrough) cursor.set(card.id, undefined);
      continue;
    }
    if (!card.billingPostedThrough) {
      cursor.set(card.id, stamp);
      continue;
    }
    const settled = new Date(card.billingPostedThrough).getTime();
    // The latest payment day that has come: this month's, else last month's.
    let payDate = payDateOf(card.billingDay as number, now, 0);
    if (payDate > now) payDate = payDateOf(card.billingDay as number, now, -1);
    if (payDate > now || payDate.getTime() <= settled) continue;
    cursor.set(card.id, stamp);

    const from = accounts.find((a) => a.id === card.billingAccountId && a.id !== card.id);
    const id = `cardpay-${payDate.getFullYear()}-${payDate.getMonth()}-${card.id}`;
    if (!from || existingIds.has(id)) continue;
    const amount = billAmount(card, txs, payDate, now);
    if (amount <= 0) continue;

    const date = payDate.toISOString();
    const memo = '카드대금 (자동)';
    newTxs.push(
      {
        id,
        date,
        amount: -amount,
        cat: from.scope === 'business' ? 'biz_transfer' : 'transfer',
        merchant: `카드대금 → ${card.name}`,
        memo,
        acc: from.id,
        scope: from.scope,
        recurring: true,
        transferPairId: id,
        transferTo: card.id,
        transferCrossMode: from.scope !== card.scope || undefined,
      },
      {
        id: `${id}-in`,
        date,
        amount,
        cat: card.scope === 'business' ? 'biz_transfer' : 'transfer',
        merchant: `카드대금 ← ${from.name}`,
        memo,
        acc: card.id,
        scope: card.scope,
        recurring: true,
        transferPairId: id,
        transferTo: from.id,
        transferCrossMode: from.scope !== card.scope || undefined,
      },
    );
  }

  if (newTxs.length > 0) {
    // Rows first: a failed save must not leave a balance moved by a row that is gone.
    writeStorageValue(KEYS.transactions, [...newTxs, ...txs]);
    newTxs.forEach(applyTxToAccounts);
  }
  if (cursor.size > 0) {
    // Re-read: applying the rows just changed the balances.
    const latest = readStorageValue<Account[]>(KEYS.accounts, []);
    writeStorageValue(
      KEYS.accounts,
      latest.map((a) => {
        if (!cursor.has(a.id)) return a;
        const next = { ...a };
        const value = cursor.get(a.id);
        if (value) next.billingPostedThrough = value;
        else delete next.billingPostedThrough;
        return next;
      }),
    );
  }
}
