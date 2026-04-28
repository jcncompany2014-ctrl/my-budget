'use client';

import { useMemo, useState } from 'react';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import { CATEGORIES } from '@/lib/categories';
import { useEmployees } from '@/lib/employees';
import { fmt } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

type Period = 'month' | 'quarter' | 'year';

const REVENUE_CATS = ['biz_sales_card', 'biz_sales_cash', 'biz_sales_xfer', 'biz_sales_app', 'biz_other'];
const COGS_CATS = ['biz_purchase'];
const SGA_CATS = ['biz_rent', 'biz_payroll', 'biz_utility', 'biz_marketing', 'biz_supplies', 'biz_meal', 'biz_travel', 'biz_insurance', 'biz_fee', 'biz_etc'];

export default function PnLPage() {
  const { tx, ready } = useTransactions();
  const { items: employees } = useEmployees();
  const [period, setPeriod] = useState<Period>('month');

  const data = useMemo(() => {
    if (!ready) return { revenue: 0, cogs: 0, sga: 0, gross: 0, operating: 0, byCategory: new Map<string, number>(), tax: 0 };
    const now = new Date();
    let from: Date, to: Date;
    if (period === 'month') {
      from = new Date(now.getFullYear(), now.getMonth(), 1);
      to = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    } else if (period === 'quarter') {
      const qStart = Math.floor(now.getMonth() / 3) * 3;
      from = new Date(now.getFullYear(), qStart, 1);
      to = new Date(now.getFullYear(), qStart + 3, 0, 23, 59, 59);
    } else {
      from = new Date(now.getFullYear(), 0, 1);
      to = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
    }

    let revenue = 0;
    let cogs = 0;
    let sga = 0;
    const byCategory = new Map<string, number>();
    tx.forEach((t) => {
      const d = new Date(t.date);
      if (d < from || d > to) return;
      if (REVENUE_CATS.includes(t.cat) && t.amount > 0) revenue += t.amount;
      if (COGS_CATS.includes(t.cat) && t.amount < 0) cogs += Math.abs(t.amount);
      if (SGA_CATS.includes(t.cat) && t.amount < 0) {
        sga += Math.abs(t.amount);
        byCategory.set(t.cat, (byCategory.get(t.cat) ?? 0) + Math.abs(t.amount));
      }
    });

    const monthsInPeriod = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
    const employeeCost = employees.filter((e) => e.active).reduce((s, e) => s + e.baseSalary, 0) * monthsInPeriod * 1.1;

    const gross = revenue - cogs;
    const operating = gross - sga - employeeCost;
    const tax = Math.max(0, Math.round(operating * 0.10)); // 추정 사업소득세 10% (단순 추정)
    return { revenue, cogs, sga: sga + employeeCost, gross, operating, byCategory, tax };
  }, [tx, employees, period, ready]);

  const margin = data.revenue > 0 ? Math.round((data.operating / data.revenue) * 100) : 0;

  return (
    <>
      <TopBar title="손익계산서" />

      <section className="px-5 pb-3 pt-1">
        <div className="flex gap-1.5">
          {(
            [
              ['month', '이번 달'],
              ['quarter', '이번 분기'],
              ['year', '올해'],
            ] as const
          ).map(([k, label]) => {
            const sel = period === k;
            return (
              <button key={k} type="button" onClick={() => setPeriod(k)} className="tap flex-1 rounded-xl py-2"
                style={{
                  background: sel ? 'var(--color-primary)' : 'var(--color-card)',
                  color: sel ? '#fff' : 'var(--color-text-2)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, var(--color-primary-grad-from), var(--color-primary-grad-to))' }}>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            영업이익
          </p>
          <Money value={data.operating} sign="auto"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: '#fff' }} />
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            마진율 {margin}% · 매출 {fmt(data.revenue)}원
          </p>
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          <Row label="매출액 (Revenue)" value={data.revenue} bold />
          <Row label="(−) 매출원가 (COGS)" value={data.cogs} muted />
          <Row label="매출총이익 (Gross Profit)" value={data.gross} highlight />
          <Row label="(−) 판매관리비 (SG&A, 인건비 포함)" value={data.sga} muted />
          <Row label="영업이익 (Operating)" value={data.operating} highlight strong />
          <Row label="추정 세금 (10%)" value={data.tax} muted last />
        </div>
      </section>

      {data.byCategory.size > 0 && (
        <section className="px-5 pb-10 pt-2">
          <h2 className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
            판관비 세부
          </h2>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {Array.from(data.byCategory.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([cat, val], i, arr) => {
                const c = CATEGORIES[cat];
                return (
                  <div key={cat} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full text-base"
                      style={{ background: c ? `${c.color}1f` : 'var(--color-gray-150)' }}>
                      {c?.emoji ?? '💰'}
                    </div>
                    <span className="flex-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      {c?.name ?? cat}
                    </span>
                    <Money value={val} sign="never" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }} />
                  </div>
                );
              })}
          </div>
        </section>
      )}
    </>
  );
}

function Row({ label, value, bold, muted, highlight, strong, last }: {
  label: string; value: number; bold?: boolean; muted?: boolean; highlight?: boolean; strong?: boolean; last?: boolean;
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3"
      style={{
        borderBottom: last ? 'none' : '1px solid var(--color-divider)',
        background: highlight ? 'var(--color-gray-50)' : undefined,
      }}>
      <span style={{
        color: muted ? 'var(--color-text-3)' : 'var(--color-text-1)',
        fontSize: 'var(--text-sm)',
        fontWeight: bold || strong ? 700 : 500,
      }}>{label}</span>
      <Money value={value} sign={muted ? 'never' : 'auto'}
        style={{
          color: muted ? 'var(--color-text-2)' : strong ? 'var(--color-primary)' : 'var(--color-text-1)',
          fontSize: 'var(--text-base)',
          fontWeight: bold || strong ? 800 : 700,
        }} />
    </div>
  );
}
