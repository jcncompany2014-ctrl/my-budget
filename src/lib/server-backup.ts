'use client';

import { applyBackup, type BackupFile, exportAll, SERVER_BACKUP_KEY } from '@/lib/backup';
import { localDayKey } from '@/lib/dates';
import { KEYS } from '@/lib/storage-keys';
import { createValueStore, readStorageValue, writeStorageValue } from '@/lib/store-factory';

/**
 * Server backup, named by the auto-record address.
 *
 * Everything else about this app lives in the browser, and an iOS Home Screen
 * web app starts empty when it is re-added (or on a new phone). The address the
 * Shortcut posts to is the one thing kept outside it, so while auto-record is
 * on the ledger is also saved under that address — pasting the address back in
 * brings the whole ledger with it.
 *
 * Each copy of the app saves under its own device id. The server refuses a save
 * from a copy that has not seen a newer backup written by another one (an old
 * browser tab that still has the address must not put its stale ledger on top);
 * that copy is then `held` until the user says which ledger to keep.
 */

export type ServerBackupState = {
  off?: boolean;
  /** This copy of the app, as the server knows it. Random; a re-added app is a new one. */
  device?: string;
  /** Which address the fields below are about — a fingerprint, never the address itself. */
  tag?: string;
  /** Last successful upload. */
  lastAt?: string;
  /** Fingerprint of what that upload held. */
  print?: string;
  /** The user chose this copy's ledger over the server's: the next upload goes through regardless. */
  claim?: boolean;
  /** Another copy stored a newer backup; nothing is uploaded until the user picks one. */
  held?: boolean;
  /** 'network' | 'http-<code>' from the last attempt. */
  lastError?: string;
  /** Failed attempts in a row, and when the last one was — retries are spaced out by them. */
  fails?: number;
  lastTryAt?: string;
};

export type ServerBackupMeta = {
  id: string;
  day: string;
  device: string;
  size: number;
  at: string;
};

export const useServerBackup = createValueStore<ServerBackupState>(SERVER_BACKUP_KEY, {});

/** Uploading is whole-file, so changes are batched rather than sent one by one. */
const MIN_GAP_MS = 2 * 60_000;
/** After this many failures in a row the backup is treated as unavailable rather than late. */
const GIVE_UP_AFTER = 5;

/**
 * `saved`: a backup was written. `current`: the server already has this ledger
 * (or it is not time yet). `off`: nothing to back up to or from. `failed`: an
 * upload was due and did not get through — it will be retried. `held`: the
 * server has a newer backup from another copy of the app. `refused`: the server
 * cannot take this backup at all (too large, no store) or keeps failing.
 */
export type BackupResult = 'saved' | 'current' | 'off' | 'failed' | 'held' | 'refused';

/** Keys whose content the backup carries (see `exportAll`). */
const WATCHED: string[] = [
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
  'asset/category-rules/v1',
];

function fnv(h: number, raw: string): number {
  let x = h;
  for (let i = 0; i < raw.length; i++) {
    x ^= raw.charCodeAt(i);
    x = Math.imul(x, 0x01000193);
  }
  return x;
}

/** FNV-1a over the raw stored strings — no parsing, a few ms for a year of rows. */
function fingerprint(): string {
  let h = 0x811c9dc5;
  let len = 0;
  for (const key of WATCHED) {
    const stored = window.localStorage.getItem(key) ?? '';
    // Live quotes rewrite each holding's value all day; that is not a change worth a backup.
    const raw =
      key === KEYS.investments ? stored.replace(/"currentValue":[-\d.eE+]+,?/g, '') : stored;
    len += raw.length;
    h = fnv(h, raw);
  }
  return `${len}:${h >>> 0}`;
}

const tagOf = (key: string) => (fnv(0x811c9dc5, key) >>> 0).toString(36);

/** A ledger nothing has been entered into — never worth replacing a real backup with. */
export function isBlankLedger(b: BackupFile): boolean {
  return (
    b.transactions.length === 0 &&
    b.accounts.every((a) => a.id === 'a-default' || a.id === 'b-default') &&
    (b.loans?.length ?? 0) === 0 &&
    (b.investments?.length ?? 0) === 0 &&
    b.recurring.length === 0
  );
}

