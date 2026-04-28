'use client';

import { useMemo, useState } from 'react';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import TxRow from '@/components/TxRow';
import { useTransactions } from '@/lib/storage';

type Tab = 'receivable' | 'payable';

export default function ArApPage() {
  const { tx, ready } = useTransactions();
  const [tab, setTab] = useState<Tab>('receivable');

  const items = useMemo(() => {
    if (!ready) return [];
    return tx.filter((t) => t.outstanding && (tab === 'receivable' ? t.amount > 0 : t.amount < 0));
  }, [tx, tab, ready]);

  const total = items.reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <>
      <TopBar title="외상 (받을 / 줄)" />

      <section className="px-5 pb-3 pt-1">
        <div className="flex rounded-full p-[3px]" style={{ background: 'var(--color-gray-100)' }}>
          {(['receivable', 'payable'] as const).map((k) => {
            const sel = tab === k;
            return (
              <button key={k} type="button" onClick={() => setTab(k)}
                className="tap flex-1 rounded-full py-2"
                style={{
                  background: sel ? 'var(--color-card)' : 'transparent',
                  color: sel ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  boxShadow: sel ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}>
                {k === 'receivable' ? '받을 돈' : '줄 돈'}
              </button>
            );
          })}
        </div>
      </section>

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
            합계
          </p>
          <Money value={total} sign={tab === 'receivable' ? 'positive' : 'negative'}
            className="mt-1 block tracking-tight"
            style={{
              fontSize: 'var(--text-xl)',
              fontWeight: 800,
              color: tab === 'receivable' ? 'var(--color-primary)' : 'var(--color-danger)',
            }} />
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            {items.length}건
          </p>
        </div>
      </section>

      <section className="px-5 pb-10 pt-2">
        {items.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center" style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">{tab === 'receivable' ? '🧾' : '💼'}</p>
            <p className="mt-2" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              {tab === 'receivable' ? '받을 돈이 없어요' : '줄 돈이 없어요'}
            </p>
            <p className="mt-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
              거래 편집에서 외상으로 표시할 수 있어요
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {items.map((t, i) => (
              <TxRow key={t.id} tx={t} showTime showAccount borderBottom={i < items.length - 1} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}
