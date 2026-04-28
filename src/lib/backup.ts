'use client';

import type { Transaction } from '@/lib/types';

const KEY = 'asset/transactions/v1';

export type BackupFile = {
  version: 1;
  exportedAt: string;
  transactions: Transaction[];
};

export function exportTransactions(): BackupFile {
  const raw = window.localStorage.getItem(KEY);
  const transactions = raw ? (JSON.parse(raw) as Transaction[]) : [];
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    transactions,
  };
}

export function downloadBackup() {
  const data = exportTransactions();
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

export function importBackup(file: File): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요'));
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text) as BackupFile | Transaction[];
        const transactions = Array.isArray(parsed) ? parsed : parsed.transactions;
        if (!Array.isArray(transactions)) {
          reject(new Error('잘못된 백업 파일이에요'));
          return;
        }
        window.localStorage.setItem(KEY, JSON.stringify(transactions));
        resolve(transactions);
      } catch {
        reject(new Error('JSON 파싱 실패'));
      }
    };
    reader.readAsText(file);
  });
}

export function clearAll() {
  window.localStorage.removeItem(KEY);
}
