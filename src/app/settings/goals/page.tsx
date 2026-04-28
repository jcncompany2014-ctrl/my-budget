'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useGoals } from '@/lib/goals';
import { fmt } from '@/lib/format';
import type { SavingsGoal } from '@/lib/types';

const COLORS = ['#00B956', '#3182F6', '#F472B6', '#FF8A1F', '#8B5CF6', '#14B8A6', '#FFCC00', '#EF4444', '#06B6D4'];
const EMOJIS = ['🎯', '🏝️', '💻', '🛟', '🚗', '🏠', '✈️', '💍', '🎓', '👶'];

export default function GoalsSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { goals, ready, add, update, remove } = useGoals();
  const [editing, setEditing] = useState<SavingsGoal | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const handleSave = (g: SavingsGoal) => {
    if (creating) {
      add(g);
      toast.show('목표 추가 완료', 'success');
    } else {
      update(g.id, g);
      toast.show('목표 수정 완료', 'success');
    }
    setEditing(null);
    setCreating(false);
  };

  const startNew = () => {
    setEditing({
      id: 'g-' + Date.now().toString(36),
      name: '',
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      target: 0,
      current: 0,
      due: new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString().slice(0, 10),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title="저축 목표 관리"
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
        {goals.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center" style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">🎯</p>
            <p className="mt-2 text-sm font-bold" style={{ color: 'var(--color-text-1)' }}>
              아직 목표가 없어요
            </p>
            <p className="mt-1 text-xs" style={{ color: 'var(--color-text-3)' }}>
              아래 + 버튼으로 첫 목표를 만드세요
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setEditing(g);
                    setCreating(false);
                  }}
                  className="tap w-full rounded-2xl p-4 text-left"
                  style={{ background: 'var(--color-card)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                      style={{ background: `${g.color}1f` }}
                    >
                      {g.emoji}
                    </div>
                    <div className="flex-1">
                      <p className="text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
                        {g.name}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
                        {fmt(g.current)} / {fmt(g.target)}원 · {pct}%
                      </p>
                    </div>
                  </div>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full"
                    style={{ background: 'var(--color-gray-150)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${pct}%`, background: g.color }}
                    />
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
          className="tap w-full rounded-2xl border-2 border-dashed py-4 text-sm font-bold"
          style={{ borderColor: 'var(--color-gray-300)', color: 'var(--color-text-2)' }}
        >
          + 목표 추가
        </button>
      </section>

      {editing && (
        <GoalEditor
          goal={editing}
          isNew={creating}
          onSave={handleSave}
          onDelete={
            creating
              ? undefined
              : () => {
                  remove(editing.id);
                  toast.show('목표 삭제 완료', 'info');
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

function GoalEditor({
  goal,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  goal: SavingsGoal;
  isNew: boolean;
  onSave: (g: SavingsGoal) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(goal);
  const valid = draft.name.trim().length > 0 && draft.target > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <div
        className="max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl p-6"
        style={{ background: 'var(--color-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--color-gray-200)' }} />
        <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>
          {isNew ? '새 목표' : '목표 편집'}
        </h2>

        <div className="mb-3">
          <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
            이모지
          </label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => {
              const sel = draft.emoji === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setDraft({ ...draft, emoji: e })}
                  className="tap flex h-10 w-10 items-center justify-center rounded-full text-xl"
                  style={{
                    background: sel ? `${draft.color}33` : 'var(--color-gray-100)',
                    outline: sel ? `2px solid ${draft.color}` : 'none',
                  }}
                >
                  {e}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
            이름 *
          </label>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="예) 제주도 여행"
            className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
              목표 금액 *
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={draft.target || ''}
              onChange={(e) => setDraft({ ...draft, target: Number(e.target.value) || 0 })}
              placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
              현재 금액
            </label>
            <input
              type="number"
              inputMode="numeric"
              value={draft.current || ''}
              onChange={(e) => setDraft({ ...draft, current: Number(e.target.value) || 0 })}
              placeholder="0"
              className="tnum h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
              style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
            목표일
          </label>
          <input
            type="date"
            value={draft.due}
            onChange={(e) => setDraft({ ...draft, due: e.target.value })}
            className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
            색상
          </label>
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
                    outline: sel ? `3px solid ${c}33` : 'none',
                    outlineOffset: 2,
                  }}
                  aria-label={c}
                />
              );
            })}
          </div>
        </div>

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
      </div>
    </div>
  );
}
