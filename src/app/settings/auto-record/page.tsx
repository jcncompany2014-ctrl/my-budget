'use client';

import {
  ArrowLeft,
  BellRing,
  Check,
  ChevronRight,
  CloudOff,
  Copy,
  CreditCard,
  FlaskConical,
  History,
  KeyRound,
  Send,
  Smartphone,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import BankIcon from '@/components/icons/BankIcon';
import CardIcon from '@/components/icons/CardIcon';
import MerchantAvatar from '@/components/icons/MerchantAvatar';
import { useToast } from '@/components/Toast';
import TopBar from '@/components/TopBar';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useAllAccounts } from '@/lib/accounts';
import { noticeSummary } from '@/lib/card-notification';
import { CATEGORIES } from '@/lib/categories';
import {
  describeSync,
  fetchInboxBackend,
  generateInboxKey,
  inboxUrl,
  previewNotification,
  sendTestNotification,
  syncInbox,
  useInboxKey,
  useInboxStatus,
} from '@/lib/inbox';
import type { InboxLogEntry } from '@/lib/inbox-import';
import { removeTransaction, useAllTransactions } from '@/lib/storage';
import { KEYS } from '@/lib/storage-keys';
import { readStorageValue } from '@/lib/store-factory';
import type { Account } from '@/lib/types';

type Backend = 'checking' | 'ok' | 'missing' | 'offline';

