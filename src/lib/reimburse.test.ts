import { describe, expect, it } from 'vitest';
import { isExpense, isIncome } from '@/lib/format';
import {
  buildSettlement,
  canReimburse,
  dueTotal,
  toBusinessPatch,
  toPersonalPatch,
  usuallyReimbursed,
} from '@/lib/reimburse';
import type { Account, Transaction } from '@/lib/types';

const account = (id: string, scope: Account['scope'], type: Account['type'] = 'bank'): Account => ({
  id,
  name: id,
  bank: '',
  type,
  balance: 0,
  color: '#000',
  scope,
});
const accounts = [account('card', 'personal', 'card'), account('biz', 'business')];

const tx = (extra: Partial<Transaction> = {}): Transaction => ({
  id: 't1',
  date: '2026-11-14T03:00:00.000Z',
  amount: -33_000,
  cat: 'food',
  merchant: '다이소 역삼점',
  acc: 'card',
  scope: 'personal',
  ...extra,
});

describe('사업 대납', () => {
  it('only personal expenses on a personal account can be flagged', () => {
    expect(canReimburse(tx(), accounts)).toBe(true);
    expect(canReimburse(tx({ amount: 5000 }), accounts)).toBe(false);
    expect(canReimburse(tx({ transferPairId: 'x' }), accounts)).toBe(false);
    expect(canReimburse(tx({ scope: 'business' }), accounts)).toBe(false);
    expect(canReimburse(tx({ acc: 'biz' }), accounts)).toBe(false);
  });

  it('moves the row to the business ledger and back, keeping the account', () => {
    const biz = { ...tx(), ...toBusinessPatch(tx(), []) };
    expect(biz).toMatchObject({ scope: 'business', acc: 'card', reimburse: 'due', cat: 'biz_etc' });
    expect(dueTotal([biz, tx()])).toBe(33_000);

    const back = { ...biz, ...toPersonalPatch(biz, []) };
    expect(back.scope).toBe('personal');
    expect(back.reimburse).toBeUndefined();
    expect(dueTotal([back])).toBe(0);
  });

  it('reuses the business category this merchant was given before', () => {
    const history = [tx({ id: 'old', scope: 'business', cat: 'biz_supplies', reimburse: 'done' })];
    expect(toBusinessPatch(tx(), history).cat).toBe('biz_supplies');
  });

  it('settles with one business → personal transfer for the total due', () => {
    const rows = [
      tx({ id: 'a', scope: 'business', reimburse: 'due', amount: -33_000 }),
      tx({ id: 'b', scope: 'business', reimburse: 'due', amount: -7_000 }),
      tx({ id: 'c', scope: 'business', reimburse: 'done', amount: -9_000 }),
    ];
    const [out, into] = buildSettlement({
      rows,
      from: accounts[1],
      to: account('kb', 'personal'),
      date: '2026-11-20T00:00:00.000Z',
      seq: 'x1',
    });
    expect(out).toMatchObject({ acc: 'biz', scope: 'business', amount: -40_000 });
    expect(into).toMatchObject({ acc: 'kb', scope: 'personal', amount: 40_000 });
    expect(out.transferPairId).toBe(into.transferPairId);
    expect([out, into].some((t) => isExpense(t) || isIncome(t))).toBe(false);
  });

  it('builds nothing when nothing is due', () => {
    expect(
      buildSettlement({ rows: [tx()], from: accounts[1], to: accounts[0], date: '', seq: 'x' }),
    ).toEqual([]);
  });
});

describe('usuallyReimbursed', () => {
  const row = (date: string, flagged: boolean, merchant = '오피스디포'): Transaction => ({
    id: date,
    date,
    amount: -10_000,
    cat: flagged ? 'biz_etc' : 'living',
    merchant,
    acc: 'card',
    scope: flagged ? 'business' : 'personal',
    reimburse: flagged ? 'due' : undefined,
  });

  it('needs the last two purchases there to be 대납', () => {
    expect(usuallyReimbursed('오피스디포', [row('2026-11-01', true)])).toBe(false);
    expect(
      usuallyReimbursed('오피스디포', [row('2026-11-01', true), row('2026-11-05', true)]),
    ).toBe(true);
  });

  it('a personal purchase among the last three switches it off', () => {
    const history = [
      row('2026-10-01', true),
      row('2026-10-10', true),
      row('2026-11-01', false),
      row('2026-11-05', true),
    ];
    expect(usuallyReimbursed('오피스디포', history)).toBe(false);
    // …and three business ones in a row switch it back on, whatever came before.
    expect(
      usuallyReimbursed('오피스디포', [
        ...history,
        row('2026-11-08', true),
        row('2026-11-09', true),
      ]),
    ).toBe(true);
  });

  it('settled rows count, other shops and refunds do not', () => {
    const done = { ...row('2026-11-02', true), reimburse: 'done' as const };
    const refund = { ...row('2026-11-09', false), amount: 10_000 };
    const other = row('2026-11-10', false, '스타벅스');
    expect(usuallyReimbursed(' 오피스디포 ', [row('2026-11-01', true), done, refund, other])).toBe(
      true,
    );
  });
});
