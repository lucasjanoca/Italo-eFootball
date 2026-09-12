window.ITALO_SITE_CONFIG=Object.freeze({
  lockVideoSelection:true,
  lockViewCounts:true,
  videoSlots:8,
  courseUrl:"https://pay.kiwify.com.br/yAdCPJy",
  youtubeChannelUrl:"https://www.youtube.com/channel/UCaThC5oHN4mG59Ya8WGQLmQ",
  communityUrl:"comunidade.html"
});

(() => {
  const addStylesheet = (href, marker) => {
    if (document.querySelector(`link[${marker}]`)) return;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = href;
    css.setAttribute(marker, 'true');
    document.head.appendChild(css);
  };

  addStylesheet('generated-assets.css', 'data-generated-assets');
  addStylesheet('production-fixes.css', 'data-production-fixes');

  if (/\/grupos\.html(?:$|[?#])/i.test(location.pathname + location.search + location.hash)) {
    location.replace('comunidade.html');
    return;
  }

  const normalizeCommunityLinks = () => {
    document.querySelectorAll('a[href]').forEach(link => {
      const href = (link.getAttribute('href') || '').trim().toLowerCase();
      const label = (link.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      if (
        href === 'grupos.html' ||
        href.endsWith('/grupos.html') ||
        label === 'comunidades' ||
        label.includes('entrar na comunidade')
      ) {
        link.href = 'comunidade.html';
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', normalizeCommunityLinks, { once:true });
  } else {
    normalizeCommunityLinks();
  }
})();
