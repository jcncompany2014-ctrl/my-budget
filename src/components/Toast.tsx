'use client';

import { AlertCircle, Check, Info } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { haptics } from '@/lib/haptics';
import { isFullscreenRoute } from '@/lib/nav';

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
  /** Set false when the caller already fired its own haptic. */
  haptic?: boolean;
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

  const show = useCallback((message: string, optsOrVariant?: ShowOptions | ToastVariant) => {
    const opts =
      typeof optsOrVariant === 'string' ? { variant: optsOrVariant } : (optsOrVariant ?? {});
    const id = Date.now() + Math.random();
    const toast: Toast = {
      id,
      message,
      variant: opts.variant ?? 'success',
      action: opts.action,
    };
    // Every save / delete / error surfaces a toast, so tying haptics here gives
    // consistent tactile feedback app-wide (silently skipped without a gesture).
    if (opts.haptic !== false) {
      if (toast.variant === 'success') haptics.success();
      else if (toast.variant === 'error') haptics.warn();
      else haptics.light();
    }
    setToasts((prev) => [...prev, toast]);
    const duration = opts.durationMs ?? (opts.action ? 5000 : 1800);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  // Stable value: a fresh object here re-rendered every page that calls
  // useToast() each time a toast appeared and again when it left.
  const value = useMemo(() => ({ show }), [show]);

  // Above the tab bar normally. Full-screen flows end in a keypad or a save
  // button down there, so on those the toast drops in from the top instead.
  const top = isFullscreenRoute(usePathname() ?? '/');

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[100] flex flex-col items-center gap-2 px-4"
        style={
          top
            ? { top: 'calc(env(safe-area-inset-top) + 10px)' }
            : { bottom: 'calc(env(safe-area-inset-bottom) + 76px)' }
        }
      >
        {toasts.map((t) => (
          <ToastItem
            key={t.id}
            toast={t}
            fromTop={top}
            onDismiss={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
          />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  fromTop,
  onDismiss,
}: {
  toast: Toast;
  fromTop: boolean;
  onDismiss: () => void;
}) {
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

  const Icon = toast.variant === 'success' ? Check : toast.variant === 'error' ? AlertCircle : Info;

  return (
    <div
      // Only the action takes taps — the pill itself must not swallow what is under it.
      className="flex items-center gap-2 rounded-full pl-2 pr-2 py-2 shadow-lg transition-all duration-300"
      style={{
        background: tone.bg,
        color: tone.text,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : `translateY(${fromTop ? -10 : 10}px)`,
      }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.22)', color: tone.text }}
        aria-hidden
      >
        <Icon size={14} strokeWidth={3} />
      </span>
      <span className="pl-0.5 pr-1" style={{ fontSize: 'var(--text-sm)', fontWeight: 700 }}>
        {toast.message}
      </span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="tap pointer-events-auto rounded-full px-3.5 py-2"
          style={{
            background: 'rgba(255,255,255,0.22)',
            color: tone.text,
            fontSize: 'var(--text-xs)',
            fontWeight: 800,
          }}
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
