'use client';

import type { Account, Budget, SavingsGoal, Transaction } from '@/lib/types';

const TX_KEY = 'asset/transactions/v2';
const ACC_KEY = 'asset/accounts/v1';
const BUDGET_KEY = 'asset/budgets/v1';
const GOALS_KEY = 'asset/goals/v1';

export type BackupFile = {
  version: 2;
  exportedAt: string;
  transactions: Transaction[];
  accounts: Account[];
  budgets: Record<string, Budget>;
  goals: SavingsGoal[];
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function exportAll(): BackupFile {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    transactions: read<Transaction[]>(TX_KEY, []),
    accounts: read<Account[]>(ACC_KEY, []),
    budgets: read<Record<string, Budget>>(BUDGET_KEY, {}),
    goals: read<SavingsGoal[]>(GOALS_KEY, []),
  };
}

export function downloadBackup() {
  const data = exportAll();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const today = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `asset-backup-${today}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function importBackup(file: File): Promise<{
  transactions: number;
  accounts: number;
  budgets: number;
  goals: number;
}> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요'));
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text);

        // v1 backups: just an array of transactions or { transactions: [...] }
        // v2 backups: full object
        let transactions: Transaction[] = [];
        let accounts: Account[] | null = null;
        let budgets: Record<string, Budget> | null = null;
        let goals: SavingsGoal[] | null = null;

        if (Array.isArray(parsed)) {
          transactions = parsed as Transaction[];
        } else if (parsed && typeof parsed === 'object') {
          transactions = Array.isArray(parsed.transactions) ? parsed.transactions : [];
          accounts = Array.isArray(parsed.accounts) ? parsed.accounts : null;
          budgets =
            parsed.budgets && typeof parsed.budgets === 'object' ? parsed.budgets : null;
          goals = Array.isArray(parsed.goals) ? parsed.goals : null;
        } else {
          reject(new Error('잘못된 백업 파일이에요'));
          return;
        }

        window.localStorage.setItem(TX_KEY, JSON.stringify(transactions));
        if (accounts) window.localStorage.setItem(ACC_KEY, JSON.stringify(accounts));
        if (budgets) window.localStorage.setItem(BUDGET_KEY, JSON.stringify(budgets));
        if (goals) window.localStorage.setItem(GOALS_KEY, JSON.stringify(goals));

        resolve({
          transactions: transactions.length,
          accounts: accounts?.length ?? 0,
          budgets: budgets ? Object.keys(budgets).length : 0,
          goals: goals?.length ?? 0,
        });
      } catch {
        reject(new Error('JSON 파싱 실패'));
      }
    };
    reader.readAsText(file);
  });
}

export function clearAll() {
  window.localStorage.removeItem(TX_KEY);
  window.localStorage.removeItem(ACC_KEY);
  window.localStorage.removeItem(BUDGET_KEY);
  window.localStorage.removeItem(GOALS_KEY);
}
