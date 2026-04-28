'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Keypad from '@/components/Keypad';
import { useMode } from '@/components/ModeProvider';
import { useToast } from '@/components/Toast';
import { useAccounts } from '@/lib/accounts';
import {
  CATEGORIES,
  expenseCategoriesByScope,
  incomeCategoriesByScope,
  suggestCategory,
} from '@/lib/categories';
import { useFavorites } from '@/lib/favorites';
import { fmt, fmtShort } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

const QUICK_AMOUNTS = [1000, 5000, 10000, 50000];

type TxType = 'expense' | 'income';

export default function AddPageWrap() {
  return (
    <Suspense fallback={null}>
      <AddPage />
    </Suspense>
  );
}

function AddPage() {
  const router = useRouter();
  const search = useSearchParams();
  const initialType = (search.get('type') === 'income' ? 'income' : 'expense') as TxType;
  const { mode } = useMode();
  const { add } = useAllTransactions();
  const { accounts } = useAccounts();
  const { add: addFav } = useFavorites();
  const toast = useToast();

  const expenseList = useMemo(() => expenseCategoriesByScope(mode), [mode]);
  const incomeList = useMemo(() => incomeCategoriesByScope(mode), [mode]);

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState('0');
  const [cat, setCat] = useState<string>(expenseList[0]?.id ?? 'food');
  const [merchant, setMerchant] = useState('');
  const [memo, setMemo] = useState('');
  const [accId, setAccId] = useState<string>('');
  const [step, setStep] = useState<1 | 2>(1);
  const [catTouched, setCatTouched] = useState(false);

  // Smart category suggestion based on merchant input (only when user hasn't manually picked)
  useEffect(() => {
    if (catTouched || type !== 'expense') return;
    const suggestion = suggestCategory(merchant, mode);
    if (suggestion && CATEGORIES[suggestion] && CATEGORIES[suggestion].scope === mode) {
      setCat(suggestion);
    }
  }, [merchant, type, mode, catTouched]);

  useEffect(() => {
    if (!accId && accounts[0]) setAccId(accounts[0].id);
  }, [accounts, accId]);

  // Reset selected category when mode/type changes
  useEffect(() => {
    const list = type === 'expense' ? expenseList : incomeList;
    if (!list.find((c) => c.id === cat)) {
      setCat(list[0]?.id ?? '');
    }
  }, [mode, type, expenseList, incomeList, cat]);

  const valid = useMemo(() => Number(amount) > 0, [amount]);
  const cats = type === 'expense' ? expenseList : incomeList;

  const submit = (saveAsFavorite = false) => {
    if (!valid) return;
    const numericAmount = Number(amount);
    const tx: Transaction = {
      id: 'tn' + Date.now().toString(36),
      date: new Date().toISOString(),
      amount: type === 'expense' ? -numericAmount : numericAmount,
      cat,
      merchant: merchant.trim() || CATEGORIES[cat]?.name || '거래',
      memo: memo.trim(),
      acc: accId,
      scope: mode,
    };
    add(tx);
    if (saveAsFavorite && CATEGORIES[cat]) {
      addFav({
        id: 'fav-' + Date.now().toString(36),
        name: tx.merchant,
        emoji: CATEGORIES[cat].emoji,
        amount: numericAmount,
        cat,
        acc: accId,
        scope: mode,
        type,
      });
    }
    toast.show(saveAsFavorite ? '저장 + 즐겨찾기 등록' : '저장 완료', 'success');
    router.replace('/');
  };

  const addQuick = (n: number) => {
    setAmount(String((amount === '0' ? 0 : Number(amount)) + n));
  };

  const promptCopy = useMemo(() => {
    if (mode === 'business') {
      return type === 'expense' ? '얼마를 지출했나요?' : '얼마가 들어왔나요?';
    }
    return type === 'expense' ? '얼마를 썼나요?' : '얼마를 받았나요?';
  }, [mode, type]);

  const merchantLabel = useMemo(() => {
    if (mode === 'business') {
      return type === 'expense' ? '거래처' : '매출처·플랫폼';
    }
    return type === 'expense' ? '어디서 썼나요?' : '어디서 받았나요?';
  }, [mode, type]);

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
        <div
          className="flex flex-col items-center gap-1"
        >
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{
              background: mode === 'business' ? 'var(--color-text-1)' : 'var(--color-primary-soft)',
              color: mode === 'business' ? 'var(--color-card)' : 'var(--color-primary)',
            }}
          >
            {mode === 'business' ? '사업' : '개인'}
          </span>
          <div
            className="flex rounded-full p-[3px]"
            style={{ background: 'var(--color-gray-100)' }}
          >
            {(['expense', 'income'] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setType(k)}
                className="tap rounded-full px-4 py-1.5 text-[13px] font-semibold transition-colors"
                style={{
                  background: type === k ? 'var(--color-card)' : 'transparent',
                  color: type === k ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  boxShadow: type === k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {mode === 'business'
                  ? k === 'expense'
                    ? '비용'
                    : '매출'
                  : k === 'expense'
                    ? '지출'
                    : '수입'}
              </button>
            ))}
          </div>
        </div>
        <div className="w-12" />
      </header>

      {step === 1 && (
        <div className="flex flex-1 flex-col">
          <section className="px-6 pb-3 pt-8 text-center">
            <p className="text-[13px] font-medium" style={{ color: 'var(--color-text-3)' }}>
              {promptCopy}
            </p>
            <p
              className="tnum mt-2 text-[44px] font-extrabold tracking-tight"
              style={{ color: amount === '0' ? 'var(--color-text-4)' : 'var(--color-text-1)' }}
            >
              {fmt(Number(amount))}
              <span className="ml-1 text-[28px]" style={{ color: 'var(--color-text-3)' }}>
                원
              </span>
            </p>
          </section>

          <div className="flex flex-wrap justify-center gap-2 px-4 pb-3">
            {QUICK_AMOUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => addQuick(n)}
                className="tap rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  border: '1px solid var(--color-gray-200)',
                  background: 'var(--color-card)',
                  color: 'var(--color-text-2)',
                }}
              >
                +{fmtShort(n)}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <Keypad value={amount} onChange={setAmount} />

          <div
            className="px-4 pb-6 pt-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            <button
              type="button"
              disabled={!valid}
              onClick={() => setStep(2)}
              className="tap h-14 w-full rounded-2xl text-base font-bold tracking-tight transition-opacity"
              style={{
                background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
                color: valid ? '#fff' : 'var(--color-text-4)',
                cursor: valid ? 'pointer' : 'not-allowed',
              }}
            >
              다음
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-1 flex-col">
          <section className="px-6 pb-4 pt-3 text-center">
            <p
              className="tnum text-2xl font-extrabold tracking-tight"
              style={{ color: type === 'expense' ? 'var(--color-text-1)' : 'var(--color-primary)' }}
            >
              {type === 'expense' ? '−' : '+'}
              {fmt(Number(amount))}원
            </p>
          </section>

          <section className="px-4 pb-3">
            <label className="mb-2.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
              카테고리
            </label>
            <div className="grid grid-cols-4 gap-2">
              {cats.map((c) => {
                const sel = cat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setCat(c.id);
                      setCatTouched(true);
                    }}
                    className="tap flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5"
                    style={{
                      background: sel ? `${c.color}22` : 'var(--color-gray-100)',
                      outline: sel ? `2px solid ${c.color}` : 'none',
                    }}
                  >
                    <span className="text-xl">{c.emoji}</span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: 'var(--color-text-2)' }}
                    >
                      {c.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="px-4 pb-3">
            <label className="mb-2.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
              {merchantLabel}
            </label>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              placeholder={mode === 'business' ? '거래처 이름 (선택)' : '가게 이름 (선택)'}
              className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
            />
          </section>

          <section className="px-4 pb-3">
            <label className="mb-2.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
              메모
            </label>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="짧은 메모 (선택)"
              className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
            />
          </section>

          <section className="px-4 pb-4">
            <label className="mb-2.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
              계좌
            </label>
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
          </section>

          <div className="flex-1" />

          <div
            className="flex gap-2 px-4 pb-6 pt-2"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            <button
              type="button"
              onClick={() => setStep(1)}
              className="tap h-14 w-16 rounded-2xl"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
              }}
            >
              이전
            </button>
            <button
              type="button"
              onClick={() => submit(true)}
              className="tap h-14 w-16 rounded-2xl"
              style={{
                background: 'var(--color-primary-soft)',
                color: 'var(--color-primary)',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
              }}
              aria-label="즐겨찾기로 저장"
              title="즐겨찾기로 저장"
            >
              ⭐
            </button>
            <button
              type="button"
              onClick={() => submit(false)}
              className="tap h-14 flex-1 rounded-2xl"
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
              }}
            >
              저장하기
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
