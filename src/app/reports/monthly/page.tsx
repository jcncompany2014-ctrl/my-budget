'use client';

import { useMemo, useState } from 'react';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useAllAccounts } from '@/lib/accounts';
import { CATEGORIES } from '@/lib/categories';
import { transactionsToCSV, downloadCSV } from '@/lib/csv';
import { fmt, isExpense, isIncome } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';

export default function MonthlyReportPage() {
  const { tx, ready } = useAllTransactions();
  const { accounts } = useAllAccounts();
  const { mode } = useMode();
  const toast = useToast();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const data = useMemo(() => {
    if (!ready) return null;
    const monthTx = tx.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && d.getMonth() === month && (t.scope ?? 'personal') === mode;
    });
    const expense = monthTx.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
    const income = monthTx.filter(isIncome).reduce((s, t) => s + t.amount, 0);
    const byCat = new Map<string, number>();
    monthTx.filter(isExpense).forEach((t) => byCat.set(t.cat, (byCat.get(t.cat) ?? 0) + Math.abs(t.amount)));
    const sorted = Array.from(byCat.entries()).sort((a, b) => b[1] - a[1]);
    return { monthTx, expense, income, sorted };
  }, [tx, year, month, mode, ready]);

  if (!data) return null;

  const accById: Record<string, { name: string }> = {};
  accounts.forEach((a) => { accById[a.id] = { name: a.name }; });

  const exportCsv = () => {
    const csv = transactionsToCSV(data.monthTx, accById);
    downloadCSV(`asset-${mode}-${year}-${String(month + 1).padStart(2, '0')}.csv`, csv);
    toast.show('CSV 내보내기 완료', 'success');
  };

  const printReport = () => {
    window.print();
  };

  return (
    <>
      <TopBar
        title={`${year}년 ${month + 1}월 리포트`}
      />

      <section className="flex items-center justify-between px-5 pb-3 pt-1 print:hidden">
        <button type="button" onClick={() => {
          const d = new Date(year, month - 1, 1);
          setYear(d.getFullYear()); setMonth(d.getMonth());
        }} className="tap rounded-full px-3 py-2"
          style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          ← 이전
        </button>
        <button type="button" onClick={() => {
          const d = new Date(year, month + 1, 1);
          if (d > today) return;
          setYear(d.getFullYear()); setMonth(d.getMonth());
        }} className="tap rounded-full px-3 py-2"
          style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          다음 →
        </button>
      </section>

      <section className="px-5 pb-3 pt-1">
        <div className="grid grid-cols-2 gap-2">
          <Card label={mode === 'business' ? '매출' : '수입'} value={data.income} tone="primary" />
          <Card label={mode === 'business' ? '비용' : '지출'} value={data.expense} tone="danger" />
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
            {mode === 'business' ? '영업이익' : '순수익'}
          </p>
          <Money value={data.income - data.expense} sign="auto"
            className="mt-1 block tracking-tight"
            style={{
              fontSize: 'var(--text-2xl)',
              fontWeight: 800,
              color: data.income - data.expense >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
            }} />
        </div>
      </section>

      {data.sorted.length > 0 && (
        <section className="px-5 pb-3 pt-2">
          <h2 className="mb-3" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
            카테고리별 지출
          </h2>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {data.sorted.map(([cat, val], i, arr) => {
              const c = CATEGORIES[cat];
              const pct = data.expense > 0 ? Math.round((val / data.expense) * 100) : 0;
              return (
                <div key={cat} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-base"
                    style={{ background: c ? `${c.color}1f` : 'var(--color-gray-150)' }}>
                    {c?.emoji ?? '💰'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between">
                      <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                        {c?.name ?? cat}
                      </span>
                      <Money value={val} sign="never"
                        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }} />
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1 flex-1 overflow-hidden rounded-full" style={{ background: 'var(--color-gray-150)' }}>
                        <div className="h-full rounded-full"
                          style={{ width: `${pct}%`, background: c?.color ?? 'var(--color-primary)' }} />
                      </div>
                      <span className="tnum" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', minWidth: 32, textAlign: 'right' }}>{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-2 px-5 pb-10 pt-2 print:hidden">
        <button type="button" onClick={exportCsv} className="tap h-12 rounded-xl"
          style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          CSV 내보내기
        </button>
        <button type="button" onClick={printReport} className="tap h-12 rounded-xl"
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

function Card({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'danger' }) {
  return (
    <div className="rounded-2xl p-3" style={{ background: 'var(--color-card)' }}>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>{label}</p>
      <Money value={value} sign={tone === 'primary' ? 'positive' : 'negative'}
        className="mt-1 block"
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 800,
          color: tone === 'primary' ? 'var(--color-primary)' : 'var(--color-danger)',
        }} />
    </div>
  );
}
