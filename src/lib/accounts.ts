'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useMode } from '@/components/ModeProvider';
import { setStoredItem } from '@/lib/safe-storage';
import { SEED_ACCOUNTS } from '@/lib/seed';
import { subscribeToKey, useHydrated } from '@/lib/store-factory';
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
  const seed = normalize(SEED_ACCOUNTS);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw) as Account[]);
    const legacy = window.localStorage.getItem('asset/accounts/v1');
    if (legacy) {
      const migrated = normalize(JSON.parse(legacy) as Account[]);
      window.localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
    // First run: persist the seed, because balance updates (integrity.ts) read
    // and rewrite this key directly and would otherwise save an empty list.
    window.localStorage.setItem(KEY, JSON.stringify(seed));
  } catch {
    // Unreadable data is left in place (never overwritten with the seed).
  }
  return seed;
}

function save(list: Account[]) {
  if (typeof window === 'undefined') return;
  setStoredItem(KEY, JSON.stringify(list));
}

function getCachedAccounts(): Account[] {
  if (cachedAccounts === null) cachedAccounts = load();
  return cachedAccounts;
}

function commitAccounts(next: Account[]) {
  save(next);
  cachedAccounts = next;
  accListeners.forEach((fn) => fn());
}

// integrity.ts moves balances through store-factory's writeStorageValue, which
// bypasses this singleton. One module-level bridge keeps the cache honest even
// when no account hook is mounted — a per-hook bridge left it stale on screens
// without one, and the next save wrote the stale balances back.
if (typeof window !== 'undefined') {
  const invalidate = () => {
    cachedAccounts = null;
    accListeners.forEach((fn) => fn());
  };
  subscribeToKey(KEY, invalidate);
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) invalidate();
  });
}

/** Account by id across both ledgers — a plain lookup for list rows, no subscription. */
export function findAccount(id: string): Account | undefined {
  return getCachedAccounts().find((a) => a.id === id);
}

function subscribeAccounts(fn: () => void) {
  accListeners.add(fn);
  return () => {
    accListeners.delete(fn);
  };
}
const serverAccounts = () => EMPTY_ACC;

/**
 * Returns all accounts, regardless of mode.
 */
export function useAllAccounts() {
  const accounts = useSyncExternalStore(subscribeAccounts, getCachedAccounts, serverAccounts);
  const ready = useHydrated();

  const add = (a: Account) => commitAccounts([...getCachedAccounts(), a]);
  const update = (id: string, patch: Partial<Account>) =>
    commitAccounts(getCachedAccounts().map((a) => (a.id === id ? { ...a, ...patch } : a)));
  const remove = (id: string) => commitAccounts(getCachedAccounts().filter((a) => a.id !== id));

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
