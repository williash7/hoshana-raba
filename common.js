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
function setProgress(mod,key,pct,n,t,u){ const P=lsGet('progress-v1',{}); P[mod]={key,pct:Math.round(pct*100)/100}; if(t){ P[mod].n=n; P[mod].t=t; P[mod].u=u; } lsSet('progress-v1',P); }
function getProgress(mod,key){ const p=lsGet('progress-v1',{})[mod]; return p&&p.key===key?p.pct:0; }
function getProgressInfo(mod,key){ const p=lsGet('progress-v1',{})[mod]; return p&&p.key===key?p:null; }
/* "40% · 12/30 פסוקים" */
function progTxt(pct,n,t,unit){ return Math.round(Math.min(1,pct)*100)+'%'+(t?' · '+Math.min(n,t)+'/'+t+(unit?' '+unit:''):''); }

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
/* per-week tracker {<sunday>:{<unit>:fraction}}; a unit of an earlier week is written "<unit>@<sunday>" */
const splitWk=id=>{ const i=String(id).indexOf('@'); return i<0?[id,wkId()]:[id.slice(0,i),id.slice(i+1)]; };
function weekStart(wk){ const [y,m,d]=wk.split('-').map(Number); return new Date(y,m-1,d,12); }
function trk(){ let T=lsGet('track-v2',null); if(!T){ T={}; const W=lsGet('week-v1',null); if(W&&W.u) T[W.wk]=W.u; lsSet('track-v2',T); } return T; }
function wkAll(wk){ return trk()[wk||wkId()]||{}; }
function wkFrac(id){ const [b,w]=splitWk(id); return (trk()[w]||{})[b]||0; }
// one-time fix: Tanya progress recorded while only the first paragraph of the portion was shown
(()=>{ try{ if(localStorage.getItem('fix-tanya-1')) return; const W=lsGet('week-v1',null); if(W&&W.u){ Object.keys(W.u).forEach(k=>{ if(k.startsWith('tan:')) delete W.u[k]; }); lsSet('week-v1',W); }
  const P=lsGet('progress-v1',{}); delete P.tanya; lsSet('progress-v1',P); localStorage.setItem('fix-tanya-1','1'); }catch(e){} })();
function wkSet(id,f,force){ const [b,w]=splitWk(id); const T=trk(), u=T[w]||{}; f=Math.max(0,Math.min(1,f||0)); if(f>=0.98) f=1; f=Math.round(f*1000)/1000;
  if(!force && f<=(u[b]||0)) return; if(f) u[b]=f; else delete u[b]; T[w]=u;
  const old=isoDate(new Date(Date.now()-90*864e5)); Object.keys(T).forEach(k=>{ if(k<old) delete T[k]; }); lsSet('track-v2',T); }

/* personal Tehillim chapters (set in the Tehillim screen): [{name,k,pos:'before'|'after'}] for the current Hebrew date */
function personalKapitels(){ const D=lsGet('tehillim-daily-v1',{}); let L=D.list;
  if(!L){ L=(D.people||[]).map(p=>Object.assign({on:true},p)); if(D.rebbe) L.push({name:'הרבי',d:11,m:'nisan',y:5662,on:true}); if(D.rebbetzin) L.push({name:'הרבנית',d:25,m:'adar',y:5661,on:true}); }
  const t=tehToday(), dd=t.date||new Date(); const p=new Intl.DateTimeFormat('en-u-ca-hebrew',{day:'numeric',month:'long',year:'numeric'}).formatToParts(dd);
  const cy=+p.find(x=>x.type==='year').value, men=p.find(x=>x.type==='month').value, cd=+p.find(x=>x.type==='day').value;
  const ORD={tishri:1,heshvan:2,kislev:3,tevet:4,shevat:5,adar1:6,adar:7,adar2:7,nisan:8,iyar:9,sivan:10,tamuz:11,av:12,elul:13};
  const EN={Tishri:'tishri',Heshvan:'heshvan',Kislev:'kislev',Tevet:'tevet',Shevat:'shevat','Adar I':'adar1',Adar:'adar','Adar II':'adar2',Nisan:'nisan',Iyar:'iyar',Sivan:'sivan',Tamuz:'tamuz',Av:'av',Elul:'elul'};
  const leap=y=>((7*y+1)%19)<7, cm=ORD[EN[men]]||1;
  return (L||[]).filter(x=>x.on&&x.y).map(b=>{ let bm=ORD[b.m]; if(!leap(cy)&&(b.m==='adar1'||b.m==='adar2')) bm=7; const passed=cm>bm||(cm===bm&&cd>=b.d);
    return {name:b.name,k:cy-b.y-(passed?0:1)+1,pos:b.pos||D.pplPos||'after'}; }).filter(o=>o.k>=1&&o.k<=150); }
