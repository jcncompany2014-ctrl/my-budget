'use client';

import { useMode } from './ModeProvider';

export default function ModeToggle() {
  const { mode, setMode } = useMode();

  return (
    <div
      className="flex rounded-full p-[3px]"
      style={{ background: 'var(--color-gray-100)' }}
    >
      {(
        [
          ['personal', '개인'],
          ['business', '사업'],
        ] as const
      ).map(([k, label]) => {
        const active = mode === k;
        const activeBg =
          active && k === 'business'
            ? 'var(--color-blue-500)'
            : active && k === 'personal'
              ? 'var(--color-green-500)'
              : 'transparent';
        return (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className="tap rounded-full px-4 py-1.5 font-bold transition-colors"
            style={{
              fontSize: 'var(--text-sm)',
              background: activeBg,
              color: active ? '#fff' : 'var(--color-text-3)',
              minWidth: 56,
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
