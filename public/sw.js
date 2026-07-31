/* bynku - service worker: web push, share-target intake, update control */

const SHARE_CACHE = 'bynku-share-target';

// NOTE: we deliberately do NOT call skipWaiting() on install. When an existing
// worker is already controlling the page, the new worker stays "waiting" until
// the client asks it to take over (see the message handler) — that is what
// powers the "new version, tap to refresh" prompt. On a first-ever install
// there is no controller, so the worker activates immediately anyway.
self.addEventListener('install', () => {});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// The client posts this when the user accepts the update prompt.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

// Receive files/text shared from the OS share sheet (Web Share Target Level 2,
// Chromium/Android). Stash them in the Cache and redirect to /share, where the
// client reads them out and runs the normal parse+review flow. iOS Safari does
// not support share targets, so this path is Android/desktop-Chromium only.
async function handleShareTarget(request) {
  try {
    const formData = await request.formData();
    const raw = formData.getAll('files');
    const files = raw.filter((f) => f && typeof f === 'object' && 'arrayBuffer' in f);
    const text = ['title', 'text', 'url']
      .map((k) => formData.get(k))
      .filter((v) => typeof v === 'string' && v)
      .join(' ')
      .trim();

    const cache = await caches.open(SHARE_CACHE);
    // Clear any previous pending share so we never mix two payloads.
    for (const key of await cache.keys()) await cache.delete(key);

    await cache.put(
      '/__share/meta',
      new Response(JSON.stringify({ count: files.length, text }), {
        headers: { 'content-type': 'application/json' },
      }),
    );
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      await cache.put(
        `/__share/file-${i}`,
        new Response(f, {
          headers: {
            'content-type': f.type || 'application/octet-stream',
            'x-filename': encodeURIComponent(f.name || `shared-${i}`),
          },
        }),
      );
    }
  } catch (_) {
    // If anything fails we still redirect so the user lands on the Share screen.
  }
  return Response.redirect(new URL('/share?shared=1', self.location.origin).toString(), 303);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method === 'POST') {
    const url = new URL(req.url);
    if (url.pathname === '/share-target') {
      event.respondWith(handleShareTarget(req));
      return;
    }
  }
  // Everything else: pass-through, no caching. Nothing is served from disk, so
  // there is no stale-content risk and no change to the release model.
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'bynku', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'bynku';
  const options = {
    body: data.body || '',
    icon: data.icon || '/favicon.ico',
    badge: '/favicon.ico',
    data: { url: data.url || '/' },
    tag: data.tag,
    renotify: !!data.tag,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) {
      try {
        if (new URL(c.url).pathname === url) return c.focus();
      } catch (_) {}
    }
    return self.clients.openWindow(url);
  })());
});
