'use client';

import { Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Money from '@/components/Money';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/ui/EmptyState';
import Sheet from '@/components/ui/Sheet';
import { useEmployees } from '@/lib/employees';
import { fmt } from '@/lib/format';
import type { Employee } from '@/lib/types';

const COLORS = ['#3182F6', '#00B956', '#F472B6', '#FF8A1F', '#8B5CF6', '#14B8A6'];

export default function EmployeesPage() {
  const router = useRouter();
  const toast = useToast();
  const { items, ready, add, update, remove } = useEmployees();
  const [editing, setEditing] = useState<Employee | null>(null);
  const [creating, setCreating] = useState(false);

  if (!ready) return <div className="px-6 py-12 text-center" style={{ color: 'var(--color-text-3)' }}>로딩 중...</div>;
  const totalSalary = items.filter((e) => e.active).reduce((s, e) => s + e.baseSalary, 0);

  const startNew = () => {
    setEditing({
      id: 'emp-' + Date.now().toString(36),
      name: '',
      baseSalary: 0,
      startDate: new Date().toISOString().slice(0, 10),
      active: true,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
    });
    setCreating(true);
  };

  return (
    <>
      <TopBar
        title="직원·인건비"
        right={
          <button type="button" onClick={() => router.back()} className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
            완료
          </button>
        }
      />

      <section className="px-5 pb-3 pt-1">
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)', fontWeight: 500 }}>
            매월 인건비 합계
          </p>
          <Money
            value={totalSalary}
            sign="never"
            className="mt-1 block tracking-tight"
            style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--color-text-1)' }}
          />
          <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
            재직 중 {items.filter((e) => e.active).length}명 / 전체 {items.length}명
          </p>
        </div>
      </section>

      <section className="px-5 pb-3 pt-2">
        {items.length === 0 ? (
          <EmptyState
            icon={Users}
            iconColor="#3182F6"
            title="직원을 추가해 보세요"
            hint="월 기본급을 등록하면 매월 인건비 거래가 자동 생성됩니다"
          />
        ) : (
          <div className="space-y-2">
            {items.map((e) => (
              <button
                key={e.id}
                type="button"
                onClick={() => { setEditing(e); setCreating(false); }}
                className="tap flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left"
                style={{ background: 'var(--color-card)', opacity: e.active ? 1 : 0.55 }}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-bold text-white"
                  style={{ background: e.color, fontSize: 'var(--text-base)' }}>
                  {e.name.slice(0, 1) || '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}>
                    {e.name} {!e.active && <span style={{ fontSize: 'var(--text-xxs)', color: 'var(--color-text-3)', fontWeight: 500 }}>· 퇴사</span>}
                  </p>
                  <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                    {e.position || '직책 미정'}
                  </p>
                </div>
                <Money value={e.baseSalary} sign="never"
                  style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }} />
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
          + 직원 추가
        </button>
      </section>

      {editing && (
        <Editor e={editing} isNew={creating}
          onSave={(e) => {
            if (creating) add(e); else update(e.id, e);
            toast.show(creating ? '직원 추가 완료' : '수정 완료', 'success');
            setEditing(null); setCreating(false);
          }}
          onDelete={creating ? undefined : () => { remove(editing.id); toast.show('삭제 완료', 'info'); setEditing(null); }}
          onCancel={() => { setEditing(null); setCreating(false); }}
        />
      )}
    </>
  );
}

function Editor({ e, isNew, onSave, onDelete, onCancel }: {
  e: Employee; isNew: boolean;
  onSave: (e: Employee) => void; onDelete?: () => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(e);
  const valid = draft.name.trim().length > 0;
  return (
    <Sheet open onClose={onCancel}>
        <h2 className="mb-4" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}>
          {isNew ? '직원 추가' : '직원 편집'}
        </h2>

        <Field label="이름 *">
          <Text value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} placeholder="홍길동" />
        </Field>
        <Field label="직책">
          <Text value={draft.position ?? ''} onChange={(v) => setDraft({ ...draft, position: v })} placeholder="매니저 (선택)" />
        </Field>
        <Field label="월 기본급">
          <input type="number" inputMode="numeric"
            value={draft.baseSalary || ''} onChange={(ev) => setDraft({ ...draft, baseSalary: Number(ev.target.value) || 0 })}
            placeholder="0"
            className="tnum h-12 w-full rounded-xl px-4 outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }}
          />
          <p className="mt-1" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}>
            예상 월 지출: <span className="tnum">{fmt(Math.round(draft.baseSalary * 1.1))}원</span> (4대보험 약 +10%)
          </p>
        </Field>
        <Field label="입사일">
          <input type="date"
            value={draft.startDate} onChange={(ev) => setDraft({ ...draft, startDate: ev.target.value })}
            className="h-12 w-full rounded-xl px-4 outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }}
          />
        </Field>
        <Field label="재직 상태">
          <button type="button" onClick={() => setDraft({ ...draft, active: !draft.active })}
            className="tap flex w-full items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'var(--color-gray-100)' }}>
            <span style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
              {draft.active ? '재직 중' : '퇴사'}
            </span>
            <Switch on={draft.active} />
          </button>
        </Field>

        <div className="flex gap-2">
          {onDelete && <Btn label="삭제" tone="danger" onClick={onDelete} />}
          <Btn label="취소" tone="gray" onClick={onCancel} flex />
          <Btn label="저장" tone="primary" onClick={() => onSave(draft)} flex disabled={!valid} />
        </div>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1.5 block" style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}
function Text({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      className="h-12 w-full rounded-xl px-4 outline-none"
      style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 500 }} />
  );
}
function Switch({ on }: { on: boolean }) {
  return (
    <span className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--color-primary)' : 'var(--color-gray-300)' }}>
      <span className="absolute h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }} />
    </span>
  );
}
function Btn({ label, tone, onClick, flex, disabled }: {
  label: string; tone: 'primary' | 'danger' | 'gray'; onClick: () => void; flex?: boolean; disabled?: boolean;
}) {
  const styles = {
    primary: { bg: disabled ? 'var(--color-gray-200)' : 'var(--color-primary)', color: disabled ? 'var(--color-text-4)' : '#fff' },
    danger: { bg: 'var(--color-danger-soft)', color: 'var(--color-danger)' },
    gray: { bg: 'var(--color-gray-100)', color: 'var(--color-text-1)' },
  }[tone];
  return (
    <button type="button" onClick={onClick} disabled={disabled}
      className={`tap h-12 rounded-xl ${flex ? 'flex-1' : 'px-4'}`}
      style={{ background: styles.bg, color: styles.color, fontSize: 'var(--text-sm)', fontWeight: 700 }}>
      {label}
    </button>
  );
}
