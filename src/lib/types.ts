export type CategoryKind = 'expense' | 'income';
export type Scope = 'personal' | 'business';

export type Category = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  kind?: CategoryKind;
  scope: Scope;
};

export type AccountType = 'bank' | 'card' | 'cash';

export type Account = {
  id: string;
  name: string;
  bank: string;
  type: AccountType;
  balance: number;
  color: string;
  last4?: string;
  main?: boolean;
};

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  cat: string;
  merchant: string;
  memo?: string;
  acc: string;
  recurring?: boolean;
  scope?: Scope;
};

export type Budget = {
  limit: number;
};

export type SavingsGoal = {
  id: string;
  name: string;
  emoji: string;
  target: number;
  current: number;
  due: string;
  color: string;
};

export type RecurringItem = {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  day: number;
  cat: string;
};
