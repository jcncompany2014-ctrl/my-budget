'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import BankIcon from '@/components/icons/BankIcon';
import CardIcon from '@/components/icons/CardIcon';
import Keypad from '@/components/Keypad';
import Money from '@/components/Money';
import { useToast } from '@/components/Toast';
import Sheet from '@/components/ui/Sheet';
import { useAllAccounts } from '@/lib/accounts';
import { fmt } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';
import { buildTransferLegs } from '@/lib/transfers';
import type { Account } from '@/lib/types';

export default function TransferPage() {
  const router = useRouter();
  const toast = useToast();
  const { accounts } = useAllAccounts();
  const { add } = useAllTransactions();

  const [amount, setAmount] = useState('0');
  const [fromId, setFromId] = useState<string>('');
  const [toId, setToId] = useState<string>('');
  const [memo, setMemo] = useState('');

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
      date: new Date().toISOString(),
      memo: memo.trim(),
    });
    legs.forEach((leg) => add(leg));
    toast.show(isCross ? '계좌 이체 (크로스 모드)' : '계좌 이체 완료', 'success');
    router.replace('/');
  };

  const personalAccs = useMemo(() => accounts.filter((a) => a.scope === 'personal'), [accounts]);
  const businessAccs = useMemo(() => accounts.filter((a) => a.scope === 'business'), [accounts]);

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

      <section className="px-6 pb-3 pt-6 text-center">
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 500 }}>
          이체할 금액
        </p>
        <Money
          value={Number(amount)}
          sign="never"
          className="mt-2 block tracking-tight"
          style={{
            fontSize: 'var(--text-3xl)',
            fontWeight: 800,
            color: amount === '0' ? 'var(--color-text-4)' : 'var(--color-text-1)',
          }}
        />
        {fromAcc && toAcc && Number(amount) > 0 && (
          <p
            className="mt-2 text-center"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
          >
            {fromAcc.name} → {toAcc.name}
            {isCross && (
              <span
                className="ml-2 rounded-full px-2 py-0.5"
                style={{
                  background: 'var(--color-primary-soft)',
                  color: 'var(--color-primary)',
                  fontSize: 'var(--text-xxs)',
                  fontWeight: 700,
                }}
              >
                크로스 모드 ·{' '}
                {fromAcc.scope === 'business' && toAcc.scope === 'personal'
                  ? '사장 인출 / 사장 보수'
                  : '자본 투입'}
              </span>
            )}
          </p>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2 px-4 pb-3">
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
          onSelect={setToId}
          excludeId={fromId}
        />
      </section>

      <section className="px-4 pb-2">
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="메모 (선택)"
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </section>

      {(personalAccs.length === 0 || businessAccs.length === 0) && (
        <p
          className="px-5 pb-1 text-center"
          style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
        >
          크로스 모드 이체를 하려면 양쪽 모드에 계좌가 모두 있어야 해요
        </p>
      )}

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
              {fmt(Math.abs(selected.balance))}원 · {selected.scope === 'business' ? '사업' : '개인'}
            </p>
          </>
        ) : (
          <p
            className="mt-1"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-base)' }}
          >
            계좌 선택
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
            <Group label="개인 계좌" accounts={accounts.filter((a) => a.scope === 'personal')} excludeId={excludeId} onPick={(id) => { onSelect(id); setOpen(false); }} selectedId={selectedId} />
            <Group label="사업 계좌" accounts={accounts.filter((a) => a.scope === 'business')} excludeId={excludeId} onPick={(id) => { onSelect(id); setOpen(false); }} selectedId={selectedId} />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="tap mt-4 h-12 w-full rounded-xl"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
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
