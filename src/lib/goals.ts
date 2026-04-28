'use client';

import { useEffect, useState } from 'react';
import type { SavingsGoal } from '@/lib/types';

const KEY = 'asset/goals/v1';

function load(): SavingsGoal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as SavingsGoal[];
  } catch {
    // fall through
  }
  return [];
}

function save(list: SavingsGoal[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useGoals() {
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setGoals(load());
    setReady(true);
  }, []);

  const add = (g: SavingsGoal) => {
    setGoals((prev) => {
      const next = [...prev, g];
      save(next);
      return next;
    });
  };

  const update = (id: string, patch: Partial<SavingsGoal>) => {
    setGoals((prev) => {
      const next = prev.map((g) => (g.id === id ? { ...g, ...patch } : g));
      save(next);
      return next;
    });
  };

  const remove = (id: string) => {
    setGoals((prev) => {
      const next = prev.filter((g) => g.id !== id);
      save(next);
      return next;
    });
  };

  return { goals, ready, add, update, remove };
}
