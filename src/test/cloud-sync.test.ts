import { beforeEach, describe, expect, it, vi } from 'vitest';
import { KEYS } from '@/lib/storage-keys';
import type { Account, Loan, Transaction } from '@/lib/types';

const read = <T>(key: string): T => JSON.parse(window.localStorage.getItem(key) ?? 'null') as T;
const seed = (key: string, value: unknown) =>
  window.localStorage.setItem(key, JSON.stringify(value));

const account = (id: string, balance: number): Account => ({
  id,
  name: id,
  bank: '',
  type: 'bank',
  balance,
  color: '#000',
  scope: 'personal',
});
const tx = (id: string, amount: number, acc: string): Transaction => ({
  id,
  date: '2026-11-14T03:00:00.000Z',
  amount,
  cat: 'food',
  merchant: 'test',
  acc,
});

describe('applyRemoteOp', () => {
  let applyRemoteOp: (op: unknown) => string;
  beforeEach(async () => {
    ({ applyRemoteOp } = await import('@/lib/cloud-sync'));
    seed(KEYS.accounts, [account('kb', 1000), account('kakao', 500)]);
  });

  it('patches, upserts and removes list items by id', () => {
    expect(
      applyRemoteOp({ type: 'patch', key: 'accounts', id: 'kb', patch: { balance: 3_200_000 } }),
    ).toBe('ok');
    expect(
      applyRemoteOp({
        type: 'upsert',
        key: 'accounts',
        items: [account('new', 7), account('kakao', 9)],
      }),
    ).toBe('ok');
    expect(applyRemoteOp({ type: 'remove', key: 'accounts', ids: ['kb'] })).toBe('ok');
    expect(read<Account[]>(KEYS.accounts).map((a) => [a.id, a.balance])).toEqual([
      ['kakao', 9],
      ['new', 7],
    ]);
  });

  it('moves balances for transaction edits', () => {
    expect(applyRemoteOp({ type: 'tx.add', items: [tx('t1', -300, 'kb')] })).toBe('ok');
    expect(read<Account[]>(KEYS.accounts)[0].balance).toBe(700);

    // Same id again is a no-op, not a second debit.
    applyRemoteOp({ type: 'tx.add', items: [tx('t1', -300, 'kb')] });
    expect(read<Account[]>(KEYS.accounts)[0].balance).toBe(700);

    expect(
      applyRemoteOp({ type: 'tx.patch', id: 't1', patch: { amount: -100, acc: 'kakao' } }),
    ).toBe('ok');
    expect(read<Account[]>(KEYS.accounts).map((a) => a.balance)).toEqual([1000, 400]);

    expect(applyRemoteOp({ type: 'tx.remove', ids: ['t1'] })).toBe('ok');
    expect(read<Account[]>(KEYS.accounts).map((a) => a.balance)).toEqual([1000, 500]);
    expect(read<Transaction[]>(KEYS.transactions)).toEqual([]);
  });

  it('can drop rows without touching balances', () => {
    seed(KEYS.transactions, [tx('ghost', -300, 'kb')]);
    applyRemoteOp({ type: 'tx.remove', ids: ['ghost'], keepBalances: true });
    expect(read<Account[]>(KEYS.accounts)[0].balance).toBe(1000);
  });

  it('reports bad edits instead of throwing', () => {
    expect(applyRemoteOp(null)).toMatch(/^error/);
    expect(applyRemoteOp({ type: 'set', key: 'inboxKey', value: 'x' })).toMatch(/^error/);
    expect(applyRemoteOp({ type: 'set', key: 'accounts', value: [{ name: 'no id' }] })).toMatch(
      /^error/,
    );
    expect(applyRemoteOp({ type: 'patch', key: 'accounts', id: 'nope', patch: {} })).toMatch(
      /^error/,
    );
    expect(applyRemoteOp({ type: 'tx.add', items: [{ id: 'x' }] })).toMatch(/^error/);
    expect(read<Account[]>(KEYS.accounts)).toHaveLength(2);
  });
});

