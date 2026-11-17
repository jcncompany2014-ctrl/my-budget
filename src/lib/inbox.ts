'use client';

import { issuerKind, type ParseResult, parseCardNotification } from '@/lib/card-notification';
import { CATEGORY_RULES_KEY, type CategoryRule } from '@/lib/category-rules';
import {
  cardLabel,
  cardPatch,
  currenciesNeeded,
  type ImportContext,
  type ImportPlan,
  type InboxItem,
  type InboxLogEntry,
  planImport,
  resolveAccount,
  resolveCategory,
  sameCard,
} from '@/lib/inbox-import';
import { colorFor } from '@/lib/institutions';
import { adjustAccountBalance, isHistoryOnly } from '@/lib/integrity';
import { fxRateToKRW } from '@/lib/quotes';
import { syncServerBackup } from '@/lib/server-backup';
import {
  addTransactions,
  allTransactions,
  removeTransaction,
  updateTransactions,
} from '@/lib/storage';
import { KEYS } from '@/lib/storage-keys';
import {
  createListStore,
  createValueStore,
  readStorageValue,
  writeStorageValue,
} from '@/lib/store-factory';
import type { Account, CardRef, CustomCategory, Transaction } from '@/lib/types';

/**
 * Client half of card-notification auto-record: owns the secret inbox key,
 * drains /api/inbox, and applies the import plan to the ledger.
 */

export type InboxStatus = {
  lastSyncAt?: string;
  lastDeepAt?: string;
  /** 'not-configured' | 'network' | 'http-<code>' from the last attempt. */
  lastError?: string;
};

export type SyncSummary = {
  added: number;
  cancelled: number;
  refunds: number;
  duplicates: number;
  unparsed: number;
  /** Texts that were not payments (bill notices, transfers). */
  skipped: number;
  /** Cards an account took as its own in this batch, e.g. "신용카드 ← 현대카드 5678". */
  linked: string[];
  /** Cards still waiting to be told which account they are. */
  asks: number;
};

const NOTHING: SyncSummary = {
  added: 0,
  cancelled: 0,
  refunds: 0,
  duplicates: 0,
  unparsed: 0,
  skipped: 0,
  linked: [],
  asks: 0,
};

export const useInboxKey = createValueStore<string | null>(KEYS.inboxKey, null);
export const useInboxLog = createListStore<InboxLogEntry>(KEYS.inboxLog, []);
export const useInboxStatus = createValueStore<InboxStatus>(KEYS.inboxStatus, {});

const MIN_GAP_MS = 15_000;
/** The cheap flag check can miss items if an earlier sync died mid-way; list fully once a day. */
const DEEP_EVERY_MS = 24 * 3_600_000;
const SEEN_MAX = 300;
const LOG_MAX = 100;

export function getInboxKey(): string | null {
  return readStorageValue<string | null>(KEYS.inboxKey, null);
}

export function generateInboxKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export function inboxUrl(key: string): string {
  return `${window.location.origin}/api/inbox?k=${key}`;
}

/** Ask the server whether a store is connected (null = couldn't reach it). */
export async function fetchInboxBackend(): Promise<{ configured: boolean } | null> {
  try {
    const r = await fetch('/api/inbox?status=1', { cache: 'no-store' });
    if (!r.ok) return null;
    return (await r.json()) as { configured: boolean };
  } catch {
    return null;
  }
}

// Rates fetched on demand for foreign charges when the quote cache has none.
const fetchedFx: Record<string, number> = {};

async function prefetchFx(currencies: string[]) {
  const need = currencies.filter((c) => fxRateToKRW(c) === null && !fetchedFx[c]);
  if (need.length === 0) return;
  try {
    const ids = need.map((c) => `yahoo:${c}KRW=X`).join(',');
    const r = await fetch(`/api/quotes?ids=${encodeURIComponent(ids)}`, { cache: 'no-store' });
    if (!r.ok) return;
    const j = (await r.json()) as { quotes: Record<string, { price?: number }> };
    for (const c of need) {
      const price = j.quotes[`yahoo:${c}KRW=X`]?.price;
      if (price) fetchedFx[c] = price;
    }
  } catch {
    /* falls back to the estimate table */
  }
}

function readAccounts(): Account[] {
  // An account written by a remote edit can lack fields the app itself always sets.
  return readStorageValue<Account[]>(KEYS.accounts, []).map((a) =>
    a.scope && typeof a.bank === 'string' && typeof a.name === 'string'
      ? a
      : { ...a, scope: a.scope ?? ('personal' as const), bank: a.bank ?? '', name: a.name ?? '' },
  );
}

