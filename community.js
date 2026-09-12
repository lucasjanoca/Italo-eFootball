(() => {
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
  const authMsg = document.querySelector('[data-auth-msg]');
  const userChip = document.querySelector('[data-user-chip]');
  const userAvatar = document.querySelector('[data-user-avatar]');
  const userName = document.querySelector('[data-user-name]');
  const logoutBtn = document.querySelector('[data-user-logout]');
  const locked = document.querySelectorAll('.c-locked');
  const toast = document.querySelector('[data-community-toast]');
  const statusCopy = document.querySelector('[data-community-status] span');

  const messagesEl = document.querySelector('.c-messages');
  const chatInput = document.querySelector('.c-input input[type="text"]');
  const chatSend = document.querySelector('[data-chat-send]');
  const emojiBtn = document.querySelector('[data-chat-emoji]');
  const createTopicBtn = document.querySelector('[data-create-topic]');
  const topicGrid = document.querySelector('[data-topic-grid]');

  let session = null;
  let realtimeChannel = null;
  let topicState = new Map();
  let loadingCommunity = false;
  const renderedMessageIds = new Set();

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function showToast(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  function setAuthMessage(text = '') {
    if (authMsg) authMsg.textContent = text;
  }

  function openAuth() {
    if (session) {
      document.querySelector('#chat')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      return;
    }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => googleBtn?.focus());
  }

  function closeAuth() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    setAuthMessage('');
  }

  function profileFromSession() {
    const user = session?.user;
    const meta = user?.user_metadata || {};
    const rawName = meta.full_name || meta.name || user?.email?.split('@')[0] || 'Jogador';
    return {
      userId: user?.id || null,
      name: String(rawName).trim().slice(0, 60) || 'Jogador',
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
    if (error) console.error('Falha ao sincronizar perfil:', error);
  }

  function applySession(nextSession) {
    session = nextSession || null;
    const signed = !!session?.user;
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
      if (statusCopy) statusCopy.textContent = `Conectado como ${profile.name}. Chat e tópicos carregam dados reais.`;
    } else {
      if (statusCopy) statusCopy.textContent = 'Entre para carregar os dados reais da comunidade.';
      resetSignedOutView();
    }
  }

  function resetSignedOutView() {
    stopRealtime();
    renderEmptyChat('Entre com o Google para carregar as mensagens reais.');
    if (topicGrid) {
      topicGrid.replaceChildren();
      const card = document.createElement('article');
      card.className = 'c-topic';
      const title = document.createElement('strong');
      title.textContent = 'Entre para ver os tópicos';
      const copy = document.createElement('small');
      copy.textContent = 'Os participantes e tópicos são carregados do banco de dados.';
      card.append(title, copy);
      topicGrid.append(card);
    }
    topicState = new Map();
  }

  function formatMessageTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date);
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
    if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
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

  function appendMessage(row) {
    if (!messagesEl || row?.id == null) return;
    const id = String(row.id);
    if (renderedMessageIds.has(id)) return;
    renderedMessageIds.add(id);
    messagesEl.querySelector('[data-chat-empty]')?.remove();
    messagesEl.appendChild(makeMessageElement(row));

    while (messagesEl.children.length > 80) {
      const first = messagesEl.firstElementChild;
      if (first?.dataset.messageId) renderedMessageIds.delete(first.dataset.messageId);
      first?.remove();
    }
    scrollChatToBottom();
  }

  async function loadMessages() {
    if (!client || !session || !messagesEl) return;
    renderEmptyChat('Carregando mensagens…');

    const { data, error } = await client
      .from('italo_messages')
      .select('id,user_id,display_name,avatar_url,body,created_at')
      .order('created_at', { ascending: false })
      .limit(80);

    if (error) {
      console.error('Falha ao carregar chat:', error);
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
  }

  async function sendMessage() {
    if (!session) {
      openAuth();
      return;
    }
    if (!client || !chatInput) {
      showToast('O chat não pôde ser carregado.');
      return;
    }

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
      showToast('Não foi possível enviar a mensagem. Tente novamente.');
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
      const title = document.createElement('strong');
      title.textContent = 'Nenhum tópico aberto';
      const copy = document.createElement('small');
      copy.textContent = 'Crie o primeiro tópico da comunidade.';
      empty.append(title, copy);
      topicGrid.appendChild(empty);
      return;
    }

    const currentUserId = session?.user?.id;
    const membersByTopic = new Map();
    (members || []).forEach(member => {
      const id = Number(member.topic_id);
      if (!membersByTopic.has(id)) membersByTopic.set(id, []);
      membersByTopic.get(id).push(member.user_id);
    });

    rows.forEach(row => {
      const id = Number(row.id);
      const memberIds = membersByTopic.get(id) || [];
      const joined = !!currentUserId && memberIds.includes(currentUserId);
      topicState.set(id, { joined });

      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'c-topic';
      card.dataset.topicId = String(id);
      card.setAttribute('aria-pressed', String(joined));

      const title = document.createElement('strong');
      title.textContent = row.title;

      const copy = document.createElement('small');
      copy.className = 'live-dot';
      copy.textContent = topicParticipantsLabel(memberIds.length, joined);

      card.append(title, copy);
      card.addEventListener('click', () => toggleTopicMembership(id));
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
      showToast('Não foi possível carregar os tópicos.');
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

    const raw = window.prompt('Nome do tópico (ex.: Amistoso agora):');
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
    if (joinError) {
      console.error('Entrada automática no tópico falhou:', joinError);
      showToast('Tópico criado, mas não foi possível entrar automaticamente.');
    } else {
      showToast('Tópico criado! 🎮');
    }
    await loadTopics();
  }

  async function toggleTopicMembership(topicId) {
    if (!session) {
      openAuth();
      return;
    }
    if (!client) return;

    const current = topicState.get(Number(topicId));
    if (!current) return;
    const userId = session.user.id;

    let error;
    if (current.joined) {
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

    showToast(current.joined ? 'Você saiu do tópico.' : 'Você entrou no tópico! ⚽');
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
          showToast('Atualização em tempo real temporariamente indisponível.');
        }
      });
  }

  async function loadCommunityData() {
    if (!session || loadingCommunity) return;
    loadingCommunity = true;
    try {
      await ensureProfile();
      await Promise.all([loadMessages(), loadTopics()]);
      startRealtime();
    } finally {
      loadingCommunity = false;
    }
  }

  document.querySelectorAll('[data-community-enter]').forEach(button => {
    button.addEventListener('click', event => {
      event.preventDefault();
      if (!session) openAuth();
      else document.querySelector('#chat')?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    });
  });

  chatSend?.addEventListener('click', sendMessage);
  chatInput?.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  });

  emojiBtn?.addEventListener('click', () => {
    if (!session) {
      openAuth();
      return;
    }
    if (!chatInput) return;
    chatInput.value += ' ⚽';
    chatInput.focus();
  });

  createTopicBtn?.addEventListener('click', createTopic);

  document.querySelectorAll('[data-coming-soon]').forEach(button => {
    button.addEventListener('click', () => showToast('Em breve. Esta área ainda não foi liberada.'));
  });

  closeBtn?.addEventListener('click', closeAuth);
  modal.addEventListener('click', event => {
    if (event.target === modal) closeAuth();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && modal.classList.contains('open')) closeAuth();
  });

  googleBtn?.addEventListener('click', async () => {
    if (!client) {
      setAuthMessage('O serviço de login não pôde ser carregado. Atualize a página e tente novamente.');
      return;
    }

    setAuthMessage('Abrindo o Google…');
    googleBtn.disabled = true;

    try {
      const { error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${location.origin}${location.pathname}`,
          queryParams: { prompt: 'select_account' }
        }
      });
      if (error) throw error;
    } catch (error) {
      console.error('Falha ao abrir login Google:', error);
      setAuthMessage('Não foi possível abrir o Google. Tente novamente.');
      googleBtn.disabled = false;
    }
  });

  logoutBtn?.addEventListener('click', async () => {
    if (!client) return;
    logoutBtn.disabled = true;
    const { error } = await client.auth.signOut();
    logoutBtn.disabled = false;
    if (error) {
      console.error('Falha ao sair:', error);
      showToast('Não foi possível sair agora.');
      return;
    }
    applySession(null);
    showToast('Você saiu da comunidade.');
  });

  function showOAuthErrorFromUrl() {
    const params = new URLSearchParams(location.hash.replace(/^#/, '') || location.search.replace(/^\?/, ''));
    const errorDescription = params.get('error_description');
    if (!errorDescription) return;
    openAuth();
    setAuthMessage('O login não foi concluído. Verifique sua conta ou tente novamente.');
    history.replaceState(null, '', location.pathname);
  }

  if (!client) {
    renderEmptyChat('O serviço da comunidade não pôde ser carregado.');
    if (statusCopy) statusCopy.textContent = 'Serviço temporariamente indisponível.';
    googleBtn?.setAttribute('disabled', 'true');
    return;
  }

  showOAuthErrorFromUrl();

  client.auth.onAuthStateChange((event, nextSession) => {
    const previousUserId = session?.user?.id;
    const nextUserId = nextSession?.user?.id;
    applySession(nextSession);

    if (event === 'SIGNED_IN') {
      closeAuth();
      if (previousUserId !== nextUserId) showToast('Bem-vindo à comunidade Ítalo Football!');
    }
    if (nextSession && previousUserId !== nextUserId) loadCommunityData();
    if (!nextSession) stopRealtime();
  });

  (async () => {
    const { data, error } = await client.auth.getSession();
    if (error) {
      console.error('Falha ao recuperar sessão:', error);
      showToast('Não foi possível recuperar sua sessão.');
      return;
    }
    applySession(data.session);
    if (data.session) await loadCommunityData();
  })();
})();
