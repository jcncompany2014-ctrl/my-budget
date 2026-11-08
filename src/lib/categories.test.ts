import { describe, expect, it } from 'vitest';
import { suggestCategory } from './categories';

describe('suggestCategory', () => {
  it('files convenience stores under 생활, not 교통', () => {
    expect(suggestCategory('GS25 역삼점', 'personal')).toBe('living');
    expect(suggestCategory('CU 강남점', 'personal')).toBe('living');
    expect(suggestCategory('세븐일레븐 선릉', 'personal')).toBe('living');
  });

  it('knows the everyday places card alerts are full of', () => {
    expect(suggestCategory('본죽 역삼점', 'personal')).toBe('food');
    expect(suggestCategory('파리바게뜨 선릉', 'personal')).toBe('cafe');
    expect(suggestCategory('BHC 역삼점', 'personal')).toBe('food');
  });

  it('keeps short tokens from matching inside other words', () => {
    expect(suggestCategory('메가박스 코엑스', 'personal')).toBe('culture');
    expect(suggestCategory('메가MGC커피 역삼', 'personal')).toBe('cafe');
    expect(suggestCategory('KTX 서울-부산', 'personal')).toBe('transit');
    expect(suggestCategory('SECURITY SERVICE', 'personal')).toBeNull();
  });
});
