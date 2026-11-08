'use client';

import { type ParseResult, parseCardNotification } from '@/lib/card-notification';
import { CATEGORY_RULES_KEY, type CategoryRule } from '@/lib/category-rules';
import {
  currenciesNeeded,
  type ImportContext,
  type ImportPlan,
  type InboxItem,
  type InboxLogEntry,
  planImport,
  resolveAccount,
  resolveCategory,
} from '@/lib/inbox-import';
import { fxRateToKRW } from '@/lib/quotes';
import { addTransactions, allTransactions, removeTransaction } from '@/lib/storage';
import { KEYS } from '@/lib/storage-keys';
import {
  createListStore,
  createValueStore,
  readStorageValue,
  writeStorageValue,
} from '@/lib/store-factory';
import type { Account, CustomCategory } from '@/lib/types';

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

function buildContext(): ImportContext {
  return {
    accounts: readStorageValue<Account[]>(KEYS.accounts, []).map((a) =>
      a.scope ? a : { ...a, scope: 'personal' as const },
    ),
    history: allTransactions(),
    rules: readStorageValue<CategoryRule[]>(CATEGORY_RULES_KEY, []),
    customCategories: readStorageValue<CustomCategory[]>(KEYS.customCategories, []),
    fxRate: (c) => fxRateToKRW(c) ?? fetchedFx[c] ?? null,
  };
}

function prependLog(entries: InboxLogEntry[]) {
  if (entries.length === 0) return;
  const log = readStorageValue<InboxLogEntry[]>(KEYS.inboxLog, []);
  const fresh = new Set(entries.map((e) => e.id));
  writeStorageValue(
    KEYS.inboxLog,
    [...entries, ...log.filter((e) => !fresh.has(e.id))].slice(0, LOG_MAX),
  );
}

function applyPlan(plan: ImportPlan) {
  for (const id of plan.remove) removeTransaction(id);
  addTransactions(plan.add);
  prependLog([...plan.log].reverse()); // newest first
}

function summarize(plan: ImportPlan): SyncSummary {
  const count = (s: InboxLogEntry['status']) => plan.log.filter((l) => l.status === s).length;
  const kept = new Set(plan.add.map((t) => t.id));
  return {
    // A charge cancelled within the same batch never reached the ledger.
    added: plan.log.filter((l) => l.status === 'added' && l.txId && kept.has(l.txId)).length,
    cancelled: count('cancelled'),
    refunds: count('refund'),
    duplicates: count('duplicate'),
    unparsed: count('unparsed'),
  };
}

export function describeSync(s: SyncSummary): string | null {
  const parts: string[] = [];
  if (s.added) parts.push(`${s.added}건 기록`);
  if (s.cancelled) parts.push(`${s.cancelled}건 취소 반영`);
  if (s.refunds) parts.push(`${s.refunds}건 환불`);
  if (s.unparsed) parts.push(`${s.unparsed}건 확인 필요`);
  if (parts.length === 0 && s.duplicates) parts.push(`중복 ${s.duplicates}건 건너뜀`);
  return parts.length > 0 ? `카드 알림 ${parts.join(' · ')}` : null;
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
    const r = await fetch(`/api/inbox?k=${encodeURIComponent(key)}${deep ? '&deep=1' : ''}`, {
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
  let summary: SyncSummary = { added: 0, cancelled: 0, refunds: 0, duplicates: 0, unparsed: 0 };
  if (fresh.length > 0) {
    await prefetchFx(currenciesNeeded(fresh));
    const plan = planImport(fresh, buildContext());
    applyPlan(plan);
    summary = summarize(plan);
    writeStorageValue(KEYS.inboxSeen, [...fresh.map((i) => i.id), ...seen].slice(0, SEEN_MAX));
  }
  if (items.length > 0) {
    // Ack re-deliveries too, so the queue always drains.
    fetch(`/api/inbox?k=${encodeURIComponent(key)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: items.map((i) => i.id) }),
      keepalive: true,
    }).catch(() => {});
  }
  const now = new Date().toISOString();
  writeStorageValue<InboxStatus>(KEYS.inboxStatus, {
    lastSyncAt: now,
    lastDeepAt: deep ? now : status.lastDeepAt,
  });
  return summary;
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
  addTransactions(entry.removed.filter((t) => !existing.has(t.id)));
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
