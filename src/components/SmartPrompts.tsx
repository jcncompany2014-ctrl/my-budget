'use client';

import { Briefcase, Repeat, ShieldAlert } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@/components/Toast';
import { lastAutoBackupAt } from '@/lib/auto-backup';
import { detectRecurringPatterns, detectSalaryIncome } from '@/lib/auto-categorize';
import { downloadBackup } from '@/lib/backup';
import { fmt } from '@/lib/format';
import { useAllRecurring } from '@/lib/recurring';
import { useAllTransactions } from '@/lib/storage';
import type { RecurringItem } from '@/lib/types';

const BACKUP_REMIND_AFTER_DAYS = 30;

const DISMISS_KEY = 'asset/smart-dismissed/v1';

function readDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    return new Set(JSON.parse(window.localStorage.getItem(DISMISS_KEY) ?? '[]'));
  } catch {
    return new Set();
  }
}

function saveDismissed(s: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(DISMISS_KEY, JSON.stringify(Array.from(s)));
}

export default function SmartPrompts() {
  const { tx } = useAllTransactions();
  const { items: recurring, add: addRecurring } = useAllRecurring();
  const toast = useToast();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setDismissed(readDismissed());
  }, []);

  const dismiss = (key: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(key);
      saveDismissed(next);
      return next;
    });
  };

  const recurringSuggestions = useMemo(() => {
    const patterns = detectRecurringPatterns(tx);
    return patterns.filter((p) => {
      const key = `recurring:${p.scope}:${p.merchant}`;
      if (dismissed.has(key)) return false;
      // Already registered?
      if (
        recurring.some(
          (r) => r.scope === p.scope && r.name.toLowerCase() === p.merchant.toLowerCase(),
        )
      )
        return false;
      return true;
    });
  }, [tx, recurring, dismissed]);

  const salaryHints = useMemo(() => {
    const hints = detectSalaryIncome(tx);
    return hints
      .filter((h) => !dismissed.has(`salary:${h.id}`))
      .filter((h) => h.cat !== 'salary' && h.cat !== 'biz_sales_xfer')
      .slice(0, 1);
  }, [tx, dismissed]);

  // Backup nag — surface a soft reminder when the auto-backup snapshot is
  // older than 30 days (or has never run). Local-only data; this is the most
  // important habit to keep alive.
  const backupNagKey = useMemo(() => {
    if (tx.length < 5) return null; // don't nag empty installs
    const last = lastAutoBackupAt();
    const daysSince = last
      ? Math.floor((Date.now() - last.getTime()) / 86400000)
      : Number.POSITIVE_INFINITY;
    if (daysSince < BACKUP_REMIND_AFTER_DAYS) return null;
    const key = `backup:${last ? last.toISOString().slice(0, 10) : 'never'}`;
    if (dismissed.has(key)) return null;
    return { key, daysSince, last };
  }, [tx.length, dismissed]);

  if (recurringSuggestions.length === 0 && salaryHints.length === 0 && !backupNagKey) {
    return null;
  }

  return (
    <section className="px-5 pb-3 pt-1">
      <div className="space-y-2">
        {backupNagKey && (
          <div
            className="flex items-start gap-3 rounded-2xl px-4 py-3"
            style={{ background: 'rgba(180, 83, 9, 0.10)' }}
          >
            <span
              aria-hidden
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: '#B45309',
                color: '#fff',
                flexShrink: 0,
              }}
            >
              <ShieldAlert size={16} strokeWidth={2.4} />
            </span>
            <div className="min-w-0 flex-1">
              <p style={{ color: '#B45309', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
                백업이 오래됐어요
              </p>
              <p
                className="mt-0.5"
                style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)' }}
              >
                {Number.isFinite(backupNagKey.daysSince)
                  ? `마지막 자동 백업이 ${backupNagKey.daysSince}일 전이에요.`
                  : '아직 백업 파일이 없어요.'}{' '}
                브라우저 캐시가 지워지면 데이터가 사라져요.
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    downloadBackup();
                    toast.show('백업 파일을 저장했어요', 'success');
                    dismiss(backupNagKey.key);
                  }}
                  className="tap rounded-full px-3 py-1.5"
                  style={{
                    background: '#B45309',
                    color: '#fff',
                    fontSize: 'var(--text-xxs)',
                    fontWeight: 700,
                  }}
                >
                  지금 백업
                </button>
                <Link
                  href="/settings"
                  className="tap rounded-full px-3 py-1.5"
                  style={{
                    background: 'transparent',
                    color: '#B45309',
                    fontSize: 'var(--text-xxs)',
                    fontWeight: 700,
                  }}
                >
                  설정에서
                </Link>
                <button
                  type="button"
                  onClick={() => dismiss(backupNagKey.key)}
                  className="tap rounded-full px-3 py-1.5"
                  style={{
                    background: 'transparent',
                    color: 'var(--color-text-3)',
                    fontSize: 'var(--text-xxs)',
                    fontWeight: 700,
                  }}
                >
                  나중에
                </button>
              </div>
            </div>
          </div>
        )}

        {recurringSuggestions.slice(0, 1).map((s) => {
          const key = `recurring:${s.scope}:${s.merchant}`;
          const day = s.daysOfMonth.sort((a, b) => a - b)[Math.floor(s.daysOfMonth.length / 2)];
          return (
            <div
              key={key}
              className="flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{ background: 'var(--color-primary-soft)' }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: 'var(--color-primary)',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <Repeat size={16} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p
                  style={{
                    color: 'var(--color-primary)',
                    fontSize: 'var(--text-xxs)',
                    fontWeight: 700,
                  }}
                >
                  정기결제 자동 발견
                </p>
                <p
                  className="mt-0.5"
                  style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)' }}
                >
                  <span style={{ fontWeight: 700 }}>{s.merchant}</span> · 매월 약 {day}일에{' '}
                  <span className="tnum">{fmt(s.amount)}원</span>
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const item: RecurringItem = {
                        id: 'r-' + Date.now().toString(36),
                        name: s.merchant,
                        emoji: '🔁',
                        amount: s.amount,
                        day,
                        cat: s.cat,
                        scope: s.scope,
                      };
                      addRecurring(item);
                      dismiss(key);
                      toast.show('정기결제로 등록 완료', 'success');
                    }}
                    className="tap rounded-full px-3 py-1.5"
                    style={{
                      background: 'var(--color-primary)',
                      color: '#fff',
                      fontSize: 'var(--text-xxs)',
                      fontWeight: 700,
                    }}
                  >
                    등록하기
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(key)}
                    className="tap rounded-full px-3 py-1.5"
                    style={{
                      background: 'transparent',
                      color: 'var(--color-text-3)',
                      fontSize: 'var(--text-xxs)',
                      fontWeight: 700,
                    }}
                  >
                    숨기기
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {salaryHints.map((h) => {
          const key = `salary:${h.id}`;
          return (
            <div
              key={key}
              className="flex items-start gap-3 rounded-2xl px-4 py-3"
              style={{ background: '#FFF6E5' }}
            >
              <span
                aria-hidden
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  background: '#B45309',
                  color: '#fff',
                  flexShrink: 0,
                }}
              >
                <Briefcase size={16} strokeWidth={2.4} />
              </span>
              <div className="min-w-0 flex-1">
                <p style={{ color: '#B45309', fontSize: 'var(--text-xxs)', fontWeight: 700 }}>
                  급여로 보이는 거래
                </p>
                <p
                  className="mt-0.5"
                  style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-xs)' }}
                >
                  <span style={{ fontWeight: 700 }}>{h.merchant}</span>{' '}
                  <span className="tnum">+{fmt(h.amount)}원</span> — 카테고리를 '급여'로 바꿀까요?
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      // Re-tag the tx
                      if (typeof window !== 'undefined') {
                        try {
                          const raw = window.localStorage.getItem('asset/transactions/v2');
                          if (raw) {
                            const list = JSON.parse(raw) as { id: string; cat: string }[];
                            const next = list.map((t) =>
                              t.id === h.id ? { ...t, cat: 'salary' } : t,
                            );
                            window.localStorage.setItem(
                              'asset/transactions/v2',
                              JSON.stringify(next),
                            );
                          }
                        } catch {
                          /* ignore */
                        }
                      }
                      dismiss(key);
                      toast.show('급여로 재분류 완료', 'success');
                      setTimeout(() => window.location.reload(), 200);
                    }}
                    className="tap rounded-full px-3 py-1.5"
                    style={{
                      background: '#B45309',
                      color: '#fff',
                      fontSize: 'var(--text-xxs)',
                      fontWeight: 700,
                    }}
                  >
                    급여로 변경
                  </button>
                  <button
                    type="button"
                    onClick={() => dismiss(key)}
                    className="tap rounded-full px-3 py-1.5"
                    style={{
                      background: 'transparent',
                      color: 'var(--color-text-3)',
                      fontSize: 'var(--text-xxs)',
                      fontWeight: 700,
                    }}
                  >
                    아니요
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
