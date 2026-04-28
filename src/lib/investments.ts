'use client';

import { useEffect, useState } from 'react';
import type { Investment } from '@/lib/types';

const KEY = 'asset/investments/v1';

function load(): Investment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Investment[];
  } catch {
    /* */
  }
  return [];
}
function save(list: Investment[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useInvestments() {
  const [items, setItems] = useState<Investment[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (i: Investment) => {
    setItems((prev) => {
      const next = [...prev, i];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<Investment>) => {
    setItems((prev) => {
      const next = prev.map((i) => (i.id === id ? { ...i, ...patch } : i));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((i) => i.id !== id);
      save(next);
      return next;
    });
  };

  return { items, ready, add, update, remove };
}
