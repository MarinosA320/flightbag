/* Offline support: app files cached on install; map tiles cached as you view them. */
const V='efb-v21', TILES='efb-tiles-v1', MAXT=4000;
const SHELL=['./','index.html','style.css','app.js','plan.js','pack.js','route.js','enroute.js','account.js','perfdata.js','perfengine.js','data.js','points.js','charts.js','manifest.json','icon.svg','afm/cea-logo.png','icon-192.png','icon-512.png',
 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css','https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V&&k!==TILES&&k!=='efb-charts-v1').map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
const isTile=u=>/opentopomap\.org|tile\.openstreetmap\.org|arcgisonline\.com|tiles\.openaip\.net/.test(u);
self.addEventListener('fetch',e=>{
  const u=e.request.url;if(e.request.method!=='GET')return;
  if(/aviationweather\.gov/.test(u)||/\/api\//.test(u)||/login\.html/.test(u))return; /* live: weather, server API, sign-in */
  if(/\/charts\//.test(u)&&u.startsWith(self.location.origin)){e.respondWith(caches.match(u,{ignoreSearch:true}).then(h=>h||fetch(e.request).then(r=>{if(r.ok){const cp=r.clone();caches.open('efb-charts-v1').then(c=>c.put(u,cp))}return r})));return}
  if(isTile(u)){e.respondWith(caches.open(TILES).then(async c=>{const hit=await c.match(u,{ignoreSearch:false});if(hit)return hit;
    const r=await fetch(e.request);if(r.ok||r.type==='opaque'){c.put(u,r.clone());c.keys().then(k=>{if(k.length>MAXT)k.slice(0,k.length-MAXT).forEach(x=>c.delete(x))})}return r}));return}
  const same=u.startsWith(self.location.origin), cdn=/cdnjs\.cloudflare\.com|fonts\.g/.test(u);
  if(!same&&!cdn)return; /* never intercept other sites (weather, NOTAM): let the page see the real result */
  e.respondWith(fetch(e.request,same?{cache:'no-cache'}:{}).then(r=>{if(r.ok){const cp=r.clone();caches.open(V).then(c=>c.put(e.request,cp))}return r})
    .catch(()=>caches.match(e.request,{ignoreSearch:true}).then(h=>h||(e.request.mode==='navigate'?caches.match('index.html'):Response.error()))));
});
