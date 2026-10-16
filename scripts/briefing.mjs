/* Briefing feed builder, run by GitHub Actions (.github/workflows/briefing.yml) every ~15 min.
   Fetches METAR/TAF, NOTAMs and the HNMS (EMY) charts on GitHub's servers, where browser
   cross-origin limits do not apply, and writes them to an output folder that is published
   to the "wx" branch. The app reads it from raw.githubusercontent.com (CORS-enabled).
   Reuses the school-server code in functions/ so both paths give the same results. */
import fs from 'node:fs';import path from 'node:path';
import {onRequestGet as metarFn} from '../functions/api/wx/metar.js';
import {onRequestGet as notamFn} from '../functions/api/notam.js';
import {onRequestGet as emyFn} from '../functions/api/wx/emy.js';
/* every network call gets a timeout so a slow site cannot hang the run */
const _fetch=globalThis.fetch;globalThis.fetch=(u,o={})=>_fetch(u,{...o,signal:o.signal||AbortSignal.timeout(30000)});
const T0=Date.now();
const OUT=process.argv[2]||'out';fs.mkdirSync(path.join(OUT,'emy'),{recursive:true});
const ids=[...fs.readFileSync('data.js','utf8').split('\n').find(l=>l.startsWith('window.EFB_AIRPORTS')).matchAll(/"icao": "([A-Z]{4})"/g)].map(m=>m[1]);
{const o=fs.readFileSync('data.js','utf8').split('\n').find(l=>l.startsWith('window.EFB_OTHER'));if(o)for(const m of o.matchAll(/\["(LG[A-Z]{2})"/g))if(!ids.includes(m[1]))ids.push(m[1])}
const call=async(fn,url,env={})=>{const r=await fn({request:new Request(url),env});return r.json()};
const chunks=(a,n)=>a.reduce((o,x,i)=>(i%n?o[o.length-1].push(x):o.push([x]),o),[]);
const now=()=>new Date().toISOString();
const write=(f,o)=>fs.writeFileSync(path.join(OUT,f),JSON.stringify(o));
/* METAR / TAF */
{const out={fetched:now(),ids,metar:[],taf:[],errors:[]};
  for(const c of chunks(ids,12)){const j=await call(metarFn,'https://x/api/wx/metar?ids='+c.join(','));
    if(j.error){/* NOAA text fallback */out.errors.push('aviationweather.gov: '+j.error);
      for(const id of c){const T=async u=>{try{const r=await fetch(u);return r.ok?await r.text():''}catch(e){return ''}};
        const body=s=>{const L=(s||'').split('\n');return /^\d{4}\/\d\d\/\d\d/.test(L[0])?L.slice(1).join(' ').replace(/\s+/g,' ').trim():''};
        const m=body(await T(`https://tgftp.nws.noaa.gov/data/observations/metar/stations/${id}.TXT`)),t=body(await T(`https://tgftp.nws.noaa.gov/data/forecasts/taf/stations/${id}.TXT`));
        if(m)out.metar.push({icaoId:id,rawOb:'METAR '+m,src:'NOAA'});if(t)out.taf.push({icaoId:id,rawTAF:t})}}
    else{out.metar.push(...(j.metar||[]));out.taf.push(...(j.taf||[]))}}
  write('metar.json',out);console.log('METAR',out.metar.length,'TAF',out.taf.length,out.errors)}
/* NOTAMs (autorouter if its secrets are set, otherwise FAA NOTAM Search). The FAA service starts refusing (HTTP 403)
   after roughly 25 requests, so each run fetches the FIR and the training aerodromes, plus a rotating slice of the other
   Greek aerodromes; everything not refreshed keeps its previous list (marked with when it was retrieved). */
{const env={AUTOROUTER_EMAIL:process.env.AUTOROUTER_EMAIL||'',AUTOROUTER_PASSWORD:process.env.AUTOROUTER_PASSWORD||'',NOTAMIFY_TOKEN:process.env.NOTAMIFY_TOKEN||''};
  const nTrain=fs.readFileSync('data.js','utf8').split('\n').find(l=>l.startsWith('window.EFB_AIRPORTS')).match(/"icao":/g).length;
  const train=ids.slice(0,nTrain),others=ids.slice(nTrain);
  const SL=6,slices=Math.max(1,Math.ceil(others.length/SL)),run=Math.floor(Date.now()/(15*60e3))%slices;
  const order=['LGGG',...train,...others.slice(run*SL,run*SL+SL)];
  const out={fetched:now(),source:'',notams:{},errors:{},stale:{}};const budget=T0+9*60e3;let refused=0;
  for(const id of order){if(Date.now()>budget||refused>=2)break;
    try{const j=await call(notamFn,'https://x/api/notam?ids='+id,env);out.source=j.source||out.source;
      if(j.notams&&j.notams[id]){out.notams[id]=j.notams[id];refused=0}else{const e=(j.errors&&j.errors[id])||j.error||'no data';out.errors[id]=e;if(/403|429/.test(e))refused++}}
    catch(e){out.errors[id]=String(e.message||e)}}
  /* previous good lists for everything not refreshed this run */
  let prev={};try{prev=await (await fetch('https://raw.githubusercontent.com/'+(process.env.GITHUB_REPOSITORY||'MarinosA320/flightbag')+'/wx/notam.json')).json()}catch(e){}
  for(const id of ['LGGG',...ids]){if(out.notams[id])continue;const at=(prev.stale&&prev.stale[id])||prev.fetched;
    if(prev.notams&&prev.notams[id]&&Date.now()-Date.parse(at)<24*3600e3){out.notams[id]=prev.notams[id];out.stale[id]=at;delete out.errors[id]}
    else if(!out.errors[id])out.errors[id]='not retrieved yet (refreshed in rotation, try again later)'}
  if(!out.source)out.source=prev.source||'FAA NOTAM Search (notams.aim.faa.gov), international NOTAMs';
  write('notam.json',out);console.log('NOTAM',Object.keys(out.notams).length,'fresh',order.filter(i=>!out.stale[i]&&out.notams[i]).length,'errors',out.errors,'s',(Date.now()-T0)/1e3)}
/* HNMS (EMY) charts: images are downloaded so the app never needs the http-only site */
{const out={fetched:now(),sets:{}};
  for(const set of ['swc','wind','pressure']){const s=out.sets[set]={charts:[]};
    try{const j=await call(emyFn,'https://x/api/wx/emy?set='+set);if(j.error)throw new Error(j.error);s.page=j.page;
      let i=0;for(const c of j.charts.filter(c=>!c.pdf).slice(0,8)){try{const r=await fetch(c.url,{headers:{'User-Agent':'Mozilla/5.0 DA40D-FlightBag'}});
          const buf=Buffer.from(await r.arrayBuffer());if(!r.ok||buf.length<5000)continue;
          const ext=buf[0]===0x89?'png':buf[0]===0xFF?'jpg':buf.slice(0,3).toString()==='GIF'?'gif':buf.slice(0,4).toString()==='%PDF'?'pdf':null;if(!ext||ext==='pdf')continue;const f=`emy/${set}-${++i}.${ext}`;
          fs.writeFileSync(path.join(OUT,f),buf);s.charts.push({file:f,label:c.label,src:c.url})}catch(e){}}
      if(!s.charts.length)throw new Error('no chart images found on the HNMS page')}
    catch(e){s.error=String(e.message||e)}}
  write('emy.json',out);console.log('EMY',Object.fromEntries(Object.entries(out.sets).map(([k,v])=>[k,v.error||v.charts.length])))}
