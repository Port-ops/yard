// Keeps the Yard App screens on the phone so it opens with no signal.
const CACHE = 'yard-cb1113b';const FILES=["./","index.html","logo.png","icon-192.png","icon-512.png","apple-touch-icon.png","fonts/fonts.css","fonts/IBMPlexMono-500.woff2","fonts/Lato-400.woff2","fonts/Lato-700.woff2","fonts/Oswald-500.woff2","fonts/Oswald-600.woff2"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k.indexOf('yard-')===0&&!(k.indexOf('yardbeta-')===0&&'yard-'==='yard-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(u.origin+u.pathname,c))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
// Phone alerts (owner 11/2/2026): show DockRelay push alerts with sound/vibration; tapping one opens the app
self.addEventListener('push',e=>{let d={};try{d=e.data?e.data.json():{}}catch(_){d={body:e.data?e.data.text():''}}
  e.waitUntil(self.registration.showNotification(d.title||'DockRelay',{body:d.body||'',tag:d.tag||undefined,renotify:true,requireInteraction:!!d.urgent,silent:false,vibrate:[400,150,400,150,400],icon:'icon-192.png',badge:'icon-192.png',data:{url:d.url||'./'}}))});
self.addEventListener('notificationclick',e=>{e.notification.close();const u=new URL((e.notification.data&&e.notification.data.url)||'./',self.registration.scope).href;
  e.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(L=>{for(const c of L){if(c.url.indexOf(self.registration.scope)===0){return c.focus().then(w=>w&&w.navigate?w.navigate(u):w)}}return clients.openWindow(u)}))});
