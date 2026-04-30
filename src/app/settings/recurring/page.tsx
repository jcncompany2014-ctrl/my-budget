'use client';

import { Repeat } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/ui/EmptyState';
import Sheet from '@/components/ui/Sheet';
import { CATEGORIES } from '@/lib/categories';
import { fmt } from '@/lib/format';
import { daysUntilDay, useRecurring } from '@/lib/recurring';
import type { RecurringItem } from '@/lib/types';

const DEFAULT_EMOJIS = ['🎬', '🎵', '🤖', '▶️', '🌬️', '🏢', '📱', '☁️', '📺', '🎮'];

export default function RecurringSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useRecurring();
  const [editing, setEditing] = useState<RecurringItem | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  const handleSave = (r: RecurringItem) => {
    if (creating) {
      add(r);
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
      emoji: DEFAULT_EMOJIS[Math.floor(Math.random() * DEFAULT_EMOJIS.length)],
      amount: 0,
      day: new Date().getDate(),
      cat: mode === 'business' ? 'biz_etc' : 'subs',
      scope: mode,
    });
    setCreating(true);
  };

  const sorted = [...items].sort(
    (a, b) => daysUntilDay(a.day) - daysUntilDay(b.day),
  );
  const monthlyTotal = items.reduce((s, r) => s + r.amount, 0);

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
          <EmptyState
            icon={Repeat}
            iconColor="#0EA5E9"
            title="정기결제를 추가해 보세요"
            hint="넷플릭스, 통신비, 멤버십 — 매달 자동으로 거래가 만들어집니다"
          />
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
                  <CategoryIcon catId={r.cat} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
                      {r.name}
                    </p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                        매월 {r.day}일
                      </span>
                      <span
                        className="tnum rounded-full px-1.5 py-0.5"
                        style={{
                          background: urgent ? 'var(--color-danger)' : 'var(--color-gray-100)',
                          color: urgent ? '#fff' : 'var(--color-text-3)',
                          fontSize: 10, fontWeight: 800,
                        }}
                      >
                        {daysUntil === 0 ? '오늘' : `D-${daysUntil}`}
                      </span>
                    </div>
                  </div>
                  <p className="tnum text-[15px] font-bold" style={{ color: 'var(--color-text-1)' }}>
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
          onSave={handleSave}
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

function RecurringEditor({
  item,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  item: RecurringItem;
  isNew: boolean;
  onSave: (r: RecurringItem) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(item);
  const valid = draft.name.trim().length > 0 && draft.amount > 0 && draft.day >= 1 && draft.day <= 31;

  const expCats = Object.values(CATEGORIES).filter((c) => c.kind !== 'income');

  return (
    <Sheet open onClose={onCancel}>
        <h2 className="mb-4 text-lg font-bold" style={{ color: 'var(--color-text-1)' }}>
          {isNew ? '정기결제 추가' : '정기결제 편집'}
        </h2>

        <div className="mb-3">
          <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
            이모지
          </label>
          <div className="flex flex-wrap gap-2">
            {DEFAULT_EMOJIS.map((e) => {
              const sel = draft.emoji === e;
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setDraft({ ...draft, emoji: e })}
                  className="tap flex h-10 w-10 items-center justify-center rounded-full text-xl"
                  style={{
                    background: sel ? 'var(--color-primary-soft)' : 'var(--color-gray-100)',
                    border: `2px solid ${sel ? 'var(--color-primary)' : 'transparent'}`,
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
            placeholder="예) 넷플릭스"
            className="h-12 w-full rounded-xl px-4 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </div>

        <div className="mb-3 grid grid-cols-2 gap-2">
          <div>
            <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
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
            <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
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
          <label className="mb-1.5 block text-[13px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
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
                  <span className="text-base">{c.emoji}</span>
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--color-text-2)' }}>
                    {c.name}
                  </span>
                </button>
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
