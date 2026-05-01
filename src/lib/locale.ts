'use client';

import { KEYS } from '@/lib/storage-keys';
import { createValueStore } from '@/lib/store-factory';

export type Currency = 'KRW' | 'USD' | 'JPY' | 'EUR';
export type Language = 'ko' | 'en';

const CURRENCY_INFO: Record<Currency, { symbol: string; locale: string; suffix: string }> = {
  KRW: { symbol: '₩', locale: 'ko-KR', suffix: '원' },
  USD: { symbol: '$', locale: 'en-US', suffix: '' },
  JPY: { symbol: '¥', locale: 'ja-JP', suffix: '엔' },
  EUR: { symbol: '€', locale: 'de-DE', suffix: '' },
};

export const useCurrency = createValueStore<Currency>(KEYS.currency, 'KRW');
export const useLanguage = createValueStore<Language>(KEYS.language, 'ko');

export function formatMoney(value: number, currency: Currency = 'KRW'): string {
  const info = CURRENCY_INFO[currency];
  const formatter = new Intl.NumberFormat(info.locale, {
    style: 'decimal',
    maximumFractionDigits: currency === 'KRW' || currency === 'JPY' ? 0 : 2,
  });
  return formatter.format(Math.round(Math.abs(value) * 100) / 100);
}

export function currencySuffix(currency: Currency = 'KRW'): string {
  return CURRENCY_INFO[currency].suffix;
}

export function currencySymbol(currency: Currency = 'KRW'): string {
  return CURRENCY_INFO[currency].symbol;
}

const STR_KO = {
  home: '홈',
  list: '내역',
  stats: '통계',
  wallet: '자산',
  settings: '설정',
  income: '수입',
  expense: '지출',
  transfer: '이체',
  thisMonth: '이번 달',
  thisWeek: '이번 주',
};
const STR_EN: typeof STR_KO = {
  home: 'Home',
  list: 'List',
  stats: 'Stats',
  wallet: 'Wallet',
  settings: 'Settings',
  income: 'Income',
  expense: 'Expense',
  transfer: 'Transfer',
  thisMonth: 'This month',
  thisWeek: 'This week',
};

export function strings(lang: Language) {
  return lang === 'en' ? STR_EN : STR_KO;
}
