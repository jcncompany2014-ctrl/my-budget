'use client';

import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import {
  cloudSyncConfigured,
  setCloudSyncOff,
  useCloudLog,
  useCloudOff,
  useCloudStatus,
} from '@/lib/cloud-sync';

const fmtWhen = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

export default function ClaudeLinkPage() {
  const router = useRouter();
  const { value: status } = useCloudStatus();
  const { value: log } = useCloudLog();
  const { value: offFlag } = useCloudOff();
  const configured = cloudSyncConfigured();
  const off = offFlag === 1;

  const headline = !configured
    ? '이 빌드에는 연결 설정이 없어요'
    : off
      ? '꺼짐'
      : status?.status === 'approved'
        ? '연결됨'
        : status
          ? '승인 대기'
          : '연결 중…';
  const tone =
    configured && !off && status?.status === 'approved'
      ? 'var(--color-primary)'
      : 'var(--color-text-1)';

  return (
    <>
      <TopBar
        title="Claude 연결"
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
        <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
          <p style={{ color: tone, fontSize: 'var(--text-lg)', fontWeight: 800 }}>{headline}</p>
          {configured && !off && status && (
            <p
              className="tnum mt-1"
              style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}
            >
              기기 코드 {status.code} · {fmtWhen(status.at)} 확인
            </p>
          )}
          <p
            className="mt-3"
            style={{ color: 'var(--color-text-2)', fontSize: 'var(--text-xs)', lineHeight: 1.6 }}
          >
            가계부 데이터의 사본이 내 Supabase에 올라가고, Claude가 대화에서 요청받은 수정을 이
            기기로 보내요. 승인 전에는 아무것도 올라가지 않아요.
          </p>
        </div>
      </section>

      {configured && (
        <section className="px-5 pb-3">
          <button
            type="button"
            onClick={() => setCloudSyncOff(!off)}
            className="tap flex w-full items-center justify-between rounded-2xl px-4 py-4"
            style={{ background: 'var(--color-card)' }}
            aria-pressed={!off}
          >
            <span
              style={{
                color: 'var(--color-text-1)',
                fontSize: 'var(--text-base)',
                fontWeight: 700,
              }}
            >
              연결 사용
            </span>
            <span
              className="relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors"
              style={{ background: off ? 'var(--color-gray-300)' : 'var(--color-primary)' }}
            >
              <span
                className="absolute h-6 w-6 rounded-full bg-white shadow transition-transform"
                style={{ transform: off ? 'translateX(2px)' : 'translateX(22px)' }}
              />
            </span>
          </button>
        </section>
      )}

      {log.length > 0 && (
        <section className="px-5 pb-6 pt-2">
          <h2
            className="mb-2"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-base)', fontWeight: 700 }}
          >
            Claude가 수정한 내역
          </h2>
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {log.map((l, i) => (
              <div
                key={`${l.at}-${i}`}
                className="flex items-center justify-between gap-3 px-4 py-3"
                style={{
                  borderBottom: i < log.length - 1 ? '1px solid var(--color-divider)' : undefined,
                }}
              >
                <p
                  className="min-w-0 truncate"
                  style={{
                    color: l.result === 'ok' ? 'var(--color-text-1)' : 'var(--color-danger)',
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                  }}
                >
                  {l.note}
                  {l.result === 'ok' ? '' : ' · 실패'}
                </p>
                <span
                  className="tnum shrink-0"
                  style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)' }}
                >
                  {fmtWhen(l.at)}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
