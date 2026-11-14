'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { useMode } from '@/components/ModeProvider';
import { useAccounts } from '@/lib/accounts';
import { useCreditLines } from '@/lib/credit-lines';
import { fmtShort } from '@/lib/format';
import { useInvestments } from '@/lib/investments';
import { useLoans } from '@/lib/loans';
import { computeNetWorth } from '@/lib/net-worth';
import { useRecordNetWorth } from '@/lib/net-worth-history';
import { FX_IDS, type QuoteId, useQuotes } from '@/lib/quotes';
import { useReimburseDue } from '@/lib/use-reimburse';

/**
 * Home tile: net worth of the current ledger — the same figure the 자산 tab
 * shows. Subscribes to quotes itself so a price tick re-renders this tile,
 * not the whole home page.
 */
export default function NetWorthCard() {
  const { mode } = useMode();
  const { accounts, ready: accountsReady } = useAccounts();
  const { items: investments, ready: investmentsReady } = useInvestments();
  const { items: loans, ready: loansReady } = useLoans();
  const { items: creditLines, ready: creditLinesReady } = useCreditLines();

  const mine = useMemo(() => investments.filter((i) => i.scope === mode), [investments, mode]);
  const liveIds = useMemo<QuoteId[]>(() => {
    const ids = new Set<QuoteId>(FX_IDS);
    for (const i of mine) if (i.autoQuote && i.quoteId) ids.add(i.quoteId as QuoteId);
    return Array.from(ids);
  }, [mine]);
  const { quotes } = useQuotes(liveIds);

  const reimburseDue = useReimburseDue();
  const nw = computeNetWorth({
    accounts,
    investments: mine,
    loans: loans.filter((l) => l.scope === mode),
    creditLines: creditLines.filter((l) => l.scope === mode),
    quotes,
    owedToMe: mode === 'personal' ? reimburseDue : 0,
    owedToOwner: mode === 'business' ? reimburseDue : 0,
  });
  const debt = nw.loanDebt + nw.creditLineUsed - nw.cardDebt + nw.ownerPayable;
  const empty = accounts.length === 0 && mine.length === 0 && debt === 0;
  // The home screen is where the app opens, so this is where the daily value is kept.
  useRecordNetWorth(
    mode,
    nw.net,
    accountsReady && investmentsReady && loansReady && creditLinesReady && !empty,
  );

  return (
    <Link
      href="/wallet"
      className="tap rounded-2xl p-4"
      style={{ background: 'var(--color-card)' }}
    >
      <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 500 }}>
        순자산
      </p>
      <p
        className="tnum mt-1.5 tracking-tight"
        style={{
          color: nw.net < 0 ? 'var(--color-danger)' : 'var(--color-text-1)',
          fontSize: 'var(--text-lg)',
          fontWeight: 800,
        }}
      >
        {nw.net < 0 ? '−' : ''}
        {fmtShort(Math.abs(nw.net))}원
      </p>
      <p
        className="tnum truncate"
        style={{
          color: empty ? 'var(--color-primary)' : 'var(--color-text-3)',
          fontSize: 'var(--text-xxs)',
          marginTop: 4,
          fontWeight: 600,
        }}
      >
        {empty
          ? '계좌 추가'
          : debt > 0
            ? `부채 ${fmtShort(debt)}원 포함`
            : `계좌 ${accounts.length}개`}
      </p>
    </Link>
  );
}
