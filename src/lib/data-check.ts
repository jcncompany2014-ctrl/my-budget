'use client';

import { CATEGORIES } from '@/lib/categories';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue } from '@/lib/store-factory';
import type { Account, CustomCategory, Transaction } from '@/lib/types';

export type IntegrityIssue = {
  /** Stable id so a row can be repaired in isolation. */
  id: string;
  severity: 'error' | 'warning';
  /** What the issue is, in plain Korean. */
  title: string;
  /** Detail string, usually the offending tx merchant + date or balance diff. */
  detail: string;
  /** Internal kind so we know how to repair. */
  kind:
    | 'tx_unknown_account'
    | 'tx_unknown_category'
    | 'transfer_pair_missing'
    | 'category_sign_mismatch'
    | 'account_balance_drift';
  /** Tx id (or account id for balance drift) the issue is anchored to. */
  refId: string;
  /** Repair payload. */
  repair?:
    | { type: 'reassign_account'; txId: string; toAccId: string }
    | { type: 'reassign_category'; txId: string; toCatId: string }
    | { type: 'unpair_transfer'; txId: string }
    | { type: 'recompute_balance'; accId: string; computed: number };
};

export type IntegrityReport = {
  issues: IntegrityIssue[];
  summary: {
    transactions: number;
    accounts: number;
    errors: number;
    warnings: number;
  };
};

/**
 * Run a full integrity scan over what's currently in localStorage. Doesn't
 * touch state — caller decides whether to apply the suggested repairs.
 */
