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
        return (
          <button
            key={k}
            type="button"
            onClick={() => setMode(k)}
            className="tap rounded-full px-4 py-1.5 text-[13px] font-bold transition-all"
            style={{
              background: active
                ? k === 'business'
                  ? 'var(--color-text-1)'
                  : 'var(--color-card)'
                : 'transparent',
              color: active
                ? k === 'business'
                  ? 'var(--color-card)'
                  : 'var(--color-text-1)'
                : 'var(--color-text-3)',
              boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
