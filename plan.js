/* Navlog (CEA-OPS-06 layout), DA40 D mass & balance and performance helpers.
   AFM figures transcribed from the school's preflight pack (AFM 5.3.7, 5.3.11, 6.4). Verify against the aircraft's AFM. */
(function(){
'use strict';
const E=window.EFB;if(!E)return;
const {S,esc,num,p3}=E;const $=id=>document.getElementById(id);
const pad2=n=>String(n).padStart(2,'0');
const hm=m=>isFinite(m)?pad2(Math.floor(((m%1440)+1440)%1440/60))+':'+pad2(Math.round(((m%1440)+1440)%1440%60)%60):'';
const parseHM=s=>{const m=String(s||'').trim().match(/^(\d{1,2})[:.]?(\d{2})$/);return m?(+m[1])*60+(+m[2]):NaN};
const nowHM=()=>{const d=new Date();return pad2(d.getHours())+':'+pad2(d.getMinutes())};
const rad=d=>d*Math.PI/180;
const nm=(a,b)=>E.gc(a,b).d;

/* ---------- AFM data (DA40 D) ---------- */
const AFM={
  arms:{front:2.30,rear:3.25,bag:3.65,fuel:2.63},       // m aft of datum (AFM 6.4.3)
  density:0.84,                                          // kg/L Jet A-1
  mMin:780,mUtil:980,mMax:1150,                          // kg (diagram 6.4.4)
  aft:2.59,fwd:m=>m<=980?2.40:2.40+(m-980)*(0.06/170),   // linear 2.40 @980 -> 2.46 @1150
  vr:[[850,49],[1000,55],[1150,59]],climb:[[850,54],[1000,60],[1150,66]],vapp:[[850,58],[1000,63],[1150,71]],
  ldgRef:{dist:744,roll:287},                            // ISA, MSL, 1150 kg, flaps LDG
  grassTO:{none:0,short:10,mid:15,long:25},grassLDG:{none:0,short:5,mid:15,long:25}
};
const interp=(t,x)=>{if(x<=t[0][0])return t[0][1];for(let i=1;i<t.length;i++)if(x<=t[i][0]){const [a,b]=[t[i-1],t[i]];return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])}return t[t.length-1][1]};

/* ---------- state ---------- */
let NL=S.get('nl',{});const saveNL=()=>S.set('nl',NL);
let MB=S.get('mb',{front:'',rear:'',bag:'',fuel:'',trip:''});const saveMB=()=>S.set('mb',MB);
let FLEET=S.get('fleet',[]);const saveFleet=()=>S.set('fleet',FLEET);
const acft=()=>FLEET.find(f=>f.reg===NL.acft)||FLEET[0]||null;

/* ---------- navlog ---------- */
function fillHeader(){
  $('nl_acft').innerHTML=FLEET.length?FLEET.map(f=>`<option ${f.reg===NL.acft?'selected':''}>${esc(f.reg)}</option>`).join(''):'<option value="">Add aircraft in DA40 D → Fleet</option>';
  $('nl_pic').value=NL.pic||'';$('nl_date').value=NL.date||E.todayISO();$('nl_tot').value=NL.tot||'';$('nl_ff').value=NL.ff||'';$('nl_rem').value=NL.rem||'';
}
['nl_pic','nl_date','nl_tot','nl_ff','nl_rem'].forEach(id=>$(id).addEventListener('input',e=>{NL[id.slice(3)]=e.target.value;saveNL();if(id==='nl_tot'||id==='nl_ff')E.calcNav()}));
$('nl_acft').addEventListener('change',e=>{NL.acft=e.target.value;saveNL()});

function renderLog(L){
  const tbody=$('n_log');if(!tbody)return;
  if(!L.length){tbody.innerHTML='<tr><td colspan="15" class="wrap" style="color:var(--muted)">Plan a route on the map or add points above. Each leg appears here as a row of the school\'s navlog.</td></tr>';renderFuel(L);renderComm();return}
  let clock=parseHM(NL.tot);let tt=0,td=0;
  const rows=L.map(l=>{const b=l.b;const t=Math.round(l.ete);td+=l.d;tt+=isFinite(t)?t:0;
    const eta=isFinite(clock)&&isFinite(t)?clock+t:NaN;const ata=parseHM(b.ata);
    clock=isFinite(ata)?ata:eta;                         // re-base later ETAs on the latest ATA
    const drift=isFinite(l.wca)?(l.wca>=0?'+':'')+Math.round(l.wca):'—';
    return `<tr data-i="${l.i}"><td class="ft"><b>${esc(l.a.n)}</b><span>${esc(b.n)}</span></td>
      <td><input data-f="msa" value="${esc(b.msa||'')}" inputmode="numeric" placeholder="—"></td>
      <td><input data-f="alt" value="${esc(b.alt||'')}" inputmode="numeric" placeholder="—"></td>
      <td><input data-f="tas" value="${esc(b.tas||'')}" inputmode="numeric" placeholder="${Math.round(l.tas)||''}"></td>
      <td class="wv"><input data-f="wd" value="${esc(b.wd||'')}" inputmode="numeric" placeholder="${isFinite(l.wd)?p3(l.wd):''}">/<input data-f="ws" value="${esc(b.ws||'')}" inputmode="numeric" placeholder="${isFinite(l.ws)?Math.round(l.ws):''}"></td>
      <td>${p3(l.tc)}</td><td>${drift}</td><td>${isFinite(l.th)?p3(l.th):'—'}</td><td>${Math.abs(l.vr)}${l.vr>=0?'E':'W'}</td>
      <td><b>${isFinite(l.mh)?p3(l.mh):'—'}</b></td><td>${isFinite(l.gs)?Math.round(l.gs):'—'}</td><td>${l.d.toFixed(1)}</td><td><b>${isFinite(t)?t:'—'}</b></td>
      <td>${hm(eta)}</td><td><input data-f="ata" value="${esc(b.ata||'')}" placeholder="tap" class="ata" maxlength="5"></td></tr>`});
  tbody.innerHTML=rows.join('')+`<tr class="tot"><td><b>Total</b></td><td colspan="10"></td><td><b>${td.toFixed(1)}</b></td><td><b>${tt}</b></td><td colspan="2"></td></tr>`;
  NL._route=tt;renderFuel(L);renderComm();
}
$('n_log').addEventListener('change',e=>{const t=e.target,f=t.dataset.f;if(!f)return;const i=+t.closest('tr').dataset.i;const w=E.wpts[i];if(!w)return;
  w[f]=t.value.trim();E.saveRoute();E.calcNav()});
