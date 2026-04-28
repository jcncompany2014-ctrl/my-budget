'use client';

import { useEffect, useState } from 'react';
import type { Budget } from '@/lib/types';

const KEY = 'asset/budgets/v1';

function load(): Record<string, Budget> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Record<string, Budget>;
  } catch {
    // fall through
  }
  return {};
}

function save(data: Record<string, Budget>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(data));
}

export function useBudgets() {
  const [budgets, setBudgets] = useState<Record<string, Budget>>({});
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setBudgets(load());
    setReady(true);
  }, []);

  const set = (catId: string, limit: number) => {
    setBudgets((prev) => {
      const next = { ...prev, [catId]: { limit } };
      save(next);
      return next;
    });
  };

  const remove = (catId: string) => {
    setBudgets((prev) => {
      const next = { ...prev };
      delete next[catId];
      save(next);
      return next;
    });
  };

  return { budgets, ready, set, remove };
}
