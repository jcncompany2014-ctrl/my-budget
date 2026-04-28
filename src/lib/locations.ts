'use client';

import { useEffect, useState } from 'react';
import type { BusinessLocation } from '@/lib/types';

const KEY = 'asset/locations/v1';
const ACTIVE_KEY = 'asset/active-location/v1';

function load(): BusinessLocation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as BusinessLocation[];
  } catch {
    /* */
  }
  return [];
}
function save(list: BusinessLocation[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

function loadActive(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(ACTIVE_KEY);
}
function saveActive(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) window.localStorage.setItem(ACTIVE_KEY, id);
  else window.localStorage.removeItem(ACTIVE_KEY);
}

export function useLocations() {
  const [items, setItems] = useState<BusinessLocation[]>([]);
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setActiveIdState(loadActive());
    setReady(true);
  }, []);

  const add = (l: BusinessLocation) => {
    setItems((prev) => {
      const next = [...prev, l];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<BusinessLocation>) => {
    setItems((prev) => {
      const next = prev.map((l) => (l.id === id ? { ...l, ...patch } : l));
      save(next);
      return next;
    });
  };
  const remove = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((l) => l.id !== id);
      save(next);
      return next;
    });
    if (activeId === id) {
      setActiveIdState(null);
      saveActive(null);
    }
  };
  const setActive = (id: string | null) => {
    setActiveIdState(id);
    saveActive(id);
  };

  return { items, activeId, ready, add, update, remove, setActive };
}
