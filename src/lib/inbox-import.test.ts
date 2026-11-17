import { describe, expect, it } from 'vitest';
import {
  cardPatch,
  type ImportContext,
  type InboxItem,
  planImport,
  sameCard,
} from './inbox-import';
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

describe('planImport — a ledger with one credit card', () => {
  const one: Account[] = [
    accounts[0],
    {
      id: 'amex',
      name: '아멕스카드',
      bank: '현대카드',
      type: 'card',
      balance: 0,
      color: '#000',
      scope: 'personal',
    },
  ];
  const at = (s: number) => new Date(2026, 10, 8, 14, 23, s);

  it('a wallet or pay-app notice that names no card goes on that card', () => {
    const plan = planImport(
      [item('Apple Pay\nSTARBUCKS\n₩5,600', at(5)), item('GS25에서 3,000원 결제했어요', at(50))],
      ctx({ accounts: one }),
    );
    expect(plan.add.map((t) => t.acc)).toEqual(['amex', 'amex']);
  });

  it('the issuer’s own notice matches it by name and collapses with the wallet notice', () => {
    const plan = planImport(
      [
        item('Apple Pay\nSTARBUCKS\n₩5,600', at(5)),
        item('[Web발신]\n현대카드 승인 홍*동 5,600원 일시불 11/08 14:23 스타벅스코리아', at(20)),
      ],
      ctx({ accounts: one }),
    );
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0].acc).toBe('amex');
  });

  it('a bank’s own notice still lands on the main account', () => {
    const plan = planImport(
      [item('카카오뱅크 체크카드 4,500원 결제 이디야', at(5))],
      ctx({ accounts: one }),
    );
    expect(plan.add[0].acc).toBe('main');
  });
});

