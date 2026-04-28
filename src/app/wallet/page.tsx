'use client';

import Link from 'next/link';
import TopBar from '@/components/TopBar';
import { useAccounts } from '@/lib/accounts';
import { fmt, fmtKRW } from '@/lib/format';
import type { Account } from '@/lib/types';

export default function WalletPage() {
  const { accounts, ready } = useAccounts();

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const banks = accounts.filter((a) => a.type === 'bank');
  const cards = accounts.filter((a) => a.type === 'card');
  const cash = accounts.filter((a) => a.type === 'cash');

  const cashTotal = [...banks, ...cash].reduce((s, a) => s + a.balance, 0);
  const debtTotal = cards.reduce((s, a) => s + a.balance, 0); // negative
  const net = cashTotal + debtTotal;

  return (
    <>
      <TopBar
        title="자산"
        right={
          <Link
            href="/settings/accounts"
            className="tap rounded-full px-3 py-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            관리
          </Link>
        }
      />

      <section className="px-5 pb-3 pt-1">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
          순자산
        </p>
        <p className="tnum mt-1 text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
          {fmtKRW(net)}
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <span style={{ color: 'var(--color-text-2)' }}>
            현금{' '}
            <span className="tnum font-semibold" style={{ color: 'var(--color-text-1)' }}>
              {fmt(cashTotal)}원
            </span>
          </span>
          {debtTotal !== 0 && (
            <span style={{ color: 'var(--color-text-2)' }}>
              부채{' '}
              <span className="tnum font-semibold" style={{ color: 'var(--color-danger)' }}>
                {fmt(Math.abs(debtTotal))}원
              </span>
            </span>
          )}
        </div>
      </section>

      {accounts.length === 0 && (
        <section className="px-5 pt-4">
          <Link
            href="/settings/accounts"
            className="tap flex flex-col items-center gap-2 rounded-2xl px-6 py-12 text-center"
            style={{ background: 'var(--color-card)' }}
          >
            <p className="text-3xl">🏦</p>
            <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
              계좌를 추가해 보세요
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
              은행, 카드, 현금 지갑까지 등록할 수 있어요
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

      {cards.length > 0 && (
        <Section title="카드">
          {cards.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </Section>
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 pb-3 pt-3">
      <h2 className="mb-2 text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function AccountCard({ account }: { account: Account }) {
  const isCard = account.type === 'card';
  return (
    <div className="flex items-center gap-3 rounded-2xl px-4 py-4" style={{ background: 'var(--color-card)' }}>
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
        style={{ background: account.color }}
      >
        {(account.bank || account.name).slice(0, 1)}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
          {account.name}
        </p>
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
          {account.bank}
          {account.last4 ? ` · ****${account.last4}` : ''}
          {account.main ? ' · 주거래' : ''}
        </p>
      </div>
      <p
        className="tnum text-[15px] font-bold"
        style={{ color: isCard ? 'var(--color-danger)' : 'var(--color-text-1)' }}
      >
        {isCard ? '-' : ''}
        {fmt(Math.abs(account.balance))}원
      </p>
    </div>
  );
}
