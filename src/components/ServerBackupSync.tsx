'use client';

import { useEffect } from 'react';
import { syncServerBackup } from '@/lib/server-backup';

const TICK_MS = 60_000;

/**
 * Keeps the server backup current while the app is in front: shortly after
 * open, on returning to it, and on a one-minute tick. syncServerBackup does
 * nothing until auto-record has an address, uploads only when the ledger
 * changed, and at most once every few minutes.
 */
export default function ServerBackupSync() {
  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') void syncServerBackup();
    };
    // After the launch generators have posted what fell due today.
    const first = window.setTimeout(run, 8000);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('online', run);
    const tick = window.setInterval(run, TICK_MS);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('online', run);
      window.clearInterval(tick);
    };
  }, []);
  return null;
}
