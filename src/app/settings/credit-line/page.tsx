'use client';

import { CreditCard } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/ui/EmptyState';
import Sheet from '@/components/ui/Sheet';
import { useAccounts } from '@/lib/accounts';
import { computeMonthlyInterest, useCreditLines } from '@/lib/credit-lines';
import { fmt } from '@/lib/format';
import type { LineOfCredit } from '@/lib/types';

const COLORS = ['#DC2626', '#BE185D', '#7C3AED', '#3182F6', '#0891B2', '#EA580C'];
const EMOJIS = ['💳', '🏦', '💼', '🪪', '💸', '📉'];

export default function CreditLinePage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useCreditLines();
  const [editing, setEditing] = useState<LineOfCredit | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const list = items.filter((l) => l.scope === mode);
  const totalUsed = list.reduce((s, l) => s + l.used, 0);
  const totalLimit = list.reduce((s, l) => s + l.limit, 0);

  const startNew = () => {
    setEditing({
      id: 'loc-' + Date.now().toString(36),
      name: '',
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      scope: mode,
      bank: '',
      limit: 0,
      used: 0,
      rate: 6,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title={mode === 'business' ? '사업 마이너스 통장' : '마이너스 통장'}
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

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
            총 사용액
          </p>
          <Money
            value={-totalUsed}
            sign="negative"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-danger)' }}
          />
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            한도 합계 {fmt(totalLimit)}원 · {list.length}건
          </p>
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        {list.length === 0 ? (
          <EmptyState
            icon={CreditCard}
            iconColor="#DC2626"
            title="마이너스 통장이 없어요"
            hint="한도·사용액·이자를 추적하고, 결제일에 이자 자동 차감"
          />
        ) : (
          <div className="space-y-2">
            {list.map((l) => {
              const pct = l.limit > 0 ? Math.round((l.used / l.limit) * 100) : 0;
              const monthlyInterest = computeMonthlyInterest(l.used, l.rate);
              return (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => {
                    setEditing(l);
                    setCreating(false);
                  }}
                  className="tap w-full rounded-2xl px-4 py-4 text-left"
                  style={{ background: 'var(--color-card)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-xl"
                      style={{ background: `${l.color}1f` }}
                    >
                      {l.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="truncate"
                        style={{
                          color: 'var(--color-text-1)',
                          fontSize: 'var(--text-base)',
                          fontWeight: 700,
                        }}
                      >
                        {l.name}
                      </p>
                      <p className="truncate" style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                        {l.bank} · 연 {l.rate}%
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className="tnum tracking-tight"
                        style={{
                          color: 'var(--color-danger)',
                          fontSize: 18,
                          fontWeight: 900,
                          letterSpacing: '-0.025em',
                          lineHeight: 1.1,
                        }}
                      >
                        −{fmt(l.used)}
                      </p>
                      <p
                        className="tnum mt-0.5"
                        style={{ color: 'var(--color-text-3)', fontSize: 10, fontWeight: 600 }}
                      >
                        월 이자 약 {fmt(monthlyInterest)}원
                      </p>
                    </div>
                  </div>
                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full"
                    style={{ background: 'var(--color-gray-150)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, pct)}%`,
                        background: l.color,
                        transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                    />
                  </div>
                  <div
                    className="mt-1.5 flex items-baseline justify-between tnum"
                    style={{ fontSize: 11, color: 'var(--color-text-3)' }}
                  >
                    <span>
                      <span style={{ color: l.color, fontWeight: 800 }}>{fmt(l.used)}</span>
                      {' / '}
                      {fmt(l.limit)}원
                    </span>
                    <span style={{ color: l.color, fontWeight: 800 }}>{pct}% 사용</span>
                  </div>
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
          className="tap w-full rounded-2xl border-2 border-dashed py-4"
          style={{
            borderColor: 'var(--color-gray-300)',
            color: 'var(--color-text-2)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          + 마이너스 통장 추가
        </button>
      </section>

      {editing && (
        <Editor
          item={editing}
          isNew={creating}
          onSave={(l) => {
            if (creating) add(l);
            else update(l.id, l);
            toast.show(creating ? '추가 완료' : '수정 완료', 'success');
            setEditing(null);
            setCreating(false);
          }}
          onDelete={
            creating
              ? undefined
              : () => {
                  remove(editing.id);
                  toast.show('삭제 완료', 'info');
                  setEditing(null);
                }
          }
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </>
  );
}

function Editor({
  item,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  item: LineOfCredit;
  isNew: boolean;
  onSave: (l: LineOfCredit) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const { accounts } = useAccounts();
  const valid = draft.name.trim().length > 0 && draft.limit > 0;
  const monthlyInterest = computeMonthlyInterest(draft.used, draft.rate);

  return (
    <Sheet open onClose={onCancel}>
      <h2
        className="mb-4"
        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}
      >
        {isNew ? '마이너스 통장 추가' : '마이너스 통장 편집'}
      </h2>

      <Field label="이모지">
        <div className="flex flex-wrap gap-2">
          {EMOJIS.map((e) => (
            <button
              key={e}
              type="button"
              onClick={() => setDraft({ ...draft, emoji: e })}
              className="tap flex h-10 w-10 items-center justify-center rounded-full text-xl"
              style={{
                background: draft.emoji === e ? 'var(--color-primary-soft)' : 'var(--color-gray-100)',
                border: `2px solid ${draft.emoji === e ? 'var(--color-primary)' : 'transparent'}`,
              }}
            >
              {e}
            </button>
          ))}
        </div>
      </Field>

      <Field label="이름 *">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="예) 토스뱅크 마이너스"
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </Field>

      <Field label="은행">
        <input
          value={draft.bank}
          onChange={(e) => setDraft({ ...draft, bank: e.target.value })}
          placeholder="예) 토스뱅크"
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="한도 *">
          <input
            type="number"
            inputMode="numeric"
            value={draft.limit || ''}
            onChange={(e) => setDraft({ ...draft, limit: Number(e.target.value) || 0 })}
            placeholder="0"
            className="tnum h-12 w-full rounded-xl px-4 outline-none"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
            }}
          />
        </Field>
        <Field label="현재 사용액">
          <input
            type="number"
            inputMode="numeric"
            value={draft.used || ''}
            onChange={(e) => setDraft({ ...draft, used: Number(e.target.value) || 0 })}
            placeholder="0"
            className="tnum h-12 w-full rounded-xl px-4 outline-none"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
            }}
          />
        </Field>
      </div>

      <Field label="연 이자율 (%)">
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={draft.rate || ''}
          onChange={(e) => setDraft({ ...draft, rate: Number(e.target.value) || 0 })}
          placeholder="0"
          className="tnum h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </Field>

      <Field label="색상">
        <div className="flex flex-wrap gap-2">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDraft({ ...draft, color: c })}
              className="tap h-9 w-9 rounded-full"
              style={{
                background: c,
                boxShadow:
                  draft.color === c
                    ? `0 0 0 2px var(--color-card), 0 0 0 5px ${c}33`
                    : 'none',
              }}
              aria-label={c}
            />
          ))}
        </div>
      </Field>

      {draft.used > 0 && draft.rate > 0 && (
        <div className="mb-3 rounded-xl px-4 py-3" style={{ background: 'var(--color-primary-soft)' }}>
          <p
            style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--text-xxs)',
              fontWeight: 700,
            }}
          >
            예상 월 이자
          </p>
          <Money
            value={monthlyInterest}
            sign="never"
            className="mt-1 block"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xl)', fontWeight: 800 }}
          />
        </div>
      )}

      <Field label="자동 이자 차감">
        <button
          type="button"
          onClick={() => setDraft({ ...draft, autoInterest: !draft.autoInterest })}
          className="tap flex w-full items-center justify-between rounded-xl px-4 py-3"
          style={{ background: 'var(--color-gray-100)' }}
        >
          <div className="text-left">
            <p style={{ color: 'var(--color-text-1)', fontSize: 13, fontWeight: 700 }}>
              매월 이자 자동 차감
            </p>
            <p style={{ color: 'var(--color-text-3)', fontSize: 11, marginTop: 2 }}>
              결제일에 출금 계좌에서 한 달치 이자 차감
            </p>
          </div>
          <SmallSwitch on={!!draft.autoInterest} />
        </button>
      </Field>

      {draft.autoInterest && (
        <>
          <Field label="이자 납부일 (1-31)">
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={31}
              value={draft.interestDay ?? ''}
              onChange={(e) =>
                setDraft({
                  ...draft,
                  interestDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
                })
              }
              placeholder="예) 25"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
            <p className="mt-1" style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
              그 달에 해당 날짜가 없으면 그 달의 마지막 날에 처리
            </p>
          </Field>

          <Field label="출금 계좌">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {accounts.length === 0 ? (
                <p style={{ color: 'var(--color-text-3)', fontSize: 12 }}>
                  먼저 계좌를 추가하세요
                </p>
              ) : (
                accounts.map((a) => {
                  const sel = draft.linkedAccountId === a.id;
                  return (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, linkedAccountId: a.id })}
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
                })
              )}
            </div>
          </Field>
        </>
      )}

      <div className="mt-4 flex gap-2">
        {onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="tap h-12 rounded-xl px-4"
            style={{
              background: 'var(--color-danger-soft)',
              color: 'var(--color-danger)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
            }}
          >
            삭제
          </button>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="tap h-12 flex-1 rounded-xl"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          취소
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onSave(draft)}
          className="tap h-12 flex-1 rounded-xl"
          style={{
            background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
            color: valid ? '#fff' : 'var(--color-text-4)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          저장
        </button>
      </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label
        className="mb-1.5 block"
        style={{
          color: 'var(--color-text-2)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
        }}
      >
        {label}
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
