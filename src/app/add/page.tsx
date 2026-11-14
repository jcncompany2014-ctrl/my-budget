'use client';

import { ArrowLeftRight, Check, Globe, Lightbulb, Star, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import DatePickerSection from '@/components/DatePickerSection';
import CategoryIcon from '@/components/icons/CategoryIcon';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import Keypad from '@/components/Keypad';
import { useMode } from '@/components/ModeProvider';
import { useToast } from '@/components/Toast';
import { IconDisplay } from '@/components/ui/IconPicker';
import { useAccounts } from '@/lib/accounts';
import { autoCategorize, detectDuplicate, suggestAmount } from '@/lib/auto-categorize';
import { useBusinessProfile } from '@/lib/business-profile';
import { CATEGORIES, expenseCategoriesByScope, incomeCategoriesByScope } from '@/lib/categories';
import { applyRules, useCategoryRules } from '@/lib/category-rules';
import { defaultAccountId } from '@/lib/default-account';
import { useFavorites } from '@/lib/favorites';
import { fmt, fmtShort } from '@/lib/format';
import { haptics } from '@/lib/haptics';
import { useLocations } from '@/lib/locations';
import { useAllTransactions } from '@/lib/storage';
import { deriveTemplates, type TxTemplate } from '@/lib/templates';
import { buildTransferLegs } from '@/lib/transfers';
import type { Transaction } from '@/lib/types';
import { useVendors } from '@/lib/vendors';

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
  const { add, remove, tx: history } = useAllTransactions();
  const { accounts } = useAccounts();
  const { add: addFav } = useFavorites();
  const { items: rules } = useCategoryRules();
  const { items: vendors } = useVendors();
  const { items: locations } = useLocations();
  const { value: bizProfile } = useBusinessProfile();
  const toast = useToast();

  const expenseList = useMemo(() => expenseCategoriesByScope(mode), [mode]);
  const incomeList = useMemo(() => incomeCategoriesByScope(mode), [mode]);

  const [type, setType] = useState<TxType>(initialType);
  const [amount, setAmount] = useState('');
  const [cat, setCat] = useState<string>(expenseList[0]?.id ?? 'food');
  const [merchant, setMerchant] = useState('');
  const [memo, setMemo] = useState('');
  const [accId, setAccId] = useState<string>('');
  const [accTouched, setAccTouched] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [catTouched, setCatTouched] = useState(false);
  const [vendorId, setVendorId] = useState<string>('');
  const [locationId, setLocationId] = useState<string>('');
  const [outstanding, setOutstanding] = useState<boolean>(false);
  const [hasReceipt, setHasReceipt] = useState<boolean>(false);
  const [continueAfterSave, setContinueAfterSave] = useState(false);
  // Pickable date — defaults to today, can be any past/future date.
  const [txDate, setTxDate] = useState<Date>(() => new Date());

  // Recent merchant suggestions for autocomplete
  const recentMerchants = useMemo(() => {
    const seen = new Map<string, number>();
    history
      .filter((t) => (t.scope ?? 'personal') === mode)
      .forEach((t) => {
        if (t.merchant) seen.set(t.merchant, (seen.get(t.merchant) ?? 0) + 1);
      });
    return Array.from(seen.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 30)
      .map(([m]) => m);
  }, [history, mode]);

  // Smart category suggestion: user rules → history → heuristic
  useEffect(() => {
    if (catTouched || type !== 'expense') return;
    // 1. User-defined rules win
    const ruleMatch = applyRules(merchant, rules);
    if (ruleMatch && CATEGORIES[ruleMatch] && CATEGORIES[ruleMatch].scope === mode) {
      setCat(ruleMatch);
      return;
    }
    // 2. History-based learning
    const suggestion = autoCategorize(merchant, mode, history);
    if (suggestion && CATEGORIES[suggestion] && CATEGORIES[suggestion].scope === mode) {
      setCat(suggestion);
    }
  }, [merchant, type, mode, catTouched, history, rules]);

  // Suggested amount from history (display hint, doesn't auto-fill)
  const amountHint = useMemo(
    () => (merchant.trim().length >= 2 ? suggestAmount(merchant, mode, history) : null),
    [merchant, mode, history],
  );

  // Habitual entries mined from history — chip → step 2 → 저장
  const templates = useMemo(
    () => deriveTemplates(history, { scope: mode, kind: type }),
    [history, mode, type],
  );

  // Start on the account the last hand-entered row of this kind used (then the
  // main account) — not simply the oldest account in the list.
  const defaultAccId = useMemo(
    () => defaultAccountId(history, accounts, mode, type === 'income'),
    [history, accounts, mode, type],
  );
  useEffect(() => {
    if (!accTouched && defaultAccId) setAccId(defaultAccId);
  }, [defaultAccId, accTouched]);

  // Reset selected category when mode/type changes
  useEffect(() => {
    const list = type === 'expense' ? expenseList : incomeList;
    if (!list.find((c) => c.id === cat)) {
      setCat(list[0]?.id ?? '');
    }
  }, [mode, type, expenseList, incomeList, cat]);

  const valid = useMemo(() => Number(amount) > 0, [amount]);

  // Frequency-sort categories: most-used in current scope+type appear first.
  // Subtle UX win — daily-driver categories surface in the top row.
  const cats = useMemo(() => {
    const list = type === 'expense' ? expenseList : incomeList;
    const usage = new Map<string, number>();
    for (const t of history) {
      if ((t.scope ?? 'personal') !== mode) continue;
      const wantsIncome = type === 'income';
      const isIncomeTx = t.amount > 0;
      if (wantsIncome !== isIncomeTx) continue;
      usage.set(t.cat, (usage.get(t.cat) ?? 0) + 1);
    }
    return [...list].sort((a, b) => (usage.get(b.id) ?? 0) - (usage.get(a.id) ?? 0));
  }, [type, expenseList, incomeList, history, mode]);

  const submit = (saveAsFavorite = false, force = false) => {
    if (!valid) return;
    const numericAmount = Number(amount);
    // txDate already a state — use as-is (may be today / yesterday / custom)
    const tx: Transaction = {
      id: 'tn' + Date.now().toString(36),
      date: txDate.toISOString(),
      amount: type === 'expense' ? -numericAmount : numericAmount,
      cat,
      merchant: merchant.trim() || CATEGORIES[cat]?.name || '거래',
      memo: memo.trim(),
      acc: accId,
      scope: mode,
    };

    // Duplicate detection
    if (!force) {
      const dup = detectDuplicate(tx, history);
      if (dup) {
        haptics.warn();
        toast.show(
          `방금 같은 거래가 있어요 (${fmt(Math.abs(dup.amount))}원). 한 번 더 누르면 추가`,
          {
            variant: 'info',
            durationMs: 4000,
            haptic: false, // explicit warn() above
            action: { label: '추가', onClick: () => submit(saveAsFavorite, true) },
          },
        );
        return;
      }
    }

    // ─── Auto savings transfer ─────────────────────────────────────────
    // When user logs an outflow under '저축' category in personal mode AND
    // a savings-target account exists, pair the deduction with an auto
    // deposit into the savings account. Both legs share a transferPairId
    // so the savings account balance moves up automatically.
    if (mode === 'personal' && type === 'expense' && cat === 'saving') {
      const fromAcc = accounts.find((a) => a.id === accId);
      const savingsAcc = accounts.find(
        (a) => a.scope === 'personal' && a.savingsTarget && a.id !== accId,
      );
      if (fromAcc && savingsAcc) {
        const legs = buildTransferLegs({
          fromAcc,
          toAcc: savingsAcc,
          amount: numericAmount,
          date: txDate.toISOString(),
          memo: memo.trim() || `저축 자동 이체 → ${savingsAcc.name}`,
        });
        // Override category to keep this in the saving bucket for analytics,
        // but keep transfer linkage so balances move correctly.
        legs[0].cat = 'saving';
        legs[0].merchant = merchant.trim() || `저축 → ${savingsAcc.name}`;
        // The deposit leg stays a plain transfer — two 'saving' legs counted the amount twice.
        legs[1].merchant = merchant.trim() || `← ${fromAcc.name}`;
        legs.forEach((l) => add(l));
        toast.show(`${savingsAcc.name}로 자동 이체 완료`, {
          variant: 'success',
          durationMs: 4500,
          action: {
            label: '되돌리기',
            onClick: () => {
              legs.forEach((l) => remove(l.id));
              toast.show('취소됨', 'info');
            },
          },
        });
        if (continueAfterSave) {
          setAmount('');
          setMerchant('');
          setMemo('');
          setCatTouched(false);
          setStep(1);
        } else {
          router.back();
        }
        return;
      }
    }

    if (mode === 'business') {
      tx.vendor = vendorId || undefined;
      tx.location = locationId || undefined;
      tx.outstanding = outstanding || undefined;
      tx.hasReceipt = hasReceipt || undefined;

      // Card / delivery fee auto-suggestion: when category is biz_sales_card or biz_sales_app and user enters gross amount, hint expected net after fees
      if (cat === 'biz_sales_card' && bizProfile.cardFeeRate > 0) {
        const fee = Math.round((numericAmount * bizProfile.cardFeeRate) / 100);
        tx.memo = (tx.memo ?? '') + (tx.memo ? ' · ' : '') + `카드 수수료 약 ${fmt(fee)}원`;
      } else if (cat === 'biz_sales_app' && bizProfile.deliveryFeeRate > 0) {
        const fee = Math.round((numericAmount * bizProfile.deliveryFeeRate) / 100);
        tx.memo = (tx.memo ?? '') + (tx.memo ? ' · ' : '') + `배달앱 수수료 약 ${fmt(fee)}원`;
      }
    }

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
    toast.show(saveAsFavorite ? '저장 + 즐겨찾기 등록' : '저장 완료', {
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
    if (continueAfterSave) {
      setAmount('');
      setMerchant('');
      setMemo('');
      // Let the next merchant suggest its own category again.
      setCatTouched(false);
      setOutstanding(false);
      setHasReceipt(false);
      setStep(1);
    } else {
      // Back to wherever + was pressed (home, list, calendar…), not always home.
      router.back();
    }
  };
  const submitOnEnter = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) submit(false);
  };

  const addQuick = (n: number) => {
    setAmount(String((Number(amount) || 0) + n));
  };

  const applyTemplate = (t: TxTemplate) => {
    haptics.light();
    setAmount(String(t.amount));
    setMerchant(t.merchant);
    setCat(t.cat);
    setCatTouched(true);
    if (t.acc && accounts.some((a) => a.id === t.acc)) {
      setAccId(t.acc);
      setAccTouched(true);
    }
    setStep(2);
  };

  const merchantLabel = useMemo(() => {
    if (mode === 'business') {
      return type === 'expense' ? '거래처' : '매출처·플랫폼';
    }
    return type === 'expense' ? '소비처' : '받은 곳';
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
        <div className="flex flex-col items-center gap-1">
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
        <div className="flex items-center">
          <Link
            href="/transfer"
            replace
            className="tap flex h-10 w-9 items-center justify-center rounded-full"
            aria-label="이체"
          >
            <ArrowLeftRight size={19} strokeWidth={2.2} color="var(--color-text-2)" />
          </Link>
          <Link
            href="/quick-add"
            replace
            className="tap flex h-10 w-9 items-center justify-center rounded-full"
            aria-label="빠른 입력"
          >
            <Zap size={19} strokeWidth={2.2} color="var(--color-text-2)" />
          </Link>
        </div>
      </header>

      {step === 1 && (
        <div className="flex flex-1 flex-col">
          <section className="px-6 pb-3 pt-8 text-center">
            <p className="tnum mt-2 text-[44px] font-extrabold tracking-tight">
              {Number(amount) > 0 ? (
                <>
                  <span style={{ color: 'var(--color-text-1)' }}>{fmt(Number(amount))}</span>
                  <span className="ml-1 text-[28px]" style={{ color: 'var(--color-text-3)' }}>
                    원
                  </span>
                </>
              ) : (
                <span style={{ color: 'var(--color-text-4)' }}>0원</span>
              )}
            </p>
          </section>

          {amountHint !== null && !amount && (
            <div className="px-4 pb-2 text-center">
              <button
                type="button"
                onClick={() => setAmount(String(amountHint))}
                className="tap inline-flex items-center gap-1 rounded-full px-3 py-1.5"
                style={{
                  background: 'var(--color-primary-soft)',
                  color: 'var(--color-primary)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                }}
              >
                <Lightbulb size={12} strokeWidth={2.4} />
                <span>평소 {fmt(amountHint)}원</span>
              </button>
            </div>
          )}

          {!amount && templates.length > 0 && (
            <div className="pb-3">
              <p
                className="mb-2 px-5"
                style={{
                  color: 'var(--color-text-3)',
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.02em',
                }}
              >
                자주 쓰는 거래
              </p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-1">
                {templates.map((t) => (
                  <button
                    key={`${t.merchant}-${t.cat}`}
                    type="button"
                    onClick={() => applyTemplate(t)}
                    className="tap flex shrink-0 items-center gap-2 rounded-2xl py-2 pl-2 pr-3.5"
                    style={{
                      background: 'var(--color-card)',
                      border: '1px solid var(--color-gray-150)',
                      boxShadow: '0 1px 2px rgba(20, 28, 40, 0.04)',
                    }}
                  >
                    <MerchantAvatar merchant={t.merchant} catId={t.cat} size={28} />
                    <span className="text-left">
                      <span
                        className="block max-w-[96px] truncate"
                        style={{ color: 'var(--color-text-1)', fontSize: 12, fontWeight: 700 }}
                      >
                        {t.merchant}
                      </span>
                      <span
                        className="tnum block"
                        style={{ color: 'var(--color-text-3)', fontSize: 11, fontWeight: 600 }}
                      >
                        {fmt(t.amount)}원
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2 px-4 pb-3">
            {QUICK_AMOUNTS.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => addQuick(n)}
                className="tap rounded-full px-3 py-1.5"
                style={{
                  border: '1px solid var(--color-gray-200)',
                  background: 'var(--color-card)',
                  color: 'var(--color-text-2)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
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
              {fmt(Number(amount) || 0)}원
            </p>
          </section>

          <section className="px-4 pb-3">
            <label
              className="mb-2.5 block text-[13px] font-semibold"
              style={{ color: 'var(--color-text-2)' }}
            >
              계좌
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {accounts.map((a) => {
                const sel = accId === a.id;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => {
                      setAccId(a.id);
                      setAccTouched(true);
                    }}
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
          </section>

          <section className="px-4 pb-3">
            <label
              className="mb-2.5 block text-[13px] font-semibold"
              style={{ color: 'var(--color-text-2)' }}
            >
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
                    className="tap flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3"
                    style={{
                      background: sel ? `${c.color}1f` : 'var(--color-gray-100)',
                      border: `2px solid ${sel ? c.color : 'transparent'}`,
                    }}
                  >
                    <CategoryIcon catId={c.id} size={32} />
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
          </section>

          <section className="px-4 pb-3">
            <label
              className="mb-2.5 block text-[13px] font-semibold"
              style={{ color: 'var(--color-text-2)' }}
            >
              {merchantLabel}
            </label>
            <input
              value={merchant}
              onChange={(e) => setMerchant(e.target.value)}
              onKeyDown={submitOnEnter}
              enterKeyHint="done"
              placeholder="이름"
              list="recent-merchants-add"
              autoComplete="off"
              className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
            />
            <datalist id="recent-merchants-add">
              {recentMerchants.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
            {!merchant && recentMerchants.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {recentMerchants.slice(0, 6).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMerchant(m)}
                    className="tap rounded-full px-3 py-1"
                    style={{
                      background: 'var(--color-gray-100)',
                      color: 'var(--color-text-2)',
                      fontSize: 'var(--text-xxs)',
                      fontWeight: 600,
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="px-4 pb-3">
            <div className="mb-2.5 flex items-baseline justify-between">
              <label
                style={{
                  color: 'var(--color-text-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 600,
                }}
              >
                메모
              </label>
              <span
                className="tnum"
                style={{
                  color: memo.length > 80 ? 'var(--color-danger)' : 'var(--color-text-3)',
                  fontSize: 'var(--text-xxs)',
                  fontWeight: 600,
                }}
              >
                {memo.length}/100
              </span>
            </div>
            <input
              value={memo}
              onChange={(e) => setMemo(e.target.value.slice(0, 100))}
              onKeyDown={submitOnEnter}
              enterKeyHint="done"
              placeholder="메모"
              maxLength={100}
              className="h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
          </section>

          <DatePickerSection date={txDate} onChange={setTxDate} />

          <section className="px-4 pb-3">
            <button
              type="button"
              onClick={() => setContinueAfterSave(!continueAfterSave)}
              className="tap flex w-full items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'var(--color-gray-100)' }}
            >
              <div>
                <p
                  style={{
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                  }}
                >
                  저장하고 계속 입력
                </p>
              </div>
              <span
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{
                  background: continueAfterSave ? 'var(--color-primary)' : 'var(--color-gray-300)',
                }}
              >
                <span
                  className="absolute h-5 w-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: continueAfterSave ? 'translateX(22px)' : 'translateX(2px)' }}
                />
              </span>
            </button>
          </section>

          {mode === 'business' && (
            <>
              {vendors.filter((v) => v.scope === 'business').length > 0 && (
                <section className="px-4 pb-3">
                  <label
                    className="mb-2.5 block"
                    style={{
                      color: 'var(--color-text-2)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                    }}
                  >
                    거래처
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setVendorId('')}
                      className="tap shrink-0 rounded-2xl px-4 py-2"
                      style={{
                        background: !vendorId ? 'var(--color-primary)' : 'var(--color-gray-100)',
                        color: !vendorId ? '#fff' : 'var(--color-text-2)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                      }}
                    >
                      없음
                    </button>
                    {vendors
                      .filter((v) => v.scope === 'business')
                      .map((v) => {
                        const sel = vendorId === v.id;
                        return (
                          <button
                            key={v.id}
                            type="button"
                            onClick={() => setVendorId(v.id)}
                            className="tap shrink-0 rounded-2xl px-4 py-2"
                            style={{
                              background: sel ? `${v.color}22` : 'var(--color-gray-100)',
                              color: sel ? v.color : 'var(--color-text-2)',
                              border: `1.5px solid ${sel ? v.color : 'transparent'}`,
                              fontSize: 'var(--text-xs)',
                              fontWeight: 700,
                            }}
                          >
                            {v.name}
                          </button>
                        );
                      })}
                  </div>
                </section>
              )}

              {locations.length > 0 && (
                <section className="px-4 pb-3">
                  <label
                    className="mb-2.5 block"
                    style={{
                      color: 'var(--color-text-2)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                    }}
                  >
                    사업장
                  </label>
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setLocationId('')}
                      className="tap inline-flex shrink-0 items-center gap-1 rounded-2xl px-4 py-2"
                      style={{
                        background: !locationId ? 'var(--color-primary)' : 'var(--color-gray-100)',
                        color: !locationId ? '#fff' : 'var(--color-text-2)',
                        fontSize: 'var(--text-xs)',
                        fontWeight: 700,
                      }}
                    >
                      <Globe size={13} strokeWidth={2.4} aria-hidden />
                      <span>전체</span>
                    </button>
                    {locations.map((l) => {
                      const sel = locationId === l.id;
                      return (
                        <button
                          key={l.id}
                          type="button"
                          onClick={() => setLocationId(l.id)}
                          className="tap inline-flex shrink-0 items-center gap-1 rounded-2xl px-4 py-2"
                          style={{
                            background: sel ? `${l.color}22` : 'var(--color-gray-100)',
                            color: sel ? l.color : 'var(--color-text-2)',
                            border: `1.5px solid ${sel ? l.color : 'transparent'}`,
                            fontSize: 'var(--text-xs)',
                            fontWeight: 700,
                          }}
                        >
                          <IconDisplay
                            value={l.emoji}
                            size={13}
                            color={sel ? l.color : 'var(--color-text-2)'}
                          />
                          <span>{l.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              )}

              <section className="px-4 pb-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setOutstanding(!outstanding)}
                    className="tap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                    style={{
                      background: outstanding
                        ? 'var(--color-primary-soft)'
                        : 'var(--color-gray-100)',
                      color: outstanding ? 'var(--color-primary)' : 'var(--color-text-3)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                    }}
                  >
                    {outstanding && <Check size={12} strokeWidth={3} aria-hidden />}
                    <span>외상 (미수/미지급)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setHasReceipt(!hasReceipt)}
                    className="tap inline-flex items-center gap-1.5 rounded-full px-3 py-1.5"
                    style={{
                      background: hasReceipt
                        ? 'var(--color-primary-soft)'
                        : 'var(--color-gray-100)',
                      color: hasReceipt ? 'var(--color-primary)' : 'var(--color-text-3)',
                      fontSize: 'var(--text-xs)',
                      fontWeight: 700,
                    }}
                  >
                    {hasReceipt && <Check size={12} strokeWidth={3} aria-hidden />}
                    <span>증빙 있음</span>
                  </button>
                </div>
              </section>

              {(cat === 'biz_sales_card' || cat === 'biz_sales_app') && Number(amount) > 0 && (
                <section className="px-4 pb-3">
                  <div
                    className="rounded-xl px-3 py-2"
                    style={{ background: 'var(--color-primary-soft)' }}
                  >
                    <p
                      style={{
                        color: 'var(--color-primary)',
                        fontSize: 'var(--text-xxs)',
                        fontWeight: 700,
                      }}
                    >
                      {cat === 'biz_sales_card' ? '카드 수수료 추정' : '배달앱 수수료 추정'}
                    </p>
                    <p
                      className="tnum mt-1"
                      style={{
                        color: 'var(--color-text-1)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 700,
                      }}
                    >
                      약{' '}
                      {fmt(
                        Math.round(
                          (Number(amount) *
                            (cat === 'biz_sales_card'
                              ? bizProfile.cardFeeRate
                              : bizProfile.deliveryFeeRate)) /
                            100,
                        ),
                      )}
                      원 (
                      {cat === 'biz_sales_card'
                        ? bizProfile.cardFeeRate
                        : bizProfile.deliveryFeeRate}
                      %)
                      <span
                        style={{
                          color: 'var(--color-text-3)',
                          fontSize: 'var(--text-xxs)',
                          fontWeight: 500,
                        }}
                      >
                        {' '}
                        · 메모에 자동 기록
                      </span>
                    </p>
                  </div>
                </section>
              )}
            </>
          )}

          <div className="flex-1" />

          {/* Sticky: this step is taller than the screen, and 저장 must not need a scroll. */}
          <div
            className="sticky bottom-0 flex gap-2 px-4 pt-2"
            style={{
              background: 'var(--color-card)',
              paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)',
            }}
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
              className="tap flex h-14 w-16 items-center justify-center rounded-2xl"
              style={{
                background: 'var(--color-primary-soft)',
                color: 'var(--color-primary)',
              }}
              aria-label="즐겨찾기로 저장"
            >
              <Star size={22} strokeWidth={2.2} fill="currentColor" />
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
