/* DA40 D Flight Bag. Planning aid for training; not certified, not for navigation. */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num=v=>{const n=parseFloat(String(v==null?'':v).replace(',','.'));return isFinite(n)?n:NaN};
const norm=a=>((a%360)+360)%360;
const p3=a=>{const v=Math.round(norm(a))%360;return String(v===0?360:v).padStart(3,'0')};
const rad=d=>d*Math.PI/180, deg=r=>r*180/Math.PI;
const S={get(k,d){try{const v=localStorage.getItem('efb.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},
         set(k,v){try{localStorage.setItem('efb.'+k,JSON.stringify(v))}catch(e){}}};
const APTS=window.EFB_AIRPORTS||[], OTHER=window.EFB_OTHER||[], NAVAIDS=window.EFB_NAVAIDS||[], AVFR=window.EFB_VFR||[], AIFR=window.EFB_IFR||[], AIRAC=window.EFB_AIRAC||'';
const BY={};APTS.forEach(a=>BY[a.icao]=a);
const todayISO=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dm=(v,lat)=>{const h=lat?(v>=0?'N':'S'):(v>=0?'E':'W');v=Math.abs(v);const d=Math.floor(v);return h+String(d).padStart(lat?2:3,'0')+' '+((v-d)*60).toFixed(1).padStart(4,'0')};
const fmtT=m=>isFinite(m)?Math.floor(m/60)+':'+String(Math.round(m%60)).padStart(2,'0'):'—';
const m2ft=m=>m*3.28084;

/* ---------- theme ---------- */
function applyTheme(t){document.documentElement.setAttribute('data-theme',t);document.querySelectorAll('#s_theme button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));
  const meta=document.querySelector('meta[name=theme-color]');if(meta)meta.content=getComputedStyle(document.documentElement).getPropertyValue('--panel').trim()||'#111921'}
applyTheme(S.get('theme','dark'));
$('s_theme').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;S.set('theme',b.dataset.t);applyTheme(b.dataset.t);if(window._redraw)window._redraw()});

/* ---------- navigation ---------- */
const IC={
 map:'<path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/>',
 apts:'<path d="M12 3v18M5 9l7 3 7-3M9 18l3-1 3 1"/>',
 tg:'<ellipse cx="12" cy="12" rx="9" ry="5"/><path d="M12 7h0M18 12l3-1"/><circle cx="7" cy="9" r="1.2"/>',
 nav:'<path d="M4 6h16M4 12h10M4 18h7"/><path d="M17 14l4 4-4 4"/>',
 brief:'<path d="M6 3h9l4 4v14H6z"/><path d="M9 11h7M9 15h7M9 7h4"/>',
 tools:'<circle cx="12" cy="12" r="8"/><path d="M12 12l4-5M12 4v2M20 12h-2"/>',
 risk:'<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
 acft:'<path d="M12 2v20M3 12l9-2 9 2M8 20l4-1 4 1"/>',
 set:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>'
};
const NAV=[['map','Map'],['apts','Airports'],['tg','Circuits'],['nav','Navlog'],['brief','Brief'],['tools','Calc'],['risk','Risk'],['acft','DA40 D'],['set','Settings']];
$('rail').innerHTML=NAV.map(([k,l],i)=>(k==='set'?'<div class="spacer"></div>':'')+`<button type="button" data-v="${k}"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>${l}</button>`).join('');
$('rail').addEventListener('click',e=>{const b=e.target.closest('button');if(b)go(b.dataset.v)});
function go(v){location.hash=v}
function route(){
  let h=location.hash.slice(1)||S.get('view','map');let apt=null;
  if(h.startsWith('apt-')){apt=h.slice(4).toUpperCase();if(!BY[apt])h='apts';else h='apt'}
  if(!document.querySelector(`.view[data-view="${h}"]`))h='map';
  document.querySelectorAll('.view').forEach(s=>s.hidden=s.dataset.view!==h);
  const railKey=h==='apt'?'apts':h;
  document.querySelectorAll('#rail button').forEach(b=>b.setAttribute('aria-current',b.dataset.v===railKey));
  if(h!=='apt')S.set('view',h);
  if(h==='map'){initMap();setTimeout(()=>map&&map.invalidateSize(),50)}
  if(h==='apt')renderApt(apt);
  if(h==='apts')renderApts();
  if(h==='nav')renderNav();
  if(h==='tg')renderTG();
  const v=document.querySelector(`.view[data-view="${h}"]`);if(v&&v.classList.contains('scroll'))v.scrollTop=0;
}
window.addEventListener('hashchange',route);

/* ---------- weather ---------- */
const wxCache={};
async function getWx(ids){
  ids=[...new Set(ids.filter(i=>/^[A-Z]{4}$/.test(i)))];if(!ids.length)return {};
  const now=Date.now(),need=ids.filter(i=>!wxCache[i]||now-wxCache[i].t>8*60e3);
  if(need.length){
    const q=need.join(',');let mj=null,tj=[],errs=[];
    const J=async u=>{const r=await fetch(u,{cache:'no-store'});if(r.status===204)return [];if(!r.ok)throw new Error('HTTP '+r.status);const t=await r.text();return t.trim()?JSON.parse(t):[]};
    if(window.EFB_SERVER){try{const j=await J('/api/wx/metar?ids='+q);mj=j.metar||[];tj=j.taf||[]}catch(e){errs.push('school server: '+e.message)}}
    if(!mj){try{[mj,tj]=await Promise.all([J(`https://aviationweather.gov/api/data/metar?ids=${q}&format=json`),J(`https://aviationweather.gov/api/data/taf?ids=${q}&format=json`)])}catch(e){mj=null;errs.push('aviationweather.gov: '+(e.message||'blocked'))}}
    if(!mj){/* fallback: NOAA raw text files, one per station */
      try{mj=[];tj=[];await Promise.all(need.map(async id=>{
        const m=await fetch(`https://tgftp.nws.noaa.gov/data/observations/metar/stations/${id}.TXT`,{cache:'no-store'}).then(r=>r.ok?r.text():'').catch(()=>null);
        const t=await fetch(`https://tgftp.nws.noaa.gov/data/forecasts/taf/stations/${id}.TXT`,{cache:'no-store'}).then(r=>r.ok?r.text():'').catch(()=>null);
        if(m===null&&t===null)throw new Error('blocked');
        const body=s=>(s||'').split('\n').slice(1).join(' ').replace(/\s+/g,' ').trim();
        if(body(m))mj.push({icaoId:id,rawOb:'METAR '+body(m),src:'NOAA'});if(body(t))tj.push({icaoId:id,rawTAF:body(t)})}))}
      catch(e){mj=null;errs.push('NOAA: '+(e.message||'blocked'))}}
    if(!mj){need.forEach(i=>wxCache[i]={t:0,metar:null,taf:null,err:errs.join('; ')});throw new Error('Weather could not be retrieved ('+errs.join('; ')+')')}
    need.forEach(i=>wxCache[i]={t:now,metar:null,taf:null});
    mj.forEach(o=>{if(wxCache[o.icaoId]&&!wxCache[o.icaoId].metar)wxCache[o.icaoId].metar=o});
    tj.forEach(o=>{if(wxCache[o.icaoId]&&!wxCache[o.icaoId].taf)wxCache[o.icaoId].taf=o});
  }
  const out={};ids.forEach(i=>out[i]=wxCache[i]);return out;
}
const wxLink=ids=>`https://aviationweather.gov/data/metar/?ids=${ids.join(',')}&hours=0&taf=1`;
function obsAge(o){let t=o.obsTime?o.obsTime*1000:Date.parse(o.reportTime||'');if(!isFinite(t))return '';const m=Math.round((Date.now()-t)/60000);return m<60?m+' min ago':Math.floor(m/60)+' h '+(m%60)+' min ago'}
function wxBlock(icao,w){
  if(!w||!w.metar)return `<div class="wx"><div class="hd"><b>${esc(icao)}</b><span class="sub">No METAR returned. Many smaller Greek aerodromes don't publish one.</span></div>${w&&w.taf?`<pre>${esc(w.taf.rawTAF)}</pre>`:''}</div>`;
  const m=w.metar,cat=m.fltCat||'';
  return `<div class="wx"><div class="hd"><b>${esc(icao)}</b>${cat?`<span class="cat ${esc(cat)}">${esc(cat)}</span>`:''}<span class="age">${esc(obsAge(m))}</span></div><pre>${esc(m.rawOb)}</pre>${w.taf?`<pre style="color:var(--muted)">${esc(w.taf.rawTAF)}</pre>`:''}</div>`;
}
function wxFail(ids){return `<div class="wx"><b>Couldn't load live weather.</b><p class="sub">You may be offline, or the weather service refused the request. <a href="${wxLink(ids)}" target="_blank" rel="noopener" style="color:var(--accent)">Open on aviationweather.gov</a></p></div>`}

/* ---------- runway helpers ---------- */
function ends(a){const out=[];(a.rwys||[]).forEach(r=>{
  const h=r.hdg!=null?r.hdg:(num(r.le)*10);const approx=r.hdg==null;
  out.push({id:r.le,hdg:h,approx,len:r.len_ft,sfc:r.sfc});if(r.he)out.push({id:r.he,hdg:norm(h+180),approx,len:r.len_ft,sfc:r.sfc});});return out}
function comps(dir,spd,rh){const a=rad(dir-rh);return {hw:spd*Math.cos(a),xw:spd*Math.sin(a)}}
const SFC={ASP:'Asphalt',ASPH:'Asphalt',CON:'Concrete',GRS:'Grass',UNK:'Unknown'};

/* ---------- airports list ---------- */
function longest(a){return Math.max(0,...(a.rwys||[]).map(r=>r.len_ft||0))}
function renderApts(){
  $('a_count').textContent=APTS.length;
  $('a_list').innerHTML=APTS.map(a=>{const w=wxCache[a.icao];const cat=w&&w.metar&&w.metar.fltCat;
    return `<button type="button" class="apt" data-i="${a.icao}"><div class="top"><b>${a.icao}</b>${cat?`<span class="cat ${esc(cat)}">${esc(cat)}</span>`:''}</div><div class="nm">${esc(a.name)}</div>
    <div class="meta">${(a.rwys||[]).map(r=>esc(r.le+'/'+r.he)).join(' · ')} · ${Math.round(longest(a)/3.28084)} m · ${a.elev} ft</div></button>`}).join('');
}
$('a_list').addEventListener('click',e=>{const b=e.target.closest('[data-i]');if(b)go('apt-'+b.dataset.i)});
$('a_wx').onclick=async()=>{const b=$('a_wx');b.textContent='Loading…';try{await getWx(APTS.map(a=>a.icao));renderApts();b.textContent='Refresh METARs'}catch(e){b.textContent='Weather unavailable';setTimeout(()=>b.textContent='Load METARs',3000)}};

/* ---------- airport detail ---------- */
let circ=S.get('circ',{}),vrps=S.get('vrps',{});
function renderApt(icao){
  const a=BY[icao];if(!a)return;const E=ends(a);const c=circ[icao]||{};const V=vrps[icao]||[];const OV=AVFR.filter(v=>v[3]===icao);
  const tg=tglog.filter(l=>l.apt===icao);const tot=tg.reduce((s,l)=>s+l.tg+l.fs,0);
  $('apt_page').innerHTML=`
  <button type="button" class="back" data-go="apts">← Airports</button>
  <div class="apthead"><div><div class="icao">${a.icao}</div><h1 style="font-size:24px">${esc(a.name)}</h1><p class="sub">${esc(a.city||'')} · ${dm(a.lat,1)} ${dm(a.lon,0)}</p></div>
    <div class="row"><button type="button" data-act="map">Show on map</button><button type="button" data-act="route">Add to route</button><button type="button" class="primary" data-act="tg">Start circuits</button></div></div>
  <div class="facts">
    <div class="ro"><div class="k">Elevation</div><div class="v">${a.elev}<small> ft</small></div></div>
    <div class="ro"><div class="k">Circuit alt</div><div class="v">${c._alt?esc(c._alt)+'<small> ft</small>':'<small>add from AIP</small>'}</div></div>
    <div class="ro"><div class="k">Landings logged</div><div class="v">${tot}</div></div>
  </div>
  <div class="card" id="ap_charts"></div>
  <div class="card"><div class="row between"><h2 style="margin:0">Weather</h2><button type="button" data-act="wx">Refresh</button></div><div id="ap_wx" class="wxout" style="margin-top:10px"><p class="sub">Loading METAR…</p></div>
    <div class="tbl" id="ap_rwind" style="margin-top:12px"></div></div>
  <div class="grid2">
    <div class="card"><h2>Runways</h2><div class="tbl"><table><thead><tr><th>Rwy</th><th>Hdg °T</th><th>Length</th><th>Surface</th></tr></thead><tbody>
      ${E.map(r=>`<tr><td><b>${esc(r.id)}</b></td><td>${r.approx?'~':''}${p3(r.hdg)}</td><td>${r.len?Math.round(r.len/3.28084)+' m':'—'}</td><td>${esc(SFC[r.sfc]||r.sfc||'—')}</td></tr>`).join('')}</tbody></table></div>
      ${E.some(r=>r.approx)?'<p class="sub">~ heading estimated from runway number.</p>':''}</div>
    <div class="card"><h2>Frequencies</h2>${a.freqs.length?`<div class="tbl"><table><tbody>${a.freqs.map(f=>`<tr><td><b>${esc(f[0])}</b></td><td>${esc(f[1])}</td><td class="wrap">${esc(f[2]||'')}</td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No frequencies in the dataset. Take them from AIP AD 2.18.</p>'}
      <p class="sub">Unverified crowd-sourced data. Confirm in AIP AD 2.18.</p></div>
  </div>
  <div class="card"><h2>Circuit</h2>
    <p class="sub">Enter from AIP AD 2.22 and the visual approach chart, or your school's circuit briefing.</p>
    <div class="fields two" style="margin-top:10px"><label>Circuit altitude ft<input id="c_alt" inputmode="numeric" value="${esc(c._alt||'')}" placeholder="e.g. 1000 AAL / 1100 AMSL"></label><label>General notes<input id="c_notes" value="${esc(c._notes||'')}" placeholder="Noise, restrictions, PPR…"></label></div>
    <div class="tbl"><table><thead><tr><th>Rwy</th><th>Direction</th><th>Notes</th></tr></thead><tbody>
      ${E.map(r=>`<tr><td><b>${esc(r.id)}</b></td><td><select data-cr="${esc(r.id)}" style="min-width:110px"><option value="">—</option><option ${c[r.id]==='Left'?'selected':''}>Left</option><option ${c[r.id]==='Right'?'selected':''}>Right</option><option ${c[r.id]==='No circuit'?'selected':''}>No circuit</option></select></td><td><input data-cn="${esc(r.id)}" value="${esc(c[r.id+'_n']||'')}" placeholder="Joining, crosswind, deadside…"></td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><div class="row between"><h2 style="margin:0">VFR reporting points · AIP</h2><span class="sub" style="margin:0">${esc(AIRAC)}</span></div>
    ${OV.length?`<div class="tbl" style="margin-top:8px"><table><thead><tr><th>Point</th><th>Position</th><th></th></tr></thead><tbody>${OV.map((v,i)=>`<tr><td><b>${esc(v[0])}</b></td><td>${dm(v[1],1)} ${dm(v[2],0)}</td><td><button type="button" class="x" data-ov="${i}" title="Add to route">＋</button></td></tr>`).join('')}</tbody></table></div><p class="sub">From AD 2-${a.icao}-VFR. Points shown on the chart without published coordinates are not included.</p>`:`<p class="empty">AIP Greece publishes no VFR route chart with coordinates for ${a.icao}. Use the AD 2 visual approach chart, and add your school's points below.</p>`}</div>
  <div class="card"><h2>Your VRPs and entry/exit notes</h2>
    ${V.length?`<div class="tbl"><table><thead><tr><th>Name</th><th>Position</th><th>Use</th><th></th></tr></thead><tbody>${V.map((v,i)=>`<tr><td><b>${esc(v.n)}</b></td><td>${dm(v.lat,1)} ${dm(v.lon,0)}</td><td class="wrap">${esc(v.note||'')}</td><td><button type="button" class="x" data-vr="${i}" title="Add to route">＋</button><button type="button" class="x" data-vd="${i}" aria-label="Delete VRP">×</button></td></tr>`).join('')}</tbody></table></div>`:'<p class="empty">No VRPs yet. Add them from the AIP visual approach chart.</p>'}
    <div class="vrpform" style="margin-top:10px"><label>Name<input id="v_n" placeholder="e.g. VRP name"></label><label>Lat<input id="v_la" placeholder="N35 20.4"></label><label>Lon<input id="v_lo" placeholder="E025 10.8"></label><button type="button" id="v_add">Add VRP</button></div>
    <label style="margin-top:8px">Entry/exit use<input id="v_note" placeholder="e.g. entry for rwy 27, report at 2000 ft"></label></div>`;
  loadAptWx(a);renderAptCharts(icao);
}
async function loadAptWx(a){
  const box=$('ap_wx');if(!box)return;
  try{const w=(await getWx([a.icao]))[a.icao];box.innerHTML=wxBlock(a.icao,w);
    const m=w&&w.metar;const rw=$('ap_rwind');
    if(m&&isFinite(num(m.wdir))&&isFinite(num(m.wspd))){
      const E=ends(a),d=num(m.wdir),s=num(m.wspd),g=num(m.wgst);
      const rows=E.map(r=>({r,c:comps(d,s,r.hdg),cg:isFinite(g)?comps(d,g,r.hdg):null}));const best=rows.reduce((b,x)=>x.c.hw>b.c.hw?x:b,rows[0]);
      rw.innerHTML=`<table><thead><tr><th>Rwy</th><th>Head/tail</th><th>Crosswind</th>${isFinite(g)?'<th>Gust X</th>':''}</tr></thead><tbody>${rows.map(x=>`<tr class="${x===best?'best':''}"><td><b>${esc(x.r.id)}</b>${x===best?' ◂':''}</td><td>${x.c.hw>=0?'H':'T'} ${Math.abs(x.c.hw).toFixed(0)} kt</td><td>${x.c.xw>=0?'R':'L'} ${Math.abs(x.c.xw).toFixed(0)} kt</td>${x.cg?`<td>${Math.abs(x.cg.xw).toFixed(0)} kt</td>`:''}</tr>`).join('')}</tbody></table><p class="sub">From METAR wind ${p3(d)}°T/${s} kt against true runway headings. ◂ most headwind.</p>`;
    }else if(m){rw.innerHTML=`<p class="sub">Wind ${esc(m.wdir)}${m.wspd!=null?'/'+esc(m.wspd)+' kt':''}: no runway components for variable or calm wind.</p>`}
  }catch(e){box.innerHTML=wxFail([a.icao])}
}
$('apt_page').addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;const icao=$('apt_page').querySelector('.icao').textContent;const a=BY[icao];
  if(b.dataset.go)go(b.dataset.go);
  const act=b.dataset.act;
  if(act==='map'){go('map');setTimeout(()=>map&&map.setView([a.lat,a.lon],12),120)}
  if(act==='route'){addWpt({n:a.icao,lat:a.lat,lon:a.lon});b.textContent='Added';}
  if(act==='tg'){sess.apt=icao;sess.rwy='';saveSess();go('tg')}
  if(act==='wx'){delete wxCache[icao];loadAptWx(a)}
  if(b.id==='v_add'){const la=parseCoord($('v_la').value,1),lo=parseCoord($('v_lo').value,0),n=$('v_n').value.trim();
    if(!n||!isFinite(la)||!isFinite(lo)){[$('v_n'),$('v_la'),$('v_lo')].forEach(i=>i.style.borderColor=(i.id==='v_n'?n:isFinite(parseCoord(i.value,i.id==='v_la')))?'':'var(--bad)');return}
    (vrps[icao]=vrps[icao]||[]).push({n,lat:la,lon:lo,note:$('v_note').value.trim()});S.set('vrps',vrps);renderApt(icao);drawVRPs()}
  if(b.dataset.vd!=null){vrps[icao].splice(+b.dataset.vd,1);S.set('vrps',vrps);renderApt(icao);drawVRPs()}
  if(b.dataset.ov!=null){const v=AVFR.filter(x=>x[3]===icao)[+b.dataset.ov];addWpt({n:v[0],lat:v[1],lon:v[2]});b.textContent='✓'}
  if(b.dataset.vr!=null){const v=vrps[icao][+b.dataset.vr];addWpt({n:v.n,lat:v.lat,lon:v.lon});b.textContent='✓'}
});
$('apt_page').addEventListener('change',e=>{
  const t=e.target;const icao=$('apt_page').querySelector('.icao').textContent;const c=circ[icao]=circ[icao]||{};
  if(t.id==='c_alt')c._alt=t.value.trim();else if(t.id==='c_notes')c._notes=t.value.trim();
  else if(t.dataset.cr)c[t.dataset.cr]=t.value;else if(t.dataset.cn)c[t.dataset.cn+'_n']=t.value.trim();else return;
  S.set('circ',circ);
});

/* ---------- circuits / T&G ---------- */
let tglog=S.get('tglog',[]);
let sess=S.get('sess',{apt:'LGIR',rwy:'',role:'Dual',tg:0,fs:0,ga:0,start:null,notes:''});
function saveSess(){S.set('sess',sess)}
$('t_apt').innerHTML=APTS.map(a=>`<option value="${a.icao}">${a.icao} · ${esc(a.name.replace(/ (International |National )?Airport.*$/,'').slice(0,26))}</option>`).join('');
function fillRwy(){const a=BY[sess.apt];const E=a?ends(a):[];$('t_rwy').innerHTML='<option value="">—</option>'+E.map(r=>`<option ${sess.rwy===r.id?'selected':''}>${esc(r.id)}</option>`).join('')}
function renderTG(){
  $('t_apt').value=sess.apt;fillRwy();$('t_role').value=sess.role;$('t_notes').value=sess.notes||'';
  $('t_tg').textContent=sess.tg;$('t_fs').textContent=sess.fs;$('t_ga').textContent=sess.ga;
  $('t_start').value=sess.start?new Date(sess.start).toUTCString().slice(17,22)+'Z':'—';
  const byA={};let L=0;tglog.forEach(l=>{byA[l.apt]=(byA[l.apt]||0)+l.tg+l.fs;L+=l.tg+l.fs});
  $('t_totals').innerHTML=`<span class="t"><b>${L}</b> landings total</span>`+Object.entries(byA).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<span class="t">${k} ${v}</span>`).join('');
  $('t_log').innerHTML=tglog.length?tglog.slice().reverse().map((l,ri)=>{const i=tglog.length-1-ri;return `<tr><td>${esc(l.date)}</td><td>${esc(l.apt)}</td><td>${esc(l.rwy||'—')}</td><td>${esc(l.role)}</td><td>${l.tg}</td><td>${l.fs}</td><td>${l.ga}</td><td class="wrap">${esc(l.notes||'')}</td><td><button type="button" class="x" data-del="${i}" aria-label="Delete entry">×</button></td></tr>`}).join(''):'<tr><td colspan="9" class="wrap" style="color:var(--muted)">No sessions saved yet.</td></tr>';
}
$('t_apt').onchange=()=>{sess.apt=$('t_apt').value;sess.rwy='';saveSess();fillRwy()};
$('t_rwy').onchange=()=>{sess.rwy=$('t_rwy').value;saveSess()};
$('t_role').onchange=()=>{sess.role=$('t_role').value;saveSess()};
$('t_notes').oninput=()=>{sess.notes=$('t_notes').value;saveSess()};
document.querySelector('.counters').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const k=b.dataset.c,d=+b.dataset.d;
  sess[k]=Math.max(0,sess[k]+d);if(!sess.start&&d>0)sess.start=Date.now();saveSess();renderTG();if(navigator.vibrate&&d>0)try{navigator.vibrate(30)}catch(e){}});
function toast(m){const t=$('t_toast');t.textContent=m;t.hidden=false;clearTimeout(toast._t);toast._t=setTimeout(()=>t.hidden=true,3000)}
$('t_save').onclick=()=>{if(!sess.tg&&!sess.fs&&!sess.ga){toast('Nothing to save yet.');return}
  tglog.push({date:todayISO(),apt:sess.apt,rwy:sess.rwy,role:sess.role,tg:sess.tg,fs:sess.fs,ga:sess.ga,notes:sess.notes||''});S.set('tglog',tglog);
  sess={...sess,tg:0,fs:0,ga:0,start:null,notes:''};saveSess();renderTG();toast('Session saved to log.')};
let resetArm=0;$('t_reset').onclick=()=>{if(Date.now()-resetArm>3000){resetArm=Date.now();$('t_reset').textContent='Tap again to reset';setTimeout(()=>$('t_reset').textContent='Reset counters',3000);return}
  sess={...sess,tg:0,fs:0,ga:0,start:null};saveSess();renderTG();$('t_reset').textContent='Reset counters'};
let delArm=null;$('t_log').addEventListener('click',e=>{const b=e.target.closest('[data-del]');if(!b)return;const i=+b.dataset.del;
  if(delArm!==i){delArm=i;b.textContent='Delete?';setTimeout(()=>{delArm=null;if(b.isConnected)b.textContent='×'},3000);return}
  tglog.splice(i,1);S.set('tglog',tglog);delArm=null;renderTG()});
function download(name,text,type){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},500)}
$('t_csv').onclick=()=>{const q=v=>'"'+String(v).replace(/"/g,'""')+'"';
  download('landing-log-'+todayISO()+'.csv',['Date,Airport,Runway,Role,TouchAndGo,FullStop,GoAround,Notes',...tglog.map(l=>[l.date,l.apt,l.rwy,l.role,l.tg,l.fs,l.ga,q(l.notes||'')].join(','))].join('\n'),'text/csv')};

/* ---------- coordinates & route ---------- */
function parseCoord(s,isLat){
  s=String(s==null?'':s).trim().toUpperCase();if(!s)return NaN;
  let sign=/[SW]/.test(s)||/^-/.test(s)?-1:1;
  const p=s.replace(/[NSEW°'"′″-]/g,' ').trim().split(/\s+/).map(Number);
  if(!p.length||p.some(isNaN)||p.length>3)return NaN;
  const v=p[0]+(p[1]||0)/60+(p[2]||0)/3600;if(v>(isLat?90:180)||(p[1]||0)>=60)return NaN;return sign*v;
}
let wpts=S.get('route',[]);
function saveRoute(){S.set('route',wpts);drawRoute();updRouteBar()}
function addWpt(w){wpts.push(w);saveRoute()}
function gc(a,b){const p1=rad(a.lat),p2=rad(b.lat),dl=rad(b.lon-a.lon);
  const d=2*Math.asin(Math.sqrt(Math.sin((p2-p1)/2)**2+Math.cos(p1)*Math.cos(p2)*Math.sin(dl/2)**2))*3440.065;
  const tc=norm(deg(Math.atan2(Math.sin(dl)*Math.cos(p2),Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl))));return {d,tc}}
function legs(){
  const TAS=num($('n_tas').value),WD=num($('n_wd').value),WS=num($('n_ws').value)||0,vr=num($('n_var').value)||0;const out=[];
  for(let i=1;i<wpts.length;i++){const a=wpts[i-1],b=wpts[i];const {d,tc}=gc(a,b);let wca=NaN,gs=NaN;
    const tas=isFinite(num(b.tas))?num(b.tas):TAS,wd=isFinite(num(b.wd))?num(b.wd):WD,ws=isFinite(num(b.ws))?num(b.ws):WS;
    if(tas>0){const wdir=isFinite(wd)?wd:0;const x=ws*Math.sin(rad(wdir-tc))/tas;if(Math.abs(x)<1){wca=deg(Math.asin(x));gs=tas*Math.cos(rad(wca))-ws*Math.cos(rad(wdir-tc))}}
    out.push({a,b,i,d,tc,wca,th:tc+wca,mh:tc+wca-vr,gs,ete:d/gs*60,tas,wd,ws,vr})}
  return out;
}
function updRouteBar(){const L=legs();const d=L.reduce((s,l)=>s+l.d,0),t=L.reduce((s,l)=>s+l.ete,0);
  $('rb_pts').textContent=wpts.length+(wpts.length===1?' point':' points');$('rb_tot').textContent=L.length?d.toFixed(1)+' NM · '+fmtT(t):''}
function renderNav(){
  $('n_wpts').innerHTML=wpts.length?wpts.map((w,i)=>`<tr><td>${i+1}</td><td><input data-i="${i}" data-f="n" value="${esc(w.n)}"></td><td><input data-i="${i}" data-f="lat" value="${dm(w.lat,1)}"></td><td><input data-i="${i}" data-f="lon" value="${dm(w.lon,0)}"></td><td><button type="button" class="x" data-up="${i}" aria-label="Move up">↑</button><button type="button" class="x" data-rm="${i}" aria-label="Remove">×</button></td></tr>`).join(''):'<tr><td colspan="5" class="wrap" style="color:var(--muted)">No route yet. Plan one on the map, or add points from airport pages.</td></tr>';
  calcNav();
}
function calcNav(){if(window.PLAN)PLAN.renderLog(legs());updRouteBar()}

$('n_wpts').addEventListener('change',e=>{const t=e.target;if(t.dataset.i==null)return;const w=wpts[+t.dataset.i];
  if(t.dataset.f==='n')w.n=t.value.trim()||w.n;else{const v=parseCoord(t.value,t.dataset.f==='lat');if(!isFinite(v)){t.style.borderColor='var(--bad)';return}w[t.dataset.f]=v}
  saveRoute();renderNav()});
$('n_wpts').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.rm!=null)wpts.splice(+b.dataset.rm,1);else if(b.dataset.up!=null&&+b.dataset.up>0){const i=+b.dataset.up;[wpts[i-1],wpts[i]]=[wpts[i],wpts[i-1]]}else return;saveRoute();renderNav()});
['n_tas','n_wd','n_ws','n_var'].forEach(i=>$(i).addEventListener('input',()=>{calcNav();drawRoute()}));
$('n_map').onclick=()=>{go('map');setTimeout(()=>{setRouteMode(true);fitRoute()},120)};

