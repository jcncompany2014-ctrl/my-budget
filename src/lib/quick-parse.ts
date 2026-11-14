import { autoCategorize } from '@/lib/auto-categorize';
import { CATEGORIES, isIncomeCategory } from '@/lib/categories';
import { applyRules, type CategoryRule } from '@/lib/category-rules';
import { isSpendingCategory } from '@/lib/format';
import type { Scope, Transaction } from '@/lib/types';

/** What one typed line says, before any category is chosen. */
export type QuickText = {
  amount: number;
  /** Everything that was not the amount, a date word or a keyword. May be ''. */
  merchant: string;
  date: Date;
  /** The line itself said it is money coming in (수입 · 입금 · 받음 · +금액). */
  income: boolean;
};

const INCOME_WORDS = new Set(['수입', '입금', '받음', '환불', '환급']);
const EXPENSE_WORDS = new Set(['지출', '결제']);
const DAY_WORDS = new Map([
  ['오늘', 0],
  ['어제', 1],
  ['그제', 2],
  ['그저께', 2],
  ['엊그제', 2],
]);

/**
 * One token as an amount: "4500", "12,000원", "5천", "1만5천", "3.5만", "1억2000만".
 * `unit` tells a spelled-out amount from a bare number, which could be part of a name.
 */
function readAmount(token: string): { value: number; unit: boolean } | null {
  let s = token.replace(/(\d),(?=\d{3}(?!\d))/g, '$1');
  const won = s.endsWith('원');
  if (won) s = s.slice(0, -1);
  if (!s) return null;
  if (/^\d+$/.test(s)) return { value: Number(s), unit: won };
  const m = s.match(/^(?:(\d+(?:\.\d+)?)억)?(?:(\d+(?:\.\d+)?)만)?(?:(\d+(?:\.\d+)?)천)?(\d+)?$/);
  if (!m || (m[1] === undefined && m[2] === undefined && m[3] === undefined)) return null;
  const value = Math.round(
    Number(m[1] ?? 0) * 100_000_000 +
      Number(m[2] ?? 0) * 10_000 +
      Number(m[3] ?? 0) * 1_000 +
      Number(m[4] ?? 0),
  );
  return value > 0 ? { value, unit: true } : null;
}

/** A day of this month (or month/day) that has not happened yet means the previous one. */
function pastDate(now: Date, month: number | null, day: number): Date | null {
  const y = now.getFullYear();
  const m = month === null ? now.getMonth() : month - 1;
  if (m < 0 || m > 11 || day < 1 || day > 31) return null;
  const at = (year: number, mon: number) => {
    const d = new Date(now);
    d.setFullYear(year, mon, day);
    // setFullYear rolls 31 → next month when the month is shorter.
    return d.getDate() === day ? d : null;
  };
  const d = at(y, m);
  if (d && d.getTime() <= now.getTime()) return d;
  return month === null ? at(y, m - 1) : at(y - 1, m);
}

/**
 * Reads a line such as "어제 스타벅스 5천원", "GS25 3,500", "12일 관리비 15만",
 * "월급 300만 입금". Only the amount token is taken out of the name, so
 * "GS25", "11번가", "원할머니보쌈" and "만두" survive intact.
 */
export function parseQuickText(raw: string, now: Date = new Date()): QuickText | null {
  let tokens = raw.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return null;

  // "5 천원", "3 만", "4500 원" — a unit typed after a space belongs to the number.
  const merged: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const next = tokens[i + 1];
    if (next && /^[+\-₩]?[\d,.]+$/.test(tokens[i]) && /^(?:[억만천]원?|원)$/.test(next)) {
      merged.push(tokens[i] + next);
      i++;
    } else merged.push(tokens[i]);
  }
  tokens = merged;

  let date = new Date(now);
  let income = false;
  const rest: string[] = [];
  let incomeWord = '';

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const daysAgo = DAY_WORDS.get(t);
    if (daysAgo !== undefined) {
      date = new Date(now);
      date.setDate(date.getDate() - daysAgo);
      continue;
    }
    // Numeric dates only lead the line — "3일 여행" in the middle is a name.
    if (i === 0 && tokens.length > 1) {
      const md = t.match(/^(\d{1,2})[/월](\d{1,2})일?$/);
      const monthOnly = t.match(/^(\d{1,2})월$/);
      const nextDay = tokens[1]?.match(/^(\d{1,2})일$/);
      const dayOnly = t.match(/^(\d{1,2})일$/);
      let parsed: Date | null = null;
      let used = 0;
      if (md) {
        parsed = pastDate(now, Number(md[1]), Number(md[2]));
        used = 1;
      } else if (monthOnly && nextDay && tokens.length > 2) {
        parsed = pastDate(now, Number(monthOnly[1]), Number(nextDay[1]));
        used = 2;
      } else if (dayOnly) {
        parsed = pastDate(now, null, Number(dayOnly[1]));
        used = 1;
      }
      if (parsed) {
        date = parsed;
        i += used - 1;
        continue;
      }
    }
    if (INCOME_WORDS.has(t)) {
      income = true;
      incomeWord = t;
      continue;
    }
    if (EXPENSE_WORDS.has(t)) continue;
    rest.push(t);
  }

  // Pick the amount: a spelled-out one ("5천", "3,500원") beats a bare number;
  // among bare numbers the largest ("아이폰 15 1500000").
  let pick = -1;
  let amount = 0;
  let signed = '';
  let spelled = false;
  rest.forEach((t, i) => {
    const sign = /^[+-]/.test(t) ? t[0] : '';
    const a = readAmount(t.replace(/^[+\-₩]+/, ''));
    if (!a) return;
    if (!a.unit && !sign && a.value < 10) return;
    const better = a.unit || sign ? !spelled || i > pick : !spelled && a.value > amount;
    if (!better) return;
    pick = i;
    amount = a.value;
    signed = sign;
    spelled = a.unit || !!sign;
  });

  // "스타벅스5천원", "CU1500" — the amount glued to the name. A two-digit tail
  // without a unit is a name ("GS25", "이마트24").
  let glued = '';
  if (pick === -1) {
    outer: for (let i = rest.length - 1; i >= 0; i--) {
      const t = rest[i];
      for (let cut = 1; cut < t.length; cut++) {
        if (/[\d.,]/.test(t[cut - 1])) continue;
        const a = readAmount(t.slice(cut));
        if (!a || (!a.unit && a.value < 100)) continue;
        pick = i;
        amount = a.value;
        glued = t.slice(0, cut);
        break outer;
      }
    }
  }

  if (pick === -1 || amount <= 0) return null;
  if (signed === '+') income = true;

  const name = rest
    .map((t, i) => (i === pick ? glued : t))
    .filter(Boolean)
    .join(' ');

  return { amount, merchant: name || incomeWord, date, income };
}

export type QuickResolved = { cat: string; type: 'expense' | 'income'; merchant: string };

/**
 * Category and direction for a parsed line: the user's own rules first, then how
 * this merchant was filed before, then the built-in guesses.
 */
export function resolveQuick(
  q: QuickText,
  scope: Scope,
  history: Transaction[],
  rules: CategoryRule[],
): QuickResolved {
  const lower = q.merchant.toLowerCase();
  const same = lower
    ? history.filter(
        (t) =>
          (t.scope ?? 'personal') === scope &&
          !t.transferPairId &&
          t.merchant.toLowerCase() === lower,
      )
    : [];
  const ruleCat = lower ? applyRules(q.merchant, rules) : null;
  const cameIn = same.filter((t) => t.amount > 0).length;
  const income =
    q.income ||
    (same.length > 0 ? cameIn * 2 > same.length : !!ruleCat && isIncomeCategory(ruleCat));

  const fits = (c: string | null | undefined): c is string =>
    !!c &&
    CATEGORIES[c]?.scope === scope &&
    isSpendingCategory(c) &&
    isIncomeCategory(c) === income;

  const guess = ruleCat ?? (lower ? autoCategorize(q.merchant, scope, history) : null);
  const fallback = income
    ? scope === 'business'
      ? 'biz_other'
      : 'income'
    : scope === 'business'
      ? 'biz_etc'
      : 'living';
  const cat = fits(guess) ? guess : fallback;

  return {
    cat,
    type: income ? 'income' : 'expense',
    merchant: q.merchant || CATEGORIES[cat]?.name || '거래',
  };
}
