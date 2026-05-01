'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { ensureAutoBackup } from '@/lib/auto-backup';
import { ensureAutoCreditLine } from '@/lib/auto-credit-line';
import { ensureAutoLoanPayment } from '@/lib/auto-loan-payment';
import { ensureAutoPayroll } from '@/lib/auto-payroll';
import { ensureAutoRecurring } from '@/lib/auto-recurring';
import BottomNav from './BottomNav';

const HIDE_NAV_PREFIXES = ['/add', '/tx/', '/transfer', '/quick-add'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const hideNav = HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    // Run idempotent maintenance after first paint, not on the critical path.
    // Each ensureAutoX reads several large localStorage values and may write
    // back; doing all of them synchronously inside the layout's useEffect
    // delayed visible content on slower devices. requestIdleCallback yields
    // until the browser has spare time (or the timeout fires).
    const run = () => {
      ensureAutoBackup();
      ensureAutoPayroll();
      ensureAutoRecurring();
      ensureAutoLoanPayment();
      ensureAutoCreditLine();
    };
    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
    };
    if (typeof w.requestIdleCallback === 'function') {
      w.requestIdleCallback(run, { timeout: 1500 });
    } else {
      setTimeout(run, 50);
    }
  }, []);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col shadow-[0_0_40px_rgba(0,0,0,0.06)]"
      style={{ background: 'var(--color-bg)' }}
    >
      <main className="flex flex-1 flex-col">{children}</main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
