'use client';

import { LineChart } from 'lucide-react';
import { useMemo } from 'react';
import CategoryDonut from '@/components/CategoryDonut';
import CategoryIcon from '@/components/icons/CategoryIcon';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/ui/EmptyState';
import { CATEGORIES } from '@/lib/categories';
import { fmt } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

const CHANNEL_CATS = [
  'biz_sales_card',
  'biz_sales_cash',
  'biz_sales_xfer',
  'biz_sales_app',
  'biz_other',
];

export default function ChannelsPage() {
  const { tx, ready } = useTransactions();

  const data = useMemo(() => {
    if (!ready)
      return {
        total: 0,
        byChannel: [] as {
          cat: string;
          name: string;
          color: string;
          value: number;
        }[],
      };
    const now = new Date();
    const map = new Map<string, number>();
    tx.forEach((t) => {
      if (t.amount <= 0) return;
      const d = new Date(t.date);
      if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return;
      if (!CHANNEL_CATS.includes(t.cat)) return;
      map.set(t.cat, (map.get(t.cat) ?? 0) + t.amount);
    });
    const total = Array.from(map.values()).reduce((s, v) => s + v, 0);
    const byChannel = CHANNEL_CATS.map((cat) => ({
      cat,
      name: CATEGORIES[cat]?.name ?? cat,
      color: CATEGORIES[cat]?.color ?? '#94A3B8',
      value: map.get(cat) ?? 0,
    }))
      .filter((c) => c.value > 0)
      .sort((a, b) => b.value - a.value);
    return { total, byChannel };
  }, [tx, ready]);

  return (
    <>
      <TopBar title="매출 채널" />

      {data.total === 0 ? (
        <div className="px-5">
          <EmptyState
            icon={LineChart}
            iconColor="#3182F6"
            title="이번 달 매출이 없어요"
            hint="카드/현금/계좌/배달앱 매출을 입력하면 분석이 시작돼요"
          />
        </div>
      ) : (
        <>
          <section className="flex justify-center px-5 py-6">
            <CategoryDonut
              data={data.byChannel.map((c) => ({
                catId: c.cat,
                name: c.name,
                color: c.color,
                value: c.value,
              }))}
              total={data.total}
            />
          </section>

          <section className="px-5 pb-10">
            <h2
              className="mb-3"
              style={{
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
              }}
            >
              채널별
            </h2>
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: 'var(--color-card)' }}
            >
              {data.byChannel.map((c, i) => {
                const pct = Math.round((c.value / data.total) * 100);
                return (
                  <div
                    key={c.cat}
                    className="flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom:
                        i < data.byChannel.length - 1 ? '1px solid var(--color-divider)' : 'none',
                    }}
                  >
                    <CategoryIcon catId={c.cat} size={40} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between">
                        <span
                          style={{
                            color: 'var(--color-text-1)',
                            fontSize: 'var(--text-base)',
                            fontWeight: 600,
                          }}
                        >
                          {c.name}
                        </span>
                        <Money
                          value={c.value}
                          sign="never"
                          style={{
                            color: 'var(--color-text-1)',
                            fontSize: 'var(--text-base)',
                            fontWeight: 700,
                          }}
                        />
                      </div>
                      <div className="mt-1 flex items-center gap-2">
                        <div
                          className="h-1.5 flex-1 overflow-hidden rounded-full"
                          style={{ background: 'var(--color-gray-150)' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${pct}%`, background: c.color }}
                          />
                        </div>
                        <span
                          className="tnum"
                          style={{
                            color: 'var(--color-text-3)',
                            fontSize: 'var(--text-xxs)',
                            minWidth: 32,
                            textAlign: 'right',
                          }}
                        >
                          {pct}%
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <p
              className="mt-3 px-1"
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}
            >
              총 매출: <span className="tnum">{fmt(data.total)}원</span>
            </p>
          </section>
        </>
      )}
    </>
  );
}
