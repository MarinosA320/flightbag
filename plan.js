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
/* School fleet from "Aircraft Significant Technical Information", Cretan Eagle Aviation, issue 02-10-23 rev. 01 (uncontrolled copy). */
const SCHOOL_FLEET=[
 {reg:'F-GZAR',em:'832',arm:'2.410',cap:'106',bagmax:'30',ff:'19',warn:'With this CG arm, ordinary loadings come out forward of the AFM limit. Confirm the empty mass, moment and datum against the aircraft\'s Mass and Balance Report before relying on it.',fpl:{type:'DA40',wtc:'L',equip:'SDY/S',rules:'VFR or IFR',speed:'N0100',endur:'0630',colour:'WHITE WITH RED STRIPES'},oil:'6.0'},
 {reg:'OE-DQA',em:'837',arm:'2.520',cap:'106',bagmax:'30',ff:'19',fpl:{type:'DA40',wtc:'L',equip:'SDY/S',rules:'VFR or IFR',speed:'N0100',endur:'0630',colour:'WHITE WITH RED STRIPES'},oil:'6.0',warn:'Empty mass and CG marked UPDATE on the school sheet. Confirm against the current Mass and Balance Report.'},
 {reg:'F-GUVX',em:'796',arm:'2.370',cap:'106',bagmax:'30',ff:'19',warn:'With this CG arm, ordinary loadings come out forward of the AFM limit. Confirm the empty mass, moment and datum against the aircraft\'s Mass and Balance Report before relying on it.',fpl:{type:'DA40',wtc:'L',equip:'SY/S',rules:'VFR ONLY',speed:'N0100',endur:'0630',colour:'WHITE WITH RED STRIPES'},oil:'6.0'}];
SCHOOL_FLEET.forEach(s=>{s.emom=(num(s.em)*num(s.arm)).toFixed(2);s.src='School sheet 02-10-23 rev. 01'});
if(!S.get('fleetSeeded',false)){FLEET=[...SCHOOL_FLEET.filter(s=>!FLEET.some(f=>f.reg===s.reg)).map(s=>JSON.parse(JSON.stringify(s))),...FLEET];S.set('fleetSeeded',true);saveFleet()}
if(!NL.acft&&FLEET[0]){NL.acft=FLEET[0].reg}
if(!NL.ff){const a0=FLEET.find(f=>f.reg===NL.acft);if(a0&&a0.ff)NL.ff=a0.ff}
saveNL();
const acft=()=>FLEET.find(f=>f.reg===NL.acft)||FLEET[0]||null;

