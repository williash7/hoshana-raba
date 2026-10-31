const CACHE='limud-v96';
const CORE=['./','./index.html','./tehillim.html','./hoshana.html','./study.html','./session.html','./dvar.html','./track.html','./dm.js','./pdf.min.mjs','./pdf.worker.min.mjs','./common.js','./hdr.js','./manifest.json','./icon-192.png','./icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('limud-v')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
async function offlineMatch(req){
 const names=(await caches.keys()).filter(n=>n.startsWith('limud-offline-'));
 for(const name of names){const r=await (await caches.open(name)).match(req);if(r)return r;}
 return undefined;
}
async function netFirst(req,isSef){
 try{
  const r=await fetch(req.url.startsWith(location.origin)?new Request(req,{cache:'no-cache'}):req);
  if(r.ok&&!isSef) {const ca=await caches.open(CACHE);await ca.put(req,r.clone());}
  return r;
 }catch(err){
  const saved=isSef?await offlineMatch(req):await caches.match(req,{ignoreSearch:false})||await caches.match(req,{ignoreSearch:true});
  if(saved)return saved;
  throw err;
 }
}
self.addEventListener('fetch',e=>{
 const req=e.request;if(req.method!=='GET')return;
 const u=new URL(req.url),isSef=u.hostname==='www.sefaria.org'||u.hostname==='sefaria.org';
 if(u.origin===location.origin||isSef)e.respondWith(netFirst(req,isSef));
 else if(u.hostname.includes('fonts.g'))e.respondWith(caches.match(req).then(r=>r||fetch(req).then(async res=>{if(res.ok)await(await caches.open(CACHE)).put(req,res.clone());return res;})));
});
