import { describe, expect, it } from 'vitest';
import { BRAND_GLYPHS } from '@/components/icons/brand-glyphs';
import { BRANDS, findBrand } from './brands';

const id = (merchant: string) => findBrand(merchant)?.id ?? null;

describe('findBrand', () => {
  it('recognizes store names and the operating companies on card statements', () => {
    expect(id('GS25 역삼점')).toBe('gs25');
    expect(id('CU 강남점')).toBe('cu');
    expect(id('cu역삼점')).toBe('cu');
    expect(id('(주)비지에프리테일')).toBe('cu');
    expect(id('스타벅스커피 코리아')).toBe('starbucks');
    expect(id('우아한형제들')).toBe('baemin');
    expect(id('맥도날드 역삼DT')).toBe('mcdonalds');
    expect(id('H&M 명동')).toBe('handm');
    expect(id('NETFLIX.COM')).toBe('netflix');
    expect(id('네이버페이')).toBe('naver');
    expect(id('STEAMGAMES.COM 4259522985')).toBe('steam');
    expect(id('KTX 서울-부산')).toBe('korail');
  });

  it('prefers the specific brand over the generic one', () => {
    expect(id('이마트24 선릉점')).toBe('emart24');
    expect(id('이마트 성수점')).toBe('emart');
    expect(id('쿠팡이츠')).toBe('coupangeats');
    expect(id('쿠팡플레이')).toBe('coupangplay');
    expect(id('쿠팡(주)')).toBe('coupang');
    expect(id('GOOGLE*YOUTUBE PREMIUM')).toBe('youtube');
    expect(id('GOOGLE PLAY')).toBe('google');
    expect(id('카카오페이')).toBe('kakaopay');
    expect(id('카카오T 블루')).toBe('kakaot');
    expect(id('KAKAOTALK 이모티콘')).toBe('kakao');
    expect(id('롯데리아 역삼점')).toBe('lotteria');
    expect(id('롯데시네마 월드타워')).toBe('lottecinema');
  });

  it('does not fire inside unrelated words', () => {
    expect(id('SECURITY SERVICE')).toBeNull(); // "cu"
    expect(id('이삭토스트 역삼점')).toBeNull(); // "토스"
    expect(id('애플망고빙수')).toBeNull(); // "애플"
    expect(id('PINEAPPLE HOUSE')).toBeNull(); // "apple"
    expect(id('멜론빙수')).toBeNull(); // "멜론"
    expect(id('자라섬캠핑장')).toBeNull(); // "자라"
    expect(id('KT&G 상상마당')).toBe('kt'); // documented trade-off: KT is close enough
    expect(id('동네 백반집')).toBeNull();
    expect(id('')).toBeNull();
  });

  it('every brand is found by its own display name (no earlier entry shadows it)', () => {
    for (const b of BRANDS) expect([b.name, id(b.name)]).toEqual([b.name, b.id]);
  });

  it('has unique ids and real glyphs', () => {
    const ids = BRANDS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const b of BRANDS) {
      if (b.glyph) expect(BRAND_GLYPHS[b.glyph]).toMatch(/^[Mm][\d.-]/);
      else expect(b.label?.length).toBeGreaterThan(0);
    }
  });
});
