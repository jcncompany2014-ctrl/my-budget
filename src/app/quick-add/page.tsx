'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useDeferredValue, useEffect, useMemo, useState } from 'react';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import { useMode } from '@/components/ModeProvider';
import Money from '@/components/Money';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import { useAccounts } from '@/lib/accounts';
import { CATEGORIES } from '@/lib/categories';
import { useCategoryRules } from '@/lib/category-rules';
import { defaultAccountId } from '@/lib/default-account';
import { useFavorites } from '@/lib/favorites';
import { fmt } from '@/lib/format';
import { previewNotification } from '@/lib/inbox';
import { parseQuickText, resolveQuick } from '@/lib/quick-parse';
import { useAllTransactions } from '@/lib/storage';
import type { Transaction } from '@/lib/types';

type Parsed = {
  amount: number;
  merchant: string;
  date: Date;
  cat: string;
  type: 'expense' | 'income';
  /** Set when a pasted card notification named the card. */
  acc?: string;
};

/** A pasted card/pay notification ("신한카드(1234)승인 … 12,500원 … GS25") read by the inbox parser. */
function parseNotificationText(raw: string): Parsed | null {
  if (!/승인|결제|취소|\[Web발신\]|카드/.test(raw)) return null;
  const { result, account, cat } = previewNotification(raw);
  if (!result.ok || result.notice.currency !== 'KRW') return null;
  const n = result.notice;
  return {
    amount: n.amount,
    merchant: n.merchant,
    date: n.date ?? new Date(),
    cat: cat ?? 'living',
    type: n.kind === 'cancel' ? 'income' : 'expense',
    acc: account?.id,
  };
}

export default function QuickAddPageWrap() {
  return (
    <Suspense fallback={null}>
      <QuickAddPage />
    </Suspense>
  );
}

function QuickAddPage() {
  const router = useRouter();
  const search = useSearchParams();
  const toast = useToast();
  const { mode } = useMode();
  const { accounts, allAccounts } = useAccounts();
  const { tx: history, add, remove } = useAllTransactions();
  const { items: favorites } = useFavorites();
  const { items: rules } = useCategoryRules();
  const [text, setText] = useState('');
  const deferredText = useDeferredValue(text);
  // ?text= arrives from the auto-record inbox ("못 읽은 알림 → 직접 입력"). Applied
  // after mount: parsing reads accounts from localStorage, which the server render lacks.
  const presetText = search.get('text');
  useEffect(() => {
    if (presetText) setText(presetText);
  }, [presetText]);

  const parsed = useMemo<Parsed | null>(() => {
    const notice = parseNotificationText(deferredText);
    if (notice) return notice;
    const q = parseQuickText(deferredText);
    if (!q) return null;
    return { amount: q.amount, date: q.date, ...resolveQuick(q, mode, history, rules) };
  }, [deferredText, mode, history, rules]);

  // The card a pasted notification named, else the one last used for this kind of row.
  const account = useMemo(() => {
    if (!parsed) return undefined;
    const named = allAccounts.find((a) => a.id === parsed.acc);
    if (named) return named;
    const id = defaultAccountId(history, accounts, mode, parsed.type === 'income');
    return accounts.find((a) => a.id === id);
  }, [parsed, allAccounts, accounts, history, mode]);

  const myFavorites = favorites.filter((f) => f.scope === mode);

  const save = (tx: Transaction, message: string) => {
    add(tx);
    toast.show(message, {
      variant: 'success',
      durationMs: 4500,
      action: {
        label: '되돌리기',
        onClick: () => {
          remove(tx.id);
          toast.show('취소됨', 'info');
        },
      },
    });
    // Back to wherever this was opened from, like the full entry screen.
    router.back();
  };

  const submitParsed = () => {
    if (!parsed) return;
    if (!account) {
      toast.show('계좌가 없어요', 'error');
      return;
    }
    save(
      {
        id: 'tn-' + Date.now().toString(36),
        date: parsed.date.toISOString(),
        amount: parsed.type === 'expense' ? -parsed.amount : parsed.amount,
        cat: parsed.cat,
        merchant: parsed.merchant,
        memo: '',
        acc: account.id,
        scope: account.scope,
      },
      '저장 완료',
    );
  };

  const applyFavorite = (favId: string) => {
    const f = myFavorites.find((x) => x.id === favId);
    if (!f) return;
    // A favourite can outlive the account it was saved with.
    const acc = allAccounts.some((a) => a.id === f.acc)
      ? f.acc
      : defaultAccountId(history, accounts, mode, f.type === 'income');
    if (!acc) {
      toast.show('계좌가 없어요', 'error');
      return;
    }
    save(
      {
        id: 'tn-' + Date.now().toString(36),
        date: new Date().toISOString(),
        amount: f.type === 'expense' ? -f.amount : f.amount,
        cat: f.cat,
        merchant: f.name,
        memo: '',
        acc,
        scope: f.scope,
      },
      `${f.name} 저장 완료`,
    );
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

      <section className="px-5 pt-1">
        {/* A card SMS spans several lines — an <input> would glue them together. */}
        {text.includes('\n') ? (
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            // biome-ignore lint/a11y/noAutofocus: swapped in mid-typing; keep the caret
            autoFocus
            className="w-full resize-none rounded-2xl px-5 py-4 outline-none"
            style={{
              background: 'var(--color-card)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          />
        ) : (
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (pasted.includes('\n')) {
                e.preventDefault();
                setText(pasted.trim());
              }
            }}
            onKeyDown={(e) => {
              // isComposing: Enter that only commits a Hangul IME composition must not save.
              if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submitParsed();
              }
            }}
            placeholder="스타벅스 5천"
            enterKeyHint="done"
            // biome-ignore lint/a11y/noAutofocus: this page exists only to type one line
            autoFocus
            className="h-14 w-full rounded-2xl px-5 outline-none"
            style={{
              background: 'var(--color-card)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-lg)',
              fontWeight: 600,
            }}
          />
        )}

        {parsed && (
          <div className="mt-3 rounded-2xl p-4" style={{ background: 'var(--color-primary-soft)' }}>
            <div className="flex items-center gap-3">
              <MerchantAvatar merchant={parsed.merchant} catId={parsed.cat} size={40} />
              <div className="min-w-0 flex-1">
                <p
                  className="truncate"
                  style={{
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 700,
                  }}
                >
                  {parsed.merchant}
                </p>
                <p
                  className="truncate"
                  style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)' }}
                >
                  {parsed.date.toLocaleDateString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    weekday: 'short',
                  })}{' '}
                  · {CATEGORIES[parsed.cat]?.name ?? '기타'}
                  {account ? ` · ${account.name}` : ''}
                </p>
              </div>
              <Money
                value={parsed.amount}
                sign={parsed.type === 'income' ? 'positive' : 'negative'}
                className="shrink-0"
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
              저장
            </button>
          </div>
        )}
      </section>

      {myFavorites.length > 0 && (
        <section className="px-5 pt-4">
          <h2
            className="mb-2.5"
            style={{
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
            }}
          >
            즐겨찾기 거래
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {myFavorites.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyFavorite(f.id)}
                className="tap flex items-center gap-3 rounded-2xl px-4 py-3 text-left"
                style={{ background: 'var(--color-card)' }}
              >
                <MerchantAvatar merchant={f.name} catId={f.cat} size={32} />
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

      {/* No bottom nav on this page, so it clears the home indicator itself. */}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 20px)' }} />
    </>
  );
}
