import type { Category, Scope } from '@/lib/types';

export const CATEGORIES: Record<string, Category> = {
  // ─── Personal expense ───
  food: { id: 'food', name: '식비', emoji: '🍚', color: '#FF8A1F', scope: 'personal' },
  cafe: { id: 'cafe', name: '카페·간식', emoji: '☕', color: '#A47148', scope: 'personal' },
  transit: { id: 'transit', name: '교통', emoji: '🚇', color: '#3182F6', scope: 'personal' },
  shopping: { id: 'shopping', name: '쇼핑', emoji: '🛍️', color: '#F472B6', scope: 'personal' },
  living: { id: 'living', name: '생활', emoji: '🏠', color: '#14B8A6', scope: 'personal' },
  health: { id: 'health', name: '의료·건강', emoji: '💊', color: '#EF4444', scope: 'personal' },
  beauty: { id: 'beauty', name: '미용', emoji: '💄', color: '#EC4899', scope: 'personal' },
  culture: { id: 'culture', name: '문화·여가', emoji: '🎬', color: '#8B5CF6', scope: 'personal' },
  pet: { id: 'pet', name: '반려', emoji: '🐶', color: '#F59E0B', scope: 'personal' },
  travel: { id: 'travel', name: '여행', emoji: '✈️', color: '#06B6D4', scope: 'personal' },
  education: { id: 'education', name: '교육', emoji: '📚', color: '#4F46E5', scope: 'personal' },
  subs: { id: 'subs', name: '구독', emoji: '🔁', color: '#0EA5E9', scope: 'personal' },
  transfer: { id: 'transfer', name: '이체', emoji: '↔️', color: '#94A3B8', scope: 'personal' },
  saving: { id: 'saving', name: '저축', emoji: '🌱', color: '#1FBA6E', scope: 'personal' },
  loan_payment: {
    id: 'loan_payment',
    name: '대출 상환',
    emoji: '🏛️',
    color: '#64748B',
    scope: 'personal',
  },

  // ─── Personal income ───
  salary: {
    id: 'salary',
    name: '급여',
    emoji: '💼',
    color: '#00B956',
    kind: 'income',
    scope: 'personal',
  },
  bonus: {
    id: 'bonus',
    name: '상여·인센티브',
    emoji: '🎁',
    color: '#10B981',
    kind: 'income',
    scope: 'personal',
  },
  side: {
    id: 'side',
    name: '부수입',
    emoji: '💻',
    color: '#22C55E',
    kind: 'income',
    scope: 'personal',
  },
  interest: {
    id: 'interest',
    name: '이자·배당',
    emoji: '🏦',
    color: '#0EA5E9',
    kind: 'income',
    scope: 'personal',
  },
  refund: {
    id: 'refund',
    name: '환급·환불',
    emoji: '↩️',
    color: '#3182F6',
    kind: 'income',
    scope: 'personal',
  },
  gift: {
    id: 'gift',
    name: '용돈·선물',
    emoji: '❤️',
    color: '#EC4899',
    kind: 'income',
    scope: 'personal',
  },
  income: {
    id: 'income',
    name: '기타 수입',
    emoji: '💰',
    color: '#84CC16',
    kind: 'income',
    scope: 'personal',
  },

  // ─── Business expense ───
  biz_purchase: {
    id: 'biz_purchase',
    name: '매입·재료',
    emoji: '📦',
    color: '#F97316',
    scope: 'business',
  },
  biz_rent: { id: 'biz_rent', name: '임대료', emoji: '🏢', color: '#0EA5E9', scope: 'business' },
  biz_payroll: {
    id: 'biz_payroll',
    name: '인건비',
    emoji: '👥',
    color: '#3182F6',
    scope: 'business',
  },
  biz_utility: {
    id: 'biz_utility',
    name: '공과금',
    emoji: '💡',
    color: '#FBBF24',
    scope: 'business',
  },
  biz_marketing: {
    id: 'biz_marketing',
    name: '마케팅·광고',
    emoji: '📣',
    color: '#EC4899',
    scope: 'business',
  },
  biz_supplies: {
    id: 'biz_supplies',
    name: '사무용품',
    emoji: '🖇️',
    color: '#A47148',
    scope: 'business',
  },
  biz_meal: {
    id: 'biz_meal',
    name: '거래처 식대',
    emoji: '🍽️',
    color: '#FF8A1F',
    scope: 'business',
  },
  biz_travel: {
    id: 'biz_travel',
    name: '출장·교통',
    emoji: '🚗',
    color: '#06B6D4',
    scope: 'business',
  },
  biz_insurance: {
    id: 'biz_insurance',
    name: '보험·4대보험',
    emoji: '🛡️',
    color: '#14B8A6',
    scope: 'business',
  },
  biz_tax: { id: 'biz_tax', name: '세금·공과', emoji: '🧾', color: '#EF4444', scope: 'business' },
  biz_fee: { id: 'biz_fee', name: '수수료', emoji: '💳', color: '#8B95A1', scope: 'business' },
  biz_etc: { id: 'biz_etc', name: '기타 경비', emoji: '🧰', color: '#94A3B8', scope: 'business' },
  biz_transfer: {
    id: 'biz_transfer',
    name: '이체',
    emoji: '↔️',
    color: '#94A3B8',
    scope: 'business',
  },
  biz_owner_draw: {
    id: 'biz_owner_draw',
    name: '사장 인출',
    emoji: '🚪',
    color: '#6B7684',
    scope: 'business',
  },

  // ─── Business income ───
  biz_sales_card: {
    id: 'biz_sales_card',
    name: '카드 매출',
    emoji: '💳',
    color: '#00B956',
    kind: 'income',
    scope: 'business',
  },
  biz_sales_cash: {
    id: 'biz_sales_cash',
    name: '현금 매출',
    emoji: '💵',
    color: '#1FBA6E',
    kind: 'income',
    scope: 'business',
  },
  biz_sales_xfer: {
    id: 'biz_sales_xfer',
    name: '계좌 매출',
    emoji: '🏦',
    color: '#10B981',
    kind: 'income',
    scope: 'business',
  },
  biz_sales_app: {
    id: 'biz_sales_app',
    name: '배달앱 매출',
    emoji: '🛵',
    color: '#22C55E',
    kind: 'income',
    scope: 'business',
  },
  biz_other: {
    id: 'biz_other',
    name: '기타 수입',
    emoji: '💰',
    color: '#84CC16',
    kind: 'income',
    scope: 'business',
  },
  biz_capital: {
    id: 'biz_capital',
    name: '자본 투입',
    emoji: '💼',
    color: '#3182F6',
    kind: 'income',
    scope: 'business',
  },

  // Personal income for owner — when business pays the owner
  owner_pay: {
    id: 'owner_pay',
    name: '사장 보수',
    emoji: '💵',
    color: '#3182F6',
    kind: 'income',
    scope: 'personal',
  },
};

