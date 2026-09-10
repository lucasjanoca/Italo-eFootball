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

const modal = document.querySelector('.video-modal');
const modalCard = document.querySelector('.video-modal-card');
const modalTitle = document.querySelector('#modal-title');
const modalClose = document.querySelector('.modal-close');
let lastFocused = null;

function closeModal() {
  if (!modal) return;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  lastFocused?.focus?.();
}

function openModal(title, trigger) {
  if (!modal) return;
  lastFocused = trigger || document.activeElement;
  if (modalTitle) modalTitle.textContent = title || 'Vídeo';
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';
  requestAnimationFrame(() => modalClose?.focus());
}

document.querySelectorAll('[data-video]').forEach(button => {
  button.addEventListener('click', () => openModal(button.dataset.video, button));
});

document.querySelector('.modal-close')?.addEventListener('click', closeModal);
document.querySelector('.modal-ok')?.addEventListener('click', closeModal);
modal?.addEventListener('click', event => { if (event.target === modal) closeModal(); });

document.addEventListener('keydown', event => {
  if (event.key === 'Escape') {
    closeModal();
    setMenu(false);
  }
  if (event.key === 'Tab' && modal?.classList.contains('open') && modalCard) {
    const focusables = [...modalCard.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')]
      .filter(el => !el.hasAttribute('disabled'));
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
});

const toast = document.querySelector('.toast');
let toastTimer;
function showToast(message) {
  if (!toast || !message) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}
document.querySelectorAll('[data-toast]').forEach(el => {
  el.addEventListener('click', () => showToast(el.dataset.toast));
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

const navLinks = [...document.querySelectorAll('.desktop-nav a')];
const targets = navLinks
  .map(link => document.querySelector(link.getAttribute('href')))
  .filter(Boolean);

function updateActiveNav() {
  let current = 'inicio';
  const probe = window.scrollY + 180;
  targets.forEach(target => {
    if (probe >= target.offsetTop) current = target.id;
  });
  navLinks.forEach(link => {
    const active = link.getAttribute('href') === `#${current}`;
    link.classList.toggle('active', active);
    if (active) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  });
}

updateActiveNav();
window.addEventListener('scroll', updateActiveNav, { passive: true });
window.addEventListener('resize', () => {
  if (window.innerWidth > 760) setMenu(false);
  updateActiveNav();
}, { passive: true });

document.querySelector('#year').textContent = new Date().getFullYear();