function ago(iso?: string): string {
  if (!iso) return '아직 없음';
  const min = Math.floor((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return '방금';
  if (min < 60) return `${min}분 전`;
  if (min < 24 * 60) return `${Math.floor(min / 60)}시간 전`;
  return `${Math.floor(min / (24 * 60))}일 전`;
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default function AutoRecordPage() {
  const router = useRouter();
  const toast = useToast();
  const { value: key, ready, set: setKey } = useInboxKey();
  const { value: status } = useInboxStatus();
  const { tx } = useAllTransactions();
  const [backend, setBackend] = useState<Backend>('checking');
  const [confirm, setConfirm] = useState<null | 'rotate' | 'off'>(null);

  useEffect(() => {
    fetchInboxBackend().then((r) =>
      setBackend(r === null ? 'offline' : r.configured ? 'ok' : 'missing'),
    );
  }, []);

  const monthCount = useMemo(() => {
    const now = new Date();
    return tx.filter((t) => {
      if (t.source !== 'notification') return false;
      const d = new Date(t.date);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    }).length;
  }, [tx]);

  const url = key ? inboxUrl(key) : '';
  const onCopy = async () => {
    toast.show(
      (await copyText(url)) ? '주소를 복사했어요' : '복사하지 못했어요 — 길게 눌러 복사해 주세요',
      {
        variant: 'info',
      },
    );
  };

  return (
    <>
      <TopBar
        left={
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="뒤로"
            className="tap -ml-2 flex h-10 w-10 items-center justify-center rounded-full"
            style={{ color: 'var(--color-text-1)' }}
          >
            <ArrowLeft size={22} strokeWidth={2.4} />
          </button>
        }
        title="카드 알림 자동 기록"
      />

      {/* Hero */}
      <section className="px-5 pb-3 pt-1">
        <div
          className="relative overflow-hidden rounded-3xl px-5 pb-5 pt-5"
          style={{
            background: 'linear-gradient(135deg, #1B1F3B 0%, #2E3561 60%, #3D4785 100%)',
            boxShadow: '0 8px 24px rgba(27, 31, 59, 0.28)',
          }}
        >
          <div
            aria-hidden
            className="absolute -right-6 -top-6 h-28 w-28 rounded-full"
            style={{ background: 'rgba(255,214,107,0.12)' }}
          />
          <span
            className="flex h-11 w-11 items-center justify-center rounded-2xl"
            style={{ background: 'rgba(255,255,255,0.12)', color: '#FFD66B' }}
          >
            <BellRing size={22} strokeWidth={2.4} />
          </span>
          <p className="mt-3" style={{ color: '#fff', fontSize: 19, fontWeight: 800 }}>
            결제하면 알아서 적히는 가계부
          </p>
          <p
            className="mt-1 leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.72)', fontSize: 12.5, fontWeight: 500 }}
          >
            카드 결제 알림이 오면 아이폰 단축어가 내 전용 주소로 보내고, 앱을 열면 카테고리까지
            붙여서 바로 기록돼요.
          </p>
          {ready && key && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <HeroChip
                tone={backend === 'ok' ? 'good' : backend === 'checking' ? 'muted' : 'warn'}
                label={
                  backend === 'ok'
                    ? '서버 연결됨'
                    : backend === 'checking'
                      ? '서버 확인 중'
                      : backend === 'missing'
                        ? '서버 저장소 미연결'
                        : '서버 응답 없음'
                }
              />
              <HeroChip tone="muted" label={`마지막 동기화 ${ago(status.lastSyncAt)}`} />
              <HeroChip tone="muted" label={`이번 달 ${monthCount}건`} />
            </div>
          )}
          {ready && !key && (
            <button
              type="button"
              onClick={() => {
                setKey(generateInboxKey());
                toast.show('자동 기록을 켰어요 — 아래 순서대로 단축어를 만들어 주세요', 'success');
              }}
              className="tap mt-4 flex h-12 w-full items-center justify-center gap-1.5 rounded-2xl"
              style={{ background: '#FFD66B', color: '#1B1F3B', fontSize: 15, fontWeight: 800 }}
            >
              자동 기록 켜기
              <ChevronRight size={18} strokeWidth={2.6} />
            </button>
          )}
        </div>
      </section>

      {key && backend === 'missing' && (
        <section className="px-5 pb-3">
          <div
            className="flex gap-3 rounded-2xl px-4 py-3.5"
            style={{ background: 'var(--color-danger-soft)' }}
          >
            <CloudOff
              size={18}
              strokeWidth={2.4}
              color="var(--color-danger)"
              className="mt-0.5 shrink-0"
            />
            <div>
              <p style={{ color: 'var(--color-danger)', fontSize: 13, fontWeight: 800 }}>
                서버 저장소가 아직 연결되지 않았어요
              </p>
              <p
                className="mt-0.5 leading-snug"
                style={{ color: 'var(--color-text-2)', fontSize: 12 }}
              >
                Vercel 프로젝트에 Blob 저장소(Private)를 연결하면 바로 동작해요. 연결 전에는
                단축어가 보낸 알림을 받을 곳이 없어요.
              </p>
            </div>
          </div>
        </section>
      )}

      {key && (
        <>
          <StepCard n={1} icon={KeyRound} title="내 전용 주소">
            <button
              type="button"
              onClick={onCopy}
              className="tap flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left"
              style={{ background: 'var(--color-gray-100)' }}
            >
              <code
                className="min-w-0 flex-1 break-all leading-snug"
                style={{ color: 'var(--color-text-1)', fontSize: 12, fontWeight: 600 }}
              >
                {url}
              </code>
              <span
                className="flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1.5"
                style={{
                  background: 'var(--color-primary)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                <Copy size={13} strokeWidth={2.6} />
                복사
              </span>
            </button>
            <p
              className="mt-2 leading-snug"
              style={{ color: 'var(--color-text-3)', fontSize: 11.5 }}
            >
              이 주소를 아는 사람은 내 가계부에 거래를 넣을 수 있어요. 단축어에만 넣고 공유하지
              마세요.
            </p>
          </StepCard>

          <StepCard n={2} icon={Smartphone} title="아이폰 단축어 만들기">
            <ShortcutGuide onCopy={onCopy} />
          </StepCard>

          <StepCard n={3} icon={CreditCard} title="카드 끝 4자리 연결">
            <CardLinks />
          </StepCard>

          <StepCard icon={FlaskConical} title="알림 테스트">
            <TestPanel inboxKey={key} />
          </StepCard>

          <section className="px-5 pb-3">
            <Link
              href="/inbox"
              className="tap flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ background: 'var(--color-card)' }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-xl"
                style={{ background: 'var(--color-primary-soft)', color: 'var(--color-primary)' }}
              >
                <History size={18} strokeWidth={2.4} />
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className="block"
                  style={{ color: 'var(--color-text-1)', fontSize: 15, fontWeight: 700 }}
                >
                  자동 기록 내역
                </span>
                <span className="block" style={{ color: 'var(--color-text-3)', fontSize: 12 }}>
                  중복·취소·못 읽은 알림 확인
                </span>
              </span>
              <ChevronRight size={18} strokeWidth={2.4} color="var(--color-text-3)" />
            </Link>
          </section>

          <section className="flex justify-center gap-4 px-5 pb-12 pt-2">
            <button
              type="button"
              onClick={() => setConfirm('rotate')}
              className="tap px-2 py-2"
              style={{ color: 'var(--color-text-3)', fontSize: 12, fontWeight: 700 }}
            >
              주소 재발급
            </button>
            <button
              type="button"
              onClick={() => setConfirm('off')}
              className="tap px-2 py-2"
              style={{ color: 'var(--color-danger)', fontSize: 12, fontWeight: 700 }}
            >
              자동 기록 끄기
            </button>
          </section>
        </>
      )}

      <ConfirmDialog
        open={confirm === 'rotate'}
        title="주소를 새로 만들까요?"
        description="지금 단축어에 넣어둔 주소는 더 이상 동작하지 않아요. 단축어의 URL을 새 주소로 바꿔야 해요."
        confirmLabel="재발급"
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setKey(generateInboxKey());
          setConfirm(null);
          toast.show('새 주소를 만들었어요 — 단축어의 URL을 바꿔 주세요', 'info');
        }}
      />
      <ConfirmDialog
        open={confirm === 'off'}
        title="자동 기록을 끌까요?"
        description="단축어가 보내는 알림을 더 이상 가져오지 않아요. 이미 기록된 거래는 그대로예요."
        confirmLabel="끄기"
        danger
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setKey(null);
          setConfirm(null);
          toast.show('자동 기록을 껐어요', 'info');
        }}
      />
    </>
  );
}