/* ---------- map ---------- */
let map=null,layers={},enrL,othL,navL,avL,aiL,vrpL,routeL,ownL,routeMode=false,gpsWatch=null,firstFix=true;
const BASES={
  topo:{n:'Terrain',u:'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',o:{maxZoom:17,subdomains:'abc',attribution:'© OpenStreetMap contributors, SRTM · © OpenTopoMap (CC-BY-SA)'}},
  osm:{n:'Streets',u:'https://tile.openstreetmap.org/{z}/{x}/{y}.png',o:{maxZoom:19,attribution:'© OpenStreetMap contributors'}},
  sat:{n:'Satellite',u:'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',o:{maxZoom:18,attribution:'Imagery © Esri, Maxar, Earthstar Geographics'}}
};
function initMap(){
  if(map||!window.L)return;
  map=L.map('map',{zoomControl:false,attributionControl:true,worldCopyJump:true}).setView(S.get('mapc',[36.9,25.4]),S.get('mapz',7));
  L.control.zoom({position:'bottomright'}).addTo(map);L.control.scale({imperial:false,metric:true,position:'bottomleft'}).addTo(map);
  Object.entries(BASES).forEach(([k,b])=>layers[k]=L.tileLayer(b.u,b.o));
  setBase(S.get('base','topo'));
  $('m_base').innerHTML=Object.entries(BASES).map(([k,b])=>`<button type="button" data-b="${k}">${b.n}</button>`).join('');markBase();
  enrL=L.layerGroup();othL=L.layerGroup();vrpL=L.layerGroup();routeL=L.layerGroup().addTo(map);ownL=L.layerGroup().addTo(map);
  APTS.forEach(a=>{const m=L.marker([a.lat,a.lon],{icon:L.divIcon({className:'',html:`<div class="apt-ic"></div><span class="apt-lbl">${a.icao}</span>`,iconSize:[16,16],iconAnchor:[8,8]})});
    m.on('click',()=>{if(routeMode){addWpt({n:a.icao,lat:a.lat,lon:a.lon});return}
      m.bindPopup(aptPopup(a),{maxWidth:280}).openPopup()});enrL.addLayer(m);
    (a.rwys||[]).forEach(r=>{if(r.le_lat&&r.he_lat)enrL.addLayer(L.polyline([[r.le_lat,r.le_lon],[r.he_lat,r.he_lon]],{color:'#0b6e80',weight:4,opacity:.9,interactive:false}))});});
  OTHER.forEach(o=>{const m=L.marker([o[2],o[3]],{icon:L.divIcon({className:'',html:'<div class="oth-ic"></div>',iconSize:[10,10],iconAnchor:[5,5]})});
    m.bindTooltip(`${o[0]} · ${o[1]}`);m.on('click',()=>{if(routeMode)addWpt({n:o[0],lat:o[2],lon:o[3]})});othL.addLayer(m)});
  navL=L.layerGroup();
  NAVAIDS.forEach(n=>{const vor=/VOR|TACAN/.test(n[2]);const m=L.marker([n[4],n[5]],{icon:L.divIcon({className:'',html:vor?'<svg width="20" height="20" viewBox="0 0 20 20"><polygon points="10,2 17,6 17,14 10,18 3,14 3,6" fill="none" stroke="#1f5fc4" stroke-width="2"/><circle cx="10" cy="10" r="2" fill="#1f5fc4"/></svg>':'<svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7" fill="none" stroke="#8a2be2" stroke-width="2" stroke-dasharray="2 2"/><circle cx="9" cy="9" r="2" fill="#8a2be2"/></svg>',iconSize:[20,20],iconAnchor:[10,10]})});
    m.bindTooltip(`${esc(n[0])} ${esc(n[2])} ${esc(n[3])}${vor?' MHz':' kHz'}<br>${esc(n[1])}`);m.on('click',()=>{if(routeMode)addWpt({n:n[0],lat:n[4],lon:n[5]})});navL.addLayer(m)});
  avL=L.layerGroup();const seenV={};
  AVFR.forEach(v=>{const k=v[0]+v[1]+v[2];if(seenV[k]){seenV[k].push(v[3]);return}seenV[k]=[v[3]];
    const m=L.marker([v[1],v[2]],{icon:L.divIcon({className:'',html:`<div class="vrp-ic"></div><span class="pt-lbl vfr">${esc(v[0])}</span>`,iconSize:[16,14],iconAnchor:[8,10]})});
    m.bindTooltip(()=>`<b>${esc(v[0])}</b> · VFR (${seenV[k].join(', ')})<br>${dm(v[1],1)} ${dm(v[2],0)}`,{direction:'top'});m.on('click',()=>{if(routeMode)addWpt({n:v[0],lat:v[1],lon:v[2]})});avL.addLayer(m)});
  aiL=L.layerGroup();
  AIFR.forEach(p=>{const m=L.marker([p[1],p[2]],{icon:L.divIcon({className:'',html:`<svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,12 1,12" fill="#fff" stroke="#3a3a3a" stroke-width="1.6"/></svg><span class="pt-lbl ifr">${esc(p[0])}</span>`,iconSize:[14,14],iconAnchor:[7,8]})});
    m.bindTooltip(`<b>${esc(p[0])}</b> · ENR 4.4<br>${dm(p[1],1)} ${dm(p[2],0)}<br>${esc(p[3])}`,{direction:'top'});m.on('click',()=>{if(routeMode)addWpt({n:p[0],lat:p[1],lon:p[2]})});aiL.addLayer(m)});
  if(S.get('lyr_avfr',true))avL.addTo(map);$('m_avfr').checked=S.get('lyr_avfr',true);
  if(S.get('lyr_aifr',false))aiL.addTo(map);$('m_aifr').checked=S.get('lyr_aifr',false);
  const lbl=()=>{const z=map.getZoom(),c=map.getContainer().classList;c.toggle('lbl-off',z<9);c.toggle('pts-small',z<8)};map.on('zoomend',lbl);lbl();
  if(S.get('lyr_nav',false))navL.addTo(map);$('m_nav').checked=S.get('lyr_nav',false);
  if(S.get('lyr_enr',true))enrL.addTo(map);if(S.get('lyr_oth',false))othL.addTo(map);if(S.get('lyr_vrp',true))vrpL.addTo(map);
  $('m_enr').checked=S.get('lyr_enr',true);$('m_oth').checked=S.get('lyr_oth',false);$('m_vrp').checked=S.get('lyr_vrp',true);
  setupOaip();drawVRPs();drawRoute();updRouteBar();setTimeout(restoreOverlays,0);
  map.on('click',e=>{if(alignState&&alignState.step%2===1){alignMapClick(e.latlng);return}if(!routeMode)return;addWpt({n:'WP'+(wpts.length+1),lat:+e.latlng.lat.toFixed(5),lon:+e.latlng.lng.toFixed(5)})});
  map.on('moveend',()=>{const c=map.getCenter();S.set('mapc',[+c.lat.toFixed(4),+c.lng.toFixed(4)]);S.set('mapz',map.getZoom())});
  window._redraw=()=>{drawRoute()};
}
function aptPopup(a){const div=document.createElement('div');div.className='pop';
  div.innerHTML=`<b>${a.icao}</b> ${esc(a.name)}<div class="sub">${a.elev} ft · ${(a.rwys||[]).map(r=>r.le+'/'+r.he).join(', ')}</div>${a.freqs.slice(0,3).map(f=>`<div style="font-family:var(--mono);font-size:13px">${esc(f[0])} ${esc(f[1])}</div>`).join('')}<div class="r"><button type="button" data-a="open">Airport page</button><button type="button" data-a="add">Add to route</button></div>`;
  div.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.a==='open')go('apt-'+a.icao);else{addWpt({n:a.icao,lat:a.lat,lon:a.lon});b.textContent='Added'}});return div}
