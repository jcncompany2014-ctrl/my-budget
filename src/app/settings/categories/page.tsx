'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { CATEGORIES, expenseCategoriesByScope, incomeCategoriesByScope } from '@/lib/categories';
import { useCustomCategories } from '@/lib/customCategories';
import type { CustomCategory } from '@/lib/types';

const COLORS = ['#FF8A1F', '#A47148', '#3182F6', '#F472B6', '#14B8A6', '#EF4444', '#EC4899', '#8B5CF6', '#F59E0B', '#06B6D4', '#4F46E5', '#0EA5E9', '#94A3B8', '#1FBA6E'];
const EMOJIS = ['💰', '🍕', '🎁', '🎮', '📦', '🚗', '🏠', '🎵', '✈️', '⚡', '💼', '🛒', '👶', '🎓', '🏥', '🧧'];

export default function CategoriesPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useCustomCategories();

  const [editing, setEditing] = useState<CustomCategory | null>(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<'expense' | 'income'>('expense');

  const builtinExpense = useMemo(() => expenseCategoriesByScope(mode), [mode]);
  const builtinIncome = useMemo(() => incomeCategoriesByScope(mode), [mode]);
  const customExpense = items.filter((c) => c.scope === mode && c.kind !== 'income');
  const customIncome = items.filter((c) => c.scope === mode && c.kind === 'income');

  const visible = tab === 'expense'
    ? { builtin: builtinExpense, custom: customExpense }
    : { builtin: builtinIncome, custom: customIncome };

  if (!ready) return <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>로딩 중...</div>;

  const startNew = () => {
    setEditing({
      id: 'cc-' + Date.now().toString(36),
      name: '',
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      scope: mode,
      kind: tab === 'income' ? 'income' : undefined,
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title="카테고리"
        right={
          <button type="button" onClick={() => router.back()} className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            완료
          </button>
        }
      />

      <section className="px-5 pb-3 pt-1">
        <div className="flex rounded-full p-[3px]" style={{ background: 'var(--color-gray-100)' }}>
          {(['expense', 'income'] as const).map((k) => {
            const sel = tab === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setTab(k)}
                className="tap flex-1 rounded-full py-2"
                style={{
                  background: sel ? 'var(--color-card)' : 'transparent',
                  color: sel ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  boxShadow: sel ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                {mode === 'business' ? (k === 'expense' ? '비용' : '매출') : k === 'expense' ? '지출' : '수입'}
              </button>
            );
          })}
        </div>
      </section>

      {visible.custom.length > 0 && (
        <section className="px-5 pb-3 pt-2">
          <h2 className="mb-2" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            내 카테고리
          </h2>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {visible.custom.map((c, i) => (
              <button
                key={c.id}
                type="button"
                onClick={() => { setEditing(c); setCreating(false); }}
                className="tap flex w-full items-center gap-3 px-4 py-3 text-left"
                style={{ borderBottom: i < visible.custom.length - 1 ? '1px solid var(--color-divider)' : 'none' }}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                  style={{ background: `${c.color}1f` }}>
                  {c.emoji}
                </div>
                <div className="flex-1">
                  <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                    {c.name}
                  </p>
                  {c.parent && CATEGORIES[c.parent] && (
                    <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
                      ↳ {CATEGORIES[c.parent].name} 하위
                    </p>
                  )}
                </div>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                  <path d="M9 6l6 6-6 6" stroke="var(--color-text-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="px-5 pb-3 pt-2">
        <h2 className="mb-2" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          기본 카테고리
        </h2>
        <div className="grid grid-cols-4 gap-2">
          {visible.builtin.map((c) => (
            <div key={c.id}
              className="flex flex-col items-center gap-1.5 rounded-2xl px-1 py-3"
              style={{ background: 'var(--color-gray-100)' }}
            >
              <CategoryIcon catId={c.id} size={32} />
              <span style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xxs)', fontWeight: 600 }}>
                {c.name}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="px-5 pb-10 pt-2">
        <button
          type="button"
          onClick={startNew}
          className="tap w-full rounded-2xl border-2 border-dashed py-4"
          style={{ borderColor: 'var(--color-gray-300)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
        >
          + 카테고리 추가 ({tab === 'expense' ? '지출' : '수입'})
        </button>
      </section>

      {editing && (
        <CategoryEditor
          c={editing}
          parents={tab === 'expense' ? builtinExpense : builtinIncome}
          isNew={creating}
          onSave={(c) => {
            if (creating) add(c); else update(c.id, c);
            toast.show(creating ? '카테고리 추가 완료' : '수정 완료', 'success');
            setEditing(null); setCreating(false);
          }}
          onDelete={creating ? undefined : () => { remove(editing.id); toast.show('삭제 완료', 'info'); setEditing(null); }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </>
  );
}

function CategoryEditor({ c, parents, isNew, onSave, onDelete, onCancel }: {
  c: CustomCategory;
  parents: { id: string; name: string; emoji: string }[];
  isNew: boolean;
  onSave: (c: CustomCategory) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(c);
  const valid = draft.name.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <div
        className="max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl p-6"
        style={{ background: 'var(--color-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--color-gray-200)' }} />
        <h2 className="mb-4" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
          {isNew ? '카테고리 추가' : '카테고리 편집'}
        </h2>

        <div className="mb-3">
          <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>이모지</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.length && EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setDraft({ ...draft, emoji: e })}
                className="tap flex h-10 w-10 items-center justify-center rounded-full text-xl"
                style={{
                  background: draft.emoji === e ? `${draft.color}33` : 'var(--color-gray-100)',
                  outline: draft.emoji === e ? `2px solid ${draft.color}` : 'none',
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>이름 *</label>
          <input
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="예) 와인"
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }}
          />
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
            상위 카테고리 (선택)
          </label>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setDraft({ ...draft, parent: undefined })}
              className="tap rounded-full px-3 py-1.5"
              style={{
                background: !draft.parent ? 'var(--color-primary)' : 'var(--color-gray-100)',
                color: !draft.parent ? '#fff' : 'var(--color-text-2)',
                fontSize: 'var(--text-xs)',
                fontWeight: 700,
              }}
            >
              없음
            </button>
            {parents.map((p) => {
              const sel = draft.parent === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraft({ ...draft, parent: p.id })}
                  className="tap rounded-full px-3 py-1.5"
                  style={{
                    background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                    color: sel ? '#fff' : 'var(--color-text-2)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                  }}
                >
                  {p.emoji} {p.name}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>색상</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((cc) => (
              <button
                key={cc}
                type="button"
                onClick={() => setDraft({ ...draft, color: cc })}
                className="tap h-9 w-9 rounded-full"
                style={{
                  background: cc,
                  outline: draft.color === cc ? `3px solid ${cc}33` : 'none',
                  outlineOffset: 2,
                }}
                aria-label={cc}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-2">
          {onDelete && (
            <button type="button" onClick={onDelete} className="tap h-12 rounded-xl px-4"
              style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              삭제
            </button>
          )}
          <button type="button" onClick={onCancel} className="tap h-12 flex-1 rounded-xl"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            취소
          </button>
          <button type="button" disabled={!valid} onClick={() => onSave(draft)} className="tap h-12 flex-1 rounded-xl"
            style={{
              background: valid ? 'var(--color-primary)' : 'var(--color-gray-200)',
              color: valid ? '#fff' : 'var(--color-text-4)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
            }}>
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