function inboxKey(): string | null {
  return readStorageValue<string | null>(KEYS.inboxKey, null);
}

/**
 * The saved state, as far as it is about the address in use now. After the
 * address changes (pasted, re-issued, restored from a file) only the switch
 * and the device id carry over — the rest described another address's backups.
 */
function stateFor(key: string | null): ServerBackupState {
  const st = readStorageValue<ServerBackupState>(SERVER_BACKUP_KEY, {});
  if (!key) return { off: st.off, device: st.device };
  const tag = tagOf(key);
  return st.tag === tag ? st : { off: st.off, device: st.device, tag };
}

function setState(key: string | null, patch: Partial<ServerBackupState>) {
  writeStorageValue<ServerBackupState>(SERVER_BACKUP_KEY, { ...stateFor(key), ...patch });
}

function deviceId(key: string): string {
  const st = stateFor(key);
  if (st.device) return st.device;
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  const device = Array.from(bytes, (b) => (b % 36).toString(36)).join('');
  setState(key, { device });
  return device;
}

/** 30 s, 1 min, 2 min … capped at half an hour. */
const retryGap = (fails: number) => Math.min(30 * 60_000, 30_000 * 2 ** (fails - 1));

let inFlight: Promise<BackupResult> | null = null;

/**
 * Upload the ledger when it changed since the last upload. Single-flight and
 * a no-op without an auto-record address or while switched off.
 *
 * `force` skips the wait between uploads (rows were just imported and the
 * queue is acked on the result). `fresh` also uploads an unchanged ledger and
 * ignores the retry spacing — for when the user asks.
 */
export function syncServerBackup(
  opts: { force?: boolean; fresh?: boolean } = {},
): Promise<BackupResult> {
  if (typeof window === 'undefined') return Promise.resolve('off');
  const key = inboxKey();
  if (!key) return Promise.resolve('off');
  const st = stateFor(key);
  if (st.off) return Promise.resolve('off');
  if (inFlight) {
    // The upload under way was built before this call; a forced call is about
    // rows that may have been added since, so it looks again once that ends.
    return opts.force ? inFlight.then(() => syncServerBackup(opts)) : inFlight;
  }
  if (st.held) return Promise.resolve('held');
  const now = Date.now();
  if (!opts.force && st.lastAt && now - Date.parse(st.lastAt) < MIN_GAP_MS) {
    return Promise.resolve('current');
  }
  const givenUp = (st.fails ?? 0) >= GIVE_UP_AFTER;
  if (
    !opts.fresh &&
    st.fails &&
    st.lastTryAt &&
    now - Date.parse(st.lastTryAt) < retryGap(st.fails)
  ) {
    return Promise.resolve(givenUp ? 'refused' : 'failed');
  }
  const print = fingerprint();
  if (print === st.print && !opts.fresh) return Promise.resolve('current');
  if (navigator.onLine === false) return Promise.resolve(givenUp ? 'refused' : 'failed');
  const data = exportAll();
  if (isBlankLedger(data)) return Promise.resolve('off');
  // The address is what the backup is filed under; it does not go inside it.
  const body = JSON.stringify({ ...data, inboxKey: undefined });
  inFlight = upload(key, body, print, !!st.claim).finally(() => {
    inFlight = null;
  });
  return inFlight;
}