function setBase(k){if(!BASES[k])k='topo';Object.keys(BASES).forEach(b=>{if(map.hasLayer(layers[b]))map.removeLayer(layers[b])});layers[k].addTo(map);layers[k].bringToBack();S.set('base',k);markBase()}
function markBase(){const k=S.get('base','topo');document.querySelectorAll('#m_base button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.b===k))}
$('m_base').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setBase(b.dataset.b)});
function setupOaip(){
  const key=S.get('oaipkey','');if(layers.oaip&&map.hasLayer(layers.oaip))map.removeLayer(layers.oaip);layers.oaip=null;
  const cb=$('m_oaip'),hint=$('m_oaip_hint');
  if(!key){cb.checked=false;cb.disabled=true;hint.textContent='Add your API key in Settings.';return}
  cb.disabled=false;hint.textContent='';
  layers.oaip=L.tileLayer('https://api.tiles.openaip.net/api/data/openaip/{z}/{x}/{y}.png?apiKey='+encodeURIComponent(key),{maxZoom:19,maxNativeZoom:14,minZoom:4,opacity:1,zIndex:400,attribution:'Aviation data © openAIP (CC BY-NC 4.0)'});
  let errs=0;layers.oaip.on('tileerror',()=>{if(++errs===4)hint.textContent='openAIP tiles are failing. Check the key in Settings or your connection.'});
  layers.oaip.on('tileload',()=>{errs=0;hint.textContent=''});
  cb.checked=S.get('lyr_oaip',true);if(cb.checked)layers.oaip.addTo(map);
}
$('m_oaip').onchange=e=>{S.set('lyr_oaip',e.target.checked);if(!layers.oaip)return;e.target.checked?layers.oaip.addTo(map):map.removeLayer(layers.oaip)};
$('m_enr').onchange=e=>{S.set('lyr_enr',e.target.checked);e.target.checked?enrL.addTo(map):map.removeLayer(enrL)};
$('m_oth').onchange=e=>{S.set('lyr_oth',e.target.checked);e.target.checked?othL.addTo(map):map.removeLayer(othL)};
$('m_avfr').onchange=e=>{S.set('lyr_avfr',e.target.checked);e.target.checked?avL.addTo(map):map.removeLayer(avL)};
$('m_aifr').onchange=e=>{S.set('lyr_aifr',e.target.checked);e.target.checked?aiL.addTo(map):map.removeLayer(aiL)};
$('m_nav').onchange=e=>{S.set('lyr_nav',e.target.checked);e.target.checked?navL.addTo(map):map.removeLayer(navL)};
$('m_vrp').onchange=e=>{S.set('lyr_vrp',e.target.checked);e.target.checked?vrpL.addTo(map):map.removeLayer(vrpL)};
$('m_layers').onclick=()=>{const p=$('m_layerpanel');p.hidden=!p.hidden;$('m_layers').setAttribute('aria-expanded',!p.hidden)};
function drawVRPs(){if(!vrpL)return;vrpL.clearLayers();Object.entries(vrps).forEach(([ic,list])=>list.forEach(v=>{
  const m=L.marker([v.lat,v.lon],{icon:L.divIcon({className:'',html:'<div class="vrp-ic"></div>',iconSize:[16,14],iconAnchor:[8,10]})});
  m.bindTooltip(`${esc(v.n)} (${ic})`,{direction:'top'});m.on('click',()=>{if(routeMode)addWpt({n:v.n,lat:v.lat,lon:v.lon})});vrpL.addLayer(m)}))}