/* ---------- navlog: exact replica of CEA-OPS-06, editable on screen and printed as-is ---------- */
const COLS=[128,100,117,90,134,100,100,101,102,154,102,101,102,117,101,102,134]; // px widths taken from the paper form (sum 1885)
const pct=w=>(w/1885*100).toFixed(3)+'%';
const ROWS=9;
function fillHeader(){}
function vin(attrs,val,cls){return `<input class="pin ${cls||''}" ${attrs} value="${esc(val==null?'':val)}" autocomplete="off">`}
function ftCell(from,to,idx,editable){return `<td class="ft"><span class="f">${editable?esc(from):''}</span><span class="t">${editable?esc(to):''}</span></td>`}
function renderLog(L){
  const box=$('cea');if(!box)return;
  let clock=parseHM(NL.tot);let tt=0;const legRows=[];
  L.forEach(l=>{const b=l.b;const t=Math.round(l.ete);tt+=isFinite(t)?t:0;const eta=isFinite(clock)&&isFinite(t)?clock+t:NaN;const ata=parseHM(b.ata);clock=isFinite(ata)?ata:eta;legRows.push({l,b,t,eta})});
  NL._route=tt;
  const vr=num($('n_var')&&$('n_var').value);const varTxt=isFinite(vr)?Math.abs(vr)+(vr>=0?'E':'W'):'5E';
  const rows=[];
  for(let r=0;r<Math.max(ROWS,legRows.length);r++){const x=legRows[r];
    if(!x){rows.push(`<tr class="leg">${ftCell('','',r)}<td></td><td></td><td></td><td class="wv"><span class="sl">/</span></td><td></td><td></td><td></td><td></td>${ftCell('','',r)}<td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`);continue}
    const {l,b,t,eta}=x;const i=l.i;
    rows.push(`<tr class="leg" data-i="${i}">${ftCell(l.a.n,b.n,r,true)}
      <td>${vin(`data-f="msa"`,b.msa)}</td><td>${vin(`data-f="alt"`,b.alt)}</td>
      <td>${vin(`data-f="tas" data-d="${Math.round(l.tas)||''}"`,b.tas||Math.round(l.tas)||'',b.tas?'':'def')}</td>
      <td class="wv">${vin(`data-f="wd" data-d="${isFinite(l.wd)?p3(l.wd):''}"`,b.wd||(isFinite(l.wd)?p3(l.wd):''),'w '+(b.wd?'':'def'))}<span class="sl">/</span>${vin(`data-f="ws" data-d="${isFinite(l.ws)?Math.round(l.ws):''}"`,b.ws||(isFinite(l.ws)?Math.round(l.ws):''),'w '+(b.ws?'':'def'))}</td>
      <td>${p3(l.tc)}</td><td>${isFinite(l.wca)?(l.wca>=0?'+':'')+Math.round(l.wca):''}</td><td>${isFinite(l.th)?p3(l.th):''}</td><td><b>${varTxt}</b></td>
      ${ftCell(l.a.n,b.n,r,true)}<td>${vin(`data-f="alt"`,b.alt)}</td>
      <td><b>${isFinite(l.mh)?p3(l.mh):''}</b></td><td>${isFinite(l.gs)?Math.round(l.gs):''}</td><td>${l.d.toFixed(1)}</td><td><b>${isFinite(t)?t:''}</b></td>
      <td>${hm(eta)}</td><td>${vin(`data-f="ata" placeholder=""`,b.ata,'ata')}</td></tr>`)}
  const A=NL.atis=NL.atis||{},F=NL.fuel=NL.fuel||{},C=NL.comm=NL.comm||{};
  const ff=num(NL.ff),res=isFinite(num(F.reserve))?num(F.reserve):45,mar=num(F.margin)||0,req=tt+res,car=req+mar;
  const Lt=m=>ff>0&&m?(m*ff/60).toFixed(1):'';
  const st=commStations();const auto=commAuto(st);
  const cv=(k,d)=>esc(C[k]!=null?C[k]:(d||''));
  const ac=FLEET.length?`<select class="pin" id="cea_acft">${FLEET.map(f=>`<option ${f.reg===NL.acft?'selected':''}>${esc(f.reg)}</option>`).join('')}</select>`:vin('data-h="acft"',NL.acft);
  const d=(NL.date||E.todayISO()).split('-');
  box.innerHTML=`
  <div class="cea-top"><img src="afm/cea-logo.png" alt="Cretan Eagle Aviation Flight Academy" class="cea-logo">
    <div class="cea-addr">Cretan Eagle Aviation Ltd.,<br>Nikos Kazantzakis International Airport, GR-71601, Heraklion, Crete, Greece<br>Tel: +30 2810 331 890 / <u>www.cretaneagle.gr</u> / <u>info@cretaneagle.gr</u></div>
    <div class="cea-ttl">VFR Navigation Flight Log Form</div></div>
  <div class="cea-bar"><span>VFR Navigation Flight Log Form</span><span>CEA-OPS-06</span></div>
  <div class="cea-note">All information contained below is strictly confidential and will become part of your <b>OPERATION</b> record. Please complete clearly in black CAPITAL letters.</div>
  <table class="cea-t cea-head"><colgroup><col style="width:14%"><col style="width:26%"><col style="width:6.2%"><col style="width:14%"><col style="width:8.8%"><col style="width:12.5%"><col style="width:4.8%"><col style="width:13.7%"></colgroup>
   <tr><th>Pilot in Command<br>(PIC)</th><td>${vin('data-h="pic"',NL.pic,'big')}</td><th>Aircraft</th><td>${ac}</td><th>Date</th><td class="dt">${vin('data-h="dd" maxlength="2"',d[2])}<span>/</span>${vin('data-h="mm" maxlength="2"',d[1])}<span>/</span>${vin('data-h="yy" maxlength="4"',d[0],'yy')}</td><th>T/O<br>TIME</th><td>${vin('data-h="tot" placeholder=":" maxlength="5"',NL.tot,'big')}</td></tr></table>
  <table class="cea-t cea-legs"><colgroup>${COLS.map(w=>`<col style="width:${pct(w)}">`).join('')}</colgroup>
   <tr class="lg"><td class="lgy lgl"><u>LEGEND</u></td><td class="lgy" colspan="2">MSA - MINIMUM SAFE ALTITUDE<br>W/V - WIND HEADING/ VELOCITY</td><td class="lgy" colspan="2">T(T) - TRUE TRACK<br>H(T) - TRUE HEADING<br>H(M) - MAGNETIC HEADING</td><td class="lgy" colspan="2">VAR - VARIATION<br>TAS - TRUE AIRSPEED<br>GS - GROUNDSPEED</td><td class="lgy" colspan="2">ETA - ESTIMATED TIME OF ARRIVAL<br>ATA - ACTUAL TIME OF ARRIVAL<br>ETD- ESTIMATED TIME OF DEPARTURE</td>
     <td class="freda" colspan="8"><b>F</b>uel <i>/</i> <b>R</b>adios <i>/</i> <b>E</b>ngine-FADEC <i>/</i> <b>D</b>irection <i>/</i> <b>A</b>ltitude</td></tr>
   <tr class="hd"><th class="ft"><span class="f">FROM</span><span class="t">TO</span></th><th>MSA</th><th class="sm">Route<br>Altitude<br>[ft]</th><th>TAS</th><th>W/V</th><th class="xs">TRACK<br>(T)</th><th class="xs">DRIFT [°]</th><th>H(T)</th><th>VAR</th>
     <th class="ft"><span class="f">FROM</span><span class="t">TO</span></th><th class="sm">Route<br>Altitude<br>[ft]</th><th>H(M)</th><th>GS</th><th class="sm">Distance<br>[nm]</th><th class="sm">Time<br>[mn]</th><th>ETA</th><th>ATA</th></tr>
   ${rows.join('')}</table>
  <div class="cea-bot">
   <table class="cea-t cea-atis"><colgroup><col style="width:9%"><col style="width:17%"><col style="width:25%"><col style="width:30%"><col style="width:19%"></colgroup>
    <tr class="s"><th colspan="5" class="sec">ATIS</th></tr>
    <tr><th colspan="2" class="l">STATION</th><td>${vin('data-a="stn"',A.stn)}</td><th class="l">Time</th><td>${vin('data-a="time"',A.time)}</td></tr>
    <tr><th colspan="2" class="l">Info</th><td>${vin('data-a="info"',A.info)}</td><th class="l">Temp</th><td>${vin('data-a="temp"',A.temp)}</td></tr>
    <tr><th colspan="2" class="l" rowspan="2">Wind<br>W/V</th><td rowspan="2">${vin('data-a="wind"',A.wind)}</td><th class="l">Dew point</th><td>${vin('data-a="dew"',A.dew)}</td></tr>
    <tr><th class="l">QNH</th><td>${vin('data-a="qnh"',A.qnh)}</td></tr>
    <tr><th colspan="2" class="l">Visibility</th><td>${vin('data-a="vis"',A.vis)}</td><th class="l">(T/L)</th><td>${vin('data-a="tl"',A.tl)}</td></tr>
    <tr><th rowspan="4" class="clouds"><span>Clouds</span></th><th class="l">FEW</th><td>${vin('data-a="few"',A.few)}</td><th class="l" rowspan="4">RWY/<br>Approach</th><td rowspan="2">${vin('data-a="rwy"',A.rwy)}</td></tr>
    <tr><th class="l">SCT</th><td>${vin('data-a="sct"',A.sct)}</td></tr>
    <tr><th class="l">BKN</th><td>${vin('data-a="bkn"',A.bkn)}</td><td rowspan="2">${vin('data-a="app"',A.app)}</td></tr>
    <tr><th class="l">OVC</th><td>${vin('data-a="ovc"',A.ovc)}</td></tr></table>
   <table class="cea-t cea-rem"><tr class="s"><th class="sec">REMARKS/NOTES</th></tr><tr><td><textarea class="pin" data-h="rem">${esc(NL.rem||'')}</textarea></td></tr></table>
   <table class="cea-t cea-comm"><colgroup><col style="width:24.4%"><col style="width:27.8%"><col style="width:22.9%"><col style="width:24.9%"></colgroup>
    <tr class="s"><th colspan="4" class="sec">COMM/NAV</th></tr>
    <tr><th>STATION</th>${[0,1,2].map(j=>`<td class="bg">${vin(`data-c="s${j}.id"`,C['s'+j+'.id']!=null?C['s'+j+'.id']:(auto[j]?auto[j].id:''),'b')}</td>`).join('')}</tr>
    ${[['ATIS','ATIS'],['TWR','TWR'],['APP','APP/RAD']].map(([k,l])=>`<tr><th>${l}</th>${[0,1,2].map(j=>`<td>${vin(`data-c="s${j}.${k}"`,C['s'+j+'.'+k]!=null?C['s'+j+'.'+k]:(auto[j]?auto[j][k]:''),'b')}</td>`).join('')}</tr>`).join('')}
    <tr><th rowspan="2">VOR</th>${[0,1,2].map(j=>`<td>${vin(`data-c="s${j}.VORid"`,C['s'+j+'.VORid']!=null?C['s'+j+'.VORid']:(auto[j]?auto[j].VORid:''),'b')}</td>`).join('')}</tr>
    <tr>${[0,1,2].map(j=>`<td>${vin(`data-c="s${j}.VOR"`,C['s'+j+'.VOR']!=null?C['s'+j+'.VOR']:(auto[j]?auto[j].VOR:''),'b')}</td>`).join('')}</tr>
    <tr class="adf"><th>ADF</th>${[0,1,2].map(j=>`<td>${vin(`data-c="s${j}.ADF"`,C['s'+j+'.ADF']!=null?C['s'+j+'.ADF']:(auto[j]?auto[j].ADF:''),'b')}</td>`).join('')}</tr></table>
   <table class="cea-t cea-fuel"><colgroup><col style="width:25.2%"><col style="width:16.5%"><col style="width:21%"><col style="width:6.2%"><col style="width:31.1%"></colgroup>
    <tr class="s"><th colspan="5" class="sec">FUEL CONSUMPTION</th></tr>
    <tr><th colspan="2">STAGE</th><th>MIN</th><th colspan="2" class="sm">LITERS</th></tr>
    <tr><th colspan="2">Route</th><td>${tt||''}</td><td colspan="2">${Lt(tt)}</td></tr>
    <tr><th colspan="2">Reserve</th><td>${vin('data-u="reserve"',F.reserve!=null&&F.reserve!==''?F.reserve:'45`')}</td><td colspan="2">${Lt(res)}</td></tr>
    <tr><th colspan="2">Fuel required</th><td>${tt?req:''}</td><td colspan="2">${tt?Lt(req):''}</td></tr>
    <tr><th colspan="2">Margin</th><td>${vin('data-u="margin"',F.margin)}</td><td colspan="2">${Lt(mar)}</td></tr>
    <tr><th colspan="2">Total carried</th><td>${tt?car:''}</td><td colspan="2">${tt?Lt(car):''}</td></tr>
    <tr><th class="xs">BLOCKS<br>OFF</th><td>${vin('data-u="off" maxlength="5"',F.off,'ts')}</td><th class="xs" colspan="2">T/O</th><td>${vin('data-u="to" maxlength="5"',F.to,'ts')}</td></tr>
    <tr><th class="xs">BLOCKS<br>ON</th><td>${vin('data-u="on" maxlength="5"',F.on,'ts')}</td><th class="xs" colspan="2">LAND</th><td>${vin('data-u="land" maxlength="5"',F.land,'ts')}</td></tr>
    <tr class="sig"><td colspan="5">SIGNATURE:</td></tr></table>
  </div>`;
  const fs=$('nl_fuelsum');if(fs){const ob=num(MB.fuel);fs.textContent=(ff>0?`Fuel flow ${ff} L/h`:'Set a planning fuel flow to get litres')+(isFinite(ob)?` · on board ${ob} L${ff>0?` = ${Math.floor(ob/ff)}:${pad2(Math.round(ob/ff*60%60))} endurance`:''}`:'')+(isFinite(ob)&&ff>0&&tt&&ob<car*ff/60?' · NOT ENOUGH FUEL FOR TOTAL CARRIED':'')}
}
function commStations(){const W=E.wpts;const ids=[];[W[0],W[W.length-1]].forEach(w=>{if(w&&E.BY[w.n]&&!ids.includes(w.n))ids.push(w.n)});if(!ids.length&&E.BY.LGIR)ids.push('LGIR');return ids.slice(0,3)}
function nearest(lat,lon,kind){let best=null,bd=25;(E.NAVAIDS||[]).forEach(n=>{const isV=/VOR|TACAN/.test(n[2]),isN=/NDB/.test(n[2]);if(kind==='VOR'?!isV:!isN)return;const d=nm({lat,lon},{lat:n[4],lon:n[5]});if(d<bd){bd=d;best=n}});return best}
function commAuto(st){const f=(a,t)=>{const x=a.freqs.find(q=>q[0]===t);return x?x[1]:''};
  return st.map(id=>{const a=E.BY[id];const v=nearest(a.lat,a.lon,'VOR'),n=nearest(a.lat,a.lon,'NDB');
    return {id,ATIS:f(a,'ATIS'),TWR:f(a,'TWR')||f(a,'AFIS')||f(a,'INFO'),APP:f(a,'APP'),VORid:v?v[0]:'',VOR:v?v[3]:'',ADF:n?(n[3]+(n[0]?' '+n[0]:'')):''}})}
/* events */
$('cea').addEventListener('change',e=>{const t=e.target;const v=t.value;
  if(t.id==='cea_acft'){NL.acft=v;const f=FLEET.find(x=>x.reg===v);if(f&&f.ff){NL.ff=f.ff;$('nl_ff').value=f.ff}saveNL();E.calcNav();return}
  if(t.dataset.f){const i=+t.closest('tr').dataset.i;const w=E.wpts[i];if(!w)return;w[t.dataset.f]=(t.dataset.d!=null&&v.trim()===t.dataset.d)?'':v.trim();E.saveRoute();E.calcNav();return}
  if(t.dataset.a){NL.atis[t.dataset.a]=v;saveNL();return}
  if(t.dataset.c){NL.comm[t.dataset.c]=v;saveNL();return}
  if(t.dataset.u){NL.fuel[t.dataset.u]=v.trim().replace('`','');saveNL();E.calcNav();return}
  const h=t.dataset.h;if(!h)return;
  if(h==='dd'||h==='mm'||h==='yy'){const q=s=>$('cea').querySelector(`[data-h="${s}"]`).value.padStart(2,'0');NL.date=`${q('yy')}-${q('mm')}-${q('dd')}`;saveNL();return}
  NL[h]=v;saveNL();if(h==='tot')E.calcNav()});
