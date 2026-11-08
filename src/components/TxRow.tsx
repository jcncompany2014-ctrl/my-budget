'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import Money from '@/components/Money';
import { useAccounts } from '@/lib/accounts';
import { CATEGORIES, isTransferCategory } from '@/lib/categories';
import { haptics } from '@/lib/haptics';
import type { Transaction } from '@/lib/types';

type Props = {
  tx: Transaction;
  showTime?: boolean;
  /** Prefix the date ("11월 8일") — for lists that span multiple days without date headers. */
  showDate?: boolean;
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

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}월 ${d.getDate()}일`
    : `${String(d.getFullYear()).slice(2)}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
};

// Long-press threshold — iOS-ish feel
const LONG_PRESS_MS = 420;

export default function TxRow({
  tx,
  showTime,
  showDate,
  showAccount,
  borderBottom = true,
  compact,
}: Props) {
  const cat = CATEGORIES[tx.cat];
  const { accounts } = useAccounts();
  const router = useRouter();
  const account = accounts.find((a) => a.id === tx.acc);
  const isTransfer = isTransferCategory(tx.cat) || !!tx.transferPairId;

  const subtitleParts: string[] = [];
  if (showDate && showTime) subtitleParts.push(`${fmtDate(tx.date)} ${fmtTime(tx.date)}`);
  else if (showDate) subtitleParts.push(fmtDate(tx.date));
  else if (showTime) subtitleParts.push(fmtTime(tx.date));
  if (!showTime && !showDate && !showAccount) subtitleParts.push(cat?.name ?? '기타');
  if (showAccount && account) subtitleParts.push(account.bank || account.name);
  if (tx.memo) subtitleParts.push(tx.memo);

  // Long-press merchant → drill-down. Short press behaves as Link navigation.
  const pressTimer = useRef<number | null>(null);
  const didLongPress = useRef(false);

  const startPress = () => {
    didLongPress.current = false;
    if (!tx.merchant.trim()) return;
    pressTimer.current = window.setTimeout(() => {
      didLongPress.current = true;
      haptics.medium();
      router.push(`/merchant/${encodeURIComponent(tx.merchant.trim())}`);
    }, LONG_PRESS_MS);
  };
  const endPress = () => {
    if (pressTimer.current) {
      window.clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  return (
    <Link
      href={`/tx/${tx.id}`}
      onClick={(e) => {
        if (didLongPress.current) {
          e.preventDefault();
          didLongPress.current = false;
        }
      }}
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerLeave={endPress}
      className={`tap flex items-center gap-3 px-4 ${compact ? 'py-2.5' : 'py-3'}`}
      style={{
        borderBottom: borderBottom ? '1px solid var(--color-divider)' : 'none',
        touchAction: 'manipulation',
        // Suppress iOS link-preview / text-selection so long-press can open the merchant page
        WebkitTouchCallout: 'none',
        WebkitUserSelect: 'none',
        userSelect: 'none',
      }}
      onContextMenu={(e) => e.preventDefault()}
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