function drawRoute(){
  if(!routeL)return;routeL.clearLayers();if(!wpts.length)return;
  const rc=getComputedStyle(document.documentElement).getPropertyValue('--route').trim()||'#ff4fd2';
  routeL.addLayer(L.polyline(wpts.map(w=>[w.lat,w.lon]),{color:'#000',weight:7,opacity:.35,interactive:false}));
  routeL.addLayer(L.polyline(wpts.map(w=>[w.lat,w.lon]),{color:rc,weight:4,opacity:1,interactive:false}));
  legs().forEach(l=>{const mid=[(l.a.lat+l.b.lat)/2,(l.a.lon+l.b.lon)/2];
    routeL.addLayer(L.marker(mid,{interactive:false,icon:L.divIcon({className:'',html:`<span class="apt-lbl" style="transform:translate(-50%,-50%);background:${rc};color:#fff">${p3(isFinite(l.mh)?l.mh:l.tc)}° ${l.d.toFixed(0)}nm</span>`,iconSize:[0,0]})}))});
  wpts.forEach((w,i)=>{const m=L.marker([w.lat,w.lon],{draggable:true,icon:L.divIcon({className:'',html:'<div class="wp-ic"></div>',iconSize:[16,16],iconAnchor:[8,8]})});
    m.bindTooltip(`${i+1} ${esc(w.n)}`,{direction:'right',offset:[10,0]});
    m.on('dragend',()=>{const p=m.getLatLng();w.lat=+p.lat.toFixed(5);w.lon=+p.lng.toFixed(5);saveRoute()});routeL.addLayer(m)});
}
function fitRoute(){if(map&&wpts.length>1)map.fitBounds(L.latLngBounds(wpts.map(w=>[w.lat,w.lon])).pad(.2))}
function setRouteMode(on){routeMode=on;$('m_route').setAttribute('aria-pressed',on);$('m_routebar').hidden=!on;if(map)map.getContainer().style.cursor=on?'crosshair':'';updRouteBar()}
$('m_route').onclick=()=>setRouteMode(!routeMode);
$('rb_undo').onclick=()=>{wpts.pop();saveRoute()};
let clrArm=0;$('rb_clear').onclick=()=>{if(Date.now()-clrArm>3000){clrArm=Date.now();$('rb_clear').textContent='Tap again';setTimeout(()=>$('rb_clear').textContent='Clear',3000);return}wpts=[];saveRoute();$('rb_clear').textContent='Clear'};
$('rb_log').onclick=()=>go('nav');
/* search */
$('m_search').addEventListener('input',()=>{const q=$('m_search').value.trim().toUpperCase();const r=$('m_results');if(q.length<2){r.hidden=true;return}
  const hits=[...APTS.map(a=>[a.icao,a.name,a.lat,a.lon]),...OTHER,...NAVAIDS.map(n=>[n[0],n[1]+' '+n[2],n[4],n[5]]),...AVFR.map(v=>[v[0],'VFR point · '+v[3],v[1],v[2]]),...AIFR.map(p=>[p[0],'IFR/RNAV point',p[1],p[2]])].filter(o=>o[0].includes(q)||o[1].toUpperCase().includes(q)).slice(0,8);
  r.innerHTML=hits.map(h=>`<button type="button" data-ll="${h[2]},${h[3]}" data-i="${h[0]}"><b>${esc(h[0])}</b> ${esc(h[1])}</button>`).join('')||'<div class="sub" style="padding:10px">No match</div>';r.hidden=false});
