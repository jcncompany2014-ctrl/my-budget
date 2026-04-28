import Link from 'next/link';
import { CATEGORIES } from '@/lib/categories';
import { fmtSigned } from '@/lib/format';
import type { Transaction } from '@/lib/types';

type Props = {
  tx: Transaction;
  showTime?: boolean;
  borderBottom?: boolean;
};

export default function TxRow({ tx, showTime, borderBottom = true }: Props) {
  const cat = CATEGORIES[tx.cat];

  return (
    <Link
      href={`/tx/${tx.id}`}
      className="tap flex items-center gap-3 px-4 py-3"
      style={{ borderBottom: borderBottom ? '1px solid var(--color-divider)' : 'none' }}
    >
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl"
        style={{ background: cat?.color ? `${cat.color}1a` : 'var(--color-gray-150)' }}
      >
        {cat?.emoji ?? '💰'}
      </div>
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-[15px] font-medium"
          style={{ color: 'var(--color-text-1)' }}
        >
          {tx.merchant}
        </p>
        <p className="truncate text-xs" style={{ color: 'var(--color-text-3)' }}>
          {showTime
            ? new Date(tx.date).toLocaleTimeString('ko-KR', {
                hour: '2-digit',
                minute: '2-digit',
                hour12: false,
              })
            : cat?.name ?? '기타'}
          {tx.memo ? ` · ${tx.memo}` : ''}
        </p>
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
