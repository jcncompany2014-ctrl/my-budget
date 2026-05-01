'use client';

import { exportAll } from '@/lib/backup';
import { KEYS } from '@/lib/storage-keys';

const KEY = 'asset/auto-backup/v1';
const META_KEY = 'asset/auto-backup-meta/v1';

const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldAutoBackup(): boolean {
  if (typeof window === 'undefined') return false;
  const meta = window.localStorage.getItem(META_KEY);
  if (!meta) return true;
  try {
    const at = new Date(meta).getTime();
    return Date.now() - at > ONE_WEEK_MS;
  } catch {
    return true;
  }
}

export function performAutoBackup() {
  if (typeof window === 'undefined') return;
  try {
    const data = exportAll();
    window.localStorage.setItem(KEY, JSON.stringify(data));
    window.localStorage.setItem(META_KEY, new Date().toISOString());
  } catch {
    // ignore
  }
}

export function lastAutoBackupAt(): Date | null {
  if (typeof window === 'undefined') return null;
  const meta = window.localStorage.getItem(META_KEY);
  if (!meta) return null;
  try {
    return new Date(meta);
  } catch {
    return null;
  }
}

const RESTORE_MAP: Array<[string, string]> = [
  ['transactions', KEYS.transactions],
  ['accounts', KEYS.accounts],
  ['budgets', KEYS.budgets],
  ['goals', KEYS.goals],
  ['recurring', KEYS.recurring],
  ['loans', KEYS.loans],
  ['creditLines', KEYS.creditLines],
  ['vendors', KEYS.vendors],
  ['employees', KEYS.employees],
  ['locations', KEYS.locations],
  ['investments', KEYS.investments],
  ['favorites', KEYS.favorites],
  ['challenges', KEYS.challenges],
  ['customCategories', KEYS.customCategories],
  ['profile', KEYS.profile],
  ['businessProfile', KEYS.businessProfile],
];

export function restoreLastAutoBackup(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw) as Record<string, unknown>;
    for (const [bodyKey, storageKey] of RESTORE_MAP) {
      const v = data?.[bodyKey];
      if (v !== undefined && v !== null) {
        window.localStorage.setItem(storageKey, JSON.stringify(v));
      }
    }
    if (Array.isArray(data.categoryRules)) {
      window.localStorage.setItem('asset/category-rules/v1', JSON.stringify(data.categoryRules));
    }
    return true;
  } catch {
    return false;
  }
}

/** Run on app start. Silently saves a snapshot if none in last week. */
export function ensureAutoBackup() {
  if (shouldAutoBackup()) {
    performAutoBackup();
  }
}
