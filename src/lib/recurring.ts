'use client';

import { useEffect, useState } from 'react';
import type { RecurringItem } from '@/lib/types';

const KEY = 'asset/recurring/v1';

function load(): RecurringItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as RecurringItem[];
  } catch {
    // fall through
  }
  return [];
}

function save(list: RecurringItem[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useRecurring() {
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

/** Days until the given recurring day-of-month (1..31). */
export function daysUntilDay(dayOfMonth: number, today = new Date()): number {
  const day = today.getDate();
  if (dayOfMonth >= day) return dayOfMonth - day;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  return lastDay - day + dayOfMonth;
}
