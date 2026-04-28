'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  onRefresh: () => Promise<void> | void;
  children: React.ReactNode;
};

const TRIGGER = 64;

/**
 * Pull-to-refresh wrapper. Activates only when scrolled to the top.
 */
export default function PullToRefresh({ onRefresh, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const startY = useRef<number | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (window.scrollY > 4) return;
      startY.current = e.touches[0].clientY;
    };
    const onTouchMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0) {
        setPull(0);
        return;
      }
      const damped = Math.min(dy * 0.45, 90);
      setPull(damped);
    };
    const onTouchEnd = async () => {
      if (startY.current === null) return;
      startY.current = null;
      if (pull >= TRIGGER && !refreshing) {
        setRefreshing(true);
        setPull(TRIGGER);
        try {
          await onRefresh();
        } finally {
          setTimeout(() => {
            setRefreshing(false);
            setPull(0);
          }, 350);
        }
      } else {
        setPull(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: true });
    el.addEventListener('touchend', onTouchEnd);
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
  }, [pull, refreshing, onRefresh]);

  const triggered = pull >= TRIGGER || refreshing;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <div
        className="pointer-events-none absolute left-0 right-0 flex items-center justify-center"
        style={{
          top: 0,
          height: pull,
          opacity: pull > 8 ? 1 : 0,
          transition: refreshing ? 'none' : 'opacity 200ms var(--ease-out)',
        }}
      >
        <div
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{
            background: 'var(--color-card)',
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
          }}
        >
          <svg
            viewBox="0 0 24 24"
            width={18}
            height={18}
            fill="none"
            style={{
              transform: `rotate(${pull * 6}deg)`,
              transition: refreshing ? 'none' : 'transform 80ms var(--ease-out)',
              animation: refreshing ? 'spin 0.8s linear infinite' : undefined,
            }}
          >
            <path
              d="M4 12a8 8 0 1 0 2.34-5.66"
              stroke={triggered ? 'var(--color-primary)' : 'var(--color-text-3)'}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              d="M3 4l2 4-4 0"
              stroke={triggered ? 'var(--color-primary)' : 'var(--color-text-3)'}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <div
        style={{
          transform: `translateY(${pull}px)`,
          transition: refreshing || pull === 0 ? 'transform 280ms var(--ease-out)' : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
