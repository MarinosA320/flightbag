import {json,normEmail} from '../../_lib.js';
export async function onRequestDelete({env,data,params}){if(!data.user||data.user.role!=='admin')return json({error:'Administrators only'},403);
  const email=normEmail(decodeURIComponent(params.email));if(email===data.user.email)return json({error:'You cannot delete your own account.'},400);
  await env.USERS.delete('user:'+email);return json({ok:true})}
