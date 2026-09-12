(() => {
  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const ui = {
    denied: $('[data-admin-denied]'),
    app: $('[data-admin-app]'),
    stats: $('[data-admin-stats]'),
    search: $('[data-admin-search]'),
    filter: $('[data-admin-filter]'),
    searchBtn: $('[data-admin-search-btn]'),
    users: $('[data-admin-users]'),
    messages: $('[data-admin-messages]'),
    posts: $('[data-admin-posts]'),
    refreshModeration: $('[data-refresh-moderation]'),
    tournamentForm: $('[data-tournament-form]'),
    tournaments: $('[data-admin-tournaments]'),
    audit: $('[data-admin-audit]'),
    refreshAudit: $('[data-refresh-audit]')
  };

  let social = null;
  let client = null;
  let state = null;
  let userSearchTimer = 0;
  const profileCache = new Map();

  const fmt = value => {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d);
  };
  const toast = (message, kind='info') => social?.toast?.(message, kind);
  const isAdmin = () => ['admin','owner'].includes(state?.access?.role) && state?.access?.account_status === 'active';
  const isOwner = () => state?.access?.role === 'owner' && state?.access?.account_status === 'active';

  function friendly(error, fallback='Não foi possível concluir esta ação.') {
    const msg = String(error?.message || error?.details || '');
    if (/owner.*proteg|conta Owner/i.test(msg)) return 'A conta Owner é protegida e não pode receber essa alteração.';
    if (/somente o owner/i.test(msg)) return 'Somente o Owner pode executar esta ação.';
    if (/restrita a administradores|permission|permiss/i.test(msg)) return 'Você não possui permissão para executar esta ação.';
    if (/dura[cç][aã]o inv/i.test(msg)) return 'Escolha uma duração válida.';
    if (/lotad/i.test(msg)) return 'O torneio atingiu o limite de participantes.';
    if (/duplic|unique/i.test(msg)) return 'Essa operação já foi realizada.';
    if (/prazo|encerrad/i.test(msg)) return 'O prazo desta operação já terminou.';
    return fallback;
  }

  function button(label, cls, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = cls || 'social-btn secondary';
    b.textContent = label;
    b.addEventListener('click', fn);
    return b;
  }
  function avatar(profile) {
    const img = document.createElement('img');
    img.src = profile?.avatar_url || 'assets/avatar.jpg';
    img.alt = '';
    img.loading = 'lazy';
    img.onerror = () => { img.src='assets/avatar.jpg'; };
    return img;
  }
  async function rpc(name,args,buttonEl,successMessage) {
    const previous = buttonEl?.textContent;
    if (buttonEl) { buttonEl.disabled=true; buttonEl.setAttribute('aria-busy','true'); }
    const result = await client.rpc(name,args);
    if (buttonEl) { buttonEl.disabled=false; buttonEl.removeAttribute('aria-busy'); if(previous)buttonEl.textContent=previous; }
    if (result.error) { toast(friendly(result.error),'error'); return null; }
    if (successMessage) toast(successMessage,'success');
    return result.data;
  }

  function stat(label,value) {
    const el=document.createElement('div'); el.className='admin-stat';
    const small=document.createElement('small'); small.textContent=label;
    const strong=document.createElement('strong'); strong.textContent=String(value ?? '—');
    el.append(small,strong); return el;
  }

  async function loadStats() {
    if(!ui.stats) return;
    ui.stats.replaceChildren();
    const [users,members,admins,restrictions] = await Promise.all([
      client.from('italo_profiles').select('user_id',{count:'exact',head:true}),
      client.from('italo_memberships').select('user_id',{count:'exact',head:true}).eq('is_member',true),
      client.from('italo_account_access').select('user_id',{count:'exact',head:true}).in('role',['admin','owner']).eq('account_status','active'),
      client.from('italo_message_restrictions').select('id',{count:'exact',head:true}).is('lifted_at',null)
    ]);
    ui.stats.append(
      stat('Usuários',users.count ?? 0),
      stat('Membros Exclusivos',members.count ?? 0),
      stat('Administradores',admins.count ?? 0),
      stat('Restrições registradas',restrictions.count ?? 0)
    );
  }

  async function findUserIdsByEmail(term) {
    const r=await client.from('italo_user_private').select('user_id').ilike('email',`%${term.replace(/[%,()]/g,' ')}%`).limit(50);
    if(r.error) throw r.error;
    return (r.data||[]).map(x=>x.user_id);
  }

  async function loadUsers() {
    if(!ui.users) return;
    ui.users.innerHTML='<div class="launch-loading">Carregando usuários…</div>';
    try {
      const term=(ui.search?.value||'').replace(/[%,()]/g,' ').replace(/\s+/g,' ').trim().slice(0,80);
      const filter=ui.filter?.value||'all';
      let q=client.from('italo_profiles').select('user_id,display_name,username,avatar_url,role_badge,is_channel_member,created_at,last_seen_at').order('created_at',{ascending:false}).limit(100);
      if(term.includes('@')){
        const ids=await findUserIdsByEmail(term);
        if(!ids.length){ui.users.innerHTML='<div class="launch-empty">Nenhum usuário encontrado.</div>';return;}
        q=q.in('user_id',ids);
      } else if(term.length>=2) {
        q=q.or(`display_name.ilike.%${term}%,username.ilike.%${term}%`);
      }
      const profiles=await q;
      if(profiles.error) throw profiles.error;
      let rows=profiles.data||[];
      if(!rows.length){ui.users.innerHTML='<div class="launch-empty">Nenhum usuário encontrado.</div>';return;}
      const ids=rows.map(x=>x.user_id);
      const [access,members,priv,restrictions] = await Promise.all([
        client.from('italo_account_access').select('user_id,role,account_status,created_at').in('user_id',ids),
        client.from('italo_memberships').select('user_id,is_member,source,verified_at').in('user_id',ids),
        client.from('italo_user_private').select('user_id,email,last_seen_at').in('user_id',ids),
        client.from('italo_message_restrictions').select('id,user_id,scope,starts_at,expires_at,permanent,lifted_at').in('user_id',ids).eq('scope','chat').is('lifted_at',null).order('created_at',{ascending:false})
      ]);
      for(const r of [access,members,priv,restrictions]) if(r.error) throw r.error;
      const a=new Map((access.data||[]).map(x=>[x.user_id,x]));
      const m=new Map((members.data||[]).map(x=>[x.user_id,x]));
      const p=new Map((priv.data||[]).map(x=>[x.user_id,x]));
      const now=Date.now();
      const activeRestrictions=new Map();
      (restrictions.data||[]).forEach(x=>{
        if(activeRestrictions.has(x.user_id)) return;
        if(x.permanent || (x.expires_at && new Date(x.expires_at).getTime()>now)) activeRestrictions.set(x.user_id,x);
      });
      rows=rows.map(row=>({...row,access:a.get(row.user_id),membership:m.get(row.user_id),private:p.get(row.user_id),restriction:activeRestrictions.get(row.user_id)}));
      if(filter==='admin') rows=rows.filter(x=>['admin','owner'].includes(x.access?.role)&&x.access?.account_status==='active');
      if(filter==='member') rows=rows.filter(x=>x.membership?.is_member);
      if(filter==='inactive') rows=rows.filter(x=>x.access?.account_status&&x.access.account_status!=='active');
      if(filter==='user') rows=rows.filter(x=>x.access?.role==='user'&&!x.membership?.is_member&&x.access?.account_status==='active');
      renderUsers(rows);
    } catch {
      ui.users.innerHTML='<div class="launch-error">Não foi possível carregar os usuários.</div>';
    }
  }

  function roleLabel(row) {
    if(row.access?.role==='owner') return 'Owner';
    if(row.access?.role==='admin') return 'Administrador';
    return 'Usuário';
  }

  function renderUsers(rows) {
    ui.users.replaceChildren();
    if(!rows.length){ui.users.innerHTML='<div class="launch-empty">Nenhum usuário encontrado.</div>';return;}
    rows.forEach(row=>{
      profileCache.set(row.user_id,row);
      const card=document.createElement('article'); card.className='admin-user';
      const ident=document.createElement('div'); ident.className='admin-user-id'; ident.append(avatar(row));
      const copy=document.createElement('div');
      const name=document.createElement('strong'); name.textContent=row.display_name||'Jogador';
      const username=document.createElement('small'); username.textContent=row.username?`@${row.username}`:'';
      copy.append(name,username);
      if(row.private?.email){const email=document.createElement('small');email.textContent=row.private.email;copy.append(email);}
      ident.append(copy);

      const meta=document.createElement('div');meta.className='admin-user-meta';
      const role=document.createElement('strong');role.textContent=roleLabel(row);
      const status=document.createElement('span');status.textContent=`Conta: ${row.access?.account_status||'active'}`;
      const member=document.createElement('span');member.textContent=row.membership?.is_member?'Membro Exclusivo':'Conta normal';
      const joined=document.createElement('span');joined.textContent=`Desde ${fmt(row.created_at)}`;
      meta.append(role,status,member,joined);

      const moderation=document.createElement('div');moderation.className='admin-user-meta';
      if(row.restriction){
        const r=document.createElement('strong');r.textContent=row.restriction.permanent?'Mensagens bloqueadas':'Bloqueado até '+fmt(row.restriction.expires_at);moderation.append(r);
      } else {const r=document.createElement('span');r.textContent='Comunicação liberada';moderation.append(r);}

      const actions=document.createElement('div');actions.className='admin-actions';
      const protectedOwner=row.access?.role==='owner';
      const actorSelf=row.user_id===state.session.user.id;

      const profile=document.createElement('a');profile.className='social-btn secondary';profile.href=row.username?`perfil.html?u=${encodeURIComponent(row.username)}`:'perfil.html';profile.textContent='Perfil';actions.append(profile);

      if(protectedOwner){
        const lock=document.createElement('span');lock.className='admin-owner-protected';lock.textContent='Owner protegido pelo backend';actions.append(lock);
        if(isOwner()){
          actions.append(button(row.membership?.is_member?'Remover Membro':'Tornar Membro','social-btn secondary',e=>setMember(row,!row.membership?.is_member,e.currentTarget)));
        }
      } else {
        actions.append(button(row.membership?.is_member?'Remover Membro':'Tornar Membro','social-btn secondary',e=>setMember(row,!row.membership?.is_member,e.currentTarget)));
        if(isOwner()&&!actorSelf){
          actions.append(button(row.access?.role==='admin'?'Remover ADM':'Tornar ADM','social-btn secondary',e=>setRole(row,row.access?.role==='admin'?'user':'admin',e.currentTarget)));
        }
        if(!actorSelf && (isOwner() || row.access?.role!=='admin')){
          actions.append(button(row.access?.account_status==='active'?'Suspender':'Reativar','social-btn danger',e=>setStatus(row,row.access?.account_status==='active'?'suspended':'active',e.currentTarget)));
          if(row.restriction){
            actions.append(button('Liberar mensagens','social-btn secondary',e=>liftRestriction(row,e.currentTarget)));
          } else {
            const duration=document.createElement('div');duration.className='admin-duration-grid';duration.hidden=true;
            const blockToggle=button('Bloquear mensagens','social-btn danger',()=>duration.hidden=!duration.hidden);
            actions.append(blockToggle);
            const options=[[5,'5 min'],[15,'15 min'],[30,'30 min'],[60,'1 h'],[360,'6 h'],[720,'12 h'],[1440,'24 h'],[4320,'3 dias'],[10080,'7 dias']];
            options.forEach(([minutes,label])=>duration.append(button(label,'social-btn secondary',e=>applyRestriction(row,minutes,false,e.currentTarget))));
            duration.append(button('Permanente','social-btn danger',e=>applyRestriction(row,null,true,e.currentTarget)));
            duration.append(button('Personalizado','social-btn secondary',e=>customRestriction(row,e.currentTarget)));
            actions.append(duration);
          }
        }
      }
      card.append(ident,meta,moderation,actions);
      ui.users.append(card);
    });
  }

  async function setMember(row,enabled,btn) {
    const data=await rpc('italo_admin_set_member',{target_user_id:row.user_id,enabled},btn,enabled?'Membro Exclusivo concedido.':'Membro Exclusivo removido.');
    if(data) { await Promise.all([loadUsers(),loadStats()]); }
  }
  async function setRole(row,newRole,btn) {
    if(!confirm(`${newRole==='admin'?'Tornar':'Remover'} administrador de @${row.username}?`))return;
    const data=await rpc('italo_admin_set_role',{target_user_id:row.user_id,new_role:newRole},btn,'Função administrativa atualizada.');
    if(data) await Promise.all([loadUsers(),loadStats()]);
  }
  async function setStatus(row,newStatus,btn) {
    if(!confirm(`${newStatus==='active'?'Reativar':'Suspender'} @${row.username}?`))return;
    const data=await rpc('italo_admin_set_status',{target_user_id:row.user_id,new_status:newStatus},btn,newStatus==='active'?'Conta reativada.':'Conta suspensa.');
    if(data) await Promise.all([loadUsers(),loadStats()]);
  }
  async function applyRestriction(row,minutes,permanent,btn) {
    const reason=prompt('Motivo opcional do bloqueio de mensagens:','') ?? '';
    const data=await rpc('italo_admin_set_message_block',{target_user_id:row.user_id,duration_minutes:minutes,make_permanent:permanent,reason_text:reason||null,restriction_scope:'chat'},btn,'Restrição de mensagens aplicada.');
    if(data) await Promise.all([loadUsers(),loadStats()]);
  }
  async function customRestriction(row,btn) {
    const raw=prompt('Informe a duração em minutos (1 a 525600):','120');
    if(raw===null)return;
    const minutes=Number(raw);
    if(!Number.isInteger(minutes)||minutes<1||minutes>525600){toast('Informe uma duração válida.','error');return;}
    await applyRestriction(row,minutes,false,btn);
  }
  async function liftRestriction(row,btn) {
    const data=await rpc('italo_admin_lift_message_block',{target_user_id:row.user_id,restriction_scope:'chat'},btn,'Envio de mensagens liberado.');
    if(data) await Promise.all([loadUsers(),loadStats()]);
  }

  async function loadModeration() {
    for(const host of [ui.messages,ui.posts]) if(host) host.innerHTML='<div class="launch-loading">Carregando…</div>';
    const [messages,posts]=await Promise.all([
      client.from('italo_messages').select('id,user_id,display_name,body,created_at,expires_at').order('created_at',{ascending:false}).limit(30),
      client.from('italo_resenha_posts').select('id,user_id,display_name,body,created_at,expires_at').order('created_at',{ascending:false}).limit(30)
    ]);
    renderModeration(ui.messages,messages.error?[]:messages.data||[],'message');
    renderModeration(ui.posts,posts.error?[]:posts.data||[],'post');
  }
  function renderModeration(host,rows,type){
    if(!host)return;host.replaceChildren();
    if(!rows.length){host.innerHTML='<div class="launch-empty">Nenhum conteúdo ativo.</div>';return;}
    rows.forEach(row=>{
      const item=document.createElement('article');item.className='admin-mod';
      const h=document.createElement('strong');h.textContent=row.display_name||'Jogador';
      const p=document.createElement('p');p.textContent=row.body||'';
      const small=document.createElement('small');small.textContent=fmt(row.created_at);
      const del=button('Excluir','social-btn danger',async e=>{
        if(!confirm('Excluir este conteúdo?'))return;
        const fn=type==='message'?'italo_admin_delete_message':'italo_admin_delete_post';
        const args=type==='message'?{message_id:row.id,reason_text:null}:{post_id:row.id,reason_text:null};
        const data=await rpc(fn,args,e.currentTarget,'Conteúdo removido.');
        if(data)item.remove();
      });
      item.append(h,p,small,del);host.append(item);
    });
  }

  const iso = value => value ? new Date(value).toISOString() : null;
  async function createTournament(event) {
    event.preventDefault();
    const form=event.currentTarget,fd=new FormData(form);
    const starts=iso(fd.get('starts_at')),deadline=iso(fd.get('registration_deadline'));
    if(!starts||!deadline){toast('Informe data e prazo de inscrição.','error');return;}
    const btn=form.querySelector('[type="submit"]');
    const data=await rpc('italo_admin_create_tournament',{
      tournament_name:String(fd.get('name')||'').trim(),
      description_text:String(fd.get('description')||'').trim(),
      starts_at_value:starts,
      registration_deadline_value:deadline,
      max_participants_value:Number(fd.get('max_participants')),
      platform_value:String(fd.get('platform')||'').trim(),
      format_value:String(fd.get('format')||'knockout'),
      type_value:'community',
      rules_text:String(fd.get('rules')||'').trim(),
      cover_url_value:String(fd.get('cover_url')||'').trim()||null,
      prize_value:String(fd.get('prize')||'').trim()||null
    },btn,'Torneio criado.');
    if(data){form.reset();form.elements.platform.value='Mobile';form.elements.max_participants.value='16';await loadTournaments();}
  }

  async function loadTournaments() {
    if(!ui.tournaments)return;
    ui.tournaments.innerHTML='<div class="launch-loading">Carregando torneios…</div>';
    const r=await client.from('italo_tournaments').select('*').order('created_at',{ascending:false}).limit(50);
    ui.tournaments.replaceChildren();
    if(r.error){ui.tournaments.innerHTML='<div class="launch-error">Não foi possível carregar os torneios.</div>';return;}
    if(!r.data?.length){ui.tournaments.innerHTML='<div class="launch-empty">Nenhum torneio cadastrado.</div>';return;}
    r.data.forEach(t=>ui.tournaments.append(tournamentAdminCard(t)));
  }

  function labeled(name,inputEl){const label=document.createElement('label');label.textContent=name;label.append(inputEl);return label;}
  function input(type,value,name){const el=document.createElement(type==='textarea'?'textarea':'input');if(type!=='textarea')el.type=type;el.name=name;el.value=value??'';return el;}
  function tournamentAdminCard(t) {
    const card=document.createElement('article');card.className='admin-tournament';
    const info=document.createElement('div');
    const h=document.createElement('strong');h.textContent=t.name;
    const s=document.createElement('small');s.textContent=`${t.status} • ${fmt(t.starts_at)} • ${t.platform}`;
    info.append(h,s);
    const actions=document.createElement('div');actions.className='admin-actions';
    const details=document.createElement('details');details.style.gridColumn='1/-1';
    const manageBox=document.createElement('div');manageBox.className='admin-tournament-manage';
    const edit=button('Editar','social-btn secondary',()=>details.open=!details.open);
    const manage=button('Participantes e chave','social-btn secondary',()=>{details.open=true;loadTournamentManage(t,manageBox);});
    const bracket=button('Gerar chave','social-btn secondary',async e=>{
      if(!confirm('Gerar o chaveamento deste torneio?'))return;
      const data=await rpc('italo_admin_generate_bracket',{tournament_id:t.id},e.currentTarget,'Chaveamento gerado.');
      if(data)loadTournamentManage(t,manageBox);
    });
    actions.append(edit,manage,bracket);
    card.append(info,actions);

    const summary=document.createElement('summary');summary.textContent='Configurações do torneio';
    const form=document.createElement('form');form.className='admin-form';
    const grid=document.createElement('div');grid.className='admin-form-grid';
    const name=input('text',t.name,'name');name.maxLength=120;
    const platform=input('text',t.platform,'platform');platform.maxLength=40;
    const starts=input('datetime-local',new Date(t.starts_at).toISOString().slice(0,16),'starts');
    const deadline=input('datetime-local',new Date(t.registration_deadline).toISOString().slice(0,16),'deadline');
    const max=input('number',t.max_participants,'max');max.min=2;max.max=128;
    const format=document.createElement('select');format.name='format';[['knockout','Mata-mata'],['groups_knockout','Grupos + mata-mata']].forEach(([v,l])=>{const o=document.createElement('option');o.value=v;o.textContent=l;o.selected=t.format===v;format.append(o);});
    const status=document.createElement('select');status.name='status';['open','scheduled','in_progress','finished','cancelled'].forEach(v=>{const o=document.createElement('option');o.value=v;o.textContent=v;o.selected=t.status===v;status.append(o);});
    grid.append(labeled('Nome',name),labeled('Plataforma',platform),labeled('Início',starts),labeled('Fim das inscrições',deadline),labeled('Limite',max),labeled('Formato',format),labeled('Status',status));
    const description=input('textarea',t.description,'description'),rules=input('textarea',t.rules,'rules'),cover=input('url',t.cover_url||'','cover'),prize=input('text',t.prize||'','prize');
    const save=button('Salvar alterações','social-btn primary',async e=>{
      const data=await rpc('italo_admin_update_tournament',{
        tournament_id:t.id,
        tournament_name:name.value.trim(),
        description_text:description.value.trim(),
        starts_at_value:iso(starts.value),
        registration_deadline_value:iso(deadline.value),
        max_participants_value:Number(max.value),
        platform_value:platform.value.trim(),
        format_value:format.value,
        type_value:t.tournament_type||'community',
        rules_text:rules.value.trim(),
        status_value:status.value,
        cover_url_value:cover.value.trim()||null,
        prize_value:prize.value.trim()||null
      },e.currentTarget,'Torneio atualizado.');
      if(data)loadTournaments();
    });
    form.append(grid,labeled('Descrição',description),labeled('Regras',rules),labeled('Capa (URL)',cover),labeled('Premiação',prize),save);
    details.append(summary,form,manageBox);card.append(details);
    return card;
  }

  async function loadTournamentManage(t,host) {
    host.innerHTML='<div class="launch-loading">Carregando participantes e partidas…</div>';
    const [participants,matches]=await Promise.all([
      client.from('italo_tournament_participants').select('tournament_id,user_id,status,joined_at,can_rejoin').eq('tournament_id',t.id).order('joined_at'),
      client.from('italo_tournament_matches').select('*').eq('tournament_id',t.id).order('round_no').order('match_no')
    ]);
    const ids=[...(participants.data||[]).map(x=>x.user_id),...(matches.data||[]).flatMap(x=>[x.participant1_id,x.participant2_id,x.winner_id])].filter(Boolean);
    let profiles=[];
    if(ids.length){const p=await client.from('italo_profiles').select('user_id,display_name,username').in('user_id',[...new Set(ids)]);profiles=p.data||[];}
    const map=new Map(profiles.map(x=>[x.user_id,x]));
    host.replaceChildren();
    const ph=document.createElement('h3');ph.textContent='Participantes';host.append(ph);
    const active=(participants.data||[]).filter(x=>x.status!=='removed');
    if(!active.length){const e=document.createElement('div');e.className='launch-empty';e.textContent='Nenhum participante.';host.append(e);}
    active.forEach(x=>{
      const row=document.createElement('div');row.className='admin-mod';
      const p=map.get(x.user_id);const name=document.createElement('strong');name.textContent=p?.display_name||'Jogador';
      const small=document.createElement('small');small.textContent=`@${p?.username||'jogador'} • ${x.status}`;
      const remove=button('Remover do torneio','social-btn danger',async e=>{
        const reason=prompt('Motivo opcional da remoção:','') ?? '';
        const data=await rpc('italo_admin_remove_participant',{tournament_id:t.id,target_user_id:x.user_id,reason_text:reason||null},e.currentTarget,'Participante removido.');
        if(data)loadTournamentManage(t,host);
      });
      row.append(name,small,remove);host.append(row);
    });
    const mh=document.createElement('h3');mh.textContent='Partidas';mh.style.marginTop='16px';host.append(mh);
    if(!matches.data?.length){const e=document.createElement('div');e.className='launch-empty';e.textContent='Chaveamento ainda não gerado.';host.append(e);return;}
    matches.data.forEach(m=>{
      const row=document.createElement('div');row.className='admin-mod';
      const title=document.createElement('strong');title.textContent=`Rodada ${m.round_no} • Partida ${m.match_no}`;
      const p1=map.get(m.participant1_id),p2=map.get(m.participant2_id);
      const desc=document.createElement('p');desc.textContent=`${p1?.display_name||'A definir'} × ${p2?.display_name||'A definir'}${m.winner_id?' • resultado salvo':''}`;
      row.append(title,desc);
      if(m.participant1_id&&m.participant2_id&&!m.winner_id){
        const box=document.createElement('div');box.className='admin-toolbar';
        const s1=input('number','','score1');s1.min=0;s1.placeholder='Placar 1';s1.setAttribute('aria-label','Placar do jogador 1');
        const s2=input('number','','score2');s2.min=0;s2.placeholder='Placar 2';s2.setAttribute('aria-label','Placar do jogador 2');
        const winner=document.createElement('select');winner.setAttribute('aria-label','Vencedor');
        [[m.participant1_id,p1?.display_name||'Jogador 1'],[m.participant2_id,p2?.display_name||'Jogador 2']].forEach(([id,label])=>{const o=document.createElement('option');o.value=id;o.textContent=label;winner.append(o);});
        const save=button('Salvar resultado','social-btn primary',async e=>{
          const a=Number(s1.value),b=Number(s2.value);
          if(!Number.isInteger(a)||a<0||!Number.isInteger(b)||b<0){toast('Informe placares válidos.','error');return;}
          const data=await rpc('italo_admin_record_result',{match_id:m.id,score1_value:a,score2_value:b,winner_user_id:winner.value},e.currentTarget,'Resultado registrado.');
          if(data)loadTournamentManage(t,host);
        });
        box.append(s1,s2,winner,save);row.append(box);
      }
      host.append(row);
    });
  }

  const auditLabels={
    account_access_changed:'Acesso da conta alterado',
    membership_changed:'Membro Exclusivo alterado',
    message_restriction_applied:'Restrição de mensagens aplicada',
    message_restriction_lifted:'Restrição de mensagens removida',
    message_deleted:'Mensagem excluída',
    post_deleted:'Publicação excluída',
    tournament_created:'Torneio criado',
    tournament_updated:'Torneio atualizado',
    tournament_participant_removed:'Participante removido',
    tournament_result_recorded:'Resultado registrado',
    ranking_changed:'Pontuação alterada'
  };
  async function loadAudit() {
    if(!ui.audit)return;
    ui.audit.innerHTML='<div class="launch-loading">Carregando histórico…</div>';
    const r=await client.from('italo_admin_audit').select('id,actor_user_id,target_user_id,action,details,created_at').order('created_at',{ascending:false}).limit(80);
    if(r.error){ui.audit.innerHTML='<div class="launch-error">Não foi possível carregar o histórico.</div>';return;}
    const ids=[...new Set((r.data||[]).flatMap(x=>[x.actor_user_id,x.target_user_id]).filter(Boolean))];
    let profiles=[];if(ids.length){const p=await client.from('italo_profiles').select('user_id,display_name,username').in('user_id',ids);profiles=p.data||[];}
    const map=new Map(profiles.map(x=>[x.user_id,x]));ui.audit.replaceChildren();
    if(!r.data?.length){ui.audit.innerHTML='<div class="launch-empty">Nenhuma ação registrada.</div>';return;}
    r.data.forEach(x=>{
      const item=document.createElement('article');item.className='admin-audit';
      const actor=map.get(x.actor_user_id),target=map.get(x.target_user_id);
      const h=document.createElement('strong');h.textContent=auditLabels[x.action]||'Ação administrativa';
      const p=document.createElement('p');p.textContent=`${actor?.display_name||'Sistema'}${target?` → ${target.display_name}`:''}`;
      const small=document.createElement('small');small.textContent=fmt(x.created_at);
      item.append(h,p,small);ui.audit.append(item);
    });
  }

  function activateTab(name) {
    $$('[data-admin-tab]').forEach(b=>b.classList.toggle('active',b.dataset.adminTab===name));
    $$('[data-admin-panel]').forEach(p=>p.hidden=p.dataset.adminPanel!==name);
    if(name==='moderation')loadModeration();
    if(name==='tournaments')loadTournaments();
    if(name==='audit')loadAudit();
  }

  function bind() {
    $$('[data-admin-tab]').forEach(b=>b.addEventListener('click',()=>activateTab(b.dataset.adminTab)));
    ui.searchBtn?.addEventListener('click',loadUsers);
    ui.search?.addEventListener('input',()=>{clearTimeout(userSearchTimer);userSearchTimer=setTimeout(loadUsers,350);});
    ui.search?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();clearTimeout(userSearchTimer);loadUsers();}});
    ui.filter?.addEventListener('change',loadUsers);
    ui.refreshModeration?.addEventListener('click',loadModeration);
    ui.tournamentForm?.addEventListener('submit',createTournament);
    ui.refreshAudit?.addEventListener('click',loadAudit);
  }

  async function init(s) {
    social=s;client=s.client;state=s.state;
    if(!state.session?.user){
      ui.denied.hidden=false;ui.denied.replaceChildren();
      const text=document.createElement('p');text.textContent='Entre com uma conta administrativa para continuar.';
      const login=button('Continuar com Google','social-btn primary',social.signIn);
      ui.denied.append(text,login);return;
    }
    if(!isAdmin()){
      ui.denied.hidden=false;ui.denied.textContent='Sem permissão. Esta área é exclusiva para administradores autorizados.';
      return;
    }
    ui.denied.hidden=true;ui.app.hidden=false;bind();
    await Promise.all([loadStats(),loadUsers()]);
    if(location.hash==='#torneios')activateTab('tournaments');
  }

  document.addEventListener('italo:social-ready',e=>init(e.detail),{once:true});
  if(window.ITALO_SOCIAL)init(window.ITALO_SOCIAL);
})();