import { describe, expect, it } from 'vitest';
import { type CardNotice, noticeSummary, parseCardNotification } from './card-notification';

const NOW = new Date(2026, 10, 8, 15, 0); // 2026-11-08 15:00 local

function parse(text: string, now = NOW): CardNotice {
  const r = parseCardNotification(text, now);
  if (!r.ok) throw new Error(`expected a transaction, got ${r.reason}: ${text}`);
  return r.notice;
}

describe('parseCardNotification — card SMS formats', () => {
  it('신한 single line with running total', () => {
    const n = parse(
      '[Web발신]\n신한카드(1234)승인 홍*동 12,500원(일시불)11/08 14:23 GS25 역삼점 누적1,234,567원',
    );
    expect(n).toMatchObject({
      kind: 'approval',
      amount: 12_500,
      currency: 'KRW',
      merchant: 'GS25 역삼점',
      issuer: '신한카드',
      last4: '1234',
      installment: undefined,
      overseas: false,
    });
    expect(n.date).toEqual(new Date(2026, 10, 8, 14, 23));
  });

  it('KB국민 multi-line', () => {
    const n = parse(
      '[Web발신]\nKB국민카드1234승인\n홍*동님\n12,500원 일시불\n11/08 14:23\nGS25역삼점\n누적1,234,567원',
    );
    expect(n).toMatchObject({
      amount: 12_500,
      merchant: 'GS25역삼점',
      issuer: 'KB국민카드',
      last4: '1234',
    });
  });

  it('삼성 with digits glued to the name', () => {
    const n = parse(
      '[Web발신]\n삼성1234승인 홍*동\n12,500원 일시불\n11/08 14:23 GS25역삼점\n누적1,234,567원',
    );
    expect(n).toMatchObject({ merchant: 'GS25역삼점', issuer: '삼성카드', last4: '1234' });
  });

  it('현대 with a product name line before the timestamp', () => {
    const n = parse(
      '[Web발신]\n현대카드 ZERO 승인\n홍*동\n12,500원 일시불\n11/08 14:23\nGS25역삼점\n누적1,234,567원',
    );
    expect(n).toMatchObject({ merchant: 'GS25역삼점', issuer: '현대카드' });
  });

  it('롯데 masked digits, 우리/하나/BC parenthesized digits', () => {
    expect(
      parse('[Web발신]\n롯데카드 2*3* 승인 홍*동님 12,500원 일시불 11/08 14:23 GS25역삼점'),
    ).toMatchObject({ issuer: '롯데카드', last4: '2*3*', merchant: 'GS25역삼점' });
    expect(
      parse('[Web발신]\n우리(1234)승인\n홍*동님\n8,900원 일시불\n11/08 09:01\n스타벅스 강남R점'),
    ).toMatchObject({
      issuer: '우리카드',
      last4: '1234',
      amount: 8_900,
      merchant: '스타벅스 강남R점',
    });
    expect(
      parse('[Web발신]\n하나(1*2*)승인 홍*동님 12,500원 일시불 11/08 14:23 GS25역삼점'),
    ).toMatchObject({ issuer: '하나카드', last4: '1*2*' });
    expect(
      parse('[Web발신]\nBC(1234)승인 홍*동 12,500원 일시불 11/08 14:23 GS25역삼점'),
    ).toMatchObject({ issuer: 'BC카드', last4: '1234', merchant: 'GS25역삼점' });
  });

  it('NH 총누적 and 신한 체크 with holder(digits)', () => {
    expect(
      parse(
        '[Web발신]\nNH카드1*2*승인\n홍*동\n12,500원 일시불\n11/08 14:23\nGS25역삼점\n총누적1,234,567원',
      ),
    ).toMatchObject({
      issuer: 'NH농협카드',
      last4: '1*2*',
      merchant: 'GS25역삼점',
      amount: 12_500,
    });
    expect(
      parse('[Web발신]\n신한체크승인 홍*동(1234) 12,500원 11/08 14:23 GS25역삼점 잔액123,456원'),
    ).toMatchObject({ issuer: '신한카드', last4: '1234', merchant: 'GS25역삼점', amount: 12_500 });
  });

  it('does not mistake merchants that start with an issuer word', () => {
    expect(
      parse('[Web발신]\n신한카드(1234)승인 홍*동 32,000원 일시불 11/08 10:12 삼성서울병원'),
    ).toMatchObject({ issuer: '신한카드', merchant: '삼성서울병원' });
    expect(
      parse(
        '[Web발신]\n현대카드 승인\n홍*동\n89,000원 일시불\n11/08 14:23\n현대백화점 본점\n누적1,234,567원',
      ),
    ).toMatchObject({ issuer: '현대카드', merchant: '현대백화점 본점', amount: 89_000 });
  });

  it('keeps pay-app / PG names when they are the merchant of a card charge', () => {
    expect(
      parse('[Web발신]\n신한카드(1234)승인 홍*동 12,500원 일시불 11/08 14:23 네이버페이'),
    ).toMatchObject({ issuer: '신한카드', merchant: '네이버페이' });
    expect(
      parse('[Web발신]\n삼성1234승인 홍*동\n30,000원 일시불\n11/08 14:23 토스페이먼츠'),
    ).toMatchObject({ issuer: '삼성카드', merchant: '토스페이먼츠' });
    expect(
      parse('[Web발신]\n신한카드(1234)승인 홍*동 59,000원 일시불 11/08 14:23 KCP*무신사'),
    ).toMatchObject({ merchant: 'KCP*무신사' });
    // A pay-app title in front of a card SMS body is dropped, not used as merchant.
    expect(
      parse('KB Pay\nKB국민카드1234승인 홍*동님 12,500원 일시불 11/08 14:23 GS25역삼점'),
    ).toMatchObject({ issuer: 'KB국민카드', merchant: 'GS25역삼점' });
  });

  it('reads installments', () => {
    const n = parse(
      '[Web발신]\n삼성1234승인 홍*동\n1,200,000원 3개월\n11/08 14:23 하이마트\n누적2,434,567원',
    );
    expect(n).toMatchObject({ amount: 1_200_000, installment: 3, merchant: '하이마트' });
  });

  it('bank-style alert without 원', () => {
    const n = parse(
      '[Web발신]\n[신한] 11/08 14:23 110-***-123456 출금 12,500 잔액 1,234,567 GS25역삼',
    );
    expect(n).toMatchObject({ amount: 12_500, merchant: 'GS25역삼', issuer: undefined });
  });
});