$('m_results').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const [la,lo]=b.dataset.ll.split(',').map(Number);map.setView([la,lo],12);$('m_results').hidden=true;$('m_search').value='';$('m_search').blur()});
/* GPS */
$('m_gps').onclick=()=>{
  if(gpsWatch!=null){navigator.geolocation.clearWatch(gpsWatch);gpsWatch=null;ownL.clearLayers();$('m_gpsbar').hidden=true;$('m_gps').setAttribute('aria-pressed',false);return}
  if(!navigator.geolocation){alertMsg('This device has no location service.');return}
  firstFix=true;$('m_gps').setAttribute('aria-pressed',true);$('m_gpsbar').hidden=false;
  gpsWatch=navigator.geolocation.watchPosition(p=>{const c=p.coords;ownL.clearLayers();
    const hd=isFinite(c.heading)&&c.heading!=null?c.heading:0;
    ownL.addLayer(L.circle([c.latitude,c.longitude],{radius:c.accuracy,color:'#36c5d8',weight:1,fillOpacity:.08,interactive:false}));
    ownL.addLayer(L.marker([c.latitude,c.longitude],{interactive:false,icon:L.divIcon({className:'own-ic',iconSize:[34,34],iconAnchor:[17,17],html:`<svg width="34" height="34" viewBox="0 0 34 34" style="transform:rotate(${hd}deg)"><path d="M17 3 L20 14 L31 18 L31 20 L20 19 L19 27 L23 30 L23 31 L17 30 L11 31 L11 30 L15 27 L14 19 L3 20 L3 18 L14 14 Z" fill="#ffd400" stroke="#000" stroke-width="1.2"/></svg>`})}));
    $('g_gs').textContent=c.speed!=null&&isFinite(c.speed)?(c.speed*1.94384).toFixed(0):'—';
    $('g_trk').textContent=c.heading!=null&&isFinite(c.heading)&&c.speed>1?p3(c.heading):'—';
    $('g_alt').textContent=c.altitude!=null?Math.round(m2ft(c.altitude)).toLocaleString('en'):'—';
    $('g_acc').textContent=Math.round(c.accuracy);
    if(firstFix){map.setView([c.latitude,c.longitude],Math.max(map.getZoom(),11));firstFix=false}
  },err=>{$('g_acc').textContent='—';alertMsg(err.code===1?'Location permission was refused. Allow it in your browser settings.':'No GPS fix yet.')},{enableHighAccuracy:true,maximumAge:2000,timeout:20000});
};
function alertMsg(m){const h=$('m_oaip_hint');const d=document.createElement('div');d.className='sheet';d.style.cssText='left:50%;transform:translateX(-50%);top:calc(var(--sat) + 120px);max-width:90%';d.textContent=m;$('v-map').appendChild(d);setTimeout(()=>d.remove(),4000)}

