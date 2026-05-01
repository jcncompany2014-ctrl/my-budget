'use client';

import { useMemo } from 'react';
import { useMode } from '@/components/ModeProvider';
import { createListStore } from '@/lib/store-factory';
import { KEYS } from '@/lib/storage-keys';
import type { RecurringItem, Scope } from '@/lib/types';

export const useAllRecurring = createListStore<RecurringItem>(KEYS.recurring, [], {
  validate: (data) =>
    Array.isArray(data)
      ? (data as RecurringItem[]).map((r) =>
          r.scope ? r : { ...r, scope: 'personal' as Scope },
        )
      : null,
});

export function useRecurring() {
  const all = useAllRecurring();
  const { mode } = useMode();
  const items = useMemo(() => all.items.filter((r) => r.scope === mode), [all.items, mode]);
  return { ...all, items };
}

/** Days until the given recurring day-of-month (1..31). */
export function daysUntilDay(dayOfMonth: number, today = new Date()): number {
  const day = today.getDate();
  if (dayOfMonth >= day) return dayOfMonth - day;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return lastDay - day + dayOfMonth;
}
