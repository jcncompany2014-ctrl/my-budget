'use client';

import { useMemo } from 'react';
import { dueTotal } from '@/lib/reimburse';
import { useAllTransactions } from '@/lib/storage';

/** 사업 대납 not yet settled — the same amount is owed to me and owed by the business. */
export function useReimburseDue(): number {
  const { tx } = useAllTransactions();
  return useMemo(() => dueTotal(tx), [tx]);
}
