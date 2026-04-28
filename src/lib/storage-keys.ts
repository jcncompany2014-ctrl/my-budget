/**
 * Single source of truth for all localStorage keys.
 * Keep versions per-key so individual schemas can migrate independently.
 */
export const KEYS = {
  transactions: 'asset/transactions/v2',
  accounts: 'asset/accounts/v2',
  budgets: 'asset/budgets/v1',
  goals: 'asset/goals/v1',
  recurring: 'asset/recurring/v1',
  loans: 'asset/loans/v1',
  vendors: 'asset/vendors/v1',
  employees: 'asset/employees/v1',
  locations: 'asset/locations/v1',
  activeLocation: 'asset/active-location/v1',
  investments: 'asset/investments/v1',
  favorites: 'asset/favorites/v1',
  challenges: 'asset/challenges/v1',
  customCategories: 'asset/custom-cats/v1',
  yearlyGoals: 'asset/yearly-goals/v1',
  events: 'asset/events/v1',
  profile: 'asset/profile/v1',
  theme: 'asset/theme/v1',
  mode: 'asset/mode/v1',
  language: 'asset/language/v1',
  currency: 'asset/currency/v1',
  taxpayerType: 'asset/taxpayer-type/v1',
  installHintDismissed: 'asset/install-hint-dismissed',
  auditLog: 'asset/audit-log/v1',
} as const;

export type StorageKey = (typeof KEYS)[keyof typeof KEYS];

/** Approximate localStorage usage in bytes (UTF-16, so ×2). */
export function localStorageBytes(): number {
  if (typeof window === 'undefined') return 0;
  let total = 0;
  for (let i = 0; i < window.localStorage.length; i++) {
    const k = window.localStorage.key(i);
    if (!k) continue;
    const v = window.localStorage.getItem(k) ?? '';
    total += (k.length + v.length) * 2;
  }
  return total;
}

export const STORAGE_LIMIT_BYTES = 5 * 1024 * 1024;