function buildContext(): ImportContext {
  const log = readStorageValue<InboxLogEntry[]>(KEYS.inboxLog, []);
  return {
    accounts: readAccounts(),
    history: allTransactions(),
    rules: readStorageValue<CategoryRule[]>(CATEGORY_RULES_KEY, []),
    customCategories: readStorageValue<CustomCategory[]>(KEYS.customCategories, []),
    fxRate: (c) => fxRateToKRW(c) ?? fetchedFx[c] ?? null,
    // Recent entries only: a repeat cancellation notice arrives within minutes.
    log: log.slice(0, 30),
    claimed: log.flatMap((e) => (e.status === 'duplicate' && e.txId ? [e.txId] : [])),
  };
}

function prependLog(entries: InboxLogEntry[]) {
  if (entries.length === 0) return;
  const log = readStorageValue<InboxLogEntry[]>(KEYS.inboxLog, []);
  const fresh = new Set(entries.map((e) => e.id));
  writeStorageValue(
    KEYS.inboxLog,
    // A card still waiting for its answer keeps its entries however old: they
    // are the only record of which rows move once it is answered.
    [...entries, ...log.filter((e) => !fresh.has(e.id))].filter((e, i) => i < LOG_MAX || e.card),
  );
}

/** Save what the notices taught before their rows move any balance. */
function applyLearned(learn: ImportPlan['learn']): string[] {
  if (learn.length === 0) return [];
  const linked: string[] = [];
  let accounts = readStorageValue<Account[]>(KEYS.accounts, []);
  for (const { id, patch } of learn) {
    const before = accounts.find((a) => a.id === id);
    if (!before) continue;
    accounts = accounts.map((a) => (a.id === id ? { ...a, ...patch } : a));
    const card: CardRef = {
      issuer: patch.cards?.at(-1)?.issuer ?? patch.bank,
      last4: patch.last4 ?? patch.cards?.at(-1)?.last4,
    };
    linked.push(`${before.name} ← ${cardLabel(card)}`);
  }
  writeStorageValue(KEYS.accounts, accounts);
  return linked;
}

function applyPlan(plan: ImportPlan): string[] {
  const linked = applyLearned(plan.learn);
  for (const id of plan.remove) {
    for (const t of removeTransaction(id)) {
      // A row from a statement import never moved the balance (the balance
      // typed in already included it), so deleting it does not either — but
      // when it goes because the charge was cancelled, the refund is real.
      if (isHistoryOnly(t)) adjustAccountBalance(t.acc, -t.amount);
    }
  }
  addTransactions(plan.add);
  prependLog([...plan.log].reverse()); // newest first
  return linked;
}

function summarize(plan: ImportPlan, linked: string[]): SyncSummary {
  const count = (s: InboxLogEntry['status']) => plan.log.filter((l) => l.status === s).length;
  const kept = new Set(plan.add.map((t) => t.id));
  return {
    // A charge cancelled within the same batch never reached the ledger.
    added: plan.log.filter((l) => l.status === 'added' && l.txId && kept.has(l.txId)).length,
    cancelled: count('cancelled'),
    refunds: count('refund'),
    duplicates: count('duplicate'),
    unparsed: count('unparsed'),
    skipped: count('skipped'),
    linked,
    asks: pendingCards(plan.log).length,
  };
}

export function describeSync(s: SyncSummary): string | null {
  const parts: string[] = [];
  if (s.added) parts.push(`${s.added}건 기록`);
  if (s.cancelled) parts.push(`${s.cancelled}건 취소 반영`);
  if (s.refunds) parts.push(`${s.refunds}건 환불`);
  if (s.unparsed) parts.push(`${s.unparsed}건 확인 필요`);
  if (s.asks) parts.push(`새 카드 ${s.asks}장`);
  if (parts.length === 0 && s.skipped) parts.push(`${s.skipped}건 기록 안 함`);
  if (parts.length === 0 && s.duplicates) parts.push(`중복 ${s.duplicates}건 건너뜀`);
  if (parts.length === 0) return s.linked.length > 0 ? `${s.linked[0]} 연결` : null;
  return `카드 알림 ${parts.join(' · ')}${s.linked.length > 0 ? ` · ${s.linked[0]} 연결` : ''}`;
}

// ── Cards no account is known to own ─────────────────────────────

export type PendingCard = {
  card: CardRef;
  /** Log entries (newest first) whose rows wait on the answer. */
  entries: InboxLogEntry[];
};

