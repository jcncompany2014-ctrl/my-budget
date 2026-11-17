'use client';

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useMemo } from 'react';
import CardAsk from '@/components/CardAsk';
import { pendingCards, useInboxKey, useInboxLog } from '@/lib/inbox';
import { useServerBackup } from '@/lib/server-backup';

/**
 * What auto-record needs from the user, on the home screen: a card it has not
 * seen before, and notices it could not read. Nothing when there is neither.
 */
export default function InboxPrompt() {
  const { items: log } = useInboxLog();
  const cards = useMemo(() => pendingCards(log), [log]);
  const unread = useMemo(() => log.filter((e) => e.status === 'unparsed').length, [log]);
  const { value: key } = useInboxKey();
  const { value: backup } = useServerBackup();
  // Another copy of the app saved a newer backup: this one neither backs up nor
  // clears the notice queue until it is told which ledger to keep.
  const held = !!key && !!backup.held && !backup.off;
  if (cards.length === 0 && unread === 0 && !held) return null;

  return (
    <section className="space-y-2 px-5 pb-3 pt-1">
      {held && (
        <Link
          href="/settings"
          className="tap flex items-center justify-between rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-card)' }}
        >
          <span style={{ color: 'var(--color-text-1)', fontSize: 13.5, fontWeight: 700 }}>
            서버 백업 확인이 필요해요
          </span>
          <ChevronRight size={18} strokeWidth={2.4} color="var(--color-text-3)" />
        </Link>
      )}
      {cards.slice(0, 1).map((p) => (
        <CardAsk key={`${p.card.issuer ?? ''}|${p.card.last4 ?? ''}`} pending={p} />
      ))}
      {(unread > 0 || cards.length > 1) && (
        <Link
          href="/inbox"
          className="tap flex items-center justify-between rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-card)' }}
        >
          <span style={{ color: 'var(--color-text-1)', fontSize: 13.5, fontWeight: 700 }}>
            {[
              cards.length > 1 ? `새 카드 ${cards.length - 1}장 더` : null,
              unread > 0 ? `못 읽은 알림 ${unread}건` : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
          <ChevronRight size={18} strokeWidth={2.4} color="var(--color-text-3)" />
        </Link>
      )}
    </section>
  );
}
