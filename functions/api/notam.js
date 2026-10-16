/* NOTAMs for a list of ICAO locations (aerodromes and FIRs), from the FAA NOTAM Search service
   (international ICAO NOTAMs). GET /api/notam?ids=LGIR,LGST,LGGG */
import {json} from '../_lib.js';
const SRC='https://notams.aim.faa.gov/notamSearch/search';
async function one(id){const out=[];let offset=0,total=Infinity,guard=0;
  while(offset<total&&guard++<20){
    const body=new URLSearchParams({searchType:'0',designatorsForLocation:id,designatorForAccountable:'',latDegrees:'',latMinutes:'0',latSeconds:'0',longDegrees:'',longMinutes:'0',longSeconds:'0',radius:'10',sortColumns:'5 false',sortDirection:'true',designatorForNotamNumberSearch:'',notamNumber:'',radiusSearchOnDesignator:'false',radiusSearchDesignator:'',latitudeDirection:'N',longitudeDirection:'W',freeFormText:'',flightPathText:'',flightPathDivertAirfields:'',flightPathBuffer:'4',flightPathIncludeNavaids:'true',flightPathIncludeArtcc:'false',flightPathIncludeTfr:'true',flightPathIncludeRegulatory:'false',flightPathResultsType:'All NOTAMs',archiveDate:'',archiveDesignator:'',offset:String(offset),notamsOnly:'false',filters:'',minRunwayLength:'',minRunwayWidth:'',runwaySurfaceTypes:'',predefinedAbraka:'',predefinedDabra:'',flightPathAddlBuffer:'',recaptchaToken:''});
    const r=await fetch(SRC,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','User-Agent':'Mozilla/5.0 DA40D-FlightBag','Accept':'application/json'},body});
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
export async function onRequestGet({request,env}){const u=new URL(request.url);
  const ids=[...new Set((u.searchParams.get('ids')||'').toUpperCase().split(',').map(s=>s.trim()).filter(s=>/^[A-Z]{4}$/.test(s)))].slice(0,8);
  if(!ids.length)return json({error:'Give ICAO locations, e.g. ?ids=LGIR,LGGG'},400);
  const res={};const errors={};
  const useN=!!env.NOTAMIFY_TOKEN;let fetched=new Date().toISOString();
  await Promise.all(ids.map(async id=>{const ck='notam:'+(useN?'n:':'f:')+id;
    try{const c=env.USERS&&await env.USERS.get(ck,'json');if(c){res[id]=c.list;fetched=c.at<fetched?c.at:fetched;return}
      res[id]=useN?await notamify(id,env.NOTAMIFY_TOKEN):await one(id);
      if(env.USERS)await env.USERS.put(ck,JSON.stringify({at:new Date().toISOString(),list:res[id]}),{expirationTtl:1800})}
    catch(e){errors[id]=String(e.message||e)}}));
  return json({fetched,source:useN?'Notamify (api.notamify.com)':'FAA NOTAM Search (notams.aim.faa.gov), international NOTAMs',notams:res,errors})}
