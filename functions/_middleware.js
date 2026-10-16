/* Every request must carry a valid session, except the sign-in page and its API. */
import {readSession} from './_lib.js';
const OPEN=[/^\/login(\.html)?$/,/^\/api\/login$/,/^\/icon(-\d+)?\.(svg|png)$/,/^\/manifest\.json$/,/^\/fonts\/[\w.-]+\.woff2$/];
export async function onRequest(ctx){const url=new URL(ctx.request.url);
  if(!ctx.env.USERS||!ctx.env.SESSION_SECRET)return new Response('School server is not configured yet: add the USERS KV binding and SESSION_SECRET.',{status:503});
  if(OPEN.some(r=>r.test(url.pathname)))return ctx.next();
  const s=await readSession(ctx.env,ctx.request);
  if(!s){if(url.pathname.startsWith('/api/'))return new Response('{"error":"Sign in required"}',{status:401,headers:{'Content-Type':'application/json'}});
    return Response.redirect(url.origin+'/login',302)}
  ctx.data.user=s;const r=await ctx.next();return r}
