'use client';

import { BellRing, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import { AccountSheet, CategorySheet } from '@/components/PickerSheets';
import { SkeletonHome } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import { useAccounts } from '@/lib/accounts';
import {
  CATEGORIES,
  expenseCategoriesByScope,
  incomeCategoriesByScope,
  isTransferCategory,
} from '@/lib/categories';
import { useCategoryRules } from '@/lib/category-rules';
import { fmt } from '@/lib/format';
import {
  canReimburse,
  costPatch,
  isCosted,
  toBusinessPatch,
  toPersonalPatch,
} from '@/lib/reimburse';
import { patchTransactions, useAllTransactions } from '@/lib/storage';

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
};
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
};

// A static route with ?id= (not /tx/[id]): a dynamic segment has to ask the
// server on every tap, and this page only ever reads local data.
export default function TxDetailPageWrap() {
  return (
    <Suspense fallback={null}>
      <TxDetailPage />
    </Suspense>
  );
}

function TxDetailPage() {
  const id = useSearchParams().get('id') ?? '';
  const router = useRouter();
  const toast = useToast();
  const { tx, ready, remove, update, restore, add } = useAllTransactions();
  const { allAccounts } = useAccounts();
  const { items: rules, set: setRules } = useCategoryRules();
  const [picking, setPicking] = useState<null | 'cat' | 'acc'>(null);

  const onCopy = () => {
    if (!item) return;
    const copy = {
      ...item,
      id: 'tn' + Date.now().toString(36),
      date: new Date().toISOString(),
      transferPairId: undefined,
      transferTo: undefined,
      transferCrossMode: undefined,
      source: undefined,
      // A copy is a new purchase: not yet settled, collected, or auto-posted.
      reimburse: item.reimburse ? ('due' as const) : undefined,
      outstanding: undefined,
      recurring: undefined,
      settles: undefined,
    };
    add(copy);
    toast.show('거래 복사됨 (오늘 날짜로)', 'success');
    router.replace(`/tx?id=${copy.id}`);
  };

  const item = tx.find((t) => t.id === id);

  if (!ready) {
    return <SkeletonHome />;
  }

  if (!item) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <p className="mb-2 text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>
          거래를 찾을 수 없어요
        </p>
        <p className="mb-6 text-sm" style={{ color: 'var(--color-text-3)' }}>
          이미 삭제되었거나 없는 거래입니다.
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

  const cat = CATEGORIES[item.cat];
  // All scopes — a business row opened from personal mode still names its account.
  const account = allAccounts.find((a) => a.id === item.acc);
  const isIncome = item.amount > 0;

  const onDelete = () => {
    const removed = remove(item.id);
    toast.show(removed.length > 1 ? '이체 거래(양쪽) 삭제됨' : '삭제되었습니다', {
      variant: 'info',
      durationMs: 5000,
      action: {
        label: '되돌리기',
        onClick: () => {
          restore(removed);
          toast.show('복원 완료', 'success');
        },
      },
    });
    router.back();
  };

  const updateField = (patch: Partial<typeof item>) => {
    update(item.id, patch);
    toast.show('수정 완료', 'success');
  };

  // Category and account are the two things a recorded row most often gets
  // wrong; both change right here. A transfer leg keeps its category and its
  // accounts (they are what make it a transfer).
  const scope = item.scope ?? 'personal';
  const transfer = isTransferCategory(item.cat) || !!item.transferPairId;
  const catChoices = isIncome ? incomeCategoriesByScope(scope) : expenseCategoriesByScope(scope);
  // 잔액 보정 and 대출 원금 are posted by the app and stay what they are.
  const fixedCat = transfer || !catChoices.some((c) => c.id === item.cat);
  const accChoices = allAccounts.filter(
    (a) => a.scope === (account?.scope ?? scope) && a.type !== 'receivable',
  );

  const changeCategory = (catId: string) => {
    setPicking(null);
    if (catId === item.cat) return;
    const from = item.cat;
    update(item.id, { cat: catId });
    const name = item.merchant.trim();
    const catName = CATEGORIES[catId]?.name ?? '카테고리';
    // The other rows from this place still filed the old way.
    const same = name
      ? tx.filter(
          (t) =>
            t.id !== item.id &&
            !t.transferPairId &&
            (t.scope ?? 'personal') === scope &&
            t.merchant.trim() === name &&
            t.cat === from &&
            t.amount > 0 === isIncome,
        )
      : [];
    toast.show(`${catName}(으)로 바꿨어요`, {
      variant: 'success',
      durationMs: 6000,
      action: name
        ? {
            label: '이 소비처 전부',
            onClick: () => {
              patchTransactions(
                same.map((t) => t.id),
                { cat: catId },
              );
              // First in the list: rules are tried in order and this one is exact.
              setRules([
                { id: `rule-${Date.now().toString(36)}`, match: name, cat: catId },
                ...rules.filter((r) => r.match.toLowerCase() !== name.toLowerCase()),
              ]);
              toast.show(
                same.length > 0
                  ? `${same.length + 1}건 변경 · 앞으로도 ${catName}`
                  : `앞으로도 ${catName}`,
                'success',
              );
            },
          }
        : undefined,
    });
  };

  const changeAccount = (accId: string) => {
    setPicking(null);
    if (accId === item.acc) return;
    update(item.id, { acc: accId });
    toast.show('계좌를 바꿨어요', 'success');
  };

  // 사업 대납: a business cost paid with my own card. The row moves to the
  // business ledger and waits on the 정산 list until the business pays it back.
  const due = item.reimburse === 'due';
  const canFlag = due || canReimburse(item, allAccounts);
  const toggleReimburse = () => {
    update(item.id, due ? toPersonalPatch(item, tx) : toBusinessPatch(item, tx));
    toast.show(due ? '개인 지출로 되돌렸어요' : '사업 비용으로 옮겼어요', 'success');
  };
  // Debt only: owed by the business, but not one of its costs.
  const costed = isCosted(item);
  const toggleCosted = () => {
    update(item.id, costPatch(item, !costed, tx));
    toast.show(costed ? '채무로만 잡았어요' : '사업 비용으로 잡았어요', 'success');
  };

  return (
    <div className="flex min-h-dvh flex-col" style={{ background: 'var(--color-bg)' }}>
      <header className="flex items-center justify-between px-3 pt-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="tap flex h-10 w-10 items-center justify-center rounded-full"
          aria-label="뒤로"
        >
          <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
            <path
              d="M15 6l-6 6 6 6"
              stroke="var(--color-text-1)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div className="flex items-center gap-1">
          {!item.transferPairId && (
            <button
              type="button"
              onClick={onCopy}
              className="tap h-10 rounded-full px-3 text-sm font-semibold"
              style={{ color: 'var(--color-text-2)' }}
            >
              복사
            </button>
          )}
          <button
            type="button"
            onClick={() => router.push(`/tx/edit?id=${item.id}`)}
            className="tap h-10 rounded-full px-3 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            편집
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="tap ml-2 h-10 rounded-full px-3 text-sm font-semibold"
            style={{ color: 'var(--color-danger)' }}
          >
            삭제
          </button>
        </div>
      </header>

      <section className="px-6 pb-8 pt-6 text-center">
        {isTransferCategory(item.cat) || item.transferPairId ? (
          <CategoryIcon catId={item.cat} size={72} style={{ margin: '0 auto 16px' }} />
        ) : (
          <div className="mb-4 flex justify-center">
            <MerchantAvatar merchant={item.merchant} catId={item.cat} size={72} />
          </div>
        )}
        {fixedCat || (item.reimburse && !costed) ? (
          <p
            style={{
              color: 'var(--color-text-3)',
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.04em',
            }}
          >
            {item.reimburse && !costed
              ? '사업 대납 · 채무'
              : `${cat?.name ?? '기타'}${transfer ? ' · 이체' : ''}`}
          </p>
        ) : (
          <button
            type="button"
            onClick={() => setPicking('cat')}
            aria-label={`카테고리 ${cat?.name ?? '기타'} 바꾸기`}
            className="tap mx-auto flex h-10 items-center gap-0.5 rounded-full pl-3.5 pr-2"
            style={{
              background: 'var(--color-card)',
              color: 'var(--color-text-2)',
              fontSize: 13,
              fontWeight: 700,
            }}
          >
            {cat?.name ?? '기타'}
            <ChevronRight size={15} strokeWidth={2.6} color="var(--color-text-3)" />
          </button>
        )}
        <p
          className="tnum mt-1.5 tracking-tight"
          style={{
            color: isIncome ? 'var(--color-primary)' : 'var(--color-text-1)',
            fontSize: 32,
            fontWeight: 900,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
          }}
        >
          {isIncome ? '+' : '−'}
          {fmt(item.amount)}
          <span style={{ fontSize: 18, marginLeft: 2, color: 'var(--color-text-3)' }}>원</span>
        </p>
        <button
          type="button"
          onClick={() => {
            if (item.merchant.trim()) {
              router.push(`/merchant?name=${encodeURIComponent(item.merchant.trim())}`);
            }
          }}
          className="tap mt-2 inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
          style={{
            background: 'var(--color-card)',
            boxShadow: '0 1px 2px rgba(20, 28, 40, 0.06)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
          }}
          aria-label={`${item.merchant}의 모든 거래 보기`}
        >
          {item.merchant}
          <svg viewBox="0 0 24 24" width={14} height={14} fill="none">
            <path
              d="M9 6l6 6-6 6"
              stroke="var(--color-text-3)"
              strokeWidth={2.4}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        {item.source === 'notification' && (
          <Link
            href="/inbox"
            className="tap mx-auto mt-2.5 flex w-fit items-center gap-1 rounded-full px-2.5 py-1"
            style={{
              background: 'var(--color-primary-soft)',
              color: 'var(--color-primary)',
              fontSize: 11,
              fontWeight: 800,
            }}
          >
            <BellRing size={11} strokeWidth={2.8} />
            카드 알림으로 자동 기록
          </Link>
        )}
      </section>

      <section
        className="mx-4 overflow-hidden rounded-2xl"
        style={{ background: 'var(--color-card)' }}
      >
        <Row label="날짜" value={fmtDate(item.date)} />
        <Row label="시간" value={fmtTime(item.date)} />
        {transfer ? (
          <Row label="계좌" value={account?.name ?? '삭제된 계좌'} />
        ) : (
          <button
            type="button"
            onClick={() => setPicking('acc')}
            className="tap flex w-full items-center justify-between px-5 py-4 text-left"
            style={{ borderBottom: '1px solid var(--color-divider)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
              계좌
            </span>
            <span
              className="flex items-center gap-0.5 text-sm font-semibold"
              style={{ color: 'var(--color-text-1)' }}
            >
              {account?.name ?? '삭제된 계좌'}
              <ChevronRight size={15} strokeWidth={2.6} color="var(--color-text-3)" />
            </span>
          </button>
        )}
        {canFlag && (
          <button
            type="button"
            role="switch"
            aria-checked={due}
            onClick={toggleReimburse}
            className="tap flex w-full items-center justify-between px-5 py-3.5 text-left"
            style={{ borderBottom: '1px solid var(--color-divider)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
              사업 대납
            </span>
            <span className="flex items-center gap-2.5">
              {due && (
                <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                  정산 대기
                </span>
              )}
              <span
                aria-hidden
                className="relative inline-block h-7 w-12 rounded-full transition-colors"
                style={{ background: due ? 'var(--color-primary)' : 'var(--color-gray-200)' }}
              >
                <span
                  className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  style={{ left: 2, transform: due ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </span>
            </span>
          </button>
        )}
        {due && (
          <button
            type="button"
            role="switch"
            aria-checked={costed}
            onClick={toggleCosted}
            className="tap flex w-full items-center justify-between px-5 py-3.5 text-left"
            style={{ borderBottom: '1px solid var(--color-divider)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
              사업 비용으로 잡기
            </span>
            <span className="flex items-center gap-2.5">
              {!costed && (
                <span className="text-sm font-semibold" style={{ color: 'var(--color-text-2)' }}>
                  채무만
                </span>
              )}
              <span
                aria-hidden
                className="relative inline-block h-7 w-12 rounded-full transition-colors"
                style={{ background: costed ? 'var(--color-primary)' : 'var(--color-gray-200)' }}
              >
                <span
                  className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
                  style={{ left: 2, transform: costed ? 'translateX(20px)' : 'translateX(0)' }}
                />
              </span>
            </span>
          </button>
        )}
        {item.reimburse === 'done' && (
          <button
            type="button"
            onClick={() => {
              update(item.id, { reimburse: 'due' });
              toast.show('정산 대기로 되돌렸어요', {
                variant: 'info',
                action: { label: '취소', onClick: () => update(item.id, { reimburse: 'done' }) },
              });
            }}
            className="tap flex w-full items-center justify-between px-5 py-4 text-left"
            style={{ borderBottom: '1px solid var(--color-divider)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
              사업 대납
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>
              정산 완료 · 되돌리기
            </span>
          </button>
        )}
        {item.outstanding && (
          <button
            type="button"
            onClick={() => {
              update(item.id, { outstanding: undefined });
              toast.show(isIncome ? '수금 완료' : '지급 완료', {
                variant: 'success',
                action: { label: '취소', onClick: () => update(item.id, { outstanding: true }) },
              });
            }}
            className="tap flex w-full items-center justify-between px-5 py-4 text-left"
            style={{ borderBottom: '1px solid var(--color-divider)' }}
          >
            <span className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
              외상
            </span>
            <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
              {isIncome ? '수금 완료로' : '지급 완료로'}
            </span>
          </button>
        )}
        <RowEditable
          label="메모"
          placeholder="메모 추가"
          value={item.memo ?? ''}
          onSave={(v) => updateField({ memo: v })}
        />
      </section>

      <div className="flex-1" />
      {/* No bottom nav here, so the page clears the home indicator itself. */}
      <div style={{ height: 'calc(env(safe-area-inset-bottom) + 16px)' }} />

      <CategorySheet
        open={picking === 'cat'}
        onClose={() => setPicking(null)}
        choices={catChoices}
        value={item.cat}
        onPick={changeCategory}
      />
      <AccountSheet
        open={picking === 'acc'}
        onClose={() => setPicking(null)}
        choices={accChoices}
        value={item.acc}
        onPick={changeAccount}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex items-center justify-between px-5 py-4"
      style={{ borderBottom: '1px solid var(--color-divider)' }}
    >
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
        {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: 'var(--color-text-1)' }}>
        {value}
      </span>
    </div>
  );
}

function RowEditable({
  label,
  placeholder,
  value,
  onSave,
}: {
  label: string;
  placeholder: string;
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const commit = () => {
    if (draft.trim() !== value) onSave(draft.trim());
    setEditing(false);
  };

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setEditing(true);
        }}
        className="tap flex w-full items-center justify-between px-5 py-4 text-left"
      >
        <span className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
          {label}
        </span>
        <span
          className="text-sm font-semibold"
          style={{ color: value ? 'var(--color-text-1)' : 'var(--color-text-3)' }}
        >
          {value || placeholder}
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <span className="text-sm font-medium" style={{ color: 'var(--color-text-3)' }}>
        {label}
      </span>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !e.nativeEvent.isComposing) commit();
          if (e.key === 'Escape') setEditing(false);
        }}
        // biome-ignore lint/a11y/noAutofocus: the field appears because the row was tapped
        autoFocus
        placeholder={placeholder}
        className="h-10 flex-1 rounded-lg px-3 text-sm outline-none"
        style={{
          background: 'var(--color-gray-100)',
          color: 'var(--color-text-1)',
        }}
      />
    </div>
  );
}