describe('planImport — cards link themselves', () => {
  const acc = (over: Partial<Account>): Account => ({
    id: 'x',
    name: 'x',
    bank: '',
    type: 'bank',
    balance: 0,
    color: '#000',
    scope: 'personal',
    ...over,
  });
  const main = acc({ id: 'main', name: '국민은행', bank: 'KB국민은행', main: true });
  const blank = acc({ id: 'card', name: '신용카드', type: 'card' });
  const HYUNDAI = '[Web발신]\n현대카드(5678)승인 홍*동 12,500원 일시불 11/08 14:23 스타벅스';
  const at = (m: number) => new Date(2026, 10, 8, 14, m);

  it('the one blank card account takes the first card that shows up, and remembers it', () => {
    const plan = planImport([item(HYUNDAI, at(24))], ctx({ accounts: [main, blank], history: [] }));
    expect(plan.add[0].acc).toBe('card');
    expect(plan.learn).toEqual([
      {
        id: 'card',
        patch: { cards: [{ issuer: '현대카드', last4: '5678' }], last4: '5678', bank: '현대카드' },
      },
    ]);
    expect(plan.log[0].card).toBeUndefined();
  });

  it('what one notice taught, the next in the batch already knows', () => {
    const plan = planImport(
      [
        item(HYUNDAI, at(24)),
        item('[Web발신]\n현대카드(5678)승인 홍*동 3,000원 일시불 11/08 14:40 GS25', at(41)),
      ],
      ctx({ accounts: [main, blank], history: [] }),
    );
    expect(plan.add.map((t) => t.acc)).toEqual(['card', 'card']);
    expect(plan.learn).toHaveLength(1);
  });

  it('a learned card matches whatever the account is called', () => {
    const amex = acc({
      id: 'amex',
      name: '아멕스카드',
      type: 'card',
      cards: [{ issuer: '현대카드', last4: '5678' }],
    });
    const other = acc({ id: 'lotte', name: '롯데카드', bank: '롯데카드', type: 'card' });
    const plan = planImport(
      [
        item(HYUNDAI, at(24)),
        // The push for the same card prints no digits.
        item('현대카드 승인 홍*동 7,000원 일시불 11/08 15:10 이디야', at(71)),
      ],
      ctx({ accounts: [main, amex, other], history: [] }),
    );
    expect(plan.add.map((t) => t.acc)).toEqual(['amex', 'amex']);
    expect(plan.learn).toEqual([]);
    expect(plan.log.every((l) => l.card === undefined)).toBe(true);
  });

  it('a card nothing answers to is recorded on the best guess and asked about once', () => {
    const lotte = acc({
      id: 'lotte',
      name: '롯데카드',
      bank: '롯데카드',
      type: 'card',
      last4: '1111',
    });
    const samsung = acc({
      id: 'ss',
      name: '삼성카드',
      bank: '삼성카드',
      type: 'card',
      last4: '2222',
    });
    const plan = planImport(
      [item(HYUNDAI, at(24))],
      ctx({ accounts: [main, lotte, samsung], history: [] }),
    );
    expect(plan.add[0].acc).toBe('main');
    expect(plan.learn).toEqual([]);
    expect(plan.log[0].card).toEqual({ issuer: '현대카드', last4: '5678' });
  });

  it('a credit card of a bank I only hold an account at is asked about; its 체크 card is not', () => {
    const credit = planImport(
      [item('KB국민카드(9012)승인 홍*동 12,500원 일시불 11/08 14:23 스타벅스', at(24))],
      ctx({ accounts: [main], history: [] }),
    );
    expect(credit.add[0].acc).toBe('main');
    expect(credit.log[0].card).toEqual({ issuer: 'KB국민카드', last4: '9012' });

    const debit = planImport(
      [item('KB국민체크(9012)승인 홍*동 12,500원 11/08 14:23 스타벅스', at(24))],
      ctx({ accounts: [main], history: [] }),
    );
    expect(debit.add[0].acc).toBe('main');
    expect(debit.log[0].card).toBeUndefined();
    expect(debit.learn).toEqual([{ id: 'main', patch: { last4: '9012' } }]);
  });

  it('never books a card payment on a brokerage account that shares the bank name', () => {
    const broker = acc({ id: 'kbsec', name: 'KB증권', bank: 'KB증권', type: 'investment' });
    const plan = planImport(
      [item('KB국민체크(9012)승인 홍*동 12,500원 11/08 14:23 스타벅스', at(24))],
      ctx({ accounts: [broker, main], history: [] }),
    );
    expect(plan.add[0].acc).toBe('main');
  });

  it('a pay app names no card, so there is nothing to ask', () => {
    const lotte = acc({
      id: 'lotte',
      name: '롯데카드',
      bank: '롯데카드',
      type: 'card',
      last4: '1111',
    });
    const samsung = acc({
      id: 'ss',
      name: '삼성카드',
      bank: '삼성카드',
      type: 'card',
      last4: '2222',
    });
    const plan = planImport(
      [item('네이버페이\n스타벅스에서 5,600원 결제했어요', at(24))],
      ctx({ accounts: [main, lotte, samsung], history: [] }),
    );
    expect(plan.add[0].acc).toBe('main');
    expect(plan.log[0].card).toBeUndefined();
  });

  it('a 체크 card does not claim the blank credit card', () => {
    const plan = planImport(
      [item('신한체크(3333)승인 홍*동 4,500원 11/08 14:23 이디야', at(24))],
      ctx({ accounts: [main, blank], history: [] }),
    );
    expect(plan.learn).toEqual([]);
    expect(plan.log[0].card).toEqual({ issuer: '신한카드', last4: '3333' });
  });

  it('files what is not a payment as skipped, with the reason', () => {
    const plan = planImport(
      [
        item('[KB]11/08 14:23 123***456 입금 500,000 잔액 3,613,881 홍길동', at(24)),
        item('[현대카드] 홍*동님 10월 이용금액 1,234,567원', at(25)),
        item('[신한카드] 홍*동님 승인 내역을 확인해 주세요', at(26)),
      ],
      ctx({ accounts: [main], history: [] }),
    );
    expect(plan.add).toEqual([]);
    expect(plan.log.map((l) => [l.status, l.reason])).toEqual([
      ['skipped', 'transfer'],
      ['skipped', 'notice'],
      ['unparsed', 'no-amount'],
    ]);
  });
});

describe('sameCard / cardPatch', () => {
  it('compares issuer and digits, masked positions matching anything', () => {
    const hyundai = { issuer: '현대카드', last4: '5678' };
    expect(sameCard(hyundai, { issuer: '현대카드', last4: '5678' })).toBe(true);
    expect(
      sameCard({ issuer: 'NH농협카드', last4: '1*3*' }, { issuer: 'NH농협카드', last4: '1234' }),
    ).toBe(true);
    expect(sameCard(hyundai, { issuer: '삼성카드', last4: '5678' })).toBe(false);
    expect(sameCard({ issuer: '현대카드' }, hyundai)).toBe(false);
  });

  it('adds the card once and fills only what the account lacks', () => {
    const a: Account = {
      id: 'c',
      name: '아멕스카드',
      bank: '아멕스',
      type: 'card',
      balance: 0,
      color: '#000',
      scope: 'personal',
      last4: '0001',
    };
    const card = { issuer: '현대카드', last4: '5678' };
    expect(cardPatch(a, card)).toEqual({ cards: [card] });
    expect(cardPatch({ ...a, cards: [card] }, card)).toEqual({ cards: [card] });
  });
});

