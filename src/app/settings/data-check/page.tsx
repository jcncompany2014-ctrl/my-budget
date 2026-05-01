'use client';

import { CheckCircle2, ShieldCheck, Wrench } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import TopBar from '@/components/TopBar';
import { useToast } from '@/components/Toast';
import EmptyState from '@/components/ui/EmptyState';
import { applyRepair, checkDataIntegrity, type IntegrityReport } from '@/lib/data-check';

export default function DataCheckPage() {
  const router = useRouter();
  const toast = useToast();
  const [report, setReport] = useState<IntegrityReport | null>(null);

  const run = useCallback(() => {
    setReport(checkDataIntegrity());
  }, []);

  useEffect(() => {
    run();
  }, [run]);

  const handleRepair = (issueId: string) => {
    if (!report) return;
    const issue = report.issues.find((i) => i.id === issueId);
    if (!issue) return;
    const ok = applyRepair(issue);
    if (ok) {
      toast.show('수정 완료', 'success');
      // Re-scan, then nudge other open pages to refresh by way of
      // a small delay before the next paint.
      setTimeout(run, 50);
    } else {
      toast.show('자동 수정이 불가능한 항목이에요', 'info');
    }
  };

  const repairAll = () => {
    if (!report) return;
    let n = 0;
    for (const issue of report.issues) {
      if (issue.repair && applyRepair(issue)) n++;
    }
    toast.show(`${n}건 자동 수정 완료`, 'success');
    setTimeout(run, 50);
  };

  return (
    <>
      <TopBar
        title="데이터 무결성"
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
          저장된 거래 / 계좌 / 카테고리의 일관성을 검사합니다. 백업 복원 후나 수동 편집
          후에 한 번씩 돌려보세요.
        </p>
      </section>

      {report && (
        <section className="px-5 pb-3 pt-1">
          <div className="rounded-2xl p-5" style={{ background: 'var(--color-card)' }}>
            <div className="flex items-center gap-3">
              {report.issues.length === 0 ? (
                <ShieldCheck size={28} color="var(--color-primary)" strokeWidth={2.4} />
              ) : (
                <Wrench
                  size={28}
                  color={report.summary.errors > 0 ? 'var(--color-danger)' : '#B45309'}
                  strokeWidth={2.4}
                />
              )}
              <div>
                <p
                  style={{
                    color: 'var(--color-text-1)',
                    fontSize: 'var(--text-base)',
                    fontWeight: 800,
                  }}
                >
                  {report.issues.length === 0
                    ? '문제 없음'
                    : `${report.issues.length}건 발견`}
                </p>
                <p style={{ color: 'var(--color-text-3)', fontSize: 11 }}>
                  거래 {report.summary.transactions}건 · 계좌 {report.summary.accounts}개 ·
                  오류 {report.summary.errors} / 경고 {report.summary.warnings}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={run}
                className="tap h-10 flex-1 rounded-xl text-sm font-bold"
                style={{ background: 'var(--color-gray-100)', color: 'var(--color-text-1)' }}
              >
                다시 검사
              </button>
              {report.issues.some((i) => i.repair) && (
                <button
                  type="button"
                  onClick={repairAll}
                  className="tap h-10 flex-1 rounded-xl text-sm font-bold"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                  전부 자동 수정
                </button>
              )}
            </div>
          </div>
        </section>
      )}

      {report && report.issues.length === 0 && (
        <section className="px-5 pb-10 pt-2">
          <EmptyState
            icon={CheckCircle2}
            iconColor="var(--color-primary)"
            title="모든 데이터가 정상이에요"
            hint="누락된 계좌·카테고리 참조 없음, 이체 짝 모두 매칭, 잔액 표류 없음"
          />
        </section>
      )}

      {report && report.issues.length > 0 && (
        <section className="px-5 pb-10 pt-2">
          <div className="space-y-2">
            {report.issues.map((issue) => (
              <div
                key={issue.id}
                className="rounded-2xl p-4"
                style={{ background: 'var(--color-card)' }}
              >
                <div className="flex items-start gap-3">
                  <span
                    style={{
                      display: 'inline-block',
                      marginTop: 6,
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      background:
                        issue.severity === 'error'
                          ? 'var(--color-danger)'
                          : 'var(--color-orange-500, #B45309)',
                      flexShrink: 0,
                    }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      style={{
                        color: 'var(--color-text-1)',
                        fontSize: 'var(--text-sm)',
                        fontWeight: 700,
                      }}
                    >
                      {issue.title}
                    </p>
                    <p
                      className="mt-0.5"
                      style={{
                        color: 'var(--color-text-3)',
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      {issue.detail}
                    </p>
                  </div>
                  {issue.repair && (
                    <button
                      type="button"
                      onClick={() => handleRepair(issue.id)}
                      className="tap shrink-0 rounded-full px-3 py-1.5"
                      style={{
                        background: 'var(--color-primary-soft)',
                        color: 'var(--color-primary)',
                        fontSize: 'var(--text-xxs)',
                        fontWeight: 800,
                      }}
                    >
                      수정
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