async function upload(
  key: string,
  body: string,
  print: string,
  claim: boolean,
): Promise<BackupResult> {
  const fail = (lastError: string, unusable: boolean): BackupResult => {
    if (inboxKey() !== key) return 'failed';
    const fails = (stateFor(key).fails ?? 0) + 1;
    setState(key, { lastError, fails, lastTryAt: new Date().toISOString() });
    return unusable || fails >= GIVE_UP_AFTER ? 'refused' : 'failed';
  };
  let r: Response;
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-inbox-key': key,
    };
    if (claim) headers['x-backup-force'] = '1';
    r = await fetch(`/api/backup?day=${localDayKey(new Date())}&device=${deviceId(key)}`, {
      method: 'PUT',
      headers,
      body,
    });
  } catch {
    return fail('network', false);
  }
  // The address was changed while this was on its way: its result is about the old one.
  if (inboxKey() !== key) return 'failed';
  if (r.status === 409) {
    setState(key, { held: true, lastError: undefined, fails: undefined, lastTryAt: undefined });
    return 'held';
  }
  if (!r.ok) {
    // Too large, a bad request or no store behind the route: trying again changes nothing.
    return fail(`http-${r.status}`, r.status === 413 || r.status === 400 || r.status === 503);
  }
  setState(key, {
    lastAt: new Date().toISOString(),
    print,
    claim: undefined,
    held: undefined,
    lastError: undefined,
    fails: undefined,
    lastTryAt: undefined,
  });
  return 'saved';
}

export function setServerBackupOff(off: boolean) {
  const key = inboxKey();
  setState(key, { off, lastError: undefined, fails: undefined, lastTryAt: undefined });
  if (!off) void syncServerBackup({ force: true, fresh: true });
}

/**
 * This copy's ledger is the one to keep: its next upload goes through even
 * though the server holds a backup it did not write (the other files stay
 * restorable until newer ones push them out).
 */
export function claimServerBackup(): Promise<BackupResult> {
  const key = inboxKey();
  if (!key) return Promise.resolve('off');
  setState(key, {
    claim: true,
    held: undefined,
    lastError: undefined,
    fails: undefined,
    lastTryAt: undefined,
  });
  return syncServerBackup({ force: true, fresh: true });
}

/** Backups kept under an address, newest first; null when the server could not be asked. */
export async function listServerBackups(key: string): Promise<ServerBackupMeta[] | null> {
  try {
    const r = await fetch('/api/backup?list=1', {
      headers: { 'x-inbox-key': key },
      cache: 'no-store',
    });
    if (!r.ok) return null;
    return ((await r.json()) as { backups?: ServerBackupMeta[] }).backups ?? [];
  } catch {
    return null;
  }
}

/** `data: null` — the server answered and holds no (readable) backup. `ok: false` — it could not be asked. */
export type FetchedBackup = { ok: true; data: BackupFile | null } | { ok: false };

/** Download one backup (the newest when no id is given). */
export async function fetchServerBackup(key: string, id?: string): Promise<FetchedBackup> {
  try {
    const r = await fetch(`/api/backup${id ? `?id=${encodeURIComponent(id)}` : ''}`, {
      headers: { 'x-inbox-key': key },
      cache: 'no-store',
    });
    if (!r.ok) return { ok: false };
    const data = (await r.json()) as BackupFile | null;
    const usable = Array.isArray(data?.transactions) && Array.isArray(data?.accounts);
    return { ok: true, data: usable ? data : null };
  } catch {
    return { ok: false };
  }
}

/**
 * Replace this device's data with a server backup. `key` stays the address in
 * use whatever the backup recorded. The restored ledger is not re-sent as if
 * it had changed, and what this copy saves next builds on that backup — so it
 * goes through even though another copy wrote it.
 */
export function restoreServerBackup(data: BackupFile, key: string) {
  applyBackup(data);
  writeStorageValue(KEYS.inboxKey, key);
  const st = stateFor(key);
  writeStorageValue<ServerBackupState>(SERVER_BACKUP_KEY, {
    off: st.off,
    device: st.device,
    tag: tagOf(key),
    lastAt: new Date().toISOString(),
    print: fingerprint(),
    claim: true,
  });
}

/** Forget the backups kept under an address that is being replaced. */
export function forgetServerBackups(key: string) {
  fetch('/api/backup', {
    method: 'DELETE',
    headers: { 'x-inbox-key': key },
    keepalive: true,
  }).catch(() => {});
}

/** "거래 312건 · 계좌 14개" */
export function describeBackup(b: BackupFile): string {
  const accounts = b.accounts.filter((a) => a.id !== 'a-default' && a.id !== 'b-default').length;
  return `거래 ${b.transactions.length.toLocaleString('ko-KR')}건 · 계좌 ${accounts}개`;
}
