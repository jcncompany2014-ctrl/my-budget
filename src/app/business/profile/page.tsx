'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import DecimalInput from '@/components/ui/DecimalInput';
import Section from '@/components/ui/Section';
import type { BusinessProfile } from '@/lib/business-profile';
import { useBusinessProfile } from '@/lib/business-profile';

const TAX_LABELS: Record<BusinessProfile['taxClass'], string> = {
  general: '일반과세자',
  simplified: '간이과세자',
  taxFree: '면세사업자',
};

export default function BusinessProfilePage() {
  const router = useRouter();
  const toast = useToast();
  const { value, set } = useBusinessProfile();
  const [draft, setDraft] = useState<BusinessProfile>(value);

  useEffect(() => {
    setDraft(value);
  }, [value]);

  const save = () => {
    set(draft);
    toast.show('사업자 정보 저장 완료', 'success');
    router.back();
  };

  return (
    <>
      <TopBar
        title="사업자 정보"
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

      <Section title="기본 정보" topGap={4}>
        <div className="space-y-2 rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <Field label="상호명">
            <input
              value={draft.companyName}
              onChange={(e) => setDraft({ ...draft, companyName: e.target.value })}
              placeholder="(주)스튜디오ABC"
              className="h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
          </Field>
          <Field label="대표자">
            <input
              value={draft.ownerName}
              onChange={(e) => setDraft({ ...draft, ownerName: e.target.value })}
              placeholder="홍길동"
              className="h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
          </Field>
          <Field label="사업자등록번호">
            <input
              value={draft.registrationNumber}
              onChange={(e) => setDraft({ ...draft, registrationNumber: e.target.value })}
              placeholder="123-45-67890"
              className="tnum h-12 w-full rounded-xl px-4 outline-none"
              style={{
                background: 'var(--color-gray-100)',
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 500,
              }}
            />
          </Field>
          <Field label="업종">
            <input
              value={draft.industry}
              onChange={(e) => setDraft({ ...draft, industry: e.target.value })}
              placeholder="소매업, 음식점, 서비스업..."
              className="h-12 w-full rounded-xl px-4 outline-none"
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

      <Section title="과세 구분">
        <div className="rounded-2xl p-4" style={{ background: 'var(--color-card)' }}>
          <div className="flex gap-2">
            {(['general', 'simplified', 'taxFree'] as const).map((k) => {
              const sel = draft.taxClass === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setDraft({ ...draft, taxClass: k })}
                  className="tap flex-1 rounded-xl py-3"
                  style={{
                    background: sel ? 'var(--color-primary)' : 'var(--color-gray-100)',
                    color: sel ? '#fff' : 'var(--color-text-2)',
                    fontSize: 'var(--text-xs)',
                    fontWeight: 700,
                  }}
                >
                  {TAX_LABELS[k]}
                </button>
              );
            })}
          </div>
        </div>
      </Section>

      <Section title="수수료율">
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
                    payrollDay: Math.min(31, Math.max(1, Number(e.target.value) || 1)),
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
