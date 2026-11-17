/**
 * worker/index.js
 *
 * Custom service worker code merged into sw.js by next-pwa at build time.
 * Handles incoming push notifications and notification click events.
 * Takes effect after running `next build`.
 */

// ── Push event: show a notification ──────────────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = { title: 'NutriTrack', body: '', url: '/', tag: 'nutritrack' };
  try {
    Object.assign(payload, event.data.json());
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body:               payload.body,
      icon:               '/icon-192.png',
      badge:              '/icon-192.png',
      tag:                payload.tag || 'nutritrack',
      // Buttons like "Snap it" / "Same as yesterday"; each carries its own URL.
      actions:            (payload.actions || []).slice(0, 2).map((a) => ({ action: a.action, title: a.title })),
      data:               {
        url: payload.url || '/',
        actionUrls: Object.fromEntries((payload.actions || []).map((a) => [a.action, a.url])),
      },
      vibrate:            [200, 100, 200],
      requireInteraction: false,
    })
  );
});

// ── Notification click: open or focus the app ─────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const url = (event.action && data.actionUrls?.[event.action]) || data.url || '/';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((list) => {
        for (const client of list) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});
