'use client';

import { useEffect, useState } from 'react';
import type { Employee } from '@/lib/types';

const KEY = 'asset/employees/v1';

function load(): Employee[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Employee[];
  } catch {
    /* */
  }
  return [];
}
function save(list: Employee[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useEmployees() {
  const [items, setItems] = useState<Employee[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (e: Employee) => {
    setItems((prev) => {
      const next = [...prev, e];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<Employee>) => {
    setItems((prev) => {
      const next = prev.map((e) => (e.id === id ? { ...e, ...patch } : e));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((e) => e.id !== id);
      save(next);
      return next;
    });
  };

  return { items, ready, add, update, remove };
}
