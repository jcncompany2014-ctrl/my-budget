'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import type { SavingsGoal, Scope } from '@/lib/types';

const KEY = 'asset/goals/v1';

function normalize(list: SavingsGoal[]): SavingsGoal[] {
  return list.map((g) => (g.scope ? g : { ...g, scope: 'personal' as Scope }));
}

function load(): SavingsGoal[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw) as SavingsGoal[]);
  } catch {
    // fall through
  }
  return [];
}

function save(list: SavingsGoal[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useAllGoals() {
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

export function useGoals() {
  const all = useAllGoals();
  const { mode } = useMode();
  const goals = useMemo(() => all.goals.filter((g) => g.scope === mode), [all.goals, mode]);
  return { ...all, goals };
}
