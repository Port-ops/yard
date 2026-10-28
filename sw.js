// Keeps the Yard App screens on the phone so it opens with no signal.
const CACHE='yard-690ee38c1f';const FILES=["./","index.html","logo.png","icon-192.png","icon-512.png","apple-touch-icon.png","fonts/fonts.css","fonts/IBMPlexMono-500.woff2","fonts/Lato-400.woff2","fonts/Lato-700.woff2","fonts/Oswald-500.woff2","fonts/Oswald-600.woff2"];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE&&k.indexOf('yard-')===0&&!(k.indexOf('yardbeta-')===0&&'yard-'==='yard-')).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin)return;
e.respondWith(fetch(e.request).then(r=>{if(r.ok){const c=r.clone();caches.open(CACHE).then(x=>x.put(u.origin+u.pathname,c))}return r}).catch(()=>caches.match(e.request,{ignoreSearch:true}).then(r=>r||caches.match('index.html'))))});
