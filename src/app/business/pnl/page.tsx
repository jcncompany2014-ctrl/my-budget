'use client';

import { useMemo, useState } from 'react';
import CountUp from '@/components/CountUp';
import CategoryIcon from '@/components/icons/CategoryIcon';
import LineChart from '@/components/LineChart';
import Money from '@/components/Money';
import { SkeletonHome } from '@/components/Skeleton';
import TopBar from '@/components/TopBar';
import Card from '@/components/ui/Card';
import IconCircle from '@/components/ui/IconCircle';
import Pill from '@/components/ui/Pill';
import Section from '@/components/ui/Section';
import { CATEGORIES } from '@/lib/categories';
import { useEmployees } from '@/lib/employees';
import { useLocations } from '@/lib/locations';
import { fmt } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

type Period = 'month' | 'quarter' | 'year';

const REVENUE_CATS = ['biz_sales_card', 'biz_sales_cash', 'biz_sales_xfer', 'biz_sales_app', 'biz_other'];
const COGS_CATS = ['biz_purchase'];
const FIXED_CATS = ['biz_rent', 'biz_payroll', 'biz_utility', 'biz_insurance']; // 고정비
const VARIABLE_CATS = ['biz_marketing', 'biz_supplies', 'biz_meal', 'biz_travel', 'biz_fee', 'biz_etc']; // 변동비

