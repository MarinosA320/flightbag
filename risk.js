/* CEA-SFT-10 Preflight risk assessment matrix: the school's 16 conditions scored 1–5, summed and banded
   (14–30 / 31–47 / 48–63). Rows that the app can work out (weather, crosswind, day/night, pilot hours…) are
   pre-selected with the reason shown; every row can be changed by tapping another score. */
(function(){
'use strict';
const E=window.EFB,P=window.PLAN;if(!E)return;
const $=id=>document.getElementById(id),esc=E.esc,num=E.num,S=E.S;
const ROWS=[
 ['type','Flight Type',['VFR','IFR','','','']],
 ['dst','DUAL/SOLO/TEST',['DUAL','','SOLO','','TEST-flight']],
 ['dn','DAY/NIGHT',['DAY','','NIGHT','','']],
 ['lic','Licence/Rating',['FI/ATPL/CPL/IR','FI/CPL','PPL/IR','PPL','STUDENT']],
 ['rest','Rest in last 24 hours',['>8 hrs','6-7 hrs','5-6 hrs','3-5 hrs','<3 hrs']],
 ['vis','Visibility',['>10 KM','8-10 km','5-8 km','1000-2999','<3 km']],
 ['ceil','Ceiling',['>10000','10000-5000','4000-3000','2000-1000','<1000']],
 ['xd','X-wind Departure',['0-5 kts','6-10 kts','11-20 kts','21-25kts','>25kts']],
 ['xa','X-wind Arrival',['0-5 kts','6-10 kts','11-20 kts','21-25kts','>25kts']],
 ['stab','Weather Stability (BECMG/TEMPO)',['STABLE','','SLOW DETERIORATION','','RAPID DETERIOTATION']],
 ['fd','PIC Familiar DEP.Airport',['YES','','NO','','']],
 ['fa','PIC Familiar ARR.Airport',['YES','','NO','','']],
 ['loc','LOCAL Flight',['YES','','NO','','']],
 ['htype','Hours in A/C Type',['>200','150-199','100-149','50-99','<50']],
 ['h90','Hours in last 90 days',['>20','15-20','10-14','5-9','<5']],
 ['htot','Total Hours',['>2000','500-2000','250-499','100-249','<100']]];
const BANDS=[[14,30,'good','No unusual hazards. Use normal flight planning and established personal minimums and operating procedures.'],
 [31,47,'warn','Somewhat riskier than usual. Conduct flight planning with extra care. Review personal minimums and operating procedures to ensure that all standards are being met. Consider alternatives to reduce risk.'],
 [48,80,'bad','Conditions present much higher than normal risk. Conduct flight planning with extra care and review all elements to identify those that could be modified to reduce risk. If available, consult with more experienced pilot or instructor for guidance before flight. Develop contingency plans before flight to deal with high risk items. Decide beforehand on alternates and brief passengers and other crewmembers on special precautions to be taken during the flight. Consider delaying flight until conditions improve and risk is reduced. Other than that, No dispatch.']];
let st=S.get('sft10',{man:{},hdr:{}});st.man=st.man||{};st.hdr=st.hdr||{};
let prof=S.get('riskprof',{lic:'STUDENT',htot:'',htype:'',h90:'',fam:'LGIR'});
let auto={};/* key -> [score, reason] */
const save=()=>{S.set('sft10',st);S.set('riskprof',prof)};

/* ---------- inputs from the rest of the app ---------- */
function flight(){const W=E.wpts,NL=P?P.NL:{};const dep=(W[0]&&E.BY[W[0].n])?W[0].n:'',arr=(W.length>1&&E.BY[W[W.length-1].n])?W[W.length-1].n:dep;
  const L=E.legs();const mins=L.reduce((s,l)=>s+(isFinite(l.ete)?l.ete:0),0);
  const m=String(NL.tot||'').match(/^(\d{1,2}):?(\d{2})$/);const d=NL.date||E.todayISO();const t0=m?Date.parse(`${d}T${m[1].padStart(2,'0')}:${m[2]}:00Z`):NaN;
  let far=0;W.forEach(w=>{if(W[0])far=Math.max(far,E.gc(W[0],w).d)});
  return {dep,arr,t0,t1:isFinite(t0)?t0+mins*60e3:NaN,mins,far,W}}
/* sun elevation (NOAA approximation) for civil twilight */
function sunAlt(lat,lon,t){const d=new Date(t);const jd=t/864e5+2440587.5,n=jd-2451545;const L=(280.46+0.9856474*n)%360,g=(357.528+0.9856003*n)*Math.PI/180;
  const lam=(L+1.915*Math.sin(g)+0.02*Math.sin(2*g))*Math.PI/180,eps=(23.439-4e-7*n)*Math.PI/180;
  const dec=Math.asin(Math.sin(eps)*Math.sin(lam)),ra=Math.atan2(Math.cos(eps)*Math.sin(lam),Math.cos(lam));
  const gmst=(18.697374558+24.06570982441908*n)%24;const ha=((gmst*15+lon)*Math.PI/180)-ra;
  const la=lat*Math.PI/180;return Math.asin(Math.sin(la)*Math.sin(dec)+Math.cos(la)*Math.cos(dec)*Math.cos(ha))*180/Math.PI}
const hm=t=>new Date(t).toISOString().slice(11,16)+'Z';
/* METAR parsing: prevailing visibility (m) and ceiling (ft) */
function visM(raw){if(/\bCAVOK\b/.test(raw))return 10000;const m=raw.match(/\s(\d{4})(?:NDV)?\s/);if(m)return +m[1];const sm=raw.match(/\s(\d+)SM\s/);return sm?+sm[1]*1609:NaN}
function ceilFt(raw){if(/\bCAVOK\b|\bNSC\b|\bSKC\b|\bCLR\b|\bNCD\b/.test(raw))return Infinity;let c=Infinity;for(const m of raw.matchAll(/\b(BKN|OVC|VV)(\d{3})/g))c=Math.min(c,+m[2]*100);return c}
const visScore=v=>v>=9999?1:v>=8000?2:v>=5000?3:v>=1000?4:5;
const ceilScore=c=>c>10000?1:c>=5000?2:c>=3000?3:c>=1000?4:5;
const xwScore=x=>x<=5?1:x<=10?2:x<=20?3:x<=25?4:5;
function xwind(id,m){const a=E.BY[id];if(!a||!m||!isFinite(num(m.wdir)))return m&&/VRB/.test(m.rawOb||'')?{x:num(m.wspd)||0,txt:'variable wind '+(num(m.wspd)||0)+' kt'}:null;
  const d=num(m.wdir),s=num(m.wspd)||0,g=num(m.wgst);const ends=E.ends(a);if(!ends.length)return null;
  const rows=ends.map(r=>({r,c:E.comps(d,s,r.hdg),cg:isFinite(g)?E.comps(d,g,r.hdg):null}));const b=rows.reduce((p,x)=>x.c.hw>p.c.hw?x:p,rows[0]);
  const x=Math.abs((b.cg||b.c).xw);return {x,txt:`RWY ${b.r.id}, wind ${E.p3(d)}/${s}${isFinite(g)?'G'+g:''} kt → ${Math.round(x)} kt crosswind${b.cg?' in gusts':''}`}}
function stability(taf,t0,t1){if(!taf)return null;const raw=' '+taf.rawTAF+' ';
  const parts=raw.split(/\s(?=(?:TEMPO|BECMG|PROB\d\d|FM\d{6})\b)/).slice(1);let worst=1,why=[];
  for(const p of parts){const per=p.match(/\b(\d{2})(\d{2})\/(\d{2})(\d{2})\b/);
    if(per&&isFinite(t0)){const base=new Date(t0);const mk=(dd,hh)=>Date.UTC(base.getUTCFullYear(),base.getUTCMonth()+(+dd<base.getUTCDate()-15?1:0),+dd,+hh);const a=mk(per[1],per[2]),b=mk(per[3],per[4]);if(b<t0-3600e3||a>(isFinite(t1)?t1:t0)+3600e3)continue}
    const v=visM(p+' '),c=ceilFt(p),ts=/\b(?:\+|-)?(?:TS|VCTS)|CB\b/.test(p),gu=(p.match(/G(\d{2})KT/)||[])[1];
    let s=1;if(v<5000||c<1500||/(SH|RA|DZ|BR|FG)/.test(p)||+gu>=25)s=3;if(ts||v<3000||c<1000||/FG\b/.test(p))s=5;
    if(s>1)why.push(p.trim().split(/\s+/).slice(0,6).join(' '));worst=Math.max(worst,s)}
  return [worst,worst===1?'TAF: no deterioration forecast during the flight':'TAF: '+why.slice(0,2).join(' | ')]}
const hrsScore=(v,c)=>{v=num(v);if(!isFinite(v))return null;for(let i=0;i<c.length;i++)if(v>=c[i])return i+1;return 5};
async function compute(){const F=flight();auto={};const NL=P?P.NL:{};
  auto.type=[1,'VFR training flight'];
  const pp=S.get('pp',{t:'dual'});auto.dst=pp.t==='dual'?[1,'Dual (preflight checklist type)']:[3,'Solo (preflight checklist type)'];
  if(F.dep&&!isFinite(F.t0)){F.t0=Date.now();F.t1=F.t0+F.mins*60e3;F.noTot=true}
  if(F.dep&&isFinite(F.t0)){const a=E.BY[F.dep],b=E.BY[F.arr]||a;const s0=sunAlt(a.lat,a.lon,F.t0),s1=sunAlt(b.lat,b.lon,F.t1);
    auto.dn=(s0<-6||s1<-6)?[3,`Night: sun ${s0.toFixed(0)}° at T/O ${hm(F.t0)}, ${s1.toFixed(0)}° at ETA ${hm(F.t1)} (below civil twilight)`]:[1,`Day: T/O ${hm(F.t0)}, ETA ${hm(F.t1)}, both before end of civil twilight`];if(F.noTot)auto.dn[1]+=' (no T/O time on the navlog, so from now)'}
  const L=['FI/ATPL/CPL/IR','FI/CPL','PPL/IR','PPL','STUDENT'];const li=L.indexOf(prof.lic);if(li>=0)auto.lic=[li+1,'From pilot profile'];
  const ht=hrsScore(prof.htype,[200,150,100,50]);if(ht)auto.htype=[ht,prof.htype+' h on type (profile)'];
  const h9=hrsScore(prof.h90,[21,15,10,5]);if(h9)auto.h90=[h9,prof.h90+' h in 90 days (profile)'];
  const hT=hrsScore(prof.htot,[2001,500,250,100]);if(hT)auto.htot=[hT,prof.htot+' h total (profile)'];
  const fam=String(prof.fam||'').toUpperCase().split(/[\s,;]+/).filter(Boolean);
  if(F.dep)auto.fd=fam.includes(F.dep)?[1,F.dep+' is in your familiar aerodromes']:[3,F.dep+' is not in your familiar aerodromes'];
  if(F.arr)auto.fa=fam.includes(F.arr)?[1,F.arr+' is in your familiar aerodromes']:[3,F.arr+' is not in your familiar aerodromes'];
  if(F.dep)auto.loc=(F.dep===F.arr&&F.far<=25)?[1,`Returns to ${F.dep}, furthest point ${F.far.toFixed(0)} NM`]:[3,F.dep===F.arr?`Furthest point ${F.far.toFixed(0)} NM from ${F.dep}`:`${F.dep} to ${F.arr}`];
  const ids=[...new Set([F.dep,F.arr].filter(Boolean))];
  if(ids.length){try{const w=await E.getWx(ids);const md=w[F.dep]&&w[F.dep].metar,ma=w[F.arr]&&w[F.arr].metar;
      const ms=[md,ma].filter(Boolean);if(ms.length){
        const vs=ms.map(m=>({id:m.icaoId,v:visM(' '+m.rawOb+' ')})).filter(x=>isFinite(x.v));if(vs.length){const lo=vs.reduce((a,b)=>b.v<a.v?b:a);auto.vis=[visScore(lo.v),`${lo.id} METAR ${lo.v>=9999?'10 km or more':lo.v+' m'}`]}
        const cs=ms.map(m=>({id:m.icaoId,c:ceilFt(' '+m.rawOb+' ')}));const lc=cs.reduce((a,b)=>b.c<a.c?b:a);auto.ceil=[ceilScore(lc.c),lc.c===Infinity?'No BKN/OVC layer reported':`${lc.id} ceiling ${lc.c} ft`]}
      const xd=xwind(F.dep,md);if(xd)auto.xd=[xwScore(xd.x),F.dep+' '+xd.txt];const xa=xwind(F.arr,ma);if(xa)auto.xa=[xwScore(xa.x),F.arr+' '+xa.txt];
      const sd=stability(w[F.dep]&&w[F.dep].taf,F.t0,F.t1),sa=F.arr!==F.dep?stability(w[F.arr]&&w[F.arr].taf,F.t0,F.t1):null;const sw=[sd,sa].filter(Boolean).sort((a,b)=>b[0]-a[0])[0];if(sw)auto.stab=sw}
    catch(e){auto._wx='Weather not available: '+(e.message||e)}}
  return F}
const val=k=>st.man[k]!=null?st.man[k]:auto[k]?auto[k][0]:null;
function total(){let t=0,n=0;ROWS.forEach(([k])=>{const v=val(k);if(v){t+=v;n++}});return {t,n,band:BANDS.find(b=>t>=b[0]&&t<=b[1])||(t<14?BANDS[0]:BANDS[2])}}

/* ---------- screen ---------- */
async function render(){const box=$('k_form');if(!box)return;const F=await compute();const NL=P?P.NL:{};
  const H=st.hdr;const hd={date:H.date||(NL.date||E.todayISO()).split('-').reverse().join('/'),time:H.time||NL.tot||'',crew1:H.crew1||NL.pic||'',crew2:H.crew2||'',reg:H.reg||NL.acft||'',dep:H.dep||F.dep,arr:H.arr||F.arr};
  st._hd=hd;
  box.innerHTML=`<div class="sft-hdr">
      ${[['date','Date'],['time','Time (UTC)'],['crew1','Crew'],['crew2','Crew'],['reg','A/C registration'],['dep','Departure airport'],['arr','Arrival airport']].map(([k,l])=>`<label>${l}<input data-h="${k}" value="${esc(hd[k])}"></label>`).join('')}</div>
    ${auto._wx?`<p class="note warn">${esc(auto._wx)}. Weather rows need to be scored by hand.</p>`:''}
    <div class="sft" role="table" aria-label="Risk matrix">
      <div class="sft-r sft-h" role="row"><span role="columnheader">Condition</span>${[1,2,3,4,5].map(i=>`<span role="columnheader">${i}</span>`).join('')}<span role="columnheader">Score</span></div>
      ${ROWS.map(([k,lab,opts])=>{const v=val(k),a=auto[k],man=st.man[k]!=null;
        return `<div class="sft-r${v?'':' open'}" role="row" data-k="${k}"><span class="sft-c" role="rowheader">${esc(lab)}${a?`<small class="${man&&a[0]!==v?'ovr':''}">${man&&a[0]!==v?'Changed from '+a[0]+' · ':''}${esc(a[1])}${man?` <button type="button" class="lnk" data-reset="${k}">Use ${a[0]}</button>`:''}</small>`:man?'':'<small>Choose a score</small>'}</span>
          ${opts.map((o,i)=>o?`<button type="button" class="sft-o${v===i+1?' on':''}" data-s="${i+1}" aria-pressed="${v===i+1}">${esc(o)}</button>`:'<span class="sft-x" aria-hidden="true"></span>').join('')}
          <b class="sft-v">${v||'–'}</b></div>`}).join('')}
    </div>`;
  score()}
function score(){const T=total();const o=$('k_total');if(!o)return;o.textContent=T.t;
  const c=T.n<ROWS.length?'open':T.band[2];$('k_pill').className='pill '+(c==='open'?'':c);
  $('k_pill').textContent=T.n<ROWS.length?`${ROWS.length-T.n} to score`:c==='good'?'14–30':c==='warn'?'31–47':'48–63 · No dispatch';
  $('k_msg').textContent=T.n<ROWS.length?'Score every condition to get the overall risk.':T.band[3];$('k_msg').className='verdict '+(c==='open'?'':c)}
function profile(){const b=$('k_prof');if(!b)return;
  b.innerHTML=`<div class="fields four"><label>Licence / rating<select data-p="lic">${['FI/ATPL/CPL/IR','FI/CPL','PPL/IR','PPL','STUDENT'].map(x=>`<option ${prof.lic===x?'selected':''}>${x}</option>`).join('')}</select></label>
    <label>Total hours<input data-p="htot" inputmode="decimal" value="${esc(prof.htot)}"></label><label>Hours on DA40<input data-p="htype" inputmode="decimal" value="${esc(prof.htype)}"></label><label>Hours last 90 days<input data-p="h90" inputmode="decimal" value="${esc(prof.h90)}"></label></div>
    <label class="wide">Aerodromes you are familiar with<input data-p="fam" value="${esc(prof.fam)}" placeholder="LGIR LGSA LGST"></label>`}
function wire(){const v=$('v-risk');if(!v||v._w)return;v._w=1;
  v.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;
    if(b.dataset.reset){delete st.man[b.dataset.reset];save();render();return}
    if(b.dataset.s){const k=b.closest('[data-k]').dataset.k;st.man[k]=+b.dataset.s;save();render();return}
    if(b.id==='k_reset'){st={man:{},hdr:{}};save();render();return}
    if(b.id==='k_print'&&window.PACK)window.PACK.open(['risk'])});
  v.addEventListener('change',e=>{const t=e.target;if(t.dataset.h){st.hdr[t.dataset.h]=t.value.trim();save();return}
    if(t.dataset.p){prof[t.dataset.p]=t.value.trim();save();render()}})}

