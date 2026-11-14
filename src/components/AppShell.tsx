'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useToast } from '@/components/Toast';
import { ensureAutoBackup } from '@/lib/auto-backup';
import { ensureAutoCardPayment } from '@/lib/auto-card-payment';
import { ensureAutoCreditLine } from '@/lib/auto-credit-line';
import { ensureAutoLoanPayment } from '@/lib/auto-loan-payment';
import { ensureAutoPayroll } from '@/lib/auto-payroll';
import { ensureAutoRecurring } from '@/lib/auto-recurring';
import { todayKey } from '@/lib/dates';
import { isFullscreenRoute } from '@/lib/nav';
import { STORAGE_FULL_EVENT } from '@/lib/safe-storage';
import BottomNav from './BottomNav';
import CloudSync from './CloudSync';
import InboxSync from './InboxSync';
import ServiceWorker from './ServiceWorker';

// Idempotent maintenance: today's backup snapshot and anything due today
// (정기결제 · 대출 상환 · 이자 · 인건비 · 카드대금).
function runMaintenance() {
  ensureAutoBackup();
  ensureAutoPayroll();
  ensureAutoRecurring();
  ensureAutoLoanPayment();
  ensureAutoCreditLine();
  // Last: the bill is what the card owes after everything else has posted.
  ensureAutoCardPayment();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const hideNav = isFullscreenRoute(pathname);
  const toast = useToast();
  // The installed app is rarely closed — it is resumed, often days later, with
  // every "today" on screen frozen at the day it was last opened. When the
  // date has changed on return, post what fell due and redraw the page.
  const [day, setDay] = useState('');
  const seenDay = useRef('');
  const fullscreen = useRef(hideNav);
  fullscreen.current = hideNav;

  useEffect(() => {
    // After first paint, not on the critical path: each step reads several
    // large localStorage values and may write back.
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    seenDay.current = todayKey();
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(runMaintenance, { timeout: 1500 });
    } else {
      setTimeout(runMaintenance, 50);
    }

    const onResume = () => {
      if (document.visibilityState !== 'visible') return;
      const now = todayKey();
      if (now === seenDay.current) return;
      seenDay.current = now;
      runMaintenance();
      // A half-filled entry form keeps its state; everything else redraws.
      if (!fullscreen.current) setDay(now);
    };
    document.addEventListener('visibilitychange', onResume);
    window.addEventListener('pageshow', onResume);

    // A write that did not fit must never pass silently — the change is not saved.
    let lastWarned = 0;
    const onFull = () => {
      if (Date.now() - lastWarned < 10_000) return;
      lastWarned = Date.now();
      toast.show('저장 공간이 가득 차서 저장하지 못했어요', { variant: 'error', durationMs: 6000 });
    };
    window.addEventListener(STORAGE_FULL_EVENT, onFull);

    return () => {
      document.removeEventListener('visibilitychange', onResume);
      window.removeEventListener('pageshow', onResume);
      window.removeEventListener(STORAGE_FULL_EVENT, onFull);
    };
  }, [toast]);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col shadow-[0_0_40px_rgba(0,0,0,0.06)]"
      style={{ background: 'var(--color-bg)' }}
    >
      <main key={day} className="flex flex-1 flex-col">
        {children}
      </main>
      {!hideNav && <BottomNav />}
      <InboxSync />
      <CloudSync />
      <ServiceWorker />
    </div>
  );
}
