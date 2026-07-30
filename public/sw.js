/* Household Budget - service worker for web push */
self.addEventListener('install', (event) => {
  self.skipWaiting();
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Pass-through fetch handler. Registered ONLY so the app satisfies PWA
// installability criteria across browsers. It deliberately does not call
// respondWith and caches NOTHING — every request goes to the network as
// normal, so there is no stale-content risk and no change to the release
// model. Offline caching, if ever wanted, is a separate, later decision.
self.addEventListener('fetch', () => {});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (_) {
    data = { title: 'Household Budget', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Household Budget';
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
