(()=>{
  const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
  let social=null,c=null,state=null,channel=null,searchTimer=0,searchSeq=0;
  const profiles=new Map();
  const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d)};
  const date=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(d)};
  const toast=(m,k='info')=>social?.toast?.(m,k);
  function friendly(error,fallback='Não foi possível concluir esta ação.'){
    const msg=String(error?.message||error?.details||'');
    if(/20 amigos/i.test(msg))return 'Você atingiu o limite atual de amigos.';
    if(/solicitação.*pendente|já existe uma solicitação/i.test(msg))return 'Já existe uma solicitação de amizade pendente.';
    if(/já são amigos/i.test(msg))return 'Vocês já são amigos.';
    if(/bloque/i.test(msg))return 'Essa ação não está disponível por causa de um bloqueio.';
    if(/não está aceitando/i.test(msg))return 'Este usuário não está aceitando solicitações.';
    if(/amigos de amigos/i.test(msg))return 'Este usuário aceita solicitações apenas de amigos de amigos.';
    if(/permission|policy|rls|permiss/i.test(msg))return 'Você não possui permissão para realizar esta ação.';
    return fallback;
  }
  const badge=p=>{
    const role=p?.role_badge||(p?.user_id===state?.session?.user?.id?state?.access?.role:null);
    if(role==='owner'){const b=document.createElement('span');b.className='role-badge owner';b.textContent='OWNER';return b}
    if(role==='admin'){const b=document.createElement('span');b.className='role-badge admin';b.textContent='ADM';return b}
    const member=p?.is_channel_member??(p?.user_id===state?.session?.user?.id?state?.membership?.is_member:false);
    if(member){const b=document.createElement('span');b.className='member-exclusive-badge';b.textContent='★ Membro Exclusivo';return b}
    return null;
  };
  const avatar=(p,size=48)=>{const i=document.createElement('img');i.src=p?.avatar_url||'assets/avatar.jpg';i.alt='';i.width=size;i.height=size;i.loading='lazy';i.decoding='async';i.onerror=()=>i.src='assets/avatar.jpg';return i};
  const href=p=>p?.username?`perfil.html?u=${encodeURIComponent(p.username)}`:'perfil.html';
  async function hydrate(ids){
    ids=[...new Set(ids.filter(Boolean).filter(id=>!profiles.has(id)))];if(!ids.length)return;
    const r=await c.from('italo_profiles').select('user_id,display_name,username,avatar_url,bio,is_channel_member,role_badge,created_at').in('user_id',ids);
    if(!r.error)(r.data||[]).forEach(p=>profiles.set(p.user_id,p));
  }

  function notificationPanel(){
    let p=$('[data-notification-panel]');if(p)return p;
    p=document.createElement('aside');p.className='notification-panel';p.dataset.notificationPanel='';p.setAttribute('aria-label','Central de notificações');p.setAttribute('aria-hidden','true');
    const head=document.createElement('div');head.className='notification-head';const title=document.createElement('strong');title.textContent='Notificações';const mark=document.createElement('button');mark.className='social-nav-btn';mark.type='button';mark.textContent='Marcar todas como lidas';mark.addEventListener('click',markAll);head.append(title,mark);
    const list=document.createElement('div');list.className='notification-list';list.dataset.notificationList='';p.append(head,list);document.body.append(p);
    document.addEventListener('click',e=>{if(p.classList.contains('open')&&!p.contains(e.target)&&!e.target.closest('[data-launch-bell]'))closeNotifications()});
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeNotifications()});return p;
  }
  function closeNotifications(){const p=$('[data-notification-panel]');if(!p)return;p.classList.remove('open');p.setAttribute('aria-hidden','true')}
  const notifyIcon=k=>k?.startsWith('friend')?'👥':k?.startsWith('tournament')?'🏆':k==='member_exclusive'||k==='membership'?'★':k==='moderation'?'🛡️':'🔔';
  async function markOne(n){
    if(n.read_at)return true;const now=new Date().toISOString(),r=await c.from('italo_notifications').update({read_at:now}).eq('id',n.id).eq('user_id',state.session.user.id);
    if(r.error){toast('Não foi possível marcar a notificação como lida.','error');return false}n.read_at=now;renderHeader();return true;
  }
  function renderNotifications(){
    if(!state?.session)return;const host=notificationPanel().querySelector('[data-notification-list]');host.replaceChildren();const rows=state.notifications||[];
    if(!rows.length){host.innerHTML='<div class="notification-empty">Nenhuma notificação por enquanto.</div>';return}
    rows.forEach(n=>{const el=document.createElement('button');el.type='button';el.className='notification-item'+(n.read_at?'':' unread');const ico=document.createElement('span');ico.className='ico';ico.textContent=notifyIcon(n.kind);const cp=document.createElement('span'),h=document.createElement('strong'),p=document.createElement('span'),t=document.createElement('time');h.textContent=n.title||'Atualização';p.textContent=n.body||'';t.textContent=fmt(n.created_at);cp.append(h,p,t);el.append(ico,cp);el.addEventListener('click',async()=>{await markOne(n);if(n.kind?.startsWith('tournament')&&n.entity_id)location.href=`torneios.html?id=${encodeURIComponent(n.entity_id)}`;else renderNotifications()});host.append(el)});
  }
  async function markAll(){
    const ids=(state.notifications||[]).filter(n=>!n.read_at).map(n=>n.id);if(!ids.length){toast('Todas as notificações já estão lidas.');return}
    const now=new Date().toISOString(),r=await c.from('italo_notifications').update({read_at:now}).eq('user_id',state.session.user.id).in('id',ids);
    if(r.error){toast('Não foi possível atualizar as notificações.','error');return}state.notifications.forEach(n=>n.read_at=n.read_at||now);renderHeader();renderNotifications();toast('Notificações marcadas como lidas.','success');
  }
  function renderHeader(){
    $$('[data-social-actions]').forEach(host=>{host.replaceChildren();if(!state?.session?.user){const b=document.createElement('button');b.type='button';b.className='social-nav-btn';b.textContent='Entrar';b.addEventListener('click',social.signIn);host.append(b);return}
      const bell=document.createElement('button');bell.type='button';bell.className='notification-bell';bell.dataset.launchBell='';const unread=(state.notifications||[]).filter(n=>!n.read_at).length;bell.setAttribute('aria-label',unread?`Abrir notificações, ${unread} não lidas`:'Abrir notificações');bell.textContent='🔔';if(unread){const n=document.createElement('span');n.className='social-count-badge';n.textContent=String(Math.min(99,unread));bell.append(n)}bell.addEventListener('click',()=>{const p=notificationPanel();const open=!p.classList.contains('open');p.classList.toggle('open',open);p.setAttribute('aria-hidden',String(!open));if(open)renderNotifications()});
      const p=document.createElement('a');p.className='social-nav-btn';p.href='perfil.html';p.append(avatar(state.profile,26));const name=document.createElement('span');name.textContent=state.profile?.display_name||'Perfil';p.append(name);host.append(bell,p);
      if(['admin','owner'].includes(state.access?.role)&&state.access?.account_status==='active'){const a=document.createElement('a');a.href='admin.html';a.className='social-nav-btn';a.textContent='⚙ ADM';host.append(a)}
    });
  }

  const relation=id=>(state.friendships||[]).find(x=>x.user_low===id||x.user_high===id);
  const other=f=>f.user_low===state.session.user.id?f.user_high:f.user_low;
  const blocked=id=>(state.blocks||[]).some(x=>x.blocked_id===id);
  function button(text,cls,fn){const b=document.createElement('button');b.type='button';b.className=cls;b.textContent=text;b.addEventListener('click',fn);return b}
  async function friendAction(type,p,b){
    const rel=relation(p.user_id);if(b)b.disabled=true;let r;
    if(type==='send')r=await social.api.friendships.send(p.user_id);if(type==='accept')r=await social.api.friendships.respond(rel.id,true);if(type==='decline')r=await social.api.friendships.respond(rel.id,false);if(type==='cancel')r=await social.api.friendships.cancel(rel.id);if(type==='remove')r=await social.api.friendships.remove(rel.id);if(type==='block')r=await social.api.blocks.block(p.user_id);if(type==='unblock')r=await social.api.blocks.unblock(p.user_id);
    if(r?.error){if(b)b.disabled=false;toast(friendly(r.error),'error');return}
    const ok={send:'Pedido de amizade enviado.',accept:'Amizade aceita.',decline:'Pedido recusado.',cancel:'Pedido cancelado.',remove:'Amizade removida.',block:'Usuário bloqueado.',unblock:'Usuário desbloqueado.'};toast(ok[type]||'Atualizado.','success');await social.refresh();profiles.delete(p.user_id);await hydrate([p.user_id,...state.friendships.flatMap(x=>[x.user_low,x.user_high]),...state.blocks.map(x=>x.blocked_id)]);renderHeader();await renderProfile();
  }
  function relationButtons(p){
    if(!state?.session||p.user_id===state.session.user.id)return[];if(blocked(p.user_id))return[button('Desbloquear','social-btn secondary',e=>friendAction('unblock',p,e.currentTarget))];
    const r=relation(p.user_id),me=state.session.user.id,out=[];
    if(!r)out.push(button('Adicionar amigo','social-btn primary',e=>friendAction('send',p,e.currentTarget)));
    else if(r.status==='accepted'){const ok=button('Amigos ✓','social-btn secondary',()=>{});ok.disabled=true;out.push(ok,button('Remover','social-btn danger',e=>confirm('Remover amizade?')&&friendAction('remove',p,e.currentTarget)))}
    else if(r.requested_by===me){const wait=button('Solicitação enviada','social-btn secondary',()=>{});wait.disabled=true;out.push(wait,button('Cancelar','social-btn danger',e=>friendAction('cancel',p,e.currentTarget)))}
    else out.push(button('Aceitar','social-btn primary',e=>friendAction('accept',p,e.currentTarget)),button('Recusar','social-btn secondary',e=>friendAction('decline',p,e.currentTarget)));
    out.push(button('Bloquear','social-link-danger',e=>confirm('Bloquear este usuário?')&&friendAction('block',p,e.currentTarget)));return out;
  }

  async function viewedProfile(){
    const u=new URLSearchParams(location.search).get('u');if(!u)return state.profile;
    const r=await c.from('italo_profiles').select('user_id,display_name,username,avatar_url,bio,is_channel_member,role_badge,created_at').eq('username',u.toLowerCase()).maybeSingle();
    return r.data||null;
  }
  async function points(id){const r=await c.from('italo_ranking').select('points').eq('user_id',id).maybeSingle();return Number(r.data?.points||0)}
  async function friendCount(id){const r=await c.rpc('italo_friend_count',{target_user_id:id});return r.error?0:Number(r.data||0)}
  async function tournaments(id){
    const p=await c.from('italo_tournament_participants').select('tournament_id,status,joined_at').eq('user_id',id).order('joined_at',{ascending:false}).limit(20);
    const ids=[...new Set((p.data||[]).map(x=>x.tournament_id))];if(!ids.length)return[];
    const t=await c.from('italo_tournaments').select('id,slug,name,status,starts_at').in('id',ids);const map=new Map((t.data||[]).map(x=>[x.id,x]));return(p.data||[]).map(x=>({...x,tournament:map.get(x.tournament_id)})).filter(x=>x.tournament);
  }
  function userCard(p){const x=document.createElement('article');x.className='social-user-card';const a=document.createElement('a');a.className='social-user-main';a.href=href(p);a.append(avatar(p));const cp=document.createElement('span');cp.className='social-user-copy';const n=document.createElement('strong');n.textContent=p.display_name||'Jogador';const u=document.createElement('small');u.textContent=p.username?'@'+p.username:'';cp.append(n,u);const bd=badge(p);if(bd)cp.append(bd);a.append(cp);x.append(a);const ac=document.createElement('div');ac.className='social-user-actions';relationButtons(p).forEach(b=>ac.append(b));x.append(ac);return x}
  function activateTabs(){$$('[data-profile-tab]').forEach(b=>b.addEventListener('click',()=>{$$('[data-profile-tab]').forEach(x=>x.classList.toggle('active',x===b));$$('[data-profile-panel]').forEach(x=>x.hidden=x.dataset.profilePanel!==b.dataset.profileTab)}))}
  async function renderProfile(){
    const root=$('[data-profile-app]');if(!root||!state?.session)return;const p=await viewedProfile();if(!p){root.innerHTML='<div class="launch-error">Perfil não encontrado.</div>';return}profiles.set(p.user_id,p);const self=p.user_id===state.session.user.id;
    const [pts,fc,ts]=await Promise.all([points(p.user_id),friendCount(p.user_id),tournaments(p.user_id)]);
    const hero=$('[data-profile-hero]');if(hero){hero.replaceChildren();const av=avatar(p,92);av.className='profile-avatar';const cp=document.createElement('div'),top=document.createElement('div');cp.className='profile-hero-copy';top.className='profile-name-row';const h=document.createElement('h1');h.textContent=p.display_name;top.append(h);const bd=badge(p);if(bd)top.append(bd);const un=document.createElement('p');un.className='profile-username';un.textContent='@'+p.username;const bio=document.createElement('p');bio.className='profile-bio';bio.textContent=p.bio||'Jogador da comunidade Ítalo Football.';const stats=document.createElement('div');stats.className='profile-stats';[['Pontos',pts],['Amigos',fc],['Torneios',ts.length],['Desde',date(p.created_at)]].forEach(([k,v])=>{const s=document.createElement('span'),sm=document.createElement('small'),st=document.createElement('strong');sm.textContent=k;st.textContent=v;s.append(sm,st);stats.append(s)});cp.append(top,un,bio,stats);const ac=document.createElement('div');ac.className='profile-actions';relationButtons(p).forEach(b=>ac.append(b));if(self)ac.append(button('Editar perfil','social-btn primary',()=>document.querySelector('[data-profile-tab="settings"]')?.click()));hero.append(av,cp,ac)}
    renderFriends(self);renderTournaments(ts);renderActivity(p,pts,ts,self);renderSettings(self,p);const role=$('[data-profile-account-role]');if(role)role.textContent=self?(state.access?.role==='owner'?'Owner':state.access?.role==='admin'?'Administrador':state.membership?.is_member?'Membro Exclusivo':'Usuário'):(p.role_badge==='owner'?'Owner':p.role_badge==='admin'?'Administrador':p.is_channel_member?'Membro Exclusivo':'Usuário');
  }
  function renderFriends(self){
    const host=$('[data-profile-friends]');if(!host)return;host.replaceChildren();if(!self){host.innerHTML='<div class="launch-empty">A lista detalhada de amigos é privada. O total aparece no perfil.</div>';return}
    const me=state.session.user.id,groups=[['Amigos',state.friendships.filter(x=>x.status==='accepted')],['Recebidas',state.friendships.filter(x=>x.status==='pending'&&x.requested_by!==me)],['Enviadas',state.friendships.filter(x=>x.status==='pending'&&x.requested_by===me)]];
    groups.forEach(([title,rows])=>{const sec=document.createElement('section');sec.className='profile-list-section';const h=document.createElement('h3');h.textContent=title;sec.append(h);const list=document.createElement('div');list.className='social-list';if(!rows.length)list.innerHTML='<div class="launch-empty">Nenhum item.</div>';rows.forEach(f=>{const p=profiles.get(other(f));if(p)list.append(userCard(p))});sec.append(list);host.append(sec)});
    const sec=document.createElement('section');sec.className='profile-list-section';sec.innerHTML='<h3>Bloqueados</h3>';const list=document.createElement('div');list.className='social-list';if(!state.blocks.length)list.innerHTML='<div class="launch-empty">Nenhum usuário bloqueado.</div>';state.blocks.forEach(b=>{const p=profiles.get(b.blocked_id);if(p)list.append(userCard(p))});sec.append(list);host.append(sec);
  }
  function renderTournaments(rows){const host=$('[data-profile-tournaments]');if(!host)return;host.replaceChildren();if(!rows.length){host.innerHTML='<div class="launch-empty">Nenhuma participação em torneio.</div>';return}rows.forEach(x=>{const a=document.createElement('a');a.className='profile-tournament-row';a.href=`torneios.html?t=${encodeURIComponent(x.tournament.slug)}`;const name=document.createElement('span'),st=document.createElement('b'),tm=document.createElement('small');name.textContent=x.tournament.name;st.textContent=x.status==='champion'?'Campeão':x.status==='registered'?'Inscrito':x.status==='eliminated'?'Eliminado':'Removido';tm.textContent=fmt(x.tournament.starts_at);a.append(name,st,tm);host.append(a)})}
  function renderActivity(p,pts,ts,self){const host=$('[data-profile-activity]');if(!host)return;host.replaceChildren();const rows=[['Entrada na comunidade',date(p.created_at)],['Pontuação atual',`${pts} pontos`],['Participações em torneios',String(ts.length)]];if(self)rows.push(['Última presença',fmt(state.profile?.last_seen_at)]);rows.forEach(([k,v])=>{const x=document.createElement('div');x.className='profile-activity-row';const s=document.createElement('span'),b=document.createElement('strong');s.textContent=k;b.textContent=v;x.append(s,b);host.append(x)})}
  function renderSettings(self,p){const panel=$('[data-profile-settings]');if(!panel)return;panel.hidden=!self;if(!self)return;const f=panel.querySelector('form');if(f){f.elements.display_name.value=p.display_name||'';f.elements.username.value=p.username||'';f.elements.bio.value=p.bio||'';f.elements.friend_request_policy.value=p.friend_request_policy||'everyone'}}
  async function saveProfile(e){
    e.preventDefault();const f=e.currentTarget,btn=f.querySelector('[type="submit"]'),payload={display_name:f.elements.display_name.value.replace(/\s+/g,' ').trim().slice(0,60),username:f.elements.username.value.trim().toLowerCase(),bio:f.elements.bio.value.trim().slice(0,240),friend_request_policy:f.elements.friend_request_policy.value,updated_at:new Date().toISOString()};
    if(!payload.display_name)return toast('Informe seu nome público.','error');if(!/^[a-z0-9_.]{3,24}$/.test(payload.username))return toast('Username inválido. Use 3 a 24 letras minúsculas, números, ponto ou _.','error');if(btn)btn.disabled=true;
    const r=await c.from('italo_profiles').update(payload).eq('user_id',state.session.user.id).select('user_id,display_name,username,avatar_url,bio,friend_request_policy,is_channel_member,role_badge,created_at,last_seen_at').single();if(btn)btn.disabled=false;
    if(r.error){toast(/duplicate|unique/i.test(r.error.message||'')?'Este username já está em uso.':'Não foi possível salvar o perfil.','error');return}state.profile=r.data;profiles.set(r.data.user_id,r.data);toast('Perfil salvo com sucesso.','success');renderHeader();renderProfile();
  }
  async function runSearch(){
    const input=$('[data-user-search]'),host=$('[data-user-results]');if(!input||!host)return;const q=input.value.replace(/[%,()]/g,' ').replace(/\s+/g,' ').trim().slice(0,48),seq=++searchSeq;
    if(q.length<2){host.innerHTML='<div class="launch-empty">Digite pelo menos 2 caracteres.</div>';return}host.innerHTML='<div class="launch-loading">Pesquisando…</div>';
    const r=await c.from('italo_profiles').select('user_id,display_name,username,avatar_url,bio,is_channel_member,role_badge,created_at').or(`display_name.ilike.%${q}%,username.ilike.%${q}%`).order('display_name').limit(20);if(seq!==searchSeq)return;host.replaceChildren();
    if(r.error){host.innerHTML='<div class="launch-error">Não foi possível pesquisar agora.</div>';return}if(!r.data?.length){host.innerHTML='<div class="launch-empty">Nenhum jogador encontrado.</div>';return}(r.data||[]).forEach(p=>{profiles.set(p.user_id,p);host.append(userCard(p))});
  }
  function bindProfile(){
    activateTabs();$('[data-profile-form]')?.addEventListener('submit',saveProfile);$('[data-user-search-btn]')?.addEventListener('click',runSearch);const input=$('[data-user-search]');input?.addEventListener('input',()=>{clearTimeout(searchTimer);searchTimer=setTimeout(runSearch,350)});input?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(searchTimer);runSearch()}});$('[data-social-login]')?.addEventListener('click',social.signIn);$('[data-social-logout]')?.addEventListener('click',social.signOut);
  }
  function startRealtime(){if(!state?.session)return;channel&&c.removeChannel(channel);channel=c.channel('italo-launch-social-'+state.session.user.id).on('postgres_changes',{event:'*',schema:'public',table:'italo_notifications',filter:`user_id=eq.${state.session.user.id}`},async()=>{const r=await c.from('italo_notifications').select('id,user_id,actor_user_id,kind,title,body,entity_id,read_at,created_at').eq('user_id',state.session.user.id).order('created_at',{ascending:false}).limit(50);if(!r.error){state.notifications=r.data||[];renderHeader();renderNotifications()}}).subscribe()}
  async function init(s){social=s;c=s.client;state=s.state;renderHeader();if(state.session)renderNotifications();startRealtime();if(state.session){await hydrate([state.profile?.user_id,...state.friendships.flatMap(x=>[x.user_low,x.user_high]),...state.blocks.map(x=>x.blocked_id)])}bindProfile();$$('[data-social-auth]').forEach(x=>x.hidden=!state.session);$$('[data-social-guest]').forEach(x=>x.hidden=!!state.session);if(state.session){$('[data-social-logout]')?.removeAttribute('hidden');await renderProfile()}}
  document.addEventListener('italo:social-ready',e=>init(e.detail),{once:true});if(window.ITALO_SOCIAL)init(window.ITALO_SOCIAL);
})();