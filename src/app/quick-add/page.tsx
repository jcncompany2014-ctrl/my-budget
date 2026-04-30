'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useAccounts } from '@/lib/accounts';
import {
  CATEGORIES,
  expenseCategoriesByScope,
  incomeCategoriesByScope,
  suggestCategory,
} from '@/lib/categories';
import { useFavorites } from '@/lib/favorites';
import { fmt } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

/**
 * Parse strings like:
 *  - "어제 스타벅스 5천원"
 *  - "오늘 점심 12,000"
 *  - "스타벅스 4500"
 */
function parseQuick(
  raw: string,
  mode: 'personal' | 'business',
): null | { amount: number; merchant: string; date: Date; cat: string; type: 'expense' | 'income' } {
  if (!raw.trim()) return null;

  let str = raw.trim();
  let date = new Date();
  let type: 'expense' | 'income' = 'expense';

  // Date hints
  if (/어제|yesterday/i.test(str)) {
    date = new Date();
    date.setDate(date.getDate() - 1);
    str = str.replace(/어제|yesterday/i, '').trim();
  } else if (/그저께|그제/i.test(str)) {
    date = new Date();
    date.setDate(date.getDate() - 2);
    str = str.replace(/그저께|그제/i, '').trim();
  } else if (/오늘|today/i.test(str)) {
    str = str.replace(/오늘|today/i, '').trim();
  }

  if (/수입|받|급여|월급|입금/.test(str)) {
    type = 'income';
  }

  // Amount: support 천/만/억, comma-separated, plain numbers
  const cleanedAmount = str.replace(/,/g, '');
  let amount = 0;
  // 십만, 만원, 천원 etc
  const eokMatch = cleanedAmount.match(/(\d+(?:\.\d+)?)\s*억/);
  const manMatch = cleanedAmount.match(/(\d+(?:\.\d+)?)\s*만/);
  const cheonMatch = cleanedAmount.match(/(\d+(?:\.\d+)?)\s*천/);
  if (eokMatch) amount += Math.round(parseFloat(eokMatch[1]) * 100_000_000);
  if (manMatch) amount += Math.round(parseFloat(manMatch[1]) * 10_000);
  if (cheonMatch) amount += Math.round(parseFloat(cheonMatch[1]) * 1_000);

  if (amount === 0) {
    // Plain number — find a sequence of digits, prefer the largest
    const numbers = cleanedAmount.match(/\d{2,}/g);
    if (numbers) {
      amount = Math.max(...numbers.map(Number));
    }
  }

  if (amount <= 0) return null;

  // Strip amount portions
  let merchant = str
    .replace(/\d+(?:\.\d+)?\s*억/g, '')
    .replace(/\d+(?:\.\d+)?\s*만/g, '')
    .replace(/\d+(?:\.\d+)?\s*천/g, '')
    .replace(/\d{2,}/g, '')
    .replace(/원/g, '')
    .replace(/지출|수입|받|급여|월급|입금/g, '')
    .trim();

  if (!merchant) merchant = type === 'income' ? '수입' : '지출';

  let cat = suggestCategory(merchant, mode);
  if (!cat) {
    cat = type === 'expense'
      ? mode === 'business' ? 'biz_etc' : 'living'
      : mode === 'business' ? 'biz_other' : 'income';
  }

  return { amount, merchant, date, cat, type };
}

