'use client';

import { useMode } from './ModeProvider';
import { haptics } from '@/lib/haptics';
import type { Scope } from '@/lib/types';

export default function ModeToggle() {
  const { mode, setMode } = useMode();

  const handleSet = (m: Scope) => {
    if (m !== mode) haptics.light();
    setMode(m);
  };

  const isBusiness = mode === 'business';

  return (
    <div
      className="relative inline-flex items-center rounded-full p-1"
      style={{
        background: 'var(--color-gray-100)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.05)',
        height: 40,
      }}
    >
      {/* Sliding indicator */}
      <span
        aria-hidden
        className="absolute rounded-full"
        style={{
          width: 'calc(50% - 4px)',
          height: 'calc(100% - 8px)',
          top: 4,
          left: 4,
          background: isBusiness
            ? 'linear-gradient(135deg, #3182F6 0%, #1450AE 100%)'
            : 'linear-gradient(135deg, #00B956 0%, #00853C 100%)',
          transform: isBusiness ? 'translateX(100%)' : 'translateX(0%)',
          transition: 'transform 380ms cubic-bezier(0.34, 1.56, 0.64, 1), background 320ms ease',
          boxShadow: isBusiness
            ? '0 4px 14px rgba(49, 130, 246, 0.45), inset 0 1px 0 rgba(255,255,255,0.18)'
            : '0 4px 14px rgba(0, 185, 86, 0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
          overflow: 'hidden',
        }}
      >
        <span
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.22) 48%, transparent 65%)',
            animation: 'toggle-shimmer 4s ease-in-out infinite',
          }}
        />
      </span>

      {(
        [
          ['personal', '개인', PersonIcon],
          ['business', '사업', BriefcaseIcon],
        ] as const
      ).map(([k, label, Icon]) => {
        const active = mode === k;
        return (
          <button
            key={k}
            type="button"
            onClick={() => handleSet(k)}
            className="tap relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full"
            style={{
              minWidth: 80,
              height: 32,
              paddingLeft: 12,
              paddingRight: 12,
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              color: active ? '#fff' : 'var(--color-text-3)',
              transition: 'color 280ms cubic-bezier(0.16, 1, 0.3, 1)',
              textShadow: active ? '0 1px 1px rgba(0,0,0,0.18)' : 'none',
            }}
            aria-pressed={active}
          >
            <Icon active={active} />
            <span>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PersonIcon({ active }: { active: boolean }) {
  const stroke = active ? '#fff' : 'var(--color-text-3)';
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      style={{
        transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: active ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      <circle cx={12} cy={8} r={3.5} stroke={stroke} strokeWidth={2} />
      <path
        d="M5 20c1-3.5 4.5-5 7-5s6 1.5 7 5"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function BriefcaseIcon({ active }: { active: boolean }) {
  const stroke = active ? '#fff' : 'var(--color-text-3)';
  return (
    <svg
      viewBox="0 0 24 24"
      width={14}
      height={14}
      fill="none"
      style={{
        transition: 'transform 320ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: active ? 'scale(1.1)' : 'scale(1)',
      }}
    >
      <rect x={3} y={7.5} width={18} height={12.5} rx={2} stroke={stroke} strokeWidth={2} />
      <path
        d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <path d="M3 12h18" stroke={stroke} strokeWidth={2} />
    </svg>
  );
}