/* ---------- the school's form, filled, for the pack ---------- */
async function sheet(){await compute();const T=total();const hd=st._hd||{};const sc=[1,2,3,4,5];
  return `<section class="ppage doc sftp"><div class="sftp-top"><img src="afm/cea-logo.png" alt="Cretan Eagle Aviation Flight Academy">
    <div class="sftp-addr">Cretan Eagle Aviation Ltd.,<br>Nikos Kazantzakis International Airport, GR-71601, Heraklion, Crete, Greece<br>Tel: +30 2810 331 890 / <u>www.cretaneagle.gr</u> / <u>info@cretaneagle.gr</u></div>
    <div class="sftp-id">CEA-SFT-10 – Preflight risk assessment matrix</div></div>
   <table class="sftp-h"><tr><td><b>Date:</b> ${esc(hd.date||'')}</td><td><b>Time:</b> ${esc(hd.time||'')}</td><td><b>Crew</b> ${esc(hd.crew1||'')}<div class="sftp-l">${esc(hd.crew2||'')}</div></td></tr>
    <tr><td><b>A/C Registration</b> ${esc(hd.reg||'')}</td><td><b>Departure Airport:</b> ${esc(hd.dep||'')}</td><td><b>Arrival Airport:</b> ${esc(hd.arr||'')}</td></tr></table>
   <p class="sftp-i">Before each flight access each of the following conditions and assign a numerical risk score of 1 to 5 in the right hand column (RISK SCORE).Add up the entries in the RISK SCORE column to obtain an overall risk score estimate and see it falls in <span class="g">Green</span>/Yellow/<span class="r">Red</span> risk Matrix.</p>
   <table class="sftp-m"><tr><th></th>${sc.map(i=>`<th>${i}</th>`).join('')}<th>RISK<br>SCORE</th></tr>
    ${ROWS.map(([k,lab,o])=>{const v=val(k);return `<tr><th>${esc(lab)}</th>${o.map((x,i)=>`<td class="${v===i+1?'pick':''}">${esc(x)}</td>`).join('')}<td class="sc">${v||''}</td></tr>`}).join('')}
    <tr><td colspan="4" class="blank"></td><td colspan="2" class="tl">TOTAL RISK SCORE:</td><td class="sc tot">${T.n===ROWS.length?T.t:''}</td></tr></table>
   <table class="sftp-b">${BANDS.map((b,i)=>`<tr class="b${i}${T.n===ROWS.length&&T.band===b?' cur':''}"><td>${esc(b[3])}</td><td>${b[0]}-${i===2?63:b[1]}</td></tr>`).join('')}</table>
   <div class="sftp-sig"><span>Signature SPIC: ……………………………………</span><span>Signature PIC: ……………………………………</span></div></section>`}

window.RISKM={render,sheet,total,get rows(){return ROWS}};
wire();profile();render();
window.addEventListener('hashchange',()=>{if(location.hash==='#risk'){profile();render()}});
})();
