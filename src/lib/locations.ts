'use client';

import { useEffect, useState } from 'react';
import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { BusinessLocation } from '@/lib/types';

const useLocationsList = createListStore<BusinessLocation>(KEYS.locations);

function loadActive(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEYS.activeLocation);
}
function saveActive(id: string | null) {
  if (typeof window === 'undefined') return;
  if (id) window.localStorage.setItem(KEYS.activeLocation, id);
  else window.localStorage.removeItem(KEYS.activeLocation);
}

export function useLocations() {
  const list = useLocationsList();
  const [activeId, setActiveIdState] = useState<string | null>(null);

  useEffect(() => {
    setActiveIdState(loadActive());
  }, []);

  const setActive = (id: string | null) => {
    setActiveIdState(id);
    saveActive(id);
  };

  const remove = (id: string) => {
    list.remove(id);
    if (activeId === id) setActive(null);
  };

  return { ...list, activeId, setActive, remove };
}
