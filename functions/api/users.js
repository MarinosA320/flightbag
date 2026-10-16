/* Administrator only: list and create pilot accounts. */
import {hashCode,json,normEmail} from '../_lib.js';
const admin=d=>d.user&&d.user.role==='admin';
export async function onRequestGet({env,data}){if(!admin(data))return json({error:'Administrators only'},403);
  const out=[];let cur;do{const l=await env.USERS.list({prefix:'user:',cursor:cur});for(const k of l.keys){const u=await env.USERS.get(k.name,'json');if(u)out.push({email:u.email,name:u.name||'',role:u.role,created:u.created,createdBy:u.createdBy||'',lastLogin:u.lastLogin||''})}cur=l.list_complete?null:l.cursor}while(cur);
  out.sort((a,b)=>a.email.localeCompare(b.email));return json({users:out})}
export async function onRequestPost({request,env,data}){if(!admin(data))return json({error:'Administrators only'},403);
  let b;try{b=await request.json()}catch(e){return json({error:'Bad request'},400)}
  const email=normEmail(b.email),code=String(b.code||'').trim(),role=b.role==='admin'?'admin':'pilot',name=String(b.name||'').trim().slice(0,80);
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))return json({error:'Enter a valid e-mail.'},400);
  if(code.length<4)return json({error:'Access code must be at least 4 characters.'},400);
  const exists=await env.USERS.get('user:'+email);if(exists&&!b.reset)return json({error:'An account with that e-mail already exists.'},409);
  const prev=exists?JSON.parse(exists):{};
  await env.USERS.put('user:'+email,JSON.stringify({...prev,email,name:name||prev.name||'',role,hash:await hashCode(code),created:prev.created||new Date().toISOString(),createdBy:prev.createdBy||data.user.email}));
  return json({ok:true})}
