'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useBudgets } from '@/lib/budgets';
import { expenseCategoriesByScope } from '@/lib/categories';
import { fmt } from '@/lib/format';
import type { Category } from '@/lib/types';

export default function BudgetsSettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { budgets, ready, set, remove } = useBudgets();
  const [editing, setEditing] = useState<Category | null>(null);

  const cats = useMemo(() => expenseCategoriesByScope(mode), [mode]);

  if (!ready) {
    return (
      <div className="flex h-[calc(100dvh-68px)] items-center justify-center">
        <span style={{ color: 'var(--color-text-3)' }}>로딩 중...</span>
      </div>
    );
  }

  return (
    <>
      <TopBar
        title="예산 설정"
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
        <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
          {mode === 'business' ? '사업 카테고리' : '개인 카테고리'}별로 한 달 한도를 정해두세요.
        </p>
      </section>

      <section className="px-5 pb-10 pt-2">
        <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
          {cats.map((c, i) => {
            const limit = budgets[c.id]?.limit ?? 0;
            const has = limit > 0;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setEditing(c)}
                className="tap flex w-full items-center gap-3 px-4 py-3 text-left"
                style={{ borderBottom: i < cats.length - 1 ? '1px solid var(--color-divider)' : 'none' }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-lg"
                  style={{ background: `${c.color}1f` }}
                >
                  {c.emoji}
                </div>
                <div className="flex-1">
                  <p className="text-[15px] font-semibold" style={{ color: 'var(--color-text-1)' }}>
                    {c.name}
                  </p>
                  <p
                    className="text-xs"
                    style={{ color: has ? 'var(--color-text-2)' : 'var(--color-text-3)' }}
                  >
                    {has ? `${fmt(limit)}원 / 월` : '예산 미설정'}
                  </p>
                </div>
                <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
                  <path
                    d="M9 6l6 6-6 6"
                    stroke="var(--color-text-3)"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            );
          })}
        </div>
      </section>

      {editing && (
        <BudgetEditor
          category={editing}
          current={budgets[editing.id]?.limit ?? 0}
          onSave={(v) => {
            if (v <= 0) remove(editing.id);
            else set(editing.id, v);
            toast.show('저장 완료', 'success');
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      )}
    </>
  );
}

function BudgetEditor({
  category,
  current,
  onSave,
  onCancel,
}: {
  category: Category;
  current: number;
  onSave: (v: number) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(current ? String(current) : '');

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <div
        className="w-full max-w-[440px] rounded-t-3xl p-6"
        style={{ background: 'var(--color-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--color-gray-200)' }} />
        <div className="mb-4 flex items-center gap-3">
          <div
            className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
            style={{ background: `${category.color}1f` }}
          >
            {category.emoji}
          </div>
          <div>
            <p className="text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
              {category.name}
            </p>
            <p className="text-xs" style={{ color: 'var(--color-text-3)' }}>
              한 달 한도 (원)
            </p>
          </div>
        </div>

        <input
          autoFocus
          type="number"
          inputMode="numeric"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="0"
          className="tnum h-14 w-full rounded-xl px-4 text-[20px] font-bold outline-none"
          style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
        />
        <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-3)' }}>
          0으로 두거나 비우면 예산이 해제돼요
        </p>

        <div className="mt-4 flex gap-2">
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
            onClick={() => onSave(Number(value) || 0)}
            className="tap h-12 flex-1 rounded-xl text-sm font-bold"
            style={{ background: 'var(--color-primary)', color: '#fff' }}
          >
            저장
          </button>
        </div>
      </div>
    </div>
  );
}
