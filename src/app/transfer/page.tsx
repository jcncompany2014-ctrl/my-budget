'use client';

import { ArrowLeftRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import DatePickerSection from '@/components/DatePickerSection';
import BankIcon from '@/components/icons/BankIcon';
import CardIcon from '@/components/icons/CardIcon';
import Keypad from '@/components/Keypad';
import { useMode } from '@/components/ModeProvider';
import Money from '@/components/Money';
import { useToast } from '@/components/Toast';
import Sheet from '@/components/ui/Sheet';
import { useAllAccounts } from '@/lib/accounts';
import { lastTransferTarget } from '@/lib/default-account';
import { fmt } from '@/lib/format';
import { addTransactions, useAllTransactions } from '@/lib/storage';
import { buildTransferLegs } from '@/lib/transfers';
import type { Account } from '@/lib/types';

export default function TransferPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { accounts } = useAllAccounts();
  const { tx: history, remove } = useAllTransactions();

  const [amount, setAmount] = useState('');
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [toTouched, setToTouched] = useState(false);
  const [memo, setMemo] = useState('');
  const [date, setDate] = useState<Date>(() => new Date());

  // Starts filled in: money leaves the main account of the ledger on screen,
  // and goes where it went the last time it left that account.
  useEffect(() => {
    if (fromId || accounts.length === 0) return;
    const mine = accounts.filter((a) => a.scope === mode && a.type !== 'receivable');
    const start = mine.find((a) => a.main) ?? mine.find((a) => a.type !== 'card') ?? mine[0];
    if (start) setFromId(start.id);
  }, [accounts, mode, fromId]);
  useEffect(() => {
    if (toTouched || !fromId) return;
    setToId(lastTransferTarget(history, accounts, fromId));
  }, [fromId, toTouched, history, accounts]);

  const fromAcc = accounts.find((a) => a.id === fromId);
  const toAcc = accounts.find((a) => a.id === toId);
  const isCross = fromAcc && toAcc && fromAcc.scope !== toAcc.scope;

  const valid = !!fromAcc && !!toAcc && fromAcc.id !== toAcc.id && Number(amount) > 0;

  const submit = () => {
    if (!valid || !fromAcc || !toAcc) return;
    const legs = buildTransferLegs({
      fromAcc,
      toAcc,
      amount: Number(amount),
      date: date.toISOString(),
      memo: memo.trim(),
    });
    // One write for both legs — never a transfer with only one side saved.
    addTransactions(legs);
    toast.show(`${toAcc.name}(으)로 ${fmt(Number(amount))}원`, {
      variant: 'success',
      durationMs: 4500,
      action: {
        label: '되돌리기',
        onClick: () => {
          // Removing one leg takes its pair with it.
          remove(legs[0].id);
          toast.show('취소됨', 'info');
        },
      },
    });
    router.back();
  };

  const swap = () => {
    setToTouched(true);
    setFromId(toId);
    setToId(fromId);
  };

  const crossLabel = useMemo(() => {
    if (!fromAcc || !toAcc || fromAcc.scope === toAcc.scope) return '';
    return fromAcc.scope === 'business' ? '사장 인출' : '자본 투입';
  }, [fromAcc, toAcc]);

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--color-card)' }}>
      <header className="flex items-center justify-between px-3 pt-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="tap rounded-full px-3 py-2 font-semibold"
          style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)' }}
        >
          취소
        </button>
        <h1 style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
          계좌 이체
        </h1>
        <div className="w-12" />
      </header>

      <section className="px-6 pb-3 pt-5 text-center">
        <p className="tnum text-[40px] font-extrabold tracking-tight">
          {Number(amount) > 0 ? (
            <>
              <span style={{ color: 'var(--color-text-1)' }}>{fmt(Number(amount))}</span>
              <span className="ml-1 text-[26px]" style={{ color: 'var(--color-text-3)' }}>
                원
              </span>
            </>
          ) : (
            <span style={{ color: 'var(--color-text-4)' }}>0원</span>
          )}
        </p>
        {/* Fixed height so the keypad does not jump when the tag appears. */}
        <p className="mt-1 h-5">
          {isCross && (
            <span
              className="rounded-full px-2 py-0.5"
              style={{
                background: 'var(--color-primary-soft)',
                color: 'var(--color-primary)',
                fontSize: 'var(--text-xxs)',
                fontWeight: 700,
              }}
            >
              {crossLabel}
            </span>
          )}
        </p>
      </section>

      <section className="relative grid grid-cols-2 gap-2 px-4 pb-2">
        <AccountPicker
          label="보낼 계좌"
          accounts={accounts}
          selectedId={fromId}
          onSelect={setFromId}
          excludeId={toId}
        />
        <AccountPicker
          label="받을 계좌"
          accounts={accounts}
          selectedId={toId}
          onSelect={(id) => {
            setToTouched(true);
            setToId(id);
          }}
          excludeId={fromId}
        />
        <button
          type="button"
          onClick={swap}
          disabled={!fromId || !toId}
          className="tap absolute left-1/2 top-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full disabled:opacity-40"
          style={{
            background: 'var(--color-card)',
            boxShadow: '0 1px 4px rgba(20, 28, 40, 0.14)',
            marginTop: -4,
          }}
          aria-label="보낼 계좌와 받을 계좌 바꾸기"
        >
          <ArrowLeftRight size={16} strokeWidth={2.4} color="var(--color-text-2)" />
        </button>
      </section>

      <section className="flex flex-col gap-2 px-4 pb-2">
        <DatePickerSection date={date} onChange={setDate} bare />
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모"
          enterKeyHint="done"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur();
          }}
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </section>

      <div className="flex-1" />

      <Keypad value={amount} onChange={setAmount} />

      <div
        className="px-4 pb-6 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <button
          type="button"
          disabled={!valid}
          onClick={submit}
          className="tap h-14 w-full rounded-2xl tracking-tight"
          style={{
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
            color: valid ? '#fff' : 'var(--color-text-4)',
          }}
        >
          이체하기
        </button>
      </div>
    </div>
  );
}

