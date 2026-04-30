'use client';

import Link from 'next/link';
import CategoryIcon from '@/components/icons/CategoryIcon';
import Money from '@/components/Money';
import { useAccounts } from '@/lib/accounts';
import { CATEGORIES, isTransferCategory } from '@/lib/categories';
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
  const isTransfer = isTransferCategory(tx.cat) || !!tx.transferPairId;

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
      <CategoryIcon catId={tx.cat} size={40} />
      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }}
        >
          {tx.merchant}
        </p>
        {subtitleParts.length > 0 && (
          <p
            className="truncate"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
          >
            {subtitleParts.join(' · ')}
          </p>
        )}
      </div>
      <Money
        value={tx.amount}
        sign="auto"
        style={{
          color: isTransfer
            ? 'var(--color-text-2)'
            : tx.amount > 0
              ? 'var(--color-primary)'
              : 'var(--color-text-1)',
          fontSize: 'var(--text-base)',
          fontWeight: 600,
        }}
      />
    </Link>
  );
}
