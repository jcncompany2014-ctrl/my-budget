'use client';

import type { Transaction } from '@/lib/types';

const isExp = (t: Transaction) =>
  t.amount < 0 &&
  t.cat !== 'saving' &&
  t.cat !== 'transfer' &&
  t.cat !== 'biz_transfer' &&
  t.cat !== 'biz_owner_draw';

/**
 * Anomaly: returns categories whose current month spending is significantly
 * higher than the trailing 3-month average.
 */
export function detectAnomalies(tx: Transaction[]) {
  const now = new Date();
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const totals = new Map<string, number[]>(); // cat → spending per month, last 4 months

  for (let i = 3; i >= 0; i--) {
    const yyyymm = thisMonth - i;
    const year = Math.floor(yyyymm / 12);
    const month = yyyymm % 12;
    tx.forEach((t) => {
      if (!isExp(t)) return;
      const d = new Date(t.date);
      if (d.getFullYear() !== year || d.getMonth() !== month) return;
      const arr = totals.get(t.cat) ?? [0, 0, 0, 0];
      arr[3 - i] += Math.abs(t.amount);
      totals.set(t.cat, arr);
    });
  }

  const anomalies: { cat: string; current: number; avg: number; deltaPct: number }[] = [];
  totals.forEach((arr, cat) => {
    const current = arr[3] ?? 0;
    const past = arr.slice(0, 3);
    const avg = past.reduce((s, v) => s + v, 0) / 3;
    if (avg < 10000) return; // ignore tiny categories
    const delta = current - avg;
    const deltaPct = Math.round((delta / avg) * 100);
    if (deltaPct >= 30 && current > 0) {
      anomalies.push({ cat, current, avg, deltaPct });
    }
  });
  return anomalies.sort((a, b) => b.deltaPct - a.deltaPct).slice(0, 3);
}

/**
 * Single-transaction outlier detection.
 *
 * Per-category mean + stddev over the trailing 60 days; flags any tx where
 * |amount| is more than `threshold` standard deviations above the mean.
 * Only categories with at least `minSamples` recent transactions qualify so
 * a brand-new category doesn't read as outlier-by-default.
 *
 * Returns the most extreme outlier (highest z-score) only — UI surfaces it
 * one-at-a-time so the alert stays meaningful.
 */
export function detectOutlierTransaction(
  tx: Transaction[],
  opts: { threshold?: number; minSamples?: number; windowDays?: number } = {},
): { tx: Transaction; zScore: number; catAvg: number } | null {
  const threshold = opts.threshold ?? 3;
  const minSamples = opts.minSamples ?? 5;
  const windowDays = opts.windowDays ?? 60;

  const cutoff = Date.now() - windowDays * 86400000;
  const recent = tx.filter(
    (t) => new Date(t.date).getTime() >= cutoff && isExp(t) && Math.abs(t.amount) > 0,
  );

  const byCat = new Map<string, Transaction[]>();
  for (const t of recent) {
    if (!byCat.has(t.cat)) byCat.set(t.cat, []);
    byCat.get(t.cat)?.push(t);
  }

  let best: { tx: Transaction; zScore: number; catAvg: number } | null = null;
  byCat.forEach((txs) => {
    if (txs.length < minSamples) return;
    const amounts = txs.map((t) => Math.abs(t.amount));
    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length;
    const std = Math.sqrt(variance);
    if (std < 1) return; // tiny variance — every tx looks the same; not informative
    for (const t of txs) {
      const z = (Math.abs(t.amount) - mean) / std;
      if (z >= threshold && (!best || z > best.zScore)) {
        best = { tx: t, zScore: z, catAvg: mean };
      }
    }
  });
  return best;
}

/**
 * Forecast: project month-end expense from current pace.
 */
export function forecastMonthEnd(tx: Transaction[]) {
  const now = new Date();
  const day = now.getDate();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthExpense = tx
    .filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && isExp(t);
    })
    .reduce((s, t) => s + Math.abs(t.amount), 0);
  const projection = Math.round((monthExpense / day) * lastDay);
  return { current: monthExpense, projection, day, lastDay };
}

/**
 * Returns category buckets that crossed thresholds against budget map.
 * Threshold pct triggers (80, 100).
 */
export function budgetAlerts(tx: Transaction[], budgets: Record<string, { limit: number }>) {
  const now = new Date();
  const monthExpense = new Map<string, number>();
  tx.forEach((t) => {
    if (!isExp(t)) return;
    const d = new Date(t.date);
    if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
    monthExpense.set(t.cat, (monthExpense.get(t.cat) ?? 0) + Math.abs(t.amount));
  });
  const alerts: {
    cat: string;
    pct: number;
    used: number;
    limit: number;
    level: 'warn' | 'over';
  }[] = [];
  Object.entries(budgets).forEach(([cat, b]) => {
    if (b.limit <= 0) return;
    const used = monthExpense.get(cat) ?? 0;
    const pct = Math.round((used / b.limit) * 100);
    if (pct >= 100) alerts.push({ cat, pct, used, limit: b.limit, level: 'over' });
    else if (pct >= 80) alerts.push({ cat, pct, used, limit: b.limit, level: 'warn' });
  });
  return alerts;
}

/**
 * Weekly summary: this week's total expense + comparison with last week.
 */
export function weeklyDigest(tx: Transaction[]) {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(startOfWeek.getDate() - 7);
  const thisWeek = sumExpense(tx, startOfWeek, new Date());
  const lastWeek = sumExpense(tx, lastWeekStart, startOfWeek);
  const delta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
  return { thisWeek, lastWeek, delta };
}

function sumExpense(tx: Transaction[], from: Date, to: Date) {
  return tx
    .filter((t) => {
      const d = new Date(t.date);
      return d >= from && d < to && isExp(t);
    })
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}
