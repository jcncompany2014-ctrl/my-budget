'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useTheme } from '@/components/ThemeProvider';
import { useToast } from '@/components/Toast';
import { clearAll, downloadBackup, importBackup } from '@/lib/backup';
import { useProfile } from '@/lib/profile';

export default function SettingsPage() {
  const router = useRouter();
  const { theme, toggle } = useTheme();
  const toast = useToast();
  const { profile, setName } = useProfile();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<null | 'reset'>(null);
  const [nameDraft, setNameDraft] = useState(profile.name);

  useEffect(() => {
    setNameDraft(profile.name);
  }, [profile.name]);

  const onImport = async (file: File) => {
    try {
      const r = await importBackup(file);
      toast.show(`거래 ${r.transactions}건 복원 완료`, 'success');
      window.location.reload();
    } catch (e) {
      toast.show(e instanceof Error ? e.message : '복원 실패', 'error');
    }
  };

  return (
    <>
      <TopBar
        title="설정"
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

      <Section title="프로필">
        <div className="px-4 py-3.5">
          <label className="mb-1.5 block text-[12px] font-semibold" style={{ color: 'var(--color-text-3)' }}>
            이름
          </label>
          <input
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={() => {
              if (nameDraft !== profile.name) {
                setName(nameDraft.trim());
                toast.show('이름 저장 완료', 'success');
              }
            }}
            placeholder="홈 화면에 표시될 이름"
            className="h-11 w-full rounded-xl px-3 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </div>
      </Section>

      {/* Appearance */}
      <Section title="외관">
        <Row
          label="다크 모드"
          subtitle={theme === 'dark' ? '켜짐' : '꺼짐'}
          onClick={toggle}
          right={
            <Switch on={theme === 'dark'} />
          }
        />
      </Section>

      <Section title="관리">
        <Row label="계좌 관리" subtitle="은행, 카드, 현금, 투자 계좌" onClick={() => router.push('/settings/accounts')} />
        <Row label="예산 설정" subtitle="카테고리별 한 달 한도" onClick={() => router.push('/settings/budgets')} />
        <Row label="저축 목표" subtitle="목표 만들고 추적" onClick={() => router.push('/settings/goals')} />
        <Row label="정기결제" subtitle="구독·통신비·멤버십" onClick={() => router.push('/settings/recurring')} />
        <Row label="대출 관리" subtitle="원리금·이자율·만기" onClick={() => router.push('/settings/loans')} />
        <Row label="투자 관리" subtitle="주식·펀드·암호화폐" onClick={() => router.push('/settings/investments')} />
        <Row label="카테고리" subtitle="커스텀 카테고리 추가/편집" onClick={() => router.push('/settings/categories')} />
        <Row label="즐겨찾기 거래" subtitle="자주 쓰는 거래" onClick={() => router.push('/settings/favorites')} />
        <Row label="챌린지" subtitle="지출 한도 챌린지" onClick={() => router.push('/settings/challenges')} />
      </Section>

      <Section title="사업자 (사업 모드)">
        <Row label="거래처" subtitle="매출처·매입처 등록" onClick={() => router.push('/settings/vendors')} />
        <Row label="직원·인건비" subtitle="월 기본급 자동 집계" onClick={() => router.push('/settings/employees')} />
        <Row label="사업장" subtitle="매장 A/B 분리 관리" onClick={() => router.push('/settings/locations')} />
      </Section>

      <Section title="리포트">
        <Row label="이번 달 리포트" subtitle="카테고리별 분석 + CSV/PDF" onClick={() => router.push('/reports/monthly')} />
        <Row label="연간 리포트" subtitle="올해의 가게 TOP 5" onClick={() => router.push('/reports/yearly')} />
      </Section>

      <Section title="데이터">
        <Row
          label="백업 내보내기"
          subtitle="JSON 파일로 저장"
          onClick={() => {
            downloadBackup();
            toast.show('백업 파일을 저장했어요', 'success');
          }}
        />
        <Row
          label="백업 복원하기"
          subtitle="JSON 파일에서 가져오기"
          onClick={() => fileInput.current?.click()}
        />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onImport(f);
            e.target.value = '';
          }}
        />
        <Row
          label="모든 데이터 초기화"
          subtitle="되돌릴 수 없어요"
          danger
          onClick={() => setConfirming('reset')}
        />
      </Section>

      <Section title="앱 정보">
        <Row label="버전" subtitle="0.1.0 · 로컬 저장소" />
      </Section>

      {confirming === 'reset' && (
        <ConfirmSheet
          title="모든 데이터를 초기화할까요?"
          description="저장된 모든 거래가 사라져요. 백업 파일이 있으면 복원할 수 있어요."
          confirmLabel="초기화"
          danger
          onCancel={() => setConfirming(null)}
          onConfirm={() => {
            clearAll();
            toast.show('초기화 완료', 'info');
            setConfirming(null);
            window.location.replace('/');
          }}
        />
      )}
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 pb-2 pt-4">
      <h2 className="mb-2 text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-3)' }}>
        {title}
      </h2>
      <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
        {children}
      </div>
    </section>
  );
}

function Row({
  label,
  subtitle,
  onClick,
  right,
  danger,
}: {
  label: string;
  subtitle?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
}) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="tap flex w-full items-center justify-between px-4 py-4 text-left"
      style={{ borderBottom: '1px solid var(--color-divider)' }}
    >
      <div>
        <p
          className="text-[15px] font-semibold"
          style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text-1)' }}
        >
          {label}
        </p>
        {subtitle && (
          <p className="mt-0.5 text-xs" style={{ color: 'var(--color-text-3)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {right ?? (onClick && (
        <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
          <path d="M9 6l6 6-6 6" stroke="var(--color-text-3)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
    </Component>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex h-7 w-12 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--color-primary)' : 'var(--color-gray-300)' }}
    >
      <span
        className="absolute h-6 w-6 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </span>
  );
}

function ConfirmSheet({
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/40 px-4 pb-6">
      <div
        className="w-full max-w-[380px] rounded-3xl p-6"
        style={{ background: 'var(--color-card)' }}
      >
        <p className="mb-1 text-base font-bold" style={{ color: 'var(--color-text-1)' }}>
          {title}
        </p>
        <p className="mb-5 text-sm" style={{ color: 'var(--color-text-3)' }}>
          {description}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="tap h-12 flex-1 rounded-2xl text-sm font-bold"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="tap h-12 flex-1 rounded-2xl text-sm font-bold"
            style={{
              background: danger ? 'var(--color-danger)' : 'var(--color-primary)',
              color: '#fff',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
