import { describe, expect, it } from 'vitest';
import { type ImportContext, type InboxItem, planImport } from './inbox-import';
import type { Account, Transaction } from './types';

const accounts: Account[] = [
  {
    id: 'main',
    name: '주거래',
    bank: '토스뱅크',
    type: 'bank',
    balance: 0,
    color: '#000',
    scope: 'personal',
    main: true,
  },
  {
    id: 'shinhan',
    name: '신한 Deep Dream',
    bank: '신한카드',
    type: 'card',
    balance: 0,
    color: '#000',
    scope: 'personal',
    last4: '1234',
  },
  {
    id: 'kb',
    name: 'KB 노리',
    bank: 'KB국민카드',
    type: 'card',
    balance: 0,
    color: '#000',
    scope: 'personal',
  },
];

const history: Transaction[] = [
  {
    id: 'h1',
    date: new Date(2026, 9, 1, 12).toISOString(),
    amount: -4_500,
    cat: 'cafe',
    merchant: 'GS25 역삼점',
    acc: 'main',
    scope: 'personal',
  },
];

function ctx(over: Partial<ImportContext> = {}): ImportContext {
  return {
    accounts,
    history,
    rules: [],
    customCategories: [],
    fxRate: () => null,
    ...over,
  };
}

let n = 0;
const item = (text: string, at = new Date(2026, 10, 8, 14, 24)): InboxItem => ({
  id: `t${n++}-0000abcd`,
  text,
  at: at.toISOString(),
});

const SHINHAN =
  '[Web발신]\n신한카드(1234)승인 홍*동 12,500원(일시불)11/08 14:23 GS25 역삼점 누적1,234,567원';

describe('planImport', () => {
  it('records an approval on the card with matching digits, category learned from history', () => {
    const plan = planImport([item(SHINHAN)], ctx());
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0]).toMatchObject({
      amount: -12_500,
      merchant: 'GS25 역삼점',
      acc: 'shinhan',
      cat: 'cafe',
      scope: 'personal',
      source: 'notification',
      date: new Date(2026, 10, 8, 14, 23).toISOString(),
    });
    expect(plan.log[0]).toMatchObject({ status: 'added', txId: plan.add[0].id });
  });

  it('falls back to the issuer name, then the main account', () => {
    const kb = planImport(
      [item('KB국민카드5678승인 홍*동님 8,000원 일시불 11/08 14:20 김밥천국')],
      ctx(),
    );
    expect(kb.add[0].acc).toBe('kb');
    expect(kb.add[0].cat).toBe('food');
    const toss = planImport([item('GS25 역삼점에서 3,000원 결제했어요')], ctx());
    expect(toss.add[0].acc).toBe('main');
  });

  it('a user rule beats history', () => {
    const plan = planImport(
      [item(SHINHAN)],
      ctx({ rules: [{ id: 'r', match: 'gs25', cat: 'living' }] }),
    );
    expect(plan.add[0].cat).toBe('living');
  });

  it('skips a charge already entered by hand around the same time', () => {
    const manual: Transaction = {
      id: 'manual',
      date: new Date(2026, 10, 8, 14, 30).toISOString(),
      amount: -12_500,
      cat: 'living',
      merchant: '편의점',
      acc: 'main',
      scope: 'personal',
    };
    const plan = planImport([item(SHINHAN)], ctx({ history: [...history, manual] }));
    expect(plan.add).toHaveLength(0);
    expect(plan.log[0]).toMatchObject({ status: 'duplicate', txId: 'manual' });
  });

  it('collapses the SMS and the push for the same charge', () => {
    const plan = planImport(
      [
        item(SHINHAN),
        item('신한 SOL페이\n12,500원 결제 완료 | GS25 역삼점', new Date(2026, 10, 8, 14, 24, 30)),
      ],
      ctx(),
    );
    expect(plan.add).toHaveLength(1);
    expect(plan.log.map((l) => l.status)).toEqual(['added', 'duplicate']);
  });

  it('승인취소 removes the earlier charge — from history or from the same batch', () => {
    const earlier: Transaction = {
      id: 'ntf-old',
      date: new Date(2026, 10, 7, 18).toISOString(),
      amount: -12_500,
      cat: 'cafe',
      merchant: 'GS25 역삼점',
      acc: 'shinhan',
      scope: 'personal',
      source: 'notification',
    };
    const cancel =
      '[Web발신]\n신한카드(1234)승인취소 홍*동 12,500원(일시불)11/08 14:30 GS25 역삼점';
    const fromHistory = planImport([item(cancel)], ctx({ history: [...history, earlier] }));
    expect(fromHistory.remove).toEqual(['ntf-old']);
    expect(fromHistory.log[0]).toMatchObject({ status: 'cancelled', txId: 'ntf-old' });
    expect(fromHistory.log[0].removed?.[0].id).toBe('ntf-old');

    const sameBatch = planImport([item(SHINHAN), item(cancel)], ctx());
    expect(sameBatch.add).toHaveLength(0);
    expect(sameBatch.remove).toEqual([]);
    expect(sameBatch.log.map((l) => l.status)).toEqual(['added', 'cancelled']);
  });

  it('a cancellation with nothing to match becomes a refund', () => {
    const plan = planImport(
      [item('[Web발신]\n신한카드(1234)승인취소 홍*동 30,000원 11/08 14:30 무신사')],
      ctx(),
    );
    expect(plan.add[0]).toMatchObject({ amount: 30_000, cat: 'refund', memo: '승인취소' });
    expect(plan.log[0].status).toBe('refund');
  });

  it('converts foreign charges with live FX, or marks the estimate', () => {
    const usd = '[Web발신]\n신한카드(1234)해외승인 홍*동 USD 12.50 11/08 14:23 AMAZON.COM';
    const live = planImport([item(usd)], ctx({ fxRate: (c) => (c === 'USD' ? 1380 : null) }));
    expect(live.add[0]).toMatchObject({
      amount: -17_250,
      fxAmount: 12.5,
      fxCurrency: 'USD',
      memo: 'USD 12.50',
    });
    const est = planImport([item(usd)], ctx());
    expect(est.add[0].memo).toBe('USD 12.50 (환율 추정)');
  });

  it('logs what it could not read', () => {
    const plan = planImport([item('[신한카드] 승인 내역을 확인하세요')], ctx());
    expect(plan.add).toHaveLength(0);
    expect(plan.log[0].status).toBe('unparsed');
  });
});

