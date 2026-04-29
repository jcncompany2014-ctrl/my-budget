'use client';

import { useMemo, useState } from 'react';
import LineChart from '@/components/LineChart';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import { fmt } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

const REVENUE_CATS = ['biz_sales_card', 'biz_sales_cash', 'biz_sales_xfer', 'biz_sales_app', 'biz_other'];

/**
 * Very simple inventory estimate: cumulative purchases − cumulative revenue × cogs ratio
 * Default cogs ratio = 50% (user can adjust)
 */
export default function InventoryPage() {
  const { tx, ready } = useTransactions();
  const [cogsRate, setCogsRate] = useState(0.5);

  const data = useMemo(() => {
    if (!ready) return null;
    // 6 months of purchase + revenue
    const now = new Date();
    const months: { label: string; purchase: number; revenue: number; estCogs: number; netStock: number }[] = [];
    let cumulativePurchase = 0;
    let cumulativeRevenue = 0;
    for (let i = 5; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthTx = tx.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
      });
      const purchase = monthTx
        .filter((t) => t.cat === 'biz_purchase' && t.amount < 0)
        .reduce((s, t) => s + Math.abs(t.amount), 0);
      const revenue = monthTx
        .filter((t) => t.amount > 0 && REVENUE_CATS.includes(t.cat))
        .reduce((s, t) => s + t.amount, 0);
      cumulativePurchase += purchase;
      cumulativeRevenue += revenue;
      const estCogs = revenue * cogsRate;
      months.push({
        label: `${m.getMonth() + 1}월`,
        purchase,
        revenue,
        estCogs,
        netStock: cumulativePurchase - cumulativeRevenue * cogsRate,
      });
    }
    const currentStock = months[months.length - 1]?.netStock ?? 0;
    return { months, currentStock };
  }, [tx, cogsRate, ready]);

  if (!data) return null;

  return (
    <>
      <TopBar title="재고 추정" />

      <Section topGap={4} bottomGap={4}>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          매입에서 매출원가 추정치를 빼서 남은 재고 가치를 계산. 정확한 실사 재고와 다를 수 있습니다.
        </p>
      </Section>

      <Section bottomGap={4}>
        <Card padding={20} background="linear-gradient(135deg, var(--color-primary-grad-from), var(--color-primary-grad-to))">
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            현재 추정 재고 가치
          </p>
          <Money value={data.currentStock} sign="auto"
            className="mt-1 block tracking-tight"
            style={{ color: '#fff', fontSize: 'var(--text-2xl)', fontWeight: 800 }} />
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            매입원가 합계 − (매출 × 매출원가율)
          </p>
        </Card>
      </Section>

      <Section title="매출원가율">
        <Card padding={16}>
          <p className="mb-2" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
            업종별로 다름. 음식점 30~40%, 소매업 60~80% 정도가 일반적.
          </p>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0.1"
              max="0.95"
              step="0.05"
              value={cogsRate}
              onChange={(e) => setCogsRate(Number(e.target.value))}
              className="flex-1"
              style={{ accentColor: 'var(--color-primary)' }}
            />
            <span className="tnum" style={{ color: 'var(--color-primary)', fontSize: 'var(--text-base)', fontWeight: 800, minWidth: 56, textAlign: 'right' }}>
              {Math.round(cogsRate * 100)}%
            </span>
          </div>
        </Card>
      </Section>

      <Section title="6개월 추이">
        <Card padding={16}>
          <LineChart
            labels={data.months.map((m) => m.label)}
            height={120}
            series={[
              { values: data.months.map((m) => m.purchase), color: 'var(--color-orange-500)' },
              { values: data.months.map((m) => m.estCogs), color: 'var(--color-primary)' },
            ]}
          />
          <div className="mt-2 flex items-center justify-center gap-4">
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
              <span style={{ color: 'var(--color-orange-500)', fontWeight: 700 }}>●</span> 매입
            </span>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>●</span> 추정 매출원가
            </span>
          </div>
        </Card>
      </Section>

      <Section title="월별 상세" bottomGap={40}>
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          {data.months.map((m, i, arr) => (
            <div key={i} className="px-4 py-3"
              style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
              <div className="flex items-baseline justify-between">
                <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                  {m.label}
                </span>
                <Money value={m.netStock} sign="auto"
                  style={{
                    color: m.netStock >= 0 ? 'var(--color-text-1)' : 'var(--color-danger)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 700,
                  }} />
              </div>
              <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
                <span className="tnum" style={{ color: 'var(--color-orange-500)', fontWeight: 600 }}>
                  매입 {fmt(m.purchase)}
                </span>
                <span className="tnum" style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                  매출 {fmt(m.revenue)}
                </span>
                <span className="tnum" style={{ color: 'var(--color-text-3)', fontWeight: 600 }}>
                  COGS ≈ {fmt(m.estCogs)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
