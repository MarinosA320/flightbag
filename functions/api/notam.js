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
export async function onRequestGet({request}){const u=new URL(request.url);
  const ids=[...new Set((u.searchParams.get('ids')||'').toUpperCase().split(',').map(s=>s.trim()).filter(s=>/^[A-Z]{4}$/.test(s)))].slice(0,8);
  if(!ids.length)return json({error:'Give ICAO locations, e.g. ?ids=LGIR,LGGG'},400);
  const res={};const errors={};
  await Promise.all(ids.map(async id=>{try{res[id]=await one(id)}catch(e){errors[id]=String(e.message||e)}}));
  return json({fetched:new Date().toISOString(),source:'FAA NOTAM Search (notams.aim.faa.gov), international NOTAMs',notams:res,errors})}
