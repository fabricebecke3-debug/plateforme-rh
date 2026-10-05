/* Service Worker — PLATEFORME RH
   Cache les ressources statiques + les réponses Supabase lues récemment.
   Permet à l'app de s'ouvrir hors ligne (données déjà chargées consultables).
*/
const VERSION = 'terh-v3.0';
const STATIC_CACHE = VERSION + '-static';
const RUNTIME_CACHE = VERSION + '-runtime';
const STATIC_ASSETS = [
  './', './index.html',
  './manifest.webmanifest',
  './icon-192.png', './icon-512.png',
  './sage-data.json'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(STATIC_CACHE).then(c =>
      Promise.all(STATIC_ASSETS.map(url =>
        c.add(url).catch(() => null)
      ))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Ne jamais mettre en cache les appels d'authentification ou d'écriture
  if (e.request.method !== 'GET' || url.pathname.includes('/auth/')) return;

  // Requêtes Supabase : réseau d'abord, cache de secours
  if (url.hostname.endsWith('.supabase.co')) {
    e.respondWith(
      fetch(e.request).then(r => {
        const copy = r.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Ressources locales : cache d'abord
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(r => r || fetch(e.request).then(resp => {
        const copy = resp.clone();
        caches.open(RUNTIME_CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return resp;
      }))
    );
  }
});

/* Notifications push (si activées côté serveur) */
self.addEventListener('push', e => {
  let data = { title: 'PLATEFORME RH', body: 'Nouvelle alerte' };
  try { if (e.data) data = e.data.json(); } catch (err) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: 'icon-192.png',
    badge: 'icon-192.png',
    tag: 'terh-alertes',
    renotify: true
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    for (const c of list) { if ('focus' in c) return c.focus(); }
    if (clients.openWindow) return clients.openWindow('./');
  }));
});