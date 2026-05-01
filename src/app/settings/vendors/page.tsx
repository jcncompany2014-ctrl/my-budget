'use client';

import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import EmptyState from '@/components/ui/EmptyState';
import Sheet from '@/components/ui/Sheet';
import type { Vendor } from '@/lib/types';
import { useVendors } from '@/lib/vendors';

const COLORS = [
  '#3182F6',
  '#00B956',
  '#F472B6',
  '#FF8A1F',
  '#8B5CF6',
  '#14B8A6',
  '#FFCC00',
  '#EF4444',
];

export default function VendorsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useVendors();
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ready)
    return (
      <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>
        로딩 중...
      </div>
    );
  const list = items.filter((v) => v.scope === mode);

  const startNew = () => {
    setEditing({
      id: 'v-' + Date.now().toString(36),
      name: '',
      scope: mode,
      kind: 'client',
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title="거래처"
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
        {list.length === 0 ? (
          <EmptyState
            icon={Users}
            iconColor="#0EA5E9"
            title="거래처를 추가해 보세요"
            hint="매출처(클라이언트), 매입처(공급자) — 카테고리 자동 매칭에도 활용"
          />
        ) : (
          <div className="space-y-2">
            {list.map((v) => (
              <button
                key={v.id}
                type="button"
                onClick={() => {
                  setEditing(v);
                  setCreating(false);
                }}
                className="tap flex w-full items-center gap-3 rounded-2xl px-4 py-4 text-left"
                style={{ background: 'var(--color-card)' }}
              >
                <div
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white"
                  style={{ background: v.color, fontSize: 'var(--text-base)' }}
                >
                  {v.name.slice(0, 1) || '?'}
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
                    {v.name}
                  </p>
                  <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                    {v.kind === 'client' ? '매출처' : v.kind === 'supplier' ? '매입처' : '양쪽'}
                    {v.contact ? ` · ${v.contact}` : ''}
                  </p>
                </div>
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
          style={{
            borderColor: 'var(--color-gray-300)',
            color: 'var(--color-text-2)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          + 거래처 추가
        </button>
      </section>

      {editing && (
        <Editor
          v={editing}
          isNew={creating}
          onSave={(v) => {
            if (creating) add(v);
            else update(v.id, v);
            toast.show(creating ? '거래처 추가 완료' : '수정 완료', 'success');
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
  v,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  v: Vendor;
  isNew: boolean;
  onSave: (v: Vendor) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(v);
  const valid = draft.name.trim().length > 0;

  return (
    <Sheet open onClose={onCancel}>
      <h2
        className="mb-4"
        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}
      >
        {isNew ? '거래처 추가' : '거래처 편집'}
      </h2>

      <div className="mb-3">
        <label
          className="mb-1.5 block"
          style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
        >
          이름 *
        </label>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="예) (주)스튜디오ABC"
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </div>

      <div className="mb-3">
        <label
          className="mb-1.5 block"
          style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
        >
          구분
        </label>
        <div className="flex gap-2">
          {(['client', 'supplier', 'both'] as const).map((k) => {
            const sel = draft.kind === k;
            return (
              <button
                key={k}
                type="button"
                onClick={() => setDraft({ ...draft, kind: k })}
                className="tap flex-1 rounded-xl py-3"
                style={{
                  background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                  color: sel ? '#fff' : 'var(--color-text-2)',
                  fontSize: 'var(--text-sm)',
                  fontWeight: 700,
                }}
              >
                {k === 'client' ? '매출처' : k === 'supplier' ? '매입처' : '양쪽'}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mb-3">
        <label
          className="mb-1.5 block"
          style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
        >
          연락처
        </label>
        <input
          value={draft.contact ?? ''}
          onChange={(e) => setDraft({ ...draft, contact: e.target.value })}
          placeholder="전화·이메일 (선택)"
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </div>

      <div className="mb-4">
        <label
          className="mb-1.5 block"
          style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
        >
          색상
        </label>
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
                  draft.color === c ? `0 0 0 2px var(--color-card), 0 0 0 5px ${c}33` : 'none',
              }}
              aria-label={c}
            />
          ))}
        </div>
      </div>

      <div className="flex gap-2">
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
