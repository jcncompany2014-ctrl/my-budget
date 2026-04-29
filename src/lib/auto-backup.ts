'use client';

import { exportAll } from '@/lib/backup';

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

export function restoreLastAutoBackup(): boolean {
  if (typeof window === 'undefined') return false;
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return false;
  try {
    const data = JSON.parse(raw);
    if (data?.transactions) {
      window.localStorage.setItem('asset/transactions/v2', JSON.stringify(data.transactions));
    }
    if (data?.accounts) {
      window.localStorage.setItem('asset/accounts/v2', JSON.stringify(data.accounts));
    }
    if (data?.budgets) {
      window.localStorage.setItem('asset/budgets/v1', JSON.stringify(data.budgets));
    }
    if (data?.goals) {
      window.localStorage.setItem('asset/goals/v1', JSON.stringify(data.goals));
    }
    if (data?.recurring) {
      window.localStorage.setItem('asset/recurring/v1', JSON.stringify(data.recurring));
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
