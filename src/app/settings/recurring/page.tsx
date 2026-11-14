'use client';

import { Repeat } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import { useMode } from '@/components/ModeProvider';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { IconPicker } from '@/components/ui/IconPicker';
import Sheet from '@/components/ui/Sheet';
import { useAccounts } from '@/lib/accounts';
import { CATEGORIES } from '@/lib/categories';
import { fmt } from '@/lib/format';
import { daysUntilDay, useRecurring } from '@/lib/recurring';
import type { Account, RecurringItem } from '@/lib/types';

export default function RecurringSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useRecurring();
  const { accounts } = useAccounts();
  const [editing, setEditing] = useState<RecurringItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const handleSave = (r: RecurringItem) => {
    if (creating) {
      // Starts from the next due date — past months are not backfilled.
      add({ ...r, postedThrough: new Date().toISOString() });
      toast.show('정기결제 추가 완료', 'success');
    } else {
      update(r.id, r);
      toast.show('수정 완료', 'success');
    }
    setEditing(null);
    setCreating(false);
  };

  const startNew = () => {
    setEditing({
      id: 'r-' + Date.now().toString(36),
      name: '',
      emoji: 'lucide:Tv',
      amount: 0,
      day: new Date().getDate(),
      cat: mode === 'business' ? 'biz_etc' : 'subs',
      scope: mode,
    });
    setCreating(true);
  };

  const sorted = [...items].sort((a, b) => daysUntilDay(a.day) - daysUntilDay(b.day));
  const monthlyTotal = items.reduce((s, r) => s + r.amount, 0);
  const accountName = (id?: string) => accounts.find((a) => a.id === id)?.name;

  return (
    <>
      <TopBar
        title="정기결제"
        right={
          <button
            type="button"
            onClick={() => router.back()}
            className="tap rounded-full px-3 py-2 text-sm font-semibold"
            style={{ color: 'var(--color-text-3)' }}
          >
            완료
          </button>
        }
      />

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--color-text-3)' }}>
            매달 빠져나가는 총액
          </p>
          <p className="tnum mt-1 text-2xl font-extrabold" style={{ color: 'var(--color-text-1)' }}>
            {fmt(monthlyTotal)}원
          </p>
          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            {items.length}개 등록됨
          </p>
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        {items.length === 0 ? (
          <EmptyState icon={Repeat} iconColor="#0EA5E9" title="정기결제가 없어요" />
        ) : (
          <div className="space-y-2">
            {sorted.map((r) => {
              const daysUntil = daysUntilDay(r.day);
              const urgent = daysUntil <= 3;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setEditing(r);
                    setCreating(false);
                  }}
                  className="tap flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
                  style={{ background: 'var(--color-card)' }}
                >
                  <MerchantAvatar merchant={r.name} catId={r.cat} size={44} />
                  <div className="min-w-0 flex-1">
                    <p
                      className="truncate text-[15px] font-semibold"
                      style={{ color: 'var(--color-text-1)' }}
                    >
                      {r.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span
                        className="truncate"
                        style={{ color: 'var(--color-text-3)', fontSize: 11 }}
                      >
                        매월 {r.day}일{accountName(r.toAcc) ? ` · → ${accountName(r.toAcc)}` : ''}
                      </span>
                      <span
                        className="tnum shrink-0 whitespace-nowrap rounded-full px-1.5 py-0.5"
                        style={{
                          background: urgent ? 'var(--color-danger)' : 'var(--color-gray-100)',
                          color: urgent ? '#fff' : 'var(--color-text-3)',
                          fontSize: 10,
                          fontWeight: 800,
                        }}
                      >
                        {daysUntil === 0 ? '오늘' : `D-${daysUntil}`}
                      </span>
                    </div>
                  </div>
                  <p
                    className="tnum text-[15px] font-bold"
                    style={{ color: 'var(--color-text-1)' }}
                  >
                    {fmt(r.amount)}원
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="px-5 pb-10 pt-2">
        <button
          type="button"
          onClick={startNew}
          className="tap w-full rounded-2xl border-2 border-dashed py-4 text-sm font-bold"
          style={{ borderColor: 'var(--color-gray-300)', color: 'var(--color-text-2)' }}
        >
          + 정기결제 추가
        </button>
      </section>

      {editing && (
        <RecurringEditor
          item={editing}
          isNew={creating}
          accounts={accounts}
          onSave={handleSave}
          onDelete={creating ? undefined : () => setDeleting(true)}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      <ConfirmDialog
        open={deleting && editing !== null}
        title={`'${editing?.name ?? ''}' 정기결제를 삭제할까요?`}
        confirmLabel="삭제"
        danger
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          if (editing) remove(editing.id);
          toast.show('삭제 완료', 'info');
          setDeleting(false);
          setEditing(null);
        }}
      />
    </>
  );
}

function RecurringEditor({
  item,
  isNew,
  accounts,
  onSave,
  onDelete,
  onCancel,
}: {
  item: RecurringItem;
  isNew: boolean;
  accounts: Account[];
  onSave: (r: RecurringItem) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const valid =
    draft.name.trim().length > 0 && draft.amount > 0 && draft.day >= 1 && draft.day <= 31;

  const expCats = Object.values(CATEGORIES).filter((c) => c.kind !== 'income');

  return (
    <Sheet open onClose={onCancel}>
      <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>
        {isNew ? '정기결제 추가' : '정기결제 편집'}
      </h2>

      <div className="mb-3">
        <label
          className="mb-1.5 block text-[13px] font-semibold"
          style={{ color: 'var(--color-text-2)' }}
        >
          아이콘
        </label>
        <IconPicker
          set="recurring"
          value={draft.emoji}
          onChange={(v) => setDraft({ ...draft, emoji: v })}
        />
      </div>

      <div className="mb-3">
        <label
          className="mb-1.5 block text-[13px] font-semibold"
          style={{ color: 'var(--color-text-2)' }}
        >
          이름 *
        </label>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="예) 넷플릭스"
          className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
          style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
        />
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2">
        <div>
          <label
            className="mb-1.5 block text-[13px] font-semibold"
            style={{ color: 'var(--color-text-2)' }}
          >
            월 결제일 *
          </label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={31}
            value={draft.day || ''}
            onChange={(e) =>
              setDraft({ ...draft, day: Math.min(31, Math.max(1, Number(e.target.value) || 1)) })
            }
            className="tnum h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </div>
        <div>
          <label
            className="mb-1.5 block text-[13px] font-semibold"
            style={{ color: 'var(--color-text-2)' }}
          >
            금액 *
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={draft.amount || ''}
            onChange={(e) => setDraft({ ...draft, amount: Number(e.target.value) || 0 })}
            placeholder="0"
            className="tnum h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </div>
      </div>

      <div className="mb-4">
        <label
          className="mb-1.5 block text-[13px] font-semibold"
          style={{ color: 'var(--color-text-2)' }}
        >
          카테고리
        </label>
        <div className="grid grid-cols-4 gap-2">
          {expCats.slice(0, 8).map((c) => {
            const sel = draft.cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setDraft({ ...draft, cat: c.id })}
                className="tap flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5"
                style={{
                  background: sel ? `${c.color}22` : 'var(--color-gray-100)',
                  border: `2px solid ${sel ? c.color : 'transparent'}`,
                }}
              >
                <CategoryIcon catId={c.id} bare size={16} />
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: 'var(--color-text-2)' }}
                >
                  {c.name}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {accounts.length > 1 && (
        <>
          <AccountChips
            label="출금 계좌"
            none="주거래"
            value={draft.acc}
            options={accounts.filter((a) => a.type !== 'receivable')}
            onChange={(acc) =>
              setDraft({ ...draft, acc, toAcc: draft.toAcc === acc ? undefined : draft.toAcc })
            }
          />
          {/* Money that lands in another of my accounts is posted as a transfer, not spending. */}
          <AccountChips
            label="입금 계좌 (적금·이체)"
            none="없음"
            value={draft.toAcc}
            options={accounts.filter((a) => a.id !== draft.acc && a.type !== 'receivable')}
            onChange={(toAcc) => setDraft({ ...draft, toAcc })}
          />
        </>
      )}

      <div className="mt-2 flex gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="tap h-12 rounded-xl px-4 text-sm font-bold"
            style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
          >
            삭제
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="tap h-12 flex-1 rounded-xl text-sm font-bold"
          style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
        >
          취소
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSave(draft)}
          className="tap h-12 flex-1 rounded-xl text-sm font-bold"
          style={{
            background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
            color: valid ? '#fff' : 'var(--color-text-4)',
          }}
        >
          저장
        </button>
      </div>
    </Sheet>
  );
}

function AccountChips({
  label,
  none,
  value,
  options,
  onChange,
}: {
  label: string;
  /** Label of the "not set" chip. */
  none: string;
  value?: string;
  options: Account[];
  onChange: (id: string | undefined) => void;
}) {
  const chip = (selected: boolean, color: string) => ({
    background: selected ? color : 'var(--color-gray-100)',
    color: selected ? '#fff' : 'var(--color-text-2)',
    fontSize: 12,
    fontWeight: 700,
  });
  return (
    <div className="mb-4">
      <p className="mb-1.5 text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="tap rounded-lg px-3 py-2"
          style={chip(!value, 'var(--color-text-1)')}
        >
          {none}
        </button>
        {options.map((a) => (
          <button
            key={a.id}
            type="button"
            onClick={() => onChange(a.id)}
            className="tap rounded-lg px-3 py-2"
            style={chip(value === a.id, 'var(--color-primary)')}
          >
            {a.name}
          </button>
        ))}
      </div>
    </div>
  );
}
