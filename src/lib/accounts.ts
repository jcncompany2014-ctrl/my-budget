'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { SEED_ACCOUNTS } from '@/lib/seed';
import type { Account, Scope } from '@/lib/types';

const KEY = 'asset/accounts/v2';

function normalize(list: Account[]): Account[] {
  return list.map((a) => (a.scope ? a : { ...a, scope: 'personal' as Scope }));
}

function load(): Account[] {
  if (typeof window === 'undefined') return normalize(SEED_ACCOUNTS);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw) as Account[]);
    // Migrate from v1 if present
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

/**
 * Returns all accounts, regardless of mode.
 */
export function useAllAccounts() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const data = load();
    setAccounts(data);
    setReady(true);
    if (typeof window !== 'undefined' && !window.localStorage.getItem(KEY)) {
      save(data);
    }
  }, []);

  const add = (a: Account) => {
    setAccounts((prev) => {
      const next = [...prev, a];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<Account>) => {
    setAccounts((prev) => {
      const next = prev.map((a) => (a.id === id ? { ...a, ...patch } : a));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setAccounts((prev) => {
      const next = prev.filter((a) => a.id !== id);
      save(next);
      return next;
    });
  };

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
