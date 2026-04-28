'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type Tab = {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
};

const stroke = (active: boolean) => (active ? 'var(--color-primary)' : 'var(--color-text-3)');

const TABS: Tab[] = [
  {
    href: '/',
    label: '홈',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
        <path
          d="M4 11l8-7 8 7v9a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1v-9z"
          stroke={stroke(active)}
          strokeWidth={1.8}
          strokeLinejoin="round"
          fill={active ? 'var(--color-primary-soft)' : 'none'}
        />
      </svg>
    ),
  },
  {
    href: '/list',
    label: '내역',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
        <path d="M5 7h14M5 12h14M5 17h14" stroke={stroke(active)} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/add',
    label: '',
    icon: () => (
      <div
        className="flex h-12 w-12 items-center justify-center rounded-full shadow-md"
        style={{ background: 'var(--color-primary)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" width={22} height={22}>
          <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" />
        </svg>
      </div>
    ),
  },
  {
    href: '/stats',
    label: '통계',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
        <path d="M5 19V10M12 19V5M19 19v-7" stroke={stroke(active)} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    ),
  },
  {
    href: '/wallet',
    label: '자산',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
        <rect x={3} y={6} width={18} height={13} rx={2.5} stroke={stroke(active)} strokeWidth={1.8} />
        <path d="M16 12.5h2" stroke={stroke(active)} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="sticky bottom-0 z-40 flex h-[68px] items-center justify-around border-t px-2"
      style={{
        borderColor: 'var(--color-divider)',
        background: 'var(--color-card)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {TABS.map((tab) => {
        const isAdd = tab.href === '/add';
        const active = !isAdd && pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tap flex flex-1 flex-col items-center gap-0.5 ${isAdd ? '-mt-6' : ''}`}
          >
            {tab.icon(active)}
            {tab.label && (
              <span
                className="text-[11px] font-medium"
                style={{ color: active ? 'var(--color-primary)' : 'var(--color-text-3)' }}
              >
                {tab.label}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
