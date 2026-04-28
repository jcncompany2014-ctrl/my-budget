'use client';

import { useEffect, useState } from 'react';
import { SEED_ACCOUNTS } from '@/lib/seed';
import type { Account } from '@/lib/types';

const KEY = 'asset/accounts/v1';

function load(): Account[] {
  if (typeof window === 'undefined') return SEED_ACCOUNTS;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Account[];
  } catch {
    // fall through
  }
  return SEED_ACCOUNTS;
}

function save(list: Account[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useAccounts() {
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