/** Cards the notices named that still need to be told which account they are. */
export function pendingCards(log: InboxLogEntry[]): PendingCard[] {
  const out: PendingCard[] = [];
  for (const e of log) {
    if (!e.card) continue;
    const hit = out.find((p) => sameCard(p.card, e.card as CardRef));
    if (hit) hit.entries.push(e);
    else out.push({ card: e.card, entries: [e] });
  }
  return out;
}

/** Where a pending card's rows sit for now. */
export function pendingAccountId(p: PendingCard): string | undefined {
  const byId = new Map(allTransactions().map((t) => [t.id, t]));
  for (const e of p.entries) {
    const t = e.txId ? byId.get(e.txId) : undefined;
    if (t) return t.acc;
  }
  return undefined;
}

/**
 * Settle which account a card is: the account remembers the card, and the rows
 * recorded while it was unknown move there. `'new'` adds the card as an account.
 */
export function linkCard(
  card: CardRef,
  target: string | 'new',
): { id: string; name: string; moved: number; created: boolean } {
  let accounts = readAccounts();
  let account = target === 'new' ? undefined : accounts.find((a) => a.id === target);
  const created = !account;
  if (!account) {
    const bank = !!card.issuer && issuerKind(card.issuer) === 'bank';
    account = {
      id: `acc-${Date.now().toString(36)}`,
      name: cardLabel(card),
      bank: card.issuer ?? '',
      type: bank ? 'bank' : 'card',
      balance: 0,
      color: colorFor(card.issuer ?? ''),
      scope: 'personal',
      last4: card.last4,
      cards: [card],
    };
    accounts = [...accounts, account];
  } else {
    const patched = { ...account, ...cardPatch(account, card) };
    accounts = accounts.map((a) => (a.id === patched.id ? patched : a));
    account = patched;
  }
  writeStorageValue(KEYS.accounts, accounts);

  const ctx = buildContext();
  const byId = new Map(ctx.history.map((t) => [t.id, t]));
  const log = readStorageValue<InboxLogEntry[]>(KEYS.inboxLog, []);
  const moves: Array<[string, Partial<Transaction>]> = [];
  for (const e of log) {
    if (!e.card || !sameCard(e.card, card)) continue;
    const t = e.txId ? byId.get(e.txId) : undefined;
    if (!t || t.acc === account.id) continue;
    // A row filed as 사업 대납 stays a business cost when it moves between my own cards.
    const paidByMe = t.reimburse !== undefined && account.scope === 'personal';
    const sameLedger = (t.scope ?? 'personal') === account.scope;
    const patch: Partial<Transaction> = {
      acc: account.id,
      scope: paidByMe ? t.scope : account.scope,
      cat:
        paidByMe || sameLedger || t.amount > 0
          ? t.cat
          : resolveCategory(t.merchant, account.scope, ctx),
      reimburse: paidByMe ? t.reimburse : undefined,
    };
    moves.push([t.id, patch]);
  }
  updateTransactions(moves);
  const moved = moves.length;
  writeStorageValue(
    KEYS.inboxLog,
    log.map((e) => (e.card && sameCard(e.card, card) ? { ...e, card: undefined } : e)),
  );
  return { id: account.id, name: account.name, moved, created };
}

let inFlight: Promise<SyncSummary | null> | null = null;
let lastAttempt = 0;

/**
 * Drain the server queue into the ledger. Throttled and single-flight, so
 * callers (app open, tab focus, a 1-minute tick) can fire it freely.
 */
