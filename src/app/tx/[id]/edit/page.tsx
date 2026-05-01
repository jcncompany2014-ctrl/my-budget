'use client';

import { useRouter } from 'next/navigation';
import { use, useEffect, useMemo, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { SkeletonHome } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import Sheet from '@/components/ui/Sheet';
import { useAccounts } from '@/lib/accounts';
import { CATEGORIES, expenseCategoriesByScope, incomeCategoriesByScope } from '@/lib/categories';
import { fmt } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';
import type { Scope, Transaction } from '@/lib/types';

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
  const [splits, setSplits] = useState<NonNullable<Transaction['splits']>>([]);
  const [splitOpen, setSplitOpen] = useState(false);

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
    setSplits(item.splits ?? []);
  }, [item]);

  const scope: Scope = item?.scope ?? 'personal';
  const expenseList = useMemo(() => expenseCategoriesByScope(scope), [scope]);
  const incomeList = useMemo(() => incomeCategoriesByScope(scope), [scope]);
  const cats = type === 'expense' ? expenseList : incomeList;

  if (!ready) {
    return <SkeletonHome />;
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
      splits: splits.length > 0 ? splits : undefined,
    });
    toast.show('수정 완료', 'success');
    router.replace(`/tx/${item.id}`);
  };

  const totalSplit = splits.reduce((s, x) => s + Math.abs(x.amount), 0);
  const numericAbs = Math.abs(Number(amount) || 0);
  const splitsRemainder = numericAbs - totalSplit;

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
        <div className="flex rounded-full p-[3px]" style={{ background: 'var(--color-gray-100)' }}>
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
                {scope === 'business'
                  ? k === 'expense'
                    ? '비용'
                    : '매출'
                  : k === 'expense'
                    ? '지출'
                    : '수입'}
              </button>
            );
          })}
        </div>
      </section>

      <Field label="금액">
        <div
          className="flex items-baseline gap-2 rounded-xl px-4 py-3"
          style={{ background: 'var(--color-gray-100)' }}
        >
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
                className="tap flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3"
                style={{
                  background: sel ? `${c.color}1f` : 'var(--color-gray-100)',
                  border: `2px solid ${sel ? c.color : 'transparent'}`,
                }}
              >
                <CategoryIcon catId={c.id} size={28} />
                <span
                  className="text-[11px] font-semibold"
                  style={{ color: sel ? c.color : 'var(--color-text-2)' }}
                >
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="소비처/거래처">
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
                  border: `1.5px solid ${sel ? a.color : 'transparent'}`,
                }}
              >
                {a.name}
              </button>
            );
          })}
        </div>
      </Field>

      <Field label="카테고리 분할">
        <button
          type="button"
          onClick={() => setSplitOpen(true)}
          className="tap flex w-full items-center justify-between rounded-xl px-4 py-3"
          style={{ background: 'var(--color-gray-100)' }}
        >
          <span
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
          >
            {splits.length === 0 ? '단일 카테고리' : `${splits.length}개로 분할`}
          </span>
          {splits.length > 0 && (
            <span
              className="tnum"
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
            >
              합계 {fmt(totalSplit)}원
            </span>
          )}
        </button>
        <p className="mt-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
          마트 영수증을 식비/생활용품으로 나눌 때 같은 거래에 두 카테고리를 적용
        </p>
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

      <Sheet open={splitOpen} onClose={() => setSplitOpen(false)} title="카테고리 분할">
        <SplitsEditor
          totalAmount={numericAbs}
          splits={splits}
          onChange={setSplits}
          remainder={splitsRemainder}
          scope={scope}
        />
        <button
          type="button"
          onClick={() => setSplitOpen(false)}
          className="tap mt-4 h-12 w-full rounded-xl"
          style={{
            background: 'var(--color-primary)',
            color: '#fff',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          완료
        </button>
      </Sheet>
    </div>
  );
}