$('n_log').addEventListener('focusin',e=>{const t=e.target;if(t.classList.contains('ata')&&!t.value){t.value=nowHM();t.dispatchEvent(new Event('change',{bubbles:true}))}});

/* ATIS */
const ATIS=[['stn','Station'],['info','Info'],['time','Time'],['wind','Wind W/V'],['vis','Visibility'],['temp','Temp'],['dew','Dew point'],['qnh','QNH'],['tl','T/L'],['few','FEW'],['sct','SCT'],['bkn','BKN'],['ovc','OVC'],['rwy','RWY / approach']];
function renderAtis(){NL.atis=NL.atis||{};$('nl_atis').innerHTML=ATIS.map(([k,l])=>`<label>${l}<input data-a="${k}" value="${esc(NL.atis[k]||'')}" autocomplete="off"></label>`).join('')}
$('nl_atis').addEventListener('input',e=>{const k=e.target.dataset.a;if(!k)return;NL.atis[k]=e.target.value;saveNL()});

/* Fuel */
function renderFuel(){
  const ff=num(NL.ff),route=NL._route||0;NL.fuel=NL.fuel||{};const F=NL.fuel;
  const reserve=isFinite(num(F.reserve))?num(F.reserve):45,margin=isFinite(num(F.margin))?num(F.margin):0;
  const req=route+reserve,carry=req+margin;const L=m=>isFinite(ff)&&ff>0?(m*ff/60).toFixed(1):'—';
  const onboard=num(MB.fuel);const endur=isFinite(onboard)&&ff>0?onboard/ff*60:NaN;
  const short=isFinite(onboard)&&ff>0&&onboard<carry*ff/60;
  $('nl_fuel').innerHTML=`<div class="tbl"><table class="fueltbl"><thead><tr><th>Stage</th><th>Min</th><th>Litres</th></tr></thead><tbody>
   <tr><td>Route</td><td>${route}</td><td>${L(route)}</td></tr>
   <tr><td>Reserve</td><td><input data-u="reserve" value="${reserve}" inputmode="numeric"></td><td>${L(reserve)}</td></tr>
   <tr><td><b>Fuel required</b></td><td><b>${req}</b></td><td><b>${L(req)}</b></td></tr>
   <tr><td>Margin</td><td><input data-u="margin" value="${esc(F.margin||'')}" inputmode="numeric" placeholder="0"></td><td>${L(margin)}</td></tr>
   <tr><td><b>Total carried</b></td><td><b>${carry}</b></td><td><b>${L(carry)}</b></td></tr></tbody></table></div>
   <p class="sub">${isFinite(onboard)?`On board per mass & balance: ${onboard} L${isFinite(endur)?` · endurance ${Math.floor(endur/60)}:${pad2(Math.round(endur%60))}`:''}`:'Enter fuel on board in DA40 D → Mass & balance.'}${!(ff>0)?' Set the planning fuel flow above to get litres.':''}</p>
   ${short?'<p class="pill bad">Fuel on board is less than total carried</p>':''}
   <div class="fields four" style="margin-top:8px">${[['off','Blocks off'],['to','T/O'],['land','Land'],['on','Blocks on']].map(([k,l])=>`<label>${l}<input data-u="${k}" value="${esc(F[k]||'')}" placeholder="tap" class="tstamp" maxlength="5"></label>`).join('')}</div>
   <p class="sub" id="nl_block"></p>`;
  const bt=parseHM(F.on)-parseHM(F.off),ft=parseHM(F.land)-parseHM(F.to);
  $('nl_block').textContent=[isFinite(bt)?`Block time ${hm(bt)}`:'',isFinite(ft)?`Flight time ${hm(ft)}`:''].filter(Boolean).join(' · ');
}
$('nl_fuel').addEventListener('change',e=>{const k=e.target.dataset.u;if(!k)return;NL.fuel[k]=e.target.value.trim();saveNL();renderFuel()});
$('nl_fuel').addEventListener('focusin',e=>{const t=e.target;if(t.classList.contains('tstamp')&&!t.value){t.value=nowHM();t.dispatchEvent(new Event('change',{bubbles:true}))}});

/* Comm / Nav */
function nearest(lat,lon,kind){let best=null,bd=25;(E.NAVAIDS||[]).forEach(n=>{const isV=/VOR|TACAN/.test(n[2]),isN=/NDB/.test(n[2]);if(kind==='VOR'?!isV:!isN)return;
  const d=nm({lat,lon},{lat:n[4],lon:n[5]});if(d<bd){bd=d;best=n}});return best}
