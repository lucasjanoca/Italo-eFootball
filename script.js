const menuBtn = document.querySelector('.menu-btn');
const mobileMenu = document.querySelector('.mobile-menu');

function setMenu(open) {
  if (!menuBtn || !mobileMenu) return;
  mobileMenu.classList.toggle('open', open);
  menuBtn.classList.toggle('open', open);
  menuBtn.setAttribute('aria-expanded', String(open));
  mobileMenu.setAttribute('aria-hidden', String(!open));
  document.body.classList.toggle('menu-open', open);
}

if (menuBtn && mobileMenu) {
  menuBtn.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
  mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => setMenu(false)));
  document.addEventListener('click', event => {
    if (!mobileMenu.classList.contains('open')) return;
    if (!mobileMenu.contains(event.target) && !menuBtn.contains(event.target)) setMenu(false);
  });
}

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') setMenu(false);
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems = document.querySelectorAll('.reveal');

if ('IntersectionObserver' in window && !reduceMotion) {
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: .12, rootMargin: '0px 0px -30px' });
  revealItems.forEach(el => observer.observe(el));
} else {
  revealItems.forEach(el => el.classList.add('visible'));
}

const year = document.querySelector('#year');
if (year) year.textContent = new Date().getFullYear();

window.addEventListener('resize', () => {
  if (window.innerWidth > 760) setMenu(false);
}, { passive: true });

/* Catálogo de cursos: o site apresenta os cursos antes de enviar ao checkout. */
const courseCheckoutUrl = window.ITALO_SITE_CONFIG?.courseUrl || 'https://pay.kiwify.com.br/yAdCPJy';

document.querySelectorAll('[data-course-checkout]').forEach(link => {
  link.href = courseCheckoutUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
});

document.querySelectorAll('.desktop-nav a[href="curso.html"], .mobile-menu a[href="curso.html"]').forEach(link => {
  link.textContent = 'Cursos';
});

document.querySelectorAll('a[href]').forEach(link => {
  if (link.hasAttribute('data-course-checkout')) return;

  const rawHref = link.getAttribute('href') || '';
  try {
    const url = new URL(rawHref, window.location.href);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'pay.kiwify.com.br') {
      link.href = 'curso.html';
      link.removeAttribute('target');
      link.removeAttribute('rel');

      const label = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
      if (link.classList.contains('btn') && label.includes('curso')) {
        link.innerHTML = 'Ver cursos <span>›</span>';
      }
    }
  } catch {
    /* Ignora URLs inválidas sem interromper a navegação. */
  }
});

const youtubeChannelUrl = window.ITALO_SITE_CONFIG?.youtubeChannelUrl || 'https://youtube.com/@italoefootballives?si=0cd7d6id502UjSVx';

function isYoutubeVideoUrl(rawHref) {
  try {
    const url = new URL(rawHref, window.location.href);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();

    if (host === 'youtu.be') return true;
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return false;

    return url.pathname === '/watch' ||
      url.searchParams.has('v') ||
      /^\/(shorts|live|embed)\//i.test(url.pathname);
  } catch {
    return false;
  }
}

function isYoutubeChannelUrl(rawHref) {
  try {
    const url = new URL(rawHref, window.location.href);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return false;
    return !isYoutubeVideoUrl(rawHref);
  } catch {
    return false;
  }
}

document.querySelectorAll('a').forEach(link => {
  const label = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();

  if (label.includes('entrar na comunidade')) {
    link.href = 'grupos.html';
    link.removeAttribute('target');
    link.removeAttribute('rel');
  }

  const rawHref = link.getAttribute('href') || '';

  if (isYoutubeChannelUrl(rawHref)) {
    link.href = youtubeChannelUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
  }
});

/* Marca unificada: uma única logo limpa no cabeçalho e no rodapé de todas as páginas. */
const italoLogoUrl = 'assets/italo-football-logo.svg';
document.querySelectorAll('a.brand').forEach(brand => {
  const isFooter = brand.classList.contains('brand-footer');
  brand.classList.add('brand-upgraded');
  brand.innerHTML = `<img class="brand-unified-logo${isFooter ? ' brand-unified-logo-footer' : ''}" src="${italoLogoUrl}" alt="Ítalo Football" decoding="async"${isFooter ? ' loading="lazy"' : ''}>`;
});

/* Créditos inspirados na apresentação da Mundo Kids: InfoTech.io + Plexo. */
const infoTechLogoUrl = 'https://infotech-io.com.br/assets/brand/logo.webp';
const plexoUrl = 'https://www.tiktok.com/@plexoplace?_r=1&_t=ZS-99E1bmV05YI';

