(() => {
  const SUPABASE_URL = 'https://yncspxfsvlqdnodlsosb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_jALAHHuvrV5oxj2mugWTCQ_stD_vFyN';
  const supabaseFactory = window.supabase?.createClient;
  if (!supabaseFactory) return;

  const client = window.ITALO_SUPABASE || supabaseFactory(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'italo-community-auth' }
  });
  window.ITALO_SUPABASE = client;

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = {
    session:null,
    profile:null,
    access:null,
    membership:null,
    friendships:[],
    blocks:[],
    notifications:[],
    profilesById:new Map(),
    busy:false
  };

  const api = {
    profiles: {
      me: uid => client.from('italo_profiles').select('user_id,display_name,username,avatar_url,bio,friend_request_policy,is_channel_member,created_at,last_seen_at').eq('user_id',uid).maybeSingle(),
      byUsername: username => client.from('italo_profiles').select('user_id,display_name,username,avatar_url,bio,is_channel_member,created_at').eq('username',username).maybeSingle(),
      byIds: ids => ids.length ? client.from('italo_profiles').select('user_id,display_name,username,avatar_url,bio,is_channel_member,created_at').in('user_id',ids) : Promise.resolve({data:[],error:null}),
      search: term => client.from('italo_profiles').select('user_id,display_name,username,avatar_url,bio,is_channel_member,created_at').or(`display_name.ilike.%${escapeFilter(term)}%,username.ilike.%${escapeFilter(term)}%`).order('display_name').limit(20),
      save: (uid,payload) => client.from('italo_profiles').update(payload).eq('user_id',uid).select('user_id,display_name,username,avatar_url,bio,friend_request_policy,is_channel_member,created_at,last_seen_at').single()
    },
    friendships: {
      mine: uid => client.from('italo_friendships').select('id,user_low,user_high,requested_by,status,created_at,accepted_at').or(`user_low.eq.${uid},user_high.eq.${uid}`).order('created_at',{ascending:false}).limit(200),
      send: target => client.rpc('italo_send_friend_request',{target_user_id:target}),
      respond: (id,accept) => client.rpc('italo_respond_friend_request',{friendship_id:id,accept_request:accept}),
      cancel: id => client.rpc('italo_cancel_friend_request',{friendship_id:id}),
      remove: id => client.rpc('italo_remove_friend',{friendship_id:id}),
      relation: target => client.rpc('italo_friendship_state',{target_user_id:target}),
      count: target => client.rpc('italo_friend_count',{target_user_id:target})
    },
    blocks: {
      mine: uid => client.from('italo_blocks').select('blocker_id,blocked_id,created_at').eq('blocker_id',uid).limit(200),
      block: target => client.rpc('italo_block_user',{target_user_id:target}),
      unblock: target => client.rpc('italo_unblock_user',{target_user_id:target})
    },
    notifications: {
      mine: uid => client.from('italo_notifications').select('id,user_id,actor_user_id,kind,title,body,entity_id,read_at,created_at').eq('user_id',uid).order('created_at',{ascending:false}).limit(40),
      markRead: (uid,ids) => ids.length ? client.from('italo_notifications').update({read_at:new Date().toISOString()}).eq('user_id',uid).in('id',ids) : Promise.resolve({data:null,error:null})
    },
    access: uid => client.from('italo_account_access').select('user_id,role,account_status,created_at').eq('user_id',uid).maybeSingle(),
    membership: uid => client.from('italo_memberships').select('user_id,is_member,source,verified_at').eq('user_id',uid).maybeSingle(),
    privateSync: payload => client.from('italo_user_private').upsert(payload,{onConflict:'user_id'})
  };

  function escapeFilter(value='') { return String(value).replace(/[%,()]/g,' ').replace(/\s+/g,' ').trim().slice(0,48); }
  function safeText(value='') { return String(value ?? '').trim(); }
  function formatDate(value) {
    if (!value) return '';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium'}).format(d);
  }
  function formatDateTime(value) {
    if (!value) return '';
    const d = new Date(value); if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d);
  }
  function avatarUrl(profile) { return profile?.avatar_url || 'assets/avatar.jpg'; }
  function otherUserId(friendship,me) { return friendship.user_low===me ? friendship.user_high : friendship.user_low; }
  function isIncoming(friendship,me) { return friendship.status==='pending' && friendship.requested_by!==me; }
  function isOutgoing(friendship,me) { return friendship.status==='pending' && friendship.requested_by===me; }
  function isFriend(friendship) { return friendship.status==='accepted'; }

  function toast(message,kind='info') {
    let el=$('[data-social-toast]');
    if (!el) { el=document.createElement('div'); el.className='social-toast'; el.dataset.socialToast=''; document.body.append(el); }
    el.textContent=message; el.dataset.kind=kind; el.classList.add('show');
    clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove('show'),3400);
  }
  function errorMessage(error,fallback='Não foi possível concluir esta ação.') {
    const msg=safeText(error?.message || error?.details || '');
    if (/5 segundos/i.test(msg)) return 'Aguarde 5 segundos antes de publicar novamente.';
    if (/limite de 20/i.test(msg)) return 'Você atingiu o limite de 20 amigos.';
    if (/já existe uma solicitação/i.test(msg)) return 'Já existe uma solicitação de amizade pendente.';
    if (/já são amigos/i.test(msg)) return 'Vocês já são amigos.';
    if (/bloque/i.test(msg)) return 'Esta ação não está disponível por causa de um bloqueio.';
    if (/não está aceitando/i.test(msg)) return 'Este usuário não está aceitando solicitações de amizade.';
    if (/amigos de amigos/i.test(msg)) return 'Este usuário aceita solicitações apenas de amigos de amigos.';
    return msg && msg.length<180 ? msg : fallback;
  }
  function setStatus(el,text,kind='') { if (!el) return; el.textContent=text; el.dataset.state=kind; el.hidden=!text; }
  function setBusy(button,busy,normal,loading='Processando…') { if (!button) return; button.disabled=busy; button.setAttribute('aria-busy',String(busy)); if(normal) button.textContent=busy?loading:normal; }

  function sessionIdentity(session) {
    const user=session?.user; const meta=user?.user_metadata||{};
    const raw=meta.full_name||meta.name||user?.email?.split('@')[0]||'Jogador';
    return {id:user?.id||null,name:String(raw).replace(/\s+/g,' ').trim().slice(0,60)||'Jogador',avatar:meta.avatar_url||meta.picture||'assets/avatar.jpg',email:user?.email||null};
  }

  async function syncAccount() {
    if (!state.session?.user) return;
    const p=sessionIdentity(state.session); const now=new Date().toISOString();
    const profileResult=await client.from('italo_profiles').upsert({user_id:p.id,display_name:p.name,avatar_url:p.avatar,last_seen_at:now},{onConflict:'user_id'}).select('user_id,display_name,username,avatar_url,bio,friend_request_policy,is_channel_member,created_at,last_seen_at').single();
    if (profileResult.error) throw profileResult.error;
    state.profile=profileResult.data;
    await api.privateSync({user_id:p.id,email:p.email,last_seen_at:now,updated_at:now});
    const [access,membership]=await Promise.all([api.access(p.id),api.membership(p.id)]);
    if (access.error) throw access.error; if (membership.error) throw membership.error;
    state.access=access.data; state.membership=membership.data;
  }

  function ensureHeaderActions() {
    const containers=$$('[data-social-actions]');
    containers.forEach(container=>{
      container.replaceChildren();
      if (!state.session?.user) {
        const btn=document.createElement('button'); btn.type='button'; btn.className='social-nav-btn'; btn.textContent='Entrar'; btn.addEventListener('click',signIn); container.append(btn); return;
      }
      const profile=document.createElement('a'); profile.className='social-nav-btn'; profile.href='perfil.html'; profile.textContent='👤 Perfil';
      const unread=state.notifications.filter(n=>!n.read_at).length;
      if(unread){const badge=document.createElement('span'); badge.className='social-count-badge'; badge.textContent=String(Math.min(unread,99)); profile.append(badge);}
      container.append(profile);
      if(state.access?.role==='admin'&&state.access?.account_status==='active'){
        const admin=document.createElement('a'); admin.className='social-nav-btn social-admin-link'; admin.href='admin.html'; admin.textContent='⚙ ADM'; container.append(admin);
      }
    });
  }

  async function signIn() {
    const redirectTo=location.origin+location.pathname+location.search;
    const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo,prompt:'select_account'}});
    if(error) toast(errorMessage(error,'Não foi possível abrir o login.'),'error');
  }
  async function signOut(){ await client.auth.signOut(); location.href='comunidade.html'; }

  function relationFor(targetId) {
    return state.friendships.find(f=>f.user_low===targetId||f.user_high===targetId)||null;
  }
  function blockedByMe(targetId){ return state.blocks.some(b=>b.blocked_id===targetId); }

  async function refreshSocialCollections() {
    if (!state.session?.user) return;
    const uid=state.session.user.id;
    const [friendships,blocks,notifications]=await Promise.all([api.friendships.mine(uid),api.blocks.mine(uid),api.notifications.mine(uid)]);
    if(friendships.error) throw friendships.error; if(blocks.error) throw blocks.error; if(notifications.error) throw notifications.error;
    state.friendships=friendships.data||[]; state.blocks=blocks.data||[]; state.notifications=notifications.data||[];
    const ids=[...new Set(state.friendships.map(f=>otherUserId(f,uid)).filter(Boolean))];
    if(ids.length){const profiles=await api.profiles.byIds(ids); if(!profiles.error) profiles.data?.forEach(p=>state.profilesById.set(p.user_id,p));}
    ensureHeaderActions();
  }

  function profileLink(profile){ return `perfil.html?u=${encodeURIComponent(profile.username)}`; }
  function makeAvatar(profile,size=48){const img=document.createElement('img'); img.src=avatarUrl(profile); img.alt=''; img.width=size; img.height=size; img.loading='lazy'; img.onerror=()=>{img.src='assets/avatar.jpg';}; return img;}
  function memberBadge(profile){ if(!profile?.is_channel_member) return null; const b=document.createElement('span'); b.className='member-badge'; b.textContent='★ Membro'; return b; }

  function renderCompactUser(profile,{subtitle='',actions=null}={}) {
    const card=document.createElement('article'); card.className='social-user-card';
    const link=document.createElement('a'); link.className='social-user-main'; link.href=profileLink(profile); link.append(makeAvatar(profile));
    const copy=document.createElement('span'); copy.className='social-user-copy'; const name=document.createElement('strong'); name.textContent=profile.display_name||'Jogador'; const user=document.createElement('small'); user.textContent='@'+profile.username; copy.append(name,user); const badge=memberBadge(profile); if(badge) copy.append(badge); if(subtitle){const s=document.createElement('em'); s.textContent=subtitle; copy.append(s);} link.append(copy); card.append(link);
    if(actions){const box=document.createElement('div'); box.className='social-user-actions'; actions.forEach(a=>box.append(a)); card.append(box);} return card;
  }

  function actionButton(label,className,handler){const b=document.createElement('button');b.type='button';b.className=className||'social-btn secondary';b.textContent=label;b.addEventListener('click',handler);return b;}

  async function runFriendAction(action,id,target,button) {
    const labels={send:'Adicionar amigo',accept:'Aceitar',decline:'Recusar',cancel:'Cancelar solicitação',remove:'Remover amigo',block:'Bloquear',unblock:'Desbloquear'};
    setBusy(button,true,labels[action]||button?.textContent);
    let result;
    if(action==='send') result=await api.friendships.send(target);
    if(action==='accept') result=await api.friendships.respond(id,true);
    if(action==='decline') result=await api.friendships.respond(id,false);
    if(action==='cancel') result=await api.friendships.cancel(id);
    if(action==='remove') result=await api.friendships.remove(id);
    if(action==='block') result=await api.blocks.block(target);
    if(action==='unblock') result=await api.blocks.unblock(target);
    setBusy(button,false,labels[action]||button?.textContent);
    if(result?.error){toast(errorMessage(result.error),'error');return false;}
    const messages={send:'Solicitação enviada.',accept:'Solicitação aceita.',decline:'Solicitação recusada.',cancel:'Solicitação cancelada.',remove:'Amizade removida.',block:'Usuário bloqueado.',unblock:'Usuário desbloqueado.'}; toast(messages[action]||'Atualizado.','success');
    await refreshSocialCollections(); renderDashboardLists(); await renderViewedProfile(); return true;
  }

  function buildRelationActions(targetProfile) {
    const me=state.session?.user?.id; if(!me||targetProfile.user_id===me) return [];
    const relation=relationFor(targetProfile.user_id); const blocked=blockedByMe(targetProfile.user_id); const buttons=[];
    if(blocked){buttons.push(actionButton('Desbloquear','social-btn secondary',e=>runFriendAction('unblock',null,targetProfile.user_id,e.currentTarget)));return buttons;}
    if(!relation){buttons.push(actionButton('Adicionar amigo','social-btn primary',e=>runFriendAction('send',null,targetProfile.user_id,e.currentTarget)));}
    else if(isFriend(relation)){const b=actionButton('Amigos ✓','social-btn secondary',()=>{}); b.disabled=true; buttons.push(b); buttons.push(actionButton('Remover','social-btn danger',async e=>{if(confirm('Remover esta amizade?')) await runFriendAction('remove',relation.id,targetProfile.user_id,e.currentTarget);}));}
    else if(isOutgoing(relation,me)){const b=actionButton('Solicitação enviada','social-btn secondary',()=>{}); b.disabled=true; buttons.push(b); buttons.push(actionButton('Cancelar','social-btn danger',e=>runFriendAction('cancel',relation.id,targetProfile.user_id,e.currentTarget)));}
    else {buttons.push(actionButton('Aceitar','social-btn primary',e=>runFriendAction('accept',relation.id,targetProfile.user_id,e.currentTarget))); buttons.push(actionButton('Recusar','social-btn secondary',e=>runFriendAction('decline',relation.id,targetProfile.user_id,e.currentTarget)));}
    buttons.push(actionButton('Bloquear','social-link-danger',async e=>{if(confirm('Bloquear este usuário? Solicitações ou amizade existentes serão removidas.')) await runFriendAction('block',null,targetProfile.user_id,e.currentTarget);}));
    return buttons;
  }

  async function renderViewedProfile() {
    const host=$('[data-viewed-profile]'); if(!host||!state.session?.user) return;
    const params=new URLSearchParams(location.search); const username=params.get('u');
    let profile=state.profile;
    if(username&&username!==state.profile?.username){const result=await api.profiles.byUsername(username.toLowerCase()); if(result.error||!result.data){host.innerHTML='<div class="social-empty">Perfil não encontrado ou indisponível.</div>';return;} profile=result.data;}
    host.replaceChildren();
    const card=document.createElement('section'); card.className='social-profile-card';
    const top=document.createElement('div'); top.className='social-profile-top'; top.append(makeAvatar(profile,84));
    const copy=document.createElement('div'); copy.className='social-profile-copy'; const name=document.createElement('h1'); name.textContent=profile.display_name; const user=document.createElement('p'); user.textContent='@'+profile.username; copy.append(name,user); const badge=memberBadge(profile); if(badge)copy.append(badge); if(profile.bio){const bio=document.createElement('div');bio.className='social-bio';bio.textContent=profile.bio;copy.append(bio);} top.append(copy); card.append(top);
    const count=await api.friendships.count(profile.user_id); const stats=document.createElement('div');stats.className='social-profile-stats'; const friend=document.createElement('span');friend.innerHTML=`<b>${count.error?'—':count.data??0}</b> amigos`; const since=document.createElement('span');since.innerHTML=`<b>${formatDate(profile.created_at)||'—'}</b> na comunidade`; stats.append(friend,since);card.append(stats);
    if(profile.user_id!==state.session.user.id){const actions=document.createElement('div');actions.className='social-profile-actions';buildRelationActions(profile).forEach(b=>actions.append(b));card.append(actions);} else {const edit=document.createElement('a');edit.href='#editar-perfil';edit.className='social-btn secondary';edit.textContent='Editar meu perfil';card.append(edit);}
    host.append(card);
  }

  function renderDashboardLists() {
    if(!state.session?.user) return; const me=state.session.user.id;
    const friendHost=$('[data-friends-list]'),incomingHost=$('[data-incoming-list]'),outgoingHost=$('[data-outgoing-list]'),blockedHost=$('[data-blocked-list]'),notificationsHost=$('[data-notifications-list]');
    const render=(host,items,emptyText,make)=>{if(!host)return;host.replaceChildren();if(!items.length){const e=document.createElement('div');e.className='social-empty';e.textContent=emptyText;host.append(e);return;}items.forEach(item=>host.append(make(item)));};
    const friends=state.friendships.filter(isFriend), incoming=state.friendships.filter(f=>isIncoming(f,me)), outgoing=state.friendships.filter(f=>isOutgoing(f,me));
    render(friendHost,friends,'Você ainda não adicionou amigos.',f=>{const p=state.profilesById.get(otherUserId(f,me));if(!p)return document.createElement('div');return renderCompactUser(p,{subtitle:`Amigos desde ${formatDate(f.accepted_at)}`,actions:[actionButton('Ver perfil','social-btn secondary',()=>{location.href=profileLink(p);})]});});
    render(incomingHost,incoming,'Nenhuma solicitação recebida.',f=>{const p=state.profilesById.get(otherUserId(f,me));if(!p)return document.createElement('div');return renderCompactUser(p,{subtitle:'Quer ser seu amigo',actions:[actionButton('Aceitar','social-btn primary',e=>runFriendAction('accept',f.id,p.user_id,e.currentTarget)),actionButton('Recusar','social-btn secondary',e=>runFriendAction('decline',f.id,p.user_id,e.currentTarget))]});});
    render(outgoingHost,outgoing,'Nenhuma solicitação enviada.',f=>{const p=state.profilesById.get(otherUserId(f,me));if(!p)return document.createElement('div');return renderCompactUser(p,{subtitle:'Solicitação pendente',actions:[actionButton('Cancelar','social-btn danger',e=>runFriendAction('cancel',f.id,p.user_id,e.currentTarget))]});});
    const blockedProfiles=state.blocks.map(b=>state.profilesById.get(b.blocked_id)).filter(Boolean);
    render(blockedHost,blockedProfiles,'Nenhum usuário bloqueado.',p=>renderCompactUser(p,{actions:[actionButton('Desbloquear','social-btn secondary',e=>runFriendAction('unblock',null,p.user_id,e.currentTarget))]}));
    render(notificationsHost,state.notifications,'Nenhuma notificação por enquanto.',n=>{const row=document.createElement('article');row.className='social-notification'+(n.read_at?'':' unread');const icon=document.createElement('span');icon.className='social-notification-icon';icon.textContent=n.kind.startsWith('friend')?'👤':n.kind==='membership'?'★':'•';const copy=document.createElement('div');const title=document.createElement('strong');title.textContent=n.title;const body=document.createElement('p');body.textContent=n.body;const time=document.createElement('small');time.textContent=formatDateTime(n.created_at);copy.append(title,body,time);row.append(icon,copy);return row;});
    const receivedCount=$('[data-received-count]'); if(receivedCount)receivedCount.textContent=String(incoming.length);
    const friendCount=$('[data-friend-count]'); if(friendCount)friendCount.textContent=String(friends.length);
    const memberLimit=$('[data-friend-limit]'); if(memberLimit)memberLimit.textContent=state.profile?.is_channel_member?'Benefício de membro: limite normal de 20 não se aplica.':`${friends.length}/20 amigos`;
  }

  async function runSearch() {
    const input=$('[data-user-search]'),host=$('[data-user-results]'),status=$('[data-user-search-status]'); if(!input||!host)return;
    const term=safeText(input.value); if(term.length<2){setStatus(status,'Digite pelo menos 2 caracteres.','empty');host.replaceChildren();return;}
    setStatus(status,'Buscando usuários…','loading'); const result=await api.profiles.search(term); if(result.error){setStatus(status,'Não foi possível pesquisar agora.','error');return;}
    const rows=(result.data||[]).filter(p=>p.user_id!==state.session?.user?.id); host.replaceChildren();
    if(!rows.length){setStatus(status,'Nenhum usuário encontrado.','empty');return;} setStatus(status,`${rows.length} resultado${rows.length===1?'':'s'}.`,'success');
    rows.forEach(p=>host.append(renderCompactUser(p,{actions:buildRelationActions(p)})));
  }

  async function saveProfile(event) {
    event.preventDefault(); if(!state.session?.user)return;
    const form=event.currentTarget; const fd=new FormData(form); const display=safeText(fd.get('display_name')).replace(/\s+/g,' ').slice(0,60); const username=safeText(fd.get('username')).toLowerCase(); const bio=safeText(fd.get('bio')).slice(0,240); const policy=safeText(fd.get('friend_request_policy'));
    if(display.length<1){toast('Informe seu nome.','error');return;} if(!/^[a-z0-9_.]{3,24}$/.test(username)){toast('Username: 3 a 24 caracteres, apenas letras minúsculas, números, ponto e _.','error');return;}
    const button=$('[data-save-profile]',form);setBusy(button,true,'Salvar perfil','Salvando…');const result=await api.profiles.save(state.session.user.id,{display_name:display,username,bio,friend_request_policy:policy,last_seen_at:new Date().toISOString()});setBusy(button,false,'Salvar perfil');
    if(result.error){toast(/duplicate|unique/i.test(result.error.message||'')?'Este username já está em uso.':errorMessage(result.error),'error');return;} state.profile=result.data;toast('Perfil atualizado.','success');history.replaceState(null,'','perfil.html');await renderViewedProfile();
  }

  function populateEditor() {
    const form=$('[data-profile-form]');if(!form||!state.profile)return;
    form.elements.display_name.value=state.profile.display_name||'';form.elements.username.value=state.profile.username||'';form.elements.bio.value=state.profile.bio||'';form.elements.friend_request_policy.value=state.profile.friend_request_policy||'everyone';
  }

  async function markNotificationsRead() {
    const ids=state.notifications.filter(n=>!n.read_at).map(n=>n.id); if(!ids.length){toast('Nenhuma notificação não lida.');return;}
    const result=await api.notifications.markRead(state.session.user.id,ids);if(result.error){toast(errorMessage(result.error),'error');return;}state.notifications.forEach(n=>{if(ids.includes(n.id))n.read_at=new Date().toISOString();});renderDashboardLists();ensureHeaderActions();toast('Notificações marcadas como lidas.','success');
  }

  function bindDashboard() {
    $('[data-social-login]')?.addEventListener('click',signIn); $('[data-social-logout]')?.addEventListener('click',signOut);
    $('[data-user-search-btn]')?.addEventListener('click',runSearch); $('[data-user-search]')?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();runSearch();}});
    $('[data-profile-form]')?.addEventListener('submit',saveProfile); $('[data-mark-read]')?.addEventListener('click',markNotificationsRead);
    $$('[data-social-tab]').forEach(btn=>btn.addEventListener('click',()=>{const target=btn.dataset.socialTab;$$('[data-social-tab]').forEach(b=>b.classList.toggle('active',b===btn));$$('[data-social-panel]').forEach(p=>p.hidden=p.dataset.socialPanel!==target);}));
  }

  async function initDashboard() {
    const root=$('[data-social-root]'); if(!root)return;
    bindDashboard(); const signed=!!state.session?.user; root.classList.toggle('is-signed-out',!signed); root.classList.toggle('is-signed-in',signed);
    const guest=$('[data-social-guest]'),app=$('[data-social-app]');if(guest)guest.hidden=signed;if(app)app.hidden=!signed;
    if(!signed)return;
    populateEditor(); await refreshSocialCollections(); renderDashboardLists(); await renderViewedProfile();
    const role=$('[data-account-role]');if(role)role.textContent=state.access?.role==='admin'?'Administrador':state.profile?.is_channel_member?'Membro':'Usuário';
    const logout=$('[data-social-logout]'); if(logout)logout.hidden=false;
  }

  let socialChannel=null;
  function startRealtime(){
    if(!state.session?.user)return;
    const uid=state.session.user.id;
    if(socialChannel) client.removeChannel(socialChannel);
    socialChannel=client.channel(`italo-social-${uid}`)
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_friendships'},()=>debouncedRefresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_notifications',filter:`user_id=eq.${uid}`},()=>debouncedRefresh())
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_blocks'},()=>debouncedRefresh())
      .on('postgres_changes',{event:'UPDATE',schema:'public',table:'italo_memberships',filter:`user_id=eq.${uid}`},()=>debouncedFullRefresh())
      .subscribe();
  }
  function debouncedRefresh(){clearTimeout(debouncedRefresh.t);debouncedRefresh.t=setTimeout(async()=>{try{await refreshSocialCollections();renderDashboardLists();await renderViewedProfile();}catch{}},250);}
  function debouncedFullRefresh(){clearTimeout(debouncedFullRefresh.t);debouncedFullRefresh.t=setTimeout(()=>location.reload(),350);}

  async function bootstrap(nextSession) {
    state.session=nextSession||null;
    if(state.session?.user){try{await syncAccount();await refreshSocialCollections();startRealtime();}catch(error){console.error('Falha ao iniciar recursos sociais:',error);toast('Não foi possível carregar todos os recursos sociais.','error');}}
    ensureHeaderActions(); await initDashboard();
    window.ITALO_SOCIAL={client,state,api,refresh:refreshSocialCollections,toast,signIn,signOut,ready:Promise.resolve(state)};
    document.dispatchEvent(new CustomEvent('italo:social-ready',{detail:window.ITALO_SOCIAL}));
  }

  client.auth.getSession().then(({data})=>bootstrap(data.session));
  client.auth.onAuthStateChange((event,nextSession)=>{if(event==='SIGNED_IN'&&nextSession&&!state.session)bootstrap(nextSession);if(event==='SIGNED_OUT'){state.session=null;state.profile=null;state.access=null;state.membership=null;ensureHeaderActions();}});
})();
