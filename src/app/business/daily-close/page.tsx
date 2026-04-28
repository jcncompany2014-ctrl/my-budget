'use client';

import { useMemo, useState } from 'react';
import Money from '@/components/Money';
import Card from '@/components/ui/Card';
import IconCircle from '@/components/ui/IconCircle';
import Section from '@/components/ui/Section';
import TopBar from '@/components/TopBar';
import TxRow from '@/components/TxRow';
import { CATEGORIES } from '@/lib/categories';
import { fmt } from '@/lib/format';
import { useLocations } from '@/lib/locations';
import { useTransactions } from '@/lib/storage';

const REVENUE_CATS = ['biz_sales_card', 'biz_sales_cash', 'biz_sales_xfer', 'biz_sales_app', 'biz_other'];

export default function DailyClosePage() {
  const { tx, ready } = useTransactions();
  const { items: locations, activeId } = useLocations();
  const today = new Date();
  const [date, setDate] = useState(today.toISOString().slice(0, 10));

  const data = useMemo(() => {
    if (!ready) return null;
    const dayTx = tx.filter((t) => t.date.slice(0, 10) === date && (!activeId || t.location === activeId));
    const revenue = dayTx.filter((t) => t.amount > 0 && REVENUE_CATS.includes(t.cat)).reduce((s, t) => s + t.amount, 0);
    const expense = dayTx.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
    const byChannel = new Map<string, number>();
    dayTx.filter((t) => REVENUE_CATS.includes(t.cat)).forEach((t) => {
      byChannel.set(t.cat, (byChannel.get(t.cat) ?? 0) + t.amount);
    });
    return { dayTx, revenue, expense, byChannel };
  }, [tx, date, activeId, ready]);

  if (!data) return null;

  const activeLoc = locations.find((l) => l.id === activeId);

  return (
    <>
      <TopBar title="일일 마감" />

      <Section topGap={8} bottomGap={8}>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-card)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 600,
          }}
        />
        {activeLoc && (
          <p
            className="mt-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
          >
            🏪 {activeLoc.name} 사업장 기준
          </p>
        )}
      </Section>

      <Section bottomGap={8}>
        <Card padding={20} background="linear-gradient(135deg, var(--color-primary-grad-from), var(--color-primary-grad-to))">
          <p style={{ color: 'rgba(255,255,255,0.9)', fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            {date}일 매출
          </p>
          <Money
            value={data.revenue}
            sign="never"
            className="mt-1 block tracking-tight"
            style={{ color: '#fff', fontSize: 'var(--text-2xl)', fontWeight: 800 }}
          />
          <p className="mt-2" style={{ color: 'rgba(255,255,255,0.85)', fontSize: 'var(--text-xxs)' }}>
            거래 {data.dayTx.length}건 · 비용 −{fmt(data.expense)}원
          </p>
        </Card>
      </Section>

      {data.byChannel.size > 0 && (
        <Section title="채널별 매출">
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {Array.from(data.byChannel.entries()).map(([cat, val], i, arr) => {
              const c = CATEGORIES[cat];
              return (
                <div key={cat} className="flex items-center gap-3 px-4 py-3"
                  style={{ borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none' }}>
                  <IconCircle size={36} background={c ? `${c.color}1f` : 'var(--color-gray-150)'} fontSize={16}>
                    {c?.emoji ?? '💰'}
                  </IconCircle>
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

      {data.dayTx.length > 0 && (
        <Section title="거래 내역">
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {data.dayTx.map((t, i) => (
              <TxRow key={t.id} tx={t} showTime showAccount borderBottom={i < data.dayTx.length - 1} />
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