function HeroChip({ label, tone }: { label: string; tone: 'good' | 'warn' | 'muted' }) {
  const bg =
    tone === 'good'
      ? 'rgba(52,211,153,0.18)'
      : tone === 'warn'
        ? 'rgba(248,113,113,0.2)'
        : 'rgba(255,255,255,0.1)';
  const fg = tone === 'good' ? '#6EE7B7' : tone === 'warn' ? '#FCA5A5' : 'rgba(255,255,255,0.78)';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-1"
      style={{ background: bg, color: fg, fontSize: 11, fontWeight: 700 }}
    >
      {tone === 'good' && <Check size={11} strokeWidth={3} />}
      {label}
    </span>
  );
}

function StepCard({
  n,
  icon: Icon,
  title,
  children,
}: {
  n?: number;
  icon: typeof BellRing;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 pb-3">
      <div className="rounded-2xl px-4 pb-4 pt-3.5" style={{ background: 'var(--color-card)' }}>
        <div className="mb-3 flex items-center gap-2">
          {n !== undefined ? (
            <span
              className="tnum flex h-6 w-6 items-center justify-center rounded-full"
              style={{
                background: 'var(--color-text-1)',
                color: 'var(--color-card)',
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {n}
            </span>
          ) : (
            <Icon size={17} strokeWidth={2.4} color="var(--color-text-2)" />
          )}
          <h2 style={{ color: 'var(--color-text-1)', fontSize: 15, fontWeight: 800 }}>{title}</h2>
        </div>
        {children}
      </div>
    </section>
  );
}

type Step = { title: string; detail?: string; copy?: boolean };

const GUIDES: Record<
  'notification' | 'sms' | 'applepay',
  { label: string; badge: string; steps: Step[] }
> = {
  notification: {
    label: '카드앱 알림',
    badge: 'iOS 27+',
    steps: [
      { title: '단축어 앱 → 아래 ‘자동화’ 탭 → 오른쪽 위 ＋' },
      {
        title: '‘알림’ 고르고, 앱에서 카드사 앱 선택',
        detail:
          '신한 SOL페이, KB Pay, 현대카드, 토스처럼 결제 알림이 오는 앱. 여러 개 골라도 돼요.',
      },
      {
        title: '필터 추가 → 메시지에 ‘승인’ 포함',
        detail:
          '광고·로그인 알림은 빼고 결제 알림만 보내요. 알림에 ‘승인’ 대신 ‘결제’라고 오면 ‘결제’로.',
      },
      { title: '‘즉시 실행’ 선택, ‘실행 시 알림’ 끄기 → 다음' },
      { title: '‘새로운 빈 자동화’ → 동작 추가 → ‘URL의 콘텐츠 가져오기’' },
      { title: 'URL 칸에 내 전용 주소 붙여넣기', copy: true },
      {
        title: '동작을 펼쳐서 방법 POST, 요청 본문 JSON',
        detail: '‘새로운 필드 추가’ → 텍스트 → 키는 text, 값은 변수 ‘단축어 입력’.',
      },
      {
        title: '(선택) 동작 추가 → ‘알림 보기’ → 내용에 ‘URL의 콘텐츠’',
        detail: '기록될 때마다 “가계부 ✓ 12,500원 · GS25” 배너가 떠요. 조용히 쓰려면 생략.',
      },
    ],
  },
  sms: {
    label: '문자',
    badge: 'iOS 17+',
    steps: [
      {
        title: '카드사에 승인 문자(SMS) 알림 신청',
        detail: '앱 푸시만 받고 있다면 필요해요. 보통 월 300원 안팎, 카드사 앱에서 신청해요.',
      },
      { title: '단축어 → 자동화 → ＋ → ‘메시지’' },
      { title: '‘메시지에 포함’에 ‘승인’ 입력', detail: '보낸 사람을 카드사 번호로 정해도 돼요.' },
      { title: '‘즉시 실행’ → 다음 → ‘새로운 빈 자동화’' },
      { title: '동작 ‘URL의 콘텐츠 가져오기’ → URL에 내 전용 주소', copy: true },
      { title: '방법 POST, 요청 본문 JSON, 필드 text = 변수 ‘단축어 입력’' },
    ],
  },
  applepay: {
    label: 'Apple Pay',
    badge: 'iOS 17+',
    steps: [
      {
        title: '단축어 → 자동화 → ＋ → ‘거래’',
        detail: 'Apple Pay로 결제하는 카드일 때만 쓸 수 있어요.',
      },
      { title: '카드 고르고 ‘즉시 실행’ → 다음 → ‘새로운 빈 자동화’' },
      { title: '동작 ‘URL의 콘텐츠 가져오기’ → URL에 내 전용 주소', copy: true },
      {
        title: '방법 POST, 요청 본문 JSON',
        detail:
          '필드 text에 ‘단축어 입력’의 금액, 한 칸 띄우고 가맹점(판매처)을, 필드 title에 카드 이름을 넣어요. 변수를 탭하면 항목을 고를 수 있어요.',
      },
    ],
  },
};

function ShortcutGuide({ onCopy }: { onCopy: () => void }) {
  const [tab, setTab] = useState<keyof typeof GUIDES>('notification');
  const guide = GUIDES[tab];
  return (
    <div>
      <div
        className="grid grid-cols-3 gap-1 rounded-xl p-1"
        style={{ background: 'var(--color-gray-100)' }}
      >
        {(Object.keys(GUIDES) as Array<keyof typeof GUIDES>).map((k) => {
          const on = k === tab;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              className="tap rounded-lg py-2"
              style={{
                background: on ? 'var(--color-card)' : 'transparent',
                boxShadow: on ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              }}
            >
              <span
                className="block"
                style={{
                  color: on ? 'var(--color-text-1)' : 'var(--color-text-3)',
                  fontSize: 12.5,
                  fontWeight: 800,
                }}
              >
                {GUIDES[k].label}
              </span>
              <span
                className="block"
                style={{ color: 'var(--color-text-3)', fontSize: 10, fontWeight: 600 }}
              >
                {GUIDES[k].badge}
              </span>
            </button>
          );
        })}
      </div>
      <ol className="mt-3 space-y-2.5">
        {guide.steps.map((s, i) => (
          <li key={s.title} className="flex gap-2.5">
            <span
              className="tnum mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
              style={{
                background: 'var(--color-primary-soft)',
                color: 'var(--color-primary)',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p
                style={{
                  color: 'var(--color-text-1)',
                  fontSize: 13,
                  fontWeight: 700,
                  lineHeight: 1.45,
                }}
              >
                {s.title}
              </p>
              {s.detail && (
                <p
                  className="mt-0.5"
                  style={{ color: 'var(--color-text-3)', fontSize: 11.5, lineHeight: 1.45 }}
                >
                  {s.detail}
                </p>
              )}
              {s.copy && (
                <button
                  type="button"
                  onClick={onCopy}
                  className="tap mt-1.5 inline-flex items-center gap-1 rounded-full px-3 py-1.5"
                  style={{
                    background: 'var(--color-primary)',
                    color: '#fff',
                    fontSize: 11.5,
                    fontWeight: 800,
                  }}
                >
                  <Copy size={12} strokeWidth={2.6} />내 전용 주소 복사
                </button>
              )}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3" style={{ color: 'var(--color-text-3)', fontSize: 11, lineHeight: 1.45 }}>
        메뉴 이름은 iOS 버전에 따라 조금 다를 수 있어요. 다 만들었으면 실제로 한 번 결제해 보고 앱을
        열어 보세요.
      </p>
    </div>
  );
}

function CardLinks() {
  const toast = useToast();
  const { accounts, update } = useAllAccounts();
  const linkable = accounts.filter((a) => a.type === 'card' || a.type === 'bank');
  if (linkable.length === 0) {
    return (
      <p style={{ color: 'var(--color-text-3)', fontSize: 12 }}>
        카드나 계좌를 먼저 추가하면 여기서 연결할 수 있어요.
      </p>
    );
  }
  return (
    <>
      <p className="mb-2.5 leading-snug" style={{ color: 'var(--color-text-3)', fontSize: 11.5 }}>
        알림에 찍히는 카드 번호 끝 4자리를 적어두면 그 카드로 기록돼요. 비워두면 카드사 이름으로,
        그래도 모르면 주거래 계좌로 들어가요.
      </p>
      <div className="overflow-hidden rounded-xl" style={{ background: 'var(--color-gray-50)' }}>
        {linkable.map((a, i) => (
          <CardLinkRow
            key={a.id}
            account={a}
            last={i === linkable.length - 1}
            onSave={(last4) => {
              update(a.id, { last4: last4 || undefined });
              toast.show(last4 ? `${a.name} ****${last4} 연결` : `${a.name} 연결 해제`, 'info');
            }}
          />
        ))}
      </div>
    </>
  );
}

function CardLinkRow({
  account,
  last,
  onSave,
}: {
  account: Account;
  last: boolean;
  onSave: (last4: string) => void;
}) {
  const [draft, setDraft] = useState(account.last4 ?? '');
  useEffect(() => setDraft(account.last4 ?? ''), [account.last4]);
  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5"
      style={{ borderBottom: last ? 'none' : '1px solid var(--color-divider)' }}
    >
      {account.type === 'card' ? (
        <CardIcon name={account.bank || account.name} size={30} />
      ) : (
        <BankIcon name={account.bank || account.name} size={32} />
      )}
      <div className="min-w-0 flex-1">
        <p
          className="truncate"
          style={{ color: 'var(--color-text-1)', fontSize: 13.5, fontWeight: 700 }}
        >
          {account.name}
        </p>
        <p className="truncate" style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
          {account.bank || (account.type === 'card' ? '카드' : '계좌')}
        </p>
      </div>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 4))}
        onBlur={() => {
          if (draft !== (account.last4 ?? '') && (draft.length === 4 || draft.length === 0))
            onSave(draft);
        }}
        inputMode="numeric"
        placeholder="끝 4자리"
        aria-label={`${account.name} 카드 끝 4자리`}
        className="tnum h-9 w-[84px] rounded-lg px-2 text-center outline-none"
        style={{
          background: 'var(--color-card)',
          color: 'var(--color-text-1)',
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: draft ? '0.12em' : undefined,
        }}
      />
    </div>
  );
}

function sampleTime(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getMonth() + 1)}/${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const SAMPLES: Array<{ label: string; make: () => string }> = [
  {
    label: '신한 문자',
    make: () =>
      `[Web발신]\n신한카드(1234)승인 홍*동 4,500원(일시불)${sampleTime()} 스타벅스 역삼점 누적512,300원`,
  },
  { label: '토스 푸시', make: () => 'GS25 역삼점에서 3,200원 결제했어요' },
  {
    label: '해외 결제',
    make: () => `[Web발신]\nKB국민카드1234 해외승인 홍*동님 USD 9.99 ${sampleTime()} NETFLIX.COM`,
  },
  {
    label: '승인취소',
    make: () =>
      `[Web발신]\n신한카드(1234)승인취소 홍*동 4,500원(일시불)${sampleTime()} 스타벅스 역삼점`,
  },
];

const REASON_LABEL = {
  declined: '승인 거절 알림이라 기록하지 않아요',
  'not-transaction': '결제 알림이 아니라 건너뛰어요',
  'no-amount': '금액을 찾지 못했어요 — 수신함에 ‘확인 필요’로 남아요',
} as const;

function TestPanel({ inboxKey }: { inboxKey: string }) {
  const toast = useToast();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const deferred = useDeferredValue(text);
  const preview = useMemo(
    () => (deferred.trim() ? previewNotification(deferred) : null),
    [deferred],
  );

  const send = async () => {
    setSending(true);
    try {
      const reply = await sendTestNotification(inboxKey, text);
      const s = await syncInbox({ force: true });
      // The newest log entry is the one this test just produced.
      const latest = readStorageValue<InboxLogEntry[]>(KEYS.inboxLog, [])[0];
      const testTxId = s?.added && latest?.status === 'added' ? latest.txId : undefined;
      toast.show((s && describeSync(s)) || reply, {
        variant: testTxId ? 'success' : 'info',
        durationMs: 6000,
        action: testTxId
          ? { label: '되돌리기', onClick: () => removeTransaction(testTxId) }
          : undefined,
      });
      if (testTxId) setText('');
    } catch {
      toast.show('보내지 못했어요 — 인터넷 연결을 확인해 주세요', 'error');
    } finally {
      setSending(false);
    }
  };

  const ok = preview?.result.ok ? preview.result.notice : null;
  return (
    <div>
      <p className="mb-2 leading-snug" style={{ color: 'var(--color-text-3)', fontSize: 11.5 }}>
        받은 결제 알림 문구를 붙여넣으면 어떻게 기록될지 미리 보여줘요. 보내기를 누르면 서버를 거쳐
        실제로 기록돼요.
      </p>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {SAMPLES.map((s) => (
          <button
            key={s.label}
            type="button"
            onClick={() => setText(s.make())}
            className="tap rounded-full px-2.5 py-1"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-2)',
              fontSize: 11.5,
              fontWeight: 700,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={4}
        placeholder={'예) 신한카드(1234)승인 홍*동 12,500원(일시불)\n11/08 14:23 GS25 역삼점'}
        className="w-full resize-none rounded-xl px-3.5 py-3 outline-none"
        style={{
          background: 'var(--color-gray-100)',
          color: 'var(--color-text-1)',
          fontSize: 13,
          fontWeight: 500,
          lineHeight: 1.5,
        }}
      />

      {preview && (
        <div
          className="mt-2 rounded-xl px-3.5 py-3"
          style={{ background: ok ? 'var(--color-primary-soft)' : 'var(--color-gray-100)' }}
        >
          {ok ? (
            <>
              <div className="flex items-center gap-2.5">
                {preview.cat && (
                  <MerchantAvatar merchant={ok.merchant} catId={preview.cat} size={32} badge />
                )}
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate"
                    style={{ color: 'var(--color-text-1)', fontSize: 14, fontWeight: 800 }}
                  >
                    {noticeSummary(ok)}
                  </p>
                  <p
                    className="truncate"
                    style={{ color: 'var(--color-text-2)', fontSize: 11.5, fontWeight: 600 }}
                  >
                    {[
                      ok.kind === 'cancel' ? '승인취소' : CATEGORIES[preview.cat ?? '']?.name,
                      preview.account?.name,
                      ok.issuer ? `${ok.issuer}${ok.last4 ? ` ${ok.last4}` : ''}` : null,
                      ok.installment ? `${ok.installment}개월` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                </div>
              </div>
              {ok.date && (
                <p className="mt-1.5" style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                  {ok.date.toLocaleString('ko-KR', {
                    month: 'long',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </p>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--color-text-2)', fontSize: 12, fontWeight: 600 }}>
              {preview.result.ok ? '' : REASON_LABEL[preview.result.reason]}
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={send}
        disabled={!text.trim() || sending}
        className="tap mt-2.5 flex h-11 w-full items-center justify-center gap-1.5 rounded-xl"
        style={{
          background: text.trim() ? 'var(--color-text-1)' : 'var(--color-gray-200)',
          color: text.trim() ? 'var(--color-card)' : 'var(--color-text-4)',
          fontSize: 13.5,
          fontWeight: 800,
        }}
      >
        <Send size={15} strokeWidth={2.6} />
        {sending ? '보내는 중…' : '서버로 보내서 기록해 보기'}
      </button>
    </div>
  );
}
