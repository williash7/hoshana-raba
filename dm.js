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
const IDXV=6;   // bump when the index format changes, so stored booklets are re-indexed   // running header / footer heights in PDF points

/* legacy Hebrew fonts: letters stored as cp1255 bytes shown as Latin-1 or Mac-Roman characters */
const MACR='ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»…\xa0ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔ\uf8ffÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ';
function decHeb(str){ let o=''; for(const ch of str){ const c=ch.charCodeAt(0); let b=-1;
  if(c>=0xE0&&c<=0xFA) b=c; else { const i=MACR.indexOf(ch); if(i>=0) b=0x80+i; }
  o+= b>=0xE0&&b<=0xFA ? String.fromCharCode(b-0xE0+0x5D0) : ch; } return o; }
const GV={'א':1,'ב':2,'ג':3,'ד':4,'ה':5,'ו':6,'ז':7,'ח':8,'ט':9,'י':10,'כ':20,'ך':20,'ל':30,'מ':40,'ם':40,'נ':50,'ן':50,'ס':60,'ע':70,'פ':80,'ף':80,'צ':90,'ץ':90,'ק':100,'ר':200,'ש':300,'ת':400};
const numLab=t=>[...t].filter(c=>GV[c]).sort((a,b)=>GV[b]-GV[a]).join('');
const numVal=t=>[...t].reduce((a,c)=>a+(GV[c]||0),0);

