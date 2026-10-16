/* Hellenic National Meteorological Service (HNMS/EMY) chart pages. The site is http-only, so the
   school server fetches the page and lists the chart images; images are then served through /api/wx/img.
   GET /api/wx/emy?set=swc|wind|pressure */
import {json} from '../../_lib.js';
const PAGES={swc:'http://oldportal.emy.gr/emy/en/aviation/aeronaftilia_xartes_simantikou_kairou',
  wind:'http://oldportal.emy.gr/emy/en/aviation/aeronaftilia_xartes_anemou_anoteris',
  pressure:'http://oldportal.emy.gr/emy/en/navigation/naftilia_xartes_radiofacsimile'};
const SKIP=/logo|banner|icon|flag|spacer|button|arrow|header|footer|bullet|social|facebook|twitter|youtube|rss|print|search|blank|pixel/i;
export async function onRequestGet({request}){const set=new URL(request.url).searchParams.get('set');const page=PAGES[set];
  if(!page)return json({error:'set must be swc, wind or pressure'},400);
  let r;try{r=await fetch(page,{headers:{'User-Agent':'Mozilla/5.0 DA40D-FlightBag'},redirect:'follow'})}catch(x){return json({error:'HNMS site unreachable: '+(x.message||x),page},502)}
  if(!r.ok)return json({error:'EMY page HTTP '+r.status,page},502);
  const html=await r.text();const seen=new Set();const charts=[];
  const re=/<(img|a)\b[^>]*?(src|href)\s*=\s*["']([^"']+\.(?:gif|png|jpe?g|pdf))["'][^>]*>/gi;let m;
  while((m=re.exec(html))){const abs=new URL(m[3],page).href;if(seen.has(abs)||SKIP.test(abs))continue;seen.add(abs);
    const tag=m[0];const alt=(tag.match(/(?:alt|title)\s*=\s*["']([^"']*)["']/i)||[])[1]||'';
    const ctx=html.slice(Math.max(0,m.index-300),m.index).replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim().slice(-120);
    charts.push({url:abs,label:alt||ctx,pdf:/\.pdf$/i.test(abs)})}
  return json({set,page,fetched:new Date().toISOString(),charts})}