function commStations(){const W=E.wpts;const ids=[];[W[0],W[W.length-1]].forEach(w=>{if(w&&E.BY[w.n]&&!ids.includes(w.n))ids.push(w.n)});
  if(!ids.length&&E.BY.LGIR)ids.push('LGIR');return ids.slice(0,3)}
function renderComm(){
  NL.comm=NL.comm||{};const st=commStations();
  const f=(a,t)=>{const x=a.freqs.find(q=>q[0]===t);return x?x[1]:''};
  const auto=st.map(id=>{const a=E.BY[id];const v=nearest(a.lat,a.lon,'VOR'),n=nearest(a.lat,a.lon,'NDB');
    return {id,ATIS:f(a,'ATIS'),TWR:f(a,'TWR')||f(a,'AFIS')||f(a,'INFO'),APP:f(a,'APP'),VOR:v?v[0]+' '+v[3]:'',ADF:n?n[0]+' '+n[3]:''}});
  const rows=['ATIS','TWR','APP','VOR','ADF'],lab={ATIS:'ATIS',TWR:'TWR / AFIS',APP:'APP / RAD',VOR:'VOR',ADF:'ADF'};
  $('nl_comm').innerHTML=`<thead><tr><th>Station</th>${auto.map(c=>`<th>${c.id}</th>`).join('')}<th><input data-c="x.id" value="${esc(NL.comm['x.id']||'')}" placeholder="other" style="min-width:70px"></th></tr></thead><tbody>${rows.map(r=>`<tr><td><b>${lab[r]}</b></td>${auto.map(c=>{const k=c.id+'.'+r;return `<td><input data-c="${k}" value="${esc(NL.comm[k]!=null?NL.comm[k]:c[r])}"></td>`}).join('')}<td><input data-c="x.${r}" value="${esc(NL.comm['x.'+r]||'')}"></td></tr>`).join('')}</tbody>`;
}
$('nl_comm').addEventListener('change',e=>{const k=e.target.dataset.c;if(!k)return;NL.comm[k]=e.target.value;saveNL()});

/* Print in the school's form layout */
$('nl_print').onclick=()=>{
  const L=E.legs();const A=NL.atis||{},F=NL.fuel||{};let clock=parseHM(NL.tot);
  const cell=v=>`<td>${esc(v==null?'':v)}</td>`;
  const legsHTML=L.map(l=>{const b=l.b,t=Math.round(l.ete);const eta=isFinite(clock)&&isFinite(t)?clock+t:NaN;const ata=parseHM(b.ata);clock=isFinite(ata)?ata:eta;
    return `<tr><td class="ftp">${esc(l.a.n)}<br>${esc(b.n)}</td>${cell(b.msa)}${cell(b.alt)}${cell(Math.round(l.tas))}${cell((isFinite(l.wd)?p3(l.wd):'')+'/'+(isFinite(l.ws)?Math.round(l.ws):''))}${cell(p3(l.tc))}${cell(isFinite(l.wca)?(l.wca>=0?'+':'')+Math.round(l.wca):'')}${cell(isFinite(l.th)?p3(l.th):'')}${cell(Math.abs(l.vr)+(l.vr>=0?'E':'W'))}${cell(isFinite(l.mh)?p3(l.mh):'')}${cell(isFinite(l.gs)?Math.round(l.gs):'')}${cell(l.d.toFixed(1))}${cell(isFinite(t)?t:'')}${cell(hm(eta))}${cell(b.ata||'')}</tr>`}).join('');
  const blank='<tr>'+'<td>&nbsp;</td>'.repeat(15)+'</tr>';
  const ff=num(NL.ff),route=NL._route||0,res=isFinite(num(F.reserve))?num(F.reserve):45,mar=num(F.margin)||0;const Lt=m=>ff>0?(m*ff/60).toFixed(1):'';
  const st=commStations();const C=k=>{const el=document.querySelector(`#nl_comm [data-c="${k}"]`);return el?el.value:''};
  const p=$('printarea');p.innerHTML=`<div class="pf">
   <div class="pf-h"><b>VFR Navigation Flight Log Form</b><span>CEA-OPS-06</span></div>
   <table class="pf-t"><tr><th>Pilot in Command (PIC)</th><td>${esc(NL.pic||'')}</td><th>Aircraft</th><td>${esc($('nl_acft').value||'')}</td><th>Date</th><td>${esc(($('nl_date').value||'').split('-').reverse().join('/'))}</td><th>T/O time</th><td>${esc(NL.tot||'')}</td></tr></table>
   <table class="pf-t pf-legs"><colgroup><col style="width:13%"><col><col><col><col><col><col><col><col><col><col><col><col><col><col></colgroup><thead><tr><th>From / To</th><th>MSA</th><th>Route alt [ft]</th><th>TAS</th><th>W/V</th><th>Track (T)</th><th>Drift [°]</th><th>H(T)</th><th>VAR</th><th>H(M)</th><th>GS</th><th>Distance [nm]</th><th>Time [min]</th><th>ETA</th><th>ATA</th></tr></thead>
   <tbody>${legsHTML}${blank.repeat(Math.max(0,9-L.length))}</tbody></table>
   <div class="pf-g">
    <table class="pf-t pf-atis"><tr><th colspan="4">ATIS</th></tr>${[['Station','stn','Time','time'],['Info','info','Temp','temp'],['Wind W/V','wind','Dew point','dew'],['Visibility','vis','QNH','qnh'],['FEW','few','(T/L)','tl'],['SCT','sct','RWY / App','rwy'],['BKN','bkn','',''],['OVC','ovc','','']].map(([a,b,c,d])=>`<tr><th>${a}</th><td>${esc(A[b]||'')}</td><th>${c}</th><td>${d?esc(A[d]||''):''}</td></tr>`).join('')}</table>
    <table class="pf-t"><tr><th>Remarks / notes</th></tr><tr><td class="rem">${esc(NL.rem||'').replace(/\n/g,'<br>')}</td></tr></table>
    <table class="pf-t"><tr><th colspan="${st.length+2}">COMM / NAV</th></tr><tr><th>Station</th>${st.map(s=>`<th>${s}</th>`).join('')}<th>${esc(C('x.id'))}</th></tr>${['ATIS','TWR','APP','VOR','ADF'].map(r=>`<tr><th>${r==='APP'?'APP/RAD':r}</th>${st.map(s=>`<td>${esc(C(s+'.'+r))}</td>`).join('')}<td>${esc(C('x.'+r))}</td></tr>`).join('')}</table>
    <table class="pf-t"><tr><th colspan="3">FUEL CONSUMPTION</th></tr><tr><th>Stage</th><th>Min</th><th>Litres</th></tr><tr><th>Route</th><td>${route}</td><td>${Lt(route)}</td></tr><tr><th>Reserve</th><td>${res}</td><td>${Lt(res)}</td></tr><tr><th>Fuel required</th><td>${route+res}</td><td>${Lt(route+res)}</td></tr><tr><th>Margin</th><td>${mar||''}</td><td>${mar?Lt(mar):''}</td></tr><tr><th>Total carried</th><td>${route+res+mar}</td><td>${Lt(route+res+mar)}</td></tr><tr><th>Blocks off</th><td>${esc(F.off||'')}</td><td>T/O ${esc(F.to||'')}</td></tr><tr><th>Blocks on</th><td>${esc(F.on||'')}</td><td>Land ${esc(F.land||'')}</td></tr><tr><th>Signature</th><td colspan="2" style="height:28px"></td></tr></table>
   </div><p class="pf-n">Fuel / Radios / Engine-FADEC / Direction / Altitude · Generated by DA40 D Flight Bag. Check all values before flight.</p></div>`;
  window.print();
};

