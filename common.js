/* shared helpers for the study app */
function gem(n){const o=['','א','ב','ג','ד','ה','ו','ז','ח','ט'],t=['','י','כ','ל','מ','נ','ס','ע','פ','צ'],h=['','ק','ר','ש','ת'];let s='';while(n>=400){s+='ת';n-=400;}if(n>=100){s+=h[Math.floor(n/100)];n%=100;}if(n===15)return s+'טו';if(n===16)return s+'טז';return s+t[Math.floor(n/10)]+o[n%10];}
const gq=n=>{const g=gem(n); return g.length>1?g.slice(0,-1)+'״'+g.slice(-1):g+'׳';};
const isoDate=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function lsGet(k,def){ try{ const v=JSON.parse(localStorage.getItem(k)||'null'); return v==null?def:v; }catch(e){ return def; } }
function lsSet(k,v){ try{ localStorage.setItem(k,JSON.stringify(v)); }catch(e){} }

/* scale when the browser ignores the mobile viewport */
let K=1; function computeK(){ const coarse=matchMedia('(pointer:coarse)').matches, sw=Math.min(screen.width||innerWidth,screen.height||innerHeight); let k=coarse&&sw?innerWidth/sw:1; if(k<1.2) k=1; K=Math.min(3.5,k); document.documentElement.style.setProperty('--k',K); }

