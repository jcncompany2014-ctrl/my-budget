'use client';

import { useMemo, useState } from 'react';
import Money from '@/components/Money';
import Card from '@/components/ui/Card';
import Section from '@/components/ui/Section';
import TopBar from '@/components/TopBar';
import { CATEGORIES } from '@/lib/categories';
import { fmt, isExpense } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

const DEDUCTIBLE_CATS = {
  health: '의료비',
  education: '교육비',
  culture: '문화비',
  shopping: '쇼핑 (신용카드 사용액)',
  food: '식비 (신용카드)',
  cafe: '카페·간식 (신용카드)',
  transit: '교통비 (대중교통)',
};

export default function YearEndTaxPage() {
  const { tx, ready } = useTransactions();
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());

  const totals = useMemo(() => {
    if (!ready) return null;
    const yearTx = tx.filter((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === year && (t.scope ?? 'personal') === 'personal' && isExpense(t);
    });
    const totalSpend = yearTx.reduce((s, t) => s + Math.abs(t.amount), 0);
    const byCat = new Map<string, number>();
    yearTx.forEach((t) => byCat.set(t.cat, (byCat.get(t.cat) ?? 0) + Math.abs(t.amount)));
    const deductible = Object.keys(DEDUCTIBLE_CATS).reduce((s, c) => s + (byCat.get(c) ?? 0), 0);
    return { yearTx, totalSpend, byCat, deductible };
  }, [tx, year, ready]);

  if (!totals) return null;

  return (
    <>
      <TopBar title="연말정산 도우미" />

      <Section topGap={8} bottomGap={8}>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          연말정산 시 공제 가능한 카테고리별 사용액을 미리 확인. 실제 공제는 신용카드 vs 현금영수증, 총급여 25% 초과분 등 조건에 따라 다름.
        </p>
      </Section>

      <Section topGap={4} bottomGap={4}>
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => setYear(year - 1)} className="tap rounded-full px-3 py-2"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            ← {year - 1}년
          </button>
          <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
            {year}년
          </span>
          <button type="button" onClick={() => setYear(Math.min(today.getFullYear(), year + 1))} className="tap rounded-full px-3 py-2"
            style={{ background: 'var(--color-card)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            {year + 1}년 →
          </button>
        </div>
      </Section>

      <Section bottomGap={8}>
        <Card padding={20} background="linear-gradient(135deg, var(--color-primary-grad-from), var(--color-primary-grad-to))">
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            공제 대상 추정 사용액
          </p>
          <Money value={totals.deductible} sign="never"
            className="mt-1 block tracking-tight"
            style={{ color: '#fff', fontSize: 'var(--text-2xl)', fontWeight: 800 }} />
          <p className="mt-2" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-xxs)' }}>
            연간 총 지출 {fmt(totals.totalSpend)}원 중 약 {totals.totalSpend > 0 ? Math.round((totals.deductible / totals.totalSpend) * 100) : 0}%
          </p>
        </Card>
      </Section>

      <Section title="카테고리별 사업액">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          {Object.entries(DEDUCTIBLE_CATS).map(([cat, label], i, arr) => {
            const used = totals.byCat.get(cat) ?? 0;
            const c = CATEGORIES[cat];
            return (
              <div key={cat} className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                <span style={{ fontSize: 18, lineHeight: 1 }}>{c?.emoji ?? '💰'}</span>
                <span className="flex-1" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                  {label}
                </span>
                <Money value={used} sign="never"
                  style={{ color: used > 0 ? 'var(--color-text-1)' : 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }} />
              </div>
            );
          })}
        </div>
      </Section>

      <Section bottomGap={40}>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
          ※ 본 화면은 사용액 추정치입니다. 실제 공제는 국세청 홈택스 또는 회사 연말정산 서비스 결과를 따르세요.
        </p>
      </Section>
    </>
  );
}
