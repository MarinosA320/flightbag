import {checkCode,hashCode,makeSession,cookie,json,normEmail} from '../_lib.js';
export async function onRequestPost({request,env}){
  let b;try{b=await request.json()}catch(e){return json({error:'Bad request'},400)}
  const email=normEmail(b.email),code=String(b.code||'');if(!email||!code)return json({error:'Enter your e-mail and access code.'},400);
  // slow down guessing: 5 failures per e-mail per 15 minutes
  const fk='fail:'+email;const fails=+(await env.USERS.get(fk)||0);if(fails>=5)return json({error:'Too many attempts. Try again in 15 minutes.'},429);
  let u=await env.USERS.get('user:'+email,'json');
  if(!u&&env.ADMIN_EMAIL&&env.ADMIN_CODE&&email===normEmail(env.ADMIN_EMAIL)&&code===env.ADMIN_CODE){
    u={email,name:'Administrator',role:'admin',hash:await hashCode(code),created:new Date().toISOString(),createdBy:'setup'};
    await env.USERS.put('user:'+email,JSON.stringify(u))}
  if(!u||!(await checkCode(code,u.hash))){await env.USERS.put(fk,String(fails+1),{expirationTtl:900});return json({error:'E-mail or access code not recognised.'},401)}
  u.lastLogin=new Date().toISOString();await env.USERS.put('user:'+email,JSON.stringify(u));
  return json({ok:true,user:{email:u.email,role:u.role,name:u.name}},200,{'Set-Cookie':cookie(await makeSession(env,u),30*86400)})}
