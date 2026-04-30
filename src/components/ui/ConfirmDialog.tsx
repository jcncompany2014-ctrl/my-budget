'use client';

import { useEffect } from 'react';

/**
 * Standardized destructive-action dialog. Replaces ad-hoc confirm sheets
 * scattered across pages (tx delete, reset all data, etc.) with a single
 * accessible component.
 *
 *   <ConfirmDialog
 *     open={confirming}
 *     title="이 거래를 삭제할까요?"
 *     description="삭제하면 되돌릴 수 없어요."
 *     confirmLabel="삭제"
 *     danger
 *     onConfirm={onDelete}
 *     onCancel={() => setConfirming(false)}
 *   />
 */

type Props = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  cancelLabel = '취소',
  danger = false,
  onConfirm,
  onCancel,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Enter') onConfirm();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onCancel, onConfirm]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[90] flex items-end justify-center px-4 pb-6"
      style={{
        background: 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(2px)',
        animation: 'fade-in 180ms var(--ease-out)',
      }}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="w-full max-w-[380px] rounded-3xl p-6"
        style={{
          background: 'var(--color-card)',
          boxShadow: '0 8px 36px rgba(20, 28, 40, 0.16)',
          paddingBottom: 'calc(env(safe-area-inset-bottom) + 24px)',
          animation: 'slide-up 220ms var(--ease-spring)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p
          className="mb-1.5"
          style={{ color: 'var(--color-text-1)', fontSize: 17, fontWeight: 800, letterSpacing: '-0.02em' }}
        >
          {title}
        </p>
        {description && (
          <p
            className="mb-5 leading-snug"
            style={{ color: 'var(--color-text-3)', fontSize: 13 }}
          >
            {description}
          </p>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="tap h-12 flex-1 rounded-2xl"
            style={{
              background: 'var(--color-gray-100)',
              color: 'var(--color-text-1)',
              fontSize: 14,
              fontWeight: 700,
            }}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            autoFocus
            className="tap h-12 flex-1 rounded-2xl"
            style={{
              background: danger ? 'var(--color-danger)' : 'var(--color-primary)',
              color: '#fff',
              fontSize: 14,
              fontWeight: 800,
              boxShadow: danger
                ? '0 2px 10px rgba(240, 68, 82, 0.35)'
                : '0 2px 10px rgba(0, 185, 86, 0.35)',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
