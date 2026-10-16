/* Route tools: forecast wind at every waypoint (Open-Meteo, pressure-level model winds interpolated to
   altitude) and the frequencies along the route (aerodromes, TMAs/MTMAs from AIP ENR 2.1, FIS). */
(function(){
'use strict';
const E=window.EFB,P=window.PLAN;if(!E)return;
const $=id=>document.getElementById(id),esc=E.esc,num=E.num,S=E.S;
const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI,norm=d=>((d%360)+360)%360;
const p3=v=>String(Math.round(norm(v))||360).padStart(3,'0');
const LV=[1000,975,950,925,900,850,800,750,700];

/* ---------- waypoint times and altitudes ---------- */
function altFt(s,def){if(s==null||s==='')return def;const t=String(s).toUpperCase().trim();const fl=t.match(/^FL\s*(\d{2,3})$/);if(fl)return +fl[1]*100;const n=parseFloat(t.replace(/[^\d.]/g,''));return isFinite(n)&&n>0?n:def}
function baseTime(){const NL=P?P.NL:{};const m=String(NL.tot||'').match(/^(\d{1,2}):?(\d{2})$/);
  const d=(NL.date||E.todayISO());const t=m?Date.parse(`${d}T${m[1].padStart(2,'0')}:${m[2]}:00Z`):NaN;
  return isFinite(t)?{t,set:true}:{t:Date.now(),set:false}}
function cruiseAlt(){return altFt($('n_calt')&&$('n_calt').value,4500)}
/* points with estimated times (UTC) and the altitude flown on the leg ending there */
function plan(){const W=E.wpts,L=E.legs(),b=baseTime();let t=b.t;const ca=cruiseAlt();
  return W.map((w,i)=>{if(i>0){const l=L[i-1];t+=isFinite(l.ete)?l.ete*60e3:0}
    const alt=i>0?altFt(w.alt,ca):altFt(W[1]&&W[1].alt,ca);return {n:w.n,lat:w.lat,lon:w.lon,t,alt}})}

/* ---------- Open-Meteo ---------- */
async function fetchModel(pts){
  const v=['wind_speed_10m','wind_direction_10m','temperature_2m'];LV.forEach(l=>v.push(`wind_speed_${l}hPa`,`wind_direction_${l}hPa`,`temperature_${l}hPa`,`geopotential_height_${l}hPa`));
  const u=`https://api.open-meteo.com/v1/forecast?latitude=${pts.map(p=>p.lat.toFixed(3)).join(',')}&longitude=${pts.map(p=>p.lon.toFixed(3)).join(',')}&hourly=${v.join(',')}&wind_speed_unit=kn&timezone=GMT&past_days=1&forecast_days=3`;
  const r=await fetch(u,{cache:'no-store'});if(!r.ok)throw new Error('Open-Meteo HTTP '+r.status);let j=await r.json();if(!Array.isArray(j))j=[j];if(j[0]&&j[0].error)throw new Error(j[0].reason||'Open-Meteo error');return j}
/* profile at one time: [{h ft, u, v, T}] sorted by height */
function profile(o,t){const H=o.hourly;const ts=H.time.map(s=>Date.parse(s+'Z'));let k=0,bd=Infinity;ts.forEach((x,i)=>{const d=Math.abs(x-t);if(d<bd){bd=d;k=i}});
  const pr=[];const add=(h,s,d,T)=>{if(![h,s,d].every(isFinite))return;pr.push({h,u:-s*Math.sin(rad(d)),v:-s*Math.cos(rad(d)),T})};
  add((o.elevation||0)*3.28084+33,H.wind_speed_10m[k],H.wind_direction_10m[k],H.temperature_2m[k]);
  LV.forEach(l=>add(H[`geopotential_height_${l}hPa`][k]*3.28084,H[`wind_speed_${l}hPa`][k],H[`wind_direction_${l}hPa`][k],H[`temperature_${l}hPa`][k]));
  pr.sort((a,b)=>a.h-b.h);return {pr,time:ts[k]}}
function at(pr,h){if(!pr.length)return null;let a=pr[0],b=pr[pr.length-1];
  if(h<=a.h)b=a;else if(h>=b.h)a=b;else for(let i=1;i<pr.length;i++)if(pr[i].h>=h){a=pr[i-1];b=pr[i];break}
  const f=b.h===a.h?0:(h-a.h)/(b.h-a.h);const u=a.u+(b.u-a.u)*f,v=a.v+(b.v-a.v)*f,T=a.T+(b.T-a.T)*f;
  return {d:norm(deg(Math.atan2(-u,-v))),s:Math.hypot(u,v),T,u,v}}
const LEVELS=[2000,3000,4000,5000,6000,8000,10000];
async function getWinds(){const pts=plan();if(pts.length<2)throw new Error('Plan a route with at least two points first');
  const M=await fetchModel(pts);
  const out=pts.map((p,i)=>{const {pr,time}=profile(M[i],p.t);const lv={};LEVELS.forEach(h=>{const w=at(pr,h);if(w)lv[h]=[Math.round(w.d),Math.round(w.s),Math.round(w.T)]});
    const w=at(pr,p.alt);return {n:p.n,lat:p.lat,lon:p.lon,t:p.t,mt:time,alt:p.alt,w:w&&[Math.round(w.d),Math.round(w.s),Math.round(w.T)],uv:w&&[w.u,w.v],lv,elev:M[i].elevation}});
  /* leg wind: vector mean of both ends at the leg altitude */
  const legs=[];for(let i=1;i<out.length;i++){const a=at(profile(M[i-1],out[i-1].t).pr,out[i].alt),b=at(profile(M[i],out[i].t).pr,out[i].alt);
    if(!a||!b){legs.push(null);continue}const u=(a.u+b.u)/2,v=(a.v+b.v)/2;legs.push([Math.round(norm(deg(Math.atan2(-u,-v)))),Math.round(Math.hypot(u,v)),out[i].alt])}
  const res={at:new Date().toISOString(),base:baseTime(),key:key(),pts:out,legs};S.set('winds',res);return res}
const key=()=>E.wpts.map(w=>w.n+'@'+w.lat.toFixed(3)+','+w.lon.toFixed(3)+'/'+(w.alt||'')).join('|')+'#'+cruiseAlt()+'#'+((P&&P.NL.tot)||'');
function apply(res){res.legs.forEach((l,i)=>{const w=E.wpts[i+1];if(!w||!l)return;w.wd=p3(l[0]);w.ws=String(l[1]);w.wsrc='fc'});E.saveRoute();E.calcNav()}
const hhmm=t=>new Date(t).toISOString().slice(11,16)+'Z';
const wv=a=>a?`${p3(a[0])}/${String(a[1]).padStart(2,'0')}`:'—';
const tc=a=>a&&isFinite(a[2])?(a[2]>0?'+':'')+a[2]:'';

/* ---------- Navlog card ---------- */
function card(){const nav=$('cea');if(!nav||$('rw_card'))return;const c=document.createElement('div');c.className='card';c.id='rw_card';
  c.innerHTML=`<div class="row between"><h2 style="margin:0">Winds along the route</h2><div class="row">
      <label style="max-width:150px">Cruise altitude ft<input id="n_calt" inputmode="numeric" value="${esc(S.get('calt','4500'))}"></label>
      <button type="button" class="primary" id="rw_get">Get forecast winds</button><button type="button" id="rw_freq">Enroute frequencies</button></div></div>
    <p class="sub" id="rw_sub">Model forecast wind at each waypoint for the planned altitude and time (T/O time on the log, UTC). Each leg gets the average of its two ends. Legs use their own Route Altitude where set.</p>
    <div class="tbl" id="rw_tbl"></div>`;
  nav.closest('.paperwrap').before(c);
  $('n_calt').addEventListener('change',e=>S.set('calt',e.target.value.trim()));
  $('rw_get').onclick=async()=>{const b=$('rw_get');b.disabled=true;b.textContent='Fetching…';
    try{const r=await getWinds();apply(r);table(r)}catch(e){$('rw_tbl').innerHTML=`<p class="warnbox">${esc(e.message||e)}</p>`}
    b.disabled=false;b.textContent='Get forecast winds'};
  $('rw_freq').onclick=()=>window.PACK&&window.PACK.open(['freq']);
  const r=S.get('winds',null);if(r&&r.key===key())table(r)}
function table(r){$('rw_tbl').innerHTML=`<table><thead><tr><th>Waypoint</th><th>ETA</th><th>Alt ft</th><th>W/V °T/kt</th><th>Temp °C</th>${LEVELS.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>
  ${r.pts.map(p=>`<tr><td>${esc(p.n)}</td><td>${hhmm(p.t)}</td><td>${p.alt}</td><td><b>${wv(p.w)}</b></td><td>${tc(p.w)}</td>${LEVELS.map(h=>`<td>${wv(p.lv[h])}</td>`).join('')}</tr>`).join('')}</tbody></table>
  <p class="sub">Open-Meteo model forecast, retrieved ${esc(r.at.slice(11,16))}Z${r.base.set?'':' · no T/O time on the log, so times start now'}. Leg W/V on the log was filled in from these; type over any value to change it. Cross-check with the HNMS wind chart in the briefing pack.</p>`}

/* ---------- airspace along the route ---------- */
const inPoly=(y,x,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const [yi,xi]=P[i],[yj,xj]=P[j];if(((yi>y)!=(yj>y))&&(x<(xj-xi)*(y-yi)/(yj-yi)+xi))c=!c}return c};
function along(){const W=E.wpts,A=window.EFB_AIRSPACE||[];const hits=[],seen=new Set();let dist=0;const near=new Map();
  for(let i=1;i<W.length;i++){const a=W[i-1],b=W[i];const {d}=E.gc(a,b);const n=Math.max(2,Math.ceil(d));
    for(let k=0;k<=n;k++){const f=k/n,y=a.lat+(b.lat-a.lat)*f,x=a.lon+(b.lon-a.lon)*f,dd=dist+d*f;
      A.forEach(s=>{const ins=inPoly(y,x,s.p);if(ins&&!seen.has(s.n)){seen.add(s.n);hits.push({s,leg:i,at:dd,from:a.n,to:b.n})}
        else if(!ins&&seen.has(s.n)){seen.delete(s.n);hits.push({s,leg:i,at:dd,from:a.n,to:b.n,exit:true})}});
      (E.APTS||[]).forEach(ap=>{if(!ap.freqs||!ap.freqs.length)return;const g=E.gc({lat:y,lon:x},ap).d;if(g<=10){const o=near.get(ap.icao);if(!o||g<o.g)near.set(ap.icao,{ap,g,at:dd,leg:i})}})}
    dist+=d}
  return {hits,near:[...near.values()].sort((p,q)=>p.at-q.at),dist}}
const fq=a=>a.freqs.map(f=>`<span class="fq"><b>${esc(f[1])}</b> ${esc(f[0])}${f[2]&&f[2]!==f[0]?' · '+esc(f[2]):''}</span>`).join('');
function freqDoc(docHead){const W=E.wpts,F=window.EFB_FIS;if(!F)return '';const X=along();
  const dep=W[0]&&E.BY[W[0].n],dst=W.length>1&&E.BY[W[W.length-1].n];const altId=($('b_alt')&&$('b_alt').value.trim().toUpperCase())||'';
  /* one ordered list of events along the route */
  const ev=[];if(dep)ev.push({at:-1,h:`Departure · ${dep.icao} ${esc(dep.name)}`,b:fq(dep)});
  X.near.forEach(n=>{if(dep&&n.ap.icao===dep.icao||dst&&n.ap.icao===dst.icao)return;ev.push({at:n.at,h:`${n.ap.icao} ${esc(n.ap.name)} <small>within ${n.g.toFixed(0)} NM of track, ${n.at.toFixed(0)} NM from departure</small>`,b:fq(n.ap)})});
  X.hits.forEach(h=>{if(h.exit){if(h.at<X.dist-3)ev.push({at:h.at,h:`Leaving ${esc(h.s.n)} <small>${h.at.toFixed(0)} NM from departure (${esc(h.from)} → ${esc(h.to)})</small>`,b:`<p class="np">Outside controlled/military airspace: ${F.fic.slice(0,1).map(r=>`<b>${r[1]}</b> ${esc(r[0])}`).join('')} unless the next unit below applies.</p>`});return}
    ev.push({at:h.at,h:`${esc(h.s.n)} <small>${h.s.k==='MTMA'?'MTMA (RMZ) · ':''}lower limit ${esc(h.s.f)} · entered ${h.at.toFixed(0)} NM from departure (${esc(h.from)} → ${esc(h.to)})</small>`,
    b:h.s.u.map(u=>`<span class="fq"><b>${esc(u[1])}</b> ${esc(u[0])}${u[2]?' · '+esc(u[2]):''}</span>`).join('')+(h.s.note?`<p class="np">${esc(h.s.note)}</p>`:'')})});
  if(dst)ev.push({at:1e9,h:`Destination · ${dst.icao} ${esc(dst.name)}`,b:fq(dst)});
  const alt=E.BY[altId];if(alt&&(!dst||alt.icao!==dst.icao))ev.push({at:1e9+1,h:`Alternate · ${alt.icao} ${esc(alt.name)}`,b:fq(alt)});
  ev.sort((a,b)=>a.at-b.at);
  const route=W.length>1?ev.map(e=>`<div class="fr"><h3>${e.h}</h3><div>${e.b}</div></div>`).join(''):'<p class="sub">No route planned: only the FIR-wide frequencies are listed.</p>';
  const tbl=(rows,c3)=>`<table class="ft"><tbody>${rows.map(r=>`<tr><td><b>${esc(r[1])}</b></td><td>${esc(r[0])}</td>${c3?`<td>${esc(r[2]||'')}</td>`:''}</tr>`).join('')}</tbody></table>`;
  const wp=W.map(w=>w.n).join(' – ');
  return `<section class="ppage doc">${docHead('Enroute frequencies',(wp||'Athinai FIR')+(X.dist?` · ${X.dist.toFixed(0)} NM`:''))}
    <div class="frcols"><div><h2 class="fh">Along the route</h2>${route}
      <div class="fr"><h3>Outside TMAs, MTMAs and ATZs (class G, below FL195)</h3><div>${F.fic.map(r=>`<span class="fq"><b>${r[1]}</b> ${esc(r[0])}</span>`).join('')}</div><p class="np">ENR 1.2.11.1 e: flight information service for VFR flights is provided by ATHINAI FIC (MAKEDONIA FIC in the north).</p></div></div>
    <div><h2 class="fh">Always available</h2>${tbl(F.gen,1)}
      <h2 class="fh">Flight information (FIC)</h2>${tbl(F.fic,1)}${tbl(F.mak,1)}
      <h2 class="fh">Area control sectors (reference)</h2>${tbl(F.acc,0)}</div></div>
    <p class="foot">${esc(F.src)}. Airspace outlines are simplified (boundaries following the FIR line are straightened), so treat the "reached" distances as approximate and confirm on the ENR 6 and VFR charts. Aerodrome frequencies: OurAirports, check AD 2.18.</p></section>`}

/* ---------- winds document for the pack ---------- */
async function windDoc(docHead){if(E.wpts.length<2)return '';let r=S.get('winds',null),err='';
  if(!r||r.key!==key()){try{r=await getWinds()}catch(e){err=e.message||String(e)}}
  if(err)return `<section class="ppage doc">${docHead('Winds aloft along the route','Open-Meteo')}<p class="warnbox">Forecast winds could not be retrieved (${esc(err)}). Use the HNMS wind/temperature chart.</p></section>`;
  return `<section class="ppage doc">${docHead('Winds aloft along the route',`Open-Meteo model forecast · retrieved ${r.at.slice(0,16).replace('T',' ')}Z${r.base.set?'':' · times from print time (no T/O time on the log)'}`)}
   <table class="ft wt"><thead><tr><th>Waypoint</th><th>ETA</th><th>Planned alt ft</th><th>W/V at alt</th><th>Temp</th>${LEVELS.map(h=>`<th>${h} ft</th>`).join('')}</tr></thead><tbody>
   ${r.pts.map(p=>`<tr><td><b>${esc(p.n)}</b></td><td>${hhmm(p.t)}</td><td>${p.alt}</td><td><b>${wv(p.w)}</b></td><td>${tc(p.w)}</td>${LEVELS.map(h=>`<td>${wv(p.lv[h])}<small> ${tc(p.lv[h])}</small></td>`).join('')}</tr>`).join('')}</tbody></table>
   <h2 class="fh">Leg winds used on the navlog</h2><table class="ft"><tbody>${r.legs.map((l,i)=>`<tr><td>${esc(r.pts[i].n)} → ${esc(r.pts[i+1].n)}</td><td>${l?l[2]+' ft':''}</td><td><b>${l?wv(l):'—'}</b></td></tr>`).join('')}</tbody></table>
   <p class="foot">W/V in degrees true / knots, temperature °C. Model data (Open-Meteo, best-match weather models) interpolated between pressure levels to altitude; not an official forecast. Cross-check with the HNMS wind/temperature charts.</p></section>`}

window.ROUTE={getWinds,apply,along,freqDoc,windDoc,plan};
card();window.addEventListener('hashchange',()=>{if(location.hash==='#nav')card()});
})();
