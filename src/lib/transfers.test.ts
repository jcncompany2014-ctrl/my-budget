import { describe, expect, it } from 'vitest';
import { buildTransferLegs } from './transfers';
import type { Account } from './types';

const personalBank: Account = {
  id: 'p-bank',
  name: '주거래',
  bank: '토스뱅크',
  type: 'bank',
  balance: 1_000_000,
  color: '#00B956',
  scope: 'personal',
};

const personalSavings: Account = {
  ...personalBank,
  id: 'p-savings',
  name: '저축',
};

const businessBank: Account = {
  id: 'b-bank',
  name: '사업통장',
  bank: '국민은행',
  type: 'bank',
  balance: 5_000_000,
  color: '#3182F6',
  scope: 'business',
};

describe('buildTransferLegs', () => {
  it('always emits exactly two legs sharing a transferPairId', () => {
    const legs = buildTransferLegs({
      fromAcc: personalBank,
      toAcc: personalSavings,
      amount: 100_000,
      date: '2026-04-30T09:00:00.000Z',
    });
    expect(legs).toHaveLength(2);
    expect(legs[0].transferPairId).toBeTruthy();
    expect(legs[0].transferPairId).toBe(legs[1].transferPairId);
  });

  it('signs the from leg negative and the to leg positive', () => {
    const legs = buildTransferLegs({
      fromAcc: personalBank,
      toAcc: personalSavings,
      amount: 100_000,
      date: '2026-04-30T09:00:00.000Z',
    });
    expect(legs[0].amount).toBe(-100_000);
    expect(legs[1].amount).toBe(100_000);
  });

  it('uses negative |amount| even when caller passes a negative number', () => {
    const legs = buildTransferLegs({
      fromAcc: personalBank,
      toAcc: personalSavings,
      amount: -100_000,
      date: '2026-04-30T09:00:00.000Z',
    });
    expect(legs[0].amount).toBe(-100_000);
    expect(legs[1].amount).toBe(100_000);
  });

  it('flags cross-mode when from and to scopes differ', () => {
    const legs = buildTransferLegs({
      fromAcc: businessBank,
      toAcc: personalBank,
      amount: 1_000_000,
      date: '2026-04-30T09:00:00.000Z',
    });
    expect(legs[0].transferCrossMode).toBe(true);
    expect(legs[1].transferCrossMode).toBe(true);
    // business → personal: from = biz_owner_draw, to = owner_pay
    expect(legs[0].cat).toBe('biz_owner_draw');
    expect(legs[1].cat).toBe('owner_pay');
  });

  it('uses plain transfer cats when both legs are same-scope', () => {
    const legs = buildTransferLegs({
      fromAcc: personalBank,
      toAcc: personalSavings,
      amount: 50_000,
      date: '2026-04-30T09:00:00.000Z',
    });
    expect(legs[0].transferCrossMode).toBe(false);
    expect(legs[0].cat).toBe('transfer');
    expect(legs[1].cat).toBe('transfer');
  });

  it('keeps the legs anchored to their respective accounts', () => {
    const legs = buildTransferLegs({
      fromAcc: personalBank,
      toAcc: personalSavings,
      amount: 100_000,
      date: '2026-04-30T09:00:00.000Z',
    });
    expect(legs[0].acc).toBe(personalBank.id);
    expect(legs[1].acc).toBe(personalSavings.id);
    expect(legs[0].transferTo).toBe(personalSavings.id);
    expect(legs[1].transferTo).toBe(personalBank.id);
  });
});