function AccountPicker({
  label,
  accounts,
  selectedId,
  onSelect,
  excludeId,
}: {
  label: string;
  accounts: Account[];
  selectedId: string;
  onSelect: (id: string) => void;
  excludeId?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = accounts.find((a) => a.id === selectedId);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tap rounded-2xl px-4 py-3 text-left"
        style={{ background: 'var(--color-gray-100)' }}
      >
        <p
          style={{
            color: 'var(--color-text-3)',
            fontSize: 'var(--text-xxs)',
            fontWeight: 600,
          }}
        >
          {label}
        </p>
        {selected ? (
          <>
            <p
              className="mt-1 truncate"
              style={{
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
              }}
            >
              {selected.name}
            </p>
            <p
              className="tnum mt-0.5"
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}
            >
              {fmt(Math.abs(selected.balance))}원 ·{' '}
              {selected.scope === 'business' ? '사업' : '개인'}
            </p>
          </>
        ) : (
          <p
            className="mt-1"
            style={{ color: 'var(--color-text-4)', fontSize: 'var(--text-base)', fontWeight: 700 }}
          >
            선택
          </p>
        )}
      </button>

      {open && (
        <Sheet open onClose={() => setOpen(false)}>
          <h3
            className="mb-3"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}
          >
            {label}
          </h3>
          <Group
            label="개인 계좌"
            accounts={accounts.filter((a) => a.scope === 'personal')}
            excludeId={excludeId}
            onPick={(id) => {
              onSelect(id);
              setOpen(false);
            }}
            selectedId={selectedId}
          />
          <Group
            label="사업 계좌"
            accounts={accounts.filter((a) => a.scope === 'business')}
            excludeId={excludeId}
            onPick={(id) => {
              onSelect(id);
              setOpen(false);
            }}
            selectedId={selectedId}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="tap mt-4 h-12 w-full rounded-xl"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
            }}
          >
            닫기
          </button>
        </Sheet>
      )}
    </>
  );
}

function Group({
  label,
  accounts,
  selectedId,
  excludeId,
  onPick,
}: {
  label: string;
  accounts: Account[];
  selectedId: string;
  excludeId?: string;
  onPick: (id: string) => void;
}) {
  if (accounts.length === 0) return null;
  return (
    <>
      <p
        className="mb-2 mt-1"
        style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 700 }}
      >
        {label}
      </p>
      <div className="mb-2 space-y-1.5">
        {accounts.map((a) => {
          const disabled = a.id === excludeId;
          const sel = a.id === selectedId;
          return (
            <button
              key={a.id}
              type="button"
              disabled={disabled}
              onClick={() => onPick(a.id)}
              className="tap flex w-full items-center justify-between rounded-xl px-4 py-3 disabled:opacity-30"
              style={{
                background: sel ? 'var(--color-primary-soft)' : 'var(--color-gray-100)',
                border: `2px solid ${sel ? 'var(--color-primary)' : 'transparent'}`,
              }}
            >
              <div className="flex items-center gap-3">
                {a.type === 'card' ? (
                  <CardIcon name={a.bank || a.name} size={36} />
                ) : (
                  <BankIcon name={a.bank || a.name} size={36} />
                )}
                <span
                  style={{
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 600,
                  }}
                >
                  {a.name}
                </span>
              </div>
              <Money
                value={a.balance}
                sign={a.type === 'card' ? 'negative' : 'auto'}
                style={{
                  color: a.type === 'card' ? 'var(--color-danger)' : 'var(--color-text-1)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              />
            </button>
          );
        })}
      </div>
    </>
  );
}
