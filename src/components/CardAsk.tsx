'use client';

import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import BankIcon from '@/components/icons/BankIcon';
import CardIcon from '@/components/icons/CardIcon';
import { useToast } from '@/components/Toast';
import { editAccountNext, useAllAccounts } from '@/lib/accounts';
import { issuerKind } from '@/lib/card-notification';
import { linkCard, type PendingCard, pendingAccountId } from '@/lib/inbox';
import { cardLabel } from '@/lib/inbox-import';

/**
 * A card a notification named that no account is known to own. One tap says
 * which account it is (or adds it as a new one); the account remembers the
 * card and the rows recorded meanwhile move there.
 */
export default function CardAsk({ pending }: { pending: PendingCard }) {
  const toast = useToast();
  const router = useRouter();
  const { accounts } = useAllAccounts();
  const { card, entries } = pending;
  const current = useMemo(() => pendingAccountId(pending), [pending]);
  const isBank = !!card.issuer && issuerKind(card.issuer) === 'bank';
  // Where the rows sit now comes first, then the kind the notice is about
  // (cards for a card company, accounts for a bank).
  const choices = useMemo(() => {
    const rank = (a: { id: string; type: string }) =>
      a.id === current ? 0 : a.type === (isBank ? 'bank' : 'card') ? 1 : 2;
    return accounts
      .filter((a) => a.type === 'card' || a.type === 'bank')
      .sort((a, b) => rank(a) - rank(b));
  }, [accounts, isBank, current]);
  const add = (
    <button
      key="new"
      type="button"
      onClick={() => pick('new')}
      className="tap flex h-10 shrink-0 items-center gap-1 rounded-full pl-2.5 pr-3.5"
      style={{
        background: 'var(--color-text-1)',
        color: 'var(--color-card)',
        fontSize: 13,
        fontWeight: 800,
      }}
    >
      <Plus size={15} strokeWidth={2.8} />
      {isBank ? '새 계좌' : '새 카드'}
    </button>
  );

  const pick = (target: string) => {
    const r = linkCard(card, target);
    // A card just added has no payment day yet — its editor is one tap away.
    const setUp = r.created && !isBank;
    toast.show(r.moved > 0 ? `${r.name}에 연결 · ${r.moved}건 옮김` : `${r.name}에 연결했어요`, {
      variant: 'success',
      durationMs: setUp ? 7000 : undefined,
      action: setUp
        ? {
            label: '결제일 설정',
            onClick: () => {
              editAccountNext(r.id);
              router.push('/settings/accounts');
            },
          }
        : undefined,
    });
  };

  return (
    <div className="rounded-2xl px-4 pb-3.5 pt-3.5" style={{ background: 'var(--color-card)' }}>
      <div className="flex items-center gap-3">
        {isBank ? (
          <BankIcon name={card.issuer ?? ''} size={36} />
        ) : (
          <CardIcon name={card.issuer ?? '카드'} size={32} />
        )}
        <div className="min-w-0 flex-1">
          <p style={{ color: 'var(--color-primary)', fontSize: 11, fontWeight: 800 }}>
            처음 보는 카드
          </p>
          <p
            className="tnum truncate"
            style={{ color: 'var(--color-text-1)', fontSize: 15, fontWeight: 800 }}
          >
            {cardLabel(card)}
          </p>
        </div>
        <span
          className="tnum shrink-0"
          style={{ color: 'var(--color-text-3)', fontSize: 12, fontWeight: 700 }}
        >
          {entries.length}건
        </span>
      </div>
      <div className="no-scrollbar -mx-4 mt-3 flex gap-1.5 overflow-x-auto px-4">
        {choices.flatMap((a, i) => {
          const here = a.id === current;
          const chip = (
            <button
              key={a.id}
              type="button"
              onClick={() => pick(a.id)}
              className="tap flex h-10 shrink-0 items-center gap-1.5 rounded-full pl-2 pr-3.5"
              style={{
                background: here ? 'var(--color-primary-soft)' : 'var(--color-gray-100)',
                color: here ? 'var(--color-primary)' : 'var(--color-text-1)',
                fontSize: 13,
                fontWeight: 700,
              }}
            >
              {a.type === 'card' ? (
                <CardIcon name={a.bank || a.name} size={18} />
              ) : (
                <BankIcon name={a.bank || a.name} size={22} />
              )}
              {a.name}
            </button>
          );
          // Second in the row, so it is on screen without scrolling.
          return i === 0 ? [chip, add] : [chip];
        })}
        {choices.length === 0 && add}
      </div>
    </div>
  );
}
