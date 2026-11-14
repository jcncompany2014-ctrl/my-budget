'use client';

import { ensureAutoCardPayment } from '@/lib/auto-card-payment';
import { ensureAutoLoanPayment } from '@/lib/auto-loan-payment';
import { ensureAutoRecurring } from '@/lib/auto-recurring';
import { applyTxToAccounts, reverseTxFromAccounts } from '@/lib/integrity';
import { KEYS } from '@/lib/storage-keys';
import { createValueStore, readStorageValue, writeStorageValue } from '@/lib/store-factory';
import type { Transaction } from '@/lib/types';

/**
 * Cloud mirror + remote edit queue (Supabase RPC `budget_sync`).
 *
 * The device stays the source of truth. Each tick uploads the keys that
 * changed since the last one and pulls the edits queued for this device —
 * written by Claude from a chat session — applies them through the same
 * storage paths the UI uses, and acknowledges them. Until the device's vault
 * is approved on the server, nothing is uploaded and nothing is served.
 */

const BASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const API_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Uploaded keys. Device preferences and the inbox secret stay on the device. */
const MIRRORED: string[] = [
  KEYS.transactions,
  KEYS.accounts,
  KEYS.budgets,
  KEYS.goals,
  KEYS.recurring,
  KEYS.loans,
  KEYS.creditLines,
  KEYS.vendors,
  KEYS.employees,
  KEYS.locations,
  KEYS.investments,
  KEYS.favorites,
  KEYS.challenges,
  KEYS.customCategories,
  KEYS.yearlyGoals,
  KEYS.events,
  KEYS.profile,
  KEYS.businessProfile,
  KEYS.taxpayerType,
  KEYS.netWorthHistory,
  'asset/category-rules/v1',
];

/** Collections a remote edit may address, by name. */
const LISTS: Record<string, string> = {
  accounts: KEYS.accounts,
  recurring: KEYS.recurring,
  loans: KEYS.loans,
  investments: KEYS.investments,
  goals: KEYS.goals,
  creditLines: KEYS.creditLines,
  favorites: KEYS.favorites,
  vendors: KEYS.vendors,
  employees: KEYS.employees,
  locations: KEYS.locations,
  challenges: KEYS.challenges,
  customCategories: KEYS.customCategories,
};
const VALUES: Record<string, string> = {
  budgets: KEYS.budgets,
  profile: KEYS.profile,
  businessProfile: KEYS.businessProfile,
  yearlyGoals: KEYS.yearlyGoals,
  taxpayerType: KEYS.taxpayerType,
};

export type CloudStatus = {
  status: 'pending' | 'approved';
  /** Short code that identifies this device's vault on the server. */
  code: string;
  at: string;
};
export type CloudLogEntry = { at: string; note: string; result: string };
export type AppliedBatch = { notes: string[]; failed: number; undo: () => void };

type Ack = { id: number; result: string };
type ServerOp = { id: number; op: unknown; note: string };
type ServerReply = { status: 'pending' | 'approved'; code: string; ops?: ServerOp[] };

export const cloudSyncConfigured = () => !!BASE_URL && !!API_KEY;

export const useCloudStatus = createValueStore<CloudStatus | null>(KEYS.syncStatus, null);
export const useCloudLog = createValueStore<CloudLogEntry[]>(KEYS.syncLog, []);
export const useCloudOff = createValueStore<number>(KEYS.syncOff, 0);

export const cloudSyncOff = () =>
  typeof window !== 'undefined' && window.localStorage.getItem(KEYS.syncOff) === '1';

export function setCloudSyncOff(off: boolean) {
  // Through the store so the settings page re-renders.
  writeStorageValue(KEYS.syncOff, off ? 1 : 0);
  if (!off) void syncCloud();
}

