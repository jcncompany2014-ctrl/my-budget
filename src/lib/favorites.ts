'use client';

import { useEffect, useState } from 'react';
import type { Favorite } from '@/lib/types';

const KEY = 'asset/favorites/v1';

function load(): Favorite[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Favorite[];
  } catch {
    /* */
  }
  return [];
}
function save(list: Favorite[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useFavorites() {
  const [items, setItems] = useState<Favorite[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (f: Favorite) => {
    setItems((prev) => {
      const next = [...prev, f];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<Favorite>) => {
    setItems((prev) => {
      const next = prev.map((f) => (f.id === id ? { ...f, ...patch } : f));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((f) => f.id !== id);
      save(next);
      return next;
    });
  };

  return { items, ready, add, update, remove };
}
