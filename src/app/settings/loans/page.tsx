'use client';

import { Banknote } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Money from '@/components/Money';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/ui/EmptyState';
import { fmt } from '@/lib/format';
import { computeMonthlyPayment, useLoans } from '@/lib/loans';
import type { Loan } from '@/lib/types';

const COLORS = ['#3182F6', '#00B956', '#F472B6', '#FF8A1F', '#8B5CF6', '#14B8A6'];
const EMOJIS = ['🏦', '🏠', '🚗', '🎓', '💼', '💳'];

export default function LoansPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useLoans();
  const [editing, setEditing] = useState<Loan | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const list = items.filter((l) => l.scope === mode);
  const totalDebt = list.reduce((s, l) => s + l.remaining, 0);

  const startNew = () => {
    setEditing({
      id: 'loan-' + Date.now().toString(36),
      name: '',
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      scope: mode,
      lender: '',
      principal: 0,
      remaining: 0,
      rate: 4,
      termMonths: 60,
      startDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 365 * 5).toISOString().slice(0, 10),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title={mode === 'business' ? '사업 대출' : '개인 대출'}
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
            총 대출 잔액
          </p>
          <Money
            value={-totalDebt}
            sign="negative"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-danger)' }}
          />
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            {list.length}건
          </p>
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        {list.length === 0 ? (
          <EmptyState
            icon={Banknote}
            iconColor="#EF4444"
            title="대출이 없어요"
            hint="주택담보·신용대출·할부까지 — 원리금, 이자율, 만기를 한 번에 추적"
          />
        ) : (
          <div className="space-y-2">
            {list.map((l) => {
              const pct = l.principal > 0 ? Math.round(((l.principal - l.remaining) / l.principal) * 100) : 0;
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
                      <p
                        className="truncate"
                        style={{
                          color: 'var(--color-text-3)',
                          fontSize: 'var(--text-xs)',
                        }}
                      >
                        {l.lender} · 연 {l.rate}% · {l.termMonths}개월
                      </p>
                    </div>
                    <Money
                      value={-l.remaining}
                      sign="negative"
                      style={{
                        color: 'var(--color-danger)',
                        fontSize: 'var(--text-base)',
                        fontWeight: 700,
                      }}
                    />
                  </div>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full"
                    style={{ background: 'var(--color-gray-150)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: l.color }}
                    />
                  </div>
                  <div
                    className="mt-1.5 flex items-baseline justify-between"
                    style={{ fontSize: 'var(--text-xxs)', color: 'var(--color-text-3)' }}
                  >
                    <span>원금 {fmt(l.principal)}원</span>
                    <span>{pct}% 상환</span>
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
          + 대출 추가
        </button>
      </section>

      {editing && (
        <LoanEditor
          loan={editing}
          isNew={creating}
          onSave={(l) => {
            if (creating) add(l);
            else update(l.id, l);
            toast.show(creating ? '대출 추가 완료' : '수정 완료', 'success');
            setEditing(null);
            setCreating(false);
          }}
          onDelete={
            creating
              ? undefined
              : () => {
                  remove(editing.id);
                  toast.show('대출 삭제 완료', 'info');
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

function LoanEditor({
  loan,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  loan: Loan;
  isNew: boolean;
  onSave: (l: Loan) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(loan);
  const valid = draft.name.trim().length > 0 && draft.principal > 0 && draft.termMonths > 0;
  const monthly = draft.monthlyPayment ?? computeMonthlyPayment(draft.principal, draft.rate, draft.termMonths);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <div
        className="max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl p-6"
        style={{
          background: 'var(--color-card)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: 'var(--color-gray-200)' }}
        />
        <h2
          className="mb-4"
          style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}
        >
          {isNew ? '대출 추가' : '대출 편집'}
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
                  outline: draft.emoji === e ? '2px solid var(--color-primary)' : 'none',
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
            placeholder="예) 주택담보대출"
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 500,
            }}
          />
        </Field>

        <Field label="대출 기관">
          <input
            value={draft.lender}
            onChange={(e) => setDraft({ ...draft, lender: e.target.value })}
            placeholder="예) KB국민은행"
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
          <Field label="원금 *">
            <NumInput
              value={draft.principal}
              onChange={(n) => setDraft({ ...draft, principal: n, remaining: draft.remaining || n })}
            />
          </Field>
          <Field label="잔액">
            <NumInput value={draft.remaining} onChange={(n) => setDraft({ ...draft, remaining: n })} />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="연 이자율 (%)">
            <NumInput value={draft.rate} onChange={(n) => setDraft({ ...draft, rate: n })} step="0.01" />
          </Field>
          <Field label="기간 (개월)">
            <NumInput value={draft.termMonths} onChange={(n) => setDraft({ ...draft, termMonths: n })} />
          </Field>
        </div>

        <div
          className="rounded-xl px-4 py-3"
          style={{ background: 'var(--color-primary-soft)' }}
        >
          <p
            style={{
              color: 'var(--color-primary)',
              fontSize: 'var(--text-xxs)',
              fontWeight: 700,
            }}
          >
            예상 월 상환액
          </p>
          <Money
            value={monthly}
            sign="never"
            className="mt-1 block"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xl)', fontWeight: 800 }}
          />
        </div>

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
            onClick={() => onSave({ ...draft, monthlyPayment: monthly })}
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
      </div>
    </div>
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

function NumInput({
  value,
  onChange,
  step,
}: {
  value: number;
  onChange: (n: number) => void;
  step?: string;
}) {
  return (
    <input
      type="number"
      inputMode="numeric"
      value={value || ''}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      step={step}
      placeholder="0"
      className="tnum h-12 w-full rounded-xl px-4 outline-none"
      style={{
        background: 'var(--color-gray-100)',
        color: 'var(--color-text-1)',
        fontSize: 'var(--text-base)',
        fontWeight: 500,
      }}
    />
  );
}
