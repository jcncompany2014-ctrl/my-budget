'use client';

import { useEffect } from 'react';

type Props = {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  /** Set true if you want full-height sheet */
  full?: boolean;
};

export default function Sheet({ open, onClose, children, title, full }: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(2px)' }}
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[440px] rounded-t-3xl ${full ? 'h-[88dvh]' : 'max-h-[88dvh]'} overflow-y-auto`}
        style={{
          background: 'var(--color-card)',
          padding: 24,
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          animation: 'slide-up 280ms var(--ease-out)',
        }}
        onClick={(e) => e.stopPropagation()}
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
