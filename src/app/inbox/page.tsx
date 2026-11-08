'use client';

import {
  AlertCircle,
  ArrowLeft,
  BellRing,
  CopyX,
  Inbox,
  RefreshCw,
  RotateCcw,
  Settings2,
  Undo2,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import Money from '@/components/Money';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/ui/EmptyState';
import { useAllAccounts } from '@/lib/accounts';
import { CATEGORIES } from '@/lib/categories';
import { localDayKey } from '@/lib/dates';
import {
  describeSync,
  forceAddLogEntry,
  restoreCancelled,
  syncInbox,
  useInboxKey,
  useInboxLog,
} from '@/lib/inbox';
import type { InboxLogEntry } from '@/lib/inbox-import';
import { useAllTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

const STATUS_META: Record<
  InboxLogEntry['status'],
  { label: string; color: string; Icon: typeof Inbox }
> = {
  added: { label: '기록됨', color: 'var(--color-primary)', Icon: BellRing },
  duplicate: { label: '이미 있는 거래라 건너뜀', color: '#8B95A1', Icon: CopyX },
  cancelled: { label: '승인취소 → 기존 거래 삭제', color: '#F59E0B', Icon: Undo2 },
  refund: { label: '취소할 거래가 없어 환불로 기록', color: '#3182F6', Icon: RotateCcw },
  unparsed: { label: '못 읽은 알림', color: 'var(--color-danger)', Icon: AlertCircle },
};

function dayLabel(key: string): string {
  const today = localDayKey(new Date());
  const y = new Date();
  y.setDate(y.getDate() - 1);
  if (key === today) return '오늘';
  if (key === localDayKey(y)) return '어제';
  const [yy, mm, dd] = key.split('-').map(Number);
  const d = new Date(yy, mm - 1, dd);
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'short' });
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
}

