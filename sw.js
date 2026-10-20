/* TERH — service worker v5
 * Rôle : ouvrir l'application même sans connexion.
 * - index.html et les fichiers statiques du site sont gardés sur l'appareil.
 * - Le code (js, css, html, json, md…) est d'abord demandé au réseau, pour recevoir les mises à jour ;
 *   la copie enregistrée ne sert qu'hors ligne.
 * - Les appels à la base de données (Supabase, autre origine) ne sont JAMAIS mis en cache.
 * - Les clés de cache ignorent les paramètres (?t=…), pour que le cache ne grossisse pas à chaque chargement.
 * Pour forcer la mise à jour des utilisateurs, augmentez le numéro de VERSION.
 */
const VERSION = 'terh-v12';
const BASE = new URL('./', self.location.href).href;      // dossier de l'application
const SHELL = ['./', './index.html', './manifest.webmanifest'];
const CODE_RE = /\.(js|css|html|json|webmanifest|md|txt)$/i;

// Clé de cache stable : origine + chemin, sans paramètres de requête
function keyOf(url) { return url.origin + url.pathname; }

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // Un fichier manquant ne doit pas bloquer l'installation
    await Promise.all(SHELL.map((p) => cache.add(new URL(p, BASE)).catch(() => {})));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

async function reseauPuisCache(req, key, navigation) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    const hit = await cache.match(key);
    if (hit) return hit;
    if (navigation) {
      const accueil = await cache.match(BASE) || await cache.match(keyOf(new URL('index.html', BASE)));
      if (accueil) return accueil;
    }
    return Response.error();
  }
}

async function cachePuisReseau(req, key) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(key);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(key, res.clone()).catch(() => {});
    return res;
  } catch (err) {
    return Response.error();
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Base de données, CDN et autres sites : non gérés par le cache
  if (url.origin !== self.location.origin) return;

  // Ouverture de la page
  if (req.mode === 'navigate') {
    event.respondWith(reseauPuisCache(req, keyOf(new URL('index.html', BASE)), true));
    return;
  }

  // Code et contenus de formation : réseau d'abord
  if (CODE_RE.test(url.pathname) || url.href === BASE || url.pathname === new URL(BASE).pathname) {
    event.respondWith(reseauPuisCache(req, keyOf(url), false));
    return;
  }

  // Autres fichiers (images…) : copie d'abord, puis réseau
  event.respondWith(cachePuisReseau(req, keyOf(url)));
});

self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch (e) { d = { body: event.data ? event.data.text() : '' }; }
  // Lien de destination limité à cette application
  let lien = BASE;
  try {
    const u = new URL(d.url || BASE, BASE);
    if (u.origin === self.location.origin) lien = u.href;
  } catch (e) {}
  event.waitUntil(
    self.registration.showNotification(d.title || 'TERH', {
      body: d.body || '',
      icon: d.icon || undefined,
      tag: d.tag || 'terh',
      renotify: true,
      data: { url: lien }
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const cible = (event.notification.data && event.notification.data.url) || BASE;
  event.waitUntil((async () => {
    const fenetres = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of fenetres) {
      if (c.url.startsWith(BASE) && 'focus' in c) {
        await c.focus();
        if ('navigate' in c && c.url !== cible) { try { await c.navigate(cible); } catch (e) {} }
        return;
      }
    }
    return self.clients.openWindow(cible);
  })());
});