/* ---------- briefing ---------- */
const today=todayISO();
let ticks=S.get('ticks',{});if(ticks._d!==today)ticks={_d:today};
const NOTAM=[
 ['n_ad','Aerodrome NOTAMs: departure, destination, alternate','https://www.ead.eurocontrol.int/','EUROCONTROL EAD Basic (free registration)'],
 ['n_fir','Athinai FIR NOTAMs, danger and restricted areas','https://www.ead.eurocontrol.int/','EAD Basic: narrow-route PIB for your route'],
 ['n_alt','Cross-check NOTAMs','https://notams.aim.faa.gov/notamSearch/','FAA NOTAM Search, international ICAO locations'],
 ['n_aip','AIP Greece AD 2 charts current','https://www.ead.eurocontrol.int/','EAD Basic AIP library, or the Greek AIS'],
 ['n_awg','Aero WebGIS route check','http://www.aopa.gr/awg','AOPA Hellas: airspace, VRPs, PPR and fuel'],
];
const WXCHARTS=[
 ['c_swc','Significant weather chart','https://aviationweather.gov/sigwx','aviationweather.gov. Low-level SWC from your national met service'],
 ['c_wind','Winds and temperatures aloft','https://aviationweather.gov/gfa','aviationweather.gov'],
 ['c_msl','Surface pressure analysis','https://www.hnms.gr/','Hellenic National Meteorological Service'],
 ['c_sig','SIGMETs for the Athinai FIR','https://aviationweather.gov/sigmet/intl','aviationweather.gov international SIGMETs'],
];
function chkList(list){return list.map(([id,t,u,s])=>`<label class="chk"><input type="checkbox" data-t="${id}" ${ticks[id]?'checked':''}><span class="grow"><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a><span class="src">${esc(s)}</span></span></label>`).join('')}
let custom=S.get('custom',[]);
function renderBrief(){$('b_notam').innerHTML=chkList(NOTAM);$('b_charts').innerHTML=chkList(WXCHARTS);
  $('b_custom').innerHTML=custom.length?custom.map((c,i)=>`<label class="chk"><input type="checkbox" data-t="u${i}" ${ticks['u'+i]?'checked':''}><span class="grow"><a href="${esc(c.u)}" target="_blank" rel="noopener">${esc(c.n)}</a><span class="src">${esc(c.u)}</span></span><button type="button" class="x" data-cdel="${i}" aria-label="Remove link">×</button></label>`).join(''):'<p class="empty">Add your Greek AIS, met office or school portal.</p>';countBrief()}