describe('planImport — one payment, several notices', () => {
  const at = (s: number) => new Date(2026, 10, 8, 14, 23, s);

  it('the card SMS, the pay app and the wallet naming the shop differently are one charge', () => {
    const plan = planImport(
      [
        item('스타벅스에서 5,600원 결제했어요', at(5)),
        item(
          '[Web발신]\n신한카드(1234)승인 홍*동 5,600원(일시불)11/08 14:23 스타벅스코리아',
          at(20),
        ),
        item('Apple Pay\nSTARBUCKS\n₩5,600', at(40)),
      ],
      ctx(),
    );
    expect(plan.add).toHaveLength(1);
    expect(plan.log.map((l) => l.status)).toEqual(['added', 'duplicate', 'duplicate']);
  });

  it('moves the row to the card once a later notice names it', () => {
    const plan = planImport(
      [
        item('스타벅스에서 5,600원 결제했어요', at(5)),
        item(
          '[Web발신]\n신한카드(1234)승인 홍*동 5,600원(일시불)11/08 14:23 스타벅스코리아',
          at(20),
        ),
      ],
      ctx(),
    );
    expect(plan.add).toHaveLength(1);
    // First landed on the main account (no card named), then moved to the 신한 card.
    expect(plan.add[0]).toMatchObject({ acc: 'shinhan', merchant: '스타벅스', amount: -5_600 });
    expect(plan.remove).toHaveLength(0);
  });

  it('moves a row that an earlier sync already saved', () => {
    const saved: Transaction = {
      id: 'ntf-first',
      date: at(5).toISOString(),
      amount: -5_600,
      cat: 'cafe',
      merchant: '스타벅스',
      acc: 'main',
      scope: 'personal',
      source: 'notification',
    };
    const plan = planImport(
      [
        item(
          '[Web발신]\n신한카드(1234)승인 홍*동 5,600원(일시불)11/08 14:23 스타벅스코리아',
          at(50),
        ),
      ],
      ctx({ history: [...history, saved] }),
    );
    expect(plan.remove).toEqual(['ntf-first']);
    expect(plan.add).toEqual([{ ...saved, acc: 'shinhan' }]);
    expect(plan.log[0].status).toBe('duplicate');
  });

  it('the same amount ten minutes later at another shop is a new charge', () => {
    const plan = planImport(
      [
        item('스타벅스에서 5,600원 결제했어요', at(5)),
        item('이디야에서 5,600원 결제했어요', new Date(2026, 10, 8, 14, 35)),
      ],
      ctx(),
    );
    expect(plan.add).toHaveLength(2);
  });

  it('a second 승인취소 notice does not refund twice', () => {
    const cancelSms =
      '[Web발신]\n신한카드(1234)승인취소 홍*동 12,500원(일시불)11/08 14:30 GS25 역삼점';
    const cancelPush = 'GS25에서 12,500원 결제가 취소됐어요';
    const sameBatch = planImport(
      [
        item(SHINHAN),
        item(cancelSms, new Date(2026, 10, 8, 14, 30, 10)),
        item(cancelPush, new Date(2026, 10, 8, 14, 30, 40)),
      ],
      ctx(),
    );
    expect(sameBatch.add).toHaveLength(0);
    expect(sameBatch.log.map((l) => l.status)).toEqual(['added', 'cancelled', 'duplicate']);

    // The first notice was handled by an earlier sync; only the log remembers it.
    const first = planImport([item(cancelSms, new Date(2026, 10, 8, 14, 30, 10))], ctx());
    const later = planImport(
      [item(cancelPush, new Date(2026, 10, 8, 14, 30, 40))],
      ctx({ log: first.log }),
    );
    expect(later.add).toHaveLength(0);
    expect(later.log[0].status).toBe('duplicate');
  });

  it('a currency with no rate is left for review instead of saved as 0원', () => {
    const plan = planImport(
      [item('해외승인 신한카드(1234) BRL 120.00 11/08 14:23 PADARIA')],
      ctx(),
    );
    expect(plan.add).toHaveLength(0);
    expect(plan.log[0].status).toBe('unparsed');
  });
});
