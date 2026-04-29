'use client';

import { useMemo, useState } from 'react';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import { fmt } from '@/lib/format';
import { useTransactions } from '@/lib/storage';
import { estimateVAT, useTaxpayerType } from '@/lib/taxpayer';

type Quarter = 1 | 2 | 3 | 4;

const QUARTER_RANGES: Record<Quarter, [number, number]> = {
  1: [0, 2],
  2: [3, 5],
  3: [6, 8],
  4: [9, 11],
};

const REVENUE_CATS = new Set([
  'biz_sales_card',
  'biz_sales_cash',
  'biz_sales_xfer',
  'biz_sales_app',
  'biz_other',
]);
const PURCHASE_CATS = new Set([
  'biz_purchase',
  'biz_supplies',
  'biz_marketing',
  'biz_meal',
  'biz_travel',
  'biz_etc',
]);

export default function VATPage() {
  const { tx, ready } = useTransactions();
  const { value: taxType } = useTaxpayerType();
  const today = new Date();
  const currentQuarter = (Math.floor(today.getMonth() / 3) + 1) as Quarter;
  const [year, setYear] = useState(today.getFullYear());
  const [quarter, setQuarter] = useState<Quarter>(currentQuarter);

  const summary = useMemo(() => {
    if (!ready) return { revenue: 0, purchase: 0, output: 0, input: 0, payable: 0 };
    const [from, to] = QUARTER_RANGES[quarter];
    let revenue = 0;
    let purchase = 0;
    tx.forEach((t) => {
      const d = new Date(t.date);
      if (d.getFullYear() !== year) return;
      const m = d.getMonth();
      if (m < from || m > to) return;
      // Only operational sales/purchases — exclude transfers, owner draws, payroll, rent, utilities, taxes
      if (t.amount > 0 && REVENUE_CATS.has(t.cat)) revenue += t.amount;
      else if (t.amount < 0 && PURCHASE_CATS.has(t.cat)) purchase += Math.abs(t.amount);
    });
    const payable = estimateVAT(revenue, purchase, taxType);
    const output = Math.round(revenue / 11);
    const input = Math.round(purchase / 11);
    return { revenue, purchase, output, input, payable };
  }, [tx, year, quarter, ready, taxType]);

  return (
    <>
      <TopBar title="부가세 신고 도우미" />

      <section className="px-5 pb-3 pt-1">
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          분기말 부가세 신고 준비. 매출세액에서 매입세액을 차감한 금액이 납부 예상액입니다.
          (간이과세자는 다른 계산식 적용)
        </p>
      </section>

      <section className="px-5 pb-3 pt-2">
        <div className="flex gap-2">
          <button type="button" onClick={() => setYear(year - 1)} className="tap rounded-xl px-4"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', height: 44, fontSize: 'var(--text-sm)', fontWeight: 700 }}>‹</button>
          <div className="flex-1 rounded-xl px-4 text-center"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', lineHeight: '44px', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            {year}년 {quarter}분기 ({year}-{String((quarter - 1) * 3 + 1).padStart(2, '0')} ~ {year}-{String(quarter * 3).padStart(2, '0')})
          </div>
          <button type="button" onClick={() => setYear(year + 1)} className="tap rounded-xl px-4"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', height: 44, fontSize: 'var(--text-sm)', fontWeight: 700 }}>›</button>
        </div>
      </section>

      <section className="px-5 pb-3 pt-1">
        <div className="grid grid-cols-4 gap-1.5">
          {([1, 2, 3, 4] as Quarter[]).map((q) => {
            const sel = q === quarter;
            return (
              <button key={q} type="button" onClick={() => setQuarter(q)}
                className="tap rounded-xl py-2"
                style={{
                  background: sel ? 'var(--color-primary)' : 'var(--color-card)',
                  color: sel ? '#fff' : 'var(--color-text-2)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                }}>
                {q}분기
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 pb-3 pt-3">
        <div className="rounded-2xl p-5"
          style={{ background: 'linear-gradient(135deg, var(--color-primary-grad-from), var(--color-primary-grad-to))' }}>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            예상 납부 부가세
          </p>
          <Money value={summary.payable} sign="never"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: '#fff' }} />
          <p style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            매출세액 {fmt(summary.output)}원 - 매입세액 {fmt(summary.input)}원
          </p>
        </div>
      </section>

      <section className="px-5 pb-10 pt-3">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          <Row label="매출 합계" value={summary.revenue} />
          <Row label="매출세액 (1/11)" value={summary.output} highlight="primary" />
          <Row label="매입 합계" value={summary.purchase} />
          <Row label="매입세액 (1/11)" value={summary.input} highlight="primary" />
          <Row label="납부 예상액" value={summary.payable} highlight="strong" last />
        </div>
        <p className="mt-3 px-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
          ※ 실제 부가세 신고 금액은 사업 형태(일반/간이), 면세 거래, 세금계산서 수취 여부 등에 따라 달라집니다.
          본 화면은 추정치이며 실제 신고는 세무사 또는 홈택스를 이용하세요.
        </p>
      </section>
    </>
  );
}

function Row({ label, value, highlight, last }: { label: string; value: number; highlight?: 'primary' | 'strong'; last?: boolean }) {
  const color = highlight === 'strong' ? 'var(--color-text-1)' : highlight === 'primary' ? 'var(--color-primary)' : 'var(--color-text-1)';
  const weight = highlight === 'strong' ? 800 : 700;
  return (
    <div className="flex items-center justify-between px-4 py-3"
      style={{ borderBottom: last ? 'none' : '1px solid var(--color-divider)' }}>
      <span style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>{label}</span>
      <Money value={value} sign="never" style={{ color, fontSize: 'var(--text-base)', fontWeight: weight }} />
    </div>
  );
}
