/* Separate Kinus PWA: cache the study UI first, and photos only after they are opened. */
const CACHE='kinus-study-v1';
const CORE=[
 './','./index.html','./app.css?v=6','./data.js?v=6',
 './quiz.js?v=6','./fulltext.js?v=6','./app.js?v=6',
 './kinus-manifest.webmanifest?v=7','./icon-192.png','./icon-512.png'
];
self.addEventListener('install',e=>{
 e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
 e.waitUntil(caches.keys().then(keys=>Promise.all(
  keys.filter(k=>(k.startsWith('kinus-study-')||k.startsWith('kinus-5787-'))&&k!==CACHE).map(k=>caches.delete(k))
 )).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',e=>{
 const req=e.request;
 if(req.method!=='GET'||new URL(req.url).origin!==self.location.origin)return;
 e.respondWith((async()=>{
  const cache=await caches.open(CACHE);
  try{
   const response=await fetch(req);
   if(response.ok)await cache.put(req,response.clone());
   return response;
  }catch(err){
   const cached=await cache.match(req,{ignoreSearch:true});
   if(cached)return cached;
   if(req.mode==='navigate'){
    const home=await cache.match('./index.html');
    if(home)return home;
   }
   throw err;
  }
 })());
});
