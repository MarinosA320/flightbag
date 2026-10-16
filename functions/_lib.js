/* Shared helpers for the school server (Cloudflare Pages Functions).
   Bindings expected (Cloudflare dashboard → Pages project → Settings):
     KV namespace  USERS          accounts and sessions
     Secret        SESSION_SECRET long random string
     Secret        ADMIN_EMAIL    first administrator e-mail
     Secret        ADMIN_CODE     first administrator access code */
const enc=new TextEncoder();
const b64=buf=>btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const ub64=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')+'==='.slice((s.length+3)%4)),c=>c.charCodeAt(0));
export async function hashCode(code,salt){
  salt=salt||b64(crypto.getRandomValues(new Uint8Array(16)));
  const key=await crypto.subtle.importKey('raw',enc.encode(code),'PBKDF2',false,['deriveBits']);
  const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:enc.encode(salt),iterations:100000},key,256);
  return salt+'$'+b64(bits)}
export async function checkCode(code,stored){const [salt]=stored.split('$');const h=await hashCode(code,salt);
  if(h.length!==stored.length)return false;let d=0;for(let i=0;i<h.length;i++)d|=h.charCodeAt(i)^stored.charCodeAt(i);return d===0}
async function hmac(secret,data){const k=await crypto.subtle.importKey('raw',enc.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return b64(await crypto.subtle.sign('HMAC',k,enc.encode(data)))}
export async function makeSession(env,user){const body=b64(enc.encode(JSON.stringify({e:user.email,r:user.role,n:user.name||'',x:Date.now()+30*864e5})));
  return body+'.'+await hmac(env.SESSION_SECRET,body)}
export async function readSession(env,req){const m=(req.headers.get('Cookie')||'').match(/(?:^|;\s*)efb_s=([^;]+)/);if(!m||!env.SESSION_SECRET)return null;
  const [body,sig]=m[1].split('.');if(!body||!sig||sig!==await hmac(env.SESSION_SECRET,body))return null;
  try{const s=JSON.parse(new TextDecoder().decode(ub64(body)));if(s.x<Date.now())return null;
    const u=await env.USERS.get('user:'+s.e,'json');if(!u)return null;return {email:u.email,role:u.role,name:u.name||''}}catch(e){return null}}
export const cookie=(v,maxAge)=>`efb_s=${v}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
export const json=(o,status=200,h={})=>new Response(JSON.stringify(o),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...h}});
export const normEmail=e=>String(e||'').trim().toLowerCase();
