'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import BottomNav from './BottomNav';
import { ensureAutoBackup } from '@/lib/auto-backup';
import { ensureAutoPayroll } from '@/lib/auto-payroll';

const HIDE_NAV_PREFIXES = ['/add', '/tx/', '/transfer', '/quick-add'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const hideNav = HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    // Run idempotent maintenance once per app load
    ensureAutoBackup();
    ensureAutoPayroll();
  }, []);

  return (
    <div
      className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col shadow-[0_0_40px_rgba(0,0,0,0.06)]"
      style={{ background: 'var(--color-bg)' }}
    >
      <main key={pathname} className="page-fade flex flex-1 flex-col">
        {children}
      </main>
      {!hideNav && <BottomNav />}
    </div>
  );
}
