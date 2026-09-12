/* Ajustes exclusivos da Home. */
(() => {
  document.querySelectorAll('a[href]').forEach(link => {
    const label = (link.textContent || '').replace(/\s+/g,' ').trim().toLowerCase();
    if (label === 'entrar na comunidade') {
      link.href = 'comunidade.html';
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  });

  document.querySelectorAll('[data-video-carousel]').forEach(carousel => {
    const viewport = carousel.querySelector('.r-video-viewport');
    const slides = [...carousel.querySelectorAll('[data-slide]')];
    const dotWrap = carousel.querySelector('.r-video-dots');
    if (!viewport || slides.length < 2) return;

    let active = Math.min(1, slides.length - 1);
    let raf = 0;
    let resizeTimer = 0;

    const normalize = index => (index + slides.length) % slides.length;

    if (dotWrap) {
      dotWrap.replaceChildren();
      slides.forEach((_, index) => {
        const dot = document.createElement('button');
        dot.className = 'r-video-dot';
        dot.type = 'button';
        dot.dataset.dot = String(index);
        dot.setAttribute('aria-label', `Ir para o vídeo ${index + 1}`);
        dot.addEventListener('click', () => center(index, true));
        dotWrap.appendChild(dot);
      });
    }

    const dots = dotWrap ? [...dotWrap.querySelectorAll('.r-video-dot')] : [];

    const setActive = index => {
      active = normalize(index);
      slides.forEach((slide, i) => slide.classList.toggle('is-active', i === active));
      dots.forEach((dot, i) => {
        const current = i === active;
        dot.classList.toggle('is-active', current);
        if (current) dot.setAttribute('aria-current', 'true');
        else dot.removeAttribute('aria-current');
      });
    };

    const center = (index, smooth = true) => {
      const normalized = normalize(index);
      const slide = slides[normalized];
      if (!slide) return;
      const left = slide.offsetLeft - (viewport.clientWidth - slide.clientWidth) / 2;
      viewport.scrollTo({
        left: Math.max(0, left),
        behavior: smooth && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'smooth' : 'auto'
      });
      setActive(normalized);
    };

    const nearest = () => {
      const centerPoint = viewport.scrollLeft + viewport.clientWidth / 2;
      let best = 0;
      let distance = Infinity;
      slides.forEach((slide, index) => {
        const slideCenter = slide.offsetLeft + slide.clientWidth / 2;
        const nextDistance = Math.abs(slideCenter - centerPoint);
        if (nextDistance < distance) {
          distance = nextDistance;
          best = index;
        }
      });
      return best;
    };

    viewport.addEventListener('scroll', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setActive(nearest()));
    }, { passive:true });

    viewport.addEventListener('keydown', event => {
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        center(active + 1, true);
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        center(active - 1, true);
      } else if (event.key === 'Home') {
        event.preventDefault();
        center(0, true);
      } else if (event.key === 'End') {
        event.preventDefault();
        center(slides.length - 1, true);
      }
    });

    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => center(active, false), 100);
    }, { passive:true });

    requestAnimationFrame(() => center(active, false));
  });
})();
