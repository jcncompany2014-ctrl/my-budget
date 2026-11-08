import { localDayKey } from '@/lib/dates';
import { expandByCategory, isExpense, isIncome } from '@/lib/format';
import type { Transaction } from '@/lib/types';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

export type MonthlyClosing = {
  year: number;
  month: number; // 0-based
  daysInMonth: number;
  income: number;
  expense: number;
  net: number;
  /** net / income, null when there was no income. */
  savingsRate: number | null;
  prevExpense: number;
  /** Expense change vs previous month (%), null when prev month had none. */
  expenseDeltaPct: number | null;
  loggedDays: number;
  noSpendDays: number;
  avgDailySpend: number;
  topCategories: { cat: string; amount: number; prevAmount: number; deltaPct: number | null }[];
  biggest: { merchant: string; amount: number; date: string; cat: string } | null;
  favoriteMerchant: { merchant: string; visits: number; total: number } | null;
  peakWeekday: { label: string; avg: number } | null;
  txCount: number;
};

const inMonth = (t: Transaction, y: number, m: number) => {
  const d = new Date(t.date);
  return d.getFullYear() === y && d.getMonth() === m;
};

/**
 * Everything the 월말 결산 page shows, computed from raw transactions.
 * `tx` should already be scoped to the current mode.
 */
export function monthlyClosing(tx: Transaction[], year: number, month: number): MonthlyClosing {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevRef = new Date(year, month - 1, 1);
  const monthTx = tx.filter((t) => inMonth(t, year, month));
  const prevTx = tx.filter((t) => inMonth(t, prevRef.getFullYear(), prevRef.getMonth()));

  const expenses = monthTx.filter(isExpense);
  const income = monthTx.filter(isIncome).reduce((s, t) => s + t.amount, 0);
  const expense = expenses.reduce((s, t) => s + Math.abs(t.amount), 0);
  const net = income - expense;
  const prevExpense = prevTx.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);

  // Days: logged = any transaction; no-spend = no expense (only count days that
  // have already happened, so the current month doesn't get free no-spend days).
  const loggedSet = new Set(monthTx.map((t) => localDayKey(t.date)));
  const spendByDay = new Map<string, number>();
  for (const t of expenses) {
    const k = localDayKey(t.date);
    spendByDay.set(k, (spendByDay.get(k) ?? 0) + Math.abs(t.amount));
  }
  const now = new Date();
  const isCurrent = now.getFullYear() === year && now.getMonth() === month;
  const elapsedDays = isCurrent ? now.getDate() : daysInMonth;
  let noSpendDays = 0;
  for (let d = 1; d <= elapsedDays; d++) {
    if (!spendByDay.has(localDayKey(new Date(year, month, d)))) noSpendDays += 1;
  }

  // Categories (split-aware), with previous-month comparison
  const catSum = (list: Transaction[]) => {
    const m = new Map<string, number>();
    for (const t of list) {
      if (!isExpense(t)) continue;
      for (const s of expandByCategory(t)) m.set(s.cat, (m.get(s.cat) ?? 0) + Math.abs(s.amount));
    }
    return m;
  };
  const cats = catSum(monthTx);
  const prevCats = catSum(prevTx);
  const topCategories = Array.from(cats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([cat, amount]) => {
      const prevAmount = prevCats.get(cat) ?? 0;
      return {
        cat,
        amount,
        prevAmount,
        deltaPct: prevAmount > 0 ? Math.round(((amount - prevAmount) / prevAmount) * 100) : null,
      };
    });

  // Biggest single expense
  let biggest: MonthlyClosing['biggest'] = null;
  for (const t of expenses) {
    if (!biggest || Math.abs(t.amount) > biggest.amount) {
      biggest = { merchant: t.merchant, amount: Math.abs(t.amount), date: t.date, cat: t.cat };
    }
  }

  // Most visited merchant (expenses, ignoring auto-recurring rows)
  const visits = new Map<string, { merchant: string; visits: number; total: number }>();
  for (const t of expenses) {
    if (t.recurring) continue;
    const name = t.merchant.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const v = visits.get(key) ?? { merchant: name, visits: 0, total: 0 };
    v.visits += 1;
    v.total += Math.abs(t.amount);
    visits.set(key, v);
  }
  const favoriteMerchant =
    Array.from(visits.values()).sort((a, b) => b.visits - a.visits || b.total - a.total)[0] ?? null;

  // Peak weekday by average spend per occurrence of that weekday in the month
  const wdTotal = new Array<number>(7).fill(0);
  const wdCount = new Array<number>(7).fill(0);
  for (let d = 1; d <= elapsedDays; d++) {
    const date = new Date(year, month, d);
    wdCount[date.getDay()] += 1;
    wdTotal[date.getDay()] += spendByDay.get(localDayKey(date)) ?? 0;
  }
  let peakWeekday: MonthlyClosing['peakWeekday'] = null;
  for (let w = 0; w < 7; w++) {
    if (wdCount[w] === 0) continue;
    const avg = wdTotal[w] / wdCount[w];
    if (avg > 0 && (!peakWeekday || avg > peakWeekday.avg)) {
      peakWeekday = { label: WEEKDAYS[w], avg };
    }
  }

  return {
    year,
    month,
    daysInMonth,
    income,
    expense,
    net,
    savingsRate: income > 0 ? net / income : null,
    prevExpense,
    expenseDeltaPct:
      prevExpense > 0 ? Math.round(((expense - prevExpense) / prevExpense) * 100) : null,
    loggedDays: loggedSet.size,
    noSpendDays,
    avgDailySpend: elapsedDays > 0 ? expense / elapsedDays : 0,
    topCategories,
    biggest,
    favoriteMerchant,
    peakWeekday,
    txCount: monthTx.length,
  };
}

/** 'YYYY-MM' for the month before `now`. */
export function previousMonthKey(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Parse 'YYYY-MM' → { year, month(0-based) } or null. */
export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { year, month };
}
