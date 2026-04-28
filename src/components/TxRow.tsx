'use client';

import Link from 'next/link';
import { useAccounts } from '@/lib/accounts';
import { CATEGORIES } from '@/lib/categories';
import { fmtSigned } from '@/lib/format';
import type { Transaction } from '@/lib/types';

type Props = {
  tx: Transaction;
  showTime?: boolean;
  showAccount?: boolean;
  borderBottom?: boolean;
  compact?: boolean;
};

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export default function TxRow({
  tx,
  showTime,
  showAccount,
  borderBottom = true,
  compact,
}: Props) {
  const cat = CATEGORIES[tx.cat];
  const { accounts } = useAccounts();
  const account = accounts.find((a) => a.id === tx.acc);

  const subtitleParts: string[] = [];
  if (showTime) subtitleParts.push(fmtTime(tx.date));
  if (!showTime && !showAccount) subtitleParts.push(cat?.name ?? '기타');
  if (showAccount && account) subtitleParts.push(account.bank || account.name);
  if (tx.memo) subtitleParts.push(tx.memo);

  return (
    <Link
      href={`/tx/${tx.id}`}
      className={`tap flex items-center gap-3 px-4 ${compact ? 'py-2.5' : 'py-3'}`}
      style={{ borderBottom: borderBottom ? '1px solid var(--color-divider)' : 'none' }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ background: cat?.color ? `${cat.color}1a` : 'var(--color-gray-150)' }}
      >
        {cat?.emoji ?? '💰'}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium" style={{ color: 'var(--color-text-1)' }}>
          {tx.merchant}
        </p>
        {subtitleParts.length > 0 && (
          <p className="truncate text-xs" style={{ color: 'var(--color-text-3)' }}>
            {subtitleParts.join(' · ')}
          </p>
        )}
      </div>
      <span
        className="tnum text-[15px] font-semibold"
        style={{ color: tx.amount > 0 ? 'var(--color-primary)' : 'var(--color-text-1)' }}
      >
        {fmtSigned(tx.amount)}
      </span>
    </Link>
  );
}
