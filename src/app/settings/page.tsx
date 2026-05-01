'use client';

import {
  AlertTriangle,
  ArrowDownLeft,
  BadgeCheck,
  Banknote,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  Coins,
  CreditCard,
  DoorOpen,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  Globe,
  HardDrive,
  Info,
  Languages,
  LayoutGrid,
  type LucideIcon,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  Shield,
  Sparkles,
  Star,
  Store,
  Target,
  TrendingUp,
  Trophy,
  Upload,
  User as UserIcon,
  Users,
  Wallet,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { ensureAutoBackup, lastAutoBackupAt, restoreLastAutoBackup } from '@/lib/auto-backup';
import { clearAll, downloadBackup, importBackup } from '@/lib/backup';
import { parseTransactionsCSV } from '@/lib/csv-import';
import { useCurrency, useLanguage } from '@/lib/locale';
import { useProfile } from '@/lib/profile';
import { localStorageBytes, STORAGE_LIMIT_BYTES } from '@/lib/storage-keys';
import { useTaxpayerType } from '@/lib/taxpayer';

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { profile, setName } = useProfile();
  const { value: currency, set: setCurrency } = useCurrency();
  const { value: language, set: setLanguage } = useLanguage();
  const { value: taxType, set: setTaxType } = useTaxpayerType();
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<null | 'reset'>(null);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [storageBytes, setStorageBytes] = useState(0);

  useEffect(() => {
    setStorageBytes(localStorageBytes());
    ensureAutoBackup();
  }, []);

  const csvInput = useRef<HTMLInputElement>(null);

  const onImportCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const txs = parseTransactionsCSV(reader.result as string);
        if (txs.length === 0) {
          toast.show('CSV에서 거래를 찾지 못했어요', 'error');
          return;
        }
        const raw = window.localStorage.getItem('asset/transactions/v2');
        const cur = raw ? JSON.parse(raw) : [];
        window.localStorage.setItem('asset/transactions/v2', JSON.stringify([...txs, ...cur]));
        toast.show(`${txs.length}건 가져오기 완료`, 'success');
        setTimeout(() => window.location.reload(), 600);
      } catch {
        toast.show('CSV 파싱 실패', 'error');
      }
    };
    reader.readAsText(file);
  };

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
          <label
            className="mb-1.5 block text-[12px] font-semibold"
            style={{ color: 'var(--color-text-3)' }}
          >
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

      <Section title="언어 · 통화">
        <Row
          icon={Languages}
          iconBg="#3182F6"
          label="언어"
          subtitle={language === 'ko' ? '한국어' : 'English'}
          onClick={() => setLanguage(language === 'ko' ? 'en' : 'ko')}
          right={
            <span
              style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', fontWeight: 700 }}
            >
              {language === 'ko' ? '한국어' : 'EN'}
            </span>
          }
        />
        <Row
          icon={Globe}
          iconBg="#0EA5E9"
          label="기본 통화"
          subtitle={
            currency === 'KRW'
              ? '대한민국 원 (KRW)'
              : currency === 'USD'
                ? '미국 달러 (USD)'
                : currency === 'JPY'
                  ? '일본 엔 (JPY)'
                  : '유로 (EUR)'
          }
          onClick={() => {
            const order: Array<typeof currency> = ['KRW', 'USD', 'JPY', 'EUR'];
            const next = order[(order.indexOf(currency) + 1) % order.length];
            setCurrency(next);
          }}
          right={
            <span
              style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', fontWeight: 700 }}
            >
              {currency}
            </span>
          }
        />
      </Section>

      <Section title="세무">
        <Row
          icon={Receipt}
          iconBg="#EF4444"
          label="과세자 구분"
          subtitle={
            taxType === 'general' ? '일반과세자 (매출세액 1/11)' : '간이과세자 (업종별 부가가치율)'
          }
          onClick={() => setTaxType(taxType === 'general' ? 'simplified' : 'general')}
          right={
            <span
              style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', fontWeight: 700 }}
            >
              {taxType === 'general' ? '일반' : '간이'}
            </span>
          }
        />
      </Section>

      {(() => {
        const personalManagement = (
          <Section title={mode === 'business' ? '개인 관리' : '관리'} key="management">
            <Row
              icon={Wallet}
              iconBg="#3182F6"
              label="계좌 관리"
              subtitle="은행, 카드, 현금, 투자 계좌"
              onClick={() => router.push('/settings/accounts')}
            />
            <Row
              icon={BarChart3}
              iconBg="#FF8A1F"
              label="예산 설정"
              subtitle="카테고리별 한 달 한도"
              onClick={() => router.push('/settings/budgets')}
            />
            <Row
              icon={Target}
              iconBg="#1FBA6E"
              label="저축 목표"
              subtitle="목표 만들고 추적"
              onClick={() => router.push('/settings/goals')}
            />
            <Row
              icon={Repeat}
              iconBg="#0EA5E9"
              label="정기결제"
              subtitle="구독·통신비·멤버십"
              onClick={() => router.push('/settings/recurring')}
            />
            <Row
              icon={Banknote}
              iconBg="#EF4444"
              label="대출 관리"
              subtitle="원리금·이자율·만기"
              onClick={() => router.push('/settings/loans')}
            />
            <Row
              icon={CreditCard}
              iconBg="#BE185D"
              label="마이너스 통장"
              subtitle="한도·사용액·자동 이자 차감"
              onClick={() => router.push('/settings/credit-line')}
            />
            <Row
              icon={TrendingUp}
              iconBg="#00B956"
              label="투자 관리"
              subtitle="주식·펀드·암호화폐"
              onClick={() => router.push('/settings/investments')}
            />
            <Row
              icon={LayoutGrid}
              iconBg="#8B5CF6"
              label="카테고리"
              subtitle="커스텀 카테고리 추가/편집"
              onClick={() => router.push('/settings/categories')}
            />
            <Row
              icon={Sparkles}
              iconBg="#EC4899"
              label="자동 분류 규칙"
              subtitle="소비처 → 카테고리 자동 적용"
              onClick={() => router.push('/settings/category-rules')}
            />
            <Row
              icon={Star}
              iconBg="#F59E0B"
              label="즐겨찾기 거래"
              subtitle="자주 쓰는 거래"
              onClick={() => router.push('/settings/favorites')}
            />
            <Row
              icon={Trophy}
              iconBg="#A47148"
              label="챌린지"
              subtitle="지출 한도 챌린지"
              onClick={() => router.push('/settings/challenges')}
            />
          </Section>
        );
        const businessManagement = (
          <Section
            title={mode === 'business' ? '사업자' : '사업자 (사업 모드 전환 후 사용)'}
            key="business"
          >
            <Row
              icon={BadgeCheck}
              iconBg="#3182F6"
              label="사업자 정보"
              subtitle="상호·등록번호·수수료율·자동 인건비"
              onClick={() => router.push('/business/profile')}
            />
            <Row
              icon={Users}
              iconBg="#0EA5E9"
              label="거래처"
              subtitle="매출처·매입처 등록"
              onClick={() => router.push('/settings/vendors')}
            />
            <Row
              icon={UserIcon}
              iconBg="#3182F6"
              label="직원·인건비"
              subtitle="월 기본급 자동 집계"
              onClick={() => router.push('/settings/employees')}
            />
            <Row
              icon={Store}
              iconBg="#FF8A1F"
              label="사업장"
              subtitle="매장 A/B 분리 관리"
              onClick={() => router.push('/settings/locations')}
            />
            <Row
              icon={DoorOpen}
              iconBg="#6B7684"
              label="일일 마감"
              subtitle="매장별 일별 매출 정리"
              onClick={() => router.push('/business/daily-close')}
            />
            <Row
              icon={CalendarDays}
              iconBg="#EF4444"
              label="세무 일정"
              subtitle="부가세·종합소득세 D-day"
              onClick={() => router.push('/business/tax-calendar')}
            />
            <Row
              icon={Receipt}
              iconBg="#EF4444"
              label="부가세 도우미"
              subtitle="분기별 매출/매입 정리"
              onClick={() => router.push('/business/vat')}
            />
            <Row
              icon={CircleDollarSign}
              iconBg="#00B956"
              label="종합소득세 / 원천세"
              subtitle="누적 영업이익 기반 + 3.3% 계산기"
              onClick={() => router.push('/business/income-tax')}
            />
            <Row
              icon={FileBarChart}
              iconBg="#8B5CF6"
              label="손익계산서"
              subtitle="매출·비용·영업이익 + 매장별"
              onClick={() => router.push('/business/pnl')}
            />
            <Row
              icon={Coins}
              iconBg="#10B981"
              label="현금흐름표"
              subtitle="기간별 유입/유출"
              onClick={() => router.push('/business/cashflow')}
            />
          </Section>
        );
        return mode === 'business'
          ? [businessManagement, personalManagement]
          : [personalManagement, businessManagement];
      })()}

      <Section title="리포트">
        <Row
          icon={CalendarRange}
          iconBg="#3182F6"
          label="이번 달 리포트"
          subtitle="카테고리별 분석 + CSV/PDF"
          onClick={() => router.push('/reports/monthly')}
        />
        <Row
          icon={FileSpreadsheet}
          iconBg="#8B5CF6"
          label="연간 리포트"
          subtitle="올해의 소비처 TOP 5"
          onClick={() => router.push('/reports/yearly')}
        />
        <Row
          icon={Shield}
          iconBg="#14B8A6"
          label="연말정산 도우미"
          subtitle="공제 가능 사용액 추정"
          onClick={() => router.push('/reports/year-end-tax')}
        />
        <Row
          icon={Search}
          iconBg="#94A3B8"
          label="검색"
          subtitle="전체 기간 검색 + 고급 필터"
          onClick={() => router.push('/search')}
        />
      </Section>

      <Section title="데이터">
        <Row
          icon={Upload}
          iconBg="#3182F6"
          label="백업 내보내기"
          subtitle="JSON 파일로 저장"
          onClick={() => {
            downloadBackup();
            toast.show('백업 파일을 저장했어요', 'success');
          }}
        />
        <Row
          icon={ArrowDownLeft}
          iconBg="#0EA5E9"
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
          icon={FileText}
          iconBg="#94A3B8"
          label="CSV 가져오기"
          subtitle="다른 가계부에서 내보낸 CSV"
          onClick={() => csvInput.current?.click()}
        />
        <input
          ref={csvInput}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onImportCSV(f);
            e.target.value = '';
          }}
        />
        <Row
          icon={RefreshCw}
          iconBg="#00B956"
          label="자동 백업"
          subtitle={
            lastAutoBackupAt()
              ? `최근 ${lastAutoBackupAt()?.toLocaleDateString('ko-KR')}`
              : '아직 없음'
          }
          right={
            <span
              style={{
                color: 'var(--color-primary)',
                fontSize: 'var(--text-xxs)',
                fontWeight: 700,
              }}
            >
              매주 자동
            </span>
          }
          onClick={() => {
            if (restoreLastAutoBackup()) {
              toast.show('자동 백업으로 복원 완료', 'success');
              setTimeout(() => window.location.reload(), 400);
            } else {
              toast.show('자동 백업이 없어요', 'info');
            }
          }}
        />
        <Row
          icon={AlertTriangle}
          label="모든 데이터 초기화"
          subtitle="되돌릴 수 없어요"
          danger
          onClick={() => setConfirming('reset')}
        />
      </Section>

      <Section title="앱 정보">
        <Row icon={Info} iconBg="#3182F6" label="버전" subtitle="0.3.0 · 로컬 저장소" />
        <Row
          icon={HardDrive}
          iconBg="#8B95A1"
          label="저장 공간 사용"
          subtitle={`${(storageBytes / 1024).toFixed(1)} KB / ${(STORAGE_LIMIT_BYTES / 1024 / 1024).toFixed(0)} MB`}
          right={
            <div
              className="h-1.5 w-16 overflow-hidden rounded-full"
              style={{ background: 'var(--color-gray-150)' }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (storageBytes / STORAGE_LIMIT_BYTES) * 100)}%`,
                  background:
                    storageBytes / STORAGE_LIMIT_BYTES > 0.8
                      ? 'var(--color-danger)'
                      : 'var(--color-primary)',
                }}
              />
            </div>
          }
        />
      </Section>

      <ConfirmDialog
        open={confirming === 'reset'}
        title="모든 데이터를 초기화할까요?"
        description="저장된 모든 거래·계좌·예산이 사라져요. 백업 파일이 있으면 복원할 수 있습니다."
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
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="px-5 pb-2 pt-4">
      <h2
        className="mb-2 text-xs font-bold uppercase tracking-wider"
        style={{ color: 'var(--color-text-3)' }}
      >
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
  icon: Icon,
  iconBg,
}: {
  label: string;
  subtitle?: string;
  onClick?: () => void;
  right?: React.ReactNode;
  danger?: boolean;
  icon?: LucideIcon;
  iconBg?: string;
}) {
  const Component = onClick ? 'button' : 'div';
  const tint = iconBg ?? (danger ? 'var(--color-danger)' : 'var(--color-text-2)');
  return (
    <Component
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className="tap flex w-full items-center gap-3 px-4 py-3.5 text-left"
      style={{ borderBottom: '1px solid var(--color-divider)' }}
    >
      {Icon && (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: 8,
            background: `${tint}1f`,
            color: tint,
            flexShrink: 0,
          }}
        >
          <Icon size={18} strokeWidth={2.2} />
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p
          className="text-[15px] font-semibold"
          style={{ color: danger ? 'var(--color-danger)' : 'var(--color-text-1)' }}
        >
          {label}
        </p>
        {subtitle && (
          <p className="mt-0.5 truncate text-xs" style={{ color: 'var(--color-text-3)' }}>
            {subtitle}
          </p>
        )}
      </div>
      {right ??
        (onClick && (
          <svg viewBox="0 0 24 24" width={18} height={18} fill="none">
            <path
              d="M9 6l6 6-6 6"
              stroke="var(--color-text-3)"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ))}
    </Component>
  );
}
