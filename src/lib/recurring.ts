'use client';

import { useMemo } from 'react';
import { useMode } from '@/components/ModeProvider';
import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { RecurringItem, Scope } from '@/lib/types';

export const useAllRecurring = createListStore<RecurringItem>(KEYS.recurring, [], {
  validate: (data) =>
    Array.isArray(data)
      ? (data as RecurringItem[]).map((r) => (r.scope ? r : { ...r, scope: 'personal' as Scope }))
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

/**
 * Days until the next occurrence that has not been posted yet. On the day
 * itself, once the generator has posted it (`postedThrough` is today), the
 * next one is a month away — it must not show as "오늘" or be counted again.
 */
export function daysUntilNext(dayOfMonth: number, postedThrough?: string, today = new Date()) {
  const d = daysUntilDay(dayOfMonth, today);
  if (d !== 0 || !postedThrough) return d;
  const posted = new Date(postedThrough);
  const sameDay =
    posted.getFullYear() === today.getFullYear() &&
    posted.getMonth() === today.getMonth() &&
    posted.getDate() === today.getDate();
  if (!sameDay) return 0;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const nextLast = new Date(today.getFullYear(), today.getMonth() + 2, 0).getDate();
  return lastDay - today.getDate() + Math.min(dayOfMonth, nextLast);
}
