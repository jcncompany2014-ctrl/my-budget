'use client';

import { KEYS } from '@/lib/storage-keys';
import { createRecordStore } from '@/lib/store-factory';
import type { Budget } from '@/lib/types';

const useBudgetsRecord = createRecordStore<Budget>(KEYS.budgets);

export function useBudgets() {
  const { data, ready, set: setRaw, remove } = useBudgetsRecord();
  // Existing call sites use `set(catId, limit)` rather than (key, value).
  const set = (catId: string, limit: number) => setRaw(catId, { limit });
  return { budgets: data, ready, set, remove };
}
