'use client';

import { Briefcase, Repeat } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import IconCircle from '@/components/ui/IconCircle';
import { useToast } from '@/components/Toast';
import { detectRecurringPatterns, detectSalaryIncome } from '@/lib/auto-categorize';
import { fmt } from '@/lib/format';
import { useAllRecurring } from '@/lib/recurring';
import { useAllTransactions } from '@/lib/storage';
import type { RecurringItem } from '@/lib/types';

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
          (r) =>
            r.scope === p.scope &&
            r.name.toLowerCase() === p.merchant.toLowerCase(),
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

  if (recurringSuggestions.length === 0 && salaryHints.length === 0) return null;

  return (
    <section className="px-5 pb-3 pt-1">
      <div className="space-y-2">
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
                  width: 32, height: 32,
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
                  width: 32, height: 32,
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
