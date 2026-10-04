/* Dvar Malchus weekly booklet: local storage, indexing by day, and rendering of a day's portion */
import * as pdfjs from './pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';

export const SUBJECTS = [
  {id:'chumash',  name:'חומש',               test:h=>/שיעוריומיל(יום|שבת)/.test(h)},
  {id:'tanya',    name:'תניא',               test:h=>h.includes('שיעוריםבספרהתניא')},
  {id:'hayomyom', name:'היום יום',            test:(h,top)=>h.includes('היוםיום')||top.includes('לוחהיוםיום'), whole:true},
  {id:'rambam3',  name:'רמב״ם – ג׳ פרקים',    test:h=>h.includes('רמבםגפרקיםליום')},
  {id:'rambam1',  name:'רמב״ם – פרק אחד',     test:h=>h.includes('רמבםפרקאחדליום')},
  {id:'sm',       name:'ספר המצוות',          test:h=>h.includes('רמבםספרהמצוות')},
  {id:'halacha',  name:'הלכה יומית ברמב״ם',    test:h=>h.includes('הלכהיומיתלעיוןברמבם')},
  {id:'mishna',   name:'משנה',               test:h=>/^[א-ת]{0,3}מסכת.*משנה/.test(h)},
];
export const DAYNAMES=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת קודש'];
const DAYW=[['ראשון'],['שני'],['שלישי'],['רביעי'],['חמישי'],['שישי','ששי'],['שבת']];
const norm=s=>s.replace(/[‎‏‪-‮"'״׳`]/g,'').replace(/\s+/g,'');
const HEAD=56, FOOT=26;
const IDXV=4;   // bump when the index format changes, so stored booklets are re-indexed   // running header / footer heights in PDF points

/* ---------- IndexedDB ---------- */
function idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open('limud',1); r.onupgradeneeded=()=>r.result.createObjectStore('files'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function put(k,v){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put(v,k); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
async function get(k){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readonly'); const r=tx.objectStore('files').get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }

/* ---------- indexing ---------- */
async function buildIndex(doc, onProgress){
  const pages=[];
  for(let p=1;p<=doc.numPages;p++){
    const pg=await doc.getPage(p); const vp=pg.getViewport({scale:1}); const tc=await pg.getTextContent();
    const lines={}, litems={}; let words=0;
    tc.items.forEach(it=>{ const y=Math.round(vp.height-it.transform[5]); (lines[y]=lines[y]||[]).push(it.str); (litems[y]=litems[y]||[]).push(it); const s=it.str.replace(/[\u0591-\u05C7]/g,''); const m=s.match(/[\u05d0-\u05ea]{2,}|[A-Za-z\u00c0-\u02af\u2000-\u2fff]{2,}/g); if(m) words+=m.length; });
    const ys=Object.keys(lines).map(Number).sort((a,b)=>a-b);
    let head='', top='', rh=''; ys.forEach(y=>{ const t=lines[y].join(' '); if(y<HEAD){ head+=t+' '; rh+=t+' '; } if(y<120) top+=t+' '; });
    // running header title (without the page number) and the first large title on the page
    rh=rh.replace(/[\u200e\u200f\u202a-\u202e]/g,' ').replace(/\s+/g,' ').trim(); { const tk=rh.split(' '); let k=0; while(k<3&&tk[k]&&/^[א-ת]{1,3}$/.test(tk[k])) k++; rh=tk.slice(k).join(' ').replace(/^[\/\s]+/,'').trim(); }
    let big=''; for(const y of ys){ if(y<HEAD||y>260) continue; const its=litems[y]; const t=its.map(i=>i.str).join('').replace(/[\u0591-\u05C7]/g,'').trim(); const hgt=Math.max(...its.map(i=>i.height||0));
      const heb=(t.match(/[א-ת]/g)||[]).length; if(hgt>=13 && heb>=3 && t.length<=40 && heb/t.replace(/\s/g,'').length>0.7){ big=t.replace(/â|ã/g,'').trim(); break; } }
    head=norm(head).replace(/^[א-ת]{1,4}(?=שיעור|מתוך|הלכה|מסכת|היום)/,''); top=norm(top);
    const marks=[];
    ys.forEach(y=>{ if(y<HEAD) return; const t=lines[y].join(''); if(!t.includes('â')) return; const n=norm(t);
      DAYW.forEach((ws,i)=>{ if(ws.some(w=>n.includes('יום'+w))||(i===6&&n.includes('שבתקודש'))) { const its=litems[y].filter(it=>it.str.includes('â')); const xs=its.length?its.map(it=>it.transform[4]+it.width/2):litems[y].map(it=>it.transform[4]+it.width/2); const c=(Math.min(...xs)+Math.max(...xs))/2; const col=Math.abs(c-vp.width/2)<vp.width*0.1?'F':(c>vp.width/2?'R':'L'); marks.push({y,day:i,col,label:t.replace(/â/g,'').replace(/\s+/g,' ').trim()}); } }); });
    // column geometry: find the gutter (widest empty band near the middle) and the outer text edges
    const bins=new Uint16Array(Math.ceil(vp.width/2)+2); let minX=vp.width, maxX=0;
    tc.items.forEach(it=>{ const y=vp.height-it.transform[5]; if(y<HEAD||y>vp.height-FOOT||!it.str.trim()) return; const x0=it.transform[4], x1=x0+it.width; if(it.width<=0) return;
      minX=Math.min(minX,x0); maxX=Math.max(maxX,x1); for(let b=Math.floor(x0/2);b<=Math.floor(x1/2)&&b<bins.length;b++) bins[b]++; });
    let gs=-1, ge=-1, best=0; const lo=Math.floor(vp.width*0.38/2), hi=Math.ceil(vp.width*0.62/2);
    for(let b=lo,run=0,st=0;b<=hi;b++){ if(bins[b]===0){ if(!run) st=b; run++; if(run>best){ best=run; gs=st*2; ge=(b+1)*2; } } else run=0; }
    const gut=best>=2?[gs,ge]:[vp.width/2-3,vp.width/2+3];
    // printed line numbers in the outer margins (sichos, maamarim…): [y, number, side]
    let ln=[]; tc.items.forEach(it=>{ const t=it.str.trim(); if(!/^\d{1,3}$/.test(t)) return; const x0=it.transform[4], x1=x0+(it.width||0), y=Math.round(vp.height-it.transform[5]);
      if(y<HEAD||y>vp.height-FOOT) return; if(x0<75) ln.push([y,+t,'L']); else if(x1>vp.width-75) ln.push([y,+t,'R']); });
    ln=['R','L'].flatMap(sd=>{ const a=ln.filter(l=>l[2]===sd).sort((p,q)=>p[0]-q[0]); let inc=0; for(let i=1;i<a.length;i++) if(a[i][1]>a[i-1][1]) inc++; return a.length>=4&&inc>=a.length*0.7?a:[]; });
    const subj=(SUBJECTS.find(s=>s.test(head,top))||{}).id||null;
    pages.push({p,h:vp.height,w:vp.width,subj,marks,words,rh,big,gut,ln,ex:[Math.max(0,minX-6),Math.min(vp.width,maxX+6)]});
    if(onProgress) onProgress(p/doc.numPages);
  }
  // segments per subject and day
  const index={pages:pages.map(x=>({h:x.h,w:x.w,words:x.words,gut:x.gut,ex:x.ex,ln:x.ln.length?x.ln:undefined})), subjects:{}};
  SUBJECTS.forEach(S=>{
    const ps=pages.filter(x=>x.subj===S.id); if(!ps.length) return;
    const first=ps[0].p, last=ps[ps.length-1].p;
    const marks=[]; ps.forEach(x=>x.marks.forEach(m=>marks.push({p:x.p,y:m.y,col:m.col,day:m.day,label:m.label})));
    const days={};
    if(S.whole || !marks.length){ for(let d=0;d<7;d++) days[d]={from:{p:first,y:HEAD},to:{p:last,y:null},whole:true}; }
    else {
      const byDay={}; marks.forEach(m=>{ if(!(m.day in byDay)) byDay[m.day]=m; });
      const ds=Object.keys(byDay).map(Number).sort((a,b)=>a-b);
      ds.forEach((dd,i)=>{ const m=byDay[dd], nx=byDay[ds[i+1]];
        days[dd]={from:{p:m.p,y:m.y,col:m.col}, to:nx?{p:nx.p,y:nx.y,col:nx.col}:{p:last,y:null,col:'F'}, label:m.label}; });
      // a combined day (e.g. Friday–Shabbat) without its own marker: reuse the neighbour's range
      for(let d=0;d<7;d++){ if(!days[d]){ const n=days[d+1]||days[d-1]; if(n) days[d]=Object.assign({},n,{shared:true}); } }
    }
    index.subjects[S.id]={first,last,days};
  });
  // week label from the chumash / first markers
  const lab=[]; for(const s of Object.values(index.subjects)) for(let d=0;d<7;d++){ const L=s.days[d]&&s.days[d].label; if(L&&!lab[d]) lab[d]=L; }
  index.dayLabels=lab; index.v=IDXV;
  // weekly (not daily) sections: group the remaining pages by their running header
  const secs=[]; const key=s=>(s||'').replace(/^[\/\s]+/,'').split(/[\s\-–.\/]+/).filter(Boolean)[0]||'';
  pages.forEach(x=>{ if(x.subj || x.p===1) return; const last=secs[secs.length-1]; const k=key(x.rh);
    const nn=s=>norm(s||'').replace(/[^א-ת]/g,''); const startsNew = !!x.big && (!x.rh || nn(x.rh).startsWith(nn(x.big).slice(0,8)));
    if(last && last.to===x.p-1 && !startsNew && ((k && (last.keys.has(k) || last.keys.size<2)) || (!k && !x.big))){
      last.to=x.p; if(k) last.keys.add(k); if(!last.title && x.rh) last.title=x.rh; last.words+=x.words; return; }
    secs.push({from:x.p,to:x.p,keys:new Set(k?[k]:[]),title:(x.big||x.rh||'').slice(0,60),words:x.words}); });
  const tidy=t=>t.replace(/["״]/g,'״').replace(/\s*תלמוד בבלי המבואר.*$/,'').replace(/\s+/g,' ').trim().slice(0,48);
  index.sections=secs.filter(s=>s.title).map(s=>({from:s.from,to:s.to,title:tidy(s.title),words:s.words}));
  return index;
}

let DOC=null, META=null;
let REIDX=null;
export async function loadStored(onProgress){ if(META) return META; const m=await get('dm'); if(!m) return null;
  if(!m.index || m.index.v!==IDXV){ // booklet stored by an older version: rebuild its index once
    REIDX=REIDX||(async()=>{ const d=await pdfjs.getDocument({data:m.data.slice(0)}).promise; m.index=await buildIndex(d,onProgress); await put('dm',m); DOC=d; return m; })();
    await REIDX; }
  META=m; return m; }
async function doc(){ if(DOC) return DOC; const m=await loadStored(); if(!m) throw new Error('no booklet'); DOC=await pdfjs.getDocument({data:m.data.slice(0)}).promise; return DOC; }
export async function importFile(buf,name,onProgress){
  const d=await pdfjs.getDocument({data:buf.slice(0)}).promise;
  const index=await buildIndex(d,onProgress);
  const m={data:buf,name,loadedAt:Date.now(),index};
  await put('dm',m); META=m; DOC=d; return m; }
export async function tryDownload(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.arrayBuffer(); }

/* which weekday column matches today's Hebrew date label (e.g. כ"ג תשרי) */
/* today's portion summary for the home screen */
export function todayInfo(index, hebLabel){ const d=dayForLabel(index,hebLabel); if(d<0) return null; const out={};
  SUBJECTS.forEach(S=>{ if(!index.subjects[S.id]) return; const sl=slices(index,S.id,d); if(sl.length) out[S.id]={name:S.name, words:sl.reduce((a,b)=>a+b.words,0), pages:sl.length}; });
  return {day:d, subjects:out}; }
export function dayForLabel(index, hebLabel){ const n=norm(hebLabel); const L=index.dayLabels||[]; for(let d=0;d<7;d++){ if(L[d] && norm(L[d]).includes(n)) return d; } return -1; }

/* list of page slices for a subject/day: [{p, y0, y1, w, h, words}] (PDF units) */
export function sectionSlices(index, i){ const s=(index.sections||[])[i]; if(!s) return []; const out=[];
  for(let p=s.from;p<=s.to;p++){ const pg=index.pages[p-1]; out.push({p,x0:0,x1:pg.w,y0:HEAD-14,y1:pg.h-FOOT+10,w:pg.w,h:pg.h,words:pg.words}); } return out; }
export function slices(index, subj, day){
  const S=index.subjects[subj]; if(!S) return []; const D=S.days[day]; if(!D) return [];
  const out=[]; const P=index.pages;
  for(let p=D.from.p;p<=D.to.p;p++){ const pg=P[p-1]; if(!pg) continue;
    const top=HEAD, bot=pg.h-FOOT, gut=pg.gut||[pg.w/2-3,pg.w/2+3], ex=pg.ex||[0,pg.w];
    let Rr=[top,bot], Lr=[top,bot];
    if(p===D.from.p && D.from.y!=null){ const y=Math.max(top,D.from.y-14);
      if(D.from.col==='R'){ Rr[0]=y; } else if(D.from.col==='L'){ Rr=[0,0]; Lr[0]=y; } else { Rr[0]=Lr[0]=y; } }
    if(p===D.to.p && D.to.y!=null){ const y=D.to.y-8;
      if(D.to.col==='R'){ Rr[1]=y; Lr=[0,0]; } else if(D.to.col==='L'){ Lr[1]=y; } else { Rr[1]=Math.min(Rr[1],y); Lr[1]=Math.min(Lr[1],y); } }
    const ok=r=>r[1]-r[0]>12;
    const push=(x0,x1,r,col)=>{ const frac=(r[1]-r[0])*(x1-x0)/((pg.h-HEAD-FOOT)*pg.w); out.push({p,x0,x1,col,y0:r[0],y1:r[1],w:pg.w,h:pg.h,words:Math.round(pg.words*Math.max(0.03,frac))}); };
    if(ok(Rr)&&ok(Lr)&&Rr[0]===Lr[0]&&Rr[1]===Lr[1]) push(0,pg.w,Rr);
    else { if(ok(Rr)) push(gut[1]-3,ex[1],Rr,'R'); if(ok(Lr)) push(ex[0],gut[0]+3,Lr,'L'); } }
  return out; }

/* printed line numbers inside a slice, in reading order */
export function sliceLines(index, sl){ const pg=index.pages[sl.p-1]; if(!pg||!pg.ln) return [];
  return pg.ln.filter(l=>l[0]>=sl.y0-4 && l[0]<=sl.y1+4 && (!sl.col || l[2]===sl.col)).map(l=>l[1]).sort((a,b)=>a-b); }
/* render one slice into a canvas of the given css width */
/* css size of a slice: full-width slices use the page zoom, single columns fill the screen */
export function sliceBox(sl, pageCss, screenW){ const full=(sl.x1-sl.x0)>sl.w*0.8; const pc=full?pageCss:Math.max(pageCss, screenW*0.97*sl.w/(sl.x1-sl.x0));
  return {pageCss:pc, w:(sl.x1-sl.x0)*pc/sl.w, h:(sl.y1-sl.y0)*pc/sl.w}; }
export async function renderSlice(sl, cssWidth, canvas){
  const d=await doc(); const pg=await d.getPage(sl.p);
  const dpr=Math.min(3,window.devicePixelRatio||1); const scale=cssWidth/sl.w*dpr;
  const vp=pg.getViewport({scale});
  const full=document.createElement('canvas'); full.width=Math.ceil(vp.width); full.height=Math.ceil((sl.y1)*scale);
  await pg.render({canvasContext:full.getContext('2d'), viewport:vp}).promise;
  const h=Math.ceil((sl.y1-sl.y0)*scale); let x0=Math.floor((sl.x0||0)*scale), wd=Math.ceil(((sl.x1||sl.w)-(sl.x0||0))*scale);
  if(sl.col){ // find the real gutter from the pixels of this band
    const W=full.width, gx0=Math.floor(W*0.38), gw=Math.floor(W*0.24), yy=Math.floor(sl.y0*scale);
    const img=full.getContext('2d').getImageData(gx0,yy,gw,h).data; const cnt=new Uint32Array(gw); let rows=0;
    for(let y=0;y<h;y+=2){ rows++; const row=y*gw*4; for(let x=0;x<gw;x++){ const i=row+x*4; if(img[i+3]>40 && (img[i]+img[i+1]+img[i+2])<420) cnt[x]++; } }
    const thr=Math.max(2,rows*0.05);
    let best=0,bs=-1,be=-1; for(let x=0,run=0,st=0;x<gw;x++){ if(cnt[x]<=thr){ if(!run) st=x; run++; if(run>best){ best=run; bs=st; be=x+1; } } else run=0; }
    if(best>=Math.max(4,2*dpr)){ const gs=gx0+bs, ge=gx0+be;
      if(sl.col==='R'){ const r=Math.ceil((sl.x1||sl.w)*scale); x0=ge-Math.round(2*dpr); wd=r-x0; }
      else { x0=Math.floor((sl.x0||0)*scale); wd=gs+Math.round(2*dpr)-x0; } } }
  canvas.width=wd; canvas.height=h;
  canvas.getContext('2d').drawImage(full,x0,Math.floor(sl.y0*scale),wd,h,0,0,wd,h);
  full.width=full.height=0; return canvas; }