function personalWords(){ if(!TW) return 0; return personalKapitels().reduce((a,o)=>a+(TW.cw[o.k-1]||0),0); }

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
// clock time after m minutes from now – "20:34"
function clockIn(m){ const d=new Date(Date.now()+Math.max(0,m)*6e4); return d.getHours()+':'+String(d.getMinutes()).padStart(2,'0'); }
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
/* Shnayim Mikra ve'Echad Targum: from Thursday evening until Shabbos, one unit per aliyah of this week's parsha */
function shnayimTime(){ const n=new Date(), w=n.getDay(); return (w===4&&n.getTime()>sunsetMs(n))||w===5||w===6; }
function shnayimRefs(i,date){ const c=chumashFor(date||new Date(),!!lsGet('home-v1',{}).diaspora); if(!c) return null;
  return {he:c.he, refs:c.names.map(n=>{ const a=SCHED.aliyot[n][i]; return {parsha:SCHED.he[n]||n, book:a[0], ref:a[0]+' '+a[1]+'-'+a[2]}; })}; }
/* haftarah at the end of Shnayim Mikra, Chabad custom: the parsha's haftarah plus any special one of that Shabbos (Machar Chodesh, Rosh Chodesh, the four parshiyos, Chanukah, Yom Tov…) */
const HEBOOK={Genesis:'בראשית',Exodus:'שמות',Leviticus:'ויקרא',Numbers:'במדבר',Deuteronomy:'דברים',Joshua:'יהושע',Judges:'שופטים','I Samuel':'שמואל א','II Samuel':'שמואל ב','I Kings':'מלכים א','II Kings':'מלכים ב',Isaiah:'ישעיהו',Jeremiah:'ירמיהו',Ezekiel:'יחזקאל',Hosea:'הושע',Joel:'יואל',Amos:'עמוס',Obadiah:'עובדיה',Jonah:'יונה',Micah:'מיכה',Nahum:'נחום',Habakkuk:'חבקוק',Zephaniah:'צפניה',Haggai:'חגי',Zechariah:'זכריה',Malachi:'מלאכי'};
function heBookRef(r){ const m=String(r).match(/^(.*?)\s(\d.*)$/); if(!m) return r; const g=x=>x.replace(/\d+/g,n=>gem(+n)).replace(/:/g,','); return (HEBOOK[m[1]]||m[1])+' '+g(m[2]); }
let HAFT={"reg":{"Nitzavim-Vayeilech":["Isaiah 61:10-63:9"],"Ha'azinu":["II Samuel 22:1-51"],"Bereshit":["Isaiah 42:5-21"],"Noach":["Isaiah 54:1-10"],"Lech-Lecha":["Isaiah 40:27-41:16"],"Vayera":["II Kings 4:1-37"],"Chayei Sara":["I Kings 1:1-31"],"Toldot":["Malachi 1:1-2:7"],"Vayetzei":["Hosea 11:7-12:14"],"Vayishlach":["Obadiah 1:1-21"],"Vayeshev":["Amos 2:6-3:8"],"Miketz":["I Kings 3:15-4:1"],"Vayigash":["Ezekiel 37:15-28"],"Vayechi":["I Kings 2:1-12"],"Shemot":["Isaiah 27:6-28:13","Isaiah 29:22-23"],"Vaera":["Ezekiel 28:25-29:21"],"Bo":["Jeremiah 46:13-28"],"Beshalach":["Judges 4:4-5:31"],"Yitro":["Isaiah 6:1-13"],"Mishpatim":["Jeremiah 34:8-22","Jeremiah 33:25-26"],"Terumah":["I Kings 5:26-6:13"],"Tetzaveh":["Ezekiel 43:10-27"],"Ki Tisa":["I Kings 18:1-39"],"Vayakhel":["I Kings 7:13-26"],"Pekudei":["I Kings 7:51-8:21"],"Vayikra":["Isaiah 43:21-44:23"],"Tzav":["Jeremiah 7:21-28","Jeremiah 9:22-23"],"Shmini":["II Samuel 6:1-19"],"Tazria":["II Kings 4:42-5:19"],"Metzora":["II Kings 7:3-20"],"Achrei Mot":["Amos 9:7-15"],"Kedoshim":["Ezekiel 20:2-20"],"Emor":["Ezekiel 44:15-31"],"Behar":["Jeremiah 32:6-22"],"Bechukotai":["Jeremiah 16:19-17:14"],"Bamidbar":["Hosea 2:1-22"],"Nasso":["Judges 13:2-25"],"Beha'alotcha":["Zechariah 2:14-4:7"],"Sh'lach":["Joshua 2:1-24"],"Korach":["I Samuel 11:14-12:22"],"Chukat":["Judges 11:1-33"],"Balak":["Micah 5:6-6:8"],"Pinchas":["I Kings 18:46-19:21"],"Matot-Masei":["Jeremiah 2:4-28","Jeremiah 4:1-2"],"Devarim":["Isaiah 1:1-27"],"Vaetchanan":["Isaiah 40:1-26"],"Eikev":["Isaiah 49:14-51:3"],"Re'eh":["Isaiah 54:11-55:5"],"Shoftim":["Isaiah 51:12-52:12"],"Ki Teitzei":["Isaiah 54:1-10"],"Ki Tavo":["Isaiah 60:1-22"],"Vayakhel-Pekudei":["I Kings 7:13-26"],"Tazria-Metzora":["II Kings 7:3-20"],"Achrei Mot-Kedoshim":["Amos 9:7-15"],"Behar-Bechukotai":["Jeremiah 16:19-17:14"],"Nitzavim":["Isaiah 61:10-63:9"],"Vayeilech":["Isaiah 55:6-56:8"],"Chukat-Balak":["Micah 5:6-6:8"]},"il":{"2026-09-12":{"label":"ראש השנה","refs":["I Samuel 1:1-2:10"],"rep":1},"2026-09-19":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2026-09-26":{"label":"סוכות","refs":["Zechariah 14:1-21"],"rep":1},"2026-10-03":{"label":"שמחת תורה","refs":["Joshua 1:1-18"],"rep":1},"2026-10-10":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2026-12-05":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2026-12-12":{"label":"שבת חנוכה","refs":["I Kings 7:40-50"]},"2027-01-09":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2027-02-06":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2027-03-06":{"label":"שבת שקלים","refs":["II Kings 11:17-12:17"]},"2027-03-20":{"label":"שבת זכור","refs":["I Samuel 15:2-34"]},"2027-03-27":{"label":"שבת פרה","refs":["Ezekiel 36:16-36"]},"2027-04-03":{"label":"שבת החודש","refs":["Ezekiel 45:18-46:15"]},"2027-04-24":{"label":"שבת חול המועד פסח","refs":["Ezekiel 37:1-14"],"rep":1},"2027-05-08":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2027-06-05":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2027-07-24":{"label":"דברי ירמיהו (אחרי י״ז בתמוז)","refs":["Jeremiah 1:1-2:3"],"rep":1},"2027-10-02":{"label":"ראש השנה","refs":["I Samuel 1:1-2:10"],"rep":1},"2027-10-09":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2027-10-16":{"label":"סוכות","refs":["Zechariah 14:1-21"],"rep":1},"2027-10-23":{"label":"שמחת תורה","refs":["Joshua 1:1-18"],"rep":1},"2027-10-30":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2027-12-25":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2028-01-01":{"label":"שבת חנוכה","refs":["I Kings 7:40-50"]},"2028-01-29":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2028-02-26":{"label":"שבת שקלים","refs":["II Kings 11:17-12:17"]},"2028-03-11":{"label":"שבת זכור","refs":["I Samuel 15:2-34"]},"2028-03-18":{"label":"שבת פרה","refs":["Ezekiel 36:16-36"]},"2028-03-25":{"label":"שבת החודש","refs":["Ezekiel 45:18-46:15"]},"2028-04-15":{"label":"שבת חול המועד פסח","refs":["Ezekiel 37:1-14"],"rep":1},"2028-06-24":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24","I Samuel 20:18","I Samuel 20:42"]},"2028-07-15":{"label":"דברי ירמיהו (אחרי י״ז בתמוז)","refs":["Jeremiah 1:1-2:3"],"rep":1},"2028-09-23":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2028-09-30":{"label":"יום הכיפורים","refs":["Isaiah 57:14-58:14"],"rep":1},"2028-10-07":{"label":"שבת חול המועד סוכות","refs":["Ezekiel 38:18-39:16"],"rep":1},"2028-10-21":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2028-11-18":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2028-12-16":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2029-02-10":{"label":"שבת שקלים","refs":["II Kings 11:17-12:17"]},"2029-02-24":{"label":"שבת זכור","refs":["I Samuel 15:2-34"]},"2029-03-10":{"label":"שבת פרה","refs":["Ezekiel 36:16-36"]},"2029-03-17":{"label":"שבת החודש","refs":["Ezekiel 45:18-46:15","Isaiah 66:1","Isaiah 66:23-24"]},"2029-03-31":{"label":"פסח","refs":["Joshua 3:5-7","Joshua 5:2-6:1","Joshua 6:27"],"rep":1},"2029-04-14":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2029-07-07":{"label":"דברי ירמיהו (אחרי י״ז בתמוז)","refs":["Jeremiah 1:1-2:3"],"rep":1},"2029-08-11":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24","I Samuel 20:18","I Samuel 20:42"]},"2029-08-25":{"label":"עניה סוערה (נוסף לכי תצא)","refs":["Isaiah 54:11-55:5"]},"2029-09-15":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2029-09-29":{"label":"שבת חול המועד סוכות","refs":["Ezekiel 38:18-39:16"],"rep":1},"2029-12-08":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2030-01-05":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2030-02-02":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2030-03-02":{"label":"שבת שקלים","refs":["II Kings 11:17-12:17"]},"2030-03-16":{"label":"שבת זכור","refs":["I Samuel 15:2-34"]},"2030-03-23":{"label":"שבת פרה","refs":["Ezekiel 36:16-36"]},"2030-03-30":{"label":"שבת החודש","refs":["Ezekiel 45:18-46:15"]},"2030-04-20":{"label":"שבת חול המועד פסח","refs":["Ezekiel 37:1-14"],"rep":1},"2030-05-04":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2030-06-01":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2030-07-20":{"label":"דברי ירמיהו (אחרי י״ז בתמוז)","refs":["Jeremiah 1:1-2:3"],"rep":1},"2030-09-28":{"label":"ראש השנה","refs":["I Samuel 1:1-2:10"],"rep":1},"2030-10-05":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2030-10-12":{"label":"סוכות","refs":["Zechariah 14:1-21"],"rep":1},"2030-10-19":{"label":"שמחת תורה","refs":["Joshua 1:1-18"],"rep":1},"2030-10-26":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2030-12-21":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2030-12-28":{"label":"שבת חנוכה","refs":["I Kings 7:40-50"]}},"dia":{"2026-09-12":{"label":"ראש השנה","refs":["I Samuel 1:1-2:10"],"rep":1},"2026-09-19":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2026-09-26":{"label":"סוכות","refs":["Zechariah 14:1-21"],"rep":1},"2026-10-03":{"label":"שמיני עצרת","refs":["I Kings 8:54-66"],"rep":1},"2026-10-10":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2026-12-05":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2026-12-12":{"label":"שבת חנוכה","refs":["I Kings 7:40-50"]},"2027-01-09":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2027-02-06":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2027-03-06":{"label":"שבת שקלים","refs":["II Kings 11:17-12:17"]},"2027-03-20":{"label":"שבת זכור","refs":["I Samuel 15:2-34"]},"2027-03-27":{"label":"שבת פרה","refs":["Ezekiel 36:16-36"]},"2027-04-03":{"label":"שבת החודש","refs":["Ezekiel 45:18-46:15"]},"2027-04-24":{"label":"שבת חול המועד פסח","refs":["Ezekiel 37:1-14"],"rep":1},"2027-05-08":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2027-06-05":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2027-06-12":{"label":"שבועות (יום שני)","refs":["Habakkuk 3:1-19"],"rep":1},"2027-07-24":{"label":"דברי ירמיהו (אחרי י״ז בתמוז)","refs":["Jeremiah 1:1-2:3"],"rep":1},"2027-10-02":{"label":"ראש השנה","refs":["I Samuel 1:1-2:10"],"rep":1},"2027-10-09":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2027-10-16":{"label":"סוכות","refs":["Zechariah 14:1-21"],"rep":1},"2027-10-23":{"label":"שמיני עצרת","refs":["I Kings 8:54-66"],"rep":1},"2027-10-30":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2027-12-25":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2028-01-01":{"label":"שבת חנוכה","refs":["I Kings 7:40-50"]},"2028-01-29":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2028-02-26":{"label":"שבת שקלים","refs":["II Kings 11:17-12:17"]},"2028-03-11":{"label":"שבת זכור","refs":["I Samuel 15:2-34"]},"2028-03-18":{"label":"שבת פרה","refs":["Ezekiel 36:16-36"]},"2028-03-25":{"label":"שבת החודש","refs":["Ezekiel 45:18-46:15"]},"2028-04-15":{"label":"שבת חול המועד פסח","refs":["Ezekiel 37:1-14"],"rep":1},"2028-06-24":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24","I Samuel 20:18","I Samuel 20:42"]},"2028-07-15":{"label":"דברי ירמיהו (אחרי י״ז בתמוז)","refs":["Jeremiah 1:1-2:3"],"rep":1},"2028-09-23":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2028-09-30":{"label":"יום הכיפורים","refs":["Isaiah 57:14-58:14"],"rep":1},"2028-10-07":{"label":"שבת חול המועד סוכות","refs":["Ezekiel 38:18-39:16"],"rep":1},"2028-10-21":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2028-11-18":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2028-12-16":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2029-02-10":{"label":"שבת שקלים","refs":["II Kings 11:17-12:17"]},"2029-02-24":{"label":"שבת זכור","refs":["I Samuel 15:2-34"]},"2029-03-10":{"label":"שבת פרה","refs":["Ezekiel 36:16-36"]},"2029-03-17":{"label":"שבת החודש","refs":["Ezekiel 45:18-46:15","Isaiah 66:1","Isaiah 66:23-24"]},"2029-03-31":{"label":"פסח","refs":["Joshua 3:5-7","Joshua 5:2-6:1","Joshua 6:27"],"rep":1},"2029-04-07":{"label":"אחרון של פסח","refs":["Isaiah 10:32-12:6"],"rep":1},"2029-04-14":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2029-07-07":{"label":"דברי ירמיהו (אחרי י״ז בתמוז)","refs":["Jeremiah 1:1-2:3"],"rep":1},"2029-08-11":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24","I Samuel 20:18","I Samuel 20:42"]},"2029-08-25":{"label":"עניה סוערה (נוסף לכי תצא)","refs":["Isaiah 54:11-55:5"]},"2029-09-15":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2029-09-29":{"label":"שבת חול המועד סוכות","refs":["Ezekiel 38:18-39:16"],"rep":1},"2029-12-08":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2030-01-05":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2030-02-02":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2030-03-02":{"label":"שבת שקלים","refs":["II Kings 11:17-12:17"]},"2030-03-16":{"label":"שבת זכור","refs":["I Samuel 15:2-34"]},"2030-03-23":{"label":"שבת פרה","refs":["Ezekiel 36:16-36"]},"2030-03-30":{"label":"שבת החודש","refs":["Ezekiel 45:18-46:15"]},"2030-04-20":{"label":"שבת חול המועד פסח","refs":["Ezekiel 37:1-14"],"rep":1},"2030-05-04":{"label":"שבת ראש חודש","refs":["Isaiah 66:1-24"]},"2030-06-01":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2030-06-08":{"label":"שבועות (יום שני)","refs":["Habakkuk 3:1-19"],"rep":1},"2030-07-20":{"label":"דברי ירמיהו (אחרי י״ז בתמוז)","refs":["Jeremiah 1:1-2:3"],"rep":1},"2030-09-28":{"label":"ראש השנה","refs":["I Samuel 1:1-2:10"],"rep":1},"2030-10-05":{"label":"שבת שובה","refs":["Hosea 14:2-10","Micah 7:18-20"]},"2030-10-12":{"label":"סוכות","refs":["Zechariah 14:1-21"],"rep":1},"2030-10-19":{"label":"שמיני עצרת","refs":["I Kings 8:54-66"],"rep":1},"2030-10-26":{"label":"מחר חודש","refs":["I Samuel 20:18-42"]},"2030-12-21":{"label":"שבת חנוכה","refs":["Zechariah 2:14-4:7"]},"2030-12-28":{"label":"שבת חנוכה","refs":["I Kings 7:40-50"]}}};
const shmName=i=>i===7?'הפטרה':ALIYAH[i];
function haftFor(date){ const dia=!!lsGet('home-v1',{}).diaspora; const c=chumashFor(date||new Date(),dia); if(!c||!HAFT) return null;
  const d=new Date(date||new Date()); d.setHours(12,0,0,0); d.setDate(d.getDate()+(6-d.getDay())); const iso=isoDate(d);
  const sp=HAFT[dia?'dia':'il'][iso], onShabbos=(dia?SCHED.dia:SCHED.il)[iso]!=null;
  const reg=HAFT.reg[c.names.join('-')]||[].concat(...c.names.map(n=>HAFT.reg[n]||[]));
  const out=[]; if(!(sp&&sp.rep&&onShabbos)&&reg.length) out.push({label:'הפטרת פרשת '+c.he,refs:reg});
  if(sp&&onShabbos) out.push({label:sp.rep?sp.label:'הפטרת '+sp.label,refs:sp.refs});
  return out.length?{he:c.he,list:out}:null; }
async function partHaftara(date){ const H=haftFor(date); if(!H) throw new Error('no haftara');
  const data=await Promise.all(H.list.map(h=>Promise.all(h.refs.map(r=>sefText(r,"hebrew|Tanach with Ta'amei Hamikra")))));
  const blocks=[];
  H.list.forEach((h,hi)=>{ blocks.push({cls:'head',html:'<h3>'+h.label+'</h3><small>'+data[hi].map((t,ri)=>t.heRef||h.refs[ri]).join(' · ')+'</small>',w:2,mark:h.label});
    data[hi].forEach((txt,ri)=>{ if(ri) blocks.push({cls:'head',html:'<small>'+(txt.heRef||h.refs[ri])+'</small>',w:1,mark:h.label});
      let lastCh=null; toVerses(txt).forEach(x=>{ const v=clean(flat(x.val).join(' '));
        let s=''; if(x.ch!==lastCh){ s+='<span class="ch">פרק '+gem(x.ch)+'</span>'; lastCh=x.ch; }
        blocks.push({cls:'ps',html:s+'<p><span class="v">'+gem(x.v)+'</span>'+v+'</p>',w:wordsOf(v),mark:'פסוק '+gem(x.ch)+':'+gem(x.v)}); }); }); });
  const W=blocks.reduce((a,b)=>a+b.w,0); wcSet('shm:'+wkId()+':7',W);
  return {title:'הפטרה – פרשת '+H.he, blocks}; }
