'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { KEYS } from '@/lib/storage-keys';
import type { LineOfCredit } from '@/lib/types';

function load(): LineOfCredit[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(KEYS.creditLines);
    if (raw) return JSON.parse(raw) as LineOfCredit[];
  } catch {
    /* */
  }
  return [];
}
function save(list: LineOfCredit[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(KEYS.creditLines, JSON.stringify(list));
}

/** Monthly interest amount on the current outstanding balance. */
export function computeMonthlyInterest(used: number, annualRate: number): number {
  if (used <= 0 || annualRate <= 0) return 0;
  return Math.round(used * (annualRate / 100 / 12));
}

export function useAllCreditLines() {
  const [items, setItems] = useState<LineOfCredit[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setItems(load());
    setReady(true);
  }, []);

  const add = (l: LineOfCredit) => {
    setItems((prev) => {
      const next = [...prev, l];
      save(next);
      return next;
    });
  };
  const update = (id: string, patch: Partial<LineOfCredit>) => {
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
  };

  return { items, ready, add, update, remove };
}

export function useCreditLines() {
  const all = useAllCreditLines();
  const { mode } = useMode();
  const items = useMemo(
    () => all.items.filter((l) => l.scope === mode),
    [all.items, mode],
  );
  return { ...all, items };
}