/* ---------- mass & balance ---------- */
function mbCalc(){
  const a=acft();if(!a)return null;const kg=v=>isFinite(num(v))?num(v):0;
  const rows=[['Empty mass',num(a.em),num(a.emom)],['Front seats',kg(MB.front),kg(MB.front)*AFM.arms.front],['Rear seats',kg(MB.rear),kg(MB.rear)*AFM.arms.rear],['Baggage',kg(MB.bag),kg(MB.bag)*AFM.arms.bag]];
  const zf=rows.reduce((s,r)=>[s[0]+r[1],s[1]+r[2]],[0,0]);
  const fuelKg=kg(MB.fuel)*AFM.density,tripKg=kg(MB.trip)*AFM.density;
  const to=[zf[0]+fuelKg,zf[1]+fuelKg*AFM.arms.fuel],ld=[to[0]-tripKg,to[1]-tripKg*AFM.arms.fuel];
  return {a,rows,zf,fuelKg,tripKg,to,ld};
}
function check(m,mom){const cg=mom/m;const errs=[];
  if(m>AFM.mMax+1e-6)errs.push(`over max mass ${AFM.mMax} kg by ${(m-AFM.mMax).toFixed(1)} kg`);
  if(m<AFM.mMin-1e-6)errs.push(`below minimum flight mass ${AFM.mMin} kg`);
  if(cg<AFM.fwd(Math.min(Math.max(m,AFM.mMin),AFM.mMax))-1e-4)errs.push(`CG forward of limit ${AFM.fwd(Math.min(m,AFM.mMax)).toFixed(3)} m`);
  if(cg>AFM.aft+1e-4)errs.push(`CG aft of limit ${AFM.aft} m`);
  return {cg,errs,cat:m<=AFM.mUtil?'Utility & Normal':'Normal'}}
