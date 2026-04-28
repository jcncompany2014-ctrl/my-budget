'use client';

import type { Account, Scope, Transaction } from '@/lib/types';

export type CreateTransferArgs = {
  fromAcc: Account;
  toAcc: Account;
  amount: number;
  date: string; // ISO
  memo?: string;
};

/**
 * Builds the two transaction legs for an account-to-account transfer.
 * Same-mode → cat = 'transfer' / 'biz_transfer'
 * Cross-mode → from-business: 'biz_owner_draw' (expense)
 *              to-personal:    'owner_pay' (income)
 *              from-personal:  generic transfer (cash leaving)
 *              to-business:    'biz_capital' (income)
 */
export function buildTransferLegs(args: CreateTransferArgs): Transaction[] {
  const { fromAcc, toAcc, amount, date, memo } = args;
  const pairId = 'xfer-' + Date.now().toString(36);
  const crossMode = fromAcc.scope !== toAcc.scope;

  const fromCat = pickFromCat(fromAcc.scope, toAcc.scope);
  const toCat = pickToCat(fromAcc.scope, toAcc.scope);

  const fromTx: Transaction = {
    id: 'tn-' + Date.now().toString(36) + '-a',
    date,
    amount: -Math.abs(amount),
    cat: fromCat,
    merchant: defaultMerchant(fromAcc.scope, toAcc.scope, 'from', toAcc.name),
    memo: memo ?? '',
    acc: fromAcc.id,
    scope: fromAcc.scope,
    transferPairId: pairId,
    transferTo: toAcc.id,
    transferCrossMode: crossMode,
  };

  const toTx: Transaction = {
    id: 'tn-' + Date.now().toString(36) + '-b',
    date,
    amount: Math.abs(amount),
    cat: toCat,
    merchant: defaultMerchant(fromAcc.scope, toAcc.scope, 'to', fromAcc.name),
    memo: memo ?? '',
    acc: toAcc.id,
    scope: toAcc.scope,
    transferPairId: pairId,
    transferTo: fromAcc.id,
    transferCrossMode: crossMode,
  };

  return [fromTx, toTx];
}

function pickFromCat(fromScope: Scope, toScope: Scope): string {
  if (fromScope === toScope) {
    return fromScope === 'business' ? 'biz_transfer' : 'transfer';
  }
  // cross-mode
  if (fromScope === 'business') return 'biz_owner_draw'; // 사장 인출
  return 'transfer'; // personal → business: just outgoing transfer
}

function pickToCat(fromScope: Scope, toScope: Scope): string {
  if (fromScope === toScope) {
    return toScope === 'business' ? 'biz_transfer' : 'transfer';
  }
  // cross-mode
  if (toScope === 'personal') return 'owner_pay'; // 사장 보수
  return 'biz_capital'; // personal → business: 자본 투입
}

function defaultMerchant(
  fromScope: Scope,
  toScope: Scope,
  side: 'from' | 'to',
  otherName: string,
): string {
  if (fromScope !== toScope) {
    if (fromScope === 'business' && side === 'from') return '사장 인출 → ' + otherName;
    if (toScope === 'personal' && side === 'to') return '사장 보수 ← ' + otherName;
    if (toScope === 'business' && side === 'to') return '자본 투입 ← ' + otherName;
    return (side === 'from' ? '→ ' : '← ') + otherName;
  }
  return (side === 'from' ? '→ ' : '← ') + otherName;
}
