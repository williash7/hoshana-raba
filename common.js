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
function tehToday(){ const now=new Date(), d=new Date(now); const night=now.getTime()>sunsetMs(now); if(night) d.setDate(d.getDate()+1); d.setHours(12,0,0,0);
  const day=+new Intl.DateTimeFormat('en-u-ca-hebrew',{day:'numeric'}).format(d);
  const key=new Intl.DateTimeFormat('en-u-ca-hebrew',{day:'numeric',month:'numeric',year:'numeric'}).format(d);
  const nx=new Date(d); nx.setDate(nx.getDate()+1); const short=day===29 && +new Intl.DateTimeFormat('en-u-ca-hebrew',{day:'numeric'}).format(nx)===1;
  const rng=dd=>{ const a=TDIV[dd-1], b=TDIV[dd]; if(dd===25) return 'קיט א–צו'; if(dd===26) return 'קיט צז–קעו'; return gem(a[0])+'–'+gem(b[0]-1); };
  return {day, key:key+':'+day, night, heb:hebOf(d), range:rng(day)+(short?', '+rng(30):'')}; }
