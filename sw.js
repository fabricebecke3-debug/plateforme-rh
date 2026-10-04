/* Service worker TERH — installation en application + notifications.
   - Pages : réseau d'abord ; si le réseau met plus de 4 s à répondre (connexion lente),
     la copie locale s'affiche aussitôt et la copie à jour est rangée pour la fois suivante.
   - Hors-ligne : copie locale en secours.
   - Jamais de cache pour Supabase ni pour les API (autre origine : données toujours à jour). */
const V='terh-v7';
const SHELL=['./','index.html','manifest.webmanifest','icon-192.png','icon-512.png'];
const NAV_TIMEOUT=4000;
self.addEventListener('install',e=>{
  e.waitUntil(caches.open(V).then(c=>Promise.all(SHELL.map(u=>c.add(u).catch(()=>{})))));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(x=>x!==V).map(x=>caches.delete(x)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=='GET'||u.origin!==location.origin)return;
  const net=fetch(r).then(res=>{
    if(res&&res.ok&&res.status===200){const cp=res.clone();caches.open(V).then(c=>c.put(r,cp)).catch(()=>{});}
    return res;
  });
  const secours=()=>caches.match(r).then(m=>m||(r.mode==='navigate'?caches.match('index.html'):null));
  if(r.mode==='navigate'){
    e.respondWith(new Promise(ok=>{
      let fini=false;const fin=x=>{if(!fini&&x){fini=true;ok(x);}};
      const t=setTimeout(()=>{secours().then(fin).catch(()=>{});},NAV_TIMEOUT);
      net.then(res=>{clearTimeout(t);fin(res);},()=>{clearTimeout(t);secours().then(m=>fin(m||Response.error())).catch(()=>fin(Response.error()));});
    }));
    e.waitUntil(net.catch(()=>{})); /* garde le worker actif pour finir la mise à jour du cache */
    return;
  }
  e.respondWith(net.catch(()=>secours().then(m=>m||Response.error())));
});
/* Clic sur une notification : ouvrir / ramener l'application */
self.addEventListener('notificationclick',e=>{
  e.notification.close();
  e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(l=>{
    for(const c of l){if('focus' in c)return c.focus();}
    return self.clients.openWindow('./');
  }));
});
