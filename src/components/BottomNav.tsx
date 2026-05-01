'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';

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
        <path
          d="M5 7h14M5 12h14M5 17h14"
          stroke={stroke(active)}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/stats',
    label: '통계',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
        <path
          d="M5 19V10M12 19V5M19 19v-7"
          stroke={stroke(active)}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      </svg>
    ),
  },
  {
    href: '/wallet',
    label: '자산',
    icon: (active) => (
      <svg viewBox="0 0 24 24" fill="none" width={24} height={24}>
        <rect
          x={3}
          y={6}
          width={18}
          height={13}
          rx={2.5}
          stroke={stroke(active)}
          strokeWidth={1.8}
        />
        <path d="M16 12.5h2" stroke={stroke(active)} strokeWidth={1.8} strokeLinecap="round" />
      </svg>
    ),
  },
];

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);

  const tabs = TABS;
  const left = tabs.slice(0, 2);
  const right = tabs.slice(2);

  return (
    <>
      <nav
        className="sticky bottom-0 z-40 flex h-[72px] items-center justify-around border-t px-2"
        style={{
          borderColor: 'var(--color-divider)',
          background: 'var(--color-card)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {left.map((tab) => (
          <NavItem key={tab.href} tab={tab} active={pathname === tab.href} />
        ))}

        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="tap relative -mt-7 flex h-14 w-14 items-center justify-center rounded-full"
          style={{
            background:
              'linear-gradient(135deg, var(--color-primary-grad-from), var(--color-primary-grad-to))',
            boxShadow:
              '0 4px 14px rgba(0, 0, 0, 0.18), 0 8px 24px var(--color-primary-soft), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
          aria-label="추가"
        >
          <svg viewBox="0 0 24 24" fill="none" width={26} height={26}>
            <path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" />
          </svg>
        </button>

        {right.map((tab) => (
          <NavItem key={tab.href} tab={tab} active={pathname === tab.href} />
        ))}
      </nav>

      {menuOpen && (
        <ActionMenu
          onClose={() => setMenuOpen(false)}
          onPick={(href) => {
            setMenuOpen(false);
            router.push(href);
          }}
        />
      )}
    </>
  );
}

function NavItem({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      className="tap relative flex flex-1 flex-col items-center justify-center gap-0.5"
    >
      <span
        aria-hidden
        style={{
          position: 'absolute',
          top: 4,
          width: 4,
          height: 4,
          borderRadius: 999,
          background: 'var(--color-primary)',
          opacity: active ? 1 : 0,
          transform: active ? 'scale(1)' : 'scale(0.4)',
          transition: 'opacity 240ms var(--ease-out), transform 320ms var(--ease-spring)',
        }}
      />
      <span
        style={{
          display: 'inline-flex',
          transition: 'transform 280ms var(--ease-spring)',
          transform: active ? 'translateY(-1px) scale(1.06)' : 'translateY(0) scale(1)',
        }}
      >
        {tab.icon(active)}
      </span>
      <span
        style={{
          fontSize: 'var(--text-xxs)',
          fontWeight: active ? 800 : 600,
          color: active ? 'var(--color-primary)' : 'var(--color-text-3)',
          letterSpacing: active ? '-0.02em' : '0',
          transition: 'color 240ms var(--ease-out)',
        }}
      >
        {tab.label}
      </span>
    </Link>
  );
}

function ActionMenu({ onClose, onPick }: { onClose: () => void; onPick: (href: string) => void }) {
  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[440px] rounded-t-3xl p-5 pt-4"
        style={{
          background: 'var(--color-card)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 20px)',
          animation: 'slide-up 180ms var(--ease-out)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: 'var(--color-gray-200)' }}
        />

        <div className="grid grid-cols-2 gap-2">
          <Action
            icon={<MinusIcon />}
            label="지출"
            tone="danger"
            onClick={() => onPick('/add?type=expense')}
          />
          <Action
            icon={<PlusIcon />}
            label="수입"
            tone="primary"
            onClick={() => onPick('/add?type=income')}
          />
          <Action
            icon={<TransferIcon />}
            label="이체"
            tone="neutral"
            onClick={() => onPick('/transfer')}
          />
          <Action
            icon={<BoltIcon />}
            label="빠른 입력"
            tone="neutral"
            onClick={() => onPick('/quick-add')}
          />
        </div>

        <button
          type="button"
          onClick={onClose}
          className="tap mt-3 h-12 w-full rounded-xl"
          style={{
            background: 'var(--color-gray-100)',
            color: 'var(--color-text-1)',
            fontSize: 'var(--text-sm)',
            fontWeight: 700,
          }}
        >
          닫기
        </button>
      </div>
    </div>
  );
}

function Action({
  icon,
  label,
  tone,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  tone: 'primary' | 'danger' | 'neutral';
  onClick: () => void;
}) {
  const bg =
    tone === 'primary'
      ? 'var(--color-primary-soft)'
      : tone === 'danger'
        ? 'var(--color-danger-soft)'
        : 'var(--color-gray-100)';
  const fg =
    tone === 'primary'
      ? 'var(--color-primary)'
      : tone === 'danger'
        ? 'var(--color-danger)'
        : 'var(--color-text-1)';
  return (
    <button
      type="button"
      onClick={onClick}
      className="tap flex flex-col items-center justify-center gap-2 rounded-2xl py-5"
      style={{ background: bg }}
    >
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: 44,
          height: 44,
          background: fg,
          color: '#fff',
          lineHeight: 1,
        }}
      >
        {icon}
      </span>
      <span style={{ color: fg, fontSize: 'var(--text-sm)', fontWeight: 700 }}>{label}</span>
    </button>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </svg>
  );
}
function MinusIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path d="M5 12h14" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" />
    </svg>
  );
}
function TransferIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="none" aria-hidden>
      <path
        d="M7 8h11l-3-3M17 16H6l3 3"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function BoltIcon() {
  return (
    <svg viewBox="0 0 24 24" width={22} height={22} fill="currentColor" aria-hidden>
      <path d="M13 2L4 14h7l-1 8 9-12h-7z" />
    </svg>
  );
}
