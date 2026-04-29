'use client';

import { createListStore } from '@/lib/store-factory';

const KEY = 'asset/category-rules/v1';

export type CategoryRule = {
  id: string;
  /** Substring to match in merchant (case-insensitive) */
  match: string;
  /** Category id to apply */
  cat: string;
};

export const useCategoryRules = createListStore<CategoryRule>(KEY, []);

/** Apply rules to a merchant name; returns matching category id or null. */
export function applyRules(merchant: string, rules: CategoryRule[]): string | null {
  const m = merchant.toLowerCase();
  for (const r of rules) {
    if (r.match && m.includes(r.match.toLowerCase())) {
      return r.cat;
    }
  }
  return null;
}
