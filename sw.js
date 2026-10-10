const CACHE='limud-v35';
const CORE=['./','./index.html','./tehillim.html','./hoshana.html','./study.html','./session.html','./dvar.html','./track.html','./dm.js','./pdf.min.mjs','./pdf.worker.min.mjs','./common.js','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
const netFirst=req=>(new URL(req.url).origin===location.origin?fetch(req.url,{cache:'no-cache'}):fetch(req)).then(r=>{ if(r.ok){ const c=r.clone(); caches.open(CACHE).then(ca=>ca.put(req,c)); } return r; }).catch(()=>caches.match(req,{ignoreSearch:false}).then(r=>r||caches.match(req,{ignoreSearch:true})));
self.addEventListener('fetch',e=>{ const u=new URL(e.request.url); if(e.request.method!=='GET') return;
  if(u.origin===location.origin || u.hostname.endsWith('sefaria.org')) e.respondWith(netFirst(e.request));
  else if(u.hostname.includes('fonts.g')) e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request).then(res=>{ const c=res.clone(); caches.open(CACHE).then(ca=>ca.put(e.request,c)); return res; })));
});