describe('syncCloud', () => {
  type Body = { p_key: string; p_state: Record<string, unknown>; p_acks: { id: number }[] };
  let calls: Body[];
  let replies: (object | null)[];
  let syncCloud: () => Promise<{ notes: string[]; undo: () => void } | null>;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'pk');
    Object.assign(window, { location: { host: 'test' } });
    calls = [];
    replies = [];
    vi.stubGlobal('fetch', async (_url: string, init: { body: string }) => {
      calls.push(JSON.parse(init.body) as Body);
      const reply = replies.shift();
      return reply ? { ok: true, json: async () => reply } : { ok: false, json: async () => ({}) };
    });
    ({ syncCloud } = await import('@/lib/cloud-sync'));
    seed(KEYS.accounts, [account('kb', 1000)]);
  });

  it('uploads nothing until the vault is approved, then the full mirror', async () => {
    replies.push({ status: 'pending', code: 'AB12' });
    await syncCloud();
    expect(calls[0].p_state).toEqual({});
    expect(calls[0].p_key).toMatch(/^[A-Za-z0-9_-]{43}$/);

    replies.push({ status: 'approved', code: 'AB12', ops: [] });
    replies.push({ status: 'approved', code: 'AB12', ops: [] });
    await syncCloud();
    expect(calls[1].p_state).toEqual({});
    expect(Object.keys(calls[2].p_state)).toEqual([KEYS.accounts]);

    // Unchanged data is not sent again.
    replies.push({ status: 'approved', code: 'AB12', ops: [] });
    await syncCloud();
    expect(calls[3].p_state).toEqual({});
  });

  it('applies a queued edit once, even when its ack is lost', async () => {
    seed(KEYS.syncStatus, { status: 'approved', code: 'AB12', at: '' });
    const op = {
      id: 7,
      note: '국민은행 잔액 수정',
      op: { type: 'patch', key: 'accounts', id: 'kb', patch: { balance: 2000 } },
    };
    replies.push({ status: 'approved', code: 'AB12', ops: [op] });
    replies.push(null); // the ack round trip fails
    const batch = await syncCloud();
    expect(batch?.notes).toEqual(['국민은행 잔액 수정']);
    expect(read<Account[]>(KEYS.accounts)[0].balance).toBe(2000);

    // Server still thinks it is pending and sends it again alongside our ack.
    seed(KEYS.accounts, [account('kb', 2500)]);
    replies.push({ status: 'approved', code: 'AB12', ops: [] });
    await syncCloud();
    expect(calls.at(-1)?.p_acks).toEqual([{ id: 7, result: 'ok' }]);
    expect(read<Account[]>(KEYS.accounts)[0].balance).toBe(2500);
    expect(read<unknown[]>(KEYS.syncAcks)).toEqual([]);
  });

  it('posts a payment that an edit made due, and can undo the batch', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 14, 12, 0, 0));
    seed(KEYS.syncStatus, { status: 'approved', code: 'AB12', at: '' });
    const loan: Loan = {
      id: 'car',
      name: '자동차 할부',
      emoji: '',
      scope: 'personal',
      lender: '',
      principal: 25_000_000,
      remaining: 22_713_278,
      rate: 3.9,
      termMonths: 60,
      monthlyPayment: 459_285,
      startDate: '2026-04-14',
      dueDate: '2031-04-14',
      color: '#000',
      linkedAccountId: 'kb',
      paymentDay: 14,
      autoPayment: true,
      postedThrough: new Date(2026, 10, 14).toISOString(),
    };
    replies.push({
      status: 'approved',
      code: 'AB12',
      ops: [
        { id: 1, note: '자동차 할부 등록', op: { type: 'upsert', key: 'loans', items: [loan] } },
      ],
    });
    replies.push({ status: 'approved', code: 'AB12', ops: [] });
    const batch = await syncCloud();
    expect(read<Loan[]>(KEYS.loans)[0].remaining).toBe(22_327_811);
    expect(read<Account[]>(KEYS.accounts)[0].balance).toBe(1000 - 459_285);

    replies.push({ status: 'approved', code: 'AB12', ops: [] });
    batch?.undo();
    expect(read<Account[]>(KEYS.accounts)[0].balance).toBe(1000);
  });
});
