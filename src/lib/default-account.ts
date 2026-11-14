import type { Account, Scope, Transaction } from '@/lib/types';

/**
 * The account a new hand-entered row should start on: the one the last
 * hand-entered row of that kind used, then the main account, then the first.
 * Auto-recorded, recurring and transfer rows don't count — they say nothing
 * about which card is in the user's hand.
 */
export function defaultAccountId(
  history: Transaction[],
  accounts: Account[],
  scope: Scope,
  income: boolean,
): string {
  let last: Transaction | undefined;
  for (const t of history) {
    if ((t.scope ?? 'personal') !== scope || t.amount > 0 !== income) continue;
    if (t.source === 'notification' || t.recurring || t.transferPairId) continue;
    if (last && t.date <= last.date) continue;
    if (!accounts.some((a) => a.id === t.acc)) continue;
    last = t;
  }
  return last?.acc ?? accounts.find((a) => a.main)?.id ?? accounts[0]?.id ?? '';
}

/**
 * Where a transfer out of `fromId` went last time — the usual counterparty
 * (월급통장 → 생활비통장). '' when this account never sent a transfer.
 */
export function lastTransferTarget(
  history: Transaction[],
  accounts: Account[],
  fromId: string,
): string {
  let last: Transaction | undefined;
  for (const t of history) {
    if (t.acc !== fromId || t.amount >= 0 || !t.transferPairId || !t.transferTo) continue;
    if (t.recurring) continue;
    if (last && t.date <= last.date) continue;
    if (!accounts.some((a) => a.id === t.transferTo)) continue;
    last = t;
  }
  return last?.transferTo ?? '';
}
