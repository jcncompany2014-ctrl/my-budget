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

export type AccountType = 'bank' | 'card' | 'cash' | 'investment';

export type Account = {
  id: string;
  name: string;
  bank: string;
  type: AccountType;
  balance: number;
  color: string;
  last4?: string;
  main?: boolean;
  scope: Scope;
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

  /** Vendor (business mode) */
  vendor?: string;
  /** Business location (business mode, optional) */
  location?: string;
  /** Sub-category id, if applicable */
  subCat?: string;
  /** Tax document attached */
  taxDocId?: string;
  /** Outstanding payable/receivable (business mode) */
  outstanding?: boolean;
  /** Receipt / 증빙 marked */
  hasReceipt?: boolean;

  /** Transfer linkage */
  transferPairId?: string;
  /** When this is a transfer leg, the counterparty account id */
  transferTo?: string;
  /** When this is a transfer leg, was it cross-mode? */
  transferCrossMode?: boolean;

  /** Foreign currency original amount (display) */
  fxAmount?: number;
  fxCurrency?: string;

  /** Split breakdown — when present, each entry's amount sums to this tx's amount */
  splits?: { cat: string; amount: number; memo?: string }[];
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
  scope: Scope;
};

export type RecurringItem = {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  day: number;
  cat: string;
  scope: Scope;
};

export type Loan = {
  id: string;
  name: string;
  emoji: string;
  scope: Scope;
  lender: string;
  principal: number;
  remaining: number;
  rate: number;
  termMonths: number;
  monthlyPayment?: number;
  startDate: string;
  dueDate: string;
  color: string;
};

export type Vendor = {
  id: string;
  name: string;
  scope: Scope;
  kind: 'client' | 'supplier' | 'both';
  contact?: string;
  memo?: string;
  color: string;
};

export type Employee = {
  id: string;
  name: string;
  position?: string;
  baseSalary: number;
  startDate: string;
  active: boolean;
  color: string;
};

export type BusinessLocation = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  active: boolean;
};

export type Investment = {
  id: string;
  name: string;
  scope: Scope;
  ticker?: string;
  kind: 'stock' | 'fund' | 'crypto' | 'other';
  shares?: number;
  avgPrice?: number;
  currentValue: number;
  color: string;
  /** Live quote source id, e.g. "upbit:BTC", "yahoo:AAPL", "yahoo:005930.KS". */
  quoteId?: string;
  /** When true, currentValue is recomputed from live quote × shares. */
  autoQuote?: boolean;
};

export type Favorite = {
  id: string;
  name: string;
  emoji: string;
  amount: number;
  cat: string;
  acc: string;
  scope: Scope;
  type: 'expense' | 'income';
};

export type Challenge = {
  id: string;
  name: string;
  emoji: string;
  scope: Scope;
  cat?: string;
  limit: number;
  startDate: string;
  endDate: string;
  active: boolean;
};

/** Custom category that the user adds on top of the built-in set. */
export type CustomCategory = {
  id: string;
  name: string;
  emoji: string;
  color: string;
  scope: Scope;
  kind?: CategoryKind;
  parent?: string; // sub-category support
};
