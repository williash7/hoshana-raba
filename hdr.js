/* the top status bar can be made small on every reading screen: progress bar + one short line (saved for all screens) */
function collapsibleTop(o){ const top=document.querySelector(o.top||'header.top'); if(!top) return; const KEY='hdr-min-v1';
  const get=()=>{ try{ return JSON.parse(localStorage.getItem(KEY))===true; }catch(e){ return false; } }, set=v=>{ try{ localStorage.setItem(KEY,JSON.stringify(v)); }catch(e){} };
  const st=document.createElement('style'); st.textContent=
   '.top.min>:not(.bar):not(.mini):not(.hdrTgl):not(.banner){display:none!important}'+
   '.top .mini{display:none;align-items:center;justify-content:space-between;gap:calc(8px*var(--k,1));max-width:calc(760px*var(--k,1));margin:0 auto;padding:calc(4px*var(--k,1)) 0 calc(6px*var(--k,1));font-size:calc(12px*var(--k,1));color:var(--muted);white-space:nowrap;overflow:hidden;cursor:pointer}'+
   '.top .mini span{overflow:hidden;text-overflow:ellipsis}.top .mini b{color:var(--gold);font-variant-numeric:tabular-nums;direction:ltr}'+
   '.top.min .mini{display:flex}.top.min .bar{margin-top:calc(2px*var(--k,1))}'+
   '.hdrTgl{position:absolute;left:50%;transform:translateX(-50%);bottom:calc(-14px*var(--k,1));width:calc(44px*var(--k,1));height:calc(16px*var(--k,1));border:0;border-radius:0 0 calc(10px*var(--k,1)) calc(10px*var(--k,1));background:var(--night);color:var(--muted);font-size:calc(12px*var(--k,1));line-height:1;padding:0;box-shadow:0 1px 0 #0006;z-index:2}';
  document.head.appendChild(st);
  const bar=top.querySelector('.bar'), mini=document.createElement('div'); mini.className='mini'; (bar?bar:top.lastElementChild).after(mini);
  const tg=document.createElement('button'); tg.className='hdrTgl'; tg.type='button'; tg.setAttribute('aria-label','צמצום / הרחבה של שורת המצב'); top.appendChild(tg);
  const vis=el=>el&&!el.hidden&&el.style.display!=='none'&&el.textContent.trim();
  const txt=id=>{ const el=document.getElementById(id); return vis(el)?el.textContent.trim().replace(/\s+/g,' '):''; };
  function refresh(){ if(!top.classList.contains('min')) return; let parts=(o.ids||[]).map(txt).filter(Boolean); if(!parts.length) parts=[document.title]; const c=o.clock?txt(o.clock):'';
    mini.innerHTML='<span>'+parts.map(s=>s.replace(/[<>&]/g,'')).join(' · ')+'</span>'+(c?'<b>'+c.replace(/[<>&]/g,'')+'</b>':''); }
  function apply(v,re){ top.classList.toggle('min',v); tg.textContent=v?'⌄':'⌃'; refresh(); if(re) dispatchEvent(new Event('resize')); }
  tg.onclick=()=>{ const v=!top.classList.contains('min'); set(v); apply(v,true); };
  mini.onclick=()=>{ set(false); apply(false,true); };
  apply(get(),false); setInterval(refresh,1000); }
