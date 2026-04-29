'use client';

import { useMemo, useState } from 'react';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import { fmt, isExpense } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

const REVENUE_CATS = ['biz_sales_card', 'biz_sales_cash', 'biz_sales_xfer', 'biz_sales_app', 'biz_other'];

/**
 * 2024 simplified income tax brackets (Korean 종합소득세):
 * - up to 14M: 6%
 * - 14M ~ 50M: 15% − 1.08M
 * - 50M ~ 88M: 24% − 5.22M
 * - 88M ~ 150M: 35% − 14.9M
 * - 150M ~ 300M: 38% − 19.4M
 * - 300M ~ 500M: 40% − 25.4M
 * - 500M ~ 1B: 42% − 35.4M
 * - over 1B: 45% − 65.4M
 */
function estimateIncomeTax(taxableIncome: number) {
  if (taxableIncome <= 0) return 0;
  const t = taxableIncome;
  if (t <= 14_000_000) return Math.round(t * 0.06);
  if (t <= 50_000_000) return Math.round(t * 0.15 - 1_080_000);
  if (t <= 88_000_000) return Math.round(t * 0.24 - 5_220_000);
  if (t <= 150_000_000) return Math.round(t * 0.35 - 14_900_000);
  if (t <= 300_000_000) return Math.round(t * 0.38 - 19_400_000);
  if (t <= 500_000_000) return Math.round(t * 0.40 - 25_400_000);
  if (t <= 1_000_000_000) return Math.round(t * 0.42 - 35_400_000);
  return Math.round(t * 0.45 - 65_400_000);
}

export default function IncomeTaxPage() {
  const { tx, ready } = useTransactions();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());

  const data = useMemo(() => {
    if (!ready) return null;
    const yearTx = tx.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year;
    });
    const revenue = yearTx
      .filter((t) => t.amount > 0 && REVENUE_CATS.includes(t.cat))
      .reduce((s, t) => s + t.amount, 0);
    const expense = yearTx
      .filter(isExpense)
      .reduce((s, t) => s + Math.abs(t.amount), 0);
    const taxableIncome = Math.max(0, revenue - expense);
    const incomeTax = estimateIncomeTax(taxableIncome);
    const localTax = Math.round(incomeTax * 0.10); // 지방소득세
    const total = incomeTax + localTax;
    const effectiveRate = taxableIncome > 0 ? (total / taxableIncome) * 100 : 0;
    return { revenue, expense, taxableIncome, incomeTax, localTax, total, effectiveRate };
  }, [tx, year, ready]);

  // Withholding 3.3% calculator state
  const [withholdingGross, setWithholdingGross] = useState('');
  const grossNum = Number(withholdingGross) || 0;
  const withholdingTax = Math.round(grossNum * 0.033);
  const netReceived = grossNum - withholdingTax;

  if (!data) return null;

  return (
    <>
      <TopBar title="종합소득세 / 원천세" />

      <Section topGap={4} bottomGap={4}>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          연간 누적 매출과 비용 기준 추정. 실제 세액은 공제·필요경비·종합소득공제에 따라 달라집니다.
        </p>
      </Section>

      <Section topGap={4} bottomGap={4}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setYear(year - 1)} className="tap rounded-full px-3 py-2"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            ← {year - 1}
          </button>
          <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>{year}년</span>
          <button type="button" onClick={() => setYear(Math.min(today.getFullYear(), year + 1))} className="tap rounded-full px-3 py-2"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            {year + 1} →
          </button>
        </div>
      </Section>

      <Section bottomGap={4}>
        <Card padding={20} background="linear-gradient(135deg, var(--color-primary-grad-from), var(--color-primary-grad-to))">
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            추정 종합소득세 + 지방소득세
          </p>
          <Money
            value={data.total}
            sign="never"
            className="mt-1 block tracking-tight"
            style={{ color: '#fff', fontSize: 'var(--text-2xl)', fontWeight: 800 }}
          />
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            과세표준 약 {fmt(data.taxableIncome)}원 · 실효세율 {data.effectiveRate.toFixed(1)}%
          </p>
        </Card>
      </Section>

      <Section title="산출 내역">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          <Row label="총 매출" value={data.revenue} />
          <Row label="(−) 총 비용" value={data.expense} muted />
          <Row label="과세표준" value={data.taxableIncome} highlight />
          <Row label="소득세" value={data.incomeTax} />
          <Row label="지방소득세 (10%)" value={data.localTax} muted />
          <Row label="합계" value={data.total} strong last />
        </div>
      </Section>

      <Section title="3.3% 원천세 계산기">
        <Card padding={16}>
          <p className="mb-2" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
            프리랜서 거래 시 지급액에서 3.3% 원천징수 후 입금됩니다. 총 지급액을 입력하면 실수령액을 보여줍니다.
          </p>
          <input
            type="number"
            inputMode="numeric"
            value={withholdingGross}
            onChange={(e) => setWithholdingGross(e.target.value)}
            placeholder="총 지급액 (예: 1000000)"
            className="tnum h-12 w-full rounded-xl px-4 outline-none"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
            }}
          />
          {grossNum > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-xl p-3" style={{ background: 'var(--color-danger-soft)' }}>
                <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
                  원천징수 (3.3%)
                </p>
                <Money value={withholdingTax} sign="never" className="mt-1 block"
                  style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 800 }} />
              </div>
              <div className="rounded-xl p-3" style={{ background: 'var(--color-primary-soft)' }}>
                <p style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
                  실수령액
                </p>
                <Money value={netReceived} sign="never" className="mt-1 block"
                  style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 800 }} />
              </div>
            </div>
          )}
        </Card>
      </Section>

      <Section bottomGap={40}>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
          ※ 본 화면은 추정치이며, 실제 신고는 홈택스 또는 세무사를 이용하세요. 종합소득공제·세액공제·필요경비율 미반영.
        </p>
      </Section>
    </>
  );
}

function Row({ label, value, muted, highlight, strong, last }: {
  label: string;
  value: number;
  muted?: boolean;
  highlight?: boolean;
  strong?: boolean;
  last?: boolean;
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
        fontWeight: strong ? 700 : 500,
      }}>{label}</span>
      <Money value={value} sign={muted ? 'never' : 'auto'}
        style={{
          color: muted ? 'var(--color-text-2)' : strong ? 'var(--color-primary)' : 'var(--color-text-1)',
          fontSize: 'var(--text-base)',
          fontWeight: strong ? 800 : 700,
        }} />
    </div>
  );
}
