'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useTransactions } from '@/lib/storage';
import { useVendors } from '@/lib/vendors';

export default function BusinessVendorsPage() {
  const toast = useToast();
  const { tx } = useTransactions();
  const { items: vendors } = useVendors();

  const businessVendors = vendors.filter((v) => v.scope === 'business');

  const totals = useMemo(() => {
    const map = new Map<string, { in: number; out: number; count: number }>();
    tx.forEach((t) => {
      const v = t.vendor;
      if (!v) return;
      if (!map.has(v)) map.set(v, { in: 0, out: 0, count: 0 });
      const s = map.get(v)!;
      if (t.amount > 0) s.in += t.amount;
      else s.out += Math.abs(t.amount);
      s.count += 1;
    });
    return map;
  }, [tx]);

  const ranked = useMemo(() => {
    return businessVendors
      .map((v) => ({
        ...v,
        ...(totals.get(v.id) ?? { in: 0, out: 0, count: 0 }),
      }))
      .sort((a, b) => b.in + b.out - (a.in + a.out));
  }, [businessVendors, totals]);

  return (
    <>
      <TopBar
        title="거래처 분석"
        right={
          <Link href="/settings/vendors" className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            관리
          </Link>
        }
      />

      <section className="px-5 pb-10 pt-2">
        {ranked.length === 0 ? (
          <div className="rounded-2xl px-6 py-16 text-center" style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">🤝</p>
            <p className="mt-2" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              거래처를 등록하고 거래 추가 시 연결하세요
            </p>
            <Link href="/settings/vendors" className="mt-3 inline-block rounded-full px-4 py-2"
              style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
              거래처 등록
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {ranked.map((v) => {
              const net = v.in - v.out;
              return (
                <div key={v.id} className="rounded-2xl px-4 py-4"
                  style={{ background: 'var(--color-card)' }}>
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full font-bold text-white"
                      style={{ background: v.color, fontSize: 'var(--text-base)' }}>
                      {v.name.slice(0, 1)}
                    </div>
                    <div className="flex-1">
                      <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                        {v.name}
                      </p>
                      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                        {v.kind === 'client' ? '매출처' : v.kind === 'supplier' ? '매입처' : '양쪽'}
                        {' · '}{v.count}건 거래
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-xl py-2" style={{ background: 'var(--color-primary-soft)' }}>
                      <p style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>매출</p>
                      <Money value={v.in} sign="never"
                        className="mt-0.5 block"
                        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }} />
                    </div>
                    <div className="rounded-xl py-2" style={{ background: 'var(--color-danger-soft)' }}>
                      <p style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>매입</p>
                      <Money value={v.out} sign="never"
                        className="mt-0.5 block"
                        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }} />
                    </div>
                    <div className="rounded-xl py-2" style={{ background: 'var(--color-gray-100)' }}>
                      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>순액</p>
                      <Money value={net} sign="auto"
                        className="mt-0.5 block"
                        style={{ color: net >= 0 ? 'var(--color-primary)' : 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 700 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <p className="hidden">{toast ? '' : ''}</p>
    </>
  );
}
