'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { SEED_TRANSACTIONS } from '@/lib/seed';
import type { Scope, Transaction } from '@/lib/types';

const KEY = 'asset/transactions/v1';

function normalize(list: Transaction[]): Transaction[] {
  return list.map((t) => (t.scope ? t : { ...t, scope: 'personal' }));
}

function loadFromStorage(): Transaction[] {
  if (typeof window === 'undefined') return normalize(SEED_TRANSACTIONS);
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw) as Transaction[]);
  } catch {
    // fall through to seed
  }
  return normalize(SEED_TRANSACTIONS);
}

function saveToStorage(tx: Transaction[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(tx));
}

/**
 * Returns transactions for the current mode (personal or business).
 * Use `useAllTransactions` if you need every transaction regardless of mode.
 */
export function useTransactions() {
  const { mode } = useMode();
  const all = useAllTransactions();
  const tx = useMemo(
    () => all.tx.filter((t) => (t.scope ?? 'personal') === mode),
    [all.tx, mode],
  );
  return { ...all, tx, allTx: all.tx };
}

export function useAllTransactions() {
  const [tx, setTx] = useState<Transaction[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const data = loadFromStorage();
    setTx(data);
    setReady(true);
    if (typeof window !== 'undefined' && !window.localStorage.getItem(KEY)) {
      saveToStorage(data);
    }
  }, []);

  const add = (t: Transaction) => {
    setTx((prev) => {
      const next = [t, ...prev];
      saveToStorage(next);
      return next;
    });
  };

  const remove = (id: string) => {
    setTx((prev) => {
      const next = prev.filter((t) => t.id !== id);
      saveToStorage(next);
      return next;
    });
  };

  const update = (id: string, patch: Partial<Transaction>) => {
    setTx((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, ...patch } : t));
      saveToStorage(next);
      return next;
    });
  };

  return { tx, ready, add, remove, update };
}

export function txCountByScope(tx: Transaction[]): Record<Scope, number> {
  return tx.reduce(
    (acc, t) => {
      const s = t.scope ?? 'personal';
      acc[s] += 1;
      return acc;
    },
    { personal: 0, business: 0 } as Record<Scope, number>,
  );
}
