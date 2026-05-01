'use client';

import { useMemo } from 'react';
import { useMode } from '@/components/ModeProvider';
import { KEYS } from '@/lib/storage-keys';
import { createListStore } from '@/lib/store-factory';
import type { LineOfCredit } from '@/lib/types';

/** Monthly interest amount on the current outstanding balance. */
export function computeMonthlyInterest(used: number, annualRate: number): number {
  if (used <= 0 || annualRate <= 0) return 0;
  return Math.round(used * (annualRate / 100 / 12));
}

export const useAllCreditLines = createListStore<LineOfCredit>(KEYS.creditLines);

export function useCreditLines() {
  const all = useAllCreditLines();
  const { mode } = useMode();
  const items = useMemo(() => all.items.filter((l) => l.scope === mode), [all.items, mode]);
  return { ...all, items };
}