describe('planImport — a registered 정기결제', () => {
  const card: Account = {
    id: 'card',
    name: '현대카드',
    bank: '현대카드',
    type: 'card',
    balance: 0,
    color: '#000',
    scope: 'personal',
    last4: '5678',
  };
  const posted: Transaction = {
    id: 'recur-2026-10-netflix',
    date: new Date(2026, 10, 8, 9).toISOString(),
    amount: -17_000,
    cat: 'subscription',
    merchant: '넷플릭스',
    acc: 'card',
    scope: 'personal',
    recurring: true,
  };
  const notice = (day: number) =>
    item(
      `[Web발신]\n현대카드(5678)승인 홍*동 17,000원 일시불 11/${String(day).padStart(2, '0')} 14:23 NETFLIX.COM`,
      new Date(2026, 10, day, 14, 24),
    );

  it('the card notice for a charge the app already posted is not recorded again', () => {
    const plan = planImport([notice(9)], ctx({ accounts: [card], history: [posted] }));
    expect(plan.add).toEqual([]);
    expect(plan.log[0]).toMatchObject({ status: 'duplicate', txId: posted.id });
  });

  it('only one notice is matched to it — a second charge of the same amount is recorded', () => {
    const plan = planImport([notice(9), notice(10)], ctx({ accounts: [card], history: [posted] }));
    expect(plan.add).toHaveLength(1);
    expect(plan.log.map((l) => l.status)).toEqual(['duplicate', 'added']);
  });

  it('a charge a week away is a different payment', () => {
    const plan = planImport([notice(16)], ctx({ accounts: [card], history: [posted] }));
    expect(plan.add).toHaveLength(1);
  });
});

describe('planImport — equal amounts are not the same charge', () => {
  const bank: Account = {
    id: 'bank',
    name: '국민은행',
    bank: 'KB국민은행',
    type: 'bank',
    balance: 0,
    color: '#000',
    scope: 'personal',
    main: true,
    last4: '9012',
  };
  const card: Account = {
    id: 'card',
    name: '현대카드',
    bank: '현대카드',
    type: 'card',
    balance: 0,
    color: '#000',
    scope: 'personal',
    last4: '5678',
  };
  const auto = (over: Partial<Transaction>): Transaction => ({
    id: 'recur-2026-10-x',
    date: new Date(2026, 10, 8, 9).toISOString(),
    amount: -50_000,
    cat: 'health',
    merchant: '헬스장',
    acc: 'card',
    scope: 'personal',
    recurring: true,
    ...over,
  });
  const charge = (text: string, day = 9) => item(text, new Date(2026, 10, day, 14, 24));

  it('a loan payment the app posted never swallows a card payment of the same size', () => {
    const loanRow = auto({
      id: 'loan-2026-10-l1',
      amount: -300_000,
      cat: 'loan_payment',
      merchant: '주택담보대출',
      acc: 'bank',
    });
    const plan = planImport(
      [charge('KB국민체크(9012)승인 홍*동 300,000원 11/09 14:23 이케아')],
      ctx({ accounts: [bank, card], history: [loanRow] }),
    );
    expect(plan.add).toHaveLength(1);
    expect(plan.add[0]).toMatchObject({ acc: 'bank', amount: -300_000, merchant: '이케아' });
  });

  it('the out leg of a 적금 정기결제 is a transfer, not a subscription a notice can match', () => {
    const leg = auto({ cat: 'saving', merchant: '적금', transferPairId: 'p1', acc: 'card' });
    const plan = planImport(
      [charge('[Web발신]\n현대카드(5678)승인 홍*동 50,000원 일시불 11/09 14:23 한우마을')],
      ctx({ accounts: [bank, card], history: [leg] }),
    );
    expect(plan.add).toHaveLength(1);
  });

  it('a subscription row answers only for a notice that agrees on what it was', () => {
    const gym = auto({});
    const other = planImport(
      [charge('[Web발신]\n현대카드(5678)승인 홍*동 50,000원 일시불 11/10 19:02 한우마을', 10)],
      ctx({ accounts: [bank, card], history: [gym] }),
    );
    expect(other.add).toHaveLength(1);

    const same = planImport(
      [
        charge(
          '[Web발신]\n현대카드(5678)승인 홍*동 50,000원 일시불 11/10 19:02 스포애니 헬스장',
          10,
        ),
      ],
      ctx({ accounts: [bank, card], history: [gym] }),
    );
    expect(same.add).toEqual([]);
    expect(same.log[0]).toMatchObject({ status: 'duplicate', txId: gym.id });
  });

  it('a row a notice was matched to long ago is still taken', () => {
    const gym = auto({});
    const plan = planImport(
      [
        charge(
          '[Web발신]\n현대카드(5678)승인 홍*동 50,000원 일시불 11/10 19:02 스포애니 헬스장',
          10,
        ),
      ],
      ctx({ accounts: [bank, card], history: [gym], log: [], claimed: [gym.id] }),
    );
    expect(plan.add).toHaveLength(1);
  });
});

