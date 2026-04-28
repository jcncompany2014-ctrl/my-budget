'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { useAccounts } from '@/lib/accounts';
import {
  CATEGORIES,
  expenseCategoriesByScope,
  incomeCategoriesByScope,
} from '@/lib/categories';
import { fmt } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';
import type { Scope } from '@/lib/types';

export default function EditTxPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { tx, ready, update } = useAllTransactions();
  const { accounts } = useAccounts();

  const item = tx.find((t) => t.id === id);

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [cat, setCat] = useState('');
  const [merchant, setMerchant] = useState('');
  const [memo, setMemo] = useState('');
  const [accId, setAccId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');

  useEffect(() => {
    if (!item) return;
    setAmount(String(Math.abs(item.amount)));
    setType(item.amount >= 0 ? 'income' : 'expense');
    setCat(item.cat);
    setMerchant(item.merchant);
    setMemo(item.memo ?? '');
    setAccId(item.acc);
    const d = new Date(item.date);
    setDate(d.toISOString().slice(0, 10));
    setTime(d.toTimeString().slice(0, 5));
  }, [item]);

  const scope: Scope = item?.scope ?? 'personal';
  const expenseList = useMemo(() => expenseCategoriesByScope(scope), [scope]);
  const incomeList = useMemo(() => incomeCategoriesByScope(scope), [scope]);
  const cats = type === 'expense' ? expenseList : incomeList;

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="mb-2 text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>
          거래를 찾을 수 없어요
        </p>
        <button
          type="button"
          onClick={() => router.replace('/')}
          className="tap rounded-2xl px-5 py-3 text-sm font-bold"
          style={{ background: 'var(--color-primary)', color: '#fff' }}
        >
          홈으로
        </button>
      </div>
    );
  }

  const valid = Number(amount) > 0 && cat !== '';

  const submit = () => {
    if (!valid) return;
    const numericAmount = Number(amount);
    const isoDate = new Date(`${date}T${time || '00:00'}:00`).toISOString();
    update(item.id, {
      amount: type === 'expense' ? -numericAmount : numericAmount,
      cat,
      merchant: merchant.trim() || CATEGORIES[cat]?.name || '거래',
      memo: memo.trim(),
      acc: accId,
      date: isoDate,
    });
    toast.show('수정 완료', 'success');
    router.replace(`/tx/${item.id}`);
  };

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--color-card)' }}>
      <header className="flex items-center justify-between px-3 pt-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="tap rounded-full px-3 py-2 text-sm font-semibold"
          style={{ color: 'var(--color-text-3)' }}
        >
          취소
        </button>
        <h1 className="text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
          거래 편집
        </h1>
        <div className="w-12" />
      </header>

      <section className="px-4 pb-3 pt-4">
        <div
          className="flex rounded-full p-[3px]"
          style={{ background: 'var(--color-gray-100)' }}
        >
          {(['expense', 'income'] as const).map((k) => {
            const sel = type === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setType(k);
                  const list = k === 'expense' ? expenseList : incomeList;
                  if (!list.find((c) => c.id === cat)) setCat(list[0]?.id ?? '');
                }}
                className="tap flex-1 rounded-full py-2 text-[13px] font-bold"
                style={{
                  background: sel ? 'var(--color-card)' : 'transparent',
                  color: sel ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  boxShadow: sel ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {scope === 'business' ? (k === 'expense' ? '비용' : '매출') : k === 'expense' ? '지출' : '수입'}
              </button>
            );
          })}
        </div>
      </section>

      <Field label="금액">
        <div className="flex items-baseline gap-2 rounded-xl px-4 py-3" style={{ background: 'var(--color-gray-100)' }}>
          <input
            type="number"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            className="tnum w-full bg-transparent text-2xl font-extrabold tracking-tight outline-none"
            style={{ color: 'var(--color-text-1)' }}
          />
          <span className="text-base font-semibold" style={{ color: 'var(--color-text-3)' }}>
            원
          </span>
        </div>
        {Number(amount) > 0 && (
          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            {fmt(Number(amount))}원
          </p>
        )}
      </Field>

      <Field label="카테고리">
        <div className="grid grid-cols-4 gap-2">
          {cats.map((c) => {
            const sel = cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setCat(c.id)}
                className="tap flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5"
                style={{
                  background: sel ? `${c.color}22` : 'var(--color-gray-100)',
                  outline: sel ? `2px solid ${c.color}` : 'none',
                }}
              >
                <span className="text-xl">{c.emoji}</span>
                <span className="text-[11px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="가게/거래처">
        <input
          value={merchant}
          onChange={(e) => setMerchant(e.target.value)}
          placeholder="이름"
          className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
          style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
        />
      </Field>

      <Field label="메모">
        <input
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
          placeholder="짧은 메모 (선택)"
          className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
          style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
        />
      </Field>

      <Field label="계좌">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {accounts.map((a) => {
            const sel = accId === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccId(a.id)}
                className="tap shrink-0 rounded-2xl px-4 py-2 text-[13px] font-semibold"
                style={{
                  background: sel ? `${a.color}22` : 'var(--color-gray-100)',
                  color: sel ? a.color : 'var(--color-text-2)',
                  outline: sel ? `1.5px solid ${a.color}` : 'none',
                }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="날짜·시간">
        <div className="grid grid-cols-2 gap-2">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </div>
      </Field>

      <div className="flex-1" />

      <div
        className="flex gap-2 px-4 pb-6 pt-2"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
      >
        <button
          type="button"
          onClick={() => router.back()}
          className="tap h-14 w-20 rounded-2xl text-base font-bold"
          style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
        >
          취소
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={submit}
          className="tap h-14 flex-1 rounded-2xl text-base font-bold"
          style={{
            background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
            color: valid ? '#fff' : 'var(--color-text-4)',
          }}
        >
          저장하기
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pb-3">
      <label className="mb-2 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
        {label}
      </label>
      {children}
    </section>
  );
}
