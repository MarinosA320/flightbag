/* Preflight pack: the school's own pages (Student Preflight Checklist and Guide, DA40 D AFM extracts)
   reproduced as page images, with the student's values written on top, plus the CEA-OPS-06 navlog. */
(function(){
'use strict';
const E=window.EFB,P=window.PLAN;if(!E||!P)return;
const $=id=>document.getElementById(id),esc=E.esc,num=E.num;
const PE=window.PerfEngine&&window.EFB_PERF?window.PerfEngine(window.EFB_PERF):null;
const TR=(window.EFB_PERF||{}).tr||{};
const W=841.92,H=595.32,INK='#1537a8';
const f1=v=>isFinite(v)?(Math.round(v*10)/10).toString():'',f2=v=>isFinite(v)?(Math.round(v*100)/100).toFixed(2):'';
const fmt=v=>isFinite(v)?Math.round(v).toLocaleString('en'):'';
const date=()=>(P.NL.date||E.todayISO()).split('-').reverse().join('/');

function page(n,svg){return `<section class="ppage"><img src="afm/pack/p${n}.webp" alt=""><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
  <defs><marker id="ah${n}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${INK}"/></marker></defs>${svg||''}</svg></section>`}
const T=(x,y,s,o={})=>`<text x="${x}" y="${y}" font-size="${o.fs||9}" fill="${INK}" font-weight="${o.w||700}" text-anchor="${o.a||'middle'}" dominant-baseline="${o.b||'middle'}" font-family="Arial,Helvetica,sans-serif"${o.tr?` transform="${o.tr}"`:''}>${esc(s)}</text>`;
const pl=(pts,o={})=>`<polyline points="${pts.map(p=>p[0].toFixed(1)+','+p[1].toFixed(1)).join(' ')}" fill="none" stroke="${INK}" stroke-width="${o.sw||1.6}" vector-effect="non-scaling-stroke"${o.dash?' stroke-dasharray="6 4"':''}${o.arrow?` marker-end="url(#ah${o.arrow})"`:''}/>`;
const tick=(x,y)=>`<path d="M${x-4},${y} l3,3.5 l6,-8" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>`;
function chartG(name,inner){const t=TR[name];if(!t)return'';return `<g transform="matrix(${t.m.join(',')})">${inner}</g>`}

/* page 1: Student preflight checklist */
function p1(){const st=E.S.get('pp',{t:'dual',c:{}});
  const R={dual:{x:54,ys:[490,538,584,624,703],hx:[89,562,390,455]},solo:{x:315,ys:[490,538,583,624,694,749,796,842],hx:[611,1084,392,457]},nav:{x:576,ys:[485,539,585,630,701,762,815,871,927,1028],hx:[1131,1606,396,460]}};
  const L={dual:'DUAL TRAINING',solo:'FIRST / LOCAL SOLO',nav:'NAVIGATION SOLO'};
  const r=R[st.t]||R.dual;let s='';
  r.ys.forEach((y,i)=>{if(st.c&&st.c[st.t+i])s+=tick(r.x,y/2)});
  const h=r.hx;s+=`<rect x="${h[0]/2-3}" y="${h[2]/2-3}" width="${(h[1]-h[0])/2+6}" height="${(h[3]-h[2])/2+6}" rx="5" fill="none" stroke="${INK}" stroke-width="1.6"/>`;
  s+=T(140,478,(P.NL.pic||'').toUpperCase(),{a:'start',fs:13});
  s+=T(98,527,date(),{a:'start',fs:13});s+=T(343,527,L[st.t]||'',{a:'start',fs:11});
  return page(1,s)}

/* page 2: mass and balance (AFM 6.4.3 / 6.4.4) */
function p2(){const r=P.mbCalc();if(!r)return page(2,T(420,540,'No aircraft selected: add one under DA40 D → Fleet',{fs:11}));
  const LB=2.20462,R=r.rows,L0=v=>Math.round(v*LB);const ilb=(kg,arm)=>L0(kg)*arm;
  const mi=[R[0][2]*86.796,ilb(R[1][1],90.6),ilb(R[2][1],128.0),ilb(R[3][1],143.7)];const mz=mi.reduce((a,b)=>a+b,0),mf=ilb(r.fuelKg,103.5),mt=mz+mf;
  const fm=r.fuelKg*P.AFM.arms.fuel;
  const rows=[[R[0][1],R[0][2],L0(R[0][1]),mi[0]],[R[1][1],R[1][2],L0(R[1][1]),mi[1]],[R[2][1],R[2][2],L0(R[2][1]),mi[2]],[R[3][1],R[3][2],L0(R[3][1]),mi[3]],
    [r.zf[0],r.zf[1],L0(r.zf[0]),mz],[r.fuelKg,fm,L0(r.fuelKg),mf],[r.to[0],r.to[1],L0(r.to[0]),mt]];
  const ym=[151.75,185.75,219.75,253.75,291.75,335.25,378.25],yl=[167.75,201.75,235.75,269.75,308.75,351.75,394.5];
  let s=T(334.5,90.5,r.a.reg,{fs:8});
  rows.forEach((v,i)=>{s+=T(294.5,ym[i],f1(v[0]),{fs:12})+T(361,ym[i],f2(v[1]),{fs:12})+T(294.5,yl[i],fmt(v[2]),{fs:8,w:400})+T(361,yl[i],fmt(v[3]),{fs:8,w:400})});
  const zc=P.check(r.zf[0],r.zf[1]),tc=P.check(r.to[0],r.to[1]),lc=P.check(r.ld[0],r.ld[1]);
  const X=cg=>(976+(cg-2.40)*2213)/2,Y=kg=>(192.5+(1150-kg)*0.9325)/2;
  const mark=(cg,kg,lab,dy=0)=>{if(!isFinite(cg))return'';const x=X(cg),y=Y(kg);return `<rect x="${x-5}" y="${y-5}" width="10" height="10" fill="none" stroke="${INK}" stroke-width="1.4"/><path d="M${x-5},${y-5} L${x+5},${y+5} M${x+5},${y-5} L${x-5},${y+5}" stroke="${INK}" stroke-width="1.2"/>`+T(x+8,y+dy,lab,{a:'start',fs:8})};
  s+=mark(zc.cg,r.zf[0],'5')+mark(tc.cg,r.to[0],'7')+mark(lc.cg,r.ld[0],'LDG',Math.abs(r.ld[0]-r.to[0])<25?11:0);
  const ok=!zc.errs.length&&!tc.errs.length&&!lc.errs.length;
  s+=T(12,522,`${r.a.reg}: CG positions ${zc.cg.toFixed(3)} m and ${tc.cg.toFixed(3)} m (${(zc.cg*39.3701).toFixed(2)} and ${(tc.cg*39.3701).toFixed(2)} in); landing ${r.ld[0].toFixed(1)} kg at ${lc.cg.toFixed(3)} m.`,{a:'start',fs:9.5,w:400});
  s+=T(12,538,ok?'Masses and CG positions fall into the permitted area: this loading condition is ALLOWABLE.':'This loading condition is NOT ALLOWABLE: '+[...tc.errs,...lc.errs,...zc.errs].join('; '),{a:'start',fs:9.5});
  s+=T(12,556,`Fuel ${P.MB.fuel||0} L × 0.84 = ${r.fuelKg.toFixed(1)} kg · trip fuel ${P.MB.trip||0} L · ${(P.NL.pic||'').toUpperCase()} · ${date()}`,{a:'start',fs:8,w:400});
  return page(2,s)}

/* distance chart overlay */
function distLayer(name,pa,t,m,w,result,unit){if(!PE)return'';const p=PE.path(name,pa,t,m,w);
  let s=p.lines.map((l,i)=>pl(l,{arrow:(i===p.lines.length-1||i===0||l.length===2&&l[0][1]>l[1][1])?TR[name].page:0})).join('');
  const a=window.EFB_PERF[name].ax,lbl={fs:13};
  s+=T(p.xT+4,a.YB-10,`${Math.round(t)} °C`,{...lbl,a:'start'});
  s+=T(p.xT+4,p.y1-8,`${Math.round(pa)} ft`,{...lbl,a:'start'});
  s+=T(p.xm+4,a.YB-10,`${Math.round(m)} kg`,{...lbl,a:'start'});
  if(p.xw&&Math.abs(w)>0)s+=T(p.xw+4,a.YB-10,`${Math.abs(Math.round(w))} kt ${w<0?'tail':'head'}`,{...lbl,a:'start'});
  s+=T(a.WR-6,p.end[1]-12,`${Math.round(result)} ${unit}`,{fs:16,a:'end'});
  return chartG(name,s)}
function climbLayer(name,pa,t,m,res){const p=PE.climbPath(name,pa,t,m);const a=window.EFB_PERF[name].ax;
  let s=p.lines.map((l,i)=>pl(l,{arrow:(i===0||i===3||i===4)?TR[name].page:0})).join('');
  s+=T(p.xT+4,a.YB-10,`${Math.round(t)} °C`,{fs:13,a:'start'})+T(p.xT+4,p.y1-8,`${Math.round(pa)} ft`,{fs:13,a:'start'})+T(p.xm+4,a.YB-10,`${Math.round(m)} kg`,{fs:13,a:'start'});
  s+=T(a.MR-6,p.end[1]-12,`${Math.round(res/10)*10} ft/min`,{fs:16,a:'end'});
  return chartG(name,s)}
function header(n,txt){return T(W-14,8,txt,{a:'end',fs:8,b:'hanging',w:400})}

function perfPages(){const K=P.calcPerf();if(!K)return[];const D=K.D,A=K.A;
  const info=`${K.r?K.r.a.reg:''} · ${date()} · ${(P.NL.pic||'').toUpperCase()}`;
  const dTO=x=>K.rows[x].chart;
  const p3=page(3,header(3,`Departure ${D.s.apt} RWY ${D.s.rwy} · surface ${({none:'paved',short:'grass ≤5 cm',mid:'grass 5–10 cm',long:'grass >10 cm'})[P.PF.dep_sfc||'none']} · slope ${num(D.s.slope)||0} % · ${info}`));
  const p4=page(4,distLayer('to50',D.pa,D.T,K.tom,D.hwUsed,dTO(0),'m')+distLayer('toroll',D.pa,D.T,K.tom,D.hwUsed,dTO(1),'m')+header(4,`Take-off ${D.s.apt} RWY ${D.s.rwy}: PA ${Math.round(D.pa)} ft, OAT ${Math.round(D.T)} °C, ${Math.round(K.tom)} kg, wind ${D.hwUsed>=0?'head':'tail'} ${Math.abs(D.hwUsed).toFixed(0)} kt (factored) · ${info}`));
  const p5=page(5,climbLayer('climbTO',D.pa,D.T,K.tom,K.climbTO)+climbLayer('climbCR',K.cpa,K.coat,K.tom,K.climbCR)+header(5,info));
  // page 6: density altitude + fuel flow
  const da=D.pa+120*(D.T-(15-2*D.pa/1000));const xT=222+(D.T+20)*8.16,yPA=640-D.pa*0.04029,yDA=700-da*0.0325;
  let s6=chartG('da',pl([[222,yPA],[xT,yPA]],{dash:1})+pl([[xT,720],[xT,yPA]],{arrow:6})+pl([[xT,yPA],[630,yDA]],{arrow:6})+T(xT+4,712,`${Math.round(D.T)} °C`,{fs:13,a:'start'})+T(226,yPA-8,`PA ${Math.round(D.pa)} ft`,{fs:13,a:'start'})+T(626,yDA-10,`DA ${Math.round(da)} ft`,{fs:14,a:'end'}));
  const gal=K.ff/3.785,u=178+(100-K.load)*10.386,v=55+(gal-1)*95.29;
  s6+=chartG('ff',pl([[u,55],[u,v]],{dash:1})+pl([[u,v],[178,v]],{arrow:6})+T(u+5,70,`${K.load} %`,{fs:13,a:'start'})+T(190,v-10,`${gal.toFixed(1)} US gal/h = ${K.ff.toFixed(1)} L/h`,{fs:13,a:'start'}));
  const p6=page(6,s6+header(6,info));
  const p7=page(7,header(7,`Arrival ${A.s.apt} RWY ${A.s.rwy} · surface ${({none:'paved',short:'grass ≤5 cm',mid:'grass 5–10 cm',long:'grass >10 cm'})[P.PF.arr_sfc||'none']} · slope ${num(A.s.slope)||0} % · ${info}`));
  const L=(nm,rr)=>PE.dist(nm,A.pa,A.T,K.ldm,A.hwUsed).v;
  const lh=`Landing ${A.s.apt} RWY ${A.s.rwy}: PA ${Math.round(A.pa)} ft, OAT ${Math.round(A.T)} °C, ${Math.round(K.ldm)} kg, headwind ${Math.max(0,A.hwUsed).toFixed(0)} kt (factored)`;
  const p8=page(8,distLayer('ldg50up',A.pa,A.T,K.ldm,A.hwUsed,L('ldg50up'),'m')+distLayer('ldgrollup',A.pa,A.T,K.ldm,A.hwUsed,L('ldgrollup'),'m')+header(8,lh+' · '+info));
  const p9=page(9,distLayer('ldg50',A.pa,A.T,K.ldm,A.hwUsed,L('ldg50'),'m')+distLayer('ldgroll',A.pa,A.T,K.ldm,A.hwUsed,L('ldgroll'),'m')+header(9,lh+' · '+info));
  return [p3,p4,p5,p6,p7,p8,p9]}

function navPage(){E.calcNav();const n=$('cea');return n?`<section class="ppage navp">${n.outerHTML.replace('id="cea"','')}</section>`:''}

/* ---------- weather and NOTAM briefing documents ---------- */
function briefIds(){const v=id=>{const el=$(id);return el?el.value.trim().toUpperCase():''};
  const W=E.wpts;const ids=[v('b_dep')||(W[0]&&E.BY[W[0].n]?W[0].n:''),v('b_dst')||(W.length>1&&E.BY[W[W.length-1].n]?W[W.length-1].n:''),v('b_alt')];
  W.forEach(w=>{if(E.BY[w.n])ids.push(w.n)});return [...new Set(ids.filter(x=>/^[A-Z]{4}$/.test(x)))]}
const docHead=(t,sub)=>`<div class="dh"><img src="afm/cea-logo.png" alt=""><div><b>${esc(t)}</b><span>${esc(sub)}</span></div><span class="dr">${esc((P.NL.pic||'').toUpperCase())}<br>${date()} · ${esc(P.NL.acft||'')}</span></div>`;
const utc=s=>{const d=new Date(s);return isNaN(d)?esc(s||''):d.toISOString().slice(0,16).replace('T',' ')+'Z'};
async function wxDoc(ids){let w={};try{w=await E.getWx(ids)}catch(e){}
  const rows=ids.map(id=>{const x=w[id]||{};const a=E.BY[id];return `<section class="wxb"><h3>${id}${a?' · '+esc(a.name):''}</h3>
    <p class="lbl">METAR${x.metar&&x.metar.fltCat?' · '+esc(x.metar.fltCat):''}</p><pre>${x.metar?esc(x.metar.rawOb):'No METAR available for this aerodrome.'}</pre>
    <p class="lbl">TAF</p><pre>${x.taf?esc(x.taf.rawTAF).replace(/ (BECMG|TEMPO|FM\d|PROB\d\d)/g,'\n   $1'):'No TAF issued for this aerodrome.'}</pre></section>`}).join('');
  return `<section class="ppage doc">${docHead('METAR / TAF','Source: aviationweather.gov · retrieved '+new Date().toISOString().slice(0,16).replace('T',' ')+'Z')}<div class="wxcols">${rows}</div></section>`}
async function notamDoc(ids){const all=[...ids,'LGGG'];
  if(!window.EFB_SERVER)return `<section class="ppage doc">${docHead('NOTAM briefing',all.join(' · '))}<p class="warnbox">NOTAMs are fetched by the school server. This copy of the app is not running on the school server, so NOTAMs could not be included. Obtain them from EUROCONTROL EAD or the Greek AIS and attach them to this pack.</p></section>`;
  try{const r=await fetch('/api/notam?ids='+all.join(','),{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error||r.status);
    const now=Date.now();
    const sec=all.map(id=>{const L=(j.notams[id]||[]).slice().sort((a,b)=>String(a.id).localeCompare(String(b.id)));const a=E.BY[id];
      return `<section class="nt"><h3>${id}${id==='LGGG'?' · Athinai FIR':a?' · '+esc(a.name):''} <small>${j.errors&&j.errors[id]?'· could not be retrieved: '+esc(j.errors[id]):L.length+' NOTAM'+(L.length===1?'':'s')}</small></h3>
        ${L.map(n=>`<div class="nn"><b>${esc(n.id)}</b><pre>${esc(n.text)}</pre></div>`).join('')||(j.errors&&j.errors[id]?'':'<p class="sub">No NOTAMs in force.</p>')}</section>`}).join('');
    return `<section class="ppage doc">${docHead('NOTAM briefing',`${all.join(' · ')} · ${j.source} · retrieved ${utc(j.fetched)}`)}<div class="ntcols">${sec}</div><p class="foot">Check the official pre-flight information bulletin (EUROCONTROL EAD / Greek AIS) before flight. This list is a convenience copy.</p></section>`}
  catch(e){return `<section class="ppage doc">${docHead('NOTAM briefing',all.join(' · '))}<p class="warnbox">NOTAMs could not be retrieved (${esc(e.message||e)}). Obtain them from EUROCONTROL EAD or the Greek AIS and attach them to this pack.</p></section>`}}
async function chartPages(){const SETS=[['swc','Significant weather chart'],['wind','Wind and temperature aloft'],['pressure','Surface pressure chart']];
  if(!window.EFB_SERVER)return `<section class="ppage doc">${docHead('Weather charts','HNMS (EMY)')}<p class="warnbox">The HNMS charts are fetched by the school server. This copy of the app is not running on it, so the charts are not included. Print them from oldportal.emy.gr.</p></section>`;
  let out='';for(const [k,t] of SETS){try{const r=await fetch('/api/wx/emy?set='+k,{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error);
      const imgs=j.charts.filter(c=>!c.pdf);if(!imgs.length)throw new Error('no charts found on the HNMS page');
      out+=imgs.map(c=>`<section class="ppage chart">${docHead(t,'HNMS (EMY) · '+(c.label||'')+' · retrieved '+utc(j.fetched))}<img class="wxc" src="/api/wx/img?u=${encodeURIComponent(c.url)}" alt="${esc(t)}"></section>`).join('')}
    catch(e){out+=`<section class="ppage doc">${docHead(t,'HNMS (EMY)')}<p class="warnbox">${esc(t)} could not be retrieved (${esc(e.message||e)}).</p></section>`}}
  return out}

async function build(which){const all=which.includes('all');let h='';const ids=briefIds();
  if(all||which.includes('check'))h+=p1();
  if(all||which.includes('brief')){h+=await wxDoc(ids);h+=await notamDoc(ids);h+=await chartPages()}
  if(all||which.includes('mb'))h+=p2();
  if(all||which.includes('perf'))h+=perfPages().join('');
  if(all||which.includes('nav'))h+=navPage();
  return h}
async function open(which){const box=$('pack');box.innerHTML=`<div class="packbar"><b>${which.includes('all')?'Preflight pack':'Print preview'}</b><span class="sub" style="margin:0" id="pk_state">Collecting weather, NOTAMs and charts…</span><div class="row"><button type="button" id="pk_close">Close</button><button type="button" class="primary" id="pk_print" disabled>Print / PDF</button></div></div><div class="packpages"></div>`;
  document.body.classList.add('packview');$('pk_close').onclick=close;
  const html=await build(which);if(!document.body.classList.contains('packview'))return;
  box.querySelector('.packpages').innerHTML=html;$('pk_state').textContent="The school's pages, filled in from the app.";
  const imgs=[...box.querySelectorAll('img')];await Promise.all(imgs.map(i=>i.complete?0:new Promise(r=>{i.onload=i.onerror=r})));
  $('pk_print').disabled=false;$('pk_print').onclick=()=>{document.body.classList.add('packprint');setTimeout(()=>window.print(),50)}}
function close(){document.body.classList.remove('packview','packprint');$('pack').innerHTML=''}
window.addEventListener('afterprint',()=>document.body.classList.remove('packprint'));
window.PACK={open,build,close};
const bp=$('b_pack');if(bp)bp.onclick=()=>open(['brief']);
})();
