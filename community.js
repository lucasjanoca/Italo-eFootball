(() => {
  /* Carrega por último a camada das artes geradas da comunidade. */
  if (!document.querySelector('link[data-generated-assets]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'generated-assets.css';
    link.dataset.generatedAssets = 'true';
    document.head.appendChild(link);
  }

  const authWrap = document.querySelector('[data-auth-wrap]');
  if (!authWrap) return;

  const SUPABASE_URL = 'https://yncspxfsvlqdnodlsosb.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_jALAHHuvrV5oxj2mugWTCQ_stD_vFyN';
  const client = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'italo-community-auth'
    }
  });

  const modal = authWrap;
  const googleBtn = document.querySelector('[data-google-login]');
  const closeBtn = document.querySelector('[data-auth-close]');
  const msg = document.querySelector('[data-auth-msg]');
  const userChip = document.querySelector('[data-user-chip]');
  const userAvatar = document.querySelector('[data-user-avatar]');
  const userName = document.querySelector('[data-user-name]');
  const logoutBtn = document.querySelector('[data-user-logout]');
  const locked = document.querySelectorAll('.c-locked');
  const toast = document.querySelector('[data-community-toast]');

  const messagesEl = document.querySelector('.c-messages');
  const chatInput = document.querySelector('.c-input input[type="text"]');
  const chatSend = document.querySelector('.c-input button[data-requires-auth]');
  const createTopicBtn = [...document.querySelectorAll('button[data-requires-auth]')]
    .find(button => /criar\s+t[oó]pico/i.test(button.textContent || ''));
  const topicSection = createTopicBtn?.closest('.c-section');
  const topicGrid = topicSection?.querySelector('.c-card-grid');

  let session = null;
  let realtimeChannel = null;
  let topicState = new Map();
  const renderedMessageIds = new Set();

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  function openAuth() {
    if (session) {
      showToast('Você já está conectado à comunidade.');
      return;
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeAuth() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
  }

  function profileFromSession() {
    const user = session?.user;
    const meta = user?.user_metadata || {};
    return {
      userId: user?.id || null,
      name: (meta.full_name || meta.name || user?.email?.split('@')[0] || 'Jogador').trim().slice(0, 60),
      avatar: meta.avatar_url || meta.picture || 'assets/avatar.jpg'
    };
  }

  async function ensureProfile() {
    if (!client || !session?.user) return;
    const profile = profileFromSession();
    const { error } = await client.from('italo_profiles').upsert({
      user_id: profile.userId,
      display_name: profile.name,
      avatar_url: profile.avatar,
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' });

    if (error) console.error('Não foi possível sincronizar o perfil da comunidade:', error);
  }

  function applySession(next) {
    session = next;
    const user = session?.user;
    const signed = !!user;

    userChip?.classList.toggle('show', signed);
    locked.forEach(el => el.classList.toggle('unlocked', signed));
    document.body.classList.toggle('community-authenticated', signed);

    if (signed) {
      const profile = profileFromSession();
      if (userName) userName.textContent = profile.name;
      if (userAvatar) {
        userAvatar.src = profile.avatar;
        userAvatar.onerror = () => { userAvatar.src = 'assets/avatar.jpg'; };
      }
    }
  }

  function formatMessageTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }

  function makeMessageElement(row) {
    const wrapper = document.createElement('div');
    wrapper.className = 'c-msg';
    wrapper.dataset.messageId = String(row.id);

    const image = document.createElement('img');
    image.src = row.avatar_url || 'assets/avatar.jpg';
    image.alt = '';
    image.loading = 'lazy';
    image.onerror = () => { image.src = 'assets/avatar.jpg'; };

    const name = document.createElement('strong');
    name.textContent = row.display_name || 'Jogador';

    const time = document.createElement('time');
    time.dateTime = row.created_at || '';
    time.textContent = formatMessageTime(row.created_at);

    const body = document.createElement('span');
    body.textContent = row.body || '';

    wrapper.append(image, name, time, body);
    return wrapper;
  }

  function scrollChatToBottom() {
    if (!messagesEl) return;
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function appendMessage(row) {
    if (!messagesEl || !row?.id || renderedMessageIds.has(String(row.id))) return;
    renderedMessageIds.add(String(row.id));

    const empty = messagesEl.querySelector('[data-chat-empty]');
    empty?.remove();

    messagesEl.appendChild(makeMessageElement(row));

    while (messagesEl.children.length > 80) {
      const first = messagesEl.firstElementChild;
      const id = first?.dataset.messageId;
      if (id) renderedMessageIds.delete(id);
      first?.remove();
    }
    scrollChatToBottom();
  }

  function renderEmptyChat(text) {
    if (!messagesEl) return;
    messagesEl.replaceChildren();
    renderedMessageIds.clear();

    const empty = document.createElement('div');
    empty.className = 'c-msg';
    empty.dataset.chatEmpty = 'true';

    const image = document.createElement('img');
    image.src = 'assets/avatar.jpg';
    image.alt = '';

    const name = document.createElement('strong');
    name.textContent = 'Ítalo Football';

    const time = document.createElement('time');
    time.textContent = 'agora';

    const body = document.createElement('span');
    body.textContent = text;

    empty.append(image, name, time, body);
    messagesEl.appendChild(empty);
  }

  async function loadMessages() {
    if (!client || !session || !messagesEl) return;

    const { data, error } = await client
      .from('italo_messages')
      .select('id,user_id,display_name,avatar_url,body,created_at')
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      console.error('Falha ao carregar o chat:', error);
      renderEmptyChat('Não foi possível carregar o chat agora. Tente novamente.');
      return;
    }

    messagesEl.replaceChildren();
    renderedMessageIds.clear();

    if (!data?.length) {
      renderEmptyChat('O chat está aberto. Seja o primeiro a mandar uma mensagem! ⚽');
      return;
    }

    [...data].reverse().forEach(appendMessage);
    scrollChatToBottom();
  }

  async function sendMessage() {
    if (!session) {
      openAuth();
      return;
    }
    if (!client || !chatInput) return;

    const body = chatInput.value.trim();
    if (!body) {
      showToast('Digite uma mensagem antes de enviar.');
      return;
    }
    if (body.length > 500) {
      showToast('A mensagem pode ter no máximo 500 caracteres.');
      return;
    }

    const profile = profileFromSession();
    if (chatSend) chatSend.disabled = true;

    const { data, error } = await client
      .from('italo_messages')
      .insert({
        user_id: profile.userId,
        display_name: profile.name,
        avatar_url: profile.avatar,
        body
      })
      .select('id,user_id,display_name,avatar_url,body,created_at')
      .single();

    if (chatSend) chatSend.disabled = false;

    if (error) {
      console.error('Falha ao enviar mensagem:', error);
      showToast('Não foi possível enviar. Tente de novo.');
      return;
    }

    chatInput.value = '';
    appendMessage(data);
    chatInput.focus();
  }

  function topicParticipantsLabel(count, joined) {
    const quantity = Number(count || 0);
    const base = `${quantity} ${quantity === 1 ? 'jogador' : 'jogadores'}`;
    return joined ? `${base} • Você está dentro ✓` : `${base} • Entrar`;
  }

  function renderTopics(rows, members) {
    if (!topicGrid) return;
    topicGrid.replaceChildren();
    topicState = new Map();

    if (!rows?.length) {
      const empty = document.createElement('article');
      empty.className = 'c-topic';
      const strong = document.createElement('strong');
      strong.textContent = 'Nenhum tópico aberto';
      const small = document.createElement('small');
      small.textContent = 'Crie o primeiro tópico da comunidade.';
      empty.append(strong, small);
      topicGrid.appendChild(empty);
      return;
    }

    const currentUserId = session?.user?.id;
    const byTopic = new Map();

    (members || []).forEach(member => {
      const id = Number(member.topic_id);
      if (!byTopic.has(id)) byTopic.set(id, []);
      byTopic.get(id).push(member.user_id);
    });

    rows.forEach(row => {
      const id = Number(row.id);
      const memberIds = byTopic.get(id) || [];
      const joined = !!currentUserId && memberIds.includes(currentUserId);
      topicState.set(id, { joined });

      const card = document.createElement('a');
      card.className = 'c-topic';
      card.href = '#';
      card.dataset.topicId = String(id);

      const strong = document.createElement('strong');
      strong.textContent = row.title;

      const small = document.createElement('small');
      small.className = 'live-dot';
      small.textContent = topicParticipantsLabel(memberIds.length, joined);

      card.append(strong, small);
      card.addEventListener('click', event => {
        event.preventDefault();
        toggleTopicMembership(id);
      });

      topicGrid.appendChild(card);
    });
  }

  async function loadTopics() {
    if (!client || !session || !topicGrid) return;

    const { data: topics, error: topicError } = await client
      .from('italo_topics')
      .select('id,user_id,display_name,title,category,is_open,created_at')
      .eq('is_open', true)
      .order('created_at', { ascending: false })
      .limit(24);

    if (topicError) {
      console.error('Falha ao carregar tópicos:', topicError);
      return;
    }

    const ids = (topics || []).map(item => item.id);
    if (!ids.length) {
      renderTopics([], []);
      return;
    }

    const { data: members, error: memberError } = await client
      .from('italo_topic_members')
      .select('topic_id,user_id')
      .in('topic_id', ids);

    if (memberError) {
      console.error('Falha ao carregar participantes:', memberError);
      renderTopics(topics, []);
      return;
    }

    renderTopics(topics, members || []);
  }

  async function createTopic() {
    if (!session) {
      openAuth();
      return;
    }
    if (!client) return;

    const raw = window.prompt('Qual será o nome do tópico? Ex.: Amistoso agora');
    if (raw === null) return;

    const title = raw.trim().replace(/\s+/g, ' ');
    if (title.length < 3) {
      showToast('Use pelo menos 3 caracteres no título.');
      return;
    }
    if (title.length > 100) {
      showToast('O título pode ter no máximo 100 caracteres.');
      return;
    }

    const profile = profileFromSession();
    if (createTopicBtn) createTopicBtn.disabled = true;

    const { data: topic, error } = await client
      .from('italo_topics')
      .insert({
        user_id: profile.userId,
        display_name: profile.name,
        title,
        category: 'Partida'
      })
      .select('id')
      .single();

    if (error) {
      console.error('Falha ao criar tópico:', error);
      if (createTopicBtn) createTopicBtn.disabled = false;
      showToast('Não foi possível criar o tópico.');
      return;
    }

    const { error: joinError } = await client
      .from('italo_topic_members')
      .insert({ topic_id: topic.id, user_id: profile.userId });

    if (createTopicBtn) createTopicBtn.disabled = false;

    if (joinError) console.error('Tópico criado, mas a entrada automática falhou:', joinError);

    showToast('Tópico criado! 🎮');
    await loadTopics();
  }

  async function toggleTopicMembership(topicId) {
    if (!session) {
      openAuth();
      return;
    }
    if (!client) return;

    const joined = topicState.get(Number(topicId))?.joined;
    const userId = session.user.id;

    let error;
    if (joined) {
      ({ error } = await client
        .from('italo_topic_members')
        .delete()
        .eq('topic_id', topicId)
        .eq('user_id', userId));
    } else {
      ({ error } = await client
        .from('italo_topic_members')
        .insert({ topic_id: topicId, user_id: userId }));
    }

    if (error) {
      console.error('Falha ao atualizar participação:', error);
      showToast('Não foi possível atualizar sua participação.');
      return;
    }

    showToast(joined ? 'Você saiu do tópico.' : 'Você entrou no tópico! ⚽');
    await loadTopics();
  }

  function stopRealtime() {
    if (!client || !realtimeChannel) return;
    client.removeChannel(realtimeChannel);
    realtimeChannel = null;
  }

  function startRealtime() {
    if (!client || !session || realtimeChannel) return;

    realtimeChannel = client
      .channel(`italo-community-${session.user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'italo_messages'
      }, payload => appendMessage(payload.new))
      .subscribe(status => {
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn('Realtime indisponível:', status);
        }
      });
  }

  async function loadCommunityData() {
    if (!session) return;
    await ensureProfile();
    await Promise.all([loadMessages(), loadTopics()]);
    startRealtime();
  }

  document.querySelectorAll('[data-community-enter]').forEach(btn => btn.addEventListener('click', event => {
    event.preventDefault();
    if (session) {
      document.querySelector('#chat')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      showToast('Comunidade liberada.');
    } else {
      openAuth();
    }
  }));

  chatSend?.addEventListener('click', event => {
    event.preventDefault();
    sendMessage();
  });

  chatInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  createTopicBtn?.addEventListener('click', event => {
    event.preventDefault();
    createTopic();
  });

  document.querySelectorAll('[data-requires-auth]').forEach(btn => btn.addEventListener('click', event => {
    if (btn === chatSend || btn === createTopicBtn) return;
    event.preventDefault();
    if (!session) openAuth();
    else showToast('Essa área será a próxima a receber dados reais.');
  }));

  closeBtn?.addEventListener('click', closeAuth);
  modal.addEventListener('click', event => { if (event.target === modal) closeAuth(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape') closeAuth(); });

  googleBtn?.addEventListener('click', async () => {
    if (!client) {
      if (msg) msg.textContent = 'Login ainda não pôde ser carregado.';
      return;
    }

    if (msg) msg.textContent = 'Abrindo o Google...';
    googleBtn.disabled = true;

    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: location.origin + location.pathname,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
    } catch (err) {
      console.error('Falha ao abrir login Google:', err);
      if (msg) msg.textContent = 'Não foi possível abrir o Google agora.';
      googleBtn.disabled = false;
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    stopRealtime();
    if (client) await client.auth.signOut();
    applySession(null);
    showToast('Você saiu da comunidade.');
  });

  client?.auth.onAuthStateChange((event, nextSession) => {
    applySession(nextSession);

    if (event === 'SIGNED_IN') {
      closeAuth();
      setTimeout(() => showToast('Bem-vindo à comunidade Ítalo Football!'), 350);
      setTimeout(loadCommunityData, 0);
    }

    if (event === 'SIGNED_OUT') {
      stopRealtime();
    }
  });

  (async () => {
    if (!client) return;
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.error('Não foi possível recuperar a sessão:', error);
      return;
    }

    applySession(data.session);
    if (data.session) await loadCommunityData();
  })();
})();
