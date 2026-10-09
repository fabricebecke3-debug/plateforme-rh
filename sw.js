/* TERH — service worker
 * Rôle : ouvrir l'application même sans connexion.
 * - La page (index.html) et les ressources statiques sont gardées en mémoire du téléphone/ordinateur.
 * - Les appels à la base de données (Supabase) ne sont JAMAIS mis en cache : les données
 *   hors ligne viennent du cache local de l'application (IndexedDB), jamais d'une version périmée.
 * - Les notifications sont gérées comme avant.
 * Pour forcer la mise à jour des utilisateurs, augmentez le numéro de VERSION.
 */
const VERSION = 'terh-v2';
const SHELL = ['./', './index.html', './manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Tout ce qui ne vient pas de cette application (base de données, CDN, etc.) n'est pas mis en cache.
  if (url.origin !== self.location.origin) return;

  // Ouverture de la page : réseau d'abord, sinon la copie enregistrée (fonctionnement hors ligne)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then((r) => r || caches.match('./')))
    );
    return;
  }

  // Autres fichiers du site : copie d'abord, puis réseau
  event.respondWith(
    caches.match(req).then((hit) =>
      hit || fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then((c) => c.put(req, copy)).catch(() => {});
          }
          return res;
        })
        .catch(() => hit)
    )
  );
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(d.title || 'TERH', {
      body: d.body || '',
      icon: d.icon || undefined,
      tag: d.tag || 'terh',
      renotify: true
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((cs) =>
      cs.length ? cs[0].focus() : self.clients.openWindow('./')
    )
  );
});
