/* METAR/TAF via the school server (avoids browser cross-origin limits). GET /api/wx/metar?ids=LGIR,LGST */
import {json} from '../../_lib.js';
export async function onRequestGet({request}){const ids=(new URL(request.url).searchParams.get('ids')||'').toUpperCase().split(',').filter(s=>/^[A-Z]{4}$/.test(s)).slice(0,12).join(',');
  if(!ids)return json({error:'ids required'},400);
  const get=async k=>{const r=await fetch(`https://aviationweather.gov/api/data/${k}?ids=${ids}&format=json`,{headers:{'User-Agent':'DA40D-FlightBag (school training EFB)'}});if(r.status===204)return [];if(!r.ok)throw new Error(k+' HTTP '+r.status);const t=await r.text();return t.trim()?JSON.parse(t):[]};
  try{const [metar,taf]=await Promise.all([get('metar'),get('taf')]);return json({metar,taf})}catch(e){return json({error:String(e.message||e)},502)}}