describe('parseCardNotification — push / pay-app formats', () => {
  it('카카오뱅크 체크카드', () => {
    const n = parse('카카오뱅크\n체크카드 승인 12,500원 GS25역삼점 잔액 123,456원');
    expect(n).toMatchObject({ issuer: '카카오뱅크', amount: 12_500, merchant: 'GS25역삼점' });
    expect(n.date).toBeUndefined();
  });

  it('토스 sentence, even with a promo footer', () => {
    expect(parse('GS25 역삼점에서 12,500원 결제했어요')).toMatchObject({ merchant: 'GS25 역삼점' });
    expect(parse('GS25 역삼점에서 12,500원 결제했어요\n이번 달 혜택 확인하기')).toMatchObject({
      merchant: 'GS25 역삼점',
      amount: 12_500,
    });
  });

  it('네이버페이 / 카카오페이 separators', () => {
    expect(parse('네이버페이 12,500원 결제 완료 - 무신사')).toMatchObject({
      issuer: '네이버페이',
      merchant: '무신사',
    });
    expect(parse('카카오페이\n결제 완료 12,500원 | GS25 역삼점')).toMatchObject({
      issuer: '카카오페이',
      merchant: 'GS25 역삼점',
    });
  });

  it('Apple Pay transaction automation text', () => {
    expect(parse('현대카드\n₩12,500\nGS25 역삼점')).toMatchObject({
      issuer: '현대카드',
      amount: 12_500,
      merchant: 'GS25 역삼점',
    });
  });
});

