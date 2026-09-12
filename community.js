(() => {
  const authWrap = document.querySelector('[data-auth-wrap]');
  if (!authWrap) return;

  const SUPABASE_URL = 'https://yncspxfsvlqdnodlsosb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_jALAHHuvrV5oxj2mugWTCQ_stD_vFyN';
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession:true, autoRefreshToken:true, detectSessionInUrl:true, storageKey:'italo-community-auth' }
  });

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const ui = {
    googleBtn: $('[data-google-login]'), authClose: $('[data-auth-close]'), authMsg: $('[data-auth-msg]'),
    userChip: $('[data-user-chip]'), userAvatar: $('[data-user-avatar]'), userName: $('[data-user-name]'), logout: $('[data-user-logout]'),
    status: $('[data-community-status] span'), toast: $('[data-community-toast]'),
    messages: $('.c-messages'), chatInput: $('.c-input input[type="text"]'), chatSend: $('[data-chat-send]'), emoji: $('[data-chat-emoji]'),
    openInvite: $('[data-open-invite]'), inviteModal: $('[data-invite-modal]'), inviteForm: $('[data-invite-form]'),
    inviteSubmit: $('[data-invite-submit]'), inviteFormMsg: $('[data-invite-form-message]'), inviteGrid: $('[data-invite-grid]'), inviteStatus: $('[data-invite-status]'),
    postForm: $('[data-post-form]'), postTextarea: $('#resenha-post'), postSubmit: $('[data-post-submit]'), postCount: $('[data-post-count]'),
    resenhaFeed: $('[data-resenha-feed]'), resenhaStatus: $('[data-resenha-status]')
  };

  let session = null;
  let realtimeChannel = null;
  let inviteReloadTimer = 0;
  let resenhaReloadTimer = 0;
  const renderedMessageIds = new Set();
  const postLikeState = new Map();

  const dataApi = {
    messages: {
      list: () => client.from('italo_messages').select('id,user_id,display_name,avatar_url,body,created_at').order('created_at',{ascending:false}).limit(80),
      create: payload => client.from('italo_messages').insert(payload).select('id,user_id,display_name,avatar_url,body,created_at').single()
    },
    invites: {
      list: () => client.from('italo_game_invites').select('id,user_id,display_name,avatar_url,nickname,platform,available_at,game_mode,note,status,created_at').eq('status','open').gte('available_at',new Date(Date.now()-30*60*1000).toISOString()).order('available_at',{ascending:true}).limit(30),
      create: payload => client.from('italo_game_invites').insert(payload).select('id').single(),
      close: id => client.from('italo_game_invites').update({status:'closed',closed_at:new Date().toISOString()}).eq('id',id).eq('user_id',session.user.id).select('id').single()
    },
    resenha: {
      posts: () => client.from('italo_resenha_posts').select('id,user_id,display_name,avatar_url,body,created_at,updated_at').order('created_at',{ascending:false}).limit(20),
      createPost: payload => client.from('italo_resenha_posts').insert(payload).select('id').single(),
      deletePost: id => client.from('italo_resenha_posts').delete().eq('id',id).eq('user_id',session.user.id),
      likes: ids => client.from('italo_resenha_likes').select('post_id,user_id').in('post_id',ids),
      comments: ids => client.from('italo_resenha_comments').select('id,post_id,user_id,display_name,avatar_url,body,created_at').in('post_id',ids).order('created_at',{ascending:true}).limit(240),
      addLike: postId => client.from('italo_resenha_likes').insert({post_id:postId,user_id:session.user.id}),
      removeLike: postId => client.from('italo_resenha_likes').delete().eq('post_id',postId).eq('user_id',session.user.id),
      addComment: payload => client.from('italo_resenha_comments').insert(payload).select('id').single(),
      deleteComment: id => client.from('italo_resenha_comments').delete().eq('id',id).eq('user_id',session.user.id)
    }
  };

  function showToast(text) {
    if (!ui.toast) return;
    ui.toast.textContent = text;
    ui.toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => ui.toast.classList.remove('show'), 3200);
  }

  function setAuthMessage(text = '') { if (ui.authMsg) ui.authMsg.textContent = text; }
  function setState(el, text, kind = '') {
    if (!el) return;
    el.textContent = text;
    el.dataset.state = kind;
    el.hidden = !text;
  }
  function setButtonLoading(button, loading, normalText, loadingText = 'Carregando…') {
    if (!button) return;
    button.disabled = loading;
    button.textContent = loading ? loadingText : normalText;
    button.setAttribute('aria-busy', String(loading));
  }

  function openAuth() {
    if (session?.user) return;
    authWrap.classList.add('open');
    authWrap.setAttribute('aria-hidden','false');
    requestAnimationFrame(() => ui.googleBtn?.focus());
  }
  function closeAuth() {
    authWrap.classList.remove('open');
    authWrap.setAttribute('aria-hidden','true');
    setAuthMessage('');
  }

  function profileFromSession() {
    const user = session?.user;
    const meta = user?.user_metadata || {};
    const rawName = meta.full_name || meta.name || user?.email?.split('@')[0] || 'Jogador';
    return {
      userId:user?.id || null,
      name:String(rawName).trim().replace(/\s+/g,' ').slice(0,60) || 'Jogador',
      avatar:meta.avatar_url || meta.picture || 'assets/avatar.jpg'
    };
  }

  async function ensureProfile() {
    if (!client || !session?.user) return;
    const p = profileFromSession();
    const { error } = await client.from('italo_profiles').upsert({user_id:p.userId,display_name:p.name,avatar_url:p.avatar,updated_at:new Date().toISOString()},{onConflict:'user_id'});
    if (error) console.error('Falha ao sincronizar perfil:', error);
  }

  function setSignedUi(signed) {
    ui.userChip?.classList.toggle('show',signed);
    $$('.c-locked').forEach(el => el.classList.toggle('unlocked',signed));
    document.body.classList.toggle('community-authenticated',signed);
    if (ui.chatInput) ui.chatInput.disabled = !signed;
    if (ui.chatSend) ui.chatSend.disabled = !signed;
    if (ui.emoji) ui.emoji.disabled = !signed;
    if (ui.postTextarea) ui.postTextarea.disabled = !signed;
    if (ui.postSubmit) ui.postSubmit.disabled = !signed;
  }

  async function applySession(nextSession) {
    session = nextSession || null;
    const signed = !!session?.user;
    setSignedUi(signed);
    if (!signed) {
      if (ui.status) ui.status.textContent = 'Entre para carregar os dados reais da comunidade.';
      stopRealtime();
      renderEmptyChat('Entre com o Google para carregar as mensagens reais.');
      resetInvitesSignedOut();
      resetResenhaSignedOut();
      return;
    }
    const p = profileFromSession();
    if (ui.userName) ui.userName.textContent = p.name;
    if (ui.userAvatar) {
      ui.userAvatar.src = p.avatar;
      ui.userAvatar.onerror = () => { ui.userAvatar.src = 'assets/avatar.jpg'; };
    }
    if (ui.status) ui.status.textContent = `Conectado como ${p.name}. Chat, convites e Resenha usam dados reais.`;
    await ensureProfile();
    await Promise.allSettled([loadMessages(), loadInvites(), loadResenha()]);
    startRealtime();
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR',{dateStyle:'short',timeStyle:'short'}).format(date);
  }
  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(date);
  }

  function renderEmptyChat(text) {
    if (!ui.messages) return;
    ui.messages.replaceChildren();
    renderedMessageIds.clear();
    const row = document.createElement('div'); row.className='c-msg'; row.dataset.chatEmpty='true';
    const img=document.createElement('img'); img.src='assets/avatar.jpg'; img.alt='';
    const name=document.createElement('strong'); name.textContent='Ítalo Football';
    const time=document.createElement('time'); time.textContent='agora';
    const body=document.createElement('span'); body.textContent=text;
    row.append(img,name,time,body); ui.messages.append(row);
  }
  function makeMessage(row) {
    const el=document.createElement('div'); el.className='c-msg'; el.dataset.messageId=String(row.id);
    const img=document.createElement('img'); img.src=row.avatar_url||'assets/avatar.jpg'; img.alt=''; img.loading='lazy'; img.onerror=()=>{img.src='assets/avatar.jpg';};
    const name=document.createElement('strong'); name.textContent=row.display_name||'Jogador';
    const time=document.createElement('time'); time.dateTime=row.created_at||''; time.textContent=formatTime(row.created_at);
    const body=document.createElement('span'); body.textContent=row.body||'';
    el.append(img,name,time,body); return el;
  }
  function appendMessage(row) {
    if (!ui.messages || row?.id == null) return;
    const id=String(row.id); if (renderedMessageIds.has(id)) return;
    renderedMessageIds.add(id); ui.messages.querySelector('[data-chat-empty]')?.remove(); ui.messages.append(makeMessage(row));
    while (ui.messages.children.length>80) { const first=ui.messages.firstElementChild; if(first?.dataset.messageId) renderedMessageIds.delete(first.dataset.messageId); first?.remove(); }
    ui.messages.scrollTop=ui.messages.scrollHeight;
  }
  async function loadMessages() {
    if (!session?.user || !client || !ui.messages) return;
    renderEmptyChat('Carregando mensagens…');
    const {data,error}=await dataApi.messages.list();
    if (error) { console.error('Falha ao carregar chat:',error); renderEmptyChat('Não foi possível carregar o chat. Tente novamente.'); return; }
    ui.messages.replaceChildren(); renderedMessageIds.clear();
    if (!data?.length) { renderEmptyChat('O chat está aberto. Seja o primeiro a mandar uma mensagem! ⚽'); return; }
    [...data].reverse().forEach(appendMessage);
  }
  async function sendMessage() {
    if (!session?.user) { openAuth(); return; }
    const body=ui.chatInput?.value.trim()||'';
    if (!body) { showToast('Digite uma mensagem antes de enviar.'); return; }
    if (body.length>500) { showToast('A mensagem pode ter no máximo 500 caracteres.'); return; }
    const p=profileFromSession(); setButtonLoading(ui.chatSend,true,'➤','…');
    const {data,error}=await dataApi.messages.create({user_id:p.userId,display_name:p.name,avatar_url:p.avatar,body});
    setButtonLoading(ui.chatSend,false,'➤');
    if (error) { console.error('Falha ao enviar mensagem:',error); showToast('Não foi possível enviar a mensagem.'); return; }
    ui.chatInput.value=''; appendMessage(data); ui.chatInput.focus();
  }

  function resetInvitesSignedOut() {
    setState(ui.inviteStatus,'Entre com o Google para carregar os convites reais.','locked');
    ui.inviteGrid?.replaceChildren();
  }
  function inviteCopyText(invite) {
    const when=formatDateTime(invite.available_at);
    const note=invite.note ? ` Observação: ${invite.note}` : '';
    return `${invite.nickname} está procurando alguém para jogar eFootball no ${invite.platform}, modo ${invite.game_mode}, em ${when}.${note}`;
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
      else {
        const ta=document.createElement('textarea'); ta.value=text; ta.style.position='fixed'; ta.style.opacity='0'; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
      }
      showToast('Convite copiado!');
    } catch { showToast('Não foi possível copiar automaticamente.'); }
  }
  function renderInvites(rows) {
    if (!ui.inviteGrid) return;
    ui.inviteGrid.replaceChildren();
    if (!rows?.length) { setState(ui.inviteStatus,'Ainda não existem convites disponíveis. Crie o primeiro.','empty'); return; }
    setState(ui.inviteStatus,`${rows.length} ${rows.length===1?'convite disponível':'convites disponíveis'}.`,'success');
    const me=session.user.id;
    rows.forEach(invite => {
      const card=document.createElement('article'); card.className='c-invite-card';
      const head=document.createElement('div'); head.className='c-invite-head';
      const avatar=document.createElement('img'); avatar.src=invite.avatar_url||'assets/avatar.jpg'; avatar.alt=''; avatar.loading='lazy'; avatar.onerror=()=>{avatar.src='assets/avatar.jpg';};
      const identity=document.createElement('div'); const nickname=document.createElement('strong'); nickname.textContent=invite.nickname; const author=document.createElement('small'); author.textContent=`por ${invite.display_name||'Jogador'}`; identity.append(nickname,author); head.append(avatar,identity);
      const meta=document.createElement('div'); meta.className='c-invite-meta';
      [['🎮',invite.platform],['⚽',invite.game_mode],['🕒',formatDateTime(invite.available_at)]].forEach(([ico,text])=>{const span=document.createElement('span'); span.textContent=`${ico} ${text}`; meta.append(span);});
      card.append(head,meta);
      if (invite.note) { const note=document.createElement('p'); note.textContent=invite.note; card.append(note); }
      const actions=document.createElement('div'); actions.className='c-card-actions';
      const copy=document.createElement('button'); copy.type='button'; copy.className='c-secondary-action'; copy.textContent='Copiar convite'; copy.addEventListener('click',()=>copyText(inviteCopyText(invite))); actions.append(copy);
      const chat=document.createElement('button'); chat.type='button'; chat.className='c-secondary-action'; chat.textContent='Ir para o chat'; chat.addEventListener('click',()=>$('#chat')?.scrollIntoView({behavior:reducedMotion?'auto':'smooth'})); actions.append(chat);
      if (invite.user_id===me) { const close=document.createElement('button'); close.type='button'; close.className='c-danger-action'; close.textContent='Encerrar'; close.addEventListener('click',()=>closeInvite(invite.id,close)); actions.append(close); }
      card.append(actions); ui.inviteGrid.append(card);
    });
  }
  async function loadInvites() {
    if (!session?.user || !client) return;
    setState(ui.inviteStatus,'Carregando convites…','loading');
    const {data,error}=await dataApi.invites.list();
    if (error) { console.error('Falha ao carregar convites:',error); setState(ui.inviteStatus,'Não foi possível carregar os convites. Atualize ou tente novamente.','error'); return; }
    renderInvites(data||[]);
  }
  function toLocalInputValue(date) {
    const pad=n=>String(n).padStart(2,'0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }
  function openInviteModal() {
    if (!session?.user) { openAuth(); return; }
    if (!ui.inviteModal || !ui.inviteForm) return;
    const input=ui.inviteForm.elements.available_at;
    const min=new Date(Date.now()-5*60*1000), suggested=new Date(Date.now()+30*60*1000), max=new Date(Date.now()+60*24*60*60*1000);
    input.min=toLocalInputValue(min); input.max=toLocalInputValue(max); if (!input.value) input.value=toLocalInputValue(suggested);
    const nick=ui.inviteForm.elements.nickname; if (!nick.value) nick.value=profileFromSession().name.slice(0,40);
    setState(ui.inviteFormMsg,'',''); ui.inviteModal.classList.add('open'); ui.inviteModal.setAttribute('aria-hidden','false'); requestAnimationFrame(()=>nick.focus());
  }
  function closeInviteModal() { ui.inviteModal?.classList.remove('open'); ui.inviteModal?.setAttribute('aria-hidden','true'); setState(ui.inviteFormMsg,'',''); }
  function validateInvite(form) {
    const nickname=form.elements.nickname.value.trim().replace(/\s+/g,' ');
    const platform=form.elements.platform.value;
    const gameMode=form.elements.game_mode.value;
    const note=form.elements.note.value.trim();
    const date=new Date(form.elements.available_at.value);
    const allowedPlatforms=['PS5','PS4','Xbox','PC','Mobile','Outro'];
    if (nickname.length<2 || nickname.length>40) return {error:'Informe um nickname entre 2 e 40 caracteres.'};
    if (!allowedPlatforms.includes(platform)) return {error:'Selecione uma plataforma válida.'};
    if (!gameMode || gameMode.length>40) return {error:'Selecione um modo de jogo.'};
    if (Number.isNaN(date.getTime())) return {error:'Informe um horário válido.'};
    if (date.getTime()<Date.now()-10*60*1000) return {error:'Escolha um horário atual ou futuro.'};
    if (date.getTime()>Date.now()+60*24*60*60*1000) return {error:'Escolha uma data dentro dos próximos 60 dias.'};
    if (note.length>240) return {error:'A observação pode ter no máximo 240 caracteres.'};
    return {nickname,platform,game_mode:gameMode,available_at:date.toISOString(),note:note||null};
  }
  async function submitInvite(event) {
    event.preventDefault(); if (!session?.user) { openAuth(); return; }
    const values=validateInvite(ui.inviteForm); if (values.error) { setState(ui.inviteFormMsg,values.error,'error'); return; }
    const p=profileFromSession(); setButtonLoading(ui.inviteSubmit,true,'Publicar convite','Publicando…'); setState(ui.inviteFormMsg,'Salvando convite…','loading');
    const {error}=await dataApi.invites.create({user_id:p.userId,display_name:p.name,avatar_url:p.avatar,...values});
    setButtonLoading(ui.inviteSubmit,false,'Publicar convite');
    if (error) { console.error('Falha ao criar convite:',error); setState(ui.inviteFormMsg,'Não foi possível publicar. Confira os campos e tente novamente.','error'); return; }
    ui.inviteForm.reset(); closeInviteModal(); showToast('Convite publicado! 🎮'); await loadInvites();
  }
  async function closeInvite(id,button) {
    if (!session?.user) return;
    setButtonLoading(button,true,'Encerrar','Encerrando…'); const {error}=await dataApi.invites.close(id);
    if (error) { console.error('Falha ao encerrar convite:',error); setButtonLoading(button,false,'Encerrar'); showToast('Não foi possível encerrar o convite.'); return; }
    showToast('Convite encerrado.'); await loadInvites();
  }

  function resetResenhaSignedOut() {
    setState(ui.resenhaStatus,'Entre com o Google para carregar as publicações reais.','locked'); ui.resenhaFeed?.replaceChildren(); postLikeState.clear();
  }
  function renderComment(comment) {
    const row=document.createElement('div'); row.className='c-comment';
    const img=document.createElement('img'); img.src=comment.avatar_url||'assets/avatar.jpg'; img.alt=''; img.loading='lazy'; img.onerror=()=>{img.src='assets/avatar.jpg';};
    const content=document.createElement('div'); const top=document.createElement('div'); top.className='c-comment-top';
    const name=document.createElement('strong'); name.textContent=comment.display_name||'Jogador'; const time=document.createElement('time'); time.dateTime=comment.created_at||''; time.textContent=formatDateTime(comment.created_at); top.append(name,time);
    const text=document.createElement('p'); text.textContent=comment.body||''; content.append(top,text); row.append(img,content);
    if (comment.user_id===session.user.id) { const del=document.createElement('button'); del.type='button'; del.className='c-link-danger'; del.textContent='Excluir'; del.addEventListener('click',()=>deleteComment(comment.id,del)); row.append(del); }
    return row;
  }
  function renderResenha(posts,likes,comments) {
    if (!ui.resenhaFeed) return;
    ui.resenhaFeed.replaceChildren(); postLikeState.clear();
    if (!posts?.length) { setState(ui.resenhaStatus,'Ainda não existem publicações. Comece a Resenha!','empty'); return; }
    setState(ui.resenhaStatus,`${posts.length} ${posts.length===1?'publicação carregada':'publicações carregadas'}.`,'success');
    const likesByPost=new Map(), commentsByPost=new Map();
    (likes||[]).forEach(l=>{const id=Number(l.post_id); if(!likesByPost.has(id)) likesByPost.set(id,[]); likesByPost.get(id).push(l.user_id);});
    (comments||[]).forEach(c=>{const id=Number(c.post_id); if(!commentsByPost.has(id)) commentsByPost.set(id,[]); commentsByPost.get(id).push(c);});
    posts.forEach(post=>{
      const id=Number(post.id), likeUsers=likesByPost.get(id)||[], liked=likeUsers.includes(session.user.id); postLikeState.set(id,{liked});
      const article=document.createElement('article'); article.className='c-post'; article.dataset.postId=String(id);
      const head=document.createElement('header'); head.className='c-post-head';
      const img=document.createElement('img'); img.src=post.avatar_url||'assets/avatar.jpg'; img.alt=''; img.loading='lazy'; img.onerror=()=>{img.src='assets/avatar.jpg';};
      const identity=document.createElement('div'); const name=document.createElement('strong'); name.textContent=post.display_name||'Jogador'; const time=document.createElement('time'); time.dateTime=post.created_at||''; time.textContent=formatDateTime(post.created_at); identity.append(name,time); head.append(img,identity);
      if (post.user_id===session.user.id) { const del=document.createElement('button'); del.type='button'; del.className='c-link-danger'; del.textContent='Excluir'; del.addEventListener('click',()=>deletePost(id,del)); head.append(del); }
      const body=document.createElement('p'); body.className='c-post-body'; body.textContent=post.body;
      const actions=document.createElement('div'); actions.className='c-post-actions';
      const like=document.createElement('button'); like.type='button'; like.className='c-post-action'; like.setAttribute('aria-pressed',String(liked)); like.textContent=`${liked?'♥':'♡'} ${likeUsers.length}`; like.title=liked?'Remover curtida':'Curtir'; like.addEventListener('click',()=>toggleLike(id,like));
      const commentCount=document.createElement('span'); commentCount.className='c-post-action-static'; const list=commentsByPost.get(id)||[]; commentCount.textContent=`💬 ${list.length}`; actions.append(like,commentCount);
      const commentsWrap=document.createElement('div'); commentsWrap.className='c-comments'; list.forEach(c=>commentsWrap.append(renderComment(c)));
      const form=document.createElement('form'); form.className='c-comment-form';
      const input=document.createElement('input'); input.type='text'; input.maxLength=350; input.required=true; input.placeholder='Escreva um comentário...'; input.setAttribute('aria-label','Novo comentário');
      const send=document.createElement('button'); send.type='submit'; send.textContent='Enviar'; form.append(input,send); form.addEventListener('submit',e=>addComment(e,id,input,send));
      article.append(head,body,actions,commentsWrap,form); ui.resenhaFeed.append(article);
    });
  }
  async function loadResenha() {
    if (!session?.user || !client) return;
    setState(ui.resenhaStatus,'Carregando Resenha…','loading');
    const {data:posts,error}=await dataApi.resenha.posts();
    if (error) { console.error('Falha ao carregar Resenha:',error); setState(ui.resenhaStatus,'Não foi possível carregar a Resenha. Tente novamente.','error'); return; }
    if (!posts?.length) { renderResenha([],[],[]); return; }
    const ids=posts.map(p=>p.id);
    const [likesResult,commentsResult]=await Promise.all([dataApi.resenha.likes(ids),dataApi.resenha.comments(ids)]);
    if (likesResult.error) console.error('Falha ao carregar curtidas:',likesResult.error);
    if (commentsResult.error) console.error('Falha ao carregar comentários:',commentsResult.error);
    renderResenha(posts,likesResult.data||[],commentsResult.data||[]);
  }
  async function createPost(event) {
    event.preventDefault(); if (!session?.user) { openAuth(); return; }
    const body=ui.postTextarea?.value.trim()||'';
    if (!body) { showToast('Escreva algo antes de publicar.'); return; }
    if (body.length>800) { showToast('A publicação pode ter no máximo 800 caracteres.'); return; }
    const p=profileFromSession(); setButtonLoading(ui.postSubmit,true,'Publicar','Publicando…');
    const {error}=await dataApi.resenha.createPost({user_id:p.userId,display_name:p.name,avatar_url:p.avatar,body});
    setButtonLoading(ui.postSubmit,false,'Publicar');
    if (error) { console.error('Falha ao publicar:',error); showToast('Não foi possível publicar.'); return; }
    ui.postTextarea.value=''; updatePostCount(); showToast('Publicado na Resenha!'); await loadResenha();
  }
  async function toggleLike(postId,button) {
    const state=postLikeState.get(Number(postId)); if (!state || !session?.user) return;
    button.disabled=true; const {error}=state.liked ? await dataApi.resenha.removeLike(postId) : await dataApi.resenha.addLike(postId); button.disabled=false;
    if (error) { console.error('Falha ao atualizar curtida:',error); showToast('Não foi possível atualizar a curtida.'); return; }
    await loadResenha();
  }
  async function addComment(event,postId,input,button) {
    event.preventDefault(); if (!session?.user) { openAuth(); return; }
    const body=input.value.trim(); if (!body) return; if(body.length>350){showToast('O comentário pode ter no máximo 350 caracteres.');return;}
    const p=profileFromSession(); setButtonLoading(button,true,'Enviar','…');
    const {error}=await dataApi.resenha.addComment({post_id:postId,user_id:p.userId,display_name:p.name,avatar_url:p.avatar,body});
    setButtonLoading(button,false,'Enviar'); if(error){console.error('Falha ao comentar:',error);showToast('Não foi possível comentar.');return;} input.value=''; await loadResenha();
  }
  async function deletePost(id,button) {
    if (!window.confirm('Excluir esta publicação?')) return;
    setButtonLoading(button,true,'Excluir','…'); const {error}=await dataApi.resenha.deletePost(id);
    if(error){console.error('Falha ao excluir publicação:',error);setButtonLoading(button,false,'Excluir');showToast('Não foi possível excluir.');return;} showToast('Publicação excluída.'); await loadResenha();
  }
  async function deleteComment(id,button) {
    setButtonLoading(button,true,'Excluir','…'); const {error}=await dataApi.resenha.deleteComment(id);
    if(error){console.error('Falha ao excluir comentário:',error);setButtonLoading(button,false,'Excluir');showToast('Não foi possível excluir o comentário.');return;} await loadResenha();
  }
  function updatePostCount() { if(ui.postCount&&ui.postTextarea) ui.postCount.textContent=String(ui.postTextarea.value.length); }

  function scheduleInvitesReload() { clearTimeout(inviteReloadTimer); inviteReloadTimer=setTimeout(()=>loadInvites(),220); }
  function scheduleResenhaReload() { clearTimeout(resenhaReloadTimer); resenhaReloadTimer=setTimeout(()=>loadResenha(),260); }
  function stopRealtime() { if(realtimeChannel&&client){client.removeChannel(realtimeChannel);realtimeChannel=null;} }
  function startRealtime() {
    if (!client || !session?.user) return;
    stopRealtime();
    realtimeChannel=client.channel(`italo-community-${session.user.id.slice(0,8)}`)
      .on('postgres_changes',{event:'INSERT',schema:'public',table:'italo_messages'},payload=>appendMessage(payload.new))
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_game_invites'},scheduleInvitesReload)
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_resenha_posts'},scheduleResenhaReload)
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_resenha_likes'},scheduleResenhaReload)
      .on('postgres_changes',{event:'*',schema:'public',table:'italo_resenha_comments'},scheduleResenhaReload)
      .subscribe(status=>{
        if(status==='CHANNEL_ERROR' || status==='TIMED_OUT') console.warn('Realtime da comunidade:',status);
      });
  }

  ui.googleBtn?.addEventListener('click',async()=>{
    if(!client){setAuthMessage('Não foi possível carregar o login. Atualize a página.');return;}
    setButtonLoading(ui.googleBtn,true,'Continuar com Google','Abrindo Google…'); setAuthMessage('Redirecionando para o Google…');
    const redirectTo=location.origin+location.pathname;
    const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo,queryParams:{prompt:'select_account'}}});
    if(error){console.error('Falha no login Google:',error);setButtonLoading(ui.googleBtn,false,'Continuar com Google');setAuthMessage('Não foi possível iniciar o login. Tente novamente.');}
  });
  ui.authClose?.addEventListener('click',closeAuth);
  authWrap.addEventListener('click',event=>{if(event.target===authWrap)closeAuth();});
  ui.logout?.addEventListener('click',async()=>{if(!client)return;ui.logout.disabled=true;const {error}=await client.auth.signOut({scope:'local'});ui.logout.disabled=false;if(error){console.error('Falha no logout:',error);showToast('Não foi possível sair agora.');return;}showToast('Você saiu da comunidade.');});
  $('[data-community-enter]')?.addEventListener('click',event=>{if(!session?.user){event.preventDefault();openAuth();}});
  ui.chatSend?.addEventListener('click',sendMessage);
  ui.chatInput?.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendMessage();}});
  ui.emoji?.addEventListener('click',()=>{if(!session?.user){openAuth();return;}ui.chatInput.value=`${ui.chatInput.value} ⚽`.trimStart();ui.chatInput.focus();});
  ui.openInvite?.addEventListener('click',openInviteModal);
  $$('[data-close-invite]').forEach(btn=>btn.addEventListener('click',closeInviteModal));
  ui.inviteModal?.addEventListener('click',event=>{if(event.target===ui.inviteModal)closeInviteModal();});
  ui.inviteForm?.addEventListener('submit',submitInvite);
  ui.postForm?.addEventListener('submit',createPost);
  ui.postTextarea?.addEventListener('input',updatePostCount);
  $$('[data-coming-soon]').forEach(btn=>btn.addEventListener('click',()=>showToast('Essa função está marcada como Em breve.')));
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeAuth();closeInviteModal();}});

  async function init() {
    if (!client) {
      setSignedUi(false); if(ui.status)ui.status.textContent='Não foi possível carregar a conexão com a comunidade.';
      renderEmptyChat('Falha ao carregar o sistema. Atualize a página.'); setState(ui.inviteStatus,'Falha ao carregar o sistema.','error'); setState(ui.resenhaStatus,'Falha ao carregar o sistema.','error'); return;
    }
    const {data,error}=await client.auth.getSession();
    if(error)console.error('Falha ao restaurar sessão:',error);
    await applySession(data?.session||null);
    client.auth.onAuthStateChange((_event,nextSession)=>{setTimeout(()=>applySession(nextSession),0);});
  }

  init();
})();