/* settings shared with the Hoshana Raba reader */
const MAIN=lsGet('hoshana-raba-v2',{});
function applyTheme(){ const t=MAIN.theme; if(t&&t!=='auto') document.documentElement.setAttribute('data-theme',t); }
const LOCS={afula:[35.29,32.61],jerusalem:[35.22,31.78],telaviv:[34.78,32.08],bneibrak:[34.83,32.09],haifa:[34.99,32.80],tzfat:[35.50,32.96],nazareth:[35.32,32.70],beersheva:[34.79,31.25],kfarchabad:[34.85,31.99],ny:[-73.94,40.67]};
function myLoc(){ if(MAIN.loc==='gps'&&MAIN.geoLon!=null) return [MAIN.geoLon,MAIN.geoLat!=null?MAIN.geoLat:32]; return LOCS[MAIN.loc]||LOCS.afula; }
function sunsetMs(now){ const [lon,lat]=myLoc(), y=now.getFullYear(), m=now.getMonth(), d=now.getDate();
  const t0=Date.UTC(y,m,d), doy=Math.round((t0-Date.UTC(y,0,1))/864e5)+1, g=2*Math.PI/365*(doy-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  const dec=0.006918-0.399912*Math.cos(g)+0.070257*Math.sin(g)-0.006758*Math.cos(2*g)+0.000907*Math.sin(2*g)-0.002697*Math.cos(3*g)+0.00148*Math.sin(3*g);
  const ph=lat*Math.PI/180, H=Math.acos((Math.sin(-0.833*Math.PI/180)-Math.sin(ph)*Math.sin(dec))/(Math.cos(ph)*Math.cos(dec)))*180/Math.PI;
  return t0+(720-4*lon-eq+4*H)*6e4; }
/* solar noon (chatzot) for the chosen location */
function noonMs(now){ const [lon]=myLoc(), y=now.getFullYear(), m=now.getMonth(), d=now.getDate();
  const t0=Date.UTC(y,m,d), doy=Math.round((t0-Date.UTC(y,0,1))/864e5)+1, g=2*Math.PI/365*(doy-1);
  const eq=229.18*(0.000075+0.001868*Math.cos(g)-0.032077*Math.sin(g)-0.014615*Math.cos(2*g)-0.040849*Math.sin(2*g));
  return t0+(720-4*lon-eq)*6e4; }
function hebOf(date){ const d=new Date(date); d.setHours(12,0,0,0);
  const p=new Intl.DateTimeFormat('en-u-ca-hebrew',{day:'numeric',month:'long',year:'numeric'}).formatToParts(d);
  const day=+p.find(x=>x.type==='day').value, year=+p.find(x=>x.type==='year').value, men=p.find(x=>x.type==='month').value;
  const month=new Intl.DateTimeFormat('he-u-ca-hebrew',{month:'long'}).format(d).replace(/^ב/,'');
  return {day,year,men,month,label:gq(day)+' '+month}; }
const WEEKDAYS=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שבת'];
const ALIYAH=['ראשון','שני','שלישי','רביעי','חמישי','שישי','שביעי'];

/* daily Chumash (Chitas): the aliyah of this week's parsha that matches the weekday */
let SCHED=null;
function chumashFor(date,diaspora){ if(!SCHED) return null;
  const d=new Date(date); d.setHours(12,0,0,0); const w=d.getDay();
  const tbl=diaspora?SCHED.dia:SCHED.il;
  let sh=new Date(d); sh.setDate(sh.getDate()+(6-w));
  let names=tbl[isoDate(sh)];
  if(names===undefined) return null;
  if(names===null){ const h=hebOf(sh);
    if(h.men==='Tishri' && h.day>=10) names=['Vezot Haberakhah'];
    else { for(let i=1;i<6 && !names;i++){ const n=new Date(sh); n.setDate(n.getDate()+7*i); names=tbl[isoDate(n)]; } }
  }
  if(!names) return null;
  return {names, he:names.map(n=>SCHED.he[n]||n).join('–'), aliyah:w, aliyahName:ALIYAH[w],
    refs:names.map(n=>{ const a=SCHED.aliyot[n][w]; return {parsha:SCHED.he[n]||n, book:a[0], from:a[1], to:a[2], ref:a[0]+' '+a[1]+'-'+a[2]}; })}; }

/* Sefaria */
const SEF='https://www.sefaria.org';
let LASTURL='';
async function sefJSON(url){ const key='sef:'+url; LASTURL=url;
  try{ const ctl=new AbortController(); const tm=setTimeout(()=>ctl.abort(),20000);
    let r; try{ r=await fetch(url,{signal:ctl.signal}); } catch(e){ throw new Error((e.name==='AbortError'?'timeout':'network/CORS')+': '+e.message); } finally{ clearTimeout(tm); }
    if(!r.ok) throw new Error('HTTP '+r.status); const j=await r.json(); try{ sessionStorage.setItem(key,JSON.stringify(j)); }catch(e){} return j; }
  catch(e){ const c=sessionStorage.getItem(key); if(c) return JSON.parse(c); throw e; } }
async function sefText(ref,version){ const v=version?'&version='+encodeURIComponent(version):'';
  let j=await sefJSON(SEF+'/api/v3/texts/'+encodeURIComponent(ref)+'?return_format=strip_only_footnotes'+v);
  if((!j.versions||!j.versions.length) && version && version!=='hebrew') j=await sefJSON(SEF+'/api/v3/texts/'+encodeURIComponent(ref)+'?return_format=strip_only_footnotes&version=hebrew');
  return j; }
async function sefCalendar(date){ const d=new Date(date);
  return sefJSON(SEF+'/api/calendars?diaspora='+(lsGet('home-v1',{}).diaspora?1:0)+'&year='+d.getFullYear()+'&month='+(d.getMonth()+1)+'&day='+d.getDate()+'&timezone=Asia/Jerusalem'); }
/* text → list of {ch,v,val} using the ref's sections */
function toVerses(j){ const txt=(j.versions&&j.versions[0]&&j.versions[0].text); if(txt==null) return [];
  const s=(j.sections||[]).map(Number), e=(j.toSections||[]).map(Number); const out=[];
  if(s.length<2){ (Array.isArray(txt)?txt:[txt]).forEach((val,i)=>out.push({ch:(s[0]||1)+i,v:1,val})); return out; }
  if(s[0]!==e[0]){ txt.forEach((chap,ci)=>{ const ch=s[0]+ci, v0=ci===0?s[1]:1; (chap||[]).forEach((val,vi)=>out.push({ch,v:v0+vi,val})); }); }
  else if(s[1]===e[1] && !Array.isArray(txt[0]) && j.textDepth!==3) out.push({ch:s[0],v:s[1],val:txt});
  else if(s[1]===e[1] && j.textDepth===3) out.push({ch:s[0],v:s[1],val:txt});
  else txt.forEach((val,vi)=>out.push({ch:s[0],v:s[1]+vi,val}));
  return out; }
function flat(x){ return Array.isArray(x)?x.flatMap(flat):(x==null?[]:[x]); }
/* keep only harmless formatting tags */
function clean(html){ const doc=new DOMParser().parseFromString('<div>'+String(html)+'</div>','text/html'); const OK={B:1,STRONG:1,I:1,EM:1,SMALL:1,BIG:1,BR:1};
  function walk(n){ let s=''; n.childNodes.forEach(c=>{ if(c.nodeType===3) s+=c.textContent.replace(/[&<>]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
    else if(c.nodeType===1){ const inner=walk(c); s+=OK[c.tagName]?(c.tagName==='BR'?'<br>':'<'+c.tagName.toLowerCase()+'>'+inner+'</'+c.tagName.toLowerCase()+'>'):inner; } }); return s; }
  return walk(doc.body.firstChild); }

/* per-day progress shared with the home screen */
function setProgress(mod,key,pct){ const P=lsGet('progress-v1',{}); P[mod]={key,pct:Math.round(pct*100)/100}; lsSet('progress-v1',P); }
function getProgress(mod,key){ const p=lsGet('progress-v1',{})[mod]; return p&&p.key===key?p.pct:0; }

/* daily Tehillim (by the Hebrew date, switching at sunset) */
const TDIV=[[1,1],[10,1],[18,1],[23,1],[29,1],[35,1],[39,1],[44,1],[49,1],[55,1],[60,1],[66,1],[69,1],[72,1],[77,1],[79,1],[83,1],[88,1],[90,1],[97,1],[104,1],[106,1],[108,1],[113,1],[119,1],[119,97],[120,1],[135,1],[140,1],[145,1],[151,1]];
function tehFor(date){ const d=new Date(date); d.setHours(12,0,0,0);
  const day=+new Intl.DateTimeFormat('en-u-ca-hebrew',{day:'numeric'}).format(d);
  const nx=new Date(d); nx.setDate(nx.getDate()+1); const short=day===29 && +new Intl.DateTimeFormat('en-u-ca-hebrew',{day:'numeric'}).format(nx)===1;
  const rng=dd=>{ const a=TDIV[dd-1], b=TDIV[dd]; if(dd===25) return 'קיט א–צו'; if(dd===26) return 'קיט צז–קעו'; return gem(a[0])+'–'+gem(b[0]-1); };
  return {day, short, date:d, heb:hebOf(d), range:rng(day)+(short?', '+rng(30):'')}; }
function tehToday(){ const now=new Date(), d=new Date(now); const night=now.getTime()>sunsetMs(now); if(night) d.setDate(d.getDate()+1); d.setHours(12,0,0,0);
  const t=tehFor(d); const key=new Intl.DateTimeFormat('en-u-ca-hebrew',{day:'numeric',month:'numeric',year:'numeric'}).format(d);
  return Object.assign(t,{key:key+':'+t.day, night}); }

/* weekly tracker: how much of each unit was learned this week (resets every Sunday).
   ids: chu:<weekday> tan:<weekday> teh:<hebrew day of month> dm:<subject>:<weekday> dm:hayomyom sec:<first page> */
function wkId(){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-d.getDay()); return isoDate(d); }
function wkAll(){ const W=lsGet('week-v1',null); return W&&W.wk===wkId()?W.u:{}; }
function wkFrac(id){ return wkAll()[id]||0; }
// one-time fix: Tanya progress recorded while only the first paragraph of the portion was shown
(()=>{ try{ if(localStorage.getItem('fix-tanya-1')) return; const W=lsGet('week-v1',null); if(W&&W.u){ Object.keys(W.u).forEach(k=>{ if(k.startsWith('tan:')) delete W.u[k]; }); lsSet('week-v1',W); }
  const P=lsGet('progress-v1',{}); delete P.tanya; lsSet('progress-v1',P); localStorage.setItem('fix-tanya-1','1'); }catch(e){} })();
function wkSet(id,f,force){ const u=wkAll(); f=Math.max(0,Math.min(1,f||0)); if(f>=0.98) f=1; f=Math.round(f*1000)/1000;
  if(!force && f<=(u[id]||0)) return; if(f) u[id]=f; else delete u[id]; lsSet('week-v1',{wk:wkId(),u}); }

/* reading pace shared by all readers (words per minute) */
function getWpm(){ return lsGet('pace-v1',{wpm:85}).wpm||85; }
function setWpm(w){ lsSet('pace-v1',{wpm:Math.max(20,Math.min(400,Math.round(w)))}); }
/* word counts: tehillim from the embedded table, others cached after loading */
let TW=null;
function tehWords(day,short){ if(!TW) return 0; const one=dd=>{ if(dd===25) return TW.v119.slice(0,96).reduce((a,b)=>a+b,0); if(dd===26) return TW.v119.slice(96).reduce((a,b)=>a+b,0);
  const a=TDIV[dd-1][0], b=TDIV[dd][0]; let s=0; for(let c=a;c<b;c++) s+=TW.cw[c-1]; return s; }; return one(day)+(short?one(30):0); }
function wcGet(k){ return (lsGet('wc-v1',{})[k])||0; }
function wcSet(k,n){ const W=lsGet('wc-v1',{}); W[k]=n; const ks=Object.keys(W); if(ks.length>40) delete W[ks[0]]; lsSet('wc-v1',W); }
const mins=w=>w/getWpm();
/* pace when learning from the printed booklet (measured), and time learned this week */
function printWpm(){ return lsGet('pace-print-v1',{}).wpm||getWpm(); }
function learnPrintWpm(words,ms){ if(ms<60000||words<40) return; const w=words/(ms/60000); if(w<10||w>500) return; const old=lsGet('pace-print-v1',{}).wpm; lsSet('pace-print-v1',{wpm:Math.round(old?old*0.6+w*0.4:w)}); }
/* measured seconds per reading unit in the printed booklet: l = line, p = verse (with Rashi), h = halacha */
const UNITNAME={l:'שורה',p:'פסוק',h:'הלכה'}, UNITPL={l:'שורות',p:'פסוקים',h:'הלכות'};
function unitPace(){ return lsGet('pace-units-v1',{}); }
function learnUnitPace(kind,units,ms){ if(!kind||units<2||ms<60000) return; const s=ms/1000/units; if(s<1||s>900) return; const P=unitPace(); P[kind]=Math.round(P[kind]?P[kind]*0.6+s*0.4:s); lsSet('pace-units-v1',P); }
function estMinPrint(words,kind,units){ const P=unitPace(); if(kind&&P[kind]&&units) return units*P[kind]/60; return words/printWpm(); }
function weekTime(){ const W=lsGet('time-v1',null); return W&&W.wk===wkId()?W.ms:0; }
function addWeekTime(ms){ if(!(ms>0)) return; lsSet('time-v1',{wk:wkId(),ms:weekTime()+ms}); }
function fmtMin(m){ m=Math.round(m); if(m<1) return 'פחות מדקה'; if(m<60) return m+' דק׳'; return Math.floor(m/60)+' שע׳'+(m%60?' ו־'+(m%60)+' דק׳':''); }

/* parts for the continuous session: each returns {title, blocks:[{cls,html,w,mark}]} */
const wordsOf=s=>String(s).replace(/<[^>]+>/g,' ').split(/\s+/).filter(Boolean).length;
async function partChumash(date,diaspora,rashi){ const c=chumashFor(date,diaspora); if(!c) throw new Error('no chumash');
  const data=await Promise.all(c.refs.map(r=>Promise.all([sefText(r.ref,"hebrew|Tanach with Ta'amei Hamikra"), rashi?sefText('Rashi on '+r.ref,'hebrew').catch(()=>null):null])));
  const blocks=[];
  c.refs.forEach((r,ri)=>{ const [txt,ra]=data[ri]; const rv={}; if(ra) toVerses(ra).forEach(x=>{ rv[x.ch+':'+x.v]=flat(x.val); });
    blocks.push({cls:'head',html:'<h3>חומש – פרשת '+r.parsha+' – '+c.aliyahName+'</h3><small>'+(txt.heRef||r.ref)+'</small>',w:2,mark:'פרשת '+r.parsha});
    let lastCh=null;
    toVerses(txt).forEach(x=>{ const v=clean(flat(x.val).join(' ')); const com=(rv[x.ch+':'+x.v]||[]).map(clean).filter(Boolean);
      let h=''; if(x.ch!==lastCh){ h+='<span class="ch">פרק '+gem(x.ch)+'</span>'; lastCh=x.ch; }
      h+='<p><span class="v">'+gem(x.v)+'</span>'+v+'</p>'; if(com.length) h+='<div class="rashi">'+com.map(s=>'<div>'+s+'</div>').join('')+'</div>';
      blocks.push({cls:'ps',html:h,w:wordsOf(v)+wordsOf(com.join(' ')),mark:'פסוק '+gem(x.ch)+':'+gem(x.v)}); }); });
  return {title:'חומש · '+c.he+' · '+c.aliyahName, blocks}; }
/* Korbanos before Mincha (Chabad nusach) */
const KORB_PARTS=['פרשת התמיד','ושחט אותו','אתה הוא','פרשת הקטורת','פיטום הקטורת','רבן שמעון בן גמליאל','תניא רבי נתן','תניא בר קפרא','ה׳ צבאות עמנו'];
const KORB_WORDS=()=>wcGet('korbanot')||750;
async function partKorbanot(){ const txt=await sefText('Weekday Siddur Chabad, Mincha, Korbanot','hebrew');
  const blocks=[{cls:'head',html:'<h3>סדר הקרבנות</h3><small>לפני תפילת מנחה</small>',w:2,mark:'קרבנות'}];
  flat(txt.versions&&txt.versions[0]&&txt.versions[0].text).map(clean).filter(Boolean).forEach((p,i)=>blocks.push({cls:'par',html:'<p>'+p+'</p>',w:wordsOf(p),mark:KORB_PARTS[i]||'קרבנות'}));
  wcSet('korbanot',blocks.reduce((a,b)=>a+b.w,0)); return {title:'קרבנות למנחה', blocks}; }
/* Tanya Yomi: Sefaria's calendar gives only where each day's portion STARTS (e.g. "…Iggeret HaKodesh 24:1"),
   so the portion runs from today's start up to tomorrow's start */
const splitRef=r=>{ const m=String(r).match(/^(.*?)\s(\d+)(?::(\d+))?$/); return m?{book:m[1],ch:+m[2],seg:m[3]?+m[3]:1}:null; };
async function tanyaStart(date){ const cal=await sefCalendar(date); const it=(cal.calendar_items||[]).find(x=>x.title&&x.title.en==='Tanya Yomi'); if(!it) throw new Error('no tanya'); return it; }
async function chapSegs(book,ch){ const j=await sefText(book+' '+ch,'hebrew'); return {segs:flat(j.versions&&j.versions[0]&&j.versions[0].text), he:j.heRef||''}; }
async function tanyaPortion(date){ const it=await tanyaStart(date);
  if(/-/.test(it.ref)){ const j=await sefText(it.ref,'hebrew'); return {segs:flat(j.versions&&j.versions[0]&&j.versions[0].text), heRef:j.heRef||it.heRef||it.ref, it}; }
  const nx=new Date(date); nx.setDate(nx.getDate()+1); let nit=null; try{ nit=await tanyaStart(nx); }catch(e){}
  const A=splitRef(it.ref), Bn=nit?splitRef(nit.ref):null; if(!A){ const j=await sefText(it.ref,'hebrew'); return {segs:flat(j.versions[0].text),heRef:j.heRef||it.ref,it}; }
  const out=[]; const first=await chapSegs(A.book,A.ch);
  if(Bn&&Bn.book===A.book&&Bn.ch===A.ch){ out.push(...first.segs.slice(A.seg-1,Math.max(A.seg,Bn.seg-1))); }
  else { out.push(...first.segs.slice(A.seg-1));
    if(Bn&&Bn.book===A.book){ for(let c=A.ch+1;c<Bn.ch;c++) out.push(...(await chapSegs(A.book,c)).segs); if(Bn.seg>1) out.push(...(await chapSegs(Bn.book,Bn.ch)).segs.slice(0,Bn.seg-1)); }
    else if(Bn&&Bn.seg>1){ out.push(...(await chapSegs(Bn.book,Bn.ch)).segs.slice(0,Bn.seg-1)); } }
  return {segs:out, heRef:(first.he||it.heRef||it.ref).replace(/[:׃]\s*\S+$/,''), it}; }
async function partTanya(date){ const P=await tanyaPortion(date); const blocks=[{cls:'head',html:'<h3>תניא יומי – '+hebOf(date).label+'</h3><small>'+P.heRef+'</small>',w:2,mark:'תניא'}];
  P.segs.map(clean).filter(Boolean).forEach(p=>blocks.push({cls:'par',html:'<p>'+p+'</p>',w:wordsOf(p),mark:'תניא'}));
  return {title:'תניא · '+hebOf(date).label, blocks}; }
