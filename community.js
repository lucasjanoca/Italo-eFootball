(() => {
  const $=(s,r=document)=>r.querySelector(s);
  const ui={
    messages:$('[data-chat-messages]'),form:$('[data-chat-form]'),older:$('[data-load-older]'),
    restriction:$('[data-chat-restriction]'),chatStatus:$('[data-chat-status]'),
    postForm:$('[data-post-form]'),postCount:$('[data-post-count]'),postFeed:$('[data-post-feed]'),
    inviteForm:$('[data-invite-form]'),inviteList:$('[data-invite-list]'),
    ranking:$('[data-ranking-list]'),topics:$('[data-topic-list]'),createTopic:$('[data-create-topic]')
  };
  let social=null,client=null,session=null,oldest=null,hasOlder=false,loadingOlder=false,sending=false,channel=null;
  const PAGE_SIZE=30,messageIds=new Set(),profileCache=new Map();
  const toast=(m,k='info')=>social?.toast?.(m,k);
  const fmt=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(d)};
  const fmtDate=v=>{const d=new Date(v);return Number.isNaN(d.getTime())?'':new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(d)};
  function friendly(error,fallback='Não foi possível concluir esta ação.'){
    const msg=String(error?.message||error?.details||'');
    if(/5 segundos/i.test(msg))return 'Aguarde 5 segundos antes de publicar novamente.';
    if(/temporariamente impedido/i.test(msg))return msg.replace(/^.*?(Você está)/,'$1');
    if(/impedido de enviar/i.test(msg))return 'Você está impedido de enviar mensagens neste momento.';
    if(/permission|permiss|policy|rls/i.test(msg))return 'Você não possui permissão para realizar esta ação.';
    if(/duplicate|unique/i.test(msg))return 'Essa ação já foi registrada.';
    return fallback;
  }
  function setBusy(btn,busy,label){
    if(!btn)return;btn.disabled=busy;btn.setAttribute('aria-busy',String(busy));
    if(label&&!btn.dataset.normalLabel)btn.dataset.normalLabel=btn.textContent;
    if(label)btn.textContent=busy?label:(btn.dataset.normalLabel||btn.textContent);
  }
  function badgeFor(id){
    const p=profileCache.get(id);
    if(p?.role_badge==='owner'){const b=document.createElement('span');b.className='role-badge owner';b.textContent='OWNER';return b}
    if(p?.role_badge==='admin'){const b=document.createElement('span');b.className='role-badge admin';b.textContent='ADM';return b}
    if(p?.is_channel_member){const b=document.createElement('span');b.className='member-exclusive-badge';b.textContent='★ Membro Exclusivo';return b}
    return null;
  }
  async function hydrateUsers(ids){
    ids=[...new Set(ids.filter(Boolean).filter(id=>!profileCache.has(id)))];
    if(!ids.length)return;
    const r=await client.from('italo_profiles').select('user_id,display_name,username,avatar_url,role_badge,is_channel_member').in('user_id',ids);
    if(!r.error)(r.data||[]).forEach(x=>profileCache.set(x.user_id,x));
  }
  function userLink(id,fallback='Jogador'){
    const p=profileCache.get(id),a=document.createElement('a');a.className='chat-user-link';
    a.textContent=p?.display_name||fallback;a.href=p?.username?`perfil.html?u=${encodeURIComponent(p.username)}`:'perfil.html';return a;
  }
  function avatar(id,url){
    const p=profileCache.get(id),a=document.createElement('a');a.href=p?.username?`perfil.html?u=${encodeURIComponent(p.username)}`:'perfil.html';
    const img=document.createElement('img');img.className='chat-avatar';img.src=p?.avatar_url||url||'assets/avatar.jpg';img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>img.src='assets/avatar.jpg';a.append(img);return a;
  }
  const canModerate=()=>['admin','owner'].includes(social?.state?.access?.role)&&social?.state?.access?.account_status==='active';

  function makeMessage(row,{pending=false}={}){
    const el=document.createElement('article');el.className='chat-message'+(pending?' is-pending':'');
    if(row.id!=null)el.dataset.messageId=String(row.id);
    if(pending)el.dataset.pendingSelf='true';
    el.append(avatar(row.user_id,row.avatar_url));
    const main=document.createElement('div');main.className='chat-message-main';
    const meta=document.createElement('div');meta.className='chat-message-meta';meta.append(userLink(row.user_id,row.display_name));
    const badge=badgeFor(row.user_id);if(badge)meta.append(badge);
    const time=document.createElement('time');time.className='chat-time';time.textContent=pending?'enviando…':fmt(row.created_at);meta.append(time);
    if(canModerate()&&!pending){
      const del=document.createElement('button');del.type='button';del.className='social-btn danger chat-delete';del.textContent='Excluir';
      del.addEventListener('click',()=>moderateDeleteMessage(row.id,el));meta.append(del);
    }
    const body=document.createElement('span');body.className='chat-message-text';body.textContent=row.body||'';
    main.append(meta,body);el.append(main);return el;
  }
  async function renderMessages(rows,{prepend=false}={}){
    await hydrateUsers(rows.map(x=>x.user_id));
    const frag=document.createDocumentFragment();
    rows.forEach(row=>{const id=String(row.id);if(messageIds.has(id))return;messageIds.add(id);frag.append(makeMessage(row));});
    if(prepend)ui.messages.prepend(frag);else ui.messages.append(frag);
  }
  async function loadMessages(reset=true){
    if(!session?.user)return signedOutChat();
    if(reset){ui.messages.innerHTML='<div class="community-skeleton"></div><div class="community-skeleton"></div><div class="community-skeleton"></div>';messageIds.clear();oldest=null;}
    let q=client.from('italo_messages').select('id,user_id,display_name,avatar_url,body,created_at,expires_at').order('created_at',{ascending:false}).limit(PAGE_SIZE+1);
    if(!reset&&oldest)q=q.lt('created_at',oldest);
    const r=await q;
    if(r.error){if(reset)ui.messages.innerHTML='<div class="community-state">Não foi possível carregar as mensagens.</div>';return;}
    const data=r.data||[],page=data.slice(0,PAGE_SIZE).reverse();hasOlder=data.length>PAGE_SIZE;
    if(reset)ui.messages.replaceChildren();
    await renderMessages(page,{prepend:!reset});
    if(page.length)oldest=page[0].created_at;
    if(ui.older)ui.older.hidden=!hasOlder;
    if(reset)requestAnimationFrame(()=>ui.messages.scrollTop=ui.messages.scrollHeight);
  }
  function signedOutChat(){
    if(ui.messages)ui.messages.innerHTML='<div class="community-state">Entre com sua conta para participar da conversa.</div>';
    if(ui.older)ui.older.hidden=true;
    const text=ui.form?.querySelector('textarea'),btn=ui.form?.querySelector('button[type="submit"]');if(text)text.disabled=true;if(btn)btn.disabled=true;
  }
  async function loadOlder(){
    if(loadingOlder||!hasOlder)return;loadingOlder=true;ui.older.disabled=true;
    const before=ui.messages.scrollHeight;await loadMessages(false);
    requestAnimationFrame(()=>{ui.messages.scrollTop=Math.max(0,ui.messages.scrollHeight-before)});ui.older.disabled=false;loadingOlder=false;
  }
  async function checkRestriction(){
    if(!session?.user)return;
    const r=await client.rpc('italo_my_communication_status');
    const text=ui.form?.querySelector('textarea'),btn=ui.form?.querySelector('button[type="submit"]');
    if(r.error){if(text)text.disabled=false;if(btn)btn.disabled=sending;return}
    const blocked=!!r.data?.blocked;
    if(blocked){
      const expiry=r.data.permanent?'por tempo indeterminado':`até ${fmtDate(r.data.expires_at)}`;
      ui.restriction.textContent=`Você está temporariamente impedido de enviar mensagens ${expiry}.`;ui.restriction.hidden=false;
      if(text)text.disabled=true;if(btn)btn.disabled=true;
    }else{
      ui.restriction.hidden=true;if(text)text.disabled=false;if(btn)btn.disabled=sending;
    }
  }
  async function sendMessage(e){
    e.preventDefault();if(sending)return;
    if(!session?.user){toast('Entre com sua conta para conversar.','error');return}
    const ta=ui.form.querySelector('textarea'),btn=ui.form.querySelector('button[type="submit"]'),body=ta.value.trim();if(!body)return;
    sending=true;setBusy(btn,true,'Enviando…');
    const p=social.state.profile;await hydrateUsers([session.user.id]);
    const optimistic={id:`temp-${Date.now()}`,user_id:session.user.id,display_name:p?.display_name,avatar_url:p?.avatar_url,body,created_at:new Date().toISOString()};
    const pending=makeMessage(optimistic,{pending:true});ui.messages.append(pending);ui.messages.scrollTop=ui.messages.scrollHeight;ta.value='';
    const r=await client.from('italo_messages').insert({user_id:session.user.id,display_name:p?.display_name||'Jogador',avatar_url:p?.avatar_url,body}).select('id,user_id,display_name,avatar_url,body,created_at,expires_at').single();
    sending=false;setBusy(btn,false,'Enviando…');
    if(r.error){if(pending.isConnected)pending.remove();if(!ta.value)ta.value=body;toast(friendly(r.error,'Não foi possível enviar a mensagem.'),'error');await checkRestriction();return}
    const id=String(r.data.id);
    if(messageIds.has(id)){if(pending.isConnected)pending.remove();}
    else{messageIds.add(id);pending.replaceWith(makeMessage(r.data));}
    await checkRestriction();
  }
  async function moderateDeleteMessage(id,el){
    if(!confirm('Excluir esta mensagem da comunidade?'))return;
    const r=await client.rpc('italo_admin_delete_message',{message_id:id,reason_text:null});
    if(r.error){toast(friendly(r.error),'error');return}messageIds.delete(String(id));el.remove();toast('Mensagem removida.','success');
  }

  async function loadPosts(){
    if(!session?.user){ui.postFeed.innerHTML='<div class="community-state">Entre para ver e publicar na Resenha.</div>';return}
    const posts=await client.from('italo_resenha_posts').select('id,user_id,display_name,avatar_url,body,created_at,expires_at').order('created_at',{ascending:false}).limit(20);
    if(posts.error){ui.postFeed.innerHTML='<div class="community-state">Não foi possível carregar a Resenha.</div>';return}
    const rows=posts.data||[];await hydrateUsers(rows.map(x=>x.user_id));const ids=rows.map(x=>x.id);
    const [likes,comments]=ids.length?await Promise.all([
      client.from('italo_resenha_likes').select('post_id,user_id').in('post_id',ids),
      client.from('italo_resenha_comments').select('id,post_id,user_id,display_name,avatar_url,body,created_at').in('post_id',ids).order('created_at',{ascending:true}).limit(200)
    ]):[{data:[]},{data:[]}];
    await hydrateUsers((comments.data||[]).map(x=>x.user_id));ui.postFeed.replaceChildren();
    if(!rows.length){ui.postFeed.innerHTML='<div class="community-state">A Resenha está aberta. Publique a primeira conversa.</div>';return}
    rows.forEach(post=>ui.postFeed.append(makePost(post,(likes.data||[]).filter(x=>x.post_id===post.id),(comments.data||[]).filter(x=>x.post_id===post.id))));
  }
  function makePost(post,likes,comments){
    const el=document.createElement('article');el.className='community-post';
    const head=document.createElement('div');head.className='post-head';const av=avatar(post.user_id,post.avatar_url);av.firstChild.className='chat-avatar';head.append(av);
    const hm=document.createElement('div');hm.className='post-head-main';hm.append(userLink(post.user_id,post.display_name));const badge=badgeFor(post.user_id);if(badge)hm.append(badge);
    const time=document.createElement('small');time.textContent=fmtDate(post.created_at);hm.append(time);head.append(hm);
    if(canModerate()){const del=document.createElement('button');del.className='social-btn danger chat-delete';del.type='button';del.textContent='Excluir';del.addEventListener('click',()=>moderateDeletePost(post.id,el));head.append(del)}
    const body=document.createElement('p');body.className='post-body';body.textContent=post.body;
    const toolbar=document.createElement('div');toolbar.className='post-toolbar';const mine=likes.some(x=>x.user_id===session.user.id);
    const like=document.createElement('button');like.type='button';like.className='social-btn secondary';like.textContent=`${mine?'♥':'♡'} ${likes.length}`;
    like.addEventListener('click',async()=>{like.disabled=true;const r=mine?await client.from('italo_resenha_likes').delete().eq('post_id',post.id).eq('user_id',session.user.id):await client.from('italo_resenha_likes').insert({post_id:post.id,user_id:session.user.id});if(r.error){like.disabled=false;toast(friendly(r.error),'error')}else loadPosts()});
    const count=document.createElement('span');count.className='community-note';count.textContent=`${comments.length} comentário${comments.length===1?'':'s'}`;toolbar.append(like,count);
    const commentsBox=document.createElement('div');commentsBox.className='post-comments';
    comments.forEach(c=>{const row=document.createElement('div');row.className='comment-row';row.append(avatar(c.user_id,c.avatar_url).firstChild);const x=document.createElement('div');x.append(userLink(c.user_id,c.display_name));const p=document.createElement('p');p.textContent=c.body;x.append(p);row.append(x);commentsBox.append(row)});
    const form=document.createElement('form');form.className='comment-form';const input=document.createElement('input');input.maxLength=350;input.placeholder='Comentar…';input.required=true;
    const send=document.createElement('button');send.className='social-btn secondary';send.type='submit';send.textContent='Enviar';form.append(input,send);
    form.addEventListener('submit',async e=>{e.preventDefault();const text=input.value.trim();if(!text||send.disabled)return;send.disabled=true;const p=social.state.profile;const r=await client.from('italo_resenha_comments').insert({post_id:post.id,user_id:session.user.id,display_name:p.display_name,avatar_url:p.avatar_url,body:text});send.disabled=false;if(r.error){toast(friendly(r.error,'Não foi possível comentar.'),'error');await checkRestriction();return}input.value='';loadPosts()});
    el.append(head,body,toolbar,commentsBox,form);return el;
  }
  async function publishPost(e){
    e.preventDefault();if(!session?.user){toast('Entre com sua conta para publicar.','error');return}
    const ta=ui.postForm.querySelector('textarea'),btn=ui.postForm.querySelector('button[type="submit"]'),body=ta.value.trim();if(!body||btn.disabled)return;
    setBusy(btn,true,'Publicando…');const p=social.state.profile;const r=await client.from('italo_resenha_posts').insert({user_id:session.user.id,display_name:p.display_name,avatar_url:p.avatar_url,body});setBusy(btn,false,'Publicando…');
    if(r.error){toast(friendly(r.error,'Não foi possível publicar.'),'error');await checkRestriction();return}
    ta.value='';if(ui.postCount)ui.postCount.textContent='0';toast('Publicado com sucesso.','success');loadPosts();
  }
  async function moderateDeletePost(id,el){if(!confirm('Excluir esta publicação?'))return;const r=await client.rpc('italo_admin_delete_post',{post_id:id,reason_text:null});if(r.error)toast(friendly(r.error),'error');else{el.remove();toast('Publicação removida.','success')}}

  async function loadInvites(){
    if(!session?.user){ui.inviteList.innerHTML='<div class="community-state">Entre para ver convites.</div>';return}
    const r=await client.from('italo_game_invites').select('id,user_id,display_name,nickname,platform,available_at,game_mode,note,status,created_at').eq('status','open').gte('available_at',new Date(Date.now()-30*60*1000).toISOString()).order('available_at').limit(12);
    if(r.error){ui.inviteList.innerHTML='<div class="community-state">Não foi possível carregar convites.</div>';return}
    await hydrateUsers((r.data||[]).map(x=>x.user_id));ui.inviteList.replaceChildren();
    if(!r.data?.length){ui.inviteList.innerHTML='<div class="community-state">Nenhum convite aberto agora.</div>';return}
    r.data.forEach(v=>{const row=document.createElement('article');row.className='invite-row';const top=document.createElement('div');top.className='chat-message-meta';top.append(userLink(v.user_id,v.display_name));const badge=badgeFor(v.user_id);if(badge)top.append(badge);const n=document.createElement('strong');n.textContent=v.nickname;const meta=document.createElement('div');meta.className='invite-meta';[v.platform,v.game_mode,fmtDate(v.available_at)].forEach(x=>{const s=document.createElement('span');s.textContent=x;meta.append(s)});row.append(top,n,meta);if(v.note){const note=document.createElement('small');note.textContent=v.note;row.append(note)}ui.inviteList.append(row)});
  }
  async function publishInvite(e){
    e.preventDefault();if(!session?.user){toast('Entre para criar um convite.','error');return}
    const btn=ui.inviteForm.querySelector('button[type="submit"]'),f=new FormData(ui.inviteForm),available=f.get('available_at');if(!available||btn.disabled)return;
    setBusy(btn,true,'Publicando…');const p=social.state.profile;const r=await client.from('italo_game_invites').insert({user_id:session.user.id,display_name:p.display_name,avatar_url:p.avatar_url,nickname:String(f.get('nickname')||'').trim(),platform:f.get('platform'),game_mode:f.get('game_mode'),available_at:new Date(available).toISOString(),note:String(f.get('note')||'').trim()||null});setBusy(btn,false,'Publicando…');
    if(r.error){toast(friendly(r.error,'Não foi possível publicar o convite.'),'error');return}ui.inviteForm.reset();toast('Convite publicado.','success');loadInvites();
  }

  async function loadRanking(){
    if(!session?.user){ui.ranking.innerHTML='<div class="community-state">Entre para visualizar o ranking.</div>';return}
    const r=await client.from('italo_ranking').select('user_id,points,updated_at').order('points',{ascending:false}).order('updated_at').limit(20);
    if(r.error){ui.ranking.innerHTML='<div class="community-state">Não foi possível carregar o ranking.</div>';return}
    await hydrateUsers((r.data||[]).map(x=>x.user_id));ui.ranking.replaceChildren();
    if(!r.data?.length){ui.ranking.innerHTML='<div class="community-state">O ranking ainda não possui pontuações.</div>';return}
    r.data.forEach((x,i)=>{const p=profileCache.get(x.user_id),row=document.createElement('article');row.className='ranking-row';const pos=document.createElement('span');pos.className='ranking-pos';pos.textContent=`${i+1}º`;const img=document.createElement('img');img.src=p?.avatar_url||'assets/avatar.jpg';img.alt='';img.loading='lazy';const name=document.createElement('div');name.className='ranking-name';name.append(userLink(x.user_id,p?.display_name||'Jogador'));const badge=badgeFor(x.user_id);if(badge)name.append(badge);const u=document.createElement('small');u.textContent=p?.username?'@'+p.username:'';name.append(u);const pts=document.createElement('span');pts.className='ranking-points';pts.textContent=`${x.points} pts`;row.append(pos,img,name,pts);ui.ranking.append(row)});
  }

  async function loadTopics(){
    if(!session?.user){ui.topics.innerHTML='<div class="community-state">Entre na sua conta para acessar os tópicos.</div>';return}
    const [t,m]=await Promise.all([client.from('italo_topics').select('id,user_id,display_name,title,category,is_open,created_at').eq('is_open',true).order('created_at',{ascending:false}).limit(20),client.from('italo_topic_members').select('topic_id,user_id').eq('user_id',session.user.id).limit(100)]);
    if(t.error){ui.topics.innerHTML='<div class="community-state">Não foi possível carregar os tópicos.</div>';return}
    const joined=new Set((m.data||[]).map(x=>String(x.topic_id)));ui.topics.replaceChildren();
    if(!t.data?.length){ui.topics.innerHTML='<div class="community-state">Nenhum tópico aberto. Crie o primeiro.</div>';return}
    t.data.forEach(x=>{const row=document.createElement('article');row.className='topic-row';const copy=document.createElement('div'),title=document.createElement('strong'),sub=document.createElement('small');title.textContent=x.title;sub.textContent=x.category;copy.append(title,sub);const btn=document.createElement('button');btn.className='social-btn secondary';btn.type='button';btn.textContent=joined.has(String(x.id))?'Sair':'Entrar';btn.addEventListener('click',async()=>{btn.disabled=true;const r=joined.has(String(x.id))?await client.from('italo_topic_members').delete().eq('topic_id',x.id).eq('user_id',session.user.id):await client.from('italo_topic_members').insert({topic_id:x.id,user_id:session.user.id});if(r.error){btn.disabled=false;toast(friendly(r.error),'error')}else loadTopics()});row.append(copy,btn);ui.topics.append(row)});
  }
  async function createTopic(){
    if(!session?.user){toast('Entre para criar um tópico.','error');return}
    const title=prompt('Nome do tópico:')?.trim();if(!title)return;if(title.length<3||title.length>100){toast('Use entre 3 e 100 caracteres.','error');return}
    const p=social.state.profile,r=await client.from('italo_topics').insert({user_id:session.user.id,display_name:p.display_name,title,category:'Comunidade',is_open:true}).select('id').single();
    if(r.error){toast(friendly(r.error,'Não foi possível criar o tópico.'),'error');return}
    await client.from('italo_topic_members').insert({topic_id:r.data.id,user_id:session.user.id});toast('Tópico criado.','success');loadTopics();
  }

  let postRefreshTimer=0;
  function startRealtime(){
    if(channel)client.removeChannel(channel);if(!session?.user)return;
    channel=client.channel(`italo-community-${session.user.id}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'italo_messages'},async payload=>{
        const row=payload.new,id=String(row?.id||'');if(!id||messageIds.has(id))return;await hydrateUsers([row.user_id]);messageIds.add(id);
        const pending=row.user_id===session.user.id?ui.messages.querySelector('.chat-message.is-pending[data-pending-self="true"]'):null;
        if(pending)pending.replaceWith(makeMessage(row));else ui.messages.append(makeMessage(row));ui.messages.scrollTop=ui.messages.scrollHeight;
      })
      .on('postgres_changes',{event:'DELETE',schema:'public',table:'italo_messages'},payload=>{const id=String(payload.old?.id||'');if(id){messageIds.delete(id);ui.messages.querySelector(`[data-message-id="${CSS.escape(id)}"]`)?.remove()}})
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_message_restrictions',filter:`user_id=eq.${session.user.id}`},checkRestriction)
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_ranking'},loadRanking)
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_resenha_posts'},()=>{clearTimeout(postRefreshTimer);postRefreshTimer=setTimeout(loadPosts,250)})
      .subscribe(status=>{if(ui.chatStatus)ui.chatStatus.textContent=status==='SUBSCRIBED'?'Online':'Conectando…'});
  }
  async function boot(){
    session=social.state.session;client=social.client;
    if(!session?.user){signedOutChat();await Promise.all([loadPosts(),loadInvites(),loadRanking(),loadTopics()]);return}
    await hydrateUsers([session.user.id]);
    loadMessages(true);checkRestriction();loadPosts();loadInvites();loadRanking();loadTopics();startRealtime();
  }
  function bind(){
    ui.older?.addEventListener('click',loadOlder);ui.form?.addEventListener('submit',sendMessage);ui.postForm?.addEventListener('submit',publishPost);
    ui.postForm?.querySelector('textarea')?.addEventListener('input',e=>{if(ui.postCount)ui.postCount.textContent=String(e.target.value.length)});
    ui.inviteForm?.addEventListener('submit',publishInvite);ui.createTopic?.addEventListener('click',createTopic);
  }
  function init(s){social=s;bind();boot()}
  document.addEventListener('italo:social-ready',e=>init(e.detail),{once:true});
  if(window.ITALO_SOCIAL)init(window.ITALO_SOCIAL);
})();