/* Proxy for EMY chart images (http-only site). Only emy.gr hosts are allowed. GET /api/wx/img?u=<url> */
export async function onRequestGet({request}){const u=new URL(request.url).searchParams.get('u');let t;
  try{t=new URL(u)}catch(e){return new Response('Bad URL',{status:400})}
  if(!/(^|\.)emy\.gr$/i.test(t.hostname))return new Response('Host not allowed',{status:403});
  let r;try{r=await fetch(t.href,{headers:{'User-Agent':'Mozilla/5.0 DA40D-FlightBag'},cf:{cacheTtl:600}})}catch(x){return new Response('Upstream unreachable',{status:502})}
  if(!r.ok)return new Response('Upstream '+r.status,{status:502});
  return new Response(r.body,{headers:{'Content-Type':r.headers.get('Content-Type')||'image/gif','Cache-Control':'private, max-age=600'}})}
