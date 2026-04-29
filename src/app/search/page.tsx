'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import Highlight from '@/components/Highlight';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import IconCircle from '@/components/ui/IconCircle';
import Pill from '@/components/ui/Pill';
import Section from '@/components/ui/Section';
import TopBar from '@/components/TopBar';
import { useAccounts } from '@/lib/accounts';
import { CATEGORIES, expenseCategoriesByScope } from '@/lib/categories';
import { fmt, fmtSigned, isExpense } from '@/lib/format';
import { useTransactions } from '@/lib/storage';

export default function SearchPage() {
  const router = useRouter();
  const { tx, ready } = useTransactions();
  const { accounts } = useAccounts();
  const { mode } = useMode();

  const [query, setQuery] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [catFilter, setCatFilter] = useState<string | null>(null);
  const [accFilter, setAccFilter] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const cats = useMemo(() => expenseCategoriesByScope(mode), [mode]);

  const recentMerchants = useMemo(() => {
    const s = new Set<string>();
    tx.slice(0, 100).forEach((t) => s.add(t.merchant));
    return Array.from(s).slice(0, 8);
  }, [tx]);

  const results = useMemo(() => {
    if (!ready) return [];
    let r = tx;
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(
        (t) =>
          t.merchant.toLowerCase().includes(q) ||
          (t.memo ?? '').toLowerCase().includes(q) ||
          (CATEGORIES[t.cat]?.name ?? '').includes(query),
      );
    }
    if (minAmount) {
      const m = Number(minAmount);
      r = r.filter((t) => Math.abs(t.amount) >= m);
    }
    if (maxAmount) {
      const m = Number(maxAmount);
      r = r.filter((t) => Math.abs(t.amount) <= m);
    }
    if (catFilter) r = r.filter((t) => t.cat === catFilter);
    if (accFilter) r = r.filter((t) => t.acc === accFilter);
    return r.sort((a, b) => b.date.localeCompare(a.date));
  }, [tx, query, minAmount, maxAmount, catFilter, accFilter, ready]);

  const totalFound = results.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);

  return (
    <>
      <TopBar
        title="검색"
        right={
          <button type="button" onClick={() => router.back()} className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            완료
          </button>
        }
      />

      <Section topGap={4} bottomGap={8}>
        <div className="flex items-center gap-2 rounded-xl px-3" style={{ background: 'var(--color-card)', height: 48 }}>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
            <circle cx={11} cy={11} r={7} stroke="var(--color-text-3)" strokeWidth={1.8} />
            <path d="M16 16l4 4" stroke="var(--color-text-3)" strokeWidth={1.8} strokeLinecap="round" />
          </svg>
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="소비처, 카테고리, 메모"
            className="flex-1 bg-transparent outline-none"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)' }}
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="tap flex h-5 w-5 items-center justify-center rounded-full"
              style={{ background: 'var(--color-gray-300)' }}>
              <svg viewBox="0 0 24 24" width={12} height={12} fill="none">
                <path d="M6 6l12 12M18 6l-12 12" stroke="white" strokeWidth={3} strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
      </Section>

      <Section topGap={0} bottomGap={4}>
        <button type="button" onClick={() => setShowFilters(!showFilters)}
          className="tap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{
            background: showFilters || minAmount || maxAmount || catFilter || accFilter ? 'var(--color-primary-soft)' : 'var(--color-gray-100)',
            color: showFilters || minAmount || maxAmount || catFilter || accFilter ? 'var(--color-primary)' : 'var(--color-text-2)',
            fontSize: 'var(--text-xs)',
            fontWeight: 700,
          }}>
          🔍 고급 필터
          {(minAmount || maxAmount || catFilter || accFilter) && (
            <span className="rounded-full px-1.5"
              style={{ background: 'var(--color-primary)', color: '#fff', fontSize: 10, fontWeight: 800 }}>
              {[minAmount, maxAmount, catFilter, accFilter].filter(Boolean).length}
            </span>
          )}
        </button>
      </Section>

      {showFilters && (
        <Section topGap={4} bottomGap={4}>
          <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
            <p className="mb-2" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>금액 범위</p>
            <div className="grid grid-cols-2 gap-2">
              <input type="number" inputMode="numeric" value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)} placeholder="최소"
                className="tnum h-11 w-full rounded-xl px-3 outline-none"
                style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)' }} />
              <input type="number" inputMode="numeric" value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)} placeholder="최대"
                className="tnum h-11 w-full rounded-xl px-3 outline-none"
                style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)' }} />
            </div>

            <p className="mb-2 mt-3" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>카테고리</p>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="dark" active={!catFilter} onClick={() => setCatFilter(null)}>전체</Pill>
              {cats.slice(0, 12).map((c) => (
                <Pill key={c.id} tone="dark" active={catFilter === c.id} onClick={() => setCatFilter(c.id)}>
                  {c.emoji} {c.name}
                </Pill>
              ))}
            </div>

            <p className="mb-2 mt-3" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>계좌</p>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="dark" active={!accFilter} onClick={() => setAccFilter(null)}>전체</Pill>
              {accounts.map((a) => (
                <Pill key={a.id} tone="dark" active={accFilter === a.id} onClick={() => setAccFilter(a.id)}>
                  {a.name}
                </Pill>
              ))}
            </div>
          </div>
        </Section>
      )}

      {!query && !minAmount && !maxAmount && !catFilter && !accFilter && (
        <Section title="최근 검색한 소비처">
          <div className="flex flex-wrap gap-2">
            {recentMerchants.map((m) => (
              <Pill key={m} tone="neutral" onClick={() => setQuery(m)}>
                {m}
              </Pill>
            ))}
          </div>
        </Section>
      )}

      {(query || minAmount || maxAmount || catFilter || accFilter) && (
        <Section bottomGap={40}>
          <div className="mb-2 flex items-baseline justify-between">
            <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
              {results.length}건 검색
            </span>
            {totalFound > 0 && (
              <span className="tnum" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>
                총 {fmt(totalFound)}원
              </span>
            )}
          </div>
          {results.length === 0 ? (
            <div className="rounded-2xl px-6 py-12 text-center" style={{ background: 'var(--color-card)' }}>
              <p style={{ fontSize: 32, lineHeight: 1 }}>🔍</p>
              <p className="mt-2" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
                검색 결과가 없어요
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
              {results.slice(0, 100).map((t, i, arr) => {
                const c = CATEGORIES[t.cat];
                const acc = accounts.find((a) => a.id === t.acc);
                return (
                  <Link
                    key={t.id}
                    href={`/tx/${t.id}`}
                    className="tap flex items-center gap-3 px-4 py-3"
                    style={{
                      borderBottom: i < arr.length - 1 ? '1px solid var(--color-divider)' : 'none',
                    }}
                  >
                    <IconCircle
                      size={40}
                      background={c?.color ? `${c.color}1a` : 'var(--color-gray-150)'}
                      fontSize={20}
                    >
                      {c?.emoji ?? '💰'}
                    </IconCircle>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate"
                        style={{
                          color: 'var(--color-text-1)',
                          fontSize: 'var(--text-base)',
                          fontWeight: 500,
                        }}
                      >
                        <Highlight text={t.merchant} query={query} />
                      </p>
                      <p
                        className="truncate"
                        style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
                      >
                        {new Date(t.date).toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })}
                        {acc ? ` · ${acc.bank || acc.name}` : ''}
                        {t.memo ? ' · ' : ''}
                        {t.memo ? <Highlight text={t.memo} query={query} /> : null}
                      </p>
                    </div>
                    <span
                      className="tnum"
                      style={{
                        color: t.amount > 0 ? 'var(--color-primary)' : 'var(--color-text-1)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {fmtSigned(t.amount)}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </Section>
      )}
    </>
  );
}
