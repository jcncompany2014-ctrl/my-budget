'use client';

import { useEffect, useState } from 'react';
import type { Challenge } from '@/lib/types';

const KEY = 'asset/challenges/v1';

function load(): Challenge[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Challenge[];
  } catch {
    /* */
  }
  return [];
}
function save(list: Challenge[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useChallenges() {
  const [items, setItems] = useState<Challenge[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (c: Challenge) => {
    setItems((prev) => {
      const next = [...prev, c];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<Challenge>) => {
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
