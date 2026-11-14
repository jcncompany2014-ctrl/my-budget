/*
 * Service worker: makes the installed app open and work without a connection.
 * All data lives in the browser, so the only thing the network is needed for
 * is the app itself — this keeps a copy of it.
 *
 *   /_next/static/*   cache-first   (file names carry a content hash)
 *   page navigations  network-first, the saved copy when offline or after 2.5 s
 *   /api/*, other origins, non-GET   untouched
 *
 * Plain JS on purpose: it is served as-is from /public, outside the bundler.
 */
const VERSION = 'v1';
const PAGES = `pages-${VERSION}`;
const STATIC = `static-${VERSION}`;
const MAX_STATIC = 400;
const NAV_TIMEOUT_MS = 2500;

// Screens worth having offline even if they were never opened while online.
const CORE = [
  '/',
  '/list',
  '/stats',
  '/wallet',
  '/add',
  '/quick-add',
  '/transfer',
  '/tx',
  '/tx/edit',
  '/calendar',
  '/inbox',
  '/budget',
  '/reimburse',
  '/search',
  '/merchant',
  '/settings',
];

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n !== PAGES && n !== STATIC).map((n) => caches.delete(n)));
      await self.clients.claim();
      // In the background, one at a time — never competes with the page for bandwidth.
      for (const path of CORE) await savePage(path).catch(() => {});
      await trim();
    })(),
  );
});

/** One saved shell per route: /tx?id=a and /tx?id=b are the same page. */
const pageKey = (url) => url.origin + url.pathname;

/** Save every hashed asset a page's HTML refers to, so the page runs offline. */
async function saveAssets(html) {
  const found = html.match(/\/_next\/static\/[^"'\\\s<>)]+\.(?:js|css|woff2)/g);
  if (!found) return;
  const cache = await caches.open(STATIC);
  for (const path of new Set(found)) {
    if (await cache.match(path)) continue;
    await cache.add(path).catch(() => {});
  }
}

async function savePage(path) {
  const cache = await caches.open(PAGES);
  const url = new URL(path, self.location.origin);
  if (await cache.match(pageKey(url))) return;
  const res = await fetch(url, { credentials: 'same-origin' });
  if (!res.ok || res.redirected) return;
  await cache.put(pageKey(url), res.clone());
  await saveAssets(await res.text());
}

/** Old builds leave their files behind; keep the newest ones. */
async function trim() {
  const cache = await caches.open(STATIC);
  const keys = await cache.keys();
  for (const req of keys.slice(0, Math.max(0, keys.length - MAX_STATIC))) await cache.delete(req);
}

function offlinePage() {
  return new Response(
    '<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>가계부</title>' +
      '<body style="margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,sans-serif;background:#F2F4F6;color:#191F28">' +
      '<div style="text-align:center"><p style="font-size:17px;font-weight:700;margin:0 0 16px">오프라인이에요</p>' +
      '<a href="/" style="display:inline-block;padding:12px 20px;border-radius:14px;background:#00B956;color:#fff;font-weight:700;text-decoration:none">홈으로</a></div>',
    { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
  );
}

async function navigate(event) {
  const url = new URL(event.request.url);
  const cache = await caches.open(PAGES);
  const saved = await cache.match(pageKey(url));

  const fresh = fetch(event.request).then((res) => {
    if (res.ok && !res.redirected && res.type === 'basic') {
      const copy = res.clone();
      event.waitUntil(
        cache
          .put(pageKey(url), copy.clone())
          .then(() => copy.text())
          .then(saveAssets)
          .catch(() => {}),
      );
    }
    return res;
  });

  if (!saved) return fresh.catch(() => offlinePage());
  // Online, the network answers long before the timer. On a dead or crawling
  // connection the saved copy opens instead of a blank screen.
  return Promise.race([
    fresh.catch(() => saved),
    new Promise((resolve) => setTimeout(() => resolve(saved), NAV_TIMEOUT_MS)),
  ]);
}

async function staticAsset(event) {
  const cache = await caches.open(STATIC);
  const hit = await cache.match(event.request);
  if (hit) return hit;
  const res = await fetch(event.request);
  if (res.ok) event.waitUntil(cache.put(event.request, res.clone()).catch(() => {}));
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(staticAsset(event));
    return;
  }
  // Real page loads only. Client-side route fetches (RSC) go to the network;
  // when they fail the router falls back to a page load, which lands here.
  if (req.mode === 'navigate') {
    event.respondWith(navigate(event));
  }
});