function envelopeSVG(pts){
  const W=520,H=360,P={l:56,r:16,t:16,b:44};const x0=2.38,x1=2.61,y0=750,y1=1180;
  const X=v=>P.l+(v-x0)/(x1-x0)*(W-P.l-P.r),Y=v=>H-P.b-(v-y0)/(y1-y0)*(H-P.t-P.b);
  const env=[[2.40,780],[2.40,980],[2.46,1150],[2.59,1150],[2.59,780]].map(p=>X(p[0])+','+Y(p[1])).join(' ');
  let g='';for(let v=2.40;v<=2.601;v+=0.05)g+=`<line x1="${X(v)}" y1="${Y(y0)}" x2="${X(v)}" y2="${Y(y1)}" class="gr"/><text x="${X(v)}" y="${H-P.b+16}" text-anchor="middle">${v.toFixed(2)}</text>`;
  for(let v=800;v<=1150;v+=50)g+=`<line x1="${X(x0)}" y1="${Y(v)}" x2="${X(x1)}" y2="${Y(v)}" class="gr"/><text x="${P.l-6}" y="${Y(v)+4}" text-anchor="end">${v}</text>`;
  const ok=pts.every(p=>!p.bad);
  const line=pts.filter(p=>isFinite(p.cg)).map(p=>X(p.cg)+','+Y(p.m)).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" class="env" role="img" aria-label="CG envelope">${g}
   <polygon points="${env}" class="envp"/><line x1="${X(2.40)}" y1="${Y(980)}" x2="${X(2.59)}" y2="${Y(980)}" class="u"/>
   <text x="${X(2.525)}" y="${Y(1060)}" text-anchor="middle" class="lbl">Normal</text><text x="${X(2.50)}" y="${Y(880)}" text-anchor="middle" class="lbl">Utility &amp; Normal</text>
   <polyline points="${line}" class="path ${ok?'':'bad'}"/>
   ${pts.map(p=>isFinite(p.cg)?`<circle cx="${X(p.cg)}" cy="${Y(p.m)}" r="6" class="pt ${p.bad?'bad':''}"/><text x="${X(p.cg)+9}" y="${Y(p.m)-8}" class="pl">${p.n}</text>`:'').join('')}
   <text x="${(W+P.l)/2}" y="${H-6}" text-anchor="middle" class="ax">CG position [m aft of datum]</text>
   <text x="14" y="${(H-P.b)/2}" text-anchor="middle" class="ax" transform="rotate(-90 14 ${(H-P.b)/2})">Flight mass [kg]</text></svg>`;
}
function renderMB(){
  const box=$('ac_mb');
  if(!FLEET.length){box.innerHTML=`<div class="card"><span class="pill warn">Add an aircraft first</span><p>Mass and balance needs each aircraft's empty mass and moment from its current Mass and Balance Report. Add them under <b>Fleet</b>.</p><button type="button" class="primary" data-go="fleet">Open Fleet</button></div>`;return}
  const r=mbCalc();const a=r.a;const f=v=>isFinite(v)?v.toFixed(1):'—',f2=v=>isFinite(v)?v.toFixed(2):'—',f3=v=>isFinite(v)?v.toFixed(3):'—';
  const zc=check(r.zf[0],r.zf[1]),tc=check(r.to[0],r.to[1]),lc=check(r.ld[0],r.ld[1]);
  const all=[...tc.errs.map(e=>'Take-off: '+e),...lc.errs.map(e=>'Landing: '+e),...zc.errs.map(e=>'Zero fuel: '+e)];
  const capL=num(a.cap);const overCap=isFinite(capL)&&num(MB.fuel)>capL;const bagMax=num(a.bagmax);const overBag=isFinite(bagMax)&&num(MB.bag)>bagMax;
  if(overCap)all.push(`Fuel ${MB.fuel} L exceeds usable ${capL} L`);if(overBag)all.push(`Baggage exceeds ${bagMax} kg`);
  const tripAuto=NL._route&&num(NL.ff)>0?(NL._route*num(NL.ff)/60).toFixed(1):'';
  box.innerHTML=`<div class="grid2">
   <div class="card"><h2>Loading · ${esc(a.reg)}</h2>
    <div class="fields two">
     <label>Aircraft<select id="mb_acft">${FLEET.map(x=>`<option ${x.reg===a.reg?'selected':''}>${esc(x.reg)}</option>`).join('')}</select></label>
     <label>Front seats kg<input id="mb_front" inputmode="decimal" value="${esc(MB.front)}"></label>
     <label>Rear seats kg<input id="mb_rear" inputmode="decimal" value="${esc(MB.rear)}"></label>
     <label>Baggage kg<input id="mb_bag" inputmode="decimal" value="${esc(MB.bag)}"></label>
     <label>Fuel at take-off L<input id="mb_fuel" inputmode="decimal" value="${esc(MB.fuel)}" placeholder="${isFinite(capL)?'max '+capL:''}"></label>
     <label>Trip fuel L<input id="mb_trip" inputmode="decimal" value="${esc(MB.trip)}" placeholder="${tripAuto?'navlog: '+tripAuto:''}"></label>
    </div>${tripAuto&&!MB.trip?`<button type="button" id="mb_usetrip">Use navlog trip fuel (${tripAuto} L)</button>`:''}
    <div class="tbl" style="margin-top:12px"><table><thead><tr><th>Item</th><th>Arm m</th><th>Mass kg</th><th>Moment kgm</th></tr></thead><tbody>
     ${r.rows.map((x,i)=>`<tr><td>${x[0]}</td><td>${i?[AFM.arms.front,AFM.arms.rear,AFM.arms.bag][i-1].toFixed(2):f3(x[2]/x[1])}</td><td>${f(x[1])}</td><td>${f2(x[2])}</td></tr>`).join('')}
     <tr class="sum"><td>Zero fuel</td><td>${f3(zc.cg)}</td><td>${f(r.zf[0])}</td><td>${f2(r.zf[1])}</td></tr>
     <tr><td>Fuel ${esc(MB.fuel||0)} L × ${AFM.density}</td><td>${AFM.arms.fuel.toFixed(2)}</td><td>${f(r.fuelKg)}</td><td>${f2(r.fuelKg*AFM.arms.fuel)}</td></tr>
     <tr class="sum"><td>Take-off</td><td>${f3(tc.cg)}</td><td>${f(r.to[0])}</td><td>${f2(r.to[1])}</td></tr>
     <tr><td>Trip fuel ${esc(MB.trip||0)} L</td><td>${AFM.arms.fuel.toFixed(2)}</td><td>−${f(r.tripKg)}</td><td>−${f2(r.tripKg*AFM.arms.fuel)}</td></tr>
     <tr class="sum"><td>Landing</td><td>${f3(lc.cg)}</td><td>${f(r.ld[0])}</td><td>${f2(r.ld[1])}</td></tr></tbody></table></div></div>
   <div class="card"><div class="row between"><h2 style="margin:0">CG envelope</h2><span class="pill ${all.length?'bad':'good'}">${all.length?'Out of limits':'Within limits'}</span></div>
    ${envelopeSVG([{n:'ZF',m:r.zf[0],cg:zc.cg,bad:zc.errs.length},{n:'TO',m:r.to[0],cg:tc.cg,bad:tc.errs.length},{n:'LDG',m:r.ld[0],cg:lc.cg,bad:lc.errs.length}])}
    ${all.length?`<ul class="errs">${all.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:`<p class="sub">Take-off category: <b>${tc.cat}</b>. Forward limit 2.40 m up to 980 kg, rising linearly to 2.46 m at 1150 kg; aft limit 2.59 m.</p>`}
    <div class="facts" style="margin-top:10px">
     <div class="ro"><div class="k">Rotate vR</div><div class="v">${Math.round(interp(AFM.vr,r.to[0]))}<small> KIAS</small></div></div>
     <div class="ro"><div class="k">Initial climb</div><div class="v">${Math.round(interp(AFM.climb,r.to[0]))}<small> KIAS</small></div></div>
     <div class="ro"><div class="k">Approach (LDG)</div><div class="v">${Math.round(interp(AFM.vapp,r.ld[0]))}<small> KIAS</small></div></div>
    </div><p class="sub">Speeds interpolated between the AFM values for 850, 1000 and 1150 kg.</p></div></div>`;
}
$('ac_mb').addEventListener('input',e=>{const id=e.target.id;if(!id||!id.startsWith('mb_')||id==='mb_acft')return;MB[id.slice(3)]=e.target.value;saveMB();clearTimeout(renderMB._t);renderMB._t=setTimeout(()=>{const f=document.activeElement&&document.activeElement.id;renderMB();if(f&&$(f)){$(f).focus();const v=$(f).value;try{$(f).setSelectionRange(v.length,v.length)}catch(x){}}},500)});
$('ac_mb').addEventListener('change',e=>{if(e.target.id==='mb_acft'){NL.acft=e.target.value;saveNL();renderMB()}});
$('ac_mb').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.go)tab(b.dataset.go);if(b.id==='mb_usetrip'){MB.trip=(NL._route*num(NL.ff)/60).toFixed(1);saveMB();renderMB()}});

/* ---------- fleet ---------- */
function renderFleet(){
  $('ac_fleet').innerHTML=`<div class="card"><h2>Fleet</h2><p class="sub">Enter each aircraft from its current Mass and Balance Report. Stored on this device; use Settings → Backup to copy to other devices.</p>
   <div class="tbl"><table><thead><tr><th>Reg</th><th>Empty mass kg</th><th>Empty moment kgm</th><th>Empty CG m</th><th>Usable fuel L</th><th>Max baggage kg</th><th></th></tr></thead><tbody>
   ${FLEET.map((f,i)=>`<tr><td><input data-x="reg" data-i="${i}" value="${esc(f.reg)}"></td><td><input data-x="em" data-i="${i}" value="${esc(f.em)}" inputmode="decimal"></td><td><input data-x="emom" data-i="${i}" value="${esc(f.emom)}" inputmode="decimal"></td><td>${isFinite(num(f.emom)/num(f.em))?(num(f.emom)/num(f.em)).toFixed(3):'—'}</td><td><input data-x="cap" data-i="${i}" value="${esc(f.cap||'')}" inputmode="decimal" placeholder="from AFM"></td><td><input data-x="bagmax" data-i="${i}" value="${esc(f.bagmax||'')}" inputmode="decimal" placeholder="from AFM"></td><td><button type="button" class="x" data-del="${i}" aria-label="Delete aircraft">×</button></td></tr>`).join('')||'<tr><td colspan="7" class="wrap" style="color:var(--muted)">No aircraft yet.</td></tr>'}
   </tbody></table></div>
   <div class="row" style="margin-top:10px"><button type="button" class="primary" id="fl_add">Add aircraft</button><button type="button" id="fl_ex">Add AFM example (735 kg / 1820 kgm)</button></div>
   <p class="sub">The AFM example is for practice only. It is not any real aircraft's weighing.</p></div>`;
}
$('ac_fleet').addEventListener('change',e=>{const t=e.target;if(t.dataset.x==null)return;FLEET[+t.dataset.i][t.dataset.x]=t.value.trim().toUpperCase?t.value.trim():t.value;if(t.dataset.x==='reg')FLEET[+t.dataset.i].reg=t.value.trim().toUpperCase();saveFleet();renderFleet();fillHeader()});
$('ac_fleet').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='fl_add'){FLEET.push({reg:'SX-',em:'',emom:'',cap:'',bagmax:''});saveFleet();renderFleet()}
  if(b.id==='fl_ex'){if(!FLEET.some(f=>f.reg==='EXAMPLE')){FLEET.push({reg:'EXAMPLE',em:'735',emom:'1820',cap:'',bagmax:''});saveFleet()}renderFleet();fillHeader()}
  if(b.dataset.del!=null){const i=+b.dataset.del;if(b.textContent!=='Delete?'){b.textContent='Delete?';setTimeout(()=>{if(b.isConnected)b.textContent='×'},3000);return}FLEET.splice(i,1);saveFleet();renderFleet();fillHeader()}});

