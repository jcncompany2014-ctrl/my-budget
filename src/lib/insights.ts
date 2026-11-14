'use client';

import { localDayKey, todayKey } from '@/lib/dates';
import { isExpense, spendByCategory } from '@/lib/format';
import type { Transaction } from '@/lib/types';

/**
 * Anomaly: returns categories whose current month spending is significantly
 * higher than the trailing 3-month average.
 */
export function detectAnomalies(tx: Transaction[]) {
  const now = new Date();
  const thisMonth = now.getFullYear() * 12 + now.getMonth();
  const totals = new Map<string, number[]>(); // cat → spending per month, last 4 months
  const active = [false, false, false]; // which of the 3 past months have any spending at all

  for (const t of tx) {
    if (!isExpense(t)) continue;
    const d = new Date(t.date);
    const i = thisMonth - (d.getFullYear() * 12 + d.getMonth());
    if (i < 0 || i > 3) continue;
    const arr = totals.get(t.cat) ?? [0, 0, 0, 0];
    arr[3 - i] += Math.abs(t.amount);
    totals.set(t.cat, arr);
    if (i > 0) active[3 - i] = true;
  }
  // Average over the months the ledger actually covers — dividing one month of
  // history by 3 made a quieter month read as "+50% above usual".
  const months = active.filter(Boolean).length;
  if (months === 0) return [];

  const anomalies: { cat: string; current: number; avg: number; deltaPct: number }[] = [];
  totals.forEach((arr, cat) => {
    const current = arr[3] ?? 0;
    const past = arr.slice(0, 3);
    const avg = past.reduce((s, v) => s + v, 0) / months;
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
    (t) => new Date(t.date).getTime() >= cutoff && isExpense(t) && Math.abs(t.amount) > 0,
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
 * Returns category buckets that crossed thresholds against budget map.
 * Threshold pct triggers (80, 100).
 */
export function budgetAlerts(tx: Transaction[], budgets: Record<string, { limit: number }>) {
  const monthKey = todayKey().slice(0, 7);
  const monthExpense = spendByCategory(tx.filter((t) => localDayKey(t.date).startsWith(monthKey)));
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
 * Weekly summary: this week-to-date vs the SAME elapsed span of last week.
 *
 * Monday-start week (Korean convention). Comparing a partial week against a
 * full previous week made every Monday read as "-90% vs 지난주"; now Wednesday
 * 3pm compares against last Monday → last Wednesday 3pm.
 */
export function weeklyDigest(tx: Transaction[], now: Date = new Date()) {
  const startOfWeek = new Date(now);
  startOfWeek.setHours(0, 0, 0, 0);
  const dow = (startOfWeek.getDay() + 6) % 7; // Mon=0 … Sun=6
  startOfWeek.setDate(startOfWeek.getDate() - dow);
  const lastWeekStart = new Date(startOfWeek);
  lastWeekStart.setDate(startOfWeek.getDate() - 7);
  const lastWeekSameSpanEnd = new Date(now);
  lastWeekSameSpanEnd.setDate(now.getDate() - 7);
  const thisWeek = sumExpense(tx, startOfWeek, new Date(now.getTime() + 1));
  const lastWeek = sumExpense(tx, lastWeekStart, lastWeekSameSpanEnd);
  const lastWeekFull = sumExpense(tx, lastWeekStart, startOfWeek);
  const delta = lastWeek > 0 ? Math.round(((thisWeek - lastWeek) / lastWeek) * 100) : 0;
  return { thisWeek, lastWeek, lastWeekFull, delta };
}

/**
 * Month-to-date pace vs the same day-of-month last month (Copilot-style).
 * Returns cumulative daily series for both months for charting.
 */
export function monthPace(tx: Transaction[], now: Date = new Date()) {
  const today = now.getDate();
  const daysThis = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const lastRef = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const daysLast = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
  const thisDaily = new Array<number>(daysThis).fill(0);
  const lastDaily = new Array<number>(daysLast).fill(0);
  for (const t of tx) {
    if (!isExpense(t)) continue;
    const d = new Date(t.date);
    const amt = Math.abs(t.amount);
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
      if (d.getDate() <= today) thisDaily[d.getDate() - 1] += amt;
    } else if (d.getFullYear() === lastRef.getFullYear() && d.getMonth() === lastRef.getMonth()) {
      lastDaily[d.getDate() - 1] += amt;
    }
  }
  const cumulative = (arr: number[]) => {
    let s = 0;
    return arr.map((v) => {
      s += v;
      return s;
    });
  };
  const thisCum = cumulative(thisDaily).slice(0, today);
  const lastCum = cumulative(lastDaily);
  const thisToDate = thisCum[today - 1] ?? 0;
  const lastAtSameDay = lastCum[Math.min(today, daysLast) - 1] ?? 0;
  const lastTotal = lastCum[daysLast - 1] ?? 0;
  const diff = thisToDate - lastAtSameDay;
  const deltaPct = lastAtSameDay > 0 ? Math.round((diff / lastAtSameDay) * 100) : null;
  const projection = today > 0 ? Math.round((thisToDate / today) * daysThis) : 0;
  return {
    today,
    daysThis,
    daysLast,
    thisCum,
    lastCum,
    thisToDate,
    lastAtSameDay,
    lastTotal,
    diff,
    deltaPct,
    projection,
  };
}

function sumExpense(tx: Transaction[], from: Date, to: Date) {
  return tx
    .filter((t) => {
      const d = new Date(t.date);
      return d >= from && d < to && isExpense(t);
    })
    .reduce((s, t) => s + Math.abs(t.amount), 0);
}

/* ─── Pattern detection (Insights 2.0) ────────────────────────────── */

const WEEKDAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export type SpendingPattern =
  | {
      kind: 'weekday-category';
      weekday: number; // 0 = 일요일
      cat: string;
      ratio: number; // weekday/avg of other days
      sample: number; // tx count in this weekday-category bucket
    }
  | {
      kind: 'weekend-vs-weekday';
      weekendAvg: number;
      weekdayAvg: number;
      deltaPct: number; // positive = weekend spends more
    }
  | {
      kind: 'category-trend';
      cat: string;
      firstMonthAvg: number;
      lastMonthAvg: number;
      deltaPct: number; // positive = increasing
    };

/**
 * Detect spending patterns over the trailing 90 days.
 *
 * Returns up to 3 most-notable findings:
 *   • A weekday bias — "매주 월요일 커피 많이"
 *   • Weekend vs weekday spending delta (only if >25% difference)
 *   • A category trend — "지난 3개월 식비 N% 증가"
 */
export function detectPatterns(tx: Transaction[]): SpendingPattern[] {
  const cutoff = Date.now() - 90 * 86400000;
  const recent = tx.filter((t) => isExpense(t) && new Date(t.date).getTime() >= cutoff);
  if (recent.length < 10) return [];

  const findings: SpendingPattern[] = [];

  /* 1. Weekday × category bias */
  const buckets = new Map<string, number>(); // key: `${weekday}:${cat}` → total
  const weekdayTotals = new Array<number>(7).fill(0);
  const catTotals = new Map<string, number>();
  const sampleCounts = new Map<string, number>();
  recent.forEach((t) => {
    const d = new Date(t.date);
    const w = d.getDay();
    const amt = Math.abs(t.amount);
    const key = `${w}:${t.cat}`;
    buckets.set(key, (buckets.get(key) ?? 0) + amt);
    sampleCounts.set(key, (sampleCounts.get(key) ?? 0) + 1);
    weekdayTotals[w] += amt;
    catTotals.set(t.cat, (catTotals.get(t.cat) ?? 0) + amt);
  });

  // For each (weekday, cat) bucket, compare to that category's spending on other weekdays
  let bestBias: SpendingPattern | null = null;
  buckets.forEach((amtOnWeekday, key) => {
    const [wStr, cat] = key.split(':');
    const w = Number(wStr);
    const sample = sampleCounts.get(key) ?? 0;
    if (sample < 3) return; // need enough recurrence
    const catTotal = catTotals.get(cat) ?? 0;
    const otherDaysAmt = catTotal - amtOnWeekday;
    const otherDaysCount = 7 - 1;
    const otherAvg = otherDaysAmt / otherDaysCount;
    const weekdayAvg = amtOnWeekday; // all on one weekday, so avg = total
    if (otherAvg < 1000) return;
    const ratio = weekdayAvg / otherAvg;
    if (ratio < 1.6) return;
    if (!bestBias || (bestBias.kind === 'weekday-category' && ratio > bestBias.ratio)) {
      bestBias = { kind: 'weekday-category', weekday: w, cat, ratio, sample };
    }
  });
  if (bestBias) findings.push(bestBias);

  /* 2. Weekend vs weekday — average spend per CALENDAR day (not per transaction).
     The window starts at the later of (90 days ago, first logged tx) so a user
     who started 3 weeks ago isn't diluted by 9 empty weeks. */
  const weekendTotal = weekdayTotals[0] + weekdayTotals[6];
  const weekdayTotal =
    weekdayTotals[1] + weekdayTotals[2] + weekdayTotals[3] + weekdayTotals[4] + weekdayTotals[5];
  const firstTs = Math.min(...recent.map((t) => new Date(t.date).getTime()));
  const windowStart = new Date(Math.max(cutoff, firstTs));
  windowStart.setHours(0, 0, 0, 0);
  let weekendDays = 0;
  let weekdayDays = 0;
  for (const d = new Date(windowStart); d.getTime() <= Date.now(); d.setDate(d.getDate() + 1)) {
    const w = d.getDay();
    if (w === 0 || w === 6) weekendDays += 1;
    else weekdayDays += 1;
  }
  if (weekendDays >= 2 && weekdayDays >= 5) {
    const weekendAvg = weekendTotal / weekendDays;
    const weekdayAvg = weekdayTotal / weekdayDays;
    const base = weekdayAvg || 1;
    const deltaPct = Math.round(((weekendAvg - weekdayAvg) / base) * 100);
    if (Math.abs(deltaPct) >= 25 && weekendAvg > 1000 && weekdayAvg > 1000) {
      findings.push({ kind: 'weekend-vs-weekday', weekendAvg, weekdayAvg, deltaPct });
    }
  }

  /* 3. Category trend (90d / 3 months) */
  // Split into 3 ~30-day buckets and compare first vs last
  const bucket = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  recent.forEach((t) => {
    const age = Date.now() - new Date(t.date).getTime();
    const bucketIdx = Math.min(2, Math.max(0, 2 - Math.floor(age / (30 * 86400000))));
    const m = bucket[bucketIdx];
    m.set(t.cat, (m.get(t.cat) ?? 0) + Math.abs(t.amount));
  });

  let bestTrend: SpendingPattern | null = null;
  catTotals.forEach((total, cat) => {
    if (total < 30000) return;
    const first = bucket[0].get(cat) ?? 0;
    const last = bucket[2].get(cat) ?? 0;
    const base = first || 1;
    if (first < 10000) return; // need baseline
    const deltaPct = Math.round(((last - first) / base) * 100);
    if (Math.abs(deltaPct) < 30) return;
    if (!bestTrend || Math.abs(deltaPct) > Math.abs((bestTrend as { deltaPct: number }).deltaPct)) {
      bestTrend = {
        kind: 'category-trend',
        cat,
        firstMonthAvg: first,
        lastMonthAvg: last,
        deltaPct,
      };
    }
  });
  if (bestTrend) findings.push(bestTrend);

  return findings.slice(0, 3);
}

export const WEEKDAY_LABEL = (w: number) => WEEKDAY_NAMES[w] ?? '?';
