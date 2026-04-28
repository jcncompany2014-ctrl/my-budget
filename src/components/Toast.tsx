'use client';

import { createContext, useCallback, useContext, useEffect, useState } from 'react';

type ToastVariant = 'success' | 'info' | 'error';

type Toast = {
  id: number;
  message: string;
  variant: ToastVariant;
  action?: { label: string; onClick: () => void };
};

type ShowOptions = {
  variant?: ToastVariant;
  action?: { label: string; onClick: () => void };
  durationMs?: number;
};

type ToastContextValue = {
  show: (message: string, optsOrVariant?: ShowOptions | ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (message: string, optsOrVariant?: ShowOptions | ToastVariant) => {
      const opts =
        typeof optsOrVariant === 'string'
          ? { variant: optsOrVariant }
          : optsOrVariant ?? {};
      const id = Date.now() + Math.random();
      const toast: Toast = {
        id,
        message,
        variant: opts.variant ?? 'success',
        action: opts.action,
      };
      setToasts((prev) => [...prev, toast]);
      const duration = opts.durationMs ?? (opts.action ? 5000 : 1800);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    [],
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4"
        style={{ bottom: 'calc(env(safe-area-inset-bottom) + 88px)' }}
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(r);
  }, []);

  const tone =
    toast.variant === 'success'
      ? { bg: 'var(--color-primary)', text: '#fff' }
      : toast.variant === 'error'
        ? { bg: 'var(--color-danger)', text: '#fff' }
        : { bg: 'var(--color-text-1)', text: 'var(--color-card)' };

  return (
    <div
      className="pointer-events-auto flex items-center gap-3 rounded-full pl-5 pr-2 py-2 shadow-lg transition-all duration-300"
      style={{
        background: tone.bg,
        color: tone.text,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(10px)',
      }}
    >
      <span style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="tap rounded-full px-3 py-1.5"
          style={{
            background: 'rgba(255,255,255,0.22)',
            color: tone.text,
            fontSize: 'var(--text-xxs)',
            fontWeight: 800,
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