export function checkDataIntegrity(): IntegrityReport {
  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const accounts = readStorageValue<Account[]>(KEYS.accounts, []);
  const customCats = readStorageValue<CustomCategory[]>(KEYS.customCategories, []);

  const accIds = new Set(accounts.map((a) => a.id));
  const validCatIds = new Set([...Object.keys(CATEGORIES), ...customCats.map((c) => c.id)]);
  const fallbackAccId = accounts[0]?.id ?? '';
  const fallbackCatId = 'living';

  const issues: IntegrityIssue[] = [];

  // 1) Each tx points at a real account.
  for (const t of txs) {
    if (t.acc && !accIds.has(t.acc)) {
      issues.push({
        id: `acc-${t.id}`,
        severity: 'error',
        title: '존재하지 않는 계좌의 거래',
        detail: `${t.merchant} · ${t.date.slice(0, 10)} · 계좌 ID ${t.acc}`,
        kind: 'tx_unknown_account',
        refId: t.id,
        repair: fallbackAccId
          ? { type: 'reassign_account', txId: t.id, toAccId: fallbackAccId }
          : undefined,
      });
    }
  }

  // 2) Each tx points at a real category (built-in or custom).
  for (const t of txs) {
    if (!validCatIds.has(t.cat)) {
      issues.push({
        id: `cat-${t.id}`,
        severity: 'error',
        title: '존재하지 않는 카테고리의 거래',
        detail: `${t.merchant} · ${t.date.slice(0, 10)} · 카테고리 ID ${t.cat}`,
        kind: 'tx_unknown_category',
        refId: t.id,
        repair: { type: 'reassign_category', txId: t.id, toCatId: fallbackCatId },
      });
    }
  }

  // 3) Transfer pair is intact.
  const pairCounts = new Map<string, number>();
  for (const t of txs) {
    if (t.transferPairId) {
      pairCounts.set(t.transferPairId, (pairCounts.get(t.transferPairId) ?? 0) + 1);
    }
  }
  for (const t of txs) {
    if (t.transferPairId && pairCounts.get(t.transferPairId) !== 2) {
      issues.push({
        id: `pair-${t.id}`,
        severity: 'warning',
        title: '짝이 없는 이체 거래',
        detail: `${t.merchant} · ${t.date.slice(0, 10)} (이체 그룹 ${t.transferPairId.slice(-6)})`,
        kind: 'transfer_pair_missing',
        refId: t.id,
        repair: { type: 'unpair_transfer', txId: t.id },
      });
    }
  }

  // 4) Sign vs category kind alignment.
  for (const t of txs) {
    if (t.transferPairId) continue; // transfers carry signs intentionally
    const c = CATEGORIES[t.cat];
    if (!c) continue;
    const isIncomeCat = c.kind === 'income';
    if (isIncomeCat && t.amount < 0) {
      issues.push({
        id: `sign-${t.id}`,
        severity: 'warning',
        title: '수입 카테고리에 음수 금액',
        detail: `${t.merchant} · ${t.date.slice(0, 10)} · ${c.name}`,
        kind: 'category_sign_mismatch',
        refId: t.id,
      });
    } else if (!isIncomeCat && t.amount > 0) {
      issues.push({
        id: `sign-${t.id}`,
        severity: 'warning',
        title: '지출 카테고리에 양수 금액',
        detail: `${t.merchant} · ${t.date.slice(0, 10)} · ${c.name}`,
        kind: 'category_sign_mismatch',
        refId: t.id,
      });
    }
  }

  // 5) Account balance drift — sum of tx for that account ≠ balance.
  // We don't know "initial balance" separately so we compare *direction*: if
  // the cumulative tx delta would push balance the wrong way by more than a
  // tolerance, surface it. Tolerance 100원 to absorb rounding.
  const txDeltaByAcc = new Map<string, number>();
  for (const t of txs) {
    txDeltaByAcc.set(t.acc, (txDeltaByAcc.get(t.acc) ?? 0) + t.amount);
  }
  for (const a of accounts) {
    const delta = txDeltaByAcc.get(a.id) ?? 0;
    // We don't know what the user's seed balance was, so we only flag when
    // there's a >5,000,000원 mismatch between recorded balance and tx delta —
    // that's loud enough to be a real symptom of a missed correction or wipe.
    const abs = Math.abs(a.balance - delta);
    if (abs > 5_000_000) {
      issues.push({
        id: `bal-${a.id}`,
        severity: 'warning',
        title: '계좌 잔액과 거래 합계 차이',
        detail: `${a.name}: 잔액 ${a.balance.toLocaleString('ko-KR')}원 vs 거래 합계 ${delta.toLocaleString('ko-KR')}원`,
        kind: 'account_balance_drift',
        refId: a.id,
        repair: { type: 'recompute_balance', accId: a.id, computed: delta },
      });
    }
  }

  return {
    issues,
    summary: {
      transactions: txs.length,
      accounts: accounts.length,
      errors: issues.filter((i) => i.severity === 'error').length,
      warnings: issues.filter((i) => i.severity === 'warning').length,
    },
  };
}

/**
 * Apply a single repair. Mutates localStorage directly — caller should reload
 * or re-run the check. Returns true if the issue was acted on.
 */
export function applyRepair(issue: IntegrityIssue): boolean {
  if (!issue.repair) return false;
  const r = issue.repair;
  const txs = readStorageValue<Transaction[]>(KEYS.transactions, []);
  const accounts = readStorageValue<Account[]>(KEYS.accounts, []);

  if (r.type === 'reassign_account') {
    const next = txs.map((t) => (t.id === r.txId ? { ...t, acc: r.toAccId } : t));
    window.localStorage.setItem(KEYS.transactions, JSON.stringify(next));
    return true;
  }
  if (r.type === 'reassign_category') {
    const next = txs.map((t) => (t.id === r.txId ? { ...t, cat: r.toCatId } : t));
    window.localStorage.setItem(KEYS.transactions, JSON.stringify(next));
    return true;
  }
  if (r.type === 'unpair_transfer') {
    const next = txs.map((t) => (t.id === r.txId ? { ...t, transferPairId: undefined } : t));
    window.localStorage.setItem(KEYS.transactions, JSON.stringify(next));
    return true;
  }
  if (r.type === 'recompute_balance') {
    const next = accounts.map((a) => (a.id === r.accId ? { ...a, balance: r.computed } : a));
    window.localStorage.setItem(KEYS.accounts, JSON.stringify(next));
    return true;
  }
  return false;
}