/* ---------- IndexedDB ---------- */
function idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open('limud',1); r.onupgradeneeded=()=>r.result.createObjectStore('files'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function put(k,v){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put(v,k); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
async function get(k){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readonly'); const r=tx.objectStore('files').get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }

/* ---------- page layout (from pixels, since legacy fonts report wrong text widths) ---------- */
async function pageLayout(pg, vp){ const sc=0.5, v=pg.getViewport({scale:sc}); const W=Math.ceil(v.width), H=Math.ceil(v.height);
  const cv=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(W,H):Object.assign(document.createElement('canvas'),{width:W,height:H});
  const ctx=cv.getContext('2d',{willReadFrequently:true}); ctx.fillStyle='#fff'; ctx.fillRect(0,0,W,H);
  await pg.render({canvasContext:ctx, viewport:v}).promise;
  const d=ctx.getImageData(0,0,W,H).data; const y0=Math.floor(HEAD*sc), y1=Math.floor((vp.height-FOOT)*sc);
  const full=[[HEAD,vp.height-FOOT,'F',1,1]];
  const ink=new Uint8Array(W*H); for(let i=0,j=0;i<d.length;i+=4,j++) ink[j]=d[i]+d[i+1]+d[i+2]<640?1:0;   // include grey (line numbers)
  const cnt=new Uint32Array(W); for(let y=y0;y<y1;y++){ const r=y*W; for(let x=0;x<W;x++) cnt[x]+=ink[r+x]; }
  let exL=0, exR=W-1; while(exL<W&&cnt[exL]<2) exL++; while(exR>0&&cnt[exR]<2) exR--;
  const ex=exR>exL?[Math.max(0,exL/sc-9),Math.min(vp.width,(exR+1)/sc+9)]:null;
  const lo=Math.floor(W*0.38), hi=Math.ceil(W*0.62), thr=Math.max(1,(y1-y0)*0.03);
  // the gap closest to the page centre (line numbers may sit between the columns)
  let best=0,bs=-1,bd=1e9; const cx=(exL+exR)/2;
  for(let x=lo,run=0,st=0;x<=hi+1;x++){ if(x<=hi&&cnt[x]<=thr){ if(!run) st=x; run++; } else { if(run>=3){ const dd=Math.max(0,st-cx,cx-(st+run)); if(dd<bd-2||(Math.abs(dd-bd)<=2&&run>best)){ bd=dd; best=run; bs=st; } } run=0; } }
  if(best<3) return {gut:null, ex, bands:full};
  const gs=bs, ge=bs+best;
  // rows whose ink crosses the gutter belong to full-width parts; the rest are two columns
  const cr=[], rR=[], rL=[]; for(let y=y0;y<y1;y++){ const r=y*W; let c=0,a=0,b=0; for(let x=gs+1;x<ge-1;x++) c+=ink[r+x]; for(let x=ge;x<=exR;x++) a+=ink[r+x]; for(let x=exL;x<gs;x++) b+=ink[r+x]; cr.push(c>0); rR.push(a>0); rL.push(b>0); }
  const gap=Math.round(10*sc), fb=[]; let cur=null;
  cr.forEach((c,i)=>{ if(!c) return; const y=y0+i; if(cur&&y-cur[1]<=gap) cur[1]=y; else { if(cur) fb.push(cur); cur=[y,y]; } }); if(cur) fb.push(cur);
  const P=y=>y/sc, bands=[]; let at=HEAD;
  const side=(A,B)=>{ let r=0,l=0; for(let y=Math.max(y0,Math.floor(A*sc));y<Math.min(y1,Math.ceil(B*sc));y++){ r|=rR[y-y0]; l|=rL[y-y0]; } return [r,l]; };
  const pushS=(A,B)=>{ if(B-A<=2) return; if(B-A<10&&bands.length&&bands[bands.length-1][2]==='F'){ bands[bands.length-1][1]=B; return; } const [r,l]=side(A,B); if(r||l) bands.push([A,B,'S',r,l]); else if(bands.length) bands[bands.length-1][1]=B; };
  fb.forEach(([a,b])=>{ const A=Math.max(at,P(a)-3), B=P(b+1)+3; pushS(at,A); const last=bands[bands.length-1]; if(last&&last[2]==='F'&&A-last[1]<10) last[1]=B; else bands.push([A,B,'F',1,1]); at=B; });
  pushS(at,vp.height-FOOT);
  if(!bands.some(b=>b[2]==='S')) return {gut:null, ex, bands:full};
  return {gut:[gs/sc,ge/sc], ex, bands}; }

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
    let gut=best>=2?[gs,ge]:[vp.width/2-3,vp.width/2+3];
    // page layout from the rendered pixels: gutter and vertical bands (full-width parts vs. two columns)
    const L=await pageLayout(pg,vp); let bands=L.bands; if(L.gut) gut=L.gut; if(L.ex){ minX=L.ex[0]+6; maxX=L.ex[1]-6; }
    // a two-column band must contain text; decorative titles (no text) stay whole
    if(L.gut){ const mid=(gut[0]+gut[1])/2; bands=bands.map(b=>{ if(b[2]!=='S') return b; let r=0,l=0;
        tc.items.forEach(it=>{ if(!it.str.trim()) return; const y=vp.height-it.transform[5]; if(y<b[0]||y>b[1]+4) return; if(it.transform[4]>=mid) r++; else l++; });
        if(!r||!l) return (r||l)&&b[1]-b[0]>120?[b[0],b[1],'S',r?1:0,l?1:0]:[b[0],b[1],'F',1,1]; return b; });
      const m=[]; bands.forEach(b=>{ const t=m[m.length-1]; if(t&&t[2]==='F'&&b[2]==='F') t[1]=b[1]; else m.push(b); }); bands=m; }
    // printed line numbers in the outer margins (sichos, maamarim…): [y, number, side]
    let ln=[]; tc.items.forEach(it=>{ const t=it.str.trim(); if(!/^\d{1,3}$/.test(t)) return; const x0=it.transform[4], x1=x0+(it.width||0), y=Math.round(vp.height-it.transform[5]);
      if(y<HEAD||y>vp.height-FOOT) return; if(x0<75) ln.push([y,+t,'L']); else if(x1>vp.width-75) ln.push([y,+t,'R']); });
    ln=['R','L'].flatMap(sd=>{ const a=ln.filter(l=>l[2]===sd).sort((p,q)=>p[0]-q[0]); let inc=0; for(let i=1;i<a.length;i++) if(a[i][1]>a[i-1][1]) inc++; return a.length>=4&&inc>=a.length*0.7?a:[]; });
    // landmarks for the printed booklet: verse (p), halacha (h) and chapter (k) markers: [y, kind, label, side]
    const lm=[]; const mid=(gut[0]+gut[1])/2; const side=it=>it.transform[4]>=gut[1]-4?'R':(it.transform[4]+(it.width||0)/2>mid+40?'R':'L');
    const bigL={};
    tc.items.forEach(it=>{ const h=it.height||Math.abs(it.transform[3]); const y=Math.round(vp.height-it.transform[5]); if(y<HEAD||y>vp.height-FOOT) return;
      const t=decHeb(it.str);
      if(h>=12.5){ const m=t.match(/\(([א-ת]{1,3})\)|\)([א-ת]{1,3})\(/); if(m&&h<17&&!/[ךםןףץ]/.test(m[1]||m[2])) lm.push([y,'p',numLab(m[1]||m[2]),side(it)]); }
      if(h>=19.5){ const m=t.trim().match(/^\.?([א-ת]{1,3})\.?$/); if(m&&t.includes('.')) lm.push([y,'h',numLab(m[1]),side(it)]); }
      if(h>=17.5&&h<19.5){ (bigL[y]=bigL[y]||[]).push(it); } });
    Object.entries(bigL).forEach(([y,its])=>{ const t=decHeb(its.map(i=>i.str).join('')).replace(/\s/g,''); if(t.length<=9 && /קר|רק/.test(t)){ const lab=numLab(t.replace(/[פרק]/g,'')); if(lab&&lab.length<=2) lm.push([+y,'k',lab,side(its[0])]); } });
    const subj=(SUBJECTS.find(s=>s.test(head,top))||{}).id||null;
    if(subj==='chumash') bands=[[HEAD,vp.height-FOOT,'F',1,1]];   // designed verse/targum/Rashi layout: keep the page whole
    { const keep=subj==='chumash'?['p']:/^(rambam|sm|halacha)/.test(subj||'')?['h','k']:[]; for(let i=lm.length-1;i>=0;i--) if(!keep.includes(lm[i][1])) lm.splice(i,1); }
    pages.push({p,h:vp.height,w:vp.width,subj,marks,words,rh,big,gut,bands,ln,lm,ex:[Math.max(0,minX-6),Math.min(vp.width,maxX+6)]});
    if(onProgress) onProgress(p/doc.numPages);
  }
  // segments per subject and day
  const index={pages:pages.map(x=>({h:x.h,w:x.w,words:x.words,gut:x.gut,bands:x.bands,ex:x.ex,ln:x.ln.length?x.ln:undefined,lm:x.lm.length?x.lm:undefined})), subjects:{}};
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

/* ---------- booklet archive: one booklet per week (Sunday date), kept until everything in it is learned ----------
   IndexedDB keys: 'dmlist' → [{wk,name,loadedAt}], 'dmidx:<wk>' → index, 'dmpdf:<wk>' → PDF bytes */
const DOCS={}, IDXS={}; let LISTP=null;
const sundayIso=d=>{ const x=new Date(d); x.setHours(12,0,0,0); x.setDate(x.getDate()-x.getDay()); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
// which week a booklet belongs to: the Sunday whose Hebrew date is the booklet's first day
function weekOf(index){ const now=new Date(); now.setHours(12,0,0,0);
  for(let k=-70;k<=21;k++){ const d=new Date(now); d.setDate(d.getDate()+k); if(d.getDay()!==0) continue; if(dayForLabel(index,globalThis.hebOf(d).label)===0) return sundayIso(d); }
  for(let k=-70;k<=21;k++){ const d=new Date(now); d.setDate(d.getDate()+k); const i=dayForLabel(index,globalThis.hebOf(d).label); if(i>=0){ d.setDate(d.getDate()-i); return sundayIso(d); } }
  return sundayIso(now); }
async function migrate(){ const old=await get('dm'); if(!old) return;
  let index=old.index; if(!index||index.v!==IDXV){ const d=await pdfjs.getDocument({data:old.data.slice(0)}).promise; index=await buildIndex(d); }
  const wk=weekOf(index); await put('dmpdf:'+wk,old.data); await put('dmidx:'+wk,index);
  const L=(await get('dmlist'))||[]; if(!L.some(x=>x.wk===wk)) L.push({wk,name:old.name,loadedAt:old.loadedAt||Date.now()}); await put('dmlist',L); await del('dm'); }
async function del(k){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').delete(k); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
export async function listBooklets(){ LISTP=LISTP||(async()=>{ await migrate(); return ((await get('dmlist'))||[]).sort((a,b)=>a.wk<b.wk?-1:1); })(); return LISTP; }
let REIDX={};
async function indexOf(wk,onProgress){ if(IDXS[wk]) return IDXS[wk];
  let index=await get('dmidx:'+wk); if(!index) return null;
  if(index.v!==IDXV){ REIDX[wk]=REIDX[wk]||(async()=>{ const data=await get('dmpdf:'+wk); const d=await pdfjs.getDocument({data:data.slice(0)}).promise; DOCS[wk]=d; const ix=await buildIndex(d,onProgress); await put('dmidx:'+wk,ix); return ix; })(); index=await REIDX[wk]; }
  index.bk=wk; IDXS[wk]=index; return index; }
// a booklet: {wk,name,loadedAt,index}; without wk → this week's booklet, or the newest one
export async function loadStored(onProgress, wk){ const L=await listBooklets(); if(!L.length) return null;
  const cur=sundayIso(new Date()); const e=wk?L.find(x=>x.wk===wk):(L.find(x=>x.wk===cur)||L[L.length-1]); if(!e) return null;
  const index=await indexOf(e.wk,onProgress); return index?Object.assign({},e,{index}):null; }
export async function loadAll(){ const L=await listBooklets(); const out=[]; for(const e of L){ const index=await indexOf(e.wk); if(index) out.push(Object.assign({},e,{index})); } return out; }
export async function removeBooklet(wk){ await del('dmpdf:'+wk); await del('dmidx:'+wk); const L=((await get('dmlist'))||[]).filter(x=>x.wk!==wk); await put('dmlist',L); LISTP=null; delete IDXS[wk]; delete DOCS[wk]; }
async function doc(wk){ if(DOCS[wk]) return DOCS[wk]; const data=await get('dmpdf:'+wk); if(!data) throw new Error('no booklet'); DOCS[wk]=await pdfjs.getDocument({data:data.slice(0)}).promise; return DOCS[wk]; }
export async function importFile(buf,name,onProgress){
  const d=await pdfjs.getDocument({data:buf.slice(0)}).promise;
  const index=await buildIndex(d,onProgress); const wk=weekOf(index);
  await put('dmpdf:'+wk,buf); await put('dmidx:'+wk,index);
  await listBooklets(); const L=((await get('dmlist'))||[]).filter(x=>x.wk!==wk); const e={wk,name,loadedAt:Date.now()}; L.push(e); await put('dmlist',L); LISTP=null;
  index.bk=wk; IDXS[wk]=index; DOCS[wk]=d; return Object.assign({},e,{index}); }
export async function tryDownload(url){ const r=await fetch(url,{cache:'no-store'}); if(!r.ok) throw new Error('HTTP '+r.status); return await r.arrayBuffer(); }

/* which weekday column matches today's Hebrew date label (e.g. כ"ג תשרי) */
/* today's portion summary for the home screen */
export function todayInfo(index, hebLabel){ const d=dayForLabel(index,hebLabel); if(d<0) return null; const out={};
  SUBJECTS.forEach(S=>{ if(!index.subjects[S.id]) return; const sl=slices(index,S.id,d); if(sl.length) out[S.id]={name:S.name, words:sl.reduce((a,b)=>a+b.words,0), pages:sl.length}; });
  return {day:d, subjects:out}; }
export function dayForLabel(index, hebLabel){ const n=norm(hebLabel); const L=index.dayLabels||[]; for(let d=0;d<7;d++){ if(L[d] && norm(L[d]).includes(n)) return d; } return -1; }

/* list of page slices for a subject/day: [{p, y0, y1, w, h, words}] (PDF units) */
export function sectionSlices(index, i){ const s=(index.sections||[])[i]; if(!s) return []; const out=[];
  for(let p=s.from;p<=s.to;p++){ const pg=index.pages[p-1]; pieces(pg).forEach(c=>{ if(c.y1-c.y0>12) out.push(pieceSlice(pg,p,c,index.bk)); }); } return out; }
/* reading-order pieces of a page: full-width parts as they are, two-column parts as right column then left column */
function pieces(pg){ const bands=pg.bands||[[HEAD,pg.h-FOOT,'F',1,1]], out=[];
  bands.forEach((b,bi)=>{ if(b[2]==='F') out.push({bi,y0:b[0],y1:b[1],col:null}); else { if(b[3]) out.push({bi,y0:b[0],y1:b[1],col:'R'}); if(b[4]) out.push({bi,y0:b[0],y1:b[1],col:'L'}); } });
  return out; }
const bandAt=(pg,y)=>{ const bs=pg.bands||[[HEAD,pg.h-FOOT,'F']]; let k=bs.findIndex(b=>y>=b[0]-2&&y<=b[1]+2); if(k<0){ k=0; bs.forEach((b,i)=>{ if(b[0]<=y) k=i; }); } return k; };
function pieceSlice(pg,p,c,bk){ const gut=pg.gut||[pg.w/2-3,pg.w/2+3], ex=pg.ex||[0,pg.w]; const x0=c.col==='R'?gut[1]-3:c.col==='L'?ex[0]:0, x1=c.col==='R'?ex[1]:c.col==='L'?gut[0]+3:pg.w;
  const frac=(c.y1-c.y0)*(x1-x0)/((pg.h-HEAD-FOOT)*pg.w); return {bk,p,x0,x1,gx:(gut[0]+gut[1])/2,col:c.col||undefined,fit:!c.col&&!!(pg.bands&&pg.bands.some(b=>b[2]==='S'))||undefined,y0:c.y0,y1:c.y1,w:pg.w,h:pg.h,words:Math.round(pg.words*Math.max(0.02,frac))}; }
export function slices(index, subj, day){
  const S=index.subjects[subj]; if(!S) return []; const D=S.days[day]; if(!D) return [];
  const out=[]; const P=index.pages;
  for(let p=D.from.p;p<=D.to.p;p++){ const pg=P[p-1]; if(!pg) continue; let ps=pieces(pg);
    if(p===D.from.p && D.from.y!=null){ const Y=Math.max(HEAD,D.from.y-14), bi=bandAt(pg,D.from.y), C=D.from.col;
      ps=ps.filter(c=>c.bi>=bi).map(c=>{ if(c.bi!==bi) return c; if(!c.col) return Object.assign({},c,{y0:Math.max(c.y0,Y)});
        if(C==='L') return c.col==='L'?Object.assign({},c,{y0:Math.max(c.y0,Y)}):null;
        if(C==='R') return c.col==='R'?Object.assign({},c,{y0:Math.max(c.y0,Y)}):c;
        return Object.assign({},c,{y0:Math.max(c.y0,Y)}); }).filter(Boolean); }
    if(p===D.to.p && D.to.y!=null){ const E=D.to.y-8, bj=bandAt(pg,D.to.y), C=D.to.col;
      ps=ps.filter(c=>c.bi<=bj).map(c=>{ if(c.bi!==bj) return c; if(!c.col) return Object.assign({},c,{y1:Math.min(c.y1,E)});
        if(C==='R') return c.col==='R'?Object.assign({},c,{y1:Math.min(c.y1,E)}):null;
        if(C==='L') return c.col==='L'?Object.assign({},c,{y1:Math.min(c.y1,E)}):c;
        return Object.assign({},c,{y1:Math.min(c.y1,E)}); }).filter(Boolean); }
    ps.forEach(c=>{ if(c.y1-c.y0>12) out.push(pieceSlice(pg,p,c,index.bk)); }); }
  return out; }

/* printed line numbers inside a slice, in reading order */
export function sliceLines(index, sl){ const pg=index.pages[sl.p-1]; if(!pg||!pg.ln) return [];
  return pg.ln.filter(l=>l[0]>=sl.y0-4 && l[0]<=sl.y1+4 && (!sl.col || l[2]===sl.col)).map(l=>l[1]).sort((a,b)=>a-b); }
/* landmarks inside a slice (verse / halacha / chapter), with their position (0..1) inside the slice */
export function sliceMarks(index, sl){ const pg=index.pages[sl.p-1]; if(!pg||!pg.lm) return [];
  const a=pg.lm.filter(l=>l[0]>=sl.y0-4 && l[0]<=sl.y1+2 && (!sl.col || l[3]===sl.col));
  const two=!sl.col && a.some(l=>l[3]==='R'&&l[1]!=='p') && a.some(l=>l[3]==='L'&&l[1]!=='p');
  const H=Math.max(1,sl.y1-sl.y0);
  return a.map(l=>({kind:l[1],label:l[2],q:two?(l[3]==='R'?0:0.5)+0.5*(l[0]-sl.y0)/H:(l[0]-sl.y0)/H})).sort((x,y)=>x.q-y.q); }
/* reading units of a portion (printed lines, verses or halachos) with their position as a fraction of the portion */
export function unitPoints(index, sl){ const W=sl.reduce((a,b)=>a+b.words,0)||1; let acc=0, perek=null; const pts=[], segs=[];
  sl.forEach((s,si)=>{ const a=acc/W; acc+=s.words; const b=acc/W; segs.push({a,b}); const L=sliceLines(index,s);
    if(L.length) L.forEach((n,j)=>pts.push({kind:'l',label:String(n),f:a+(b-a)*j/L.length,si}));
    else sliceMarks(index,s).forEach(m=>{ if(m.kind==='k'){ perek=m.label; return; } pts.push({kind:m.kind,label:m.label,perek:m.kind==='h'?perek:null,f:a+(b-a)*m.q,si}); }); });
  const cnt={}; pts.forEach(p=>cnt[p.kind]=(cnt[p.kind]||0)+1); const kind=Object.keys(cnt).sort((x,y)=>cnt[y]-cnt[x])[0]||null;
  return {W, segs, kind, pts:kind?pts.filter(p=>p.kind===kind):[]}; }
/* render one slice into a canvas of the given css width */
/* css size of a slice: full-width slices use the page zoom, single columns fill the screen */
export function sliceBox(sl, pageCss, screenW){ const full=(sl.x1-sl.x0)>sl.w*0.8&&!sl.fit; const pc=full?pageCss:screenW*0.97*sl.w/(sl.x1-sl.x0)*Math.max(1,pageCss/(screenW*1.6));
  return {pageCss:pc, w:(sl.x1-sl.x0)*pc/sl.w, h:(sl.y1-sl.y0)*pc/sl.w}; }
export async function renderSlice(sl, cssWidth, canvas){
  const d=await doc(sl.bk); const pg=await d.getPage(sl.p);
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
    let best=0,bs=-1,be=-1,bd=1e9; const cx=(sl.gx?sl.gx*scale:W/2)-gx0, minW=Math.max(4,2*dpr);
    for(let x=0,run=0,st=0;x<=gw;x++){ if(x<gw&&cnt[x]<=thr){ if(!run) st=x; run++; } else { if(run>=minW){ const dd=Math.max(0,st-cx,cx-(st+run)); if(dd<bd-3*dpr||(Math.abs(dd-bd)<=3*dpr&&run>best)){ bd=dd; best=run; bs=st; be=st+run; } } run=0; } }
    if(best>=Math.max(4,2*dpr)){ const gs=gx0+bs, ge=gx0+be;
      const pad=Math.round(Math.min(5*dpr,(ge-gs)/2));
      if(sl.col==='R'){ const r=Math.ceil((sl.x1||sl.w)*scale); x0=ge-pad; wd=r-x0; }
      else { x0=Math.floor((sl.x0||0)*scale); wd=gs+pad-x0; } } }
  canvas.width=wd; canvas.height=h;
  canvas.getContext('2d').drawImage(full,x0,Math.floor(sl.y0*scale),wd,h,0,0,wd,h);
  full.width=full.height=0; return canvas; }
