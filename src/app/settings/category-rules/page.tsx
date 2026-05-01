'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { useMode } from '@/components/ModeProvider';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import { CATEGORIES, expenseCategoriesByScope, incomeCategoriesByScope } from '@/lib/categories';
import type { CategoryRule } from '@/lib/category-rules';
import { useCategoryRules } from '@/lib/category-rules';

export default function CategoryRulesPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useCategoryRules();

  const cats = useMemo(
    () => [...expenseCategoriesByScope(mode), ...incomeCategoriesByScope(mode)],
    [mode],
  );
  const [matchInput, setMatchInput] = useState('');
  const [pickedCat, setPickedCat] = useState(cats[0]?.id ?? '');

  if (!ready)
    return (
      <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>
        로딩 중...
      </div>
    );

  const handleAdd = () => {
    if (!matchInput.trim() || !pickedCat) return;
    add({
      id: 'rule-' + Date.now().toString(36),
      match: matchInput.trim(),
      cat: pickedCat,
    });
    setMatchInput('');
    toast.show('규칙 추가됨', 'success');
  };

  const updateMatch = (id: string, val: string) => update(id, { match: val });
  const updateCat = (id: string, cat: string) => update(id, { cat });

  return (
    <>
      <TopBar
        title="카테고리 규칙"
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
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          소비처 이름에 특정 단어가 들어가면 자동으로 카테고리를 적용합니다. 예){' '}
          <span style={{ color: 'var(--color-text-2)', fontWeight: 700 }}>이마트 → 쇼핑</span>
        </p>
      </section>

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <p
            className="mb-2"
            style={{
              color: 'var(--color-text-2)',
              fontSize: 'var(--text-xxs)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            새 규칙
          </p>
          <div className="space-y-2">
            <input
              value={matchInput}
              onChange={(e) => setMatchInput(e.target.value)}
              placeholder='소비처에 포함될 단어 (예: "이마트")'
              className="h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
            <select
              value={pickedCat}
              onChange={(e) => setPickedCat(e.target.value)}
              className="h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAdd}
              disabled={!matchInput.trim()}
              className="tap h-12 w-full rounded-xl"
              style={{
                background: matchInput.trim() ? 'var(--color-primary)' : 'var(--color-gray-200)',
                color: matchInput.trim() ? '#fff' : 'var(--color-text-4)',
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
              }}
            >
              규칙 추가
            </button>
          </div>
        </div>
      </section>

      <section className="px-5 pb-10 pt-2">
        {items.length === 0 ? (
          <div
            className="rounded-2xl px-6 py-12 text-center"
            style={{ background: 'var(--color-card)' }}
          >
            <p style={{ fontSize: 32, lineHeight: 1 }}>📐</p>
            <p
              className="mt-2"
              style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
            >
              규칙이 없어요
            </p>
            <p
              className="mt-1"
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
            >
              위에서 첫 규칙을 추가하세요
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {items.map((r: CategoryRule, i: number) => {
              const _c = CATEGORIES[r.cat];
              return (
                <div
                  key={r.id}
                  className="flex items-center gap-3 px-4 py-3"
                  style={{
                    borderBottom: i < items.length - 1 ? '1px solid var(--color-divider)' : 'none',
                  }}
                >
                  <input
                    value={r.match}
                    onChange={(e) => updateMatch(r.id, e.target.value)}
                    className="flex-1 rounded-lg px-3 py-2 outline-none"
                    style={{
                      background: 'var(--color-gray-100)',
                      color: 'var(--color-text-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                    }}
                  />
                  <span style={{ color: 'var(--color-text-3)' }}>→</span>
                  <select
                    value={r.cat}
                    onChange={(e) => updateCat(r.id, e.target.value)}
                    className="rounded-lg px-2 py-2 outline-none"
                    style={{
                      background: 'var(--color-gray-100)',
                      color: 'var(--color-text-1)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: 600,
                      maxWidth: 120,
                    }}
                  >
                    {cats.map((cc) => (
                      <option key={cc.id} value={cc.id}>
                        {cc.emoji} {cc.name}
                      </option>
                    ))}
                  </select>
                  <CategoryIcon catId={r.cat} size={28} />
                  <button
                    type="button"
                    onClick={() => {
                      remove(r.id);
                      toast.show('규칙 삭제', 'info');
                    }}
                    className="tap flex h-8 w-8 items-center justify-center rounded-full"
                    style={{ background: 'var(--color-danger-soft)', color: 'var(--color-danger)' }}
                    aria-label="삭제"
                  >
                    ×
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
