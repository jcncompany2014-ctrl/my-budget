'use client';

import { useEffect } from 'react';

/**
 * Registers /sw.js (offline copy of the app) in production. In development it
 * removes any registration instead — a worker serving saved chunks would fight
 * hot reload.
 */
export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => {
          for (const r of regs) r.unregister();
        })
        .catch(() => {});
      return;
    }
    const register = () => {
      // updateViaCache 'none': the browser must not serve sw.js itself from its HTTP cache.
      navigator.serviceWorker
        .register('/sw.js', { scope: '/', updateViaCache: 'none' })
        .catch(() => {});
    };
    // After load, so it never competes with the first paint.
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
