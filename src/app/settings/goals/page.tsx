'use client';

import { Target } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/ui/EmptyState';
import Sheet from '@/components/ui/Sheet';
import { useGoals } from '@/lib/goals';
import { fmt } from '@/lib/format';
import type { SavingsGoal } from '@/lib/types';

const COLORS = ['#00B956', '#3182F6', '#F472B6', '#FF8A1F', '#8B5CF6', '#14B8A6', '#FFCC00', '#EF4444', '#06B6D4'];
const EMOJIS = ['🎯', '🏝️', '💻', '🛟', '🚗', '🏠', '✈️', '💍', '🎓', '👶'];

export default function GoalsSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
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
      scope: mode,
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
          <EmptyState
            icon={Target}
            iconColor="#1FBA6E"
            title="아직 목표가 없어요"
            hint="제주도 여행, 비상금, 노트북 같은 목표를 만들고 진행률을 추적해보세요"
          />
        ) : (
          <div className="space-y-2">
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((g.current / g.target) * 100));
              const completed = pct >= 100;
              const remaining = Math.max(0, g.target - g.current);
              const dueDate = g.due ? new Date(g.due) : null;
              const daysUntil = dueDate
                ? Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                : null;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => {
                    setEditing(g);
                    setCreating(false);
                  }}
                  className="tap w-full overflow-hidden rounded-2xl p-4 text-left"
                  style={{
                    background: 'var(--color-card)',
                    position: 'relative',
                  }}
                >
                  {completed && (
                    <div aria-hidden style={{
                      position: 'absolute', inset: 0,
                      background: `radial-gradient(120% 80% at 100% 0%, ${g.color}1a 0%, transparent 70%)`,
                      pointerEvents: 'none',
                    }} />
                  )}
                  <div className="relative flex items-center gap-3">
                    <div
                      className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                      style={{ background: `${g.color}1f` }}
                    >
                      {g.emoji}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
                          {g.name}
                        </p>
                        {completed && (
                          <span style={{
                            background: g.color,
                            color: '#fff',
                            fontSize: 9, fontWeight: 800, letterSpacing: '0.02em',
                            padding: '2px 6px', borderRadius: 999,
                          }}>
                            달성
                          </span>
                        )}
                      </div>
                      <p className="tnum mt-0.5 text-xs" style={{ color: 'var(--color-text-3)' }}>
                        <span style={{ color: g.color, fontWeight: 800 }}>{fmt(g.current)}</span>
                        {' / '}
                        {fmt(g.target)}원
                        {!completed && daysUntil != null && daysUntil > 0 && (
                          <span> · D-{daysUntil}</span>
                        )}
                        {!completed && daysUntil != null && daysUntil <= 0 && (
                          <span style={{ color: 'var(--color-danger)', fontWeight: 700 }}> · 기한 지남</span>
                        )}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="tnum tracking-tight" style={{
                        color: g.color, fontSize: 22, fontWeight: 900, letterSpacing: '-0.025em', lineHeight: 1,
                      }}>
                        {pct}<span style={{ fontSize: 12, marginLeft: 1 }}>%</span>
                      </p>
                      {!completed && remaining > 0 && (
                        <p className="tnum mt-0.5" style={{
                          color: 'var(--color-text-3)', fontSize: 10, fontWeight: 600,
                        }}>
                          {fmt(remaining)} 남음
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className="relative mt-3 h-2 overflow-hidden rounded-full"
                    style={{ background: 'var(--color-gray-150)' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${pct}%`,
                        background: completed
                          ? `linear-gradient(90deg, ${g.color}, ${g.color}dd)`
                          : g.color,
                        transition: 'width 700ms cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
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
    <Sheet open onClose={onCancel}>
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
                    border: `2px solid ${sel ? draft.color : 'transparent'}`,
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
                    boxShadow: sel ? `0 0 0 2px var(--color-card), 0 0 0 5px ${c}33` : 'none',
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
    </Sheet>
  );
}