$('cea').addEventListener('input',e=>{if(e.target.dataset.h==='rem'){NL.rem=e.target.value;saveNL()}});
$('cea').addEventListener('focusin',e=>{const t=e.target;if((t.classList.contains('ata')||t.classList.contains('ts'))&&!t.value){t.value=nowHM();t.dispatchEvent(new Event('change',{bubbles:true}))}});
$('nl_ff').value=NL.ff||'';$('nl_ff').addEventListener('input',e=>{NL.ff=e.target.value;saveNL();E.calcNav()});
$('nl_print').onclick=()=>window.print();
$('nl_clear').onclick=e=>{const b=e.target;if(b.textContent!=='Tap again to clear'){b.textContent='Tap again to clear';setTimeout(()=>b.textContent='New blank log',3000);return}
  NL={ff:NL.ff,pic:NL.pic,acft:NL.acft};saveNL();E.wpts.forEach(w=>{['ata','msa','alt','tas','wd','ws'].forEach(k=>delete w[k])});E.saveRoute();E.calcNav();b.textContent='New blank log'};
function renderAtis(){}

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
  const LB=2.20462,INLB=86.796;const lb=v=>isFinite(v)?Math.round(v*LB).toLocaleString('en'):'',il=v=>isFinite(v)?Math.round(v*INLB).toLocaleString('en'):'';
  const k1=v=>isFinite(v)?(Math.round(v*10)/10).toString():'',k2=v=>isFinite(v)?(Math.round(v*100)/100).toString():'';
  const R=r.rows,fm=r.fuelKg*AFM.arms.fuel;const IN=[null,90.6,128.0,143.7];const L0=v=>Math.round(v*LB);const ilb=(kg,arm)=>L0(kg)*arm;
  const mi=[Math.round(R[0][2]*INLB),ilb(R[1][1],90.6),ilb(R[2][1],128.0),ilb(R[3][1],143.7)];const mz=mi.reduce((a,b)=>a+b,0),mf=ilb(r.fuelKg,103.5),mt=mz+mf;const fmt=v=>isFinite(v)?Math.round(v).toLocaleString('en'):'';
  const ok=!all.length;
  const row=(n,label,ex,mine)=>`<tr><td class="lbl"><span class="no">${n}.</span>${label}</td><td>${ex[0]}<i>${ex[1]}</i></td><td>${ex[2]}<i>${ex[3]}</i></td><td class="mine">${mine[0]}<i>${mine[1]}</i></td><td class="mine">${mine[2]}<i>${mine[3]}</i></td></tr>`;
  box.innerHTML=`<div class="card">
    <div class="row between"><h2 style="margin:0">Loading · ${esc(a.reg)}</h2><div class="row"><span class="pill ${ok?'good':'bad'}">${ok?'Within limits':'Out of limits'}</span><button type="button" class="primary" id="mb_print">Print / PDF</button></div></div>
    <div class="fields five" style="margin-top:10px">
     <label>Aircraft<select id="mb_acft">${FLEET.map(x=>`<option ${x.reg===a.reg?'selected':''}>${esc(x.reg)}</option>`).join('')}</select></label>
     <label>Front seats kg<input id="mb_front" inputmode="decimal" value="${esc(MB.front)}"></label>
     <label>Rear seats kg<input id="mb_rear" inputmode="decimal" value="${esc(MB.rear)}"></label>
     <label>Baggage kg<input id="mb_bag" inputmode="decimal" value="${esc(MB.bag)}"></label>
     <label>Usable fuel L<input id="mb_fuel" inputmode="decimal" value="${esc(MB.fuel)}" placeholder="${isFinite(capL)?'max '+capL:''}"></label>
    </div>
    ${a.warn?`<p><span class="pill warn">Check</span> ${esc(a.warn)}</p>`:''}${all.length?`<ul class="errs">${all.map(e=>`<li>${esc(e)}</li>`).join('')}</ul>`:''}
    <div class="row" style="gap:16px;flex-wrap:wrap">
     <label style="max-width:180px">Trip fuel L (landing)<input id="mb_trip" inputmode="decimal" value="${esc(MB.trip)}" placeholder="${tripAuto?'navlog: '+tripAuto:''}"></label>
     ${tripAuto&&!MB.trip?`<button type="button" id="mb_usetrip">Use navlog trip fuel (${tripAuto} L)</button>`:''}
     <span class="sub" style="margin:0">Landing: ${k1(r.ld[0])} kg, CG ${isFinite(lc.cg)?lc.cg.toFixed(3):'—'} m · vR ${Math.round(interp(AFM.vr,r.to[0]))} · initial climb ${Math.round(interp(AFM.climb,r.to[0]))} · approach ${Math.round(interp(AFM.vapp,r.ld[0]))} KIAS</span>
    </div></div>
   <div class="paperwrap"><div class="mbp">
    <div class="mbp-hd"><b>DA 40 D · Mass and Balance</b><span>${esc(a.reg)} · ${esc((NL.date||E.todayISO()).split('-').reverse().join('/'))}${NL.pic?' · '+esc(NL.pic):''}</span></div>
    <div class="mbp-grid">
    <table class="mbt"><colgroup><col style="width:42%"><col style="width:11.5%"><col style="width:14.5%"><col style="width:13%"><col style="width:19%"></colgroup>
     <tr class="h1"><th rowspan="2" class="ttl">CALCULATION OF<br>LOADING CONDITION</th><th colspan="2">DA 40 D<br>(Example)</th><th colspan="2">Your DA 40 D</th></tr>
     <tr class="h2"><th>Mass<br>[kg]<i>[lb]</i></th><th>Moment<br>[kgm]<i>[in.lb]</i></th><th>Mass<br>[kg]<i>[lb]</i></th><th>Moment<br>[kgm]<i>[in.lb]</i></th></tr>
     ${row(1,'Empty mass (from Mass and Balance Report)',['735','1620','1820','158,000'],[k1(R[0][1]),lb(R[0][1]),k2(R[0][2]),fmt(mi[0])])}
     ${row(2,'Front seats<br>Lever arm: 2.30 m <small>(90.6 in)</small>',['150','331','345','29,989'],[k1(R[1][1]),lb(R[1][1]),k2(R[1][2]),fmt(mi[1])])}
     ${row(3,'Rear seats<br>Lever arm: 3.25 m <small>(128.0 in)</small>',['150','331','487.5','42,368'],[k1(R[2][1]),lb(R[2][1]),k2(R[2][2]),fmt(mi[2])])}
     ${row(4,'Baggage<br>Lever arm: 3.65 m <small>(143.7 in)</small>',['0','0','0','0'],[k1(R[3][1]),lb(R[3][1]),k2(R[3][2]),fmt(mi[3])])}
     ${row(5,'Total mass and total moment with empty fuel tanks (Total of 1.-4.)',['1035','2282','2652.5','230,357'],[k1(r.zf[0]),lb(r.zf[0]),k2(r.zf[1]),fmt(mz)])}
     ${row(6,`On-board usable fuel <small>(0.84 kg/liter) (7.01 lb/US gal)</small><br>Lever arm: 2.63 m <small>(103.5 in)</small>${MB.fuel?` <b class="ltr">${esc(MB.fuel)} L</b>`:''}`,['100.8','222','265.10','23,001'],[k1(r.fuelKg),lb(r.fuelKg),k2(fm),fmt(mf)])}
     ${row(7,'Total mass and total moment with full fuel tanks (Total 5. plus 6.)',['1135.8','2504','2917.60','253,357'],[k1(r.to[0]),lb(r.to[0]),k2(r.to[1]),fmt(mt)])}
     <tr><td colspan="5" class="r8"><span class="no">8.</span>The total moments from rows 5 and 7 (${k2(r.zf[1])} and ${k2(r.to[1])} kgm) must be divided by the related total mass (${k1(r.zf[0])} and ${k1(r.to[0])} kg) and then located in Diagram 6.4.4 - PERMISSIBLE CENTER OF GRAVITY RANGE.<br>
      The CG positions are <b>${isFinite(zc.cg)?zc.cg.toFixed(3):'—'} m</b> and <b>${isFinite(tc.cg)?tc.cg.toFixed(3):'—'} m</b> <small>(${isFinite(zc.cg)?(zc.cg*39.3701).toFixed(2):'—'} and ${isFinite(tc.cg)?(tc.cg*39.3701).toFixed(2):'—'} in)</small>${ok?'; masses and CG fall into the permitted area, so this loading condition is <b>allowable</b>.':'; this loading condition is <b class="no-go">NOT allowable</b>.'}</td></tr>
    </table>
    <div class="mbd">${afmDiagram([{m:r.zf[0],cg:zc.cg,n:'5'},{m:r.to[0],cg:tc.cg,n:'7',main:1},{m:r.ld[0],cg:lc.cg,n:'LDG'}])}
     <p>The flight CG position must be within the following limits:</p>
     <p>Most forward flight CG:<br>&nbsp;&nbsp;2.40 m (94.5 in) aft of Datum Plane at 780 to 980 kg (1720 to 2161 lb)<br>&nbsp;&nbsp;2.46 m (96.9 in) aft of Datum Plane at 1150 kg (2535 lb)<br>&nbsp;&nbsp;linear variation between these values</p>
     <p>Most rearward flight CG:<br>&nbsp;&nbsp;2.59 m (102.0 in) aft of Datum Plane</p></div>
    </div></div></div>`;
}
function afmDiagram(pts){
  const W=600,H=440,L=95,Rr=505,T=80,B=375;const x0=2.40,x1=2.60,y0=750,y1=1150;
  const X=v=>L+(v-x0)/(x1-x0)*(Rr-L),Y=v=>B-(v-y0)/(y1-y0)*(B-T);
  let g='';
  for(let v=750;v<=1150;v+=50){g+=`<line x1="${L}" x2="${Rr}" y1="${Y(v)}" y2="${Y(v)}" class="g"/><text x="${L-8}" y="${Y(v)+6}" text-anchor="end" class="n">${v}</text>`}
  for(let v=2.40;v<=2.6001;v+=0.05)g+=`<line x1="${X(v)}" x2="${X(v)}" y1="${B}" y2="${B+6}" class="k"/><text x="${X(v)}" y="${B+26}" text-anchor="middle" class="n">${v.toFixed(2)}</text>`;
  for(let i=94;i<=102;i+=2){const m=i/39.3701;g+=`<line x1="${X(m)}" x2="${X(m)}" y1="${T-22}" y2="${T-28}" class="k"/><text x="${X(m)}" y="${T-32}" text-anchor="middle" class="n">${i}</text>`}
  for(let i=1800;i<=2600;i+=200){const kg=i/2.20462;g+=`<line x1="${Rr+20}" x2="${Rr+26}" y1="${Y(kg)}" y2="${Y(kg)}" class="k"/><text x="${Rr+30}" y="${Y(kg)+6}" class="n">${i}</text>`}
  const env=[[2.40,780],[2.40,980],[2.46,1150],[2.59,1150],[2.59,780]].map(p=>X(p[0])+','+Y(p[1])).join(' ');
  const mk=p=>{if(!isFinite(p.cg)||!isFinite(p.m))return'';const x=X(p.cg),y=Y(p.m);const s=p.main?9:7;
    return `<g class="${p.main?'cgm':'cgo'}"><rect x="${x-s}" y="${y-s}" width="${2*s}" height="${2*s}"/><line x1="${x-s}" y1="${y-s}" x2="${x+s}" y2="${y+s}"/><line x1="${x+s}" y1="${y-s}" x2="${x-s}" y2="${y+s}"/></g><text x="${x+s+3}" y="${y+(p.n==='LDG'?18:4)}" class="pl">${p.n}</text>`};
  return `<svg viewBox="0 0 ${W} ${H}" class="afmd">
   <text x="${(L+Rr)/2}" y="16" text-anchor="middle" class="t">Center of Gravity Position [in]</text>
   <line x1="${L}" x2="${Rr}" y1="${T-22}" y2="${T-22}" class="ax"/>
   <line x1="${Rr+20}" x2="${Rr+20}" y1="${T-22}" y2="${B+4}" class="ax"/>
   <rect x="${L}" y="${T}" width="${Rr-L}" height="${B-T}" class="frame"/>${g}
   <polygon points="${env}" class="env"/><line x1="${X(2.40)}" x2="${X(2.59)}" y1="${Y(980)}" y2="${Y(980)}" class="envl"/>
   <rect x="${X(2.458)}" y="${Y(1146)}" width="${X(2.585)-X(2.458)}" height="20" class="lb"/><text x="${X(2.515)}" y="${Y(1146)+15}" text-anchor="middle" class="s">1150 kg / 2535 lb</text>
   <text x="${X(2.52)}" y="${Y(1080)}" text-anchor="middle" class="s2">Normal</text>
   <rect x="${X(2.45)}" y="${Y(976)}" width="${X(2.58)-X(2.45)}" height="20" class="lb"/><text x="${X(2.515)}" y="${Y(976)+15}" text-anchor="middle" class="s">980 kg / 2161 lb</text>
   <text x="${X(2.50)}" y="${Y(875)}" text-anchor="middle" class="s2">Utility &amp; Normal</text>
   <rect x="${X(2.45)}" y="${Y(776)}" width="${X(2.58)-X(2.45)}" height="20" class="lb"/><text x="${X(2.515)}" y="${Y(776)+15}" text-anchor="middle" class="s">780 kg / 1720 lb</text>
   ${pts.map(mk).join('')}
   <text x="${(L+Rr)/2}" y="${H-14}" text-anchor="middle" class="t">Center of Gravity Position [m]</text>
   <text x="24" y="${(T+B)/2}" text-anchor="middle" class="t" transform="rotate(-90 24 ${(T+B)/2})">Flight Mass [kg]</text>
   <text x="${W-8}" y="${(T+B)/2}" text-anchor="middle" class="t" transform="rotate(-90 ${W-8} ${(T+B)/2})">Flight Mass [lb]</text>
  </svg>`;
}
$('ac_mb').addEventListener('input',e=>{const id=e.target.id;if(!id||!id.startsWith('mb_')||id==='mb_acft')return;MB[id.slice(3)]=e.target.value;saveMB();clearTimeout(renderMB._t);renderMB._t=setTimeout(()=>{const f=document.activeElement&&document.activeElement.id;renderMB();if(f&&$(f)){$(f).focus();const v=$(f).value;try{$(f).setSelectionRange(v.length,v.length)}catch(x){}}},500)});
$('ac_mb').addEventListener('change',e=>{if(e.target.id==='mb_acft'){NL.acft=e.target.value;const f=FLEET.find(x=>x.reg===NL.acft);if(f&&f.ff)NL.ff=f.ff;saveNL();renderMB()}});
$('ac_mb').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.id==='mb_print'){window.print();return}if(b.dataset.go)tab(b.dataset.go);if(b.id==='mb_usetrip'){MB.trip=(NL._route*num(NL.ff)/60).toFixed(1);saveMB();renderMB()}});

