'use client';

import { usePathname } from 'next/navigation';
import BottomNav from './BottomNav';

const HIDE_NAV_PREFIXES = ['/add', '/tx/'];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const hideNav = HIDE_NAV_PREFIXES.some((p) => pathname.startsWith(p));

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