/* ---------- performance ---------- */
let PF=S.get('pf',{});const savePF=()=>S.set('pf',PF);
function renderPerf(){
  const r=FLEET.length?mbCalc():null;const W=E.wpts;const dep=W[0]&&E.BY[W[0].n]?W[0].n:(PF.apt||'LGIR');const dst=W.length>1&&E.BY[W[W.length-1].n]?W[W.length-1].n:dep;
  const apt=E.BY[PF.apt||dep]||E.BY.LGIR;PF.apt=apt.icao;
  const ends=[];(apt.rwys||[]).forEach(x=>{const h=x.hdg!=null?x.hdg:num(x.le)*10;ends.push({id:x.le,h,len:x.len_ft});if(x.he)ends.push({id:x.he,h:(h+180)%360,len:x.len_ft})});
  const rw=ends.find(x=>x.id===PF.rwy)||ends[0]||{id:'',h:0,len:0};
  const elev=apt.elev,qnh=num(PF.qnh),oat=num(PF.oat),wd=num(PF.wd),ws=num(PF.ws)||0;
  const pa=isFinite(qnh)?elev+(1013.25-qnh)*27:NaN,isa=15-2*pa/1000,da=pa+120*(oat-isa);
  const hw=isFinite(wd)?ws*Math.cos(rad(wd-rw.h)):NaN,xw=isFinite(wd)?ws*Math.sin(rad(wd-rw.h)):NaN;
  const tom=r?r.to[0]:NaN,ldm=r?r.ld[0]:NaN;const fac=(v,base,grass,slope,sf)=>{v=num(v);if(!isFinite(v))return NaN;return v*(1+(grass||0)/100)*(1+Math.max(0,slope||0)*5/100)*(sf||1)};
  const sf=num(PF.sf)||1;const gT=AFM.grassTO[PF.grass||'none'],gL=AFM.grassLDG[PF.grass||'none'];
  const toda=rw.len?Math.round(rw.len/3.28084):NaN;
  const slopeUp=num(PF.slope)||0;
  const tod=fac(PF.tod,0,0,slopeUp,sf),todr=fac(PF.todr,0,gT,0,sf),ld=fac(PF.ld,0,0,-slopeUp,sf),ldr=fac(PF.ldr,0,gL,0,sf);
  const res=(v,lim)=>isFinite(v)?`<b class="${isFinite(lim)&&v>lim?'badtxt':''}">${Math.round(v)} m</b>${isFinite(lim)?` <span class="sub">of ${lim} m</span>`:''}`:'—';
  $('ac_perf').innerHTML=`<div class="grid2"><div class="card"><h2>Conditions</h2>
   <div class="fields three">
    <label>Aerodrome<select id="pf_apt">${E.APTS.map(x=>`<option ${x.icao===apt.icao?'selected':''}>${x.icao}</option>`).join('')}</select></label>
    <label>Runway<select id="pf_rwy">${ends.map(x=>`<option ${x.id===rw.id?'selected':''}>${esc(x.id)}</option>`).join('')}</select></label>
    <label>QNH hPa<input id="pf_qnh" inputmode="decimal" value="${esc(PF.qnh||'')}"></label>
    <label>OAT °C<input id="pf_oat" inputmode="decimal" value="${esc(PF.oat||'')}"></label>
    <label>Wind °<input id="pf_wd" inputmode="decimal" value="${esc(PF.wd||'')}"></label>
    <label>Wind kt<input id="pf_ws" inputmode="decimal" value="${esc(PF.ws||'')}"></label>
    <label>Surface<select id="pf_grass"><option value="none">Paved</option><option value="short" ${PF.grass==='short'?'selected':''}>Grass ≤5 cm</option><option value="mid" ${PF.grass==='mid'?'selected':''}>Grass 5–10 cm</option><option value="long" ${PF.grass==='long'?'selected':''}>Grass &gt;10 cm</option></select></label>
    <label>Uphill slope % (T/O)<input id="pf_slope" inputmode="decimal" value="${esc(PF.slope||'')}" placeholder="0"></label>
    <label>School safety factor<input id="pf_sf" inputmode="decimal" value="${esc(PF.sf||'')}" placeholder="1.0"></label>
   </div>
   <div class="facts">
    <div class="ro"><div class="k">Pressure alt</div><div class="v">${isFinite(pa)?Math.round(pa):'—'}<small> ft</small></div></div>
    <div class="ro"><div class="k">Density alt</div><div class="v">${isFinite(da)?Math.round(da):'—'}<small> ft</small></div></div>
    <div class="ro"><div class="k">${hw<0?'Tailwind':'Headwind'}</div><div class="v"${hw<0?' style="color:var(--bad)"':''}>${isFinite(hw)?Math.abs(hw).toFixed(0):'—'}<small> kt</small></div></div>
    <div class="ro"><div class="k">Crosswind</div><div class="v">${isFinite(xw)?Math.abs(xw).toFixed(0):'—'}<small> kt</small></div></div>
    <div class="ro"><div class="k">T/O mass</div><div class="v">${isFinite(tom)?Math.round(tom):'—'}<small> kg</small></div></div>
    <div class="ro"><div class="k">LDG mass</div><div class="v">${isFinite(ldm)?Math.round(ldm):'—'}<small> kg</small></div></div>
   </div><p class="sub">Enter these values on the AFM charts below (charts use 1013 hPa pressure altitude). For tailwind use the tailwind lines. Masses come from Mass &amp; balance.</p></div>
   <div class="card"><h2>Results from the charts</h2>
    <div class="fields two">
     <label>T/O distance 50 ft (m)<input id="pf_tod" inputmode="decimal" value="${esc(PF.tod||'')}"></label>
     <label>T/O ground roll (m)<input id="pf_todr" inputmode="decimal" value="${esc(PF.todr||'')}"></label>
     <label>LDG distance 50 ft (m)<input id="pf_ld" inputmode="decimal" value="${esc(PF.ld||'')}"></label>
     <label>LDG ground roll (m)<input id="pf_ldr" inputmode="decimal" value="${esc(PF.ldr||'')}"></label>
    </div>
    <div class="tbl"><table><thead><tr><th>Corrected (surface, slope, × safety factor)</th><th>Required</th></tr></thead><tbody>
     <tr><td>Take-off distance over 50 ft</td><td>${res(tod,toda)}</td></tr><tr><td>Take-off ground roll</td><td>${res(todr,toda)}</td></tr>
     <tr><td>Landing distance over 50 ft</td><td>${res(ld,toda)}</td></tr><tr><td>Landing ground roll</td><td>${res(ldr,toda)}</td></tr></tbody></table></div>
    <p class="sub">Runway ${esc(rw.id)} length ${isFinite(toda)?toda+' m':'unknown'} (OurAirports). Use declared TORA/TODA/LDA from AIP AD 2.13. Corrections: grass T/O roll +10/15/25 %, LDG roll +5/15/25 %; 2 % uphill ≈ +10 % T/O distance (AFM 5.3.7, 5.3.11). Reference: landing ISA MSL 1150 kg flaps LDG ${AFM.ldgRef.dist} m, roll ${AFM.ldgRef.roll} m.</p></div></div>
   <div class="card"><h2>AFM charts</h2><div class="chips">${[['to-charts','Take-off distance & roll'],['to-notes','Take-off notes 5.3.7'],['climb','Climb performance'],['da-fuelflow','Density altitude & fuel flow'],['ldg-flapsldg','Landing · flaps LDG'],['ldg-flapsup','Landing · flaps UP'],['ldg-notes','Landing notes 5.3.11'],['mb','Mass & balance 6.4']].map(([f,n])=>`<button type="button" class="chip" data-afm="${f}">${n}</button>`).join('')}</div></div>`;
}
$('ac_perf').addEventListener('change',e=>{const id=e.target.id;if(!id||!id.startsWith('pf_'))return;PF[id.slice(3)]=e.target.value;if(id==='pf_apt')PF.rwy='';savePF();renderPerf()});
$('ac_perf').addEventListener('click',e=>{const b=e.target.closest('[data-afm]');if(!b)return;openAFM(b.dataset.afm,b.textContent)});
function openAFM(f,title){const img=new Image();img.onload=()=>E.viewImage('afm/'+f+'.webp',img.naturalWidth,img.naturalHeight,'DA40 D AFM · '+title);img.src='afm/'+f+'.webp'}

