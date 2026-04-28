import type { Category, Scope } from '@/lib/types';

export const CATEGORIES: Record<string, Category> = {
  // ─── Personal expense ───
  food:      { id: 'food',      name: '식비',          emoji: '🍚', color: '#FF8A1F', scope: 'personal' },
  cafe:      { id: 'cafe',      name: '카페·간식',     emoji: '☕', color: '#A47148', scope: 'personal' },
  transit:   { id: 'transit',   name: '교통',          emoji: '🚇', color: '#3182F6', scope: 'personal' },
  shopping:  { id: 'shopping',  name: '쇼핑',          emoji: '🛍️', color: '#F472B6', scope: 'personal' },
  living:    { id: 'living',    name: '생활',          emoji: '🏠', color: '#14B8A6', scope: 'personal' },
  health:    { id: 'health',    name: '의료·건강',     emoji: '💊', color: '#EF4444', scope: 'personal' },
  beauty:    { id: 'beauty',    name: '미용',          emoji: '💄', color: '#EC4899', scope: 'personal' },
  culture:   { id: 'culture',   name: '문화·여가',     emoji: '🎬', color: '#8B5CF6', scope: 'personal' },
  pet:       { id: 'pet',       name: '반려',          emoji: '🐶', color: '#F59E0B', scope: 'personal' },
  travel:    { id: 'travel',    name: '여행',          emoji: '✈️', color: '#06B6D4', scope: 'personal' },
  education: { id: 'education', name: '교육',          emoji: '📚', color: '#4F46E5', scope: 'personal' },
  subs:      { id: 'subs',      name: '구독',          emoji: '🔁', color: '#0EA5E9', scope: 'personal' },
  transfer:  { id: 'transfer',  name: '이체·송금',     emoji: '↗️', color: '#94A3B8', scope: 'personal' },
  saving:    { id: 'saving',    name: '저축',          emoji: '🌱', color: '#1FBA6E', scope: 'personal' },

  // ─── Personal income ───
  salary:    { id: 'salary',    name: '급여',          emoji: '💼', color: '#00B956', kind: 'income', scope: 'personal' },
  bonus:     { id: 'bonus',     name: '상여·인센티브', emoji: '🎁', color: '#10B981', kind: 'income', scope: 'personal' },
  side:      { id: 'side',      name: '부수입',        emoji: '💻', color: '#22C55E', kind: 'income', scope: 'personal' },
  interest:  { id: 'interest',  name: '이자·배당',     emoji: '🏦', color: '#0EA5E9', kind: 'income', scope: 'personal' },
  refund:    { id: 'refund',    name: '환급·환불',     emoji: '↩️', color: '#3182F6', kind: 'income', scope: 'personal' },
  gift:      { id: 'gift',      name: '용돈·선물',     emoji: '❤️', color: '#EC4899', kind: 'income', scope: 'personal' },
  income:    { id: 'income',    name: '기타 수입',     emoji: '💰', color: '#84CC16', kind: 'income', scope: 'personal' },

  // ─── Business expense ───
  biz_purchase:  { id: 'biz_purchase',  name: '매입·재료',     emoji: '📦', color: '#F97316', scope: 'business' },
  biz_rent:      { id: 'biz_rent',      name: '임대료',        emoji: '🏢', color: '#0EA5E9', scope: 'business' },
  biz_payroll:   { id: 'biz_payroll',   name: '인건비',        emoji: '👥', color: '#3182F6', scope: 'business' },
  biz_utility:   { id: 'biz_utility',   name: '공과금',        emoji: '💡', color: '#FBBF24', scope: 'business' },
  biz_marketing: { id: 'biz_marketing', name: '마케팅·광고',   emoji: '📣', color: '#EC4899', scope: 'business' },
  biz_supplies:  { id: 'biz_supplies',  name: '사무용품',      emoji: '🖇️', color: '#A47148', scope: 'business' },
  biz_meal:      { id: 'biz_meal',      name: '거래처 식대',   emoji: '🍽️', color: '#FF8A1F', scope: 'business' },
  biz_travel:    { id: 'biz_travel',    name: '출장·교통',     emoji: '🚗', color: '#06B6D4', scope: 'business' },
  biz_insurance: { id: 'biz_insurance', name: '보험·4대보험',  emoji: '🛡️', color: '#14B8A6', scope: 'business' },
  biz_tax:       { id: 'biz_tax',       name: '세금·공과',     emoji: '🧾', color: '#EF4444', scope: 'business' },
  biz_fee:       { id: 'biz_fee',       name: '수수료',        emoji: '💳', color: '#8B95A1', scope: 'business' },
  biz_etc:       { id: 'biz_etc',       name: '기타 경비',     emoji: '🧰', color: '#94A3B8', scope: 'business' },

  // ─── Business income ───
  biz_sales_card:  { id: 'biz_sales_card',  name: '카드 매출',  emoji: '💳', color: '#00B956', kind: 'income', scope: 'business' },
  biz_sales_cash:  { id: 'biz_sales_cash',  name: '현금 매출',  emoji: '💵', color: '#1FBA6E', kind: 'income', scope: 'business' },
  biz_sales_xfer:  { id: 'biz_sales_xfer',  name: '계좌 매출',  emoji: '🏦', color: '#10B981', kind: 'income', scope: 'business' },
  biz_sales_app:   { id: 'biz_sales_app',   name: '배달앱 매출', emoji: '🛵', color: '#22C55E', kind: 'income', scope: 'business' },
  biz_other:       { id: 'biz_other',       name: '기타 수입',  emoji: '💰', color: '#84CC16', kind: 'income', scope: 'business' },
};

export const isIncomeCategory = (catId: string) =>
  CATEGORIES[catId]?.kind === 'income';

export const categoriesByScope = (scope: Scope) =>
  Object.values(CATEGORIES).filter((c) => c.scope === scope);

export const expenseCategoriesByScope = (scope: Scope) =>
  categoriesByScope(scope).filter((c) => c.kind !== 'income');

export const incomeCategoriesByScope = (scope: Scope) =>
  categoriesByScope(scope).filter((c) => c.kind === 'income');
