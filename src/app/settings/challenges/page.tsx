'use client';

import { Trophy } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import CategoryIcon from '@/components/icons/CategoryIcon';
import { useMode } from '@/components/ModeProvider';
import Money from '@/components/Money';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import EmptyState from '@/components/ui/EmptyState';
import { IconDisplay, IconPicker } from '@/components/ui/IconPicker';
import Sheet from '@/components/ui/Sheet';
import { CATEGORIES, expenseCategoriesByScope } from '@/lib/categories';
import { useChallenges } from '@/lib/challenges';
import { daysUntilKey, localDayKey } from '@/lib/dates';
import { fmt, isExpense } from '@/lib/format';
import { useAllTransactions } from '@/lib/storage';
import type { Challenge } from '@/lib/types';

export default function ChallengesPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { items, ready, add, update, remove } = useChallenges();
  const { tx } = useAllTransactions();
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);

  if (!ready)
    return (
      <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>
        로딩 중...
      </div>
    );
  const list = items.filter((c) => c.scope === mode);

  const startNew = () => {
    const today = new Date();
    const weekFromNow = new Date(today);
    weekFromNow.setDate(today.getDate() + 7);
    setEditing({
      id: 'ch-' + Date.now().toString(36),
      name: '',
      emoji: 'lucide:Target',
      scope: mode,
      cat: undefined,
      limit: 0,
      startDate: localDayKey(today),
      endDate: localDayKey(weekFromNow),
      active: true,
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title="챌린지"
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
          <EmptyState icon={Trophy} iconColor="#A47148" title="챌린지가 없어요" />
        ) : (
          <div className="space-y-2">
            {list.map((c) => (
              <ChallengeCard
                key={c.id}
                challenge={c}
                tx={tx}
                onEdit={() => {
                  setEditing(c);
                  setCreating(false);
                }}
              />
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
          + 챌린지 추가
        </button>
      </section>

      {editing && (
        <Editor
          c={editing}
          mode={mode}
          isNew={creating}
          onSave={(c) => {
            if (creating) add(c);
            else update(c.id, c);
            toast.show(creating ? '챌린지 추가 완료' : '수정 완료', 'success');
            setEditing(null);
            setCreating(false);
          }}
          onDelete={creating ? undefined : () => setDeleting(true)}
          onCancel={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}

      <ConfirmDialog
        open={deleting && editing !== null}
        title={`'${editing?.name ?? ''}' 챌린지를 삭제할까요?`}
        confirmLabel="삭제"
        danger
        onCancel={() => setDeleting(false)}
        onConfirm={() => {
          if (editing) remove(editing.id);
          toast.show('삭제 완료', 'info');
          setDeleting(false);
          setEditing(null);
        }}
      />
    </>
  );
}

function ChallengeCard({
  challenge,
  tx,
  onEdit,
}: {
  challenge: Challenge;
  tx: { date: string; amount: number; cat: string; scope?: string }[];
  onEdit: () => void;
}) {
  const spent = useMemo(() => {
    // Inclusive local-day range. (Parsing 'YYYY-MM-DD' with new Date() is UTC
    // midnight = 09:00 KST, which dropped the first 9 hours of the start day.)
    return tx
      .filter((t) => {
        if (t.scope && t.scope !== challenge.scope) return false;
        const day = localDayKey(t.date);
        if (day < challenge.startDate || day > challenge.endDate) return false;
        if (challenge.cat && t.cat !== challenge.cat) return false;
        return isExpense(t as { amount: number; cat: string });
      })
      .reduce((s, t) => s + Math.abs(t.amount), 0);
  }, [tx, challenge]);

  const pct = challenge.limit > 0 ? Math.min(100, (spent / challenge.limit) * 100) : 0;
  const exceeded = spent > challenge.limit;
  const untilEnd = daysUntilKey(challenge.endDate);

  return (
    <button
      type="button"
      onClick={onEdit}
      className="tap w-full rounded-2xl px-4 py-4 text-left"
      style={{ background: 'var(--color-card)' }}
    >
      <div className="flex items-center gap-3">
        <IconDisplay value={challenge.emoji} size={26} />
        <div className="flex-1">
          <p
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}
          >
            {challenge.name}
          </p>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
            {challenge.cat ? `${CATEGORIES[challenge.cat]?.name ?? '?'} · ` : ''}
            {untilEnd < 0 ? '종료' : untilEnd === 0 ? '오늘 마감' : `${untilEnd}일 남음`}
          </p>
        </div>
        <div className="text-right">
          <Money
            value={spent}
            sign="never"
            style={{
              color: exceeded ? 'var(--color-danger)' : 'var(--color-text-1)',
              fontSize: 'var(--text-base)',
              fontWeight: 700,
            }}
          />
          <p className="tnum" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
            / {fmt(challenge.limit)}원
          </p>
        </div>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full"
        style={{ background: 'var(--color-gray-150)' }}
      >
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: exceeded
              ? 'var(--color-danger)'
              : pct > 80
                ? 'var(--color-orange-500)'
                : 'var(--color-primary)',
          }}
        />
      </div>
    </button>
  );
}

function Editor({
  c,
  mode,
  isNew,
  onSave,
  onDelete,
  onCancel,
}: {
  c: Challenge;
  mode: 'personal' | 'business';
  isNew: boolean;
  onSave: (c: Challenge) => void;
  onDelete?: () => void;
  onCancel: () => void;
}) {
  const [draft, setDraft] = useState(c);
  const cats = expenseCategoriesByScope(mode);
  const valid = draft.name.trim().length > 0 && draft.limit > 0;
  return (
    <Sheet open onClose={onCancel}>
      <h2
        className="mb-4"
        style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}
      >
        {isNew ? '챌린지 추가' : '챌린지 편집'}
      </h2>

      <Field label="아이콘">
        <IconPicker
          set="challenges"
          value={draft.emoji}
          onChange={(v) => setDraft({ ...draft, emoji: v })}
        />
      </Field>
      <Field label="이름 *">
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="예) 이번 주 식비 5만원"
          className="h-12 w-full rounded-xl px-4 outline-none"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
          }}
        />
      </Field>
      <Field label="카테고리 (선택)">
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setDraft({ ...draft, cat: undefined })}
            className="tap rounded-full px-3 py-1.5"
            style={{
              background: !draft.cat ? 'var(--color-primary)' : 'var(--color-gray-100)',
              color: !draft.cat ? '#fff' : 'var(--color-text-2)',
              fontSize: 'var(--text-xs)',
              fontWeight: 700,
            }}
          >
            전체
          </button>
          {cats.slice(0, 8).map((c) => {
            const sel = draft.cat === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setDraft({ ...draft, cat: c.id })}
                className="tap inline-flex items-center gap-1 rounded-full px-3 py-1.5"
                style={{
                  background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                  color: sel ? '#fff' : 'var(--color-text-2)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                }}
              >
                <CategoryIcon catId={c.id} bare size={13} />
                <span>{c.name}</span>
              </button>
            );
          })}
        </div>
      </Field>
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
      <div className="grid grid-cols-2 gap-2">
        <Field label="시작">
          <input
            type="date"
            value={draft.startDate}
            onChange={(e) => setDraft({ ...draft, startDate: e.target.value })}
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
            }}
          />
        </Field>
        <Field label="종료">
          <input
            type="date"
            value={draft.endDate}
            onChange={(e) => setDraft({ ...draft, endDate: e.target.value })}
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 'var(--text-sm)',
              fontWeight: 500,
            }}
          />
        </Field>
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label
        className="mb-1.5 block"
        style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}
