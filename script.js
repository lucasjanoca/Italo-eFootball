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

const youtubeChannelUrl = 'https://www.youtube.com/channel/UC972onsIyHgDN0VC2u4W3zA';
const oldYoutubeChannelId = 'UCaThC5oHN4mG59Ya8WGQLmQ';

document.querySelectorAll('a').forEach(link => {
  const label = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
  if (label.includes('entrar na comunidade')) {
    link.href = 'grupos.html';
    link.removeAttribute('target');
    link.removeAttribute('rel');
  }

  const href = link.getAttribute('href') || '';
  const isOldChannelLink = href.includes(`youtube.com/channel/${oldYoutubeChannelId}`);
  const isHandleChannelLink = href.includes('youtube.com/@italoefootball');

  if (isOldChannelLink || isHandleChannelLink) {
    link.href = youtubeChannelUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
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
