'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import DecimalInput from '@/components/ui/DecimalInput';
import Section from '@/components/ui/Section';
import type { BusinessProfile } from '@/lib/business-profile';
import { useBusinessProfile } from '@/lib/business-profile';

export default function BusinessProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { value, set } = useBusinessProfile();
  const [draft, setDraft] = useState<BusinessProfile>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = () => {
    const next = { ...draft };
    // Paydays count from the moment auto payroll is switched on — not from the
    // next time the app happens to be opened, which could be after the first one.
    if (!next.autoPayroll) delete next.payrollPostedThrough;
    else if (!value.autoPayroll || !next.payrollPostedThrough) {
      next.payrollPostedThrough = new Date().toISOString();
    }
    set(next);
    toast.show('저장 완료', 'success');
    router.back();
  };

  return (
    <>
      <TopBar
        title="수수료 · 인건비"
        right={
          <button
            type="button"
            onClick={save}
            className="tap rounded-full px-3 py-2"
            style={{ color: 'var(--color-primary)', fontSize: 'var(--text-sm)', fontWeight: 700 }}
          >
            저장
          </button>
        }
      />

      <Section title="수수료율" topGap={4}>
        <div className="space-y-2 rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <Field label="카드 수수료 (%)">
            <DecimalInput
              value={draft.cardFeeRate}
              onChange={(n) => setDraft({ ...draft, cardFeeRate: n })}
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
          </Field>
          <Field label="배달앱 수수료 (%)">
            <DecimalInput
              value={draft.deliveryFeeRate}
              onChange={(n) => setDraft({ ...draft, deliveryFeeRate: n })}
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
          </Field>
          <Field label="4대보험 부담률 (%)">
            <DecimalInput
              value={draft.socialInsuranceRate}
              onChange={(n) => setDraft({ ...draft, socialInsuranceRate: n })}
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
          </Field>
        </div>
      </Section>

      <Section title="자동 인건비 발생" bottomGap={40}>
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, autoPayroll: !draft.autoPayroll })}
            className="tap flex w-full items-center justify-between rounded-xl px-4 py-3"
            style={{ background: 'var(--color-gray-100)' }}
          >
            <span
              style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}
            >
              매월 자동으로 인건비 거래 생성
            </span>
            <Switch on={draft.autoPayroll} />
          </button>
          {draft.autoPayroll && (
            <Field label="자동 발생일 (1~31)">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                value={draft.payrollDay || ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    // Empty while retyping; an empty day falls back to the 25th when posting.
                    payrollDay: Math.min(31, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
                placeholder="25"
                className="tnum h-12 w-full rounded-xl px-4 outline-none"
                style={{
                  background: 'var(--color-gray-100)',
                  color: 'var(--color-text-1)',
                  fontSize: 'var(--text-base)',
                  fontWeight: 500,
                }}
              />
            </Field>
          )}
        </div>
      </Section>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="mb-1.5 block"
        style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', fontWeight: 600 }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--color-primary)' : 'var(--color-gray-300)' }}
    >
      <span
        className="absolute h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </span>
  );
}