function deviceKey(): string {
  const saved = window.localStorage.getItem(KEYS.syncKey);
  if (saved) return saved;
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const key = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  window.localStorage.setItem(KEYS.syncKey, key);
  return key;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const device = /iPhone/.test(ua)
    ? 'iPhone'
    : /iPad/.test(ua)
      ? 'iPad'
      : /Android/.test(ua)
        ? 'Android'
        : /Windows/.test(ua)
          ? 'Windows'
          : /Mac/.test(ua)
            ? 'Mac'
            : 'device';
  const standalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return `${device} · ${standalone ? 'home-screen app' : 'browser'} · ${window.location.host}`;
}

/** FNV-1a — cheap change detection for a raw localStorage string. */
function fingerprint(raw: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${raw.length}:${h >>> 0}`;
}

function changedState(): { state: Record<string, unknown>; marks: Record<string, string> } {
  const pushed = readStorageValue<Record<string, string>>(KEYS.syncPushed, {});
  const state: Record<string, unknown> = {};
  const marks: Record<string, string> = {};
  for (const key of MIRRORED) {
    const raw = window.localStorage.getItem(key);
    if (raw === null) continue;
    const mark = fingerprint(raw);
    if (pushed[key] === mark) continue;
    try {
      state[key] = JSON.parse(raw);
      marks[key] = mark;
    } catch {
      // not JSON — nothing the mirror can hold
    }
  }
  return { state, marks };
}

async function call(
  state: Record<string, unknown>,
  acks: Ack[],
  keepalive: boolean,
): Promise<ServerReply | null> {
  try {
    const res = await fetch(`${BASE_URL}/rest/v1/rpc/budget_sync`, {
      method: 'POST',
      headers: {
        apikey: API_KEY as string,
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_key: deviceKey(),
        p_label: deviceLabel(),
        p_state: state,
        p_acks: acks,
      }),
      // keepalive bodies are capped at 64KB; the caller only sets it for small ones.
      keepalive,
    });
    if (!res.ok) return null;
    return (await res.json()) as ServerReply;
  } catch {
    return null;
  }
}

/** One round trip: upload what changed, send pending acks, return the server's reply. */
async function exchange(approved: boolean, keepalive = false): Promise<ServerReply | null> {
  const { state, marks } = approved ? changedState() : { state: {}, marks: {} };
  const acks = readStorageValue<Ack[]>(KEYS.syncAcks, []);
  const small = JSON.stringify(state).length < 60_000;
  const reply = await call(state, acks, keepalive && small);
  if (!reply) return null;
  if (reply.status === 'approved') {
    if (Object.keys(marks).length > 0) {
      const pushed = readStorageValue<Record<string, string>>(KEYS.syncPushed, {});
      window.localStorage.setItem(KEYS.syncPushed, JSON.stringify({ ...pushed, ...marks }));
    }
    if (acks.length > 0) {
      // Keep any ack recorded while the request was in flight.
      const sent = new Set(acks.map((a) => a.id));
      const rest = readStorageValue<Ack[]>(KEYS.syncAcks, []).filter((a) => !sent.has(a.id));
      window.localStorage.setItem(KEYS.syncAcks, JSON.stringify(rest));
    }
  }
  const status: CloudStatus = {
    status: reply.status,
    code: reply.code,
    at: new Date().toISOString(),
  };
  writeStorageValue(KEYS.syncStatus, status);
  return reply;
}

let inFlight: Promise<AppliedBatch | null> | null = null;

/**
 * Sync with the cloud. Resolves to the batch of remote edits it applied, if any.
 * Single-flight; a no-op when not configured or switched off.
 */
export function syncCloud(opts: { keepalive?: boolean } = {}): Promise<AppliedBatch | null> {
  if (typeof window === 'undefined' || !cloudSyncConfigured() || cloudSyncOff()) {
    return Promise.resolve(null);
  }
  // Vercel's deploy screenshot bots run the app too; they would each register a vault.
  if (navigator.webdriver || /HeadlessChrome/.test(navigator.userAgent)) {
    return Promise.resolve(null);
  }
  if (inFlight) return inFlight;
  inFlight = run(opts.keepalive ?? false).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function run(keepalive: boolean): Promise<AppliedBatch | null> {
  const before = readStorageValue<CloudStatus | null>(KEYS.syncStatus, null);
  let reply = await exchange(before?.status === 'approved', keepalive);
  if (!reply || reply.status !== 'approved') return null;
  if (before?.status !== 'approved') {
    // Just approved: this reply came from an empty upload, so send the full mirror now.
    reply = await exchange(true);
    if (!reply || reply.status !== 'approved') return null;
  }

  // An op whose ack is still queued was applied already — never apply it twice.
  const acked = new Set(readStorageValue<Ack[]>(KEYS.syncAcks, []).map((a) => a.id));
  const ops = (reply.ops ?? []).filter((o) => !acked.has(o.id));
  if (ops.length === 0) return null;

  const snapshot = MIRRORED.map((key) => [key, window.localStorage.getItem(key)] as const);
  const log: CloudLogEntry[] = [];
  for (const o of ops) {
    const result = applyRemoteOp(o.op);
    // Persist the ack before the next op so a crash can't replay this one.
    const acks = readStorageValue<Ack[]>(KEYS.syncAcks, []);
    window.localStorage.setItem(KEYS.syncAcks, JSON.stringify([...acks, { id: o.id, result }]));
    log.push({ at: new Date().toISOString(), note: o.note || '수정', result });
  }
  // An edit may add an item that is already due (e.g. today's loan payment).
  ensureAutoRecurring();
  ensureAutoLoanPayment();
  ensureAutoCardPayment();
  writeStorageValue(
    KEYS.syncLog,
    [...log.reverse(), ...readStorageValue<CloudLogEntry[]>(KEYS.syncLog, [])].slice(0, 30),
  );

  // Confirm + upload the result right away so the chat side sees it.
  await exchange(true);

  return {
    notes: log.filter((l) => l.result === 'ok').map((l) => l.note),
    failed: log.filter((l) => l.result !== 'ok').length,
    undo: () => {
      for (const [key, raw] of snapshot) {
        if (raw === null) continue;
        try {
          writeStorageValue(key, JSON.parse(raw));
        } catch {
          // was not JSON before either
        }
      }
      void syncCloud();
    },
  };
}

/* ─── Remote edits ───────────────────────────────────────────────────── */

type Item = { id: string } & Record<string, unknown>;

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const isItem = (v: unknown): v is Item => isObject(v) && typeof v.id === 'string' && v.id !== '';
const isIds = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((x) => typeof x === 'string');
const isTx = (v: unknown): v is Transaction =>
  isItem(v) &&
  typeof v.date === 'string' &&
  typeof v.amount === 'number' &&
  Number.isFinite(v.amount) &&
  typeof v.acc === 'string' &&
  typeof v.cat === 'string' &&
  typeof v.merchant === 'string';

/**
 * Apply one remote edit. Returns 'ok' or 'error: …' — never throws, so one bad
 * edit can't block the queue behind it.
 *
 *   { type: 'upsert', key, items: [{ id, … }] }      insert or replace by id
 *   { type: 'patch',  key, id, patch: { … } }        merge fields into one item
 *   { type: 'remove', key, ids: [...] }
 *   { type: 'set',    key, value }                   replace a whole collection / value
 *   { type: 'tx.add',    items: [Transaction], keepBalances? }  moves account balances unless keepBalances
 *   { type: 'tx.patch',  id, patch }                 re-applies balances if amount/acc change
 *   { type: 'tx.remove', ids, keepBalances? }        reverses balances unless keepBalances
 *
 * `key` is a collection name (accounts, loans, recurring, investments, goals, …)
 * or, for `set`, also budgets / profile / businessProfile / yearlyGoals / taxpayerType.
 */
export function applyRemoteOp(op: unknown): string {
  try {
    if (!isObject(op) || typeof op.type !== 'string') return 'error: not an op';

    if (op.type === 'tx.add') {
      if (!Array.isArray(op.items) || !op.items.every(isTx)) return 'error: bad transactions';
      const cur = readStorageValue<Transaction[]>(KEYS.transactions, []);
      const have = new Set(cur.map((t) => t.id));
      const fresh = (op.items as Transaction[]).filter((t) => !have.has(t.id));
      if (op.keepBalances !== true) fresh.forEach(applyTxToAccounts);
      writeStorageValue(KEYS.transactions, [...fresh, ...cur]);
      return 'ok';
    }
    if (op.type === 'tx.remove') {
      if (!isIds(op.ids)) return 'error: bad ids';
      const ids = new Set(op.ids);
      const cur = readStorageValue<Transaction[]>(KEYS.transactions, []);
      if (op.keepBalances !== true) cur.filter((t) => ids.has(t.id)).forEach(reverseTxFromAccounts);
      writeStorageValue(
        KEYS.transactions,
        cur.filter((t) => !ids.has(t.id)),
      );
      return 'ok';
    }
    if (op.type === 'tx.patch') {
      if (typeof op.id !== 'string' || !isObject(op.patch)) return 'error: bad patch';
      const cur = readStorageValue<Transaction[]>(KEYS.transactions, []);
      const old = cur.find((t) => t.id === op.id);
      if (!old) return `error: no transaction ${op.id}`;
      const next = { ...old, ...op.patch, id: old.id } as Transaction;
      if (!isTx(next)) return 'error: bad patch';
      if (next.amount !== old.amount || next.acc !== old.acc) {
        reverseTxFromAccounts(old);
        applyTxToAccounts(next);
      }
      writeStorageValue(
        KEYS.transactions,
        cur.map((t) => (t.id === old.id ? next : t)),
      );
      return 'ok';
    }

    if (typeof op.key !== 'string') return 'error: no key';
    if (op.type === 'set') {
      const storageKey = LISTS[op.key] ?? VALUES[op.key];
      if (!storageKey) return `error: unknown key ${op.key}`;
      if (LISTS[op.key] && !(Array.isArray(op.value) && op.value.every(isItem))) {
        return 'error: bad list';
      }
      if (op.value === undefined || op.value === null) return 'error: no value';
      writeStorageValue(storageKey, op.value);
      return 'ok';
    }

    const storageKey = LISTS[op.key];
    if (!storageKey) return `error: unknown key ${op.key}`;
    const list = readStorageValue<Item[]>(storageKey, []);
    if (op.type === 'upsert') {
      if (!Array.isArray(op.items) || !op.items.every(isItem)) return 'error: bad items';
      const incoming = new Map((op.items as Item[]).map((i) => [i.id, i]));
      const next = list.map((i) => incoming.get(i.id) ?? i);
      const known = new Set(list.map((i) => i.id));
      for (const i of incoming.values()) if (!known.has(i.id)) next.push(i);
      writeStorageValue(storageKey, next);
      return 'ok';
    }
    if (op.type === 'patch') {
      if (typeof op.id !== 'string' || !isObject(op.patch)) return 'error: bad patch';
      if (!list.some((i) => i.id === op.id)) return `error: no ${op.key} item ${op.id}`;
      const patch = op.patch;
      writeStorageValue(
        storageKey,
        list.map((i) => (i.id === op.id ? { ...i, ...patch, id: i.id } : i)),
      );
      return 'ok';
    }
    if (op.type === 'remove') {
      if (!isIds(op.ids)) return 'error: bad ids';
      const ids = new Set(op.ids);
      writeStorageValue(
        storageKey,
        list.filter((i) => !ids.has(i.id)),
      );
      return 'ok';
    }
    return `error: unknown op ${op.type}`;
  } catch (e) {
    return `error: ${e instanceof Error ? e.message : 'failed'}`;
  }
}
