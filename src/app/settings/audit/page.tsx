'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import TopBar from '@/components/TopBar';
import { clearAudit, readAudit, type AuditEvent } from '@/lib/audit';
import { useToast } from '@/components/Toast';

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleString('ko-KR', {
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

export default function AuditPage() {
  const router = useRouter();
  const toast = useToast();
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    setEvents(readAudit());
  }, []);

  return (
    <>
      <TopBar
        title="활동 로그"
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
        <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
          최근 50개의 동작 기록. 디버깅이나 복구에 활용됩니다.
        </p>
      </section>

      <section className="px-5 pb-3 pt-1">
        {events.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center" style={{ background: 'var(--color-card)' }}>
            <p style={{ fontSize: 32, lineHeight: 1 }}>📜</p>
            <p className="mt-2" style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 700 }}>
              기록된 활동이 없어요
            </p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl" style={{ background: 'var(--color-card)' }}>
            {events.map((e, i) => (
              <div
                key={e.id}
                className="flex items-start gap-3 px-4 py-3"
                style={{ borderBottom: i < events.length - 1 ? '1px solid var(--color-divider)' : 'none' }}
              >
                <div
                  className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: 'var(--color-primary)' }}
                />
                <div className="min-w-0 flex-1">
                  <p style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                    {e.action}
                  </p>
                  {e.detail && (
                    <p className="mt-0.5 truncate" style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xs)' }}>
                      {e.detail}
                    </p>
                  )}
                  <p style={{ color: 'var(--color-text-3)', fontSize: 'var(--text-xxs)', marginTop: 4 }}>
                    {fmtTime(e.at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {events.length > 0 && (
        <section className="px-5 pb-10 pt-2">
          <button
            type="button"
            onClick={() => {
              clearAudit();
              setEvents([]);
              toast.show('로그 초기화 완료', 'info');
            }}
            className="tap w-full rounded-xl py-3"
            style={{
              background: 'var(--color-danger-soft)',
              color: 'var(--color-danger)',
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
            }}
          >
            로그 초기화
          </button>
        </section>
      )}
    </>
  );
}