export function syncInbox(opts: { force?: boolean } = {}): Promise<SyncSummary | null> {
  if (typeof window === 'undefined') return Promise.resolve(null);
  const key = getInboxKey();
  if (!key) return Promise.resolve(null);
  if (inFlight) return inFlight;
  if (!opts.force && Date.now() - lastAttempt < MIN_GAP_MS) return Promise.resolve(null);
  if (navigator.onLine === false) return Promise.resolve(null);
  lastAttempt = Date.now();
  inFlight = runSync(key, !!opts.force).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function runSync(key: string, force: boolean): Promise<SyncSummary | null> {
  const status = readStorageValue<InboxStatus>(KEYS.inboxStatus, {});
  const deep =
    force || !status.lastDeepAt || Date.now() - Date.parse(status.lastDeepAt) > DEEP_EVERY_MS;
  let items: InboxItem[];
  try {
    // The address goes in a header: it also names the ledger's backup, and URLs end up in request logs.
    const r = await fetch(`/api/inbox${deep ? '?deep=1' : ''}`, {
      headers: { 'x-inbox-key': key },
      cache: 'no-store',
    });
    if (!r.ok) {
      writeStorageValue<InboxStatus>(KEYS.inboxStatus, {
        ...status,
        lastError: r.status === 503 ? 'not-configured' : `http-${r.status}`,
      });
      return null;
    }
    items = ((await r.json()) as { items?: InboxItem[] }).items ?? [];
  } catch {
    writeStorageValue<InboxStatus>(KEYS.inboxStatus, { ...status, lastError: 'network' });
    return null;
  }

  const seen = readStorageValue<string[]>(KEYS.inboxSeen, []);
  const seenSet = new Set(seen);
  const fresh = items.filter((i) => !seenSet.has(i.id));
  let summary: SyncSummary = NOTHING;
  if (fresh.length > 0) {
    await prefetchFx(currenciesNeeded(fresh));
    let plan: ImportPlan;
    try {
      plan = planImport(fresh, buildContext());
    } catch {
      // Nothing was written: the notices stay queued and are tried again.
      writeStorageValue<InboxStatus>(KEYS.inboxStatus, { ...status, lastError: 'import-failed' });
      return null;
    }
    summary = summarize(plan, applyPlan(plan));
    writeStorageValue(KEYS.inboxSeen, [...fresh.map((i) => i.id), ...seen].slice(0, SEEN_MAX));
  }
  if (items.length > 0) void settle(key, items);
  const now = new Date().toISOString();
  writeStorageValue<InboxStatus>(KEYS.inboxStatus, {
    lastSyncAt: now,
    lastDeepAt: deep ? now : status.lastDeepAt,
  });
  return summary;
}

/**
 * Take imported notices off the server queue — once the server backup holds
 * their rows. Until then they stay queued (this device skips them as seen), so
 * a device restored from an older backup still finds them waiting.
 */
async function settle(key: string, items: InboxItem[]) {
  const backup = await syncServerBackup({ force: true });
  // `failed`: not saved yet — try again next time. `held`: another copy of the
  // app owns the newest backup, and it is the one that should take these.
  if (backup === 'failed' || backup === 'held') return;
  // Re-deliveries are acked too, so the queue always drains.
  fetch('/api/inbox', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'x-inbox-key': key },
    body: JSON.stringify({ ids: items.map((i) => i.id) }),
    keepalive: true,
  }).catch(() => {});
}

/** "그래도 추가" for an entry that was skipped as a duplicate. */
export function forceAddLogEntry(entry: InboxLogEntry): string | null {
  const plan = planImport([{ id: entry.id, text: entry.raw, at: entry.at }], buildContext(), {
    allowDuplicate: true,
  });
  const tx = plan.add[0];
  if (!tx) return null;
  addTransactions([tx]);
  updateLogEntry(entry.id, { status: 'added', txId: tx.id });
  return tx.id;
}

/** Undo a 승인취소 that deleted an earlier row. */
export function restoreCancelled(entry: InboxLogEntry): boolean {
  if (!entry.removed?.length) return false;
  const existing = new Set(allTransactions().map((t) => t.id));
  const back = entry.removed.filter((t) => !existing.has(t.id));
  addTransactions(back);
  // The refund applied for a statement-import row when it was cancelled (see applyPlan).
  for (const t of back) if (isHistoryOnly(t)) adjustAccountBalance(t.acc, t.amount);
  // Stays a cancellation entry (now reversed) — the restored row already has its own entry.
  updateLogEntry(entry.id, { undone: true, removed: undefined });
  return true;
}

function updateLogEntry(id: string, patch: Partial<InboxLogEntry>) {
  const log = readStorageValue<InboxLogEntry[]>(KEYS.inboxLog, []);
  writeStorageValue(
    KEYS.inboxLog,
    log.map((e) => (e.id === id ? { ...e, ...patch } : e)),
  );
}

/** What a pasted notification would become — for the setup page's live preview. */
export function previewNotification(text: string): {
  result: ParseResult;
  account?: Account;
  cat?: string;
} {
  const result = parseCardNotification(text);
  if (!result.ok) return { result };
  const ctx = buildContext();
  const account = resolveAccount(result.notice, ctx.accounts);
  let cat: string | undefined;
  if (result.notice.kind === 'cancel') cat = account?.scope === 'business' ? 'biz_other' : 'refund';
  else if (account) cat = resolveCategory(result.notice.merchant, account.scope, ctx);
  return { result, account, cat };
}

/** Text a Shortcut would send — exercises the full server round-trip from the app. */
export async function sendTestNotification(key: string, text: string): Promise<string> {
  const r = await fetch(`/api/inbox?k=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  return r.text();
}
