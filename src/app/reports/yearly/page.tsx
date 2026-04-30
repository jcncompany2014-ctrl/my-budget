'use client';

import { useMemo, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { CATEGORIES } from '@/lib/categories';
import { fmt, isExpense, isIncome } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';

export default function YearlyReportPage() {
  const { tx, ready } = useAllTransactions();
  const { mode } = useMode();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());

  const data = useMemo(() => {
    if (!ready)
      return null;
    const yearTx = tx.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (t.scope ?? 'personal') === mode;
    });
    const monthly = Array(12).fill(0).map(() => ({ income: 0, expense: 0 }));
    yearTx.forEach((t) => {
      const m = new Date(t.date).getMonth();
      if (isExpense(t)) monthly[m].expense += Math.abs(t.amount);
      if (isIncome(t)) monthly[m].income += t.amount;
    });
    const totalIncome = monthly.reduce((s, m) => s + m.income, 0);
    const totalExpense = monthly.reduce((s, m) => s + m.expense, 0);

    // Top merchant of the year
    const merchantTotal = new Map<string, number>();
    yearTx.filter(isExpense).forEach((t) =>
      merchantTotal.set(t.merchant, (merchantTotal.get(t.merchant) ?? 0) + Math.abs(t.amount)),
    );
    const topMerchants = Array.from(merchantTotal.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    // Top category
    const catTotal = new Map<string, number>();
    yearTx.filter(isExpense).forEach((t) =>
      catTotal.set(t.cat, (catTotal.get(t.cat) ?? 0) + Math.abs(t.amount)),
    );
    const topCats = Array.from(catTotal.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    return { yearTx, monthly, totalIncome, totalExpense, topMerchants, topCats };
  }, [tx, year, mode, ready]);

  if (!data) return null;
  const maxMonthly = Math.max(...data.monthly.map((m) => Math.max(m.income, m.expense)), 1);

  return (
    <>
      <TopBar title={`${year}년 연간 리포트`} />

      <section className="flex items-center justify-between px-5 pb-3 pt-1 print:hidden">
        <button type="button" onClick={() => setYear(year - 1)} className="tap rounded-full px-3 py-2"
          style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          ← {year - 1}년
        </button>
        <button type="button" onClick={() => setYear(Math.min(today.getFullYear(), year + 1))} className="tap rounded-full px-3 py-2"
          style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          {year + 1}년 →
        </button>
      </section>

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-5" style={{ background: 'linear-gradient(135deg, var(--color-primary-grad-from), var(--color-primary-grad-to))' }}>
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            올해의 {mode === 'business' ? '영업이익' : '순수익'}
          </p>
          <Money value={data.totalIncome - data.totalExpense} sign="auto"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: '#fff' }} />
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs" style={{ color: 'rgba(255,255,255,0.9)' }}>
            <div>
              <p style={{ opacity: 0.85 }}>{mode === 'business' ? '매출' : '수입'}</p>
              <p className="tnum" style={{ fontWeight: 700, fontSize: 13 }}>+{fmt(data.totalIncome)}원</p>
            </div>
            <div>
              <p style={{ opacity: 0.85 }}>{mode === 'business' ? '비용' : '지출'}</p>
              <p className="tnum" style={{ fontWeight: 700, fontSize: 13 }}>−{fmt(data.totalExpense)}원</p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
            월별 추이
          </p>
          <div className="flex items-end gap-1" style={{ height: 100 }}>
            {data.monthly.map((m, i) => {
              const exH = (m.expense / maxMonthly) * 100;
              const inH = (m.income / maxMonthly) * 100;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1">
                  <div className="flex h-[80px] w-full items-end gap-[2px]">
                    <div className="flex-1 rounded-t-sm"
                      style={{ height: `${inH}%`, background: 'var(--color-primary)' }} />
                    <div className="flex-1 rounded-t-sm"
                      style={{ height: `${exH}%`, background: 'var(--color-danger)' }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--color-text-3)', fontWeight: 600 }}>
                    {i + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {data.topCats.length > 0 && (
        <section className="px-5 pb-3 pt-2">
          <p className="mb-2 px-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            올해의 카테고리 TOP 5
          </p>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {data.topCats.map(([cat, val], i, arr) => {
              const c = CATEGORIES[cat];
              return (
                <div key={cat} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <div className="flex h-7 w-7 items-center justify-center rounded-full font-bold"
                    style={{
                      background: i === 0 ? 'var(--color-primary)' : 'var(--color-gray-150)',
                      color: i === 0 ? '#fff' : 'var(--color-text-2)',
                      fontSize: 'var(--text-xxs)',
                    }}>{i + 1}</div>
                  <CategoryIcon catId={cat} size={28} />
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

      {data.topMerchants.length > 0 && (
        <section className="px-5 pb-10 pt-2">
          <p className="mb-2 px-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            올해의 소비처 TOP 5
          </p>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {data.topMerchants.map(([m, val], i, arr) => (
              <div key={m} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                <div className="flex h-7 w-7 items-center justify-center rounded-full font-bold"
                  style={{
                    background: i === 0 ? 'var(--color-primary)' : 'var(--color-gray-150)',
                    color: i === 0 ? '#fff' : 'var(--color-text-2)',
                    fontSize: 'var(--text-xxs)',
                  }}>{i + 1}</div>
                <span className="flex-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  {m}
                </span>
                <Money value={val} sign="never" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }} />
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 pb-10 pt-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="tap h-12 w-full rounded-xl"
          style={{ background: 'var(--color-text-1)', color: 'var(--color-card)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          PDF 인쇄
        </button>
      </section>

      <style jsx global>{`
        @media print {
          html, body { background: #fff !important; }
          nav, header[role="banner"] { display: none !important; }
          [class*="print:hidden"] { display: none !important; }
        }
      `}</style>
    </>
  );
}