export default function InboxPage() {
  const router = useRouter();
  const toast = useToast();
  const { items: log, ready, remove } = useInboxLog();
  const { value: key, ready: keyReady } = useInboxKey();
  const { tx } = useAllTransactions();
  const { accounts } = useAllAccounts();
  const [syncing, setSyncing] = useState(false);

  const txById = useMemo(() => new Map(tx.map((t) => [t.id, t])), [tx]);
  const accountName = useMemo(() => new Map(accounts.map((a) => [a.id, a.name])), [accounts]);
  // Rows a 승인취소 deleted — their own "added" entry should say so, not just "삭제한 거래".
  const cancelledTxIds = useMemo(
    () =>
      new Set(
        log.filter((e) => e.status === 'cancelled' && !e.undone && e.txId).map((e) => e.txId),
      ),
    [log],
  );
  const month = useMemo(() => {
    const now = new Date();
    const rows = tx.filter((t) => {
      if (t.source !== 'notification') return false;
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return { count: rows.length, spent: rows.reduce((s, t) => s + Math.min(0, t.amount), 0) };
  }, [tx]);

  const groups = useMemo(() => {
    const out: Array<{ key: string; entries: InboxLogEntry[] }> = [];
    for (const e of log) {
      const k = localDayKey(e.at);
      const last = out[out.length - 1];
      if (last?.key === k) last.entries.push(e);
      else out.push({ key: k, entries: [e] });
    }
    return out;
  }, [log]);

  const onSync = async () => {
    setSyncing(true);
    const s = await syncInbox({ force: true });
    setSyncing(false);
    if (!s) toast.show('동기화하지 못했어요 — 연결 상태를 확인해 주세요', 'error');
    else toast.show(describeSync(s) ?? '새 알림이 없어요', { variant: 'info', haptic: false });
  };

  return (
    <>
      <TopBar
        left={
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로"
            className="tap -ml-2 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ color: 'var(--color-text-1)' }}
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
        }
        title="자동 기록 내역"
        right={
          key ? (
            <>
              <button
                type="button"
                onClick={onSync}
                disabled={syncing}
                aria-label="지금 동기화"
                className="tap flex h-10 w-10 items-center justify-center rounded-full"
                style={{ color: 'var(--color-text-2)' }}
              >
                <RefreshCw
                  size={19}
                  strokeWidth={2.4}
                  className={syncing ? 'animate-spin' : undefined}
                />
              </button>
              <Link
                href="/settings/auto-record"
                aria-label="자동 기록 설정"
                className="tap flex h-10 w-10 items-center justify-center rounded-full"
                style={{ color: 'var(--color-text-2)' }}
              >
                <Settings2 size={19} strokeWidth={2.4} />
              </Link>
            </>
          ) : null
        }
      />

      {keyReady && !key ? (
        <section className="px-5 pt-2">
          <EmptyState
            icon={BellRing}
            iconColor="#2E3561"
            title="카드 알림 자동 기록이 꺼져 있어요"
            hint="결제 알림을 아이폰 단축어로 보내면, 앱을 열 때 알아서 기록돼요."
            cta={{ href: '/settings/auto-record', label: '설정하기' }}
          />
        </section>
      ) : (
        <>
          <section className="px-5 pb-3 pt-1">
            <div
              className="flex items-center justify-between rounded-2xl px-4 py-3.5"
              style={{ background: 'var(--color-card)' }}
            >
              <div>
                <p style={{ color: 'var(--color-text-3)', fontSize: 11.5, fontWeight: 700 }}>
                  이번 달 자동 기록
                </p>
                <p
                  className="tnum mt-0.5"
                  style={{ color: 'var(--color-text-1)', fontSize: 20, fontWeight: 800 }}
                >
                  {month.count}건
                </p>
              </div>
              <Money
                value={month.spent}
                style={{ color: 'var(--color-text-2)', fontSize: 15, fontWeight: 800 }}
              />
            </div>
          </section>

          {ready && log.length === 0 ? (
            <section className="px-5">
              <EmptyState
                icon={Inbox}
                iconColor="var(--color-primary)"
                title="아직 들어온 알림이 없어요"
                hint="단축어를 만들고 결제를 한 번 해보세요. 앱을 열면 여기에 쌓여요."
                cta={{ href: '/settings/auto-record', label: '단축어 설정 보기' }}
              />
            </section>
          ) : (
            groups.map((g) => (
              <section key={g.key} className="px-5 pb-3">
                <h2
                  className="mb-1.5 px-1"
                  style={{ color: 'var(--color-text-3)', fontSize: 12, fontWeight: 700 }}
                >
                  {dayLabel(g.key)}
                </h2>
                <div
                  className="overflow-hidden rounded-2xl"
                  style={{ background: 'var(--color-card)' }}
                >
                  {g.entries.map((e, i) => {
                    const t = e.txId ? txById.get(e.txId) : undefined;
                    return (
                      <LogRow
                        key={e.id}
                        entry={e}
                        tx={t}
                        accountName={t ? accountName.get(t.acc) : undefined}
                        cancelledLater={!!e.txId && cancelledTxIds.has(e.txId)}
                        onRemove={() => remove(e.id)}
                        last={i === g.entries.length - 1}
                      />
                    );
                  })}
                </div>
              </section>
            ))
          )}
          {log.length > 0 && (
            <p
              className="px-5 pb-12 pt-1 text-center"
              style={{ color: 'var(--color-text-4)', fontSize: 11 }}
            >
              최근 100건까지 보관돼요
            </p>
          )}
        </>
      )}
    </>
  );
}

function LogRow({
  entry,
  tx,
  accountName,
  cancelledLater,
  onRemove,
  last,
}: {
  entry: InboxLogEntry;
  tx?: Transaction;
  accountName?: string;
  /** This entry's row was later deleted by a 승인취소. */
  cancelledLater: boolean;
  onRemove: () => void;
  last: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [showRaw, setShowRaw] = useState(false);
  const meta = STATUS_META[entry.status];
  const live = (entry.status === 'added' || entry.status === 'refund') && tx;

  const title = live ? tx.merchant : entry.status === 'unparsed' ? '못 읽은 알림' : entry.summary;
  const sub = live
    ? [CATEGORIES[tx.cat]?.name, accountName, timeLabel(entry.at)].filter(Boolean).join(' · ')
    : entry.status === 'added'
      ? `${cancelledLater ? '승인취소로 삭제됨' : '삭제한 거래'} · ${timeLabel(entry.at)}`
      : entry.status === 'unparsed'
        ? entry.summary
        : entry.undone
          ? `승인취소 되돌림 · ${timeLabel(entry.at)}`
          : `${meta.label} · ${timeLabel(entry.at)}`;

  const actions: Array<{ label: string; run: () => void; primary?: boolean }> = [];
  if (entry.status === 'duplicate') {
    actions.push({
      label: '그래도 추가',
      primary: true,
      run: () => {
        const id = forceAddLogEntry(entry);
        toast.show(id ? '추가했어요' : '추가하지 못했어요', id ? 'success' : 'error');
      },
    });
  }
  if (entry.status === 'cancelled' && entry.removed?.length) {
    actions.push({
      label: '되돌리기',
      primary: true,
      run: () => {
        if (restoreCancelled(entry)) toast.show('삭제했던 거래를 되살렸어요', 'success');
      },
    });
  }
  if (entry.status === 'unparsed') {
    actions.push({
      label: '직접 입력',
      primary: true,
      run: () => router.push(`/quick-add?text=${encodeURIComponent(entry.raw)}`),
    });
    actions.push({ label: '지우기', run: onRemove });
  }

  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid var(--color-divider)' }}>
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          type="button"
          onClick={() => (live ? router.push(`/tx/${tx.id}`) : setShowRaw((v) => !v))}
          className="tap flex min-w-0 flex-1 items-center gap-3 text-left"
        >
          {live ? (
            <MerchantAvatar merchant={tx.merchant} catId={tx.cat} size={36} badge />
          ) : (
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{
                background: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                color: meta.color,
              }}
            >
              <meta.Icon size={17} strokeWidth={2.4} />
            </span>
          )}
          <span className="min-w-0 flex-1">
            <span
              className="block truncate"
              style={{ color: 'var(--color-text-1)', fontSize: 14.5, fontWeight: 700 }}
            >
              {title}
            </span>
            <span
              className="block truncate"
              style={{ color: 'var(--color-text-3)', fontSize: 11.5 }}
            >
              {sub}
            </span>
          </span>
        </button>
        {live ? (
          <Money
            value={tx.amount}
            sign={tx.amount > 0 ? 'positive' : 'negative'}
            style={{
              color: tx.amount > 0 ? 'var(--color-primary)' : 'var(--color-text-1)',
              fontSize: 14.5,
              fontWeight: 800,
            }}
          />
        ) : (
          actions.map((a) => (
            <button
              key={a.label}
              type="button"
              onClick={a.run}
              className="tap shrink-0 rounded-full px-3 py-1.5"
              style={{
                background: a.primary ? 'var(--color-primary-soft)' : 'var(--color-gray-100)',
                color: a.primary ? 'var(--color-primary)' : 'var(--color-text-3)',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {a.label}
            </button>
          ))
        )}
      </div>
      {showRaw && (
        <pre
          className="mx-4 mb-3 whitespace-pre-wrap break-all rounded-xl px-3 py-2.5"
          style={{
            background: 'var(--color-gray-50)',
            color: 'var(--color-text-2)',
            fontSize: 11.5,
            lineHeight: 1.5,
            fontFamily: 'inherit',
          }}
        >
          {entry.raw}
        </pre>
      )}
    </div>
  );
}