function countBrief(){const bx=[...document.querySelectorAll('#v-brief [data-t]')];const n=bx.filter(b=>b.checked).length;$('b_count').textContent=n+'/'+bx.length;const ok=n&&n===bx.length;$('b_pill').className='pill '+(ok?'good':'warn');$('b_pill').textContent=ok?'Reviewed':'Incomplete'}
$('v-brief').addEventListener('change',e=>{const t=e.target.dataset.t;if(!t)return;ticks[t]=e.target.checked;S.set('ticks',ticks);countBrief()});
$('b_custom').addEventListener('click',e=>{const b=e.target.closest('[data-cdel]');if(!b)return;e.preventDefault();custom.splice(+b.dataset.cdel,1);S.set('custom',custom);renderBrief()});
$('b_cadd').onclick=()=>{const n=$('b_cname').value.trim(),u=$('b_curl').value.trim();if(!n||!/^https?:\/\//i.test(u)){$('b_curl').style.borderColor='var(--bad)';return}$('b_curl').style.borderColor='';custom.push({n,u});S.set('custom',custom);$('b_cname').value=$('b_curl').value='';renderBrief()};
$('b_reset').onclick=()=>{ticks={_d:today};S.set('ticks',ticks);renderBrief()};
$('b_load').onclick=async()=>{const ids=['b_dep','b_dst','b_alt'].map(i=>$(i).value.trim().toUpperCase()).filter(Boolean);
  if(!ids.length){$('b_wxout').innerHTML='<p class="sub">Enter at least one aerodrome.</p>';return}
  $('b_wxout').innerHTML='<p class="sub">Loading…</p>';
  try{const w=await getWx(ids);$('b_wxout').innerHTML=ids.map(i=>wxBlock(i,w[i])).join('')}catch(e){$('b_wxout').innerHTML=wxFail(ids)}};
['b_dep','b_dst','b_alt'].forEach(i=>$(i).addEventListener('input',e=>e.target.value=e.target.value.toUpperCase()));

/* persist simple fields */
document.querySelectorAll('#v-brief input[id],#v-tools input[id],#v-nav .fields input[id],#v-risk input[id]').forEach(i=>{if(['b_cname','b_curl'].includes(i.id))return;
  const v=S.get('f.'+i.id,null);if(v!=null)i.value=v;i.addEventListener('input',()=>S.set('f.'+i.id,i.value))});
if(S.get('f.b_date',null)==null||S.get('f.b_date')<today)$('b_date').value=today;

/* ---------- calculators ---------- */
function ro(k,v,u,cls){return `<div class="ro"><div class="k">${k}</div><div class="v"${cls?` style="color:var(--${cls})"`:''}>${v}${u?`<small> ${u}</small>`:''}</div></div>`}
function rwyHdg(s){s=String(s).trim().toUpperCase().replace(/[LRC]$/,'');const n=num(s);if(!isFinite(n))return NaN;return s.length<=2?n*10:n}
function drawWind(){
  const rh=rwyHdg($('w_rwy').value),d=num($('w_dir').value),s=num($('w_spd').value),g=num($('w_gst').value),lim=num($('w_lim').value);
  if([rh,d,s].some(v=>!isFinite(v))){$('w_out').innerHTML='<p class="sub">Enter runway, wind direction and speed.</p>';$('w_svg').innerHTML='';return}
  const c=comps(d,s,rh),cg=isFinite(g)?comps(d,g,rh):null;const xm=Math.abs(cg?cg.xw:c.xw);const over=isFinite(lim)&&xm>lim;
  $('w_out').innerHTML=ro(c.hw>=0?'Headwind':'Tailwind',Math.abs(c.hw).toFixed(0),'kt',c.hw<0?'bad':null)+ro('Crosswind '+(c.xw>=0?'R':'L'),Math.abs(c.xw).toFixed(0),'kt',over?'bad':null)+
    (cg?ro('Gust crosswind',Math.abs(cg.xw).toFixed(0),'kt',over?'bad':null):'')+(isFinite(lim)?`<div class="ro"><div class="k">Limit</div><div class="v"><span class="pill ${over?'bad':'good'}">${over?'Over':'Within'}</span></div></div>`:'');
  const cs=getComputedStyle(document.documentElement),fg=cs.getPropertyValue('--fg'),mu=cs.getPropertyValue('--muted'),ac=cs.getPropertyValue('--accent'),ln=cs.getPropertyValue('--line');
  const wa=rad(d-rh),sx=Math.sin(wa),cy=Math.cos(wa);
  $('w_svg').innerHTML=`<circle cx="100" cy="100" r="82" fill="none" stroke="${ln}"/><rect x="88" y="34" width="24" height="132" rx="2" fill="${mu}" opacity=".3"/>
   <line x1="100" y1="44" x2="100" y2="156" stroke="${fg}" stroke-dasharray="7 6" opacity=".7"/>
   <text x="100" y="160" text-anchor="middle" font-size="13" font-weight="700" fill="${fg}">${String(Math.round(norm(rh)/10)||36).padStart(2,'0')}</text>
   <line x1="${100+74*sx}" y1="${100-74*cy}" x2="${100+20*sx}" y2="${100-20*cy}" stroke="${ac}" stroke-width="3"/>
   <polygon points="${100+20*sx},${100-20*cy} ${100+34*sx+7*cy},${100-34*cy+7*sx} ${100+34*sx-7*cy},${100-34*cy-7*sx}" fill="${ac}"/>
   <text x="${100+90*sx}" y="${104-90*cy}" text-anchor="middle" font-size="11" fill="${ac}">${p3(d)}/${s}</text>`;
}
['w_rwy','w_dir','w_spd','w_gst','w_lim'].forEach(i=>$(i).addEventListener('input',drawWind));
function calcDA(){const e=num($('d_elev').value),q=num($('d_qnh').value),t=num($('d_oat').value);
  if([e,q,t].some(v=>!isFinite(v))){$('d_out').innerHTML='<p class="sub">Enter elevation, QNH and OAT.</p>';return}
  const pa=e+(1013.25-q)*27,isa=15-2*pa/1000,dev=t-isa,da=pa+120*dev;
  $('d_out').innerHTML=ro('Pressure alt',Math.round(pa).toLocaleString('en'),'ft')+ro('ISA dev',(dev>=0?'+':'')+dev.toFixed(1),'°C',dev>15?'warn':null)+ro('Density alt',Math.round(da).toLocaleString('en'),'ft',da-e>2000?'warn':null)}
['d_elev','d_qnh','d_oat'].forEach(i=>$(i).addEventListener('input',calcDA));

/* ---------- risk ---------- */
const IMS=['Illness: any symptoms, even mild','Medication: anything that could affect performance','Stress: significant pressure at work or home','Alcohol: within 8 hours, or still affected','Fatigue: under 8 hours sleep, or tired','Eating: not eaten or not hydrated'];
const RISK=[
 ['Pilot','Hours on DA40 in last 90 days',[['More than 10',0],['3 to 10',2],['Fewer than 3',4]]],
 ['Pilot','Flight type',[['Dual with instructor',0],['Solo, local circuits',2],['Solo cross-country',4]]],
 ['Pilot','Last flight',[['Within 14 days',0],['15 to 30 days',2],['More than 30 days',4]]],
 ['Aircraft','Open defects or deferred items',[['None',0],['Minor, signed off',2],['Unsure',5]]],
 ['Aircraft','Fuel at landing vs required reserve',[['30+ min extra',0],['Up to 30 min extra',2],['Reserve only',5]]],
 ['Environment','Ceiling vs your minimums',[['1000+ ft above',0],['Within 1000 ft',3],['At or below',6]]],
 ['Environment','Visibility',[['10 km or more',0],['5 to 10 km',3],['Below 5 km',6]]],
 ['Environment','Crosswind vs your limit',[['Under half',0],['Half to limit',3],['Gusts near limit',5]]],
 ['Environment','Meltemi or mountain-wave turbulence',[['None forecast',0],['Moderate winds',2],['Strong / warnings',6]]],
 ['Environment','Over water beyond gliding distance',[['No',0],['Short crossings',2],['Extended crossing',5]]],
 ['Environment','Aerodromes',[['All familiar',0],['One unfamiliar',2],['Unfamiliar and short',4]]],
 ['Environment','Daylight at planned landing',[['More than 1 hour',0],['30 to 60 min',2],['Under 30 min',5]]],
 ['External','Time pressure',[['None',0],['Some',2],['Must arrive on time',4]]],
];
let rk=S.get('risk',{});
$('k_imsafe').innerHTML=IMS.map((t,i)=>`<label class="chk"><input type="checkbox" data-im="${i}" ${rk['im'+i]?'checked':''}><span class="grow">${esc(t)}</span></label>`).join('');
let cat='';$('k_items').innerHTML=RISK.map(([c,q,o],i)=>{const h=c!==cat?(cat=c,`<h2 style="margin-top:${i?18:0}px">${c}</h2>`):'';
  return h+`<div class="risk"><span>${esc(q)}</span><select data-rk="${i}" aria-label="${esc(q)}">${o.map(([t,p],j)=>`<option value="${j}" ${(rk['r'+i]||0)==j?'selected':''}>${esc(t)} · ${p}</option>`).join('')}</select></div>`}).join('');
function score(){let tot=0;RISK.forEach((r,i)=>tot+=r[2][rk['r'+i]||0][1]);const im=IMS.some((_,i)=>rk['im'+i]);const t1=num($('k_t1').value)||11,t2=num($('k_t2').value)||21;
  let c='good',l='Go',m='Within limits. Brief as normal.';
  if(tot>=t1){c='warn';l='Caution';m='Talk it through with your instructor and reduce the highest-scoring items first.'}
  if(tot>=t2){c='bad';l='No-go';m='Do not fly as planned. Change the plan or postpone.'}
  if(im){c='bad';l='No-go';m='An IMSAFE item is ticked. You are not fit to fly today.'}
  $('k_total').textContent=tot;$('k_pill').className='pill '+c;$('k_pill').textContent=l;$('k_msg').textContent=m}
$('v-risk').addEventListener('change',e=>{const t=e.target;if(t.dataset.im!=null)rk['im'+t.dataset.im]=t.checked;else if(t.dataset.rk!=null)rk['r'+t.dataset.rk]=+t.value;else return;S.set('risk',rk);score()});
['k_t1','k_t2'].forEach(i=>$(i).addEventListener('input',score));
$('k_reset').onclick=()=>{rk={};S.set('risk',rk);document.querySelectorAll('[data-im]').forEach(b=>b.checked=false);document.querySelectorAll('[data-rk]').forEach(s=>s.value=0);score()};

/* ---------- settings ---------- */
function keyStat(){const k=S.get('oaipkey','');$('s_keystat').textContent=k?'Key saved ('+k.slice(0,4)+'…). Turn on the openAIP layer from Layers on the map.':'No key saved.'}
$('s_keysave').onclick=()=>{const k=$('s_key').value.trim();if(!k)return;S.set('oaipkey',k);S.set('lyr_oaip',true);$('s_key').value='';keyStat();if(map)setupOaip()};
$('s_keyclear').onclick=()=>{S.set('oaipkey','');keyStat();if(map)setupOaip()};
const BK=['tglog','sess','circ','vrps','route','custom','risk','theme','base'];
$('s_export').onclick=()=>{const o={app:'da40d-efb',v:1,exported:new Date().toISOString()};BK.forEach(k=>o[k]=S.get(k,null));download('efb-backup-'+todayISO()+'.json',JSON.stringify(o,null,1),'application/json');$('s_bstat').textContent='Backup exported. The openAIP key is not included.'};
$('s_import').onchange=e=>{const f=e.target.files[0];if(!f)return;const r=new FileReader();r.onload=()=>{try{const o=JSON.parse(r.result);if(o.app!=='da40d-efb')throw 0;BK.forEach(k=>{if(o[k]!=null)S.set(k,o[k])});$('s_bstat').textContent='Backup restored. Reloading…';setTimeout(()=>location.reload(),800)}catch(x){$('s_bstat').textContent='That file is not a flight bag backup.'}};r.readAsText(f)};


/* ---------- charts ---------- */
const CHARTS=window.EFB_CHARTS||{};
const GROUPS=[['Visual',['VFR','VAC']],['Aerodrome',['ADC','APDC','AOC','PATC']],['Departures',['SID']],['Arrivals',['STAR']],['Approaches',['IAC']],['Other',['ASMAC']]];
function renderAptCharts(icao){
  const box=$('ap_charts');if(!box)return;const c=CHARTS[icao];
  if(!c){box.innerHTML='<h2>Charts</h2><p class="empty">No AIP charts for this aerodrome.</p>';return}
  const used=new Set();
  const grp=GROUPS.map(([g,ts])=>{const l=c.charts.filter(x=>ts.includes(x.t));l.forEach(x=>used.add(x.k));return [g,l]}).filter(x=>x[1].length);
  const rest=c.charts.filter(x=>!used.has(x.k));if(rest.length)grp.push(['Other',rest]);
  box.innerHTML=`<div class="row between"><h2 style="margin:0">Charts · AIP</h2><div class="row">${c.pdf?`<a class="btn" href="charts/${c.pdf}" target="_blank" rel="noopener">AD 2 text (PDF)</a>`:''}<button type="button" id="ch_off">Save for offline</button></div></div>
   <p class="sub">${esc(AIRAC)}. ◎ = already aligned to the map.</p>
   ${grp.map(([g,l])=>`<h3>${g}</h3><div class="chips">${l.map(x=>`<button type="button" class="chip" data-ck="${esc(x.k)}">${esc(x.n)}${x.p.some(p=>p.geo||S.get('geo.'+icao+'/'+p.f,null))?' ◎':''}</button>`).join('')}</div>`).join('')}`;
  box.onclick=e=>{const b=e.target.closest('[data-ck]');if(b)openChart(icao,b.dataset.ck,0);if(e.target.id==='ch_off')saveOffline(icao,e.target)};
}
async function saveOffline(icao,btn){
  const c=CHARTS[icao];const urls=c.charts.flatMap(x=>x.p.map(p=>`charts/${icao}/${p.f}`));if(c.pdf)urls.push('charts/'+c.pdf);
  if(!('caches' in window)){btn.textContent='Not supported here';return}
  try{const cache=await caches.open('efb-charts-v1');let n=0;
    for(const u of urls){if(!(await cache.match(u))){const r=await fetch(u);if(r.ok)await cache.put(u,r)}btn.textContent=`Saving ${++n}/${urls.length}`}
    btn.textContent='Saved offline ✓'}catch(e){btn.textContent='Save failed, check connection'}
}
let cv=null,cvImg=null,cvCur=null,cvRot=0;
function chartGeo(icao,p){return p.geo||S.get('geo.'+icao+'/'+p.f,null)}
function openChart(icao,key,pg){
  const c=CHARTS[icao].charts.find(x=>x.k===key);if(!c)return;pg=Math.max(0,Math.min(pg,c.p.length-1));cvCur={icao,key,pg,c};
  const p=c.p[pg];$('cv').hidden=false;$('cv_ovl').hidden=false;
  $('cv_title').textContent=icao+' · '+c.n;$('cv_sub').textContent=chartGeo(icao,p)?' · aligned to map':'';
  $('cv_pg').textContent=c.p.length>1?`${pg+1}/${c.p.length}`:'';$('cv_prev').hidden=$('cv_next').hidden=c.p.length<2;
  if(!cv){cv=L.map('cv_map',{crs:L.CRS.Simple,minZoom:-4,maxZoom:3,zoomSnap:.25,attributionControl:false,zoomControl:false});L.control.zoom({position:'bottomright'}).addTo(cv);
    cv.on('click',e=>{if(alignState&&alignState.step%2===0)alignChartClick(e.latlng)})}
  if(cvImg)cv.removeLayer(cvImg);
  const b=[[-p.h,0],[0,p.w]];cvImg=L.imageOverlay(`charts/${icao}/${p.f}`,b).addTo(cv);
  setTimeout(()=>{cv.invalidateSize();cv.fitBounds(b)},30);
}
$('cv_close').onclick=()=>{$('cv').hidden=true;if(alignState){alignState=null;$('cv_hint').hidden=true}};
$('cv_prev').onclick=()=>cvCur&&openChart(cvCur.icao,cvCur.key,cvCur.pg-1);
$('cv_next').onclick=()=>cvCur&&openChart(cvCur.icao,cvCur.key,cvCur.pg+1);
$('cv_ovl').onclick=()=>{if(!cvCur)return;const {icao,c,pg}=cvCur;const p=c.p[pg];
  if(chartGeo(icao,p)){$('cv').hidden=true;go('map');setTimeout(()=>{addOverlay(icao,c.k,pg);fitOverlay(icao+'/'+p.f)},250);return}
  alignState={icao,key:c.k,pg,p,step:0,pts:[]};
  $('cv_hint').hidden=false;$('cv_hint').textContent='Align step 1 of 4: tap a point you can identify exactly on the chart (runway threshold, VRP, island tip).';};
/* alignment: chart pt1 -> map pt1 -> chart pt2 -> map pt2 */
let alignState=null;
function alignChartClick(ll){const s=alignState;s.pts.push({px:ll.lng,py:-ll.lat});s.step++;
  L.circleMarker(ll,{radius:8,color:'#ff4fd2',weight:3}).addTo(cv);
  $('cv').hidden=true;go('map');$('m_alignbar').hidden=false;$('al_msg').textContent=`Align step ${s.step+1} of 4: tap the same point on the map. Zoom in for accuracy.`}
function alignMapClick(ll){const s=alignState;s.pts[s.pts.length-1].ll=ll;s.step++;$('m_alignbar').hidden=true;
  if(s.step<4){$('cv').hidden=false;$('cv_hint').hidden=false;$('cv_hint').textContent='Align step 3 of 4: tap a second point on the chart, as far from the first as possible.';setTimeout(()=>cv.invalidateSize(),30);return}
  const g=solve2(s.pts,s.p.w,s.p.h);if(!g){$('al_msg').textContent='The two points are too close. Try again.';alignState=null;return}
  S.set('geo.'+s.icao+'/'+s.p.f,g);alignState=null;$('cv_hint').hidden=true;addOverlay(s.icao,s.key,s.pg);renderAptCharts&&0;
  setTimeout(()=>fitOverlay(s.icao+'/'+s.p.f),200)}
$('al_cancel').onclick=()=>{alignState=null;$('m_alignbar').hidden=true;$('cv_hint').hidden=true};
const R=6378137;
const merc=ll=>[rad(ll.lng)*R,Math.log(Math.tan(Math.PI/4+rad(ll.lat)/2))*R];
const unmerc=(x,y)=>[+(deg(2*Math.atan(Math.exp(y/R))-Math.PI/2)).toFixed(6),+deg(x/R).toFixed(6)];
function solve2(pts,w,h){/* similarity transform, chart px (y down) -> mercator */
  const [a,b]=pts;const p1=[a.px,-a.py],p2=[b.px,-b.py],m1=merc(a.ll),m2=merc(b.ll);
  const dp=[p2[0]-p1[0],p2[1]-p1[1]],dm=[m2[0]-m1[0],m2[1]-m1[1]];const den=dp[0]**2+dp[1]**2;if(Math.sqrt(den)<40)return null;
  const s=[(dm[0]*dp[0]+dm[1]*dp[1])/den,(dm[1]*dp[0]-dm[0]*dp[1])/den];
  const T=(x,y)=>{const q=[x-p1[0],-y-p1[1]];return unmerc(m1[0]+s[0]*q[0]-s[1]*q[1],m1[1]+s[1]*q[0]+s[0]*q[1])};
  return [T(0,0),T(w,0),T(0,h)];
}
/* affine image overlay on the main map */
const AffineImage=L.Layer.extend({
  initialize(url,geo,w,h,op){this.url=url;this.geo=geo;this.w=w;this.h=h;this.op=op},
  onAdd(m){this._m=m;const i=this._img=L.DomUtil.create('img','chart-ovl');i.src=this.url;i.style.width=this.w+'px';i.style.height=this.h+'px';i.style.opacity=this.op;
    m.getPane('overlayPane').appendChild(i);m.on('zoomend viewreset moveend',this._up,this);m.on('zoomstart',this._hide,this);this._up()},
  onRemove(m){this._img.remove();m.off('zoomend viewreset moveend',this._up,this);m.off('zoomstart',this._hide,this)},
  _hide(){this._img.style.visibility='hidden'},
  _up(){const m=this._m,[tl,tr,bl]=this.geo.map(g=>m.latLngToLayerPoint(g));
    const a=(tr.x-tl.x)/this.w,b=(tr.y-tl.y)/this.w,c=(bl.x-tl.x)/this.h,d=(bl.y-tl.y)/this.h;
    this._img.style.transform=`matrix(${a},${b},${c},${d},${tl.x},${tl.y})`;this._img.style.visibility=''},
  setOpacity(o){this.op=o;if(this._img)this._img.style.opacity=o}
});
const ovls={};
function addOverlay(icao,key,pg){const c=CHARTS[icao].charts.find(x=>x.k===key);const p=c.p[pg];const id=icao+'/'+p.f;const g=chartGeo(icao,p);if(!g||!map)return;
  if(ovls[id])map.removeLayer(ovls[id].l);
  const st=S.get('ovl',{});const op=st[id]?st[id].op:.75;
  ovls[id]={l:new AffineImage(`charts/${icao}/${p.f}`,g,p.w,p.h,op).addTo(map),n:icao+' '+c.n+(c.p.length>1?' p'+(pg+1):''),icao,key,pg};
  st[id]={icao,key,pg,op};S.set('ovl',st);renderOvlList()}
function fitOverlay(id){const o=ovls[id];if(o&&map)map.fitBounds(L.latLngBounds(o.l.geo).pad(-.05))}
function renderOvlList(){const el=$('m_ovl');const ids=Object.keys(ovls);
  el.innerHTML=ids.length?ids.map(id=>`<div class="ovlrow"><span>${esc(ovls[id].n)}</span><input type="range" min="0.15" max="1" step="0.05" value="${ovls[id].l.op}" data-op="${esc(id)}" aria-label="Opacity"><button type="button" class="x" data-fit="${esc(id)}" title="Zoom to chart">⤢</button><button type="button" class="x" data-rm="${esc(id)}" aria-label="Remove overlay">×</button></div>`).join('')+'<p class="sub">Alignment is approximate. Never use an overlay for navigation.</p>':'<p class="sub">Open a chart from an airport page and choose Overlay on map.</p>'}
$('m_ovl').addEventListener('input',e=>{const id=e.target.dataset.op;if(!id)return;ovls[id].l.setOpacity(+e.target.value);const st=S.get('ovl',{});if(st[id]){st[id].op=+e.target.value;S.set('ovl',st)}});
$('m_ovl').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.fit)fitOverlay(b.dataset.fit);
  if(b.dataset.rm){const id=b.dataset.rm;map.removeLayer(ovls[id].l);delete ovls[id];const st=S.get('ovl',{});delete st[id];S.set('ovl',st);renderOvlList()}});
