/* Hellenic National Meteorological Service (HNMS/EMY) aviation charts. The site is http-only and builds
   each chart page per valid time, so the server walks the time buttons and returns the chart image URLs
   (images are then served through /api/wx/img). GET /api/wx/emy?set=swc|wind|pressure */
import {json} from '../../_lib.js';
const PAGES={swc:'http://oldportal.emy.gr/emy/en/aviation/aeronaftilia_xartes_simantikou_kairou',
  wind:'http://oldportal.emy.gr/emy/en/aviation/aeronaftilia_xartes_anemou_anoteris',
  pressure:'http://oldportal.emy.gr/emy/en/navigation/naftilia_xartes_radiofacsimile'};
const UA={'User-Agent':'Mozilla/5.0 DA40D-FlightBag'};
const dec=s=>s.replace(/&amp;/g,'&');
async function page(u){const r=await fetch(u,{headers:UA,redirect:'follow'});if(!r.ok)throw new Error('EMY page HTTP '+r.status);return r.text()}
/* chart image on a page, the valid-time buttons, and (wind) the flight-level menu */
function parse(html,base){
  const img=(html.match(/<img[^>]*src\s*=\s*["']([^"']*\/methods\/get[A-Za-z]*Map[^"']*)["']/i)||[])[1];
  const times=[...html.matchAll(/<a\s+class="btn[^"]*"\s+href="([^"]+)"\s*>\s*([^<]+?)\s*<\/a>/gi)].map(m=>({url:new URL(dec(m[1]),base).href,label:m[2].trim()}));
  const levels=[...html.matchAll(/<a href="(\?[^"]*type=winds(\d{3})[^"]*)">\s*FL\s*\d+\s*<\/a>/gi)].map(m=>({url:new URL(dec(m[1]),base).href,fl:m[2]}));
  return {img:img&&new URL(dec(img),base).href,times,levels}}
async function walk(start,label,maxTimes){const p=parse(await page(start),start);const out=[];
  const times=p.times.length?p.times.slice(0,maxTimes):[{url:start,label:''}];
  for(const t of times){try{const q=t.url===start?p:parse(await page(t.url),t.url);if(q.img&&!out.some(c=>c.url===q.img))out.push({url:q.img,label:label+(t.label?' · valid '+t.label+'Z':''),pdf:false})}catch(e){}}
  return out}
export async function onRequestGet({request}){const set=new URL(request.url).searchParams.get('set');const start=PAGES[set];
  if(!start)return json({error:'set must be swc, wind or pressure'},400);
  let charts=[];
  try{if(set==='swc')charts=await walk(start+'?region=Greece&type=low','SWC low level · Greece',2);
    else if(set==='pressure')charts=await walk(start,'Surface pressure',2);
    else{const p=parse(await page(start),start);const lv=p.levels.filter(l=>['050','100'].includes(l.fl));
      for(const l of (lv.length?lv:[{url:start,fl:'050'}]))charts.push(...await walk(l.url,'Wind/temp FL'+l.fl,2))}}
  catch(x){return json({error:'HNMS site unreachable: '+(x.message||x),page:start},502)}
  return json({set,page:start,fetched:new Date().toISOString(),charts})}
