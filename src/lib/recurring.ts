'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import type { RecurringItem, Scope } from '@/lib/types';

const KEY = 'asset/recurring/v1';

function normalize(list: RecurringItem[]): RecurringItem[] {
  return list.map((r) => (r.scope ? r : { ...r, scope: 'personal' as Scope }));
}

function load(): RecurringItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw) as RecurringItem[]);
  } catch {
    /* */
  }
  return [];
}

function save(list: RecurringItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useAllRecurring() {
  const [items, setItems] = useState<RecurringItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (r: RecurringItem) => {
    setItems((prev) => {
      const next = [...prev, r];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<RecurringItem>) => {
    setItems((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((r) => r.id !== id);
      save(next);
      return next;
    });
  };

  return { items, ready, add, update, remove };
}

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
