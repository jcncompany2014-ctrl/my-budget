'use client';

import { useMemo, useState } from 'react';
import LineChart from '@/components/LineChart';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import Card from '@/components/ui/Card';
import Pill from '@/components/ui/Pill';
import Section from '@/components/ui/Section';
import { isTransferCategory } from '@/lib/categories';
import { fmt } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

type Period = '3m' | '6m' | '12m';

export default function CashflowPage() {
  const { tx, ready } = useTransactions();
  const [period, setPeriod] = useState<Period>('6m');

  const data = useMemo(() => {
    if (!ready) return null;
    const months = period === '3m' ? 3 : period === '6m' ? 6 : 12;
    const now = new Date();
    const buckets: {
      label: string;
      in: number;
      out: number;
      transferIn: number;
      transferOut: number;
    }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const m = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthTx = tx.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === m.getFullYear() && d.getMonth() === m.getMonth();
      });
      let inFlow = 0;
      let outFlow = 0;
      let xIn = 0;
      let xOut = 0;
      monthTx.forEach((t) => {
        const isTransfer = isTransferCategory(t.cat) || !!t.transferPairId;
        if (isTransfer) {
          if (t.amount > 0) xIn += t.amount;
          else xOut += Math.abs(t.amount);
          return;
        }
        if (t.amount > 0) inFlow += t.amount;
        else outFlow += Math.abs(t.amount);
      });
      buckets.push({
        label: `${m.getMonth() + 1}월`,
        in: inFlow,
        out: outFlow,
        transferIn: xIn,
        transferOut: xOut,
      });
    }
    return buckets;
  }, [tx, period, ready]);

  if (!data) return null;
  const total = data.reduce(
    (acc, b) => ({
      in: acc.in + b.in,
      out: acc.out + b.out,
      net: acc.net + (b.in - b.out),
      tIn: acc.tIn + b.transferIn,
      tOut: acc.tOut + b.transferOut,
    }),
    { in: 0, out: 0, net: 0, tIn: 0, tOut: 0 },
  );

  return (
    <>
      <TopBar title="현금흐름표" />

      <Section topGap={4} bottomGap={4}>
        <div className="flex gap-1.5">
          {(
            [
              ['3m', '3개월'],
              ['6m', '6개월'],
              ['12m', '12개월'],
            ] as const
          ).map(([k, l]) => (
            <Pill key={k} tone="primary" active={period === k} onClick={() => setPeriod(k)}>
              {l}
            </Pill>
          ))}
        </div>
      </Section>

      <Section bottomGap={4}>
        <div
          className="relative overflow-hidden rounded-2xl px-5 py-5"
          style={{
            background:
              total.net >= 0
                ? 'linear-gradient(135deg, var(--color-primary-grad-from) 0%, var(--color-primary-grad-to) 100%)'
                : 'linear-gradient(135deg, #F04452 0%, #C71F2D 100%)',
            boxShadow: '0 4px 18px rgba(0,0,0,0.16)',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -40,
              right: -40,
              width: 180,
              height: 180,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.20) 0%, transparent 60%)',
              pointerEvents: 'none',
            }}
          />
          <div className="relative">
            <p
              style={{
                color: 'rgba(255,255,255,0.9)',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.04em',
              }}
            >
              기간 순현금흐름 (영업)
            </p>
            <p
              className="tnum mt-1.5 block tracking-tight"
              style={{
                color: '#fff',
                fontSize: 28,
                fontWeight: 900,
                letterSpacing: '-0.025em',
              }}
            >
              {total.net >= 0 ? '+' : '−'}
              {fmt(total.net)}원
            </p>
            {total.in + total.out > 0 && (
              <div
                className="mt-3 flex h-[4px] w-full overflow-hidden rounded-full"
                style={{ background: 'rgba(255,255,255,0.22)' }}
              >
                <div
                  style={{
                    width: `${(total.in / (total.in + total.out)) * 100}%`,
                    background: 'rgba(255,255,255,0.95)',
                    transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
                <div
                  style={{
                    width: `${(total.out / (total.in + total.out)) * 100}%`,
                    background: 'rgba(255,255,255,0.36)',
                  }}
                />
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2 text-white">
              <div>
                <div className="flex items-center gap-1">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: '#fff',
                      opacity: 0.95,
                    }}
                  />
                  <span
                    style={{
                      opacity: 0.85,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    유입
                  </span>
                </div>
                <p className="tnum mt-0.5" style={{ fontSize: 13, fontWeight: 800 }}>
                  +{fmt(total.in)}
                </p>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-1">
                  <span
                    style={{
                      display: 'inline-block',
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      background: '#fff',
                      opacity: 0.36,
                    }}
                  />
                  <span
                    style={{
                      opacity: 0.85,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.02em',
                    }}
                  >
                    유출
                  </span>
                </div>
                <p className="tnum mt-0.5" style={{ fontSize: 13, fontWeight: 800 }}>
                  −{fmt(total.out)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Section>

      <Section title="월별 현금흐름">
        <Card padding={16}>
          <LineChart
            labels={data.map((b) => b.label)}
            height={140}
            series={[
              { values: data.map((b) => b.in), color: 'var(--color-primary)' },
              { values: data.map((b) => b.out), color: 'var(--color-danger)' },
            ]}
          />
          <div className="mt-2 flex items-center justify-center gap-4">
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
              <span style={{ color: 'var(--color-primary)', fontWeight: 700 }}>●</span> 유입
            </span>
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
              <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}>●</span> 유출
            </span>
          </div>
        </Card>
      </Section>

      <Section title="월별 상세">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          {data.map((b, i) => {
            const net = b.in - b.out;
            return (
              <div
                key={i}
                className="px-4 py-3"
                style={{
                  borderBottom: i < data.length - 1 ? '1px solid var(--color-divider)' : 'none',
                }}
              >
                <div className="flex items-baseline justify-between">
                  <span
                    style={{
                      color: 'var(--color-text-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                    }}
                  >
                    {b.label}
                  </span>
                  <Money
                    value={net}
                    sign="auto"
                    style={{
                      color: net >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                    }}
                  />
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs">
                  <span className="tnum" style={{ color: 'var(--color-primary)' }}>
                    +{fmt(b.in)}
                  </span>
                  <span style={{ color: 'var(--color-text-3)' }}>·</span>
                  <span className="tnum" style={{ color: 'var(--color-danger)' }}>
                    −{fmt(b.out)}
                  </span>
                  {(b.transferIn > 0 || b.transferOut > 0) && (
                    <>
                      <span style={{ color: 'var(--color-text-3)' }}>·</span>
                      <span className="tnum" style={{ color: 'var(--color-text-3)' }}>
                        이체 ↔ {fmt(b.transferIn + b.transferOut)}
                      </span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      <Section bottomGap={40}>
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
          ※ 영업/투자/재무 활동 분리 없는 단순 현금흐름. 재무제표와 다를 수 있습니다.
        </p>
      </Section>
    </>
  );
}
