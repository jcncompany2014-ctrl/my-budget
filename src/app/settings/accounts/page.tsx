'use client';

import { Banknote, CreditCard, Landmark, type LucideIcon, TrendingUp, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import BankIcon from '@/components/icons/BankIcon';
import CardIcon from '@/components/icons/CardIcon';
import { useMode } from '@/components/ModeProvider';
import { SkeletonList } from '@/components/Skeleton';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/ui/EmptyState';
import Sheet from '@/components/ui/Sheet';
import { useAccounts } from '@/lib/accounts';
import { fmt } from '@/lib/format';
import type { Account, AccountType } from '@/lib/types';

const COLORS = ['#00B956', '#3182F6', '#F472B6', '#FF8A1F', '#8B5CF6', '#14B8A6', '#FFCC00', '#EF4444'];
const TYPE_META: Record<AccountType, { label: string; Icon: LucideIcon }> = {
  bank: { label: '은행', Icon: Landmark },
  card: { label: '카드', Icon: CreditCard },
  cash: { label: '현금', Icon: Banknote },
  investment: { label: '투자', Icon: TrendingUp },
};
const TYPE_LABELS: Record<AccountType, string> = {
  bank: '은행',
  card: '카드',
  cash: '현금',
  investment: '투자',
};

export default function AccountsSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { accounts, ready, add, update, remove } = useAccounts();
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ready) {
    return (
      <>
        <TopBar title={mode === 'business' ? '사업 계좌' : '개인 계좌'} />
        <SkeletonList rows={4} />
      </>
    );
  }

  const handleSave = (a: Account) => {
    if (creating) {
      add(a);
      toast.show('계좌 추가 완료', 'success');
    } else {
      update(a.id, a);
      toast.show('계좌 수정 완료', 'success');
    }
    setEditing(null);
    setCreating(false);
  };

  const handleDelete = (id: string) => {
    remove(id);
    toast.show('계좌 삭제 완료', 'info');
    setEditing(null);
  };

  const startNew = () => {
    setEditing({
      id: 'acc-' + Date.now().toString(36),
      name: '',
      bank: '',
      type: 'bank',
      balance: 0,
      color: mode === 'business' ? '#3182F6' : '#00B956',
      scope: mode,
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title={mode === 'business' ? '사업 계좌' : '개인 계좌'}
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
        {accounts.length === 0 ? (
          <EmptyState
            icon={Wallet}
            iconColor="#3182F6"
            title="아직 계좌가 없어요"
            hint="은행, 카드, 현금, 투자 계좌까지 — 아래 + 버튼으로 추가"
          />
        ) : (
          <div className="space-y-2">
            {accounts.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => {
                  setEditing(a);
                  setCreating(false);
                }}
                className="tap flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left"
                style={{ background: 'var(--color-card)' }}
              >
                {a.type === 'card' ? (
                  <CardIcon name={a.bank || a.name} size={36} />
                ) : (
                  <BankIcon name={a.bank || a.name} size={44} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[15px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
                    {a.name}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                    {TYPE_LABELS[a.type]} · {a.bank || '—'}
                  </p>
                </div>
                <p
                  className="tnum text-[14px] font-bold"
                  style={{ color: a.type === 'card' ? 'var(--color-danger)' : 'var(--color-text-1)' }}
                >
                  {a.type === 'card' ? '-' : ''}
                  {fmt(Math.abs(a.balance))}원
                </p>
              </button>
            ))}
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
          + 계좌 추가
        </button>
      </section>

      {editing && (
        <AccountEditor
          account={editing}
          isNew={creating}
          onSave={handleSave}
          onDelete={creating ? undefined : () => handleDelete(editing.id)}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function AccountEditor({
  account,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  account: Account;
  isNew: boolean;
  onSave: (a: Account) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(account);

  const valid = draft.name.trim().length > 0;

  return (
    <Sheet open onClose={onCancel}>
        {/* Live preview header */}
        <div className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3"
          style={{ background: 'var(--color-gray-50)' }}>
          {draft.type === 'card' ? (
            <CardIcon name={draft.bank || draft.name || '카드'} size={36} />
          ) : (
            <BankIcon name={draft.bank || draft.name || '계좌'} size={44} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate" style={{
              color: 'var(--color-text-1)', fontSize: 15, fontWeight: 700,
            }}>
              {draft.name || (isNew ? '새 계좌' : '계좌')}
            </p>
            <p className="truncate" style={{
              color: 'var(--color-text-3)', fontSize: 11,
            }}>
              {TYPE_LABELS[draft.type]}{draft.bank ? ` · ${draft.bank}` : ''}
            </p>
          </div>
        </div>

        <Field label="이름" required>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="예) 주거래 통장"
            className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </Field>

        <Field label="은행/카드사">
          <input
            value={draft.bank}
            onChange={(e) => setDraft({ ...draft, bank: e.target.value })}
            placeholder={draft.type === 'card' ? '예) 신한카드' : '예) 토스뱅크 (선택)'}
            className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            정확한 은행/카드사명을 입력하면 브랜드 색상이 자동 적용됩니다
          </p>
        </Field>

        <Field label="종류">
          <div className="grid grid-cols-4 gap-2">
            {(['bank', 'card', 'cash', 'investment'] as AccountType[]).map((t) => {
              const sel = draft.type === t;
              const { Icon, label } = TYPE_META[t];
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setDraft({ ...draft, type: t })}
                  className="tap flex flex-col items-center justify-center gap-1.5 rounded-xl py-3"
                  style={{
                    background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                    color: sel ? '#fff' : 'var(--color-text-2)',
                    fontSize: 12, fontWeight: 700,
                  }}
                >
                  <Icon size={18} strokeWidth={2.4} />
                  {label}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="잔액">
          <input
            type="number"
            inputMode="numeric"
            value={Number.isNaN(draft.balance) ? '' : draft.balance}
            onChange={(e) => setDraft({ ...draft, balance: Number(e.target.value) || 0 })}
            placeholder="0"
            className="tnum h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
          <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-3)' }}>
            카드는 사용액(빚)을 음수로 입력 (예: -100000)
          </p>
        </Field>

        <Field label="색상">
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => {
              const sel = draft.color === c;
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setDraft({ ...draft, color: c })}
                  className="tap h-10 w-10 rounded-full"
                  style={{
                    background: c,
                    boxShadow: sel ? `0 0 0 2px var(--color-card), 0 0 0 5px ${c}33` : 'none',
                  }}
                  aria-label={c}
                />
              );
            })}
          </div>
        </Field>

        {draft.type === 'bank' && (
          <Field label="옵션">
            <button type="button"
              onClick={() => setDraft({ ...draft, main: !draft.main, savingsTarget: draft.main ? draft.savingsTarget : false })}
              className="tap mb-2 flex w-full items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'var(--color-gray-100)' }}>
              <div className="text-left">
                <p style={{ color: 'var(--color-text-1)', fontSize: 13, fontWeight: 700 }}>주거래 계좌</p>
                <p style={{ color: 'var(--color-text-3)', fontSize: 11, marginTop: 2 }}>
                  저축 자동 이체의 출금 계좌로 사용
                </p>
              </div>
              <SmallSwitch on={!!draft.main} />
            </button>
            <button type="button"
              onClick={() => setDraft({ ...draft, savingsTarget: !draft.savingsTarget, main: draft.savingsTarget ? draft.main : false })}
              className="tap flex w-full items-center justify-between rounded-xl px-4 py-3"
              style={{ background: 'var(--color-gray-100)' }}>
              <div className="text-left">
                <p style={{ color: 'var(--color-text-1)', fontSize: 13, fontWeight: 700 }}>저축 자동 이체 대상</p>
                <p style={{ color: 'var(--color-text-3)', fontSize: 11, marginTop: 2 }}>
                  저축 카테고리 거래 시 주거래 → 이 계좌로 자동 이체
                </p>
              </div>
              <SmallSwitch on={!!draft.savingsTarget} />
            </button>
          </Field>
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
        {label}
        {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

function SmallSwitch({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--color-primary)' : 'var(--color-gray-300)' }}
    >
      <span
        className="absolute h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </span>
  );
}