describe('parseCardNotification — foreign, cancel, rejects', () => {
  it('overseas charge in USD only', () => {
    const n = parse('[Web발신]\n신한카드(1234)해외승인 홍*동 USD 12.50 11/08 14:23 AMAZON.COM');
    expect(n).toMatchObject({
      amount: 12.5,
      currency: 'USD',
      merchant: 'AMAZON.COM',
      overseas: true,
    });
  });

  it('overseas charge that also shows won', () => {
    const n = parse(
      '[Web발신]\nKB국민카드1234 해외승인 홍*동님 USD 12.50 (17,320원) 11/08 14:23 AMAZON',
    );
    expect(n).toMatchObject({
      amount: 17_320,
      currency: 'KRW',
      fx: { amount: 12.5, currency: 'USD' },
      merchant: 'AMAZON',
      overseas: true,
    });
  });

  it('cancellation', () => {
    const n = parse(
      '[Web발신]\n신한카드(1234)승인취소 홍*동 12,500원(일시불)11/08 14:30 GS25 역삼점',
    );
    expect(n).toMatchObject({ kind: 'cancel', amount: 12_500, merchant: 'GS25 역삼점' });
  });

  it('rejects declines, ads, statements, transfers and chatter', () => {
    const reason = (t: string) => {
      const r = parseCardNotification(t, NOW);
      return r.ok ? 'ok' : r.reason;
    };
    expect(reason('[Web발신]\n신한카드(1234)승인거절 홍*동 12,500원 잔액부족 GS25역삼점')).toBe(
      'declined',
    );
    expect(reason('(광고)[신한카드] 11월 혜택 안내 최대 10,000원 할인')).toBe('not-transaction');
    expect(reason('[KB국민카드] 홍*동님 12월 결제예정금액 1,234,567원')).toBe('not-transaction');
    expect(reason('[현대카드] 홍*동님 10월 이용금액 1,234,567원')).toBe('not-transaction');
    expect(reason('홍길동님에게 50,000원을 보냈어요')).toBe('not-transaction');
    expect(reason('[신한카드] 홍*동님, 오늘 하루도 좋은 하루 보내세요')).toBe('no-amount');
  });
});

describe('parseCardNotification — dates', () => {
  it('rolls "12/31" back a year when read on New Year', () => {
    const n = parse(
      '신한카드(1234)승인 홍*동 12,500원(일시불)12/31 23:50 GS25 역삼점',
      new Date(2027, 0, 1, 0, 5),
    );
    expect(n.date).toEqual(new Date(2026, 11, 31, 23, 50));
  });

  it('time-only just after midnight means yesterday', () => {
    const n = parse('현대카드 승인 12,500원 23:58 GS25역삼점', new Date(2026, 10, 9, 0, 5));
    expect(n.date).toEqual(new Date(2026, 10, 8, 23, 58));
    expect(n.merchant).toBe('GS25역삼점');
  });
});

describe('noticeSummary', () => {
  it('formats won and foreign amounts', () => {
    expect(noticeSummary(parse('GS25 역삼점에서 12,500원 결제했어요'))).toBe(
      '12,500원 · GS25 역삼점',
    );
    expect(
      noticeSummary(
        parse('[Web발신]\n신한카드(1234)해외승인 홍*동 USD 12.50 11/08 14:23 AMAZON.COM'),
      ),
    ).toBe('USD 12.50 · AMAZON.COM');
  });
});

describe('amount vs. a name that starts with a unit', () => {
  const now = new Date(2026, 10, 8, 14, 24);
  const ok = (text: string) => {
    const r = parseCardNotification(text, now);
    if (!r.ok) throw new Error(`not parsed: ${r.reason}`);
    return r.notice;
  };

  it('minutes before "원할머니보쌈" are not the amount', () => {
    const n = ok('[Web발신]\n신한카드(1234)승인 홍*동 32,000원(일시불)11/08 14:23 원할머니보쌈');
    expect(n).toMatchObject({ amount: 32_000, currency: 'KRW', merchant: '원할머니보쌈' });
  });

  it('"엔제리너스" after the time is a shop, not yen', () => {
    const n = ok('[Web발신]\n신한카드(1234)승인 홍*동 4,500원(일시불)11/08 14:23 엔제리너스');
    expect(n).toMatchObject({ amount: 4_500, currency: 'KRW', merchant: '엔제리너스' });
    expect(n.fx).toBeUndefined();
    expect(n.overseas).toBe(false);
  });

  it('a particle glued to the unit is still an amount', () => {
    expect(ok('스타벅스에서 5,600원을 결제했어요')).toMatchObject({ amount: 5_600 });
    expect(ok('해외승인 신한카드(1234) 1,200엔 11/08 14:23 LAWSON')).toMatchObject({
      amount: 1_200,
      currency: 'JPY',
    });
  });
});
