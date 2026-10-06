/* Service worker : index.html et sage-data.json en réseau d'abord (nouvelle version visible dès le rechargement), le reste en cache */
const V='terh-v4',SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>0)))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const r=e.request;if(r.method!=='GET')return;const u=new URL(r.url);if(u.origin!==location.origin)return;
  const net=/\/$|index\.html$|sage-data\.json$/.test(u.pathname);
  e.respondWith(net?fetch(r).then(x=>{const c=x.clone();caches.open(V).then(h=>h.put(r,c));return x;}).catch(()=>caches.match(r).then(m=>m||caches.match('index.html')))
    :caches.match(r).then(m=>m||fetch(r).then(x=>{const c=x.clone();caches.open(V).then(h=>h.put(r,c));return x;})));
});
self.addEventListener('notificationclick',e=>{e.notification.close();e.waitUntil(clients.openWindow('./'));});
