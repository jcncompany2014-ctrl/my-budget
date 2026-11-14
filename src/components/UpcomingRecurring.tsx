'use client';

import { AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import { useMode } from '@/components/ModeProvider';
import { useAllAccounts } from '@/lib/accounts';
import { nextBill, type Outflow, shortfalls } from '@/lib/card-billing';
import { fmt } from '@/lib/format';
import { computeMonthlyPayment, useLoans } from '@/lib/loans';
import { daysUntilNext, useRecurring } from '@/lib/recurring';
import { useAllTransactions } from '@/lib/storage';

type Item = {
  id: string;
  name: string;
  cat: string;
  amount: number;
  daysUntil: number;
  /** Account the money leaves, when known. */
  from?: string;
  href: string;
};

/**
 * The next fixed outflows — recurring payments, auto-paid loan instalments and
 * card bills — and a warning when an account will not cover what is about to
 * leave it.
 */
export default function UpcomingRecurring() {
  const { mode } = useMode();
  const { items, ready } = useRecurring();
  const { items: loans } = useLoans();
  const { accounts } = useAllAccounts();
  const { tx } = useAllTransactions();

  const { upcoming, warnings } = useMemo(() => {
    const mainId = accounts.find((a) => a.scope === mode && a.main)?.id;
    const list: Item[] = [];
    for (const r of items) {
      list.push({
        id: r.id,
        name: r.name,
        cat: r.cat,
        amount: r.amount,
        daysUntil: daysUntilNext(r.day, r.postedThrough),
        from: r.acc ?? mainId,
        href: '/settings/recurring',
      });
    }
    for (const l of loans) {
      if (l.scope !== mode || !l.autoPayment || !l.paymentDay || l.remaining <= 0) continue;
      list.push({
        id: l.id,
        name: l.name,
        cat: 'loan_payment',
        amount: Math.min(
          l.remaining,
          l.monthlyPayment ?? computeMonthlyPayment(l.principal, l.rate, l.termMonths),
        ),
        daysUntil: daysUntilNext(l.paymentDay, l.postedThrough),
        from: l.linkedAccountId,
        href: '/settings/loans',
      });
    }
    for (const card of accounts) {
      if (card.scope !== mode) continue;
      const bill = nextBill(card, tx);
      if (!bill || bill.amount <= 0) continue;
      list.push({
        id: `bill-${card.id}`,
        name: `${card.name} 카드값`,
        cat: 'transfer',
        amount: bill.amount,
        daysUntil: bill.daysUntil,
        from: card.billingAccountId,
        href: '/settings/accounts',
      });
    }
    list.sort((a, b) => a.daysUntil - b.daysUntil);

    // Shortfalls look at everything due in the next 31 days, not just what fits on the strip.
    const outflows: Outflow[] = list
      .filter((i) => i.from)
      .map((i) => ({ accountId: i.from as string, amount: i.amount, daysUntil: i.daysUntil }));
    const short = shortfalls(outflows, accounts);
    const warn = [...short.entries()]
      .map(([id, s]) => ({ account: accounts.find((a) => a.id === id), ...s }))
      .filter((w) => w.account && (w.account.type === 'bank' || w.account.type === 'cash'));
    return { upcoming: list.slice(0, 8), warnings: warn };
  }, [items, loans, accounts, tx, mode]);

  if (!ready || upcoming.length === 0) return null;

  return (
    <section className="px-5 pb-3">
      <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
        <Link href="/settings/recurring" className="mb-3 flex items-center justify-between">
          <p className="text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
            곧 빠져나갈 돈
          </p>
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none" aria-hidden="true">
            <path
              d="M9 6l6 6-6 6"
              stroke="var(--color-text-3)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>

        {warnings.map((w) => (
          <div
            key={w.account?.id}
            className="mb-3 flex items-center gap-2.5 rounded-xl px-3.5 py-3"
            style={{ background: 'var(--color-danger-soft)' }}
          >
            <AlertTriangle
              size={16}
              strokeWidth={2.4}
              color="var(--color-danger)"
              className="shrink-0"
            />
            <p
              className="min-w-0"
              style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xs)', fontWeight: 700 }}
            >
              {w.account?.name} <span className="tnum">{fmt(w.short)}원</span> 부족 ·{' '}
              {w.daysUntil === 0 ? '오늘' : `${w.daysUntil}일 뒤`}
            </p>
          </div>
        ))}

        <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
          {upcoming.map((r) => {
            const urgent = r.daysUntil <= 3;
            return (
              <Link
                key={r.id}
                href={r.href}
                className="tap flex w-[150px] shrink-0 flex-col gap-2 rounded-2xl p-3.5"
                style={{
                  background: 'var(--color-gray-50)',
                  boxShadow: urgent ? 'inset 0 0 0 1.5px var(--color-danger)' : 'none',
                }}
              >
                <div className="flex items-center justify-between">
                  <MerchantAvatar merchant={r.name} catId={r.cat} size={32} />
                  <span
                    className="tnum rounded-full px-2 py-0.5"
                    style={{
                      background: urgent ? 'var(--color-danger)' : 'var(--color-gray-100)',
                      color: urgent ? '#fff' : 'var(--color-text-2)',
                      fontSize: 10,
                      fontWeight: 800,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {r.daysUntil === 0 ? '오늘' : `D-${r.daysUntil}`}
                  </span>
                </div>
                <p className="truncate text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
                  {r.name}
                </p>
                <p className="tnum text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>
                  {fmt(r.amount)}원
                </p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