/* ---------- tabs ---------- */
function tab(t){document.querySelectorAll('#ac_tabs button').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===t));['mb','perf','fleet'].forEach(k=>$('ac_'+k).hidden=k!==t);
  if(t==='mb')renderMB();if(t==='perf')renderPerf();if(t==='fleet')renderFleet();S.set('actab',t)}
$('ac_tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b)tab(b.dataset.t)});
window.addEventListener('hashchange',()=>{if(location.hash==='#acft')tab(S.get('actab','mb'));if(location.hash==='#nav'){fillHeader();renderAtis();E.calcNav()}});

window.PLAN={renderLog,AFM,mbCalc,check};
fillHeader();renderAtis();tab(S.get('actab','mb'));E.calcNav();
})();
/* ---------- school preflight paperwork (Student Preflight Checklist and Guide) ---------- */
(function(){
const S=window.EFB.S,esc=window.EFB.esc;
const LISTS={
  dual:['General Declaration (2 copies)','METAR / TAF','NOTAMs','Preflight risk assessment matrix (CEA-SFT-10)','Flight plan'],
  solo:['General Declaration (2 copies)','METAR / TAF','NOTAMs','Preflight risk assessment matrix (CEA-SFT-10)','Mass and balance','Pre-flight performance','Flight plan','Student solo authorization form (CEA-TRN-06)'],
  nav:['General Declaration (2 copies)','METAR / TAF','NOTAMs','Preflight risk assessment matrix (CEA-SFT-10)','Mass and balance','Pre-flight performance','Navigation log (CEA-OPS-06)','Flight plan','Solo qualifying cross country training form (CEA-TRN-05), if required','Student solo authorization form (CEA-TRN-06)']};
const page=document.querySelector('#v-brief .page');if(!page)return;
const card=document.createElement('div');card.className='card';card.id='pp';page.insertBefore(card,page.children[1]);
function render(){const st=S.get('pp',{}),today=window.EFB.todayISO();if(st.d!==today){st.d=today;st.t=st.t||'dual';st.c={}}
  const l=LISTS[st.t];const n=l.filter((_,i)=>st.c[st.t+i]).length;
  card.innerHTML=`<div class="row between"><h2 style="margin:0">Preflight paperwork</h2><span class="pill ${n===l.length?'good':'warn'}">${n}/${l.length}</span></div>
   <div class="seg" style="margin:10px 0">${[['dual','Dual training'],['solo','First / local solo'],['nav','Navigation solo']].map(([k,t])=>`<button type="button" data-pt="${k}" aria-pressed="${st.t===k}">${t}</button>`).join('')}</div>
   ${l.map((x,i)=>`<label class="chk"><input type="checkbox" data-pi="${i}" ${st.c[st.t+i]?'checked':''}><span class="grow">${i+1}. ${esc(x)}</span></label>`).join('')}`;
  S.set('pp',st)}
card.addEventListener('click',e=>{const b=e.target.closest('[data-pt]');if(!b)return;const st=S.get('pp',{});st.t=b.dataset.pt;S.set('pp',st);render()});
card.addEventListener('change',e=>{const i=e.target.dataset.pi;if(i==null)return;const st=S.get('pp',{});st.c[st.t+i]=e.target.checked;S.set('pp',st);render()});
render();
})();
