'use client';

import {
  AlertTriangle,
  ArrowDownLeft,
  BadgeCheck,
  Banknote,
  BarChart3,
  BellRing,
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  CloudDownload,
  CloudUpload,
  Coins,
  CreditCard,
  DoorOpen,
  FileBarChart,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Info,
  LayoutGrid,
  type LucideIcon,
  Receipt,
  RefreshCw,
  Repeat,
  Search,
  Shield,
  ShieldCheck,
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
import Sheet from '@/components/ui/Sheet';
import { ensureAutoBackup, lastAutoBackupAt, restoreLastAutoBackup } from '@/lib/auto-backup';
import { clearAll, downloadBackup, importBackup } from '@/lib/backup';
import { previousMonthKey } from '@/lib/closing';
import { cloudSyncConfigured } from '@/lib/cloud-sync';
import { parseTransactionsCSV } from '@/lib/csv-import';
import { useInboxKey } from '@/lib/inbox';
import { useProfile } from '@/lib/profile';
import {
  claimServerBackup,
  describeBackup,
  fetchServerBackup,
  listServerBackups,
  restoreServerBackup,
  type ServerBackupMeta,
  setServerBackupOff,
  useServerBackup,
} from '@/lib/server-backup';
import { KEYS, localStorageBytes, STORAGE_LIMIT_BYTES } from '@/lib/storage-keys';
import { readStorageValue, writeStorageValue } from '@/lib/store-factory';
import { useTaxpayerType } from '@/lib/taxpayer';
import type { Account, Transaction } from '@/lib/types';

export default function SettingsPage() {
  const router = useRouter();
  const toast = useToast();
  const { mode } = useMode();
  const { profile, setName } = useProfile();
  const { value: taxType, set: setTaxType } = useTaxpayerType();
  const { value: inboxKey } = useInboxKey();
  const inboxOn = !!inboxKey;
  const fileInput = useRef<HTMLInputElement>(null);
  const [confirming, setConfirming] = useState<null | 'reset' | 'restore-auto'>(null);
  // A backup file waiting for the user to confirm that it may replace current data.
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [nameDraft, setNameDraft] = useState(profile.name);
  const [storageBytes, setStorageBytes] = useState(0);
  // Read after mount — the prerendered HTML can't know it ("아직 없음" vs a date
  // was a hydration mismatch on every visit once a backup existed).
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const { value: serverBackup } = useServerBackup();
  // null while the list is loading.
  const [serverDays, setServerDays] = useState<ServerBackupMeta[] | null>(null);
  const [serverOpen, setServerOpen] = useState(false);
  const [serverPick, setServerPick] = useState<ServerBackupMeta | null>(null);
  const [heldOpen, setHeldOpen] = useState(false);

  const openServerBackups = async () => {
    if (!inboxKey) return;
    setServerOpen(true);
    setServerDays(null);
    const list = await listServerBackups(inboxKey);
    if (!list) {
      setServerOpen(false);
      toast.show('서버에 연결하지 못했어요', 'error');
      return;
    }
    setServerDays(list);
  };

  const onServerRestore = async (id: string) => {
    if (!inboxKey) return;
    const got = await fetchServerBackup(inboxKey, id);
    const data = got.ok ? got.data : null;
    if (!data) {
      toast.show('백업을 가져오지 못했어요', 'error');
      return;
    }
    restoreServerBackup(data, inboxKey);
    toast.show(`${describeBackup(data)} 복원 완료`, 'success');
    setTimeout(() => window.location.reload(), 400);
  };

  useEffect(() => {
    setStorageBytes(localStorageBytes());
    ensureAutoBackup();
    setLastBackup(lastAutoBackupAt());
  }, []);

  const csvInput = useRef<HTMLInputElement>(null);

  const onImportCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const existing = readStorageValue<Transaction[]>(KEYS.transactions, []);
        const { rows, skipped } = parseTransactionsCSV(reader.result as string, {
          accounts: readStorageValue<Account[]>(KEYS.accounts, []).map((a) =>
            a.scope ? a : { ...a, scope: 'personal' as const },
          ),
          scope: mode,
          existing,
        });
        if (rows.length === 0) {
          toast.show(
            skipped > 0 ? '새로 가져올 내역이 없어요' : 'CSV에서 거래를 찾지 못했어요',
            'error',
          );
          return;
        }
        // History only: balances are entered by hand and already include these rows.
        writeStorageValue(KEYS.transactions, [...rows, ...existing]);
        toast.show(
          skipped > 0 ? `${rows.length}건 가져옴 · ${skipped}건 건너뜀` : `${rows.length}건 가져옴`,
          'success',
        );
      } catch {
        toast.show('CSV를 읽지 못했어요', 'error');
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
            placeholder="이름"
            className="h-11 w-full rounded-xl px-3 text-[15px] font-medium outline-none"
            style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
          />
        </div>
      </Section>

      <Section title="자동화">
        <Row
          icon={BellRing}
          iconBg="#2E3561"
          label="카드 알림 자동 기록"
          subtitle={inboxOn ? '켜짐' : '꺼짐'}
          onClick={() => router.push('/settings/auto-record')}
        />
        {cloudSyncConfigured() && (
          <Row
            icon={Sparkles}
            iconBg="#D97757"
            label="Claude 연결"
            onClick={() => router.push('/settings/claude')}
          />
        )}
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

      {/* 관리 — 현재 모드에 해당하는 항목만 표시 */}
      {mode === 'personal' ? (
        <Section title="개인 관리">
          <Row
            icon={Wallet}
            iconBg="#3182F6"
            label="계좌 관리"
            onClick={() => router.push('/settings/accounts')}
          />
          <Row
            icon={BarChart3}
            iconBg="#FF8A1F"
            label="예산 설정"
            onClick={() => router.push('/settings/budgets')}
          />
          <Row
            icon={Target}
            iconBg="#1FBA6E"
            label="저축 목표"
            onClick={() => router.push('/settings/goals')}
          />
          <Row
            icon={Repeat}
            iconBg="#0EA5E9"
            label="정기결제"
            onClick={() => router.push('/settings/recurring')}
          />
          <Row
            icon={Banknote}
            iconBg="#EF4444"
            label="대출 관리"
            onClick={() => router.push('/settings/loans')}
          />
          <Row
            icon={CreditCard}
            iconBg="#BE185D"
            label="마이너스 통장"
            onClick={() => router.push('/settings/credit-line')}
          />
        </Section>
      ) : (
        <Section title="사업자 관리">
          <Row
            icon={BadgeCheck}
            iconBg="#3182F6"
            label="수수료 · 인건비"
            onClick={() => router.push('/business/profile')}
          />
          <Row
            icon={Wallet}
            iconBg="#3182F6"
            label="사업 계좌 관리"
            onClick={() => router.push('/settings/accounts')}
          />
          <Row
            icon={Banknote}
            iconBg="#EF4444"
            label="사업 대출 관리"
            onClick={() => router.push('/settings/loans')}
          />
          <Row
            icon={CreditCard}
            iconBg="#BE185D"
            label="사업 마이너스 통장"
            onClick={() => router.push('/settings/credit-line')}
          />
          <Row
            icon={Users}
            iconBg="#0EA5E9"
            label="거래처"
            onClick={() => router.push('/settings/vendors')}
          />
          <Row
            icon={UserIcon}
            iconBg="#3182F6"
            label="직원·인건비"
            onClick={() => router.push('/settings/employees')}
          />
          <Row
            icon={Store}
            iconBg="#FF8A1F"
            label="사업장"
            onClick={() => router.push('/settings/locations')}
          />
          <Row
            icon={DoorOpen}
            iconBg="#6B7684"
            label="일일 마감"
            onClick={() => router.push('/business/daily-close')}
          />
          <Row
            icon={CalendarDays}
            iconBg="#EF4444"
            label="세무 일정"
            onClick={() => router.push('/business/tax-calendar')}
          />
          <Row
            icon={Receipt}
            iconBg="#EF4444"
            label="부가세 도우미"
            onClick={() => router.push('/business/vat')}
          />
          <Row
            icon={CircleDollarSign}
            iconBg="#00B956"
            label="종합소득세 / 원천세"
            onClick={() => router.push('/business/income-tax')}
          />
          <Row
            icon={FileBarChart}
            iconBg="#8B5CF6"
            label="손익계산서"
            onClick={() => router.push('/business/pnl')}
          />
          <Row
            icon={Coins}
            iconBg="#10B981"
            label="현금흐름표"
            onClick={() => router.push('/business/cashflow')}
          />
        </Section>
      )}

      {/* 공통 — 모드 무관 */}
      <Section title="공통">
        <Row
          icon={TrendingUp}
          iconBg="#00B956"
          label="투자 관리"
          onClick={() => router.push('/settings/investments')}
        />
        <Row
          icon={LayoutGrid}
          iconBg="#8B5CF6"
          label="카테고리"
          onClick={() => router.push('/settings/categories')}
        />
        <Row
          icon={Sparkles}
          iconBg="#EC4899"
          label="자동 분류 규칙"
          onClick={() => router.push('/settings/category-rules')}
        />
        <Row
          icon={Star}
          iconBg="#F59E0B"
          label="즐겨찾기 거래"
          onClick={() => router.push('/settings/favorites')}
        />
        <Row
          icon={Trophy}
          iconBg="#A47148"
          label="챌린지"
          onClick={() => router.push('/settings/challenges')}
        />
      </Section>

      <Section title="리포트">
        <Row
          icon={Sparkles}
          iconBg="#2E3561"
          label="월말 결산"
          onClick={() => router.push(`/reports/closing?ym=${previousMonthKey()}`)}
        />
        <Row
          icon={CalendarRange}
          iconBg="#3182F6"
          label="이번 달 리포트"
          onClick={() => router.push('/reports/monthly')}
        />
        <Row
          icon={FileSpreadsheet}
          iconBg="#8B5CF6"
          label="연간 리포트"
          onClick={() => router.push('/reports/yearly')}
        />
        <Row
          icon={Shield}
          iconBg="#14B8A6"
          label="연말정산 도우미"
          onClick={() => router.push('/reports/year-end-tax')}
        />
        <Row icon={Search} iconBg="#94A3B8" label="검색" onClick={() => router.push('/search')} />
      </Section>

      <Section title="데이터">
        <Row
          icon={Upload}
          iconBg="#3182F6"
          label="백업 내보내기"
          onClick={async () => {
            if (await downloadBackup()) toast.show('백업 파일을 저장했어요', 'success');
          }}
        />
        <Row
          icon={ArrowDownLeft}
          iconBg="#0EA5E9"
          label="백업 복원하기"
          onClick={() => fileInput.current?.click()}
        />
        <input
          ref={fileInput}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) setPendingFile(f);
            e.target.value = '';
          }}
        />
        <Row
          icon={FileText}
          iconBg="#94A3B8"
          label="CSV 가져오기"
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
        {inboxOn && (
          <Row
            icon={CloudUpload}
            iconBg="#2E3561"
            label="서버 백업"
            subtitle={
              serverBackup.off
                ? '꺼짐'
                : serverBackup.held
                  ? '다른 기기의 백업이 더 새로워요 · 눌러서 선택'
                  : serverBackup.lastError
                    ? '올리지 못했어요'
                    : serverBackup.lastAt
                      ? `최근 ${shortDateTime(serverBackup.lastAt)}`
                      : '아직 없음'
            }
            right={<MiniSwitch on={!serverBackup.off} />}
            onClick={() =>
              serverBackup.held && !serverBackup.off
                ? setHeldOpen(true)
                : setServerBackupOff(!serverBackup.off)
            }
          />
        )}
        {inboxOn && (
          <Row
            icon={CloudDownload}
            iconBg="#0EA5E9"
            label="서버 백업에서 복원"
            onClick={openServerBackups}
          />
        )}
        <Row
          icon={RefreshCw}
          iconBg="#00B956"
          label="자동 백업"
          subtitle={lastBackup ? `최근 ${lastBackup.toLocaleDateString('ko-KR')}` : '아직 없음'}
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
          onClick={lastBackup ? () => setConfirming('restore-auto') : undefined}
        />
        <Row
          icon={ShieldCheck}
          iconBg="#14B8A6"
          label="데이터 무결성 검사"
          onClick={() => router.push('/settings/data-check')}
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
      <ConfirmDialog
        open={confirming === 'restore-auto'}
        title="자동 백업으로 되돌릴까요?"
        description={`${lastBackup?.toLocaleDateString('ko-KR') ?? ''} 백업으로 바뀌어요. 그 뒤에 기록한 내용은 사라져요.`}
        confirmLabel="되돌리기"
        danger
        onCancel={() => setConfirming(null)}
        onConfirm={() => {
          setConfirming(null);
          if (restoreLastAutoBackup()) {
            toast.show('자동 백업으로 복원 완료', 'success');
            setTimeout(() => window.location.reload(), 400);
          } else {
            toast.show('자동 백업이 없어요', 'info');
          }
        }}
      />
      <Sheet open={serverOpen} onClose={() => setServerOpen(false)} title="서버 백업">
        {serverDays === null ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>
            불러오는 중…
          </p>
        ) : serverDays.length === 0 ? (
          <p className="py-8 text-center text-sm" style={{ color: 'var(--color-text-3)' }}>
            저장된 백업이 없어요
          </p>
        ) : (
          <div
            className="mb-2 overflow-hidden rounded-2xl"
            style={{ background: 'var(--color-gray-50)' }}
          >
            {serverDays.map((b, i) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setServerPick(b)}
                className="tap flex w-full items-center justify-between px-4 py-3.5 text-left"
                style={{
                  borderBottom:
                    i === serverDays.length - 1 ? 'none' : '1px solid var(--color-divider)',
                }}
              >
                <span style={{ color: 'var(--color-text-1)', fontSize: 15, fontWeight: 700 }}>
                  {shortDateTime(b.at)}
                </span>
                <span className="tnum" style={{ color: 'var(--color-text-3)', fontSize: 12 }}>
                  {Math.max(1, Math.round(b.size / 1024)).toLocaleString('ko-KR')}KB
                </span>
              </button>
            ))}
          </div>
        )}
      </Sheet>
      <ConfirmDialog
        open={serverPick !== null}
        title={`${serverPick ? shortDateTime(serverPick.at) : ''} 백업으로 되돌릴까요?`}
        description="그 뒤에 기록한 내용은 사라져요."
        confirmLabel="되돌리기"
        danger
        onCancel={() => setServerPick(null)}
        onConfirm={() => {
          const b = serverPick;
          setServerPick(null);
          setServerOpen(false);
          if (b) void onServerRestore(b.id);
        }}
      />
      <ConfirmDialog
        open={heldOpen}
        title="서버에 더 새 백업이 있어요"
        description="다른 기기나 예전에 쓰던 앱에서 올린 백업이에요. 이 기기 내용으로 계속 백업하거나, '서버 백업에서 복원'으로 그 백업을 가져올 수 있어요."
        confirmLabel="이 기기로 계속"
        cancelLabel="닫기"
        onCancel={() => setHeldOpen(false)}
        onConfirm={() => {
          setHeldOpen(false);
          void claimServerBackup().then((r) =>
            toast.show(
              r === 'saved' || r === 'current'
                ? '이 기기 내용으로 백업했어요'
                : '백업하지 못했어요',
              r === 'saved' || r === 'current' ? 'success' : 'error',
            ),
          );
        }}
      />
      <ConfirmDialog
        open={pendingFile !== null}
        title="백업 파일로 복원할까요?"
        description="파일에 들어 있는 항목이 지금 데이터를 대신해요."
        confirmLabel="복원"
        danger
        onCancel={() => setPendingFile(null)}
        onConfirm={() => {
          const f = pendingFile;
          setPendingFile(null);
          if (f) void onImport(f);
        }}
      />
    </>
  );
}

/** "11월 17일 오후 7:02" */
function shortDateTime(iso: string): string {
  return new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function MiniSwitch({ on }: { on: boolean }) {
  return (
    <span
      className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors"
      style={{ background: on ? 'var(--color-primary)' : 'var(--color-gray-300)' }}
    >
      <span
        className="absolute h-5 w-5 rounded-full bg-white shadow transition-transform"
        style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)' }}
      />
    </span>
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
