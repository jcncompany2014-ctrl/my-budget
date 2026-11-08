'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { describeSync, syncInbox } from '@/lib/inbox';

const TICK_MS = 60_000;

/**
 * Pulls card notifications the iPhone Shortcut queued on the server whenever
 * the app is in front: on open, on returning to the tab, and once a minute.
 * syncInbox is throttled + single-flight and a no-op until auto-record is set up.
 */
export default function InboxSync() {
  const toast = useToast();
  const router = useRouter();
  // The toast context value is re-created on every toast; keep the effect stable.
  const latest = useRef({ toast, router });
  useEffect(() => {
    latest.current = { toast, router };
  });

  useEffect(() => {
    let alive = true;
    const run = () => {
      if (document.visibilityState !== 'visible') return;
      syncInbox().then((s) => {
        const msg = s && describeSync(s);
        if (!alive || !s || !msg) return;
        latest.current.toast.show(msg, {
          variant: s.added || s.cancelled || s.refunds ? 'success' : 'info',
          action: { label: '보기', onClick: () => latest.current.router.push('/inbox') },
          durationMs: 6000,
          haptic: false, // background work, not a response to a tap
        });
      });
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idle =
      typeof w.requestIdleCallback === 'function'
        ? w.requestIdleCallback(run, { timeout: 2000 })
        : window.setTimeout(run, 300);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('online', run);
    const tick = window.setInterval(run, TICK_MS);

    return () => {
      alive = false;
      if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('online', run);
      window.clearInterval(tick);
    };
  }, []);

  return null;
}
