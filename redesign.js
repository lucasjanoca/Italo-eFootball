/* Ajustes exclusivos da nova Home, executados depois do script global. */
document.querySelectorAll('a[href]').forEach(link=>{
  const label=(link.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
  if(label==='entrar na comunidade'){
    link.href='comunidade.html';
    link.removeAttribute('target');
    link.removeAttribute('rel');
  }
});

/* Carrossel dos melhores vídeos: swipe no celular, dots e destaque central. */
document.querySelectorAll('[data-video-carousel]').forEach(carousel=>{
  const viewport=carousel.querySelector('.r-video-viewport');
  const slides=[...carousel.querySelectorAll('[data-slide]')];
  const dots=[...carousel.querySelectorAll('[data-dot]')];
  if(!viewport||!slides.length)return;

  let active=Math.min(1,slides.length-1);
  let raf=0;

  const centerSlide=(index,smooth=true)=>{
    index=Math.max(0,Math.min(index,slides.length-1));
    const slide=slides[index];
    const left=slide.offsetLeft-(viewport.clientWidth-slide.clientWidth)/2;
    viewport.scrollTo({left:Math.max(0,left),behavior:smooth?'smooth':'auto'});
    setActive(index);
  };

  const setActive=index=>{
    active=index;
    slides.forEach((slide,i)=>slide.classList.toggle('is-active',i===index));
    dots.forEach((dot,i)=>{
      dot.classList.toggle('is-active',i===index);
      dot.setAttribute('aria-current',i===index?'true':'false');
    });
  };

  const nearestSlide=()=>{
    const center=viewport.scrollLeft+viewport.clientWidth/2;
    let best=0,bestDistance=Infinity;
    slides.forEach((slide,i)=>{
      const slideCenter=slide.offsetLeft+slide.clientWidth/2;
      const distance=Math.abs(slideCenter-center);
      if(distance<bestDistance){bestDistance=distance;best=i;}
    });
    setActive(best);
  };

  viewport.addEventListener('scroll',()=>{
    cancelAnimationFrame(raf);
    raf=requestAnimationFrame(nearestSlide);
  },{passive:true});

  dots.forEach((dot,i)=>dot.addEventListener('click',()=>centerSlide(i)));

  viewport.addEventListener('keydown',event=>{
    if(event.key==='ArrowRight'){event.preventDefault();centerSlide(active+1);}
    if(event.key==='ArrowLeft'){event.preventDefault();centerSlide(active-1);}
  });

  window.addEventListener('resize',()=>centerSlide(active,false),{passive:true});

  requestAnimationFrame(()=>centerSlide(active,false));
});