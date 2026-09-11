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

/* Destaque visual da assinatura InfoTech.io em todas as páginas. */
if (!document.querySelector('#infotech-credit-style')) {
  const style = document.createElement('style');
  style.id = 'infotech-credit-style';
  style.textContent = `
    .site-footer .credit{
      width:max-content;max-width:100%;margin:0;padding:10px 14px 10px 36px;position:relative;
      border:1px solid rgba(67,162,255,.42);border-radius:999px;
      background:linear-gradient(135deg,rgba(20,112,211,.22),rgba(7,35,72,.42));
      box-shadow:0 8px 28px rgba(18,104,201,.14),inset 0 1px 0 rgba(255,255,255,.07);
      color:#c8d9eb;font-size:12px;line-height:1.2;
    }
    .site-footer .credit:before{
      content:'✦';position:absolute;left:14px;top:50%;transform:translateY(-50%);
      color:#55adff;text-shadow:0 0 14px rgba(72,170,255,.7);font-size:13px;
    }
    .site-footer .credit a{color:#71bbff;text-decoration:none}
    .site-footer .credit a strong{color:#71bbff;letter-spacing:.01em}
    .site-footer .credit:hover{border-color:rgba(93,181,255,.72);box-shadow:0 10px 30px rgba(18,104,201,.22)}
    @media (max-width:900px){.site-footer .credit{justify-self:start}}
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