export const isIncomeCategory = (catId: string) => CATEGORIES[catId]?.kind === 'income';

export const isTransferCategory = (catId: string) =>
  catId === 'transfer' ||
  catId === 'biz_transfer' ||
  catId === 'biz_owner_draw' ||
  catId === 'biz_capital' ||
  catId === 'owner_pay';

export const categoriesByScope = (scope: Scope) =>
  Object.values(CATEGORIES).filter((c) => c.scope === scope);

export const expenseCategoriesByScope = (scope: Scope) =>
  categoriesByScope(scope).filter((c) => c.kind !== 'income' && !isTransferCategory(c.id));

export const incomeCategoriesByScope = (scope: Scope) =>
  categoriesByScope(scope).filter((c) => c.kind === 'income' && !isTransferCategory(c.id));

/** Suggest a category by merchant name. Heuristic mapping. */
const MERCHANT_HINTS: Array<[RegExp, string]> = [
  [/스타벅스|투썸|이디야|메가|컴포즈|폴바셋|할리스|커피|cafe|coffee|카페/i, 'cafe'],
  [
    /치킨|피자|마라탕|김밥|버거|맥도날드|롯데리아|버거킹|kfc|서브웨이|식당|국밥|돈까스|치즈|푸드|만두|냉면|쌀국수|식사|레스토랑|배달|배민|요기요|쿠팡이츠/i,
    'food',
  ],
  [/지하철|버스|택시|kakao\s?t|타다|gs25|cu|cu편의점|편의점|gs칼텍스|sk엔크린|주유/i, 'transit'],
  [
    /cgv|메가박스|롯데시네마|영화|뮤지컬|콘서트|스파|찜질방|문화|netflix|넷플릭스|유튜브|youtube|spotify|디즈니/i,
    'culture',
  ],
  [/올리브영|화장품|미용실|네일|헤어|뷰티|피부과|에스테틱/i, 'beauty'],
  [/약국|병원|의원|치과|한의원|건강|영양제|보험/i, 'health'],
  [
    /무신사|29cm|쿠팡|네이버쇼핑|11번가|지마켓|옥션|이마트|홈플러스|롯데마트|다이소|이케아/i,
    'shopping',
  ],
  [/관리비|전기|수도|가스|kt|skt|lg\s?u\+|통신비/i, 'living'],
  [/펫|동물병원|사료|반려/i, 'pet'],
  [/항공|호텔|여행|에어비앤비|airbnb/i, 'travel'],
  [/학원|교육|책|서점|yes24|알라딘|문제집|유데미|udemy|coursera|클래스101/i, 'education'],
  [/정기|구독|멤버십|premium|premium|notion|chatgpt|claude/i, 'subs'],
];

export function suggestCategory(merchant: string, scope: Scope): string | null {
  if (scope === 'business') return null; // business default to no suggest
  const m = merchant.trim();
  if (!m) return null;
  for (const [pattern, catId] of MERCHANT_HINTS) {
    if (pattern.test(m)) return catId;
  }
  return null;
}