export default function QuickAddPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { accounts } = useAccounts();
  const { add } = useAllTransactions();
  const { items: favorites } = useFavorites();
  const [text, setText] = useState('');

  const expenseCats = useMemo(() => expenseCategoriesByScope(mode), [mode]);
  const incomeCats = useMemo(() => incomeCategoriesByScope(mode), [mode]);
  const parsed = parseQuick(text, mode);

  const myFavorites = favorites.filter((f) => f.scope === mode);

  const submitParsed = () => {
    if (!parsed) return;
    if (accounts.length === 0) {
      toast.show('먼저 계좌를 추가해 주세요', 'error');
      return;
    }
    const tx: Transaction = {
      id: 'tn-' + Date.now().toString(36),
      date: parsed.date.toISOString(),
      amount: parsed.type === 'expense' ? -parsed.amount : parsed.amount,
      cat: parsed.cat,
      merchant: parsed.merchant,
      memo: '',
      acc: accounts[0]?.id ?? 'a-default',
      scope: mode,
    };
    add(tx);
    toast.show('빠르게 저장 완료', 'success');
    router.replace('/');
  };

  const applyFavorite = (favId: string) => {
    const f = myFavorites.find((x) => x.id === favId);
    if (!f) return;
    const tx: Transaction = {
      id: 'tn-' + Date.now().toString(36),
      date: new Date().toISOString(),
      amount: f.type === 'expense' ? -f.amount : f.amount,
      cat: f.cat,
      merchant: f.name,
      memo: '',
      acc: f.acc || accounts[0]?.id || '',
      scope: f.scope,
    };
    add(tx);
    toast.show(`${f.name} 추가 완료`, 'success');
    router.replace('/');
  };

  return (
    <>
      <TopBar
        title="빠른 입력"
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

      <section className="px-5 pt-2">
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
          한 줄로 거래 추가 — 예: <br />
          <span style={{ color: 'var(--color-text-2)' }}>“어제 스타벅스 5천원”</span>,
          <span style={{ color: 'var(--color-text-2)' }}> “오늘 점심 12000”</span>,
          <span style={{ color: 'var(--color-text-2)' }}> “급여 3500000 수입”</span>
        </p>
        <input
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="입력하기"
          className="mt-3 h-14 w-full rounded-2xl px-5 outline-none"
          style={{
            background: 'var(--color-card)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-lg)',
            fontWeight: 600,
          }}
        />

        {parsed && (
          <div
            className="mt-3 rounded-2xl p-4"
            style={{ background: 'var(--color-primary-soft)' }}
          >
            <p
              style={{
                color: 'var(--color-primary)',
                fontSize: 'var(--text-xxs)',
                fontWeight: 700,
              }}
            >
              해석 미리보기
            </p>
            <div className="mt-1 flex items-center gap-2">
              <CategoryIcon catId={parsed.cat} size={28} />
              <p
                className="truncate"
                style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}
              >
                {parsed.merchant}
              </p>
            </div>
            <div className="mt-1 flex items-baseline justify-between">
              <span style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)' }}>
                {parsed.date.toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                  weekday: 'short',
                })}{' '}
                · {CATEGORIES[parsed.cat]?.name ?? '기타'}
              </span>
              <Money
                value={parsed.amount}
                sign={parsed.type === 'income' ? 'positive' : 'negative'}
                style={{
                  fontSize: 'var(--text-lg)',
                  fontWeight: 800,
                  color: parsed.type === 'income' ? 'var(--color-primary)' : 'var(--color-text-1)',
                }}
              />
            </div>
            <button
              type="button"
              onClick={submitParsed}
              className="tap mt-3 h-12 w-full rounded-xl"
              style={{
                background: 'var(--color-primary)',
                color: '#fff',
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
              }}
            >
              저장하기
            </button>
          </div>
        )}
      </section>

      {myFavorites.length > 0 && (
        <section className="px-5 pb-10 pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h2
              style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}
            >
              즐겨찾기 거래
            </h2>
            <span
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
            >
              한 번 누르면 즉시 등록
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {myFavorites.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyFavorite(f.id)}
                className="tap flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
                style={{ background: 'var(--color-card)' }}
              >
                <CategoryIcon catId={f.cat} size={32} />
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate"
                    style={{
                      color: 'var(--color-text-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 700,
                    }}
                  >
                    {f.name}
                  </p>
                  <p
                    className="tnum mt-0.5"
                    style={{
                      color: f.type === 'income' ? 'var(--color-primary)' : 'var(--color-text-3)',
                      fontSize: 'var(--text-xxs)',
                    }}
                  >
                    {f.type === 'income' ? '+' : '−'}
                    {fmt(f.amount)}원
                  </p>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 pt-2">
        <p
          style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}
        >
          힌트: <code>억/만/천</code> 단위, <code>오늘/어제/그제</code>, <code>수입</code>·<code>급여</code> 키워드 인식 ·
          소비처명으로 카테고리 자동 추정 (현재 모드: <span style={{ color: 'var(--color-primary)' }}>{mode === 'business' ? '사업' : '개인'}</span>)
          {incomeCats.length === 0 || expenseCats.length === 0 ? null : ''}
        </p>
      </section>
    </>
  );
}
