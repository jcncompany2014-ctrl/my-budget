'use client';

import { useRouter } from 'next/navigation';
import { use, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { SkeletonHome } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAccounts } from '@/lib/accounts';
import { CATEGORIES, isTransferCategory } from '@/lib/categories';
import { fmt } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';

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

export default function TxDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { tx, ready, remove, update, restore, add } = useAllTransactions();
  const { accounts } = useAccounts();
  const [confirming, setConfirming] = useState(false);

  const onCopy = () => {
    if (!item) return;
    const copy = {
      ...item,
      id: 'tn' + Date.now().toString(36),
      date: new Date().toISOString(),
      transferPairId: undefined,
      transferTo: undefined,
      transferCrossMode: undefined,
    };
    add(copy);
    toast.show('거래 복사됨 (오늘 날짜로)', 'success');
    router.replace(`/tx/${copy.id}`);
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
  const account = accounts.find((a) => a.id === item.acc);
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
    router.replace('/');
  };

  const updateField = (patch: Partial<typeof item>) => {
    update(item.id, patch);
    toast.show('수정 완료', 'success');
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
          <button
            type="button"
            onClick={onCopy}
            className="tap rounded-full px-3 py-2 text-sm font-semibold"
            style={{ color: 'var(--color-text-2)' }}
            title="이 거래를 오늘 날짜로 복제"
          >
            복사
          </button>
          <button
            type="button"
            onClick={() => router.push(`/tx/${item.id}/edit`)}
            className="tap rounded-full px-3 py-2 text-sm font-semibold"
            style={{ color: 'var(--color-primary)' }}
          >
            편집
          </button>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="tap rounded-full px-3 py-2 text-sm font-semibold"
            style={{ color: 'var(--color-danger)' }}
          >
            삭제
          </button>
        </div>
      </header>

      <section className="px-6 pb-8 pt-6 text-center">
        <CategoryIcon catId={item.cat} size={72} style={{ margin: '0 auto 16px' }} />
        <p
          style={{
            color: 'var(--color-text-3)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.04em',
          }}
        >
          {(cat?.name ?? '기타').toUpperCase()}
          {(isTransferCategory(item.cat) || item.transferPairId) && ' · 이체'}
        </p>
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
        <p className="mt-2 text-base font-semibold" style={{ color: 'var(--color-text-1)' }}>
          {item.merchant}
        </p>
      </section>

      <section
        className="mx-4 overflow-hidden rounded-2xl"
        style={{ background: 'var(--color-card)' }}
      >
        <Row label="날짜" value={fmtDate(item.date)} />
        <Row label="시간" value={fmtTime(item.date)} />
        <Row label="계좌" value={account?.name ?? item.acc} />
        <RowEditable
          label="메모"
          placeholder="메모 추가"
          value={item.memo ?? ''}
          onSave={(v) => updateField({ memo: v })}
        />
      </section>

      <div className="flex-1" />

      <ConfirmDialog
        open={confirming}
        title="이 거래를 삭제할까요?"
        description="삭제하면 되돌릴 수 없어요. 30초 안에 토스트의 '되돌리기'를 누르면 복원할 수 있습니다."
        confirmLabel="삭제"
        danger
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          onDelete();
        }}
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
        onBlur={() => {
          onSave(draft.trim());
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            onSave(draft.trim());
            setEditing(false);
          }
          if (e.key === 'Escape') setEditing(false);
        }}
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
