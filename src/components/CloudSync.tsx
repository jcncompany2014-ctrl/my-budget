'use client';

import { useEffect, useRef } from 'react';
import { useToast } from '@/components/Toast';
import { syncCloud } from '@/lib/cloud-sync';

const TICK_MS = 20_000;

/**
 * Keeps the cloud mirror current and applies edits Claude queued from a chat
 * session: on open, on returning to the app, every 20s while it is in front,
 * and once more when it goes to the background. syncCloud is single-flight
 * and a no-op until the sync backend is configured.
 */
export default function CloudSync() {
  const toast = useToast();
  // The toast context value is re-created on every toast; keep the effect stable.
  const latest = useRef(toast);
  useEffect(() => {
    latest.current = toast;
  });

  useEffect(() => {
    let alive = true;
    const run = () => {
      const hidden = document.visibilityState !== 'visible';
      syncCloud({ keepalive: hidden }).then((batch) => {
        if (!alive || !batch) return;
        const n = batch.notes.length;
        const msg =
          n === 0
            ? `Claude 수정 ${batch.failed}건을 반영하지 못했어요`
            : n === 1
              ? `Claude: ${batch.notes[0]}`
              : `Claude가 ${n}건을 반영했어요`;
        latest.current.show(msg, {
          variant: n === 0 ? 'error' : 'info',
          action:
            n === 0
              ? undefined
              : {
                  label: '되돌리기',
                  onClick: () => {
                    batch.undo();
                    latest.current.show('되돌렸어요', 'info');
                  },
                },
          durationMs: 7000,
          haptic: false, // background work, not a response to a tap
        });
      });
    };
    const tick = () => {
      if (document.visibilityState === 'visible') run();
    };

    const w = window as Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      cancelIdleCallback?: (id: number) => void;
    };
    const idle =
      typeof w.requestIdleCallback === 'function'
        ? w.requestIdleCallback(tick, { timeout: 2500 })
        : window.setTimeout(tick, 400);
    // Both directions: pull edits when the app comes forward, flush changes when it leaves.
    document.addEventListener('visibilitychange', run);
    window.addEventListener('online', tick);
    const timer = window.setInterval(tick, TICK_MS);

    return () => {
      alive = false;
      if (typeof w.cancelIdleCallback === 'function') w.cancelIdleCallback(idle);
      else window.clearTimeout(idle);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('online', tick);
      window.clearInterval(timer);
    };
  }, []);

  return null;
}
