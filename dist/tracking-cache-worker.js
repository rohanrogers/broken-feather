// Bump this cache version whenever bundled tracking runtime/model files change.
const CACHE='broken-feather-tracking-v1';
const runtimePrefix=new URL('./assets/mediapipe/',self.location.href).pathname;
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(runtimePrefix))return;
  event.respondWith((async()=>{
    let cache;try{cache=await caches.open(CACHE);const saved=await cache.match(event.request);if(saved)return saved;}catch{}
    const response=await fetch(event.request);
    if(response.ok&&cache){const copy=response.clone();event.waitUntil(cache.put(event.request,copy).catch(()=>{}));}
    return response;
  })());
});