/* ---------- fleet ---------- */
function renderFleet(){
  $('ac_fleet').innerHTML=`<div class="card"><h2>Fleet</h2><p class="sub">From the school's Aircraft Significant Technical Information sheet (issue 02-10-23, rev. 01). Empty moment = empty mass × CG arm. Edit any value to match the aircraft's current Mass and Balance Report.</p>
   <div class="tbl"><table><thead><tr><th>Reg</th><th>Basic empty mass kg</th><th>CG arm m</th><th>Moment kgm</th><th>Usable fuel L</th><th>Max baggage kg</th><th>Fuel flow L/h</th><th></th></tr></thead><tbody>
   ${FLEET.map((f,i)=>{const arm=num(f.arm)||num(f.emom)/num(f.em);return `<tr><td><input data-x="reg" data-i="${i}" value="${esc(f.reg)}" style="min-width:90px"></td><td><input data-x="em" data-i="${i}" value="${esc(f.em)}" inputmode="decimal"></td><td><input data-x="arm" data-i="${i}" value="${esc(f.arm||(isFinite(arm)?arm.toFixed(3):''))}" inputmode="decimal"></td><td>${isFinite(num(f.emom))?num(f.emom).toFixed(2):'—'}</td><td><input data-x="cap" data-i="${i}" value="${esc(f.cap||'')}" inputmode="decimal"></td><td><input data-x="bagmax" data-i="${i}" value="${esc(f.bagmax||'')}" inputmode="decimal"></td><td><input data-x="ff" data-i="${i}" value="${esc(f.ff||'')}" inputmode="decimal"></td><td><button type="button" class="x" data-del="${i}" aria-label="Delete aircraft">×</button></td></tr>
     ${f.warn?`<tr><td colspan="8" class="wrap"><span class="pill warn">Check</span> ${esc(f.warn)}</td></tr>`:''}`}).join('')||'<tr><td colspan="8" class="wrap" style="color:var(--muted)">No aircraft yet.</td></tr>'}
   </tbody></table></div>
   <div class="row" style="margin-top:10px"><button type="button" class="primary" id="fl_add">Add aircraft</button><button type="button" id="fl_school">Restore school fleet values</button><button type="button" id="fl_ex">Add AFM example (practice)</button></div></div>
   <div class="card"><h2>Flight plan items</h2><div class="tbl"><table><thead><tr><th>Item 7</th><th>Item 8</th><th>Item 9</th><th>Item 10</th><th>Item 15</th><th>Item 19 E/</th><th>Item 19 A/</th></tr></thead><tbody>
   ${FLEET.filter(f=>f.fpl).map(f=>`<tr><td><b>${esc(f.reg.replace('-',''))}</b></td><td>${esc(f.fpl.rules)}</td><td>${esc(f.fpl.type)}/${esc(f.fpl.wtc)}</td><td>${esc(f.fpl.equip)}</td><td>${esc(f.fpl.speed)}</td><td>${esc(f.fpl.endur)}</td><td class="wrap">${esc(f.fpl.colour)}</td></tr>`).join('')}
   </tbody></table></div><p class="sub">Endurance with full fuel ≈ 6 h 30 min, average consumption ≈ 19 L/h (5.0 USG/h) at 60 % power, Jet A-1, max oil 6.0 L.</p></div>`;
}
$('ac_fleet').addEventListener('change',e=>{const t=e.target;if(t.dataset.x==null)return;const f=FLEET[+t.dataset.i];const k=t.dataset.x;let v=t.value.trim();if(k==='reg')v=v.toUpperCase();f[k]=v;
  if((k==='em'||k==='arm')&&isFinite(num(f.em))&&isFinite(num(f.arm)))f.emom=(num(f.em)*num(f.arm)).toFixed(2);
  if(k==='em'||k==='arm')delete f.warn;saveFleet();renderFleet();if(window.EFB)E.calcNav()});
$('ac_fleet').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
  if(b.id==='fl_add'){FLEET.push({reg:'',em:'',arm:'',emom:'',cap:'106',bagmax:'30',ff:'19'});saveFleet();renderFleet()}
  if(b.id==='fl_school'){SCHOOL_FLEET.forEach(s=>{const k=FLEET.findIndex(f=>f.reg===s.reg);const c=JSON.parse(JSON.stringify(s));if(k>=0)FLEET[k]=c;else FLEET.push(c)});saveFleet();renderFleet()}
  if(b.id==='fl_ex'){if(!FLEET.some(f=>f.reg==='EXAMPLE')){FLEET.push({reg:'EXAMPLE',em:'735',arm:'2.476',emom:'1820',cap:'',bagmax:''});saveFleet()}renderFleet()}
  if(b.dataset.del!=null){const i=+b.dataset.del;if(b.textContent!=='Delete?'){b.textContent='Delete?';setTimeout(()=>{if(b.isConnected)b.textContent='×'},3000);return}FLEET.splice(i,1);saveFleet();renderFleet()}});

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
