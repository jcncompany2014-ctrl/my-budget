'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import { useLocations } from '@/lib/locations';
import type { BusinessLocation } from '@/lib/types';

const COLORS = ['#3182F6', '#00B956', '#F472B6', '#FF8A1F', '#8B5CF6', '#14B8A6'];
const EMOJIS = ['🏪', '🏢', '🏬', '🏭', '🏨', '🏠', '🍴', '☕'];

export default function LocationsPage() {
  const router = useRouter();
  const toast = useToast();
  const { items, ready, add, update, remove, activeId, setActive } = useLocations();
  const [editing, setEditing] = useState<BusinessLocation | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ready) return <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>로딩 중...</div>;

  const startNew = () => {
    setEditing({
      id: 'loc-' + Date.now().toString(36),
      name: '',
      emoji: EMOJIS[Math.floor(Math.random() * EMOJIS.length)],
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      active: true,
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title="사업장"
        right={
          <button type="button" onClick={() => router.back()} className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            완료
          </button>
        }
      />

      <section className="px-5 pb-3 pt-1">
        {items.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center" style={{ background: 'var(--color-card)' }}>
            <p className="text-3xl">🏪</p>
            <p className="mt-2" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              사업장을 추가하면 매장별로 분리할 수 있어요
            </p>
            <p className="mt-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
              매장 A, 매장 B처럼 등록하고 거래에 태그하세요
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setActive(null)}
              className="tap flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
              style={{
                background: !activeId ? 'var(--color-primary-soft)' : 'var(--color-card)',
                outline: !activeId ? '2px solid var(--color-primary)' : 'none',
              }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full"
                  style={{ background: 'var(--color-gray-150)' }}>🌐</div>
                <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                  전체 (사업장 무관)
                </span>
              </div>
              {!activeId && <span style={{ color: 'var(--color-primary)', fontSize: 'var(--text-xs)', fontWeight: 700 }}>활성</span>}
            </button>
            {items.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => { setEditing(l); setCreating(false); }}
                onDoubleClick={() => setActive(l.id)}
                className="tap flex w-full items-center justify-between rounded-2xl px-4 py-3 text-left"
                style={{
                  background: activeId === l.id ? `${l.color}1f` : 'var(--color-card)',
                  outline: activeId === l.id ? `2px solid ${l.color}` : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full text-lg"
                    style={{ background: `${l.color}33` }}>{l.emoji}</div>
                  <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 600 }}>
                    {l.name}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setActive(activeId === l.id ? null : l.id); }}
                  className="tap rounded-full px-3 py-1"
                  style={{
                    background: activeId === l.id ? l.color : 'var(--color-gray-100)',
                    color: activeId === l.id ? '#fff' : 'var(--color-text-2)',
                    fontSize: 'var(--text-xxs)',
                    fontWeight: 700,
                  }}
                >
                  {activeId === l.id ? '활성' : '활성화'}
                </button>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="px-5 pb-10 pt-2">
        <button
          type="button"
          onClick={startNew}
          className="tap w-full rounded-2xl border-2 border-dashed py-4"
          style={{ borderColor: 'var(--color-gray-300)', color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
        >
          + 사업장 추가
        </button>
      </section>

      {editing && (
        <Editor l={editing} isNew={creating}
          onSave={(l) => {
            if (creating) add(l); else update(l.id, l);
            toast.show(creating ? '사업장 추가 완료' : '수정 완료', 'success');
            setEditing(null); setCreating(false);
          }}
          onDelete={creating ? undefined : () => { remove(editing.id); toast.show('삭제 완료', 'info'); setEditing(null); }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </>
  );
}

function Editor({ l, isNew, onSave, onDelete, onCancel }: {
  l: BusinessLocation; isNew: boolean;
  onSave: (l: BusinessLocation) => void; onDelete?: () => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(l);
  const valid = draft.name.trim().length > 0;
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40">
      <div className="max-h-[88dvh] w-full max-w-[440px] overflow-y-auto rounded-t-3xl p-6"
        style={{ background: 'var(--color-card)', paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)' }}>
        <div className="mx-auto mb-4 h-1 w-10 rounded-full" style={{ background: 'var(--color-gray-200)' }} />
        <h2 className="mb-4" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
          {isNew ? '사업장 추가' : '사업장 편집'}
        </h2>

        <div className="mb-3">
          <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>이모지</label>
          <div className="flex flex-wrap gap-2">
            {EMOJIS.map((e) => (
              <button key={e} type="button" onClick={() => setDraft({ ...draft, emoji: e })}
                className="tap flex h-10 w-10 items-center justify-center rounded-full text-xl"
                style={{
                  background: draft.emoji === e ? `${draft.color}33` : 'var(--color-gray-100)',
                  outline: draft.emoji === e ? `2px solid ${draft.color}` : 'none',
                }}>{e}</button>
            ))}
          </div>
        </div>

        <div className="mb-3">
          <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>이름 *</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="예) 강남점"
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
        </div>

        <div className="mb-4">
          <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>색상</label>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button key={c} type="button" onClick={() => setDraft({ ...draft, color: c })}
                className="tap h-9 w-9 rounded-full"
                style={{
                  background: c,
                  outline: draft.color === c ? `3px solid ${c}33` : 'none',
                  outlineOffset: 2,
                }}
                aria-label={c} />
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
