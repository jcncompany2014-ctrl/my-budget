'use client';

import {
  Banknote,
  CreditCard,
  HandCoins,
  Landmark,
  type LucideIcon,
  Plus,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import BankIcon from '@/components/icons/BankIcon';
import CardIcon from '@/components/icons/CardIcon';
import { useMode } from '@/components/ModeProvider';
import { SkeletonList } from '@/components/Skeleton';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import Sheet from '@/components/ui/Sheet';
import { takeAccountToEdit, useAccounts } from '@/lib/accounts';
import { defaultCycleStart } from '@/lib/card-billing';
import { namesIssuer } from '@/lib/card-notification';
import { fmt } from '@/lib/format';
import { cardLabel } from '@/lib/inbox-import';
import { INSTITUTIONS, type Institution } from '@/lib/institutions';
import { useAllTransactions } from '@/lib/storage';
import type { Account, AccountType } from '@/lib/types';

const COLORS = [
  '#00B956',
  '#3182F6',
  '#F472B6',
  '#FF8A1F',
  '#8B5CF6',
  '#14B8A6',
  '#FFCC00',
  '#EF4444',
];
const TYPE_META: Record<AccountType, { label: string; Icon: LucideIcon }> = {
  bank: { label: '은행', Icon: Landmark },
  card: { label: '카드', Icon: CreditCard },
  cash: { label: '현금', Icon: Banknote },
  investment: { label: '투자', Icon: TrendingUp },
  receivable: { label: '받을 돈', Icon: HandCoins },
};
const TYPE_LABELS: Record<AccountType, string> = {
  bank: '은행',
  card: '카드',
  cash: '현금',
  investment: '투자',
  receivable: '받을 돈',
};

export default function AccountsSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { accounts, ready, add, update, remove } = useAccounts();
  const { tx: allTx } = useAllTransactions();
  const [editing, setEditing] = useState<Account | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Arriving from "처음 보는 카드 → 새 카드": that card's editor is already open.
  useEffect(() => {
    if (!ready) return;
    const id = takeAccountToEdit();
    const target = id ? accounts.find((a) => a.id === id) : undefined;
    if (target) {
      setEditing(target);
      setCreating(false);
    }
  }, [ready, accounts]);

  if (!ready) {
    return (
      <>
        <TopBar title={mode === 'business' ? '사업 계좌' : '개인 계좌'} />
        <SkeletonList rows={4} />
      </>
    );
  }

  const handleSave = (draft: Account) => {
    // Billing only means something on a card with a payment day.
    const a: Account =
      draft.type === 'card' && draft.billingDay
        ? draft
        : {
            ...draft,
            billingDay: undefined,
            cycleStartDay: undefined,
            billingAccountId: undefined,
            autoBilling: undefined,
            billingPostedThrough: undefined,
          };
    // Auto payment counts from the moment it is switched on.
    if (a.autoBilling && !(editing?.autoBilling && !creating)) {
      a.billingPostedThrough = new Date().toISOString();
    }
    if (creating || !editing) {
      add(a);
      toast.show('계좌 추가 완료', 'success');
    } else {
      // Only the fields changed in the sheet: while it was open a notice may
      // have moved the balance or taught the account a card, and writing the
      // whole draft back would undo that.
      const before = editing as unknown as Record<string, unknown>;
      const after = a as unknown as Record<string, unknown>;
      const patch: Record<string, unknown> = {};
      for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
        if (after[k] !== before[k]) patch[k] = after[k];
      }
      update(a.id, patch as Partial<Account>);
      toast.show('계좌 수정 완료', 'success');
    }
    setEditing(null);
    setCreating(false);
  };

  const handleDelete = (id: string) => {
    remove(id);
    toast.show('계좌 삭제 완료', 'info');
    setDeleting(false);
    setEditing(null);
  };
  const usedBy = editing ? allTx.filter((t) => t.acc === editing.id).length : 0;

  const startNew = (type: AccountType) => {
    setEditing({
      id: 'acc-' + Date.now().toString(36),
      name: '',
      bank: '',
      type,
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
          <EmptyState icon={Wallet} iconColor="#3182F6" title="계좌가 없어요" />
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
                  <p
                    className="truncate text-[15px] font-semibold"
                    style={{ color: 'var(--color-text-1)' }}
                  >
                    {a.name}
                  </p>
                  <p className="tnum truncate text-xs" style={{ color: 'var(--color-text-3)' }}>
                    {TYPE_LABELS[a.type]} · {a.bank || '—'}
                    {a.last4 ? ` · ${a.last4}` : ''}
                    {a.type === 'card' && a.billingDay ? ` · 매월 ${a.billingDay}일 결제` : ''}
                  </p>
                  {a.type === 'card' && !a.billingDay && (
                    <p
                      className="mt-0.5 text-xs font-bold"
                      style={{ color: 'var(--color-primary)' }}
                    >
                      결제일 정하기
                    </p>
                  )}
                </div>
                <p
                  className="tnum text-[14px] font-bold"
                  style={{
                    color: a.type === 'card' ? 'var(--color-danger)' : 'var(--color-text-1)',
                  }}
                >
                  {a.balance < 0 ? '−' : ''}
                  {fmt(a.balance)}원
                </p>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="grid grid-cols-2 gap-2 px-5 pb-10 pt-2">
        {(
          [
            ['bank', '계좌'],
            ['card', '카드'],
          ] as const
        ).map(([type, label]) => (
          <button
            key={type}
            type="button"
            onClick={() => startNew(type)}
            className="tap flex items-center justify-center gap-1 rounded-2xl border-2 border-dashed py-4 text-sm font-bold"
            style={{ borderColor: 'var(--color-gray-300)', color: 'var(--color-text-2)' }}
          >
            <Plus size={16} strokeWidth={2.6} />
            {label}
          </button>
        ))}
      </section>

      {editing && (
        <AccountEditor
          account={editing}
          isNew={creating}
          payFrom={accounts.filter(
            (a) => (a.type === 'bank' || a.type === 'cash') && a.id !== editing.id,
          )}
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
        title={`'${editing?.name ?? ''}' 계좌를 삭제할까요?`}
        description={
          usedBy > 0
            ? `이 계좌로 기록된 거래 ${usedBy}건은 남지만, 계좌 이름은 더 이상 표시되지 않아요.`
            : undefined
        }
        confirmLabel="삭제"
        danger
        onCancel={() => setDeleting(false)}
        onConfirm={() => editing && handleDelete(editing.id)}
      />
    </>
  );
}

function AccountEditor({
  account,
  isNew,
  payFrom,
  onSave,
  onDelete,
  onCancel,
}: {
  account: Account;
  isNew: boolean;
  /** Accounts a card bill can be paid from. */
  payFrom: Account[];
  onSave: (a: Account) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(account);
  // The name the last pick filled in — replaced by the next pick unless edited since.
  const [picked, setPicked] = useState('');

  const valid = draft.name.trim().length > 0;

  const pick = (inst: Institution) => {
    setDraft((d) => ({
      ...d,
      name: !d.name.trim() || d.name === picked ? inst.name : d.name,
      bank: inst.name,
      type: inst.type,
      color: inst.color,
      balance: inst.type === 'card' ? -Math.abs(d.balance) : Math.abs(d.balance),
    }));
    setPicked(inst.name);
  };

  return (
    <Sheet open onClose={onCancel} keep={draft !== account}>
      {/* Live preview header */}
      <div
        className="mb-5 flex items-center gap-3 rounded-2xl px-4 py-3"
        style={{ background: 'var(--color-gray-50)' }}
      >
        {draft.type === 'card' ? (
          <CardIcon name={draft.bank || draft.name || '카드'} size={36} />
        ) : (
          <BankIcon name={draft.bank || draft.name || '계좌'} size={44} />
        )}
        <div className="min-w-0 flex-1">
          <p
            className="truncate"
            style={{
              color: 'var(--color-text-1)',
              fontSize: 15,
              fontWeight: 700,
            }}
          >
            {draft.name || (isNew ? (draft.type === 'card' ? '새 카드' : '새 계좌') : '계좌')}
          </p>
          <p
            className="truncate"
            style={{
              color: 'var(--color-text-3)',
              fontSize: 11,
            }}
          >
            {TYPE_LABELS[draft.type]}
            {draft.bank ? ` · ${draft.bank}` : ''}
          </p>
        </div>
      </div>

      {isNew && <QuickPick type={draft.type} selected={draft.bank} onPick={pick} />}

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
      </Field>

      <Field label="종류">
        <div className="grid grid-cols-5 gap-2">
          {(['bank', 'card', 'cash', 'investment', 'receivable'] as AccountType[]).map((t) => {
            const sel = draft.type === t;
            const { Icon, label } = TYPE_META[t];
            return (
              <button
                key={t}
                type="button"
                onClick={() =>
                  setDraft({
                    ...draft,
                    type: t,
                    balance: t === 'card' ? -Math.abs(draft.balance) : Math.abs(draft.balance),
                  })
                }
                className="tap flex flex-col items-center justify-center gap-1.5 rounded-xl py-3"
                style={{
                  background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                  color: sel ? '#fff' : 'var(--color-text-2)',
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                <Icon size={18} strokeWidth={2.4} />
                {label}
              </button>
            );
          })}
        </div>
      </Field>

      {/* The phone's number pad has no minus key: a card takes the amount owed and stores it negative. */}
      <Field label={draft.type === 'card' ? '사용액 (갚을 돈)' : '잔액'}>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={draft.balance ? fmt(draft.balance) : ''}
          onChange={(e) => {
            const n = Number(e.target.value.replace(/[^0-9]/g, '')) || 0;
            setDraft({ ...draft, balance: draft.type === 'card' ? -n : n });
          }}
          placeholder="0"
          className="tnum h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
          style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
        />
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

      {(draft.type === 'card' || draft.type === 'bank') && (
        <Field label={draft.type === 'card' ? '카드 끝 4자리' : '체크카드 끝 4자리'}>
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={draft.last4 ?? ''}
            onChange={(e) =>
              setDraft({ ...draft, last4: e.target.value.replace(/[^0-9*]/g, '') || undefined })
            }
            placeholder="1234"
            className="tnum h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
          {draft.cards && draft.cards.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {draft.cards.map((c) => (
                <button
                  key={`${c.issuer ?? ''}|${c.last4 ?? ''}`}
                  type="button"
                  onClick={() => {
                    const cards = (draft.cards ?? []).filter((x) => x !== c);
                    setDraft({
                      ...draft,
                      cards: cards.length > 0 ? cards : undefined,
                      // The digits and issuer the notice filled in would go on
                      // matching it; a name that says the issuer is the user's own.
                      last4: c.last4 && draft.last4 === c.last4 ? undefined : draft.last4,
                      bank:
                        c.issuer && draft.bank === c.issuer && !namesIssuer(draft.name)
                          ? ''
                          : draft.bank,
                    });
                  }}
                  aria-label={`${cardLabel(c)} 알림 연결 해제`}
                  className="tap tnum flex h-8 items-center gap-1 rounded-full pl-3 pr-2"
                  style={{
                    background: 'var(--color-primary-soft)',
                    color: 'var(--color-primary)',
                    fontSize: 12,
                    fontWeight: 700,
                  }}
                >
                  {cardLabel(c)} 알림
                  <X size={13} strokeWidth={2.8} />
                </button>
              ))}
            </div>
          )}
        </Field>
      )}

      {draft.type === 'card' && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Field label="결제일">
              <DayInput
                value={draft.billingDay}
                onChange={(d) =>
                  setDraft({
                    ...draft,
                    billingDay: d,
                    // The bill almost always leaves the main account — one tap fewer.
                    billingAccountId:
                      draft.billingAccountId ??
                      (d
                        ? (
                            payFrom.find((a) => a.main) ??
                            (payFrom.length === 1 ? payFrom[0] : null)
                          )?.id
                        : undefined),
                  })
                }
              />
            </Field>
            <Field label="이용기간 시작일">
              <DayInput
                value={draft.cycleStartDay}
                placeholder={draft.billingDay ? String(defaultCycleStart(draft.billingDay)) : ''}
                onChange={(d) => setDraft({ ...draft, cycleStartDay: d })}
              />
            </Field>
          </div>
          {draft.billingDay ? (
            <Field label="결제 계좌">
              <div className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                {payFrom.map((a) => {
                  const sel = draft.billingAccountId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          billingAccountId: sel ? undefined : a.id,
                          autoBilling: sel ? false : draft.autoBilling,
                        })
                      }
                      className="tap shrink-0 rounded-xl px-3.5 py-2.5"
                      style={{
                        background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                        color: sel ? '#fff' : 'var(--color-text-2)',
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {a.name}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={!draft.billingAccountId}
                onClick={() => setDraft({ ...draft, autoBilling: !draft.autoBilling })}
                className="tap mt-2 flex w-full items-center justify-between rounded-xl px-4 py-3 disabled:opacity-40"
                style={{ background: 'var(--color-gray-100)' }}
              >
                <span style={{ color: 'var(--color-text-1)', fontSize: 13, fontWeight: 700 }}>
                  결제일에 카드대금 자동 이체
                </span>
                <SmallSwitch on={!!draft.autoBilling && !!draft.billingAccountId} />
              </button>
            </Field>
          ) : null}
        </>
      )}

      {draft.type === 'bank' && (
        <Field label="옵션">
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                main: !draft.main,
                savingsTarget: draft.main ? draft.savingsTarget : false,
              })
            }
            className="tap mb-2 flex w-full items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'var(--color-gray-100)' }}
          >
            <div className="text-left">
              <p style={{ color: 'var(--color-text-1)', fontSize: 13, fontWeight: 700 }}>
                주거래 계좌
              </p>
              <p style={{ color: 'var(--color-text-3)', fontSize: 11, marginTop: 2 }}>
                저축 자동 이체의 출금 계좌로 사용
              </p>
            </div>
            <SmallSwitch on={!!draft.main} />
          </button>
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                savingsTarget: !draft.savingsTarget,
                main: draft.savingsTarget ? draft.main : false,
              })
            }
            className="tap flex w-full items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'var(--color-gray-100)' }}
          >
            <div className="text-left">
              <p style={{ color: 'var(--color-text-1)', fontSize: 13, fontWeight: 700 }}>
                저축 자동 이체 대상
              </p>
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

const PICK_TABS = [
  ['card', '카드'],
  ['bank', '은행'],
  ['investment', '증권'],
] as const;

type PickTab = (typeof PICK_TABS)[number][0];

/** One tap fills in the name, issuer, kind and colour of a new account. */
function QuickPick({
  type,
  selected,
  onPick,
}: {
  type: AccountType;
  selected: string;
  onPick: (inst: Institution) => void;
}) {
  const [tab, setTab] = useState<PickTab>(
    type === 'card' ? 'card' : type === 'investment' ? 'investment' : 'bank',
  );
  return (
    <div className="mb-4">
      <div
        className="mb-2 grid grid-cols-3 gap-1 rounded-xl p-1"
        style={{ background: 'var(--color-gray-100)' }}
      >
        {PICK_TABS.map(([key, label]) => {
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="tap h-9 rounded-lg"
              style={{
                background: on ? 'var(--color-card)' : 'transparent',
                boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                color: on ? 'var(--color-text-1)' : 'var(--color-text-3)',
                fontSize: 13,
                fontWeight: 800,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {INSTITUTIONS[tab].map((inst) => {
          const on = selected === inst.name;
          return (
            <button
              key={inst.name}
              type="button"
              onClick={() => onPick(inst)}
              aria-pressed={on}
              className="tap flex h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl px-1"
              style={{
                background: on ? 'var(--color-primary-soft)' : 'var(--color-gray-50)',
                boxShadow: on ? 'inset 0 0 0 1.5px var(--color-primary)' : undefined,
              }}
            >
              {inst.type === 'card' ? (
                <CardIcon name={inst.name} size={24} />
              ) : (
                <BankIcon name={inst.name} size={28} />
              )}
              <span
                className="w-full truncate text-center"
                style={{
                  color: on ? 'var(--color-primary)' : 'var(--color-text-2)',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {inst.name.replace(/\s?카드$|은행$|증권$/, '')}
              </span>
            </button>
          );
        })}
      </div>
    </div>
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
      <label
        className="mb-1.5 block text-[13px] font-semibold"
        style={{ color: 'var(--color-text-2)' }}
      >
        {label}
        {required && <span style={{ color: 'var(--color-danger)' }}> *</span>}
      </label>
      {children}
    </div>
  );
}

/** Day of the month, 1–31; empty clears it. */
function DayInput({
  value,
  placeholder,
  onChange,
}: {
  value: number | undefined;
  placeholder?: string;
  onChange: (day: number | undefined) => void;
}) {
  return (
    <div
      className="flex h-12 items-center rounded-xl px-4"
      style={{ background: 'var(--color-gray-100)' }}
    >
      <span style={{ color: 'var(--color-text-3)', fontSize: 13, fontWeight: 600 }}>매월</span>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        value={value ?? ''}
        placeholder={placeholder}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/[^0-9]/g, ''));
          onChange(n >= 1 ? Math.min(31, n) : undefined);
        }}
        className="tnum h-full w-full min-w-0 bg-transparent px-2 text-right text-[15px] font-medium outline-none"
        style={{ color: 'var(--color-text-1)' }}
      />
      <span style={{ color: 'var(--color-text-3)', fontSize: 13, fontWeight: 600 }}>일</span>
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
