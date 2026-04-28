'use client';

import { useEffect, useState } from 'react';
import type { CustomCategory } from '@/lib/types';

const KEY = 'asset/custom-cats/v1';

function load(): CustomCategory[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as CustomCategory[];
  } catch {
    // fall through
  }
  return [];
}

function save(list: CustomCategory[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useCustomCategories() {
  const [items, setItems] = useState<CustomCategory[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (c: CustomCategory) => {
    setItems((prev) => {
      const next = [...prev, c];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<CustomCategory>) => {
    setItems((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, ...patch } : c));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((c) => c.id !== id);
      save(next);
      return next;
    });
  };

  return { items, ready, add, update, remove };
}
