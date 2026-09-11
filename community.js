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
  const auth = window.supabase?.createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'italo-community-auth' }
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
  let session = null;

  function showToast(text){
    if(!toast) return;
    toast.textContent = text;
    toast.classList.add('show');
    clearTimeout(showToast.t);
    showToast.t = setTimeout(()=>toast.classList.remove('show'), 2600);
  }

  function openAuth(){
    if(session){ showToast('Você já está conectado à comunidade.'); return; }
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
  }
  function closeAuth(){ modal.classList.remove('open'); modal.setAttribute('aria-hidden','true'); }

  function applySession(next){
    session = next;
    const user = session?.user;
    const signed = !!user;
    userChip?.classList.toggle('show', signed);
    locked.forEach(el=>el.classList.toggle('unlocked', signed));
    document.body.classList.toggle('community-authenticated', signed);
    if(signed){
      const meta = user.user_metadata || {};
      if(userName) userName.textContent = meta.full_name || meta.name || user.email?.split('@')[0] || 'Jogador';
      if(userAvatar){
        userAvatar.src = meta.avatar_url || meta.picture || 'assets/avatar.jpg';
        userAvatar.onerror = () => { userAvatar.src='assets/avatar.jpg'; };
      }
    }
  }

  document.querySelectorAll('[data-community-enter]').forEach(btn=>btn.addEventListener('click', e=>{
    e.preventDefault();
    if(session){ document.querySelector('#chat')?.scrollIntoView({behavior:'smooth',block:'start'}); showToast('Comunidade liberada.'); }
    else openAuth();
  }));

  document.querySelectorAll('[data-requires-auth]').forEach(btn=>btn.addEventListener('click', e=>{
    e.preventDefault();
    if(!session) openAuth();
    else showToast('Visual pronto — essa função será ligada aos dados reais depois.');
  }));

  closeBtn?.addEventListener('click', closeAuth);
  modal.addEventListener('click', e=>{ if(e.target===modal) closeAuth(); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeAuth(); });

  googleBtn?.addEventListener('click', async()=>{
    if(!auth){ if(msg) msg.textContent='Login ainda não pôde ser carregado.'; return; }
    if(msg) msg.textContent='Abrindo o Google...';
    googleBtn.disabled = true;
    try{
      const { error } = await auth.auth.signInWithOAuth({ provider:'google', options:{ redirectTo: location.origin + location.pathname } });
      if(error) throw error;
    }catch(err){
      if(msg) msg.textContent = 'Não foi possível abrir o Google agora.';
      googleBtn.disabled = false;
    }
  });

  logoutBtn?.addEventListener('click', async()=>{
    if(auth) await auth.auth.signOut();
    applySession(null);
    showToast('Você saiu da comunidade.');
  });

  auth?.auth.onAuthStateChange((event,nextSession)=>{
    applySession(nextSession);
    if(event==='SIGNED_IN'){
      closeAuth();
      setTimeout(()=>showToast('Bem-vindo à comunidade Ítalo Football!'), 350);
    }
  });

  (async()=>{
    if(!auth) return;
    const { data } = await auth.auth.getSession();
    applySession(data.session);
  })();
})();