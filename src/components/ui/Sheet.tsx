'use client';

import { useEffect, useRef, useState } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  full?: boolean;
};

export default function Sheet({ open, onClose, children, title, full }: Props) {
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
    if (dragY > 100) {
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
        backdropFilter: closing ? 'none' : 'blur(2px)',
        transition: 'background 240ms var(--ease-out)',
      }}
      onClick={onClose}
    >
      <div
        ref={sheetRef}
        className={`w-full max-w-[440px] rounded-t-3xl ${full ? 'h-[88dvh]' : 'max-h-[88dvh]'} overflow-y-auto`}
        style={{
          background: 'var(--color-card)',
          padding: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
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
