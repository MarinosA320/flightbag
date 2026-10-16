/* NOTAMs for a list of ICAO locations (aerodromes and FIRs), from the FAA NOTAM Search service
   (international ICAO NOTAMs). GET /api/notam?ids=LGIR,LGST,LGGG */
import {json} from '../_lib.js';
const SRC='https://notams.aim.faa.gov/notamSearch/search';
async function one(id){const out=[];let offset=0,total=Infinity,guard=0;
  while(offset<total&&guard++<20){
    const body=new URLSearchParams({searchType:'0',designatorsForLocation:id,designatorForAccountable:'',latDegrees:'',latMinutes:'0',latSeconds:'0',longDegrees:'',longMinutes:'0',longSeconds:'0',radius:'10',sortColumns:'5 false',sortDirection:'true',designatorForNotamNumberSearch:'',notamNumber:'',radiusSearchOnDesignator:'false',radiusSearchDesignator:'',latitudeDirection:'N',longitudeDirection:'W',freeFormText:'',flightPathText:'',flightPathDivertAirfields:'',flightPathBuffer:'4',flightPathIncludeNavaids:'true',flightPathIncludeArtcc:'false',flightPathIncludeTfr:'true',flightPathIncludeRegulatory:'false',flightPathResultsType:'All NOTAMs',archiveDate:'',archiveDesignator:'',offset:String(offset),notamsOnly:'false',filters:'',minRunwayLength:'',minRunwayWidth:'',runwaySurfaceTypes:'',predefinedAbraka:'',predefinedDabra:'',flightPathAddlBuffer:'',recaptchaToken:''});
    let r,tries=0;while(true){if(offset)await new Promise(z=>setTimeout(z,1200)); /* gentle paging: the service rate-limits */
      r=await fetch(SRC,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0 DA40D-FlightBag','Accept':'application/json'},body});
      if((r.status===403||r.status===429)&&tries++<3){await new Promise(z=>setTimeout(z,6000*tries));continue}break}
    if(!r.ok)throw new Error('NOTAM service HTTP '+r.status);
    const j=await r.json();const L=j.notamList||[];total=j.totalNotamCount||0;
    for(const n of L)out.push({id:n.notamNumber,loc:n.icaoId||n.facilityDesignator||id,start:n.startDate,end:n.endDate,issued:n.issueDate,text:n.icaoMessage||n.traditionalMessage||n.traditionalMessageFrom4thWord||'',keyword:n.keyword||''});
    if(!L.length)break;offset+=L.length}
  return out}
/* Notamify (api.notamify.com, v2) when the NOTAMIFY_TOKEN secret is set: 1 credit per page of 30.
   Results are cached for 30 minutes in KV so repeat briefings do not spend credits again. */
async function notamify(id,token){const out=[];let page=1,total=Infinity,guard=0;
  while(out.length<total&&guard++<20){
    const r=await fetch(`https://api.notamify.com/api/v2/notams?location=${id}&page=${page}&per_page=30`,{headers:{Authorization:'Bearer '+token,Accept:'application/json'}});
    if(r.status===401||r.status===403)throw new Error('Notamify rejected the API token');
    if(r.status===402)throw new Error('Notamify credits exhausted');
    if(!r.ok)throw new Error('Notamify HTTP '+r.status);
    const j=await r.json();const L=j.notams||[];total=j.total_count||0;
    for(const n of L)out.push({id:n.notam_number,loc:n.icao_code||n.location||id,start:n.starts_at,end:n.ends_at,issued:n.issued_at,text:n.icao_message||n.message||'',
      plain:n.interpretation&&(n.interpretation.description||n.interpretation.excerpt)||'',category:n.interpretation&&n.interpretation.category||''});
    if(!L.length)break;page++}
  return out}
/* autorouter (api.autorouter.aero): free for registered pilots, NOTAMs imported from EUROCONTROL EAD.
   Secrets AUTOROUTER_EMAIL and AUTOROUTER_PASSWORD (the account must be enabled for API use by autorouter support). */
async function arToken(env){const c=env.USERS&&await env.USERS.get('ar:token');if(c)return c;
  const r=await fetch('https://api.autorouter.aero/v1.0/oauth2/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:new URLSearchParams({grant_type:'client_credentials',client_id:env.AUTOROUTER_EMAIL,client_secret:env.AUTOROUTER_PASSWORD})});
  if(!r.ok)throw new Error('autorouter sign-in failed (HTTP '+r.status+'): check the e-mail/password and that API access is enabled');
  const j=await r.json();if(env.USERS)await env.USERS.put('ar:token',j.access_token,{expirationTtl:Math.max(60,(j.expires_in||3600)-120)});return j.access_token}
const ymd=t=>{const d=new Date(t*1000);return isNaN(d)||t>=4294967295?'PERM':d.toISOString().slice(2,16).replace(/[-T:]/g,'')};
async function autorouter(id,env){const tok=await arToken(env);const out=[];let off=0,total=Infinity,guard=0;
  while(off<total&&guard++<20){
    const r=await fetch(`https://api.autorouter.aero/v1.0/notam?itemas=${encodeURIComponent(JSON.stringify([id]))}&offset=${off}&limit=100&startvalidity=${Math.floor(Date.now()/1000)}`,{headers:{Authorization:'Bearer '+tok,Accept:'application/json'}});
    if(r.status===401){if(env.USERS)await env.USERS.delete('ar:token');throw new Error('autorouter token rejected, try again')}
    if(!r.ok)throw new Error('autorouter HTTP '+r.status);
    const j=await r.json();const L=j.rows||[];total=j.total||0;
    for(const n of L){const num=`${n.series||''}${String(n.number).padStart(4,'0')}/${String(n.year).slice(-2)}`;
      const q=`Q) ${n.fir||''}/Q${n.code23||''}${n.code45||''}/${n.traffic||''}/${n.purpose||''}/${n.scope||''}/${String(n.lower??'').padStart(3,'0')}/${String(n.upper??'').padStart(3,'0')}/`;
      const txt=[q,`A) ${n.itema||id} B) ${ymd(n.startvalidity)} C) ${ymd(n.endvalidity)}${n.estimation?' EST':''}`,n.itemd?'D) '+n.itemd:'','E) '+(n.iteme||''),n.itemf?'F) '+n.itemf:'',n.itemg?'G) '+n.itemg:''].filter(Boolean).join('\n');
      out.push({id:num,loc:n.itema||id,start:new Date(n.startvalidity*1000).toISOString(),end:n.endvalidity>=4294967295?'PERM':new Date(n.endvalidity*1000).toISOString(),text:txt})}
    if(!L.length)break;off+=L.length}
  return out}
export async function onRequestGet({request,env}){const u=new URL(request.url);
  const ids=[...new Set((u.searchParams.get('ids')||'').toUpperCase().split(',').map(s=>s.trim()).filter(s=>/^[A-Z]{4}$/.test(s)))].slice(0,8);
  if(!ids.length)return json({error:'Give ICAO locations, e.g. ?ids=LGIR,LGGG'},400);
  const res={};const errors={};
  const useA=!!(env.AUTOROUTER_EMAIL&&env.AUTOROUTER_PASSWORD),useN=!useA&&!!env.NOTAMIFY_TOKEN;let fetched=new Date().toISOString();
  await Promise.all(ids.map(async id=>{const ck='notam:'+(useA?'a:':useN?'n:':'f:')+id;
    try{const c=env.USERS&&await env.USERS.get(ck,'json');if(c){res[id]=c.list;fetched=c.at<fetched?c.at:fetched;return}
      res[id]=useA?await autorouter(id,env):useN?await notamify(id,env.NOTAMIFY_TOKEN):await one(id);
      if(env.USERS)await env.USERS.put(ck,JSON.stringify({at:new Date().toISOString(),list:res[id]}),{expirationTtl:1800})}
    catch(e){errors[id]=String(e.message||e)}}));
  return json({fetched,source:useA?'autorouter (EUROCONTROL EAD data)':useN?'Notamify (api.notamify.com)':'FAA NOTAM Search (notams.aim.faa.gov), international NOTAMs',notams:res,errors})}
