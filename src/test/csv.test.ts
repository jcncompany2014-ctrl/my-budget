import { describe, expect, it } from 'vitest';
import { transactionsToCSV } from '@/lib/csv';
import { parseTransactionsCSV } from '@/lib/csv-import';
import type { Account, Transaction } from '@/lib/types';

const account = (id: string, name: string, extra: Partial<Account> = {}): Account => ({
  id,
  name,
  bank: '',
  type: 'bank',
  balance: 0,
  color: '#000',
  scope: 'personal',
  ...extra,
});
const accounts = [
  account('kb', '국민은행', { main: true }),
  account('card', '현대카드', { type: 'card' }),
  account('biz', '기업은행 사업자', { scope: 'business', main: true }),
];
const byId = Object.fromEntries(accounts.map((a) => [a.id, { name: a.name }]));
const ctx = (existing: Transaction[] = []) => ({ accounts, scope: 'personal' as const, existing });

const rows: Transaction[] = [
  {
    id: 'a',
    date: new Date(2026, 10, 14, 8, 5).toISOString(),
    amount: -5_600,
    cat: 'cafe',
    merchant: '스타벅스 "리저브", 강남',
    memo: '두 잔\n포장',
    acc: 'card',
    scope: 'personal',
  },
  {
    id: 'b',
    date: new Date(2026, 10, 10, 9, 0).toISOString(),
    amount: 3_000_000,
    cat: 'salary',
    merchant: '회사',
    memo: '',
    acc: 'kb',
    scope: 'personal',
  },
  {
    id: 'c',
    date: new Date(2026, 10, 3, 13, 30).toISOString(),
    amount: -120_000,
    cat: 'biz_etc',
    merchant: '사무용품',
    memo: '',
    acc: 'biz',
    scope: 'business',
  },
];

describe('CSV export → import', () => {
  it('writes sortable local dates', () => {
    const csv = transactionsToCSV(rows, byId);
    expect(csv.split('\n')[1].startsWith('2026-11-14,08:05,지출,')).toBe(true);
  });

  it('round-trips date, sign, category, account and ledger', () => {
    const { rows: back, skipped } = parseTransactionsCSV(transactionsToCSV(rows, byId), ctx());
    expect(skipped).toBe(0);
    expect(back.map(({ id: _, ...t }) => t)).toEqual(rows.map(({ id: _, ...t }) => t));
  });

  it('importing the same file again adds nothing', () => {
    const csv = transactionsToCSV(rows, byId);
    const first = parseTransactionsCSV(csv, ctx()).rows;
    const again = parseTransactionsCSV(csv, ctx(first));
    expect(again.rows).toHaveLength(0);
    expect(again.skipped).toBe(3);
  });

  it('구분 decides the sign of a statement that lists spending as positive', () => {
    const csv = [
      '일자,구분,내용,금액',
      '2026.11.02,출금,쿠팡,15000',
      '2026.11.03,입금,환급,8000',
    ].join('\n');
    const { rows: back } = parseTransactionsCSV(csv, ctx());
    expect(back.map((t) => [t.merchant, t.amount, t.cat, t.acc])).toEqual([
      ['쿠팡', -15_000, 'living', 'kb'],
      ['환급', 8_000, 'income', 'kb'],
    ]);
  });

  it('reads the locale date form older exports used', () => {
    const csv = ['일자,시간,구분,금액,소비처', '2026. 11. 14.,오후 2:05,지출,-4500,카페'].join(
      '\n',
    );
    const { rows: back } = parseTransactionsCSV(csv, ctx());
    expect(back[0].date).toBe(new Date(2026, 10, 14, 14, 5).toISOString());
  });

  it('skips rows without a date or an amount', () => {
    const csv = ['일자,금액,소비처', ',1000,x', '2026-11-01,,y', '2026-13-40,500,z'].join('\n');
    expect(parseTransactionsCSV(csv, ctx())).toEqual({ rows: [], skipped: 3 });
  });
});
