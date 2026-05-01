'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { SEED_ACCOUNTS } from '@/lib/seed';
import { subscribeToKey } from '@/lib/store-factory';
import type { Account, Scope } from '@/lib/types';

const KEY = 'asset/accounts/v2';

function normalize(list: Account[]): Account[] {
  return list.map((a) => (a.scope ? a : { ...a, scope: 'personal' as Scope }));
}

// ─── Module-level singleton ───
// Mirrors the transactions hook (storage.ts). Also reused by integrity.ts
// when transactions adjust account balances; the listener pattern means
// every consumer of useAllAccounts sees the new balance on the next paint
// without having to remount.

let cachedAccounts: Account[] | null = null;
const accListeners = new Set<() => void>();
const EMPTY_ACC: Account[] = [];

function load(): Account[] {
  if (typeof window === 'undefined') return normalize(SEED_ACCOUNTS);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw) as Account[]);
    const legacy = window.localStorage.getItem('asset/accounts/v1');
    if (legacy) {
      const migrated = normalize(JSON.parse(legacy) as Account[]);
      window.localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
  } catch {
    // fall through
  }
  return normalize(SEED_ACCOUNTS);
}

function save(list: Account[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

function getCachedAccounts(): Account[] {
  if (cachedAccounts === null) cachedAccounts = load();
  return cachedAccounts;
}

function commitAccounts(next: Account[]) {
  cachedAccounts = next;
  save(next);
  accListeners.forEach((fn) => fn());
}

/** Internal: integrity.ts mutates account balances directly via localStorage
 *  + writeStorageValue's notify. This refresh hook keeps the singleton in
 *  sync with those out-of-band writes. */
export function refreshAccountsFromStorage() {
  cachedAccounts = load();
  accListeners.forEach((fn) => fn());
}

/**
 * Returns all accounts, regardless of mode.
 */
export function useAllAccounts() {
  const [accounts, setAccounts] = useState<Account[]>(EMPTY_ACC);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setAccounts(getCachedAccounts());
    setReady(true);
    if (typeof window !== 'undefined' && !window.localStorage.getItem(KEY)) {
      save(cachedAccounts!);
    }
    const refresh = () => setAccounts(getCachedAccounts());
    accListeners.add(refresh);
    // integrity.ts mutates account balances via store-factory's writeStorageValue,
    // which bypasses our singleton. Bridge that by also listening to store-factory's
    // notify channel for the same key — refresh from disk and fan out to local listeners.
    const unsubFactory = subscribeToKey(KEY, () => {
      cachedAccounts = load();
      accListeners.forEach((fn) => fn());
    });
    return () => {
      accListeners.delete(refresh);
      unsubFactory();
    };
  }, []);

  const add = (a: Account) => commitAccounts([...getCachedAccounts(), a]);
  const update = (id: string, patch: Partial<Account>) =>
    commitAccounts(
      getCachedAccounts().map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  const remove = (id: string) =>
    commitAccounts(getCachedAccounts().filter((a) => a.id !== id));

  return { accounts, ready, add, update, remove };
}

/**
 * Returns accounts for the current mode only.
 */
export function useAccounts() {
  const all = useAllAccounts();
  const { mode } = useMode();
  const accounts = useMemo(
    () => all.accounts.filter((a) => a.scope === mode),
    [all.accounts, mode],
  );
  return { ...all, accounts, allAccounts: all.accounts };
}
