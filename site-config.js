window.ITALO_SITE_CONFIG=Object.freeze({"lockVideoSelection":true,"lockViewCounts":true,"videoSlots":8,"courseUrl":"https://pay.kiwify.com.br/yAdCPJy","youtubeChannelUrl":"https://youtube.com/@italoefootballives?si=0cd7d6id502UjSVx"});

(() => {
  if (!document.querySelector('link[data-generated-assets]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'generated-assets.css';
    css.dataset.generatedAssets = 'true';
    document.head.appendChild(css);
  }

  if (/\/grupos\.html(?:$|[?#])/i.test(location.pathname + location.search + location.hash)) {
    location.replace('comunidade.html');
    return;
  }

  const normalizeCommunityLinks = () => {
    document.querySelectorAll('a[href]').forEach(link => {
      const href = (link.getAttribute('href') || '').trim().toLowerCase();
      const label = (link.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
      if (href === 'grupos.html' || href.endsWith('/grupos.html') || label === 'comunidades' || label.includes('entrar na comunidade')) {
        link.href = 'comunidade.html';
        link.removeAttribute('target');
        link.removeAttribute('rel');
      }
    });
  };

  document.addEventListener('DOMContentLoaded', normalizeCommunityLinks);

  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    const href = (link.getAttribute('href') || '').trim().toLowerCase();
    const label = (link.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
    if (href === 'grupos.html' || href.endsWith('/grupos.html') || label === 'comunidades' || label.includes('entrar na comunidade')) {
      event.preventDefault();
      location.href = 'comunidade.html';
    }
  }, true);
})();
