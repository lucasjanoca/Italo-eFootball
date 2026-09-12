(() => {
  const $=(s,r=document)=>r.querySelector(s); const $$=(s,r=document)=>[...r.querySelectorAll(s)];
  const ui={status:$('[data-admin-status]'),app:$('[data-admin-app]'),search:$('[data-admin-search]'),filter:$('[data-admin-filter]'),searchBtn:$('[data-admin-search-btn]'),users:$('[data-admin-users]'),usersStatus:$('[data-admin-users-status]'),prev:$('[data-admin-prev]'),next:$('[data-admin-next]'),page:$('[data-admin-page]'),messages:$('[data-admin-messages]'),posts:$('[data-admin-posts]'),refreshModeration:$('[data-admin-refresh-moderation]')};
  let social=null,page=0,lastPageCount=0; const PAGE_SIZE=25;
  const setStatus=(el,text,kind='')=>{if(!el)return;el.textContent=text;el.dataset.state=kind;el.hidden=!text;};
  const toast=(m,k='info')=>social?.toast?.(m,k);
  const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d)};
  const avatar=p=>{const i=document.createElement('img');i.src=p.avatar_url||'assets/avatar.jpg';i.alt='';i.onerror=()=>i.src='assets/avatar.jpg';return i};
  const button=(label,cls,fn)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=label;b.addEventListener('click',fn);return b};

  async function resolveIdsForFilter(query,filter){
    const c=social.client; const q=(query||'').trim();
    if(q.includes('@')){const r=await c.from('italo_user_private').select('user_id').ilike('email',`%${q.replace(/[%,()]/g,' ')}%`).limit(PAGE_SIZE);if(r.error)throw r.error;return (r.data||[]).map(x=>x.user_id);}
    if(filter==='admin'){const r=await c.from('italo_account_access').select('user_id').eq('role','admin').eq('account_status','active').range(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE-1);if(r.error)throw r.error;return(r.data||[]).map(x=>x.user_id);}
    if(filter==='member'){const r=await c.from('italo_memberships').select('user_id').eq('is_member',true).range(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE-1);if(r.error)throw r.error;return(r.data||[]).map(x=>x.user_id);}
    if(filter==='inactive'){const r=await c.from('italo_account_access').select('user_id').neq('account_status','active').range(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE-1);if(r.error)throw r.error;return(r.data||[]).map(x=>x.user_id);}
    return null;
  }

  async function loadUsers(){
    const c=social.client,query=(ui.search?.value||'').trim(),filter=ui.filter?.value||'all';setStatus(ui.usersStatus,'Carregando usuários…','loading');ui.users?.replaceChildren();
    try{
      const scopedIds=await resolveIdsForFilter(query,filter); let pQuery=c.from('italo_profiles').select('user_id,display_name,username,avatar_url,is_channel_member,created_at,last_seen_at').order('created_at',{ascending:false});
      if(scopedIds){if(!scopedIds.length){renderUsers([]);return;}pQuery=pQuery.in('user_id',scopedIds);}
      if(query&&!query.includes('@')) pQuery=pQuery.or(`display_name.ilike.%${query.replace(/[%,()]/g,' ')}%,username.ilike.%${query.replace(/[%,()]/g,' ')}%`);
      if(!scopedIds)pQuery=pQuery.range(page*PAGE_SIZE,page*PAGE_SIZE+PAGE_SIZE-1);else pQuery=pQuery.limit(PAGE_SIZE);
      const profiles=await pQuery;if(profiles.error)throw profiles.error;let rows=profiles.data||[];const ids=rows.map(x=>x.user_id);lastPageCount=rows.length;
      if(!ids.length){renderUsers([]);return;}
      const [access,members,priv,low,high]=await Promise.all([
        c.from('italo_account_access').select('user_id,role,account_status').in('user_id',ids),
        c.from('italo_memberships').select('user_id,is_member,source,verified_at').in('user_id',ids),
        c.from('italo_user_private').select('user_id,email,last_seen_at').in('user_id',ids),
        c.from('italo_friendships').select('user_low,user_high').eq('status','accepted').in('user_low',ids),
        c.from('italo_friendships').select('user_low,user_high').eq('status','accepted').in('user_high',ids)
      ]);
      for(const r of [access,members,priv,low,high])if(r.error)throw r.error;
      const a=new Map(access.data.map(x=>[x.user_id,x])),m=new Map(members.data.map(x=>[x.user_id,x])),pr=new Map(priv.data.map(x=>[x.user_id,x]));const counts=new Map(ids.map(id=>[id,0]));[...(low.data||[]),...(high.data||[])].forEach(f=>{if(counts.has(f.user_low))counts.set(f.user_low,counts.get(f.user_low)+1);if(counts.has(f.user_high))counts.set(f.user_high,counts.get(f.user_high)+1);});
      rows=rows.map(p=>({...p,access:a.get(p.user_id),membership:m.get(p.user_id),private:pr.get(p.user_id),friends:counts.get(p.user_id)||0}));
      if(filter==='user')rows=rows.filter(r=>r.access?.role!=='admin'&&!r.membership?.is_member&&r.access?.account_status==='active');renderUsers(rows);
    }catch(e){console.error(e);setStatus(ui.usersStatus,'Não foi possível carregar usuários.','error');}
  }

  function renderUsers(rows){
    ui.users?.replaceChildren();if(!rows.length){setStatus(ui.usersStatus,'Nenhum usuário encontrado.','empty');lastPageCount=0;}else setStatus(ui.usersStatus,`${rows.length} usuário${rows.length===1?'':'s'} nesta página.`,'success');
    rows.forEach(row=>{
      const el=document.createElement('div');el.className='admin-user-row';
      const ident=document.createElement('div');ident.className='admin-user-identity';ident.append(avatar(row));const ic=document.createElement('span');const n=document.createElement('strong');n.textContent=row.display_name;const u=document.createElement('small');u.textContent='@'+row.username;ic.append(n,u);if(row.private?.email){const em=document.createElement('small');em.textContent=row.private.email;ic.append(em);}ident.append(ic);
      const account=document.createElement('div');const role=document.createElement('span');role.className='admin-chip '+(row.access?.role==='admin'?'admin':'');role.textContent=row.access?.role==='admin'?'Administrador':'Usuário';const stat=document.createElement('small');stat.style.display='block';stat.style.marginTop='5px';stat.textContent=`${row.access?.account_status||'active'} • último acesso ${fmt(row.private?.last_seen_at||row.last_seen_at)}`;account.append(role,stat);
      const friends=document.createElement('strong');friends.textContent=String(row.friends);
      const member=document.createElement('span');member.className='admin-chip '+(row.membership?.is_member?'member':'');member.textContent=row.membership?.is_member?'Sim':'Não';
      const actions=document.createElement('div');actions.className='admin-actions';
      actions.append(button(row.membership?.is_member?'Remover membro':'Tornar membro','social-btn secondary',e=>toggleMember(row,!row.membership?.is_member,e.currentTarget)));
      if(row.user_id!==social.state.session.user.id){actions.append(button(row.access?.role==='admin'?'Tornar usuário':'Tornar ADM','social-btn secondary',e=>toggleRole(row,row.access?.role==='admin'?'user':'admin',e.currentTarget)));actions.append(button(row.access?.account_status==='active'?'Suspender':'Ativar','social-btn danger',e=>toggleStatus(row,row.access?.account_status==='active'?'suspended':'active',e.currentTarget)));}
      const view=document.createElement('a');view.href=`perfil.html?u=${encodeURIComponent(row.username)}`;view.className='social-btn secondary';view.textContent='Perfil';actions.append(view);
      el.append(ident,account,friends,member,actions);ui.users.append(el);
    });
    if(ui.page)ui.page.textContent=`página ${page+1}`;if(ui.prev)ui.prev.disabled=page===0;if(ui.next)ui.next.disabled=lastPageCount<PAGE_SIZE;
  }

  async function toggleMember(row,value,btn){btn.disabled=true;const payload={is_member:value,source:'manual',verified_at:value?new Date().toISOString():null,verified_by:social.state.session.user.id,updated_at:new Date().toISOString()};const r=await social.client.from('italo_memberships').update(payload).eq('user_id',row.user_id).select('user_id').single();btn.disabled=false;if(r.error){toast(r.error.message,'error');return;}toast(value?'Membro ativado.':'Status de membro removido.','success');loadUsers();}
  async function toggleRole(row,value,btn){if(!confirm(`Alterar o papel de @${row.username} para ${value==='admin'?'administrador':'usuário'}?`))return;btn.disabled=true;const r=await social.client.from('italo_account_access').update({role:value,updated_at:new Date().toISOString(),updated_by:social.state.session.user.id}).eq('user_id',row.user_id).select('user_id').single();btn.disabled=false;if(r.error){toast(r.error.message,'error');return;}toast('Papel atualizado.','success');loadUsers();}
  async function toggleStatus(row,value,btn){if(!confirm(`${value==='active'?'Reativar':'Suspender'} @${row.username}?`))return;btn.disabled=true;const r=await social.client.from('italo_account_access').update({account_status:value,updated_at:new Date().toISOString(),updated_by:social.state.session.user.id}).eq('user_id',row.user_id).select('user_id').single();btn.disabled=false;if(r.error){toast(r.error.message,'error');return;}toast('Status atualizado.','success');loadUsers();}

  async function loadModeration(){
    if(!social)return;const c=social.client;for(const host of [ui.messages,ui.posts])host?.replaceChildren();const [messages,posts]=await Promise.all([c.from('italo_messages').select('id,user_id,display_name,body,created_at,expires_at').order('created_at',{ascending:false}).limit(20),c.from('italo_resenha_posts').select('id,user_id,display_name,body,created_at,expires_at').order('created_at',{ascending:false}).limit(20)]);renderModeration(ui.messages,messages.data||[],'italo_messages');renderModeration(ui.posts,posts.data||[],'italo_resenha_posts');}
  function renderModeration(host,rows,table){if(!host)return;if(!rows.length){const e=document.createElement('div');e.className='social-empty';e.textContent='Nenhum conteúdo ativo.';host.append(e);return;}rows.forEach(row=>{const item=document.createElement('article');item.className='admin-moderation-item';const h=document.createElement('strong');h.textContent=row.display_name||'Jogador';const p=document.createElement('p');p.textContent=row.body;const meta=document.createElement('small');meta.textContent=`${fmt(row.created_at)} • expira ${fmt(row.expires_at)}`;const del=button('Excluir','social-btn danger',async()=>{if(!confirm('Excluir este conteúdo?'))return;const r=await social.client.from(table).delete().eq('id',row.id);if(r.error){toast(r.error.message,'error');return;}toast('Conteúdo removido.','success');item.remove();});item.append(h,p,meta,del);host.append(item);});}

  function bind(){ui.searchBtn?.addEventListener('click',()=>{page=0;loadUsers();});ui.search?.addEventListener('keydown',e=>{if(e.key==='Enter'){page=0;loadUsers();}});ui.filter?.addEventListener('change',()=>{page=0;loadUsers();});ui.prev?.addEventListener('click',()=>{if(page>0){page--;loadUsers();}});ui.next?.addEventListener('click',()=>{if(lastPageCount===PAGE_SIZE){page++;loadUsers();}});ui.refreshModeration?.addEventListener('click',loadModeration);}
  async function init(s){social=s;if(!social.state.session?.user){setStatus(ui.status,'Entre com uma conta administrativa para continuar.','error');return;}if(social.state.access?.role!=='admin'||social.state.access?.account_status!=='active'){setStatus(ui.status,'Acesso negado. Esta área é exclusiva para administradores autorizados pelo banco.','error');return;}setStatus(ui.status,'','');ui.app.hidden=false;bind();await Promise.all([loadUsers(),loadModeration()]);}
  document.addEventListener('italo:social-ready',e=>init(e.detail),{once:true});if(window.ITALO_SOCIAL)init(window.ITALO_SOCIAL);
})();
