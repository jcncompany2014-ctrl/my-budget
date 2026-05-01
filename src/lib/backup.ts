'use client';

import { KEYS } from '@/lib/storage-keys';
import type {
  Account,
  Budget,
  BusinessLocation,
  Challenge,
  CustomCategory,
  Employee,
  Favorite,
  Investment,
  LineOfCredit,
  Loan,
  RecurringItem,
  SavingsGoal,
  Transaction,
  Vendor,
} from '@/lib/types';

export type BackupFile = {
  version: 5;
  exportedAt: string;
  profile?: { name: string };
  businessProfile?: unknown;
  transactions: Transaction[];
  accounts: Account[];
  budgets: Record<string, Budget>;
  goals: SavingsGoal[];
  recurring: RecurringItem[];
  loans?: Loan[];
  creditLines?: LineOfCredit[];
  vendors?: Vendor[];
  employees?: Employee[];
  locations?: BusinessLocation[];
  investments?: Investment[];
  favorites?: Favorite[];
  challenges?: Challenge[];
  customCategories?: CustomCategory[];
  categoryRules?: unknown[];
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

function writeIf(key: string, val: unknown) {
  if (typeof window === 'undefined') return;
  if (val === null || val === undefined) return;
  window.localStorage.setItem(key, JSON.stringify(val));
}

export function exportAll(): BackupFile {
  return {
    version: 5,
    exportedAt: new Date().toISOString(),
    profile: read<{ name: string }>(KEYS.profile, { name: '' }),
    businessProfile: read<unknown>(KEYS.businessProfile, null),
    transactions: read<Transaction[]>(KEYS.transactions, []),
    accounts: read<Account[]>(KEYS.accounts, []),
    budgets: read<Record<string, Budget>>(KEYS.budgets, {}),
    goals: read<SavingsGoal[]>(KEYS.goals, []),
    recurring: read<RecurringItem[]>(KEYS.recurring, []),
    loans: read<Loan[]>(KEYS.loans, []),
    creditLines: read<LineOfCredit[]>(KEYS.creditLines, []),
    vendors: read<Vendor[]>(KEYS.vendors, []),
    employees: read<Employee[]>(KEYS.employees, []),
    locations: read<BusinessLocation[]>(KEYS.locations, []),
    investments: read<Investment[]>(KEYS.investments, []),
    favorites: read<Favorite[]>(KEYS.favorites, []),
    challenges: read<Challenge[]>(KEYS.challenges, []),
    customCategories: read<CustomCategory[]>(KEYS.customCategories, []),
    categoryRules: read<unknown[]>('asset/category-rules/v1', []),
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

type ImportResult = {
  transactions: number;
  accounts: number;
  budgets: number;
  goals: number;
  recurring: number;
  loans: number;
  creditLines: number;
  vendors: number;
  employees: number;
  locations: number;
  investments: number;
  favorites: number;
  challenges: number;
  customCategories: number;
};

const ARRAY_ENTITIES: Array<{
  bodyKey: keyof BackupFile;
  storageKey: string;
  resultKey: keyof ImportResult;
}> = [
  { bodyKey: 'accounts', storageKey: KEYS.accounts, resultKey: 'accounts' },
  { bodyKey: 'goals', storageKey: KEYS.goals, resultKey: 'goals' },
  { bodyKey: 'recurring', storageKey: KEYS.recurring, resultKey: 'recurring' },
  { bodyKey: 'loans', storageKey: KEYS.loans, resultKey: 'loans' },
  { bodyKey: 'creditLines', storageKey: KEYS.creditLines, resultKey: 'creditLines' },
  { bodyKey: 'vendors', storageKey: KEYS.vendors, resultKey: 'vendors' },
  { bodyKey: 'employees', storageKey: KEYS.employees, resultKey: 'employees' },
  { bodyKey: 'locations', storageKey: KEYS.locations, resultKey: 'locations' },
  { bodyKey: 'investments', storageKey: KEYS.investments, resultKey: 'investments' },
  { bodyKey: 'favorites', storageKey: KEYS.favorites, resultKey: 'favorites' },
  { bodyKey: 'challenges', storageKey: KEYS.challenges, resultKey: 'challenges' },
  { bodyKey: 'customCategories', storageKey: KEYS.customCategories, resultKey: 'customCategories' },
];

export function importBackup(file: File): Promise<ImportResult> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요'));
    reader.onload = () => {
      try {
        const text = reader.result as string;
        const parsed = JSON.parse(text);

        let transactions: Transaction[] | null = null;
        let body: Record<string, unknown> = {};
        if (Array.isArray(parsed)) {
          transactions = parsed as Transaction[];
        } else if (parsed && typeof parsed === 'object') {
          body = parsed;
          transactions = Array.isArray(parsed.transactions) ? parsed.transactions : null;
        } else {
          reject(new Error('잘못된 백업 파일이에요'));
          return;
        }

        // Only overwrite transactions when the backup actually contains them.
        // Earlier versions wrote an empty array on missing-or-malformed input,
        // which silently wiped every transaction the user had.
        if (transactions !== null) {
          writeIf(KEYS.transactions, transactions);
        }

        const result: ImportResult = {
          transactions: transactions?.length ?? 0,
          accounts: 0,
          budgets: 0,
          goals: 0,
          recurring: 0,
          loans: 0,
          creditLines: 0,
          vendors: 0,
          employees: 0,
          locations: 0,
          investments: 0,
          favorites: 0,
          challenges: 0,
          customCategories: 0,
        };

        for (const e of ARRAY_ENTITIES) {
          const v = body[e.bodyKey as string];
          if (Array.isArray(v)) {
            writeIf(e.storageKey, v);
            (result[e.resultKey] as number) = v.length;
          }
        }

        if (body.budgets && typeof body.budgets === 'object') {
          writeIf(KEYS.budgets, body.budgets);
          result.budgets = Object.keys(body.budgets as Record<string, unknown>).length;
        }

        if (body.profile && typeof body.profile === 'object') {
          writeIf(KEYS.profile, body.profile);
        }
        if (body.businessProfile && typeof body.businessProfile === 'object') {
          writeIf(KEYS.businessProfile, body.businessProfile);
        }
        if (Array.isArray(body.categoryRules)) {
          writeIf('asset/category-rules/v1', body.categoryRules);
        }

        resolve(result);
      } catch {
        reject(new Error('JSON 파싱 실패'));
      }
    };
    reader.readAsText(file);
  });
}

export function clearAll() {
  if (typeof window === 'undefined') return;
  const allKeys = Object.values(KEYS) as string[];
  for (const k of allKeys) {
    window.localStorage.removeItem(k);
  }
  // Auxiliary keys not in KEYS registry
  window.localStorage.removeItem('asset/category-rules/v1');
  window.localStorage.removeItem('asset/auto-backup/v1');
  window.localStorage.removeItem('asset/auto-backup-meta/v1');
  window.localStorage.removeItem('asset/auto-payroll-last/v1');
  window.localStorage.removeItem('asset/auto-recurring-last/v1');
  window.localStorage.removeItem('asset/auto-loan-last/v1');
  window.localStorage.removeItem('asset/auto-credit-line-last/v1');
  window.localStorage.removeItem('asset/smart-dismissed/v1');
  window.localStorage.removeItem('asset/install-hint-dismissed');
  window.localStorage.removeItem('asset/audit-log/v1'); // legacy
}
