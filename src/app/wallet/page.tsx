'use client';

import Link from 'next/link';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import { useMode } from '@/components/ModeProvider';
import { useAccounts } from '@/lib/accounts';
import { useLoans } from '@/lib/loans';
import type { Account } from '@/lib/types';

export default function WalletPage() {
  const { accounts, ready } = useAccounts();
  const { items: loans, ready: loansReady } = useLoans();
  const { mode } = useMode();

  if (!ready || !loansReady) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const banks = accounts.filter((a) => a.type === 'bank');
  const cards = accounts.filter((a) => a.type === 'card');
  const cash = accounts.filter((a) => a.type === 'cash');
  const investments = accounts.filter((a) => a.type === 'investment');
  const modeLoans = loans.filter((l) => l.scope === mode);

  const cashTotal = [...banks, ...cash].reduce((s, a) => s + a.balance, 0);
  const investmentTotal = investments.reduce((s, a) => s + a.balance, 0);
  const debtTotal = cards.reduce((s, a) => s + a.balance, 0); // negative
  const loanDebt = modeLoans.reduce((s, l) => s + l.remaining, 0);
  const net = cashTotal + investmentTotal + debtTotal - loanDebt;

  return (
    <>
      <TopBar
        title={mode === 'business' ? '사업 자산' : '개인 자산'}
        right={
          <Link
            href="/settings/accounts"
            className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            관리
          </Link>
        }
      />

      <section className="px-5 pb-2 pt-1">
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
          순자산
        </p>
        <Money
          value={net}
          sign="auto"
          className="mt-1 block tracking-tight"
          style={{ fontSize: 'var(--text-3xl)', fontWeight: 800, color: 'var(--color-text-1)' }}
        />
      </section>

      <section className="grid grid-cols-2 gap-2 px-5 pb-3 pt-1 tabular-nums">
        <SummaryRow label="현금·통장" value={cashTotal} tone="text" />
        <SummaryRow label="투자" value={investmentTotal} tone="text" />
        <SummaryRow label="카드 사용" value={Math.abs(debtTotal)} tone="danger" prefix="−" />
        <SummaryRow label="대출 잔액" value={loanDebt} tone="danger" prefix="−" />
      </section>

      {accounts.length === 0 && modeLoans.length === 0 && (
        <section className="px-5 pt-3">
          <Link
            href="/settings/accounts"
            className="tap flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center"
            style={{ background: 'var(--color-card)' }}
          >
            <p className="text-3xl">🏦</p>
            <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
              {mode === 'business' ? '사업 계좌' : '개인 계좌'}를 추가해 보세요
            </p>
            <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
              {mode === 'business'
                ? '사업 통장, 사업용 카드, 사업장 현금 등'
                : '은행, 카드, 현금, 투자 계좌까지 등록 가능'}
            </p>
          </Link>
        </section>
      )}

      {banks.length > 0 && (
        <Section title="은행">
          {banks.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </Section>
      )}

      {cash.length > 0 && (
        <Section title="현금">
          {cash.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </Section>
      )}

      {investments.length > 0 && (
        <Section title="투자">
          {investments.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </Section>
      )}

      {cards.length > 0 && (
        <Section title="카드">
          {cards.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </Section>
      )}

      {modeLoans.length > 0 && (
        <Section
          title="대출"
          right={
            <Link
              href="/settings/loans"
              style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
            >
              관리
            </Link>
          }
        >
          {modeLoans.map((l) => (
            <Link
              key={l.id}
              href="/settings/loans"
              className="tap flex items-center gap-3 rounded-2xl px-4 py-4"
              style={{ background: 'var(--color-card)' }}
            >
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                style={{ background: `${l.color}1f` }}
              >
                {l.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 600 }}
                >
                  {l.name}
                </p>
                <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                  {l.lender} · 연 {l.rate}%
                </p>
              </div>
              <Money
                value={-l.remaining}
                sign="negative"
                style={{ fontSize: 'var(--text-base)', fontWeight: 700, color: 'var(--color-danger)' }}
              />
            </Link>
          ))}
        </Section>
      )}

      <div className="h-6" />
    </>
  );
}

function Section({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 pb-3 pt-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
          {title}
        </h2>
        {right}
      </div>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function SummaryRow({
  label,
  value,
  tone,
  prefix,
}: {
  label: string;
  value: number;
  tone: 'text' | 'danger';
  prefix?: string;
}) {
  return (
    <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--color-card)' }}>
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
        {label}
      </p>
      <p
        className="tnum mt-1 truncate"
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 800,
          color: tone === 'danger' ? 'var(--color-danger)' : 'var(--color-text-1)',
          letterSpacing: '-0.01em',
        }}
      >
        {prefix ?? ''}
        {Math.round(value).toLocaleString('ko-KR')}원
      </p>
    </div>
  );
}

function AccountCard({ account }: { account: Account }) {
  const isCard = account.type === 'card';
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-4" style={{ background: 'var(--color-card)' }}>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white"
        style={{ background: account.color, fontSize: 'var(--text-base)' }}
      >
        {(account.bank || account.name).slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 600 }}
        >
          {account.name}
        </p>
        <p
          className="truncate"
          style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
        >
          {account.bank}
          {account.last4 ? ` · ****${account.last4}` : ''}
          {account.main ? ' · 주거래' : ''}
        </p>
      </div>
      <Money
        value={account.balance}
        sign={isCard ? 'negative' : 'auto'}
        style={{
          fontSize: 'var(--text-base)',
          fontWeight: 700,
          color: isCard ? 'var(--color-danger)' : 'var(--color-text-1)',
        }}
      />
    </div>
  );
}
