import type { Account, Budget, RecurringItem, SavingsGoal, Transaction } from '@/lib/types';

// All collections start empty — user fills them in as they go.

export const SEED_ACCOUNTS: Account[] = [
  { id: 'a-default', name: '기본 지갑', bank: '내 지갑', type: 'cash', balance: 0, color: '#00B956', main: true },
];

export const SEED_TRANSACTIONS: Transaction[] = [];

export const SEED_BUDGETS: Record<string, Budget> = {};

export const SEED_GOALS: SavingsGoal[] = [];

export const SEED_RECURRING: RecurringItem[] = [];
