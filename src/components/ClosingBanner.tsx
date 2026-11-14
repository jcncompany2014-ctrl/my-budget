'use client';

import { ChevronRight, Sparkles, X } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useMode } from '@/components/ModeProvider';
import { previousMonthKey } from '@/lib/closing';
import { useTransactions } from '@/lib/storage';

/**
 * Days 1–7 of a month: "N월 결산이 준비됐어요" → /reports/closing?ym=YYYY-MM.
 * Only when last month actually has records; dismissible per month.
 */
export default function ClosingBanner() {
  const { tx, ready } = useTransactions();
  const { mode } = useMode();
  const ym = previousMonthKey();
  const dismissKey = `asset/closing-banner-dismissed/v1/${mode}/${ym}`;
  const [dismissed, setDismissed] = useState(true); // avoid SSR flash; read on mount

  useEffect(() => {
    try {
      setDismissed(window.localStorage.getItem(dismissKey) === '1');
    } catch {
      setDismissed(false);
    }
  }, [dismissKey]);

  const hasLastMonth = useMemo(() => {
    const [y, m] = ym.split('-').map(Number);
    return tx.some((t) => {
      const d = new Date(t.date);
      return d.getFullYear() === y && d.getMonth() === m - 1;
    });
  }, [tx, ym]);

  if (!ready || dismissed || !hasLastMonth || new Date().getDate() > 7) return null;

  const monthLabel = `${Number(ym.slice(5))}월`;

  return (
    <section className="px-5 pb-3">
      <div
        className="relative flex items-center gap-3 overflow-hidden rounded-2xl px-4 py-3.5"
        style={{
          background: 'linear-gradient(120deg, #1B1F3B 0%, #2E3561 100%)',
          boxShadow: '0 4px 16px rgba(27, 31, 59, 0.25)',
        }}
      >
        <Link
          href={`/reports/closing?ym=${ym}`}
          className="tap flex min-w-0 flex-1 items-center gap-3"
        >
          <span
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.14)', color: '#FFD66B' }}
          >
            <Sparkles size={18} strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1" style={{ color: '#fff', fontSize: 14, fontWeight: 800 }}>
            {monthLabel} 결산이 준비됐어요
          </span>
          <ChevronRight size={18} strokeWidth={2.4} color="rgba(255,255,255,0.7)" />
        </Link>
        <button
          type="button"
          aria-label="닫기"
          onClick={() => {
            try {
              window.localStorage.setItem(dismissKey, '1');
            } catch {
              /* ignore */
            }
            setDismissed(true);
          }}
          className="tap -mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
          style={{ color: 'rgba(255,255,255,0.55)' }}
        >
          <X size={14} strokeWidth={2.6} />
        </button>
      </div>
    </section>
  );
}