function SplitsEditor({
  totalAmount,
  splits,
  onChange,
  remainder,
  scope,
}: {
  totalAmount: number;
  splits: NonNullable<Transaction['splits']>;
  onChange: (next: NonNullable<Transaction['splits']>) => void;
  remainder: number;
  scope: Scope;
}) {
  const cats = expenseCategoriesByScope(scope);
  const valid = splits.length > 0 && remainder === 0;

  const update = (i: number, patch: Partial<NonNullable<Transaction['splits']>[number]>) => {
    onChange(splits.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));
  };
  const remove = (i: number) => onChange(splits.filter((_, idx) => idx !== i));
  const add = () => {
    const used = splits.reduce((s, x) => s + Math.abs(x.amount), 0);
    onChange([
      ...splits,
      { cat: cats[0]?.id ?? 'food', amount: Math.max(0, totalAmount - used), memo: '' },
    ]);
  };

  return (
    <>
      <div className="mb-3 rounded-xl p-3" style={{ background: 'var(--color-gray-50)' }}>
        <div className="flex items-baseline justify-between">
          <span
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}
          >
            거래 총액
          </span>
          <span
            className="tnum"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}
          >
            {fmt(totalAmount)}원
          </span>
        </div>
        <div className="mt-1 flex items-baseline justify-between">
          <span
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}
          >
            잔여
          </span>
          <span
            className="tnum"
            style={{
              color:
                remainder === 0
                  ? 'var(--color-primary)'
                  : remainder < 0
                    ? 'var(--color-danger)'
                    : 'var(--color-text-2)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
            }}
          >
            {remainder >= 0 ? '' : '−'}
            {fmt(remainder)}원
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {splits.map((s, i) => {
          const _c = CATEGORIES[s.cat];
          return (
            <div key={i} className="rounded-xl p-3" style={{ background: 'var(--color-gray-100)' }}>
              <div className="flex items-center gap-2">
                <select
                  value={s.cat}
                  onChange={(e) => update(i, { cat: e.target.value })}
                  className="flex-1 rounded-lg px-2 py-2 outline-none"
                  style={{
                    background: 'var(--color-card)',
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                  }}
                >
                  {cats.map((cc) => (
                    <option key={cc.id} value={cc.id}>
                      {cc.emoji} {cc.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  inputMode="numeric"
                  value={s.amount || ''}
                  onChange={(e) => update(i, { amount: Number(e.target.value) || 0 })}
                  placeholder="0"
                  className="tnum w-24 rounded-lg px-2 py-2 text-right outline-none"
                  style={{
                    background: 'var(--color-card)',
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                  }}
                />
                <button
                  type="button"
                  onClick={() => remove(i)}
                  className="tap flex h-8 w-8 items-center justify-center rounded-full"
                  style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
                  aria-label="삭제"
                >
                  ×
                </button>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <CategoryIcon catId={s.cat} size={28} />
                <input
                  value={s.memo ?? ''}
                  onChange={(e) => update(i, { memo: e.target.value })}
                  placeholder="메모 (선택)"
                  className="flex-1 rounded-lg px-2 py-1.5 outline-none"
                  style={{
                    background: 'var(--color-card)',
                    color: 'var(--color-text-2)',
                    fontSize: 'var(--text-xs)',
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={add}
        className="tap mt-2 w-full rounded-xl border-2 border-dashed py-3"
        style={{
          borderColor: 'var(--color-gray-300)',
          color: 'var(--color-text-2)',
          fontSize: 'var(--text-xs)',
          fontWeight: 700,
        }}
      >
        + 분할 항목 추가
      </button>

      {splits.length > 0 && !valid && (
        <p
          className="mt-2"
          style={{ color: 'var(--color-danger)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}
        >
          분할 합계가 거래 총액과 정확히 일치해야 저장돼요
        </p>
      )}
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="px-4 pb-3">
      <label
        className="mb-2 block text-[13px] font-semibold"
        style={{ color: 'var(--color-text-2)' }}
      >
        {label}
      </label>
      {children}
    </section>
  );
}
