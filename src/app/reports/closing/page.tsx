'use client';

import {
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Crown,
  Heart,
  NotebookPen,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Confetti from '@/components/Confetti';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { useMode } from '@/components/ModeProvider';
import { SkeletonHome } from '@/components/Skeleton';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/ui/EmptyState';
import { CATEGORIES } from '@/lib/categories';
import { monthlyClosing, parseMonthKey } from '@/lib/closing';
import { fmt, fmtShort } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

const monthKey = (y: number, m: number) => {
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

export default function ClosingPageWrap() {
  return (
    <Suspense fallback={null}>
      <ClosingPage />
    </Suspense>
  );
}

function ClosingPage() {
  const ym = useSearchParams().get('ym') ?? '';
  const router = useRouter();
  const { tx, ready } = useTransactions();
  const { mode } = useMode();
  const parsed = parseMonthKey(ym);
  const [celebrate, setCelebrate] = useState(false);

  const data = useMemo(
    () => (parsed ? monthlyClosing(tx, parsed.year, parsed.month) : null),
    [tx, parsed?.year, parsed?.month],
  );

  // Celebrate a positive month once (per month, per mode)
  useEffect(() => {
    if (!ready || !data || data.txCount === 0 || data.net <= 0) return;
    const key = `asset/closing-celebrated/v1/${mode}/${ym}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, '1');
    } catch {
      return;
    }
    setCelebrate(true);
  }, [ready, data, mode, ym]);

  if (!ready) return <SkeletonHome />;

  const back = (
    <button
      type="button"
      onClick={() => router.back()}
      className="tap flex h-10 w-10 items-center justify-center rounded-full"
      aria-label="뒤로"
    >
      <ArrowLeft size={20} strokeWidth={2.4} color="var(--color-text-1)" />
    </button>
  );

  if (!parsed || !data) {
    return (
      <>
        <TopBar title="월말 결산" left={back} />
        <div className="px-5 pt-4">
          <EmptyState icon={Receipt} iconColor="#94A3B8" title="잘못된 월이에요" />
        </div>
      </>
    );
  }

  const { year, month } = parsed;
  const now = new Date();
  const isFutureNext = new Date(year, month + 1, 1) > now;
  const label = `${month + 1}월`;
  const positive = data.net >= 0;

  const nav = (
    <div className="flex items-center justify-between px-5 pb-10 pt-2">
      <Link
        href={`/reports/closing?ym=${monthKey(year, month - 1)}`}
        className="tap flex items-center gap-1 rounded-full px-3 py-2"
        style={{
          background: 'var(--color-card)',
          color: 'var(--color-text-2)',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        <ChevronLeft size={16} strokeWidth={2.4} />
        {new Date(year, month - 1, 1).getMonth() + 1}월 결산
      </Link>
      {!isFutureNext && (
        <Link
          href={`/reports/closing?ym=${monthKey(year, month + 1)}`}
          className="tap flex items-center gap-1 rounded-full px-3 py-2"
          style={{
            background: 'var(--color-card)',
            color: 'var(--color-text-2)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          {new Date(year, month + 1, 1).getMonth() + 1}월 결산
          <ChevronRight size={16} strokeWidth={2.4} />
        </Link>
      )}
    </div>
  );

  if (data.txCount === 0) {
    return (
      <>
        <TopBar title={`${year}년 ${label} 결산`} left={back} />
        <div className="px-5 pt-4">
          <EmptyState icon={NotebookPen} iconColor="#94A3B8" title={`${label}엔 기록이 없어요`} />
        </div>
        {nav}
      </>
    );
  }

  return (
    <>
      <TopBar title={`${year}년 ${label} 결산`} left={back} />

      {/* Hero */}
      <section className="px-5 pb-3 pt-1">
        <div
          className="relative overflow-hidden rounded-3xl px-5 py-6 text-white"
          style={{
            background: positive
              ? 'linear-gradient(135deg, var(--color-primary-grad-from) 0%, var(--color-primary-grad-to) 100%)'
              : 'linear-gradient(135deg, #F04452 0%, #C71F2D 100%)',
            boxShadow: '0 6px 24px rgba(0,0,0,0.16)',
          }}
        >
          <div
            aria-hidden
            style={{
              position: 'absolute',
              top: -50,
              right: -50,
              width: 220,
              height: 220,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,255,255,0.22) 0%, transparent 60%)',
            }}
          />
          <div className="relative">
            <div className="flex items-center justify-between">
              <p style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.04em', opacity: 0.9 }}>
                {label} 한 달
              </p>
              {data.savingsRate !== null && (
                <span
                  className="tnum inline-flex items-center gap-1 rounded-full px-2.5 py-1"
                  style={{ background: 'rgba(255,255,255,0.22)', fontSize: 11, fontWeight: 800 }}
                >
                  <PiggyBank size={12} strokeWidth={2.6} />
                  저축률 {Math.round(Math.max(-999, data.savingsRate * 100))}%
                </span>
              )}
            </div>
            <p
              className="tnum mt-2"
              style={{ fontSize: 30, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.15 }}
            >
              {positive ? '+' : '−'}
              {fmt(data.net)}원
            </p>
            <p style={{ fontSize: 14, fontWeight: 700, opacity: 0.92, marginTop: 2 }}>
              {positive ? '남겼어요 👏' : '적자였어요'}
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
                  {mode === 'business' ? '매출' : '수입'}
                </p>
                <p className="tnum" style={{ fontSize: 15, fontWeight: 800 }}>
                  +{fmt(data.income)}원
                </p>
              </div>
              <div className="text-right">
                <p style={{ fontSize: 11, fontWeight: 700, opacity: 0.8 }}>
                  {mode === 'business' ? '비용' : '지출'}
                </p>
                <p className="tnum" style={{ fontSize: 15, fontWeight: 800 }}>
                  −{fmt(data.expense)}원
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-2.5 px-5 pb-3">
        <Tile label="기록한 날" value={`${data.loggedDays}일`} sub={`${data.daysInMonth}일 중`} />
        <Tile label="무지출 데이" value={`${data.noSpendDays}일`} sub="지출 0원인 날" />
        <Tile label="하루 평균" value={`${fmtShort(data.avgDailySpend)}원`} sub="지출 기준" />
        <Tile
          label="지난 달 대비"
          value={
            data.expenseDeltaPct === null
              ? '—'
              : `${data.expenseDeltaPct > 0 ? '+' : ''}${data.expenseDeltaPct}%`
          }
          sub={
            data.prevExpense > 0 ? `지난 달 ${fmtShort(data.prevExpense)}원` : '비교할 기록 없음'
          }
          tone={
            data.expenseDeltaPct === null
              ? undefined
              : data.expenseDeltaPct > 0
                ? 'var(--color-danger)'
                : 'var(--color-primary)'
          }
        />
      </section>

      {/* Top categories */}
      {data.topCategories.length > 0 && (
        <section className="px-5 pb-3">
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
            <SectionLabel>가장 많이 쓴 카테고리</SectionLabel>
            <div className="mt-3 space-y-3">
              {data.topCategories.map((c, i) => (
                <div key={c.cat} className="flex items-center gap-3">
                  <span
                    className="tnum flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: i === 0 ? 'var(--color-text-1)' : 'var(--color-gray-150)',
                      color: i === 0 ? 'var(--color-card)' : 'var(--color-text-2)',
                      fontSize: 10,
                      fontWeight: 800,
                    }}
                  >
                    {i + 1}
                  </span>
                  <CategoryIcon catId={c.cat} size={36} />
                  <div className="min-w-0 flex-1">
                    <p style={{ color: 'var(--color-text-1)', fontSize: 14, fontWeight: 700 }}>
                      {CATEGORIES[c.cat]?.name ?? c.cat}
                    </p>
                    <p
                      className="tnum"
                      style={{ color: 'var(--color-text-3)', fontSize: 11, fontWeight: 600 }}
                    >
                      {data.expense > 0 ? Math.round((c.amount / data.expense) * 100) : 0}% ·{' '}
                      {c.deltaPct === null ? '지난 달 없음' : `지난 달 ${fmtShort(c.prevAmount)}원`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className="tnum"
                      style={{ color: 'var(--color-text-1)', fontSize: 14, fontWeight: 800 }}
                    >
                      {fmt(c.amount)}원
                    </p>
                    {c.deltaPct === 0 && (
                      <p style={{ color: 'var(--color-text-3)', fontSize: 11, fontWeight: 700 }}>
                        지난 달과 같음
                      </p>
                    )}
                    {c.deltaPct !== null && c.deltaPct !== 0 && (
                      <p
                        className="tnum inline-flex items-center gap-0.5"
                        style={{
                          color: c.deltaPct > 0 ? 'var(--color-danger)' : 'var(--color-primary)',
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        {c.deltaPct > 0 ? (
                          <TrendingUp size={11} strokeWidth={2.6} />
                        ) : (
                          <TrendingDown size={11} strokeWidth={2.6} />
                        )}
                        {Math.abs(c.deltaPct)}%
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Highlights */}
      <section className="px-5 pb-3">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <SectionLabel>{label}의 기록</SectionLabel>
          <div className="mt-3 space-y-3">
            {data.biggest && (
              <Highlight
                icon={<Crown size={16} strokeWidth={2.4} />}
                color="#F59E0B"
                title="가장 큰 지출"
                href={`/merchant?name=${encodeURIComponent(data.biggest.merchant.trim())}`}
              >
                <b>{data.biggest.merchant}</b> {fmt(data.biggest.amount)}원 ·{' '}
                {new Date(data.biggest.date).getMonth() + 1}월{' '}
                {new Date(data.biggest.date).getDate()}일
              </Highlight>
            )}
            {data.favoriteMerchant && data.favoriteMerchant.visits >= 2 && (
              <Highlight
                icon={<Heart size={16} strokeWidth={2.4} />}
                color="#EC4899"
                title="단골"
                href={`/merchant?name=${encodeURIComponent(data.favoriteMerchant.merchant)}`}
              >
                <b>{data.favoriteMerchant.merchant}</b> {data.favoriteMerchant.visits}번 ·{' '}
                {fmt(data.favoriteMerchant.total)}원
              </Highlight>
            )}
            {data.peakWeekday && (
              <Highlight
                icon={<CalendarDays size={16} strokeWidth={2.4} />}
                color="#3182F6"
                title="지갑이 열린 요일"
              >
                <b>{data.peakWeekday.label}요일</b> · 하루 평균 {fmt(data.peakWeekday.avg)}원
              </Highlight>
            )}
          </div>
        </div>
      </section>

      {nav}

      {celebrate && <Confetti onDone={() => setCelebrate(false)} />}
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        color: 'var(--color-text-3)',
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.04em',
      }}
    >
      {children}
    </p>
  );
}

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub: string;
  tone?: string;
}) {
  return (
    <div className="rounded-2xl px-4 py-3.5" style={{ background: 'var(--color-card)' }}>
      <p style={{ color: 'var(--color-text-3)', fontSize: 11, fontWeight: 700 }}>{label}</p>
      <p
        className="tnum mt-1"
        style={{
          color: tone ?? 'var(--color-text-1)',
          fontSize: 20,
          fontWeight: 900,
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </p>
      <p className="tnum" style={{ color: 'var(--color-text-3)', fontSize: 10, fontWeight: 600 }}>
        {sub}
      </p>
    </div>
  );
}

function Highlight({
  icon,
  color,
  title,
  href,
  children,
}: {
  icon: React.ReactNode;
  color: string;
  title: string;
  href?: string;
  children: React.ReactNode;
}) {
  const body = (
    <>
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{ background: `${color}1f`, color }}
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p style={{ color: 'var(--color-text-3)', fontSize: 11, fontWeight: 700 }}>{title}</p>
        <p
          className="tnum truncate"
          style={{ color: 'var(--color-text-1)', fontSize: 13, fontWeight: 600 }}
        >
          {children}
        </p>
      </div>
      {href && <ChevronRight size={16} strokeWidth={2.4} color="var(--color-text-4)" />}
    </>
  );
  return href ? (
    <Link href={href} className="tap flex items-center gap-3">
      {body}
    </Link>
  ) : (
    <div className="flex items-center gap-3">{body}</div>
  );
}