async function partShnayim(i,date){ if(i===7) return partHaftara(date); const R=shnayimRefs(i,date); if(!R) throw new Error('no parsha');
  const data=await Promise.all(R.refs.map(r=>Promise.all([sefText(r.ref,"hebrew|Tanach with Ta'amei Hamikra"), sefText('Onkelos '+r.ref,'hebrew').catch(()=>null)])));
  const blocks=[];
  R.refs.forEach((r,ri)=>{ const [txt,on]=data[ri]; const tv={}; if(on) toVerses(on).forEach(x=>{ tv[x.ch+':'+x.v]=clean(flat(x.val).join(' ')); });
    blocks.push({cls:'head',html:'<h3>שניים מקרא ואחד תרגום – פרשת '+r.parsha+' – '+ALIYAH[i]+'</h3><small>'+(txt.heRef||r.ref)+' · כל פסוק פעמיים ואחר כך התרגום</small>',w:2,mark:'פרשת '+r.parsha});
    let lastCh=null;
    toVerses(txt).forEach(x=>{ const v=clean(flat(x.val).join(' ')); const tg=tv[x.ch+':'+x.v]||'';
      let h=''; if(x.ch!==lastCh){ h+='<span class="ch">פרק '+gem(x.ch)+'</span>'; lastCh=x.ch; }
      h+='<p><span class="v">'+gem(x.v)+'</span>'+v+'</p><p class="mk2">'+v+'</p>'+(tg?'<div class="targ">'+tg+'</div>':'');
      blocks.push({cls:'ps',html:h,w:wordsOf(v)*2+wordsOf(tg),mark:'פסוק '+gem(x.ch)+':'+gem(x.v)}); }); });
  const W=blocks.reduce((a,b)=>a+b.w,0); wcSet('shm:'+wkId()+':'+i,W);
  return {title:'שניים מקרא – '+R.he+' – '+ALIYAH[i], blocks}; }

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
// Hebrew name of a Tanya Yomi calendar item (Sefaria sometimes gives only the English ref)
function tanyaHe(it){ const he=(it.displayValue&&it.displayValue.he)||it.heRef||''; if(/[א-ת]/.test(he)) return he.replace(/^תניא,?\s*/,'');
  const P={'Likkutei Amarim':'ליקוטי אמרים','Shaar HaYichud VehaEmunah':'שער היחוד והאמונה','Iggeret HaTeshuvah':'אגרת התשובה','Iggeret HaKodesh':'אגרת הקודש','Kuntres Acharon':'קונטרס אחרון'};
  const m=String(it.ref||'').match(/;\s*([^0-9]+?)\s+(\d+)(?::(\d+))?/); if(!m) return it.ref||''; const name=Object.keys(P).find(k=>m[1].includes(k));
  return (name?P[name]:m[1])+(name==='Likkutei Amarim'?' פרק ':' ')+gem(+m[2]); }
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
