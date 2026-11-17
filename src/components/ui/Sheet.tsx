'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  full?: boolean;
  /**
   * Holds unsaved input: tapping the dim area or dragging down no longer
   * closes it — only the sheet's own buttons do.
   */
  keep?: boolean;
};

export default function Sheet({ open, onClose, children, title, full, keep }: Props) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [dragY, setDragY] = useState(0);
  const [closing, setClosing] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) setClosing(false);
  }, [open]);

  // The on-screen keyboard covers the bottom of the layout viewport, which is
  // where a sheet's save row sits. Lift the sheet by however much is covered.
  const [covered, setCovered] = useState(0);
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const measure = () => {
      const gap = Math.round(window.innerHeight - vv.height - vv.offsetTop);
      // Small gaps are browser chrome sliding, not a keyboard.
      setCovered(gap > 120 ? gap : 0);
      const el = document.activeElement;
      if (gap > 120 && el instanceof HTMLElement && sheetRef.current?.contains(el)) {
        requestAnimationFrame(() => el.scrollIntoView({ block: 'nearest' }));
      }
    };
    measure();
    vv.addEventListener('resize', measure);
    vv.addEventListener('scroll', measure);
    return () => {
      vv.removeEventListener('resize', measure);
      vv.removeEventListener('scroll', measure);
      setCovered(0);
    };
  }, [open]);

  if (!open && !closing) return null;

  const onTouchStart = (e: React.TouchEvent) => {
    // Only start drag from top 60px (handle area) to avoid breaking inner scroll
    const sheet = sheetRef.current;
    if (!sheet) return;
    const rect = sheet.getBoundingClientRect();
    const localY = e.touches[0].clientY - rect.top;
    if (localY > 60) return;
    startY.current = e.touches[0].clientY;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return;
    const dy = e.touches[0].clientY - startY.current;
    setDragY(Math.max(0, dy));
  };
  const onTouchEnd = () => {
    if (startY.current === null) return;
    startY.current = null;
    if (dragY > 100 && !keep) {
      setClosing(true);
      setTimeout(() => {
        onClose();
        setDragY(0);
        setClosing(false);
      }, 240);
    } else {
      setDragY(0);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{
        background: closing ? 'transparent' : 'rgba(0,0,0,0.4)',
        transition: 'background 240ms var(--ease-out)',
        paddingBottom: covered,
      }}
      onClick={keep ? undefined : onClose}
    >
      <div
        ref={sheetRef}
        className={`w-full max-w-[440px] rounded-t-3xl ${full ? 'h-[88dvh]' : 'max-h-[88dvh]'} overflow-y-auto overflow-x-hidden`}
        style={{
          background: 'var(--color-card)',
          padding: 24,
          // Above the keyboard there is no home indicator to clear.
          paddingBottom: covered > 0 ? 16 : 'calc(env(safe-area-inset-bottom) + 24px)',
          maxHeight: covered > 0 ? `calc(100dvh - ${covered}px - 12px)` : undefined,
          transform: closing ? 'translateY(100%)' : `translateY(${dragY}px)`,
          transition: closing
            ? 'transform 160ms var(--ease-out)'
            : startY.current !== null
              ? 'none'
              : 'transform 180ms var(--ease-spring)',
          animation: dragY === 0 && !closing ? 'slide-up 180ms var(--ease-out)' : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        role="dialog"
        aria-modal="true"
      >
        <div
          className="mx-auto mb-4 h-1 w-10 rounded-full"
          style={{ background: 'var(--color-gray-200)' }}
        />
        {title && (
          <h2
            className="mb-4"
            style={{ color: 'var(--color-text-1)', fontSize: 'var(--text-lg)', fontWeight: 700 }}
          >
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>
  );
}