export default function PnLPage() {
  const { tx, ready } = useTransactions();
  const { items: employees } = useEmployees();
  const { items: locations } = useLocations();
  const [period, setPeriod] = useState<Period>('month');

  const data = useMemo(() => {
    if (!ready) return null;
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
    let fixedSga = 0;
    let variableSga = 0;
    const byCategory = new Map<string, number>();
    const byLocation = new Map<string, { revenue: number; expense: number }>();
    tx.forEach((t) => {
      const d = new Date(t.date);
      if (d < from || d > to) return;
      const isRev = REVENUE_CATS.includes(t.cat) && t.amount > 0;
      if (isRev) revenue += t.amount;
      if (COGS_CATS.includes(t.cat) && t.amount < 0) cogs += Math.abs(t.amount);
      if (FIXED_CATS.includes(t.cat) && t.amount < 0) {
        fixedSga += Math.abs(t.amount);
        byCategory.set(t.cat, (byCategory.get(t.cat) ?? 0) + Math.abs(t.amount));
      }
      if (VARIABLE_CATS.includes(t.cat) && t.amount < 0) {
        variableSga += Math.abs(t.amount);
        byCategory.set(t.cat, (byCategory.get(t.cat) ?? 0) + Math.abs(t.amount));
      }
      if (t.location) {
        const cur = byLocation.get(t.location) ?? { revenue: 0, expense: 0 };
        if (t.amount > 0) cur.revenue += t.amount;
        else cur.expense += Math.abs(t.amount);
        byLocation.set(t.location, cur);
      }
    });

    const monthsInPeriod = period === 'month' ? 1 : period === 'quarter' ? 3 : 12;
    const employeeCost = employees.filter((e) => e.active).reduce((s, e) => s + e.baseSalary, 0) * monthsInPeriod * 1.1;
    const sga = fixedSga + variableSga + employeeCost;
    const gross = revenue - cogs;
    const operating = gross - sga;
    const tax = Math.max(0, Math.round(operating * 0.10));
    return { revenue, cogs, fixedSga, variableSga, sga, gross, operating, byCategory, byLocation, tax, employeeCost };
  }, [tx, employees, period, ready]);

  // 6-month operating income trend
  const trend = useMemo(() => {
    if (!ready) return [];
    const now = new Date();
    const months: { label: string; operating: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthTx = tx.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
      });
      const revenue = monthTx.filter((t) => t.amount > 0 && REVENUE_CATS.includes(t.cat)).reduce((s, t) => s + t.amount, 0);
      const cogs = monthTx.filter((t) => COGS_CATS.includes(t.cat) && t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
      const sga = monthTx
        .filter((t) => (FIXED_CATS.includes(t.cat) || VARIABLE_CATS.includes(t.cat)) && t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const empCost = employees.filter((e) => e.active).reduce((s, e) => s + e.baseSalary, 0) * 1.1;
      months.push({
        label: `${m.getMonth() + 1}월`,
        operating: revenue - cogs - sga - empCost,
      });
    }
    return months;
  }, [tx, employees, ready]);

  if (!data) return <SkeletonHome />;
  const margin = data.revenue > 0 ? Math.round((data.operating / data.revenue) * 100) : 0;
  const fixedRatio = data.revenue > 0 ? Math.round(((data.fixedSga + data.employeeCost) / data.revenue) * 100) : 0;
  const variableRatio = data.revenue > 0 ? Math.round((data.variableSga / data.revenue) * 100) : 0;
  const cogsRatio = data.revenue > 0 ? Math.round((data.cogs / data.revenue) * 100) : 0;

  return (
    <>
      <TopBar title="손익계산서" />

      <Section topGap={4} bottomGap={4}>
        <div className="flex gap-1.5">
          {([['month', '이번 달'], ['quarter', '이번 분기'], ['year', '올해']] as const).map(([k, label]) => (
            <Pill key={k} tone="primary" active={period === k} onClick={() => setPeriod(k)}>
              {label}
            </Pill>
          ))}
        </div>
      </Section>

      <Section bottomGap={4}>
        <div
          className="relative overflow-hidden rounded-2xl px-5 py-5"
          style={{
            background: data.operating >= 0
              ? 'linear-gradient(135deg, var(--color-primary-grad-from) 0%, var(--color-primary-grad-to) 100%)'
              : 'linear-gradient(135deg, #F04452 0%, #C71F2D 100%)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.16)',
          }}
        >
          <div aria-hidden style={{
            position: 'absolute', top: -40, right: -40,
            width: 180, height: 180, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.20) 0%, transparent 60%)',
            pointerEvents: 'none',
          }} />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 11, fontWeight: 800, letterSpacing: '0.04em',
              }}>
                영업이익
              </p>
              <span
                className="tnum"
                style={{
                  padding: '3px 8px', borderRadius: 999,
                  background: 'rgba(255,255,255,0.20)',
                  color: '#fff',
                  fontSize: 10, fontWeight: 800,
                }}
              >
                마진 {margin}%
              </span>
            </div>
            <CountUp
              value={data.operating}
              format={(n) => (n >= 0 ? '+' : '−') + fmt(Math.abs(n)) + '원'}
              className="mt-1.5 block tracking-tight"
              style={{
                color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: '-0.025em',
              }}
            />
            <p className="tnum mt-1" style={{
              color: 'rgba(255,255,255,0.85)', fontSize: 11, fontWeight: 600,
            }}>
              매출 {fmt(data.revenue)}원
            </p>
          </div>
        </div>
      </Section>

      {/* 6-month operating income line chart */}
      <Section title="영업이익 6개월 추이">
        <Card padding={16}>
          <LineChart
            labels={trend.map((m) => m.label)}
            height={120}
            series={[{ values: trend.map((m) => m.operating), color: 'var(--color-primary)' }]}
          />
        </Card>
      </Section>

      {/* Cost mix */}
      <Section title="비용 구조">
        <Card padding={16}>
          <div className="space-y-2.5">
            <CostRow label="매출원가" value={data.cogs} ratio={cogsRatio} color="var(--color-orange-500)" />
            <CostRow label="고정비" value={data.fixedSga + data.employeeCost} ratio={fixedRatio} color="var(--color-blue-500)" hint="임대료·인건비·공과금" />
            <CostRow label="변동비" value={data.variableSga} ratio={variableRatio} color="var(--color-purple-500)" hint="마케팅·소모품·기타" />
          </div>
          <div className="mt-3 rounded-xl px-3 py-2" style={{ background: 'var(--color-gray-100)' }}>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}>
              손익분기점 (BEP) 추정
            </p>
            <Money
              value={data.fixedSga + data.employeeCost}
              sign="never"
              className="mt-0.5 block"
              style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
            />
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
              매출이 이 금액 넘으면 영업이익 발생
            </p>
          </div>
        </Card>
      </Section>

      <Section title="손익계산서">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          <Row label="매출액 (Revenue)" value={data.revenue} bold />
          <Row label="(−) 매출원가 (COGS)" value={data.cogs} muted />
          <Row label="매출총이익 (Gross Profit)" value={data.gross} highlight />
          <Row label="(−) 고정비" value={data.fixedSga + data.employeeCost} muted />
          <Row label="(−) 변동비" value={data.variableSga} muted />
          <Row label="영업이익 (Operating)" value={data.operating} highlight strong />
          <Row label="추정 세금 (10%)" value={data.tax} muted last />
        </div>
      </Section>

      {/* Per-location breakdown */}
      {data.byLocation.size > 0 && (
        <Section title="매장별 손익">
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {Array.from(data.byLocation.entries()).map(([locId, val], i, arr) => {
              const loc = locations.find((l) => l.id === locId);
              const profit = val.revenue - val.expense;
              return (
                <div key={locId} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <IconCircle size={36} background={loc ? `${loc.color}1f` : 'var(--color-gray-150)'} fontSize={16}>
                    {loc?.emoji ?? '🏪'}
                  </IconCircle>
                  <div className="min-w-0 flex-1">
                    <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                      {loc?.name ?? '미분류'}
                    </p>
                    <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                      매출 {fmt(val.revenue)} · 비용 {fmt(val.expense)}
                    </p>
                  </div>
                  <Money value={profit} sign="auto"
                    style={{
                      color: profit >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                    }} />
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {data.byCategory.size > 0 && (
        <Section title="판관비 세부" bottomGap={40}>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {Array.from(data.byCategory.entries())
              .sort((a, b) => b[1] - a[1])
              .map(([cat, val], i, arr) => {
                const c = CATEGORIES[cat];
                return (
                  <div key={cat} className="flex items-center gap-3 px-4 py-3"
                    style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                    <CategoryIcon catId={cat} size={36} />
                    <span className="flex-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                      {c?.name ?? cat}
                    </span>
                    <Money value={val} sign="never" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }} />
                  </div>
                );
              })}
          </div>
        </Section>
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

function CostRow({ label, value, ratio, color, hint }: { label: string; value: number; ratio: number; color: string; hint?: string }) {
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
          {label} {hint && <span style={{ color: 'var(--color-text-3)', fontWeight: 500 }}>· {hint}</span>}
        </span>
        <span className="tnum" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
          {fmt(value)}원 <span style={{ color: 'var(--color-text-3)', fontWeight: 500 }}>({ratio}%)</span>
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-150)' }}>
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, ratio)}%`, background: color }} />
      </div>
    </div>
  );
}
