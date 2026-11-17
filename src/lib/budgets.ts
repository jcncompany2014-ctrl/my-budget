'use client';

import { useMemo } from 'react';
import { isSpendingCategory } from '@/lib/format';
import { KEYS } from '@/lib/storage-keys';
import { createRecordStore } from '@/lib/store-factory';
import type { Budget } from '@/lib/types';

const useBudgetsRecord = createRecordStore<Budget>(KEYS.budgets);

export function useBudgets() {
  const { data, ready, set: setRaw, remove } = useBudgetsRecord();
  // 저축 moves money rather than spending it: a cap there was never used up and
  // only inflated the month's total budget (and the daily allowance with it).
  const budgets = useMemo(() => {
    const out: Record<string, Budget> = {};
    for (const [cat, b] of Object.entries(data)) if (isSpendingCategory(cat)) out[cat] = b;
    return out;
  }, [data]);
  // Existing call sites use `set(catId, limit)` rather than (key, value).
  const set = (catId: string, limit: number) => setRaw(catId, { limit });
  return { budgets, ready, set, remove };
}
