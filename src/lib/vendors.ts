'use client';

import { useEffect, useState } from 'react';
import type { Vendor } from '@/lib/types';

const KEY = 'asset/vendors/v1';

function load(): Vendor[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Vendor[];
  } catch {
    /* */
  }
  return [];
}
function save(list: Vendor[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function useVendors() {
  const [items, setItems] = useState<Vendor[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (v: Vendor) => {
    setItems((prev) => {
      const next = [...prev, v];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<Vendor>) => {
    setItems((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, ...patch } : v));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((v) => v.id !== id);
      save(next);
      return next;
    });
  };

  return { items, ready, add, update, remove };
}