describe('planImport — whose card it is, when it could be more than one', () => {
  const acc = (over: Partial<Account>): Account => ({
    id: 'x',
    name: 'x',
    bank: '',
    type: 'bank',
    balance: 0,
    color: '#000',
    scope: 'personal',
    ...over,
  });
  const main = acc({ id: 'main', name: '국민은행', bank: 'KB국민은행', main: true });
  const blank = acc({ id: 'card', name: '신용카드', type: 'card' });
  const HYUNDAI = '[Web발신]\n현대카드(5678)승인 홍*동 12,500원 일시불 11/08 14:23 스타벅스';
  const at = new Date(2026, 10, 8, 14, 24);

  it('a 체크 card goes to the bank account even when the issuer has a credit account here too', () => {
    const sb = acc({ id: 'sb', name: '신한은행', bank: '신한은행' });
    const sc = acc({ id: 'sc', name: '신한카드', bank: '신한카드', type: 'card' });
    const plan = planImport(
      [item('신한체크(3333)승인 홍*동 4,500원 11/08 14:23 GS25', at)],
      ctx({ accounts: [main, sc, sb], history: [] }),
    );
    expect(plan.add[0].acc).toBe('sb');
    expect(plan.learn).toEqual([{ id: 'sb', patch: { last4: '3333' } }]);
    expect(plan.log[0].card).toBeUndefined();
  });

  it('a 체크 card with only the issuer’s credit card on file is a guess, and asked about', () => {
    const sc = acc({ id: 'sc', name: '신한카드', bank: '신한카드', type: 'card' });
    const plan = planImport(
      [item('신한체크(3333)승인 홍*동 4,500원 11/08 14:23 GS25', at)],
      ctx({ accounts: [main, sc], history: [] }),
    );
    expect(plan.learn).toEqual([]);
    expect(plan.log[0].card).toEqual({ issuer: '신한카드', last4: '3333' });
  });

  it('"체크" inside a shop name does not turn a credit card into a 체크 card', () => {
    const plan = planImport(
      [item('KB국민카드(9012)승인 홍*동 120,000원 일시불 11/08 14:23 체크인제주호텔', at)],
      ctx({ accounts: [main], history: [] }),
    );
    expect(plan.learn).toEqual([]);
    expect(plan.log[0].card).toEqual({ issuer: 'KB국민카드', last4: '9012' });
  });

  it('two accounts of the issuer and digits neither knows: asked, nothing learned', () => {
    const a = acc({ id: 'a', name: '현대카드 M', bank: '현대카드', type: 'card', last4: '1111' });
    const b = acc({ id: 'b', name: '현대카드 X', bank: '현대카드', type: 'card', last4: '2222' });
    const plan = planImport([item(HYUNDAI, at)], ctx({ accounts: [main, a, b], history: [] }));
    expect(plan.learn).toEqual([]);
    expect(plan.log[0].card).toEqual({ issuer: '현대카드', last4: '5678' });
  });

  it('a card account whose name already says the issuer is not taken for a blank one', () => {
    const named = acc({ id: 'hd', name: '현대카드', type: 'card' });
    const plan = planImport(
      [item('[Web발신]\n삼성카드(4321)승인 홍*동 9,900원 일시불 11/08 14:23 다이소', at)],
      ctx({ accounts: [main, named], history: [] }),
    );
    expect(plan.learn).toEqual([]);
    expect(plan.log[0].card).toEqual({ issuer: '삼성카드', last4: '4321' });
  });

  it('once other cards exist, an unknown card is asked about instead of given to the blank one', () => {
    const lotte = acc({
      id: 'lt',
      name: '롯데카드',
      bank: '롯데카드',
      type: 'card',
      last4: '1111',
    });
    const plan = planImport(
      [item(HYUNDAI, at)],
      ctx({ accounts: [main, blank, lotte], history: [] }),
    );
    expect(plan.learn).toEqual([]);
    expect(plan.log[0].card).toEqual({ issuer: '현대카드', last4: '5678' });
  });

  it('a blank business card never adopts a personal card', () => {
    const biz = acc({ id: 'bc', name: '법인카드', type: 'card', scope: 'business' });
    const plan = planImport([item(HYUNDAI, at)], ctx({ accounts: [main, biz], history: [] }));
    expect(plan.add[0]).toMatchObject({ acc: 'main', scope: 'personal' });
    expect(plan.learn).toEqual([]);
    expect(plan.log[0].card).toEqual({ issuer: '현대카드', last4: '5678' });
  });

  it('an account saved without a bank field does not break the import', () => {
    const bare = { ...blank, bank: undefined } as unknown as Account;
    const plan = planImport([item(HYUNDAI, at)], ctx({ accounts: [main, bare], history: [] }));
    expect(plan.add[0].acc).toBe('card');
  });
});
