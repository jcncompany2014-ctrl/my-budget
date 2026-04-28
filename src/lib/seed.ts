import type { Account, Budget, RecurringItem, SavingsGoal, Transaction } from '@/lib/types';

export const SEED_ACCOUNTS: Account[] = [
  { id: 'a1', name: '토스뱅크 통장', bank: '토스뱅크', type: 'bank', balance: 4283500, color: '#0064FF', last4: '1234', main: true },
  { id: 'a2', name: '주거래 입출금', bank: '국민은행', type: 'bank', balance: 1872300, color: '#FFB81C', last4: '8901' },
  { id: 'a3', name: '비상금 통장', bank: '카카오뱅크', type: 'bank', balance: 2500000, color: '#FEE500', last4: '5566' },
  { id: 'c1', name: 'KB My WE:SH', bank: '국민카드', type: 'card', balance: -487240, color: '#5E3FBE', last4: '0021' },
  { id: 'c2', name: '토스 신용카드', bank: '토스', type: 'card', balance: -213900, color: '#0064FF', last4: '7788' },
];

const REFERENCE = new Date(2026, 3, 28);
const daysAgo = (n: number, h = 12, m = 0) => {
  const d = new Date(REFERENCE);
  d.setDate(d.getDate() - n);
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};

export const SEED_TRANSACTIONS: Transaction[] = [
  { id: 't001', date: daysAgo(0, 8, 12),  amount: -3200,    cat: 'transit',  merchant: '서울교통공사',     memo: '지하철', acc: 'c2' },
  { id: 't002', date: daysAgo(0, 9, 5),   amount: -4800,    cat: 'cafe',     merchant: '스타벅스 강남점',   memo: '아아 톨', acc: 'c2' },
  { id: 't003', date: daysAgo(0, 12, 30), amount: -12500,   cat: 'food',     merchant: '한솥도시락',        memo: '점심', acc: 'a1' },
  { id: 't004', date: daysAgo(0, 19, 20), amount: -28900,   cat: 'food',     merchant: '교촌치킨 역삼점',   memo: '저녁 + 회식', acc: 'c1' },
  { id: 't010', date: daysAgo(1, 8, 30),  amount: -1450,    cat: 'transit',  merchant: 'GS25 편의점',       memo: '버스카드 충전', acc: 'a1' },
  { id: 't011', date: daysAgo(1, 13, 10), amount: -9500,    cat: 'food',     merchant: '본죽',              memo: '점심', acc: 'c2' },
  { id: 't012', date: daysAgo(1, 18, 0),  amount: -5500,    cat: 'cafe',     merchant: '메가커피',          memo: '디저트', acc: 'c2' },
  { id: 't013', date: daysAgo(1, 21, 30), amount: -38000,   cat: 'shopping', merchant: '무신사',            memo: '여름 티셔츠', acc: 'c1' },
  { id: 't020', date: daysAgo(2, 9, 0),   amount: 3280000,  cat: 'salary',   merchant: '(주)토스플레이스', memo: '4월 급여', acc: 'a1' },
  { id: 't021', date: daysAgo(2, 9, 5),   amount: -800000,  cat: 'saving',   merchant: '비상금 통장',       memo: '저축 자동이체', acc: 'a1' },
  { id: 't022', date: daysAgo(2, 9, 6),   amount: -550000,  cat: 'living',   merchant: '관리비 자동이체',   memo: '4월 관리비', acc: 'a1' },
  { id: 't023', date: daysAgo(2, 19, 45), amount: -18900,   cat: 'food',     merchant: '명륜진사갈비',      memo: '저녁', acc: 'a1' },
  { id: 't030', date: daysAgo(3, 12, 0),  amount: -8500,    cat: 'food',     merchant: '김밥천국',          memo: '점심', acc: 'c2' },
  { id: 't031', date: daysAgo(3, 14, 0),  amount: -4500,    cat: 'cafe',     merchant: '컴포즈커피',        memo: '', acc: 'c2' },
  { id: 't032', date: daysAgo(3, 20, 0),  amount: -45000,   cat: 'culture',  merchant: 'CGV 강남',          memo: '듄: 파트2 + 팝콘', acc: 'c1' },
  { id: 't040', date: daysAgo(4, 11, 30), amount: -13800,   cat: 'food',     merchant: '죽이야기',          memo: '점심', acc: 'a1' },
  { id: 't041', date: daysAgo(4, 16, 0),  amount: -89000,   cat: 'beauty',   merchant: '올리브영',          memo: '스킨케어', acc: 'c1' },
  { id: 't050', date: daysAgo(5, 9, 0),   amount: -3200,    cat: 'transit',  merchant: '서울교통공사',      memo: '', acc: 'a1' },
  { id: 't051', date: daysAgo(5, 13, 0),  amount: -11000,   cat: 'food',     merchant: '맥도날드',          memo: '빅맥세트', acc: 'c2' },
  { id: 't052', date: daysAgo(5, 22, 0),  amount: -25000,   cat: 'shopping', merchant: '쿠팡',              memo: '생활용품', acc: 'a1' },
  { id: 't060', date: daysAgo(6, 10, 0),  amount: -14900,   cat: 'subs',     merchant: '넷플릭스',          memo: '프리미엄', acc: 'c2', recurring: true },
  { id: 't061', date: daysAgo(6, 19, 0),  amount: -32000,   cat: 'food',     merchant: '마라탕연구소',      memo: '주말 외식', acc: 'a1' },
  { id: 't062', date: daysAgo(6, 21, 0),  amount: -6800,    cat: 'cafe',     merchant: '투썸플레이스',      memo: '', acc: 'c2' },
  { id: 't160', date: daysAgo(2, 9, 2),   amount: 480000,   cat: 'bonus',    merchant: '(주)토스플레이스', memo: 'Q1 인센티브', acc: 'a1' },
  { id: 't161', date: daysAgo(8, 14, 0),  amount: 215000,   cat: 'side',     merchant: '크몽',              memo: '로고 디자인 외주', acc: 'a1' },
  { id: 't162', date: daysAgo(15, 10, 0), amount: 12450,    cat: 'interest', merchant: '토스뱅크',          memo: '통장 이자', acc: 'a1' },
  { id: 't163', date: daysAgo(11, 16, 0), amount: 38900,    cat: 'refund',   merchant: '쿠팡',              memo: '반품 환불', acc: 'c1' },
  { id: 't164', date: daysAgo(19, 18, 0), amount: 80000,    cat: 'side',     merchant: '당근마켓',          memo: '안 쓰는 카메라 판매', acc: 'a3' },
  { id: 't165', date: daysAgo(25, 11, 0), amount: 156000,   cat: 'refund',   merchant: '국세청',            memo: '연말정산 환급금', acc: 'a1' },
];

