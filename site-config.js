window.ITALO_SITE_CONFIG=Object.freeze({
  auditVersion:"2026-09-12-profile-carousel-moderation",
  assetVersion:"20260912-final8",
  lockVideoSelection:true,
  lockViewCounts:true,
  videoSlots:8,
  courseUrl:"https://pay.kiwify.com.br/yAdCPJy",
  youtubeChannelUrl:"https://www.youtube.com/channel/UCaThC5oHN4mG59Ya8WGQLmQ",
  communityUrl:"comunidade.html",
  tournamentsUrl:"torneios.html"
});

(()=>{
  const version=window.ITALO_SITE_CONFIG?.assetVersion||'1';
  const addStylesheet=(href,marker)=>{
    if(document.querySelector(`link[${marker}]`))return;
    const css=document.createElement('link');css.rel='stylesheet';css.href=`${href}?v=${encodeURIComponent(version)}`;css.setAttribute(marker,'true');document.head.appendChild(css);
  };
  const addScript=(src,marker)=>{
    if(document.querySelector(`script[${marker}]`)||document.querySelector(`script[src^="${src}"]`))return;
    const js=document.createElement('script');js.src=`${src}?v=${encodeURIComponent(version)}`;js.defer=true;js.setAttribute(marker,'true');document.head.appendChild(js);
  };
  addStylesheet('generated-assets.css','data-generated-assets');
  addStylesheet('production-fixes.css','data-production-fixes');
  addStylesheet('carousel-enhancements.css','data-carousel-enhancements');
  addStylesheet('launch.css','data-launch-css');
  if(document.body?.classList.contains('home-redesign'))addStylesheet('home-sticky.css','data-home-sticky');
  if(document.body?.classList.contains('community-v2')){addStylesheet('ranking-polish.css','data-ranking-polish');addScript('ranking-polish.js','data-ranking-polish-js');}
  const profilePage=/\/perfil\.html(?:$|[?#])/i.test(location.pathname+location.search+location.hash)||!!document.querySelector('script[src^="profile-app.js"]');
  if(!profilePage&&document.querySelector('[data-social-actions],[data-social-auth],[data-admin-app]'))addScript('launch-social.js','data-launch-social');
  if(/\/grupos\.html(?:$|[?#])/i.test(location.pathname+location.search+location.hash)){location.replace('comunidade.html');return;}

  const normalize=()=>{
    document.querySelectorAll('.desktop-nav,.mobile-menu').forEach(nav=>{
      if(nav.querySelector('a[href="torneios.html"]'))return;
      const link=document.createElement('a');link.href='torneios.html';link.textContent='Torneios';
      const contact=nav.querySelector('a[href="contato.html"]');contact?nav.insertBefore(link,contact):nav.append(link);
    });
    document.querySelectorAll('a[href]').forEach(link=>{
      const href=(link.getAttribute('href')||'').trim().toLowerCase();
      const label=(link.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
      if(href==='grupos.html'||href.endsWith('/grupos.html')||label==='comunidades'||label.includes('entrar na comunidade')){
        link.href='comunidade.html';link.removeAttribute('target');link.removeAttribute('rel');
        if(label.includes('entrar na comunidade')){const text=link.querySelector('.r-action-label');if(text)text.textContent='Abrir comunidade';else if(link.children.length===0)link.textContent='Abrir comunidade';}
      }
    });
  };
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',normalize,{once:true}):normalize();
})();
