import { describe, expect, it } from 'vitest';
import { classifyBayes, tokenize, trainBayes } from './bayes';
import type { Transaction } from './types';

function tx(merchant: string, cat: string): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    merchant,
    cat,
    amount: -1000,
    acc: 'a1',
    date: new Date().toISOString(),
    scope: 'personal',
  };
}

describe('tokenize', () => {
  it('returns words plus character bigrams', () => {
    const tokens = tokenize('스타벅스');
    expect(tokens).toContain('스타벅스');
    expect(tokens).toContain('스타');
    expect(tokens).toContain('타벅');
    expect(tokens).toContain('벅스');
  });

  it('splits on whitespace and punctuation', () => {
    const tokens = tokenize('CGV 왕십리·12관');
    expect(tokens).toContain('cgv');
    expect(tokens).toContain('왕십리');
    expect(tokens).toContain('12관');
  });

  it('lowercases', () => {
    expect(tokenize('Starbucks')).toContain('starbucks');
  });

  it('returns [] for blank input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('trainBayes + classifyBayes', () => {
  const cafes = [
    tx('스타벅스 강남점', 'cafe'),
    tx('스타벅스 신촌점', 'cafe'),
    tx('투썸플레이스', 'cafe'),
    tx('메가커피 종로', 'cafe'),
    tx('이디야 합정', 'cafe'),
  ];
  const cinemas = [
    tx('CGV 왕십리', 'culture'),
    tx('CGV 강남', 'culture'),
    tx('롯데시네마 건대', 'culture'),
    tx('메가박스 코엑스', 'culture'),
  ];
  const food = [
    tx('교촌치킨 강남', 'food'),
    tx('맥도날드 신촌', 'food'),
    tx('서브웨이 종로', 'food'),
  ];

  const history = [...cafes, ...cinemas, ...food];

  it('classifies a known merchant correctly', () => {
    const m = trainBayes(history, 'personal');
    const r = classifyBayes('스타벅스 강남점', m);
    expect(r?.cat).toBe('cafe');
  });

  it('generalizes to an unseen branch via shared subword tokens', () => {
    const m = trainBayes(history, 'personal');
    // never seen this exact merchant — but the token "스타벅스" appears in
    // multiple cafe trainers
    const r = classifyBayes('스타벅스 종로점', m);
    expect(r?.cat).toBe('cafe');
  });

  it('returns null when input has no tokens', () => {
    const m = trainBayes(history, 'personal');
    expect(classifyBayes('', m)).toBeNull();
  });

  it('returns null on an empty model', () => {
    const m = trainBayes([], 'personal');
    expect(classifyBayes('스타벅스', m)).toBeNull();
  });

  it('respects validCats filter — never returns a forbidden category', () => {
    const m = trainBayes(history, 'personal');
    const onlyFood = new Set(['food']);
    const r = classifyBayes('스타벅스 종로점', m, onlyFood);
    expect(r?.cat).toBe('food');
  });

  it('separates scopes — business txs do not pollute personal model', () => {
    const mixed = [...cafes, { ...tx('스타벅스 사업장', 'biz_meal'), scope: 'business' as const }];
    const m = trainBayes(mixed, 'personal');
    const r = classifyBayes('스타벅스', m);
    expect(r?.cat).toBe('cafe');
    expect(r?.cat).not.toBe('biz_meal');
  });

  it('confidence is higher for clearly-categorized inputs vs ambiguous ones', () => {
    const m = trainBayes(history, 'personal');
    const clear = classifyBayes('스타벅스', m);
    const ambig = classifyBayes('어딘가의 가게', m);
    expect(clear?.confidence).toBeGreaterThan(ambig?.confidence ?? 0);
  });
});
