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

document.querySelectorAll('[data-course-link]').forEach(link => {
  const url = window.ITALO_SITE_CONFIG?.courseUrl;
  if (url) link.href = url;
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
