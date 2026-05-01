'use client';

import { useMemo } from 'react';
import { useMode } from '@/components/ModeProvider';
import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { SavingsGoal, Scope } from '@/lib/types';

const useGoalsList = createListStore<SavingsGoal>(KEYS.goals, [], {
  validate: (data) =>
    Array.isArray(data)
      ? (data as SavingsGoal[]).map((g) =>
          g.scope ? g : { ...g, scope: 'personal' as Scope },
        )
      : null,
});

export function useAllGoals() {
  const { items, ...rest } = useGoalsList();
  return { goals: items, ...rest };
}

export function useGoals() {
  const all = useAllGoals();
  const { mode } = useMode();
  const goals = useMemo(() => all.goals.filter((g) => g.scope === mode), [all.goals, mode]);
  return { ...all, goals };
}
