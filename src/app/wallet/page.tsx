'use client';

import TopBar from '@/components/TopBar';
import { fmt, fmtKRW } from '@/lib/format';
import { SEED_ACCOUNTS } from '@/lib/seed';

export default function WalletPage() {
  const banks = SEED_ACCOUNTS.filter((a) => a.type === 'bank');
  const cards = SEED_ACCOUNTS.filter((a) => a.type === 'card');

  const cash = banks.reduce((s, a) => s + a.balance, 0);
  const debt = cards.reduce((s, a) => s + a.balance, 0); // negative
  const net = cash + debt;

  return (
    <>
      <TopBar title="자산" />

      <section className="px-5 pb-3 pt-1">
        <p className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
          순자산
        </p>
        <p className="tnum mt-1 text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--color-text-1)' }}>
          {fmtKRW(net)}
        </p>
        <div className="mt-3 flex gap-3 text-sm">
          <span style={{ color: 'var(--color-text-2)' }}>
            현금 <span className="tnum font-semibold" style={{ color: 'var(--color-text-1)' }}>{fmt(cash)}원</span>
          </span>
          <span style={{ color: 'var(--color-text-2)' }}>
            부채 <span className="tnum font-semibold" style={{ color: 'var(--color-danger)' }}>{fmt(Math.abs(debt))}원</span>
          </span>
        </div>
      </section>

      <section className="px-5 pb-3 pt-3">
        <h2 className="mb-2 text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
          은행
        </h2>
        <div className="space-y-2">
          {banks.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </div>
      </section>

      <section className="px-5 pb-10 pt-3">
        <h2 className="mb-2 text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
          카드
        </h2>
        <div className="space-y-2">
          {cards.map((a) => (
            <AccountCard key={a.id} account={a} />
          ))}
        </div>
      </section>
    </>
  );
}

function AccountCard({
  account,
}: {
  account: (typeof SEED_ACCOUNTS)[number];
}) {
  const isCard = account.type === 'card';
  const balance = account.balance;
  return (
    <div
      className="flex items-center gap-3 rounded-2xl px-4 py-4"
      style={{ background: 'var(--color-card)' }}
    >
      <div
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-white"
        style={{ background: account.color }}
      >
        {account.bank.slice(0, 1)}
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
        style={{
          color: isCard
            ? 'var(--color-danger)'
            : 'var(--color-text-1)',
        }}
      >
        {isCard ? '-' : ''}
        {fmt(Math.abs(balance))}원
      </p>
    </div>
  );
}
