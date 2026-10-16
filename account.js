/* Accounts: works when the app is served by the school server (Cloudflare Pages Functions).
   On plain static hosting /api/me does not exist and the app runs without accounts. */
(function(){
const $=id=>document.getElementById(id),esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
window.EFB_SERVER=false;
async function me(){try{const r=await fetch('/api/me',{cache:'no-store',credentials:'same-origin'});
  if(r.status===401){location.href='/login';return}
  if(!r.ok||!(r.headers.get('Content-Type')||'').includes('json'))return;
  const j=await r.json();if(!j.user)return;window.EFB_SERVER=true;window.EFB_USER=j.user;
  $('s_account').hidden=false;$('s_who').textContent=`Signed in as ${j.user.name?j.user.name+' · ':''}${j.user.email} (${j.user.role==='admin'?'administrator':'pilot'})`;
  if(j.user.role==='admin'){$('s_admin').hidden=false;list()}}catch(e){}}
async function list(){const t=$('u_list');t.innerHTML='<tr><td colspan="6" class="wrap" style="color:var(--muted)">Loading…</td></tr>';
  try{const r=await fetch('/api/users',{cache:'no-store'});const j=await r.json();if(!r.ok)throw new Error(j.error);
    const d=s=>s?new Date(s).toLocaleString('en-GB',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
    t.innerHTML=j.users.map(u=>`<tr><td>${esc(u.name)}</td><td>${esc(u.email)}</td><td>${u.role==='admin'?'Administrator':'Pilot'}</td><td>${d(u.created)}</td><td>${d(u.lastLogin)}</td><td>${u.email===window.EFB_USER.email?'<span class="sub">you</span>':`<button type="button" class="x" data-reset="${esc(u.email)}" title="New access code">⟳</button><button type="button" class="x" data-del="${esc(u.email)}" aria-label="Delete account">×</button>`}</td></tr>`).join('')||'<tr><td colspan="6">No accounts.</td></tr>'}
  catch(e){t.innerHTML=`<tr><td colspan="6" class="wrap" style="color:var(--bad)">${esc(e.message||'Could not load accounts.')}</td></tr>`}}
async function save(reset){const body={name:$('u_name').value,email:$('u_email').value,code:$('u_code').value,role:$('u_role').value,reset};
  const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const j=await r.json().catch(()=>({}));
  $('u_msg').textContent=r.ok?(reset?'Access code changed for ':'Account created for ')+body.email+'.':(j.error||'Failed.');$('u_msg').style.color=r.ok?'var(--good)':'var(--bad)';
  if(r.ok){['u_name','u_email','u_code'].forEach(i=>$(i).value='');list()}}
document.addEventListener('DOMContentLoaded',()=>{});
$('u_add').onclick=()=>save(false);$('u_reload').onclick=list;
$('s_logout').onclick=async()=>{await fetch('/api/logout',{method:'POST'});location.href='/login'};
$('u_list').addEventListener('click',async e=>{const b=e.target.closest('button');if(!b)return;
  if(b.dataset.del){if(b.textContent!=='Delete?'){b.textContent='Delete?';setTimeout(()=>{if(b.isConnected)b.textContent='×'},3000);return}
    const r=await fetch('/api/users/'+encodeURIComponent(b.dataset.del),{method:'DELETE'});const j=await r.json().catch(()=>({}));$('u_msg').textContent=r.ok?'Deleted '+b.dataset.del+'.':(j.error||'Failed.');list()}
  if(b.dataset.reset){$('u_email').value=b.dataset.reset;$('u_code').focus();$('u_msg').textContent='Type a new access code above and tap "Set new code".';$('u_add').textContent='Set new code';$('u_add').onclick=async()=>{await save(true);$('u_add').textContent='Create account';$('u_add').onclick=()=>save(false)}}});
me();
})();
