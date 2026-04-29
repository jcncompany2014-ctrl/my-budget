'use client';

import { createRecordStore } from '@/lib/store-factory';
import type { Currency } from '@/lib/locale';

const KEY = 'asset/fx-rates/v1';

/** Stored as {currencyCode: rate to KRW}. e.g., USD: 1380 means 1 USD = 1380 KRW. */
const useFxStore = createRecordStore<number>(KEY, {
  KRW: 1,
  USD: 1380,
  JPY: 9.2,
  EUR: 1480,
});

export function useFx() {
  return useFxStore();
}

export function convertToKRW(amount: number, currency: Currency, rates: Record<string, number>): number {
  const rate = rates[currency] ?? (currency === 'KRW' ? 1 : 0);
  return Math.round(amount * rate);
}

export function convertFromKRW(krw: number, currency: Currency, rates: Record<string, number>): number {
  const rate = rates[currency] ?? (currency === 'KRW' ? 1 : 0);
  if (rate === 0) return 0;
  return Math.round(krw / rate);
}