export const SEED_BUDGETS: Record<string, Budget> = {
  food:     { limit: 500000 },
  cafe:     { limit: 80000  },
  transit:  { limit: 100000 },
  shopping: { limit: 300000 },
  culture:  { limit: 200000 },
  beauty:   { limit: 150000 },
};

export const SEED_GOALS: SavingsGoal[] = [
  { id: 'g1', name: '제주도 여행',   emoji: '🏝️', target: 1500000, current: 920000,  due: '2026-07-15', color: '#06B6D4' },
  { id: 'g2', name: '맥북 프로 M5', emoji: '💻', target: 3500000, current: 1850000, due: '2026-12-01', color: '#191F28' },
  { id: 'g3', name: '비상금',       emoji: '🛟', target: 5000000, current: 2500000, due: '2026-12-31', color: '#00B956' },
];

export const SEED_RECURRING: RecurringItem[] = [
  { id: 'r1', name: '넷플릭스',         emoji: '🎬', amount: 14900,  day: 22, cat: 'subs' },
  { id: 'r2', name: 'YouTube Premium', emoji: '▶️', amount: 16500,  day: 19, cat: 'subs' },
  { id: 'r3', name: 'ChatGPT Plus',    emoji: '🤖', amount: 29900,  day: 15, cat: 'subs' },
  { id: 'r4', name: 'Spotify',         emoji: '🎵', amount: 12000,  day: 2,  cat: 'subs' },
  { id: 'r5', name: '다이슨 멤버십',    emoji: '🌬️', amount: 54000,  day: 4,  cat: 'subs' },
  { id: 'r6', name: '관리비',          emoji: '🏢', amount: 550000, day: 26, cat: 'living' },
];
