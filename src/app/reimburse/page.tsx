'use client';

import { Check, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import DatePickerSection from '@/components/DatePickerSection';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import { useMode } from '@/components/ModeProvider';
import { SkeletonHome } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import { useAllAccounts } from '@/lib/accounts';
import { fmt } from '@/lib/format';
import { buildSettlement, dueTotal, isDue } from '@/lib/reimburse';
import {
  addTransactions,
  patchTransactions,
  removeTransaction,
  useAllTransactions,
} from '@/lib/storage';
import type { Account } from '@/lib/types';

const shortDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
};

/**
 * 사업 대납 정산. Rows flagged "사업 대납" (business costs paid with personal
 * money) wait here; settling posts one business → personal transfer for the
 * chosen rows and marks them paid back.
 */
export default function ReimbursePage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { tx, ready } = useAllTransactions();
  const { accounts } = useAllAccounts();

  const due = useMemo(() => tx.filter(isDue).sort((a, b) => b.date.localeCompare(a.date)), [tx]);
  // Everything is ticked to begin with; rows are unticked to leave them for later.
  const [skipped, setSkipped] = useState<Set<string>>(() => new Set());
  const chosen = useMemo(() => due.filter((t) => !skipped.has(t.id)), [due, skipped]);
  const total = dueTotal(chosen);

  const bizAccounts = useMemo(
    () =>
      accounts.filter((a) => a.scope === 'business' && (a.type === 'bank' || a.type === 'cash')),
    [accounts],
  );
  const myAccounts = useMemo(
    () =>
      accounts.filter((a) => a.scope === 'personal' && (a.type === 'bank' || a.type === 'cash')),
    [accounts],
  );
  const [fromId, setFromId] = useState('');
  const [toId, setToId] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());
  useEffect(() => {
    if (!fromId && bizAccounts.length > 0) {
      setFromId((bizAccounts.find((a) => a.main) ?? bizAccounts[0]).id);
    }
    if (!toId && myAccounts.length > 0) {
      setToId((myAccounts.find((a) => a.main) ?? myAccounts[0]).id);
    }
  }, [bizAccounts, myAccounts, fromId, toId]);
  const from = bizAccounts.find((a) => a.id === fromId);
  const to = myAccounts.find((a) => a.id === toId);

  const settled = useMemo(
    () =>
      tx
        .filter((t) => t.amount > 0 && t.transferPairId?.startsWith('settle-'))
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 8),
    [tx],
  );

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? '';
  const valid = total > 0 && !!from && !!to;

  const settle = () => {
    if (!valid || !from || !to) return;
    const ids = chosen.map((t) => t.id);
    const legs = buildSettlement({
      rows: chosen,
      from,
      to,
      date: date.toISOString(),
      seq: Date.now().toString(36),
    });
    if (legs.length === 0) return;
    addTransactions(legs);
    patchTransactions(ids, { reimburse: 'done' });
    setSkipped(new Set());
    toast.show(`${fmt(total)}원 정산 완료`, {
      variant: 'success',
      durationMs: 5000,
      action: {
        label: '되돌리기',
        onClick: () => {
          // Removing one leg takes its pair with it.
          removeTransaction(legs[0].id);
          patchTransactions(ids, { reimburse: 'due' });
          toast.show('취소됨', 'info');
        },
      },
    });
  };

  if (!ready) return <SkeletonHome />;

  return (
    <>
      <TopBar
        title="사업 대납 정산"
        right={
          <button
            type="button"
            onClick={() => router.back()}
            className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            완료
          </button>
        }
      />

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
            {mode === 'business' ? '대표에게 줄 돈' : '사업에서 받을 돈'}
          </p>
          <p
            className="tnum mt-1 tracking-tight"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xl)', fontWeight: 800 }}
          >
            {fmt(dueTotal(due))}원
          </p>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            {due.length}건
          </p>
        </div>
      </section>

      {due.length === 0 ? (
        <section className="px-5 pb-3">
          <p
            className="rounded-2xl px-4 py-3.5"
            style={{
              background: 'var(--color-card)',
              color: 'var(--color-text-3)',
              fontSize: 'var(--text-sm)',
            }}
          >
            정산할 대납이 없어요
          </p>
        </section>
      ) : (
        <>
          <section className="px-5 pb-3">
            <div className="mb-2 flex items-center justify-between">
              <h2
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                정산할 내역
              </h2>
              <button
                type="button"
                onClick={() =>
                  setSkipped(skipped.size === 0 ? new Set(due.map((t) => t.id)) : new Set())
                }
                className="tap -mr-2 rounded-full px-2 py-1.5"
                style={{
                  color: 'var(--color-primary)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                }}
              >
                {skipped.size === 0 ? '전체 해제' : '전체 선택'}
              </button>
            </div>
            <div
              className="overflow-hidden rounded-2xl"
              style={{ background: 'var(--color-card)' }}
            >
              {due.map((t, i) => {
                const on = !skipped.has(t.id);
                return (
                  <div
                    key={t.id}
                    className="flex items-center"
                    style={{
                      borderBottom: i < due.length - 1 ? '1px solid var(--color-divider)' : 'none',
                    }}
                  >
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() =>
                        setSkipped((prev) => {
                          const next = new Set(prev);
                          if (on) next.add(t.id);
                          else next.delete(t.id);
                          return next;
                        })
                      }
                      className="tap flex min-w-0 flex-1 items-center gap-3 py-3 pl-4 text-left"
                    >
                      <span
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                        style={{
                          background: on ? 'var(--color-primary)' : 'transparent',
                          border: on ? 'none' : '2px solid var(--color-gray-300)',
                        }}
                      >
                        {on && <Check size={14} strokeWidth={3.2} color="#fff" />}
                      </span>
                      <MerchantAvatar merchant={t.merchant} catId={t.cat} size={36} />
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate"
                          style={{
                            color: 'var(--color-text-1)',
                            fontSize: 'var(--text-base)',
                            fontWeight: 500,
                          }}
                        >
                          {t.merchant}
                        </span>
                        <span
                          className="block truncate"
                          style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
                        >
                          {shortDate(t.date)} · {accountName(t.acc)}
                        </span>
                      </span>
                      <span
                        className="tnum shrink-0"
                        style={{
                          color: on ? 'var(--color-text-1)' : 'var(--color-text-4)',
                          fontSize: 'var(--text-base)',
                          fontWeight: 600,
                        }}
                      >
                        {fmt(-t.amount)}원
                      </span>
                    </button>
                    <Link
                      href={`/tx?id=${t.id}`}
                      className="tap flex h-12 w-10 shrink-0 items-center justify-center"
                      aria-label={`${t.merchant} 상세`}
                    >
                      <ChevronRight size={18} color="var(--color-text-4)" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="px-5 pb-3">
            <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
              <AccountChips
                label="보낼 사업 계좌"
                accounts={bizAccounts}
                value={fromId}
                onPick={setFromId}
              />
              <div className="h-3" />
              <AccountChips
                label="받을 내 계좌"
                accounts={myAccounts}
                value={toId}
                onPick={setToId}
              />
              <div className="h-3" />
              <DatePickerSection date={date} onChange={setDate} bare pastOnly />
              <button
                type="button"
                disabled={!valid}
                onClick={settle}
                className="tap mt-4 h-13 w-full rounded-2xl"
                style={{
                  height: 52,
                  background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
                  color: valid ? '#fff' : 'var(--color-text-4)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 700,
                }}
              >
                {total > 0 ? `${chosen.length}건 · ${fmt(total)}원 정산` : '정산'}
              </button>
            </div>
          </section>
        </>
      )}

      {settled.length > 0 && (
        <section className="px-5 pb-6">
          <h2
            className="mb-2"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            정산 내역
          </h2>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {settled.map((t, i) => (
              <Link
                key={t.id}
                href={`/tx?id=${t.id}`}
                className="tap flex items-center justify-between px-4 py-3"
                style={{
                  borderBottom: i < settled.length - 1 ? '1px solid var(--color-divider)' : 'none',
                }}
              >
                <span className="min-w-0">
                  <span
                    className="block truncate"
                    style={{
                      color: 'var(--color-text-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                    }}
                  >
                    {t.memo || '대납 정산'}
                  </span>
                  <span style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                    {shortDate(t.date)} · {accountName(t.acc)}
                  </span>
                </span>
                <span
                  className="tnum shrink-0"
                  style={{
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 700,
                  }}
                >
                  {fmt(t.amount)}원
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function AccountChips({
  label,
  accounts,
  value,
  onPick,
}: {
  label: string;
  accounts: Account[];
  value: string;
  onPick: (id: string) => void;
}) {
  return (
    <div>
      <p
        className="mb-2"
        style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 600 }}
      >
        {label}
      </p>
      {accounts.length === 0 ? (
        <p style={{ color: 'var(--color-text-4)', fontSize: 'var(--text-sm)' }}>계좌 없음</p>
      ) : (
        <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
          {accounts.map((a) => {
            const on = a.id === value;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => onPick(a.id)}
                className="tap shrink-0 rounded-xl px-3.5 py-2.5"
                style={{
                  background: on ? 'var(--color-primary)' : 'var(--color-gray-100)',
                  color: on ? '#fff' : 'var(--color-text-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
