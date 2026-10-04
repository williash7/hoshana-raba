/* Dvar Malchus weekly booklet: local storage, indexing by day, and rendering of a day's portion */
import * as pdfjs from './pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.min.mjs';

export const SUBJECTS = [
  {id:'chumash',  name:'חומש',               test:h=>/שיעוריומיל(יום|שבת)/.test(h)},
  {id:'tanya',    name:'תניא',               test:h=>h.includes('שיעוריםבספרהתניא')},
  {id:'hayomyom', name:'היום יום',            test:(h,top)=>h.includes('היוםיום')||top.includes('לוחהיוםיום'), whole:true},
  {id:'rambam3',  name:'רמב״ם – ג׳ פרקים',    test:h=>h.includes('רמבםגפרקיםליום')},
  {id:'rambam1',  name:'רמב״ם – פרק אחד',     test:h=>h.includes('רמבםפרקאחדליום')},
  {id:'sm',       name:'ספר המצוות',          test:h=>h.includes('רמבםספרהמצוות'), whole:true},
  {id:'halacha',  name:'הלכה יומית ברמב״ם',    test:h=>h.includes('הלכהיומיתלעיוןברמבם')},
  {id:'mishna',   name:'משנה',               test:h=>/^[א-ת]{0,3}מסכת.*משנה/.test(h)},
];
export const DAYNAMES=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת קודש'];
const DAYW=[['ראשון'],['שני'],['שלישי'],['רביעי'],['חמישי'],['שישי','ששי'],['שבת']];
const norm=s=>s.replace(/[‎‏‪-‮"'״׳`]/g,'').replace(/\s+/g,'');
const HEAD=56, FOOT=26;   // running header / footer heights in PDF points

/* ---------- IndexedDB ---------- */
function idb(){ return new Promise((res,rej)=>{ const r=indexedDB.open('limud',1); r.onupgradeneeded=()=>r.result.createObjectStore('files'); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }
async function put(k,v){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readwrite'); tx.objectStore('files').put(v,k); tx.oncomplete=()=>res(); tx.onerror=()=>rej(tx.error); }); }
async function get(k){ const db=await idb(); return new Promise((res,rej)=>{ const tx=db.transaction('files','readonly'); const r=tx.objectStore('files').get(k); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); }

/* ---------- indexing ---------- */
async function buildIndex(doc, onProgress){
  const pages=[];
  for(let p=1;p<=doc.numPages;p++){
    const pg=await doc.getPage(p); const vp=pg.getViewport({scale:1}); const tc=await pg.getTextContent();
    const lines={}; let words=0;
    tc.items.forEach(it=>{ const y=Math.round(vp.height-it.transform[5]); (lines[y]=lines[y]||[]).push(it.str); const s=it.str.replace(/[\u0591-\u05C7]/g,''); const m=s.match(/[\u05d0-\u05ea]{2,}|[A-Za-z\u00c0-\u02af\u2000-\u2fff]{2,}/g); if(m) words+=m.length; });
    const ys=Object.keys(lines).map(Number).sort((a,b)=>a-b);
    let head='', top=''; ys.forEach(y=>{ const t=lines[y].join(' '); if(y<HEAD) head+=t+' '; if(y<120) top+=t+' '; });
    head=norm(head).replace(/^[א-ת]{1,4}(?=שיעור|מתוך|הלכה|מסכת|היום)/,''); top=norm(top);
    const marks=[];
    ys.forEach(y=>{ if(y<HEAD) return; const t=lines[y].join(''); if(!t.includes('â')) return; const n=norm(t);
      DAYW.forEach((ws,i)=>{ if(ws.some(w=>n.includes('יום'+w))||(i===6&&n.includes('שבתקודש'))) marks.push({y,day:i,label:t.replace(/â/g,'').replace(/\s+/g,' ').trim()}); }); });
    const subj=(SUBJECTS.find(s=>s.test(head,top))||{}).id||null;
    pages.push({p,h:vp.height,w:vp.width,subj,marks,words});
    if(onProgress) onProgress(p/doc.numPages);
  }
  // segments per subject and day
  const index={pages:pages.map(x=>({h:x.h,w:x.w,words:x.words})), subjects:{}};
  SUBJECTS.forEach(S=>{
    const ps=pages.filter(x=>x.subj===S.id); if(!ps.length) return;
    const first=ps[0].p, last=ps[ps.length-1].p;
    const marks=[]; ps.forEach(x=>x.marks.forEach(m=>marks.push({p:x.p,y:m.y,day:m.day,label:m.label})));
    const days={};
    if(S.whole || !marks.length){ for(let d=0;d<7;d++) days[d]={from:{p:first,y:HEAD},to:{p:last,y:null},whole:true}; }
    else {
      const byDay={}; marks.forEach(m=>{ if(!(m.day in byDay)) byDay[m.day]=m; });
      const order=Object.values(byDay).sort((a,b)=>a.p-b.p||a.y-b.y);
      order.forEach((m,i)=>{ const nx=order[i+1];
        let to=nx?{p:nx.p,y:nx.y}:{p:last,y:null};
        // markers out of reading order on the same page (multi-column) -> whole pages
        const messy=nx && nx.p===m.p && nx.day!==m.day+1;
        days[m.day]={from:{p:m.p,y:messy?HEAD:m.y}, to:messy?{p:m.p,y:null}:to, label:m.label}; });
      // a combined day (e.g. Friday–Shabbat) without its own marker: reuse the neighbour's range
      for(let d=0;d<7;d++){ if(!days[d]){ const n=days[d+1]||days[d-1]; if(n) days[d]=Object.assign({},n,{shared:true}); } }
    }
    index.subjects[S.id]={first,last,days};
  });
  // week label from the chumash / first markers
  const lab=[]; for(const s of Object.values(index.subjects)) for(let d=0;d<7;d++){ const L=s.days[d]&&s.days[d].label; if(L&&!lab[d]) lab[d]=L; }
  index.dayLabels=lab;
  return index;
}

let DOC=null, META=null;
export async function loadStored(){ if(META) return META; const m=await get('dm'); if(!m) return null; META=m; return m; }
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
export function slices(index, subj, day){
  const S=index.subjects[subj]; if(!S) return []; const D=S.days[day]; if(!D) return [];
  const out=[]; const P=index.pages;
  for(let p=D.from.p;p<=D.to.p;p++){ const pg=P[p-1]; if(!pg) continue;
    let y0=HEAD, y1=pg.h-FOOT;
    if(p===D.from.p && D.from.y!=null) y0=Math.max(HEAD,D.from.y-14);
    if(p===D.to.p && D.to.y!=null){ if(D.to.y-8<=y0) continue; y1=D.to.y-8; }
    const frac=(y1-y0)/(pg.h-HEAD-FOOT);
    out.push({p,y0,y1,w:pg.w,h:pg.h,words:Math.round(pg.words*Math.max(0.05,frac))}); }
  return out; }

/* render one slice into a canvas of the given css width */
export async function renderSlice(sl, cssWidth, canvas){
  const d=await doc(); const pg=await d.getPage(sl.p);
  const dpr=Math.min(3,window.devicePixelRatio||1); const scale=cssWidth/sl.w*dpr;
  const vp=pg.getViewport({scale});
  const full=document.createElement('canvas'); full.width=Math.ceil(vp.width); full.height=Math.ceil((sl.y1)*scale);
  await pg.render({canvasContext:full.getContext('2d'), viewport:vp}).promise;
  const h=Math.ceil((sl.y1-sl.y0)*scale);
  canvas.width=full.width; canvas.height=h;
  canvas.getContext('2d').drawImage(full,0,Math.floor(sl.y0*scale),full.width,h,0,0,full.width,h);
  full.width=full.height=0; return canvas; }
