'use client';

import { ChevronLeft, ChevronRight, Download, Printer } from 'lucide-react';
import { useMemo, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import { SkeletonHome } from '@/components/Skeleton';
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

  if (!ready || !data) return <SkeletonHome />;
  const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();

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
        }} className="tap flex h-10 w-10 items-center justify-center rounded-full"
          style={{ background: 'var(--color-card)', color: 'var(--color-text-1)' }}
          aria-label="이전 달">
          <ChevronLeft size={20} strokeWidth={2.4} />
        </button>
        <p style={{ color: 'var(--color-text-2)', fontSize: 12, fontWeight: 700 }}>
          {data.monthTx.length}건의 거래
        </p>
        <button type="button" onClick={() => {
          const d = new Date(year, month + 1, 1);
          if (d > today) return;
          setYear(d.getFullYear()); setMonth(d.getMonth());
        }} disabled={isCurrentMonth}
          className="tap flex h-10 w-10 items-center justify-center rounded-full disabled:opacity-30"
          style={{ background: 'var(--color-card)', color: 'var(--color-text-1)' }}
          aria-label="다음 달">
          <ChevronRight size={20} strokeWidth={2.4} />
        </button>
      </section>

      {/* Hero — net + income/expense bar */}
      <section className="px-5 pb-3 pt-1 print:hidden">
        <div
          className="relative overflow-hidden rounded-2xl px-5 py-5"
          style={{
            background: data.income - data.expense >= 0
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
            <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: 800, letterSpacing: '0.04em' }}>
              {mode === 'business' ? '영업이익' : '순수익'}
            </p>
            <p className="tnum mt-1 tracking-tight" style={{
              color: '#fff', fontSize: 28, fontWeight: 900, letterSpacing: '-0.025em',
            }}>
              {data.income - data.expense >= 0 ? '+' : '−'}{fmt(data.income - data.expense)}원
            </p>
            {data.income + data.expense > 0 && (
              <div className="mt-3 flex h-[4px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.2)' }}>
                <div style={{
                  width: `${(data.income / (data.income + data.expense)) * 100}%`,
                  background: 'rgba(255,255,255,0.95)',
                }} />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-white">
              <div>
                <p style={{ opacity: 0.85, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em' }}>
                  {mode === 'business' ? '매출' : '수입'}
                </p>
                <p className="tnum mt-0.5" style={{ fontSize: 14, fontWeight: 800 }}>
                  +{fmt(data.income)}
                </p>
              </div>
              <div className="text-right">
                <p style={{ opacity: 0.85, fontSize: 10, fontWeight: 700, letterSpacing: '0.02em' }}>
                  {mode === 'business' ? '비용' : '지출'}
                </p>
                <p className="tnum mt-0.5" style={{ fontSize: 14, fontWeight: 800 }}>
                  −{fmt(data.expense)}
                </p>
              </div>
            </div>
          </div>
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
                  <CategoryIcon catId={cat} size={36} />
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
        <button type="button" onClick={exportCsv}
          className="tap flex h-12 items-center justify-center gap-1.5 rounded-xl"
          style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          <Download size={16} strokeWidth={2.4} />
          CSV 내보내기
        </button>
        <button type="button" onClick={printReport}
          className="tap flex h-12 items-center justify-center gap-1.5 rounded-xl"
          style={{ background: 'var(--color-text-1)', color: 'var(--color-card)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
          <Printer size={16} strokeWidth={2.4} />
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