document.querySelectorAll('.site-footer .credit').forEach(credit => {
  const partners = document.createElement('div');
  partners.className = 'site-partners';
  partners.setAttribute('aria-label', 'Desenvolvimento e parceria');
  partners.innerHTML = `
    <span class="site-partners-title">Desenvolvimento e parceria</span>
    <a class="site-partner site-partner-info" href="https://infotech-io.com.br/" target="_blank" rel="noopener noreferrer" aria-label="Abrir site da InfoTech.io">
      <img src="${infoTechLogoUrl}" alt="InfoTech.io" loading="lazy" decoding="async">
      <span><strong>InfoTech.io</strong><small>Desenvolvimento</small></span>
    </a>
    <a class="site-partner site-partner-plexo" href="${plexoUrl}" target="_blank" rel="noopener noreferrer" aria-label="Abrir perfil da Plexo">
      <span class="site-plexo-brand" aria-hidden="true">
        <svg viewBox="0 0 100 100"><path d="M50 7 L62 37 L93 50 L62 63 L50 93 L38 63 L7 50 L38 37 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M50 42 L55 50 L50 58 L45 50 Z" fill="currentColor"/></svg>
        <b>PLEXO</b>
      </span>
      <span><strong>Plexo</strong><small>Parceria</small></span>
    </a>
    <span class="site-partners-bottom">InfoTech.io + Plexo</span>
  `;

  const infoLogo = partners.querySelector('.site-partner-info img');
  infoLogo?.addEventListener('error', () => {
    infoLogo.style.display = 'none';
  }, { once: true });

  credit.replaceWith(partners);
});

if (!document.querySelector('#brand-partners-style')) {
  const style = document.createElement('style');
  style.id = 'brand-partners-style';
  style.textContent = `
    .brand.brand-upgraded{display:flex;align-items:center;width:auto;line-height:1;font-style:normal;letter-spacing:0}
    .brand-upgraded .brand-unified-logo{display:block;width:190px;height:auto;max-height:56px;object-fit:contain;object-position:left center;filter:drop-shadow(0 0 10px rgba(255,32,55,.12))}
    .brand-upgraded .brand-unified-logo-footer{width:172px;max-height:52px}

    .site-partners{grid-column:1/-1;width:min(100%,680px);margin:2px auto 22px;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch;justify-self:center}
    .site-partners-title{grid-column:1/-1;text-align:center;font-size:9px;letter-spacing:.19em;text-transform:uppercase;color:#75808d;font-weight:900}
    .site-partner{min-height:72px;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:12px;padding:11px 15px;transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease}
    .site-partner:hover{transform:translateY(-2px)}
    .site-partner>span:last-child{display:flex;flex-direction:column;line-height:1.1}
    .site-partner strong{font-size:13px;color:#fff}
    .site-partner small{margin-top:5px;color:#82909e;font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.08em}
    .site-partner-info{background:#020712;border:1px solid rgba(120,218,255,.18);box-shadow:0 10px 30px rgba(15,89,164,.08)}
    .site-partner-info:hover{border-color:rgba(120,218,255,.34);box-shadow:0 12px 34px rgba(15,89,164,.13)}
    .site-partner-info img{width:118px;height:42px;display:block;object-fit:contain;object-position:center}
    .site-partner-plexo{background:linear-gradient(145deg,#052636,#073e51);border:1px solid rgba(24,215,255,.28);box-shadow:0 10px 30px rgba(4,87,112,.12)}
    .site-partner-plexo:hover{border-color:rgba(24,215,255,.5);box-shadow:0 12px 34px rgba(4,108,139,.18)}
    .site-plexo-brand{display:flex!important;align-items:center;gap:7px;color:#18d7ff}
    .site-plexo-brand svg{width:34px;height:34px;flex:0 0 34px}
    .site-plexo-brand b{font-size:13px;color:#fff;letter-spacing:.08em}
    .site-partners-bottom{grid-column:1/-1;text-align:center;color:#59636f;font-size:9px;letter-spacing:.12em;text-transform:uppercase}

    @media (max-width:1080px){
      .site-partners{grid-column:1/-1;margin-top:8px}
    }
    @media (max-width:760px){
      .brand-upgraded .brand-unified-logo{width:176px;max-height:50px}
      .brand-upgraded .brand-unified-logo-footer{width:162px}
      .site-partners{grid-template-columns:1fr;width:min(100%,520px);gap:7px;margin-bottom:8px}
      .site-partners-title,.site-partners-bottom{grid-column:1}
      .site-partner{min-height:64px;padding:8px 12px}
      .site-partner-info img{width:108px;height:36px}
      .site-plexo-brand svg{width:31px;height:31px;flex-basis:31px}
    }
    @media (max-width:420px){
      .brand-upgraded .brand-unified-logo{width:164px;max-height:47px}
      .brand-upgraded .brand-unified-logo-footer{width:154px}
      .site-partner{justify-content:flex-start}
      .site-partner-info img{width:100px;height:34px}
    }
  `;
  document.head.appendChild(style);
}

/* Garante segurança e comportamento consistente para todos os links externos. */
document.querySelectorAll('a[href]').forEach(link => {
  try {
    const url = new URL(link.getAttribute('href'), window.location.href);
    if ((url.protocol === 'http:' || url.protocol === 'https:') && url.origin !== window.location.origin) {
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
    }
  } catch {
    /* Links relativos válidos não precisam de tratamento adicional. */
  }
});

document.querySelectorAll('a[href="index.html"]').forEach(link => {
  link.addEventListener('click', event => {
    const path = window.location.pathname;
    const onHome = path.endsWith('/index.html') || path.endsWith('/Italo-eFootball/') || path === '/';
    if (!onHome) return;
    event.preventDefault();
    setMenu(false);
    window.history.replaceState(null, '', 'index.html');
    window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
  });
});