function restoreOverlays(){const st=S.get('ovl',{});Object.values(st).forEach(o=>{try{addOverlay(o.icao,o.key,o.pg)}catch(e){}})}

function viewImage(url,w,h,title){cvCur=null;$('cv').hidden=false;$('cv_ovl').hidden=true;$('cv_title').textContent=title;$('cv_sub').textContent='';$('cv_pg').textContent='';$('cv_prev').hidden=$('cv_next').hidden=true;
  if(!cv){cv=L.map('cv_map',{crs:L.CRS.Simple,minZoom:-4,maxZoom:3,zoomSnap:.25,attributionControl:false,zoomControl:false});L.control.zoom({position:'bottomright'}).addTo(cv);cv.on('click',e=>{if(alignState&&alignState.step%2===0)alignChartClick(e.latlng)})}
  if(cvImg)cv.removeLayer(cvImg);const b=[[-h,0],[0,w]];cvImg=L.imageOverlay(url,b).addTo(cv);setTimeout(()=>{cv.invalidateSize();cv.fitBounds(b)},30)}
window.EFB={viewImage,getWx,get wpts(){return wpts},legs,S,BY,APTS,NAVAIDS,esc,num,p3,fmtT,go,todayISO,dm,saveRoute,gc,calcNav,
  get ownPos(){return window._ownPos||null}};
/* ---------- boot ---------- */
renderBrief();drawWind();calcDA();score();keyStat();
route();
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('sw.js').catch(()=>{});
})();
