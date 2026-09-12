/* Home: navegação e carrossel infinito real. */
(() => {
  document.querySelectorAll('a[href]').forEach(link => {
    const label=(link.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(label==='entrar na comunidade'){link.href='comunidade.html';link.removeAttribute('target');link.removeAttribute('rel');}
  });

  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-video-carousel]').forEach(carousel=>{
    const viewport=carousel.querySelector('.r-video-viewport');
    const track=carousel.querySelector('.r-video-track');
    const originals=[...carousel.querySelectorAll('[data-slide]')];
    const prev=carousel.querySelector('[data-carousel-prev]');
    const next=carousel.querySelector('[data-carousel-next]');
    if(!viewport||!track||originals.length<2)return;

    originals.forEach((slide,index)=>{slide.dataset.realIndex=String(index);slide.dataset.carouselCopy='original';});
    const makeClone=(slide,position)=>{const clone=slide.cloneNode(true);clone.dataset.carouselCopy=position;clone.dataset.realIndex=slide.dataset.realIndex;clone.removeAttribute('data-slide');clone.setAttribute('aria-hidden','true');clone.tabIndex=-1;clone.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(el=>el.tabIndex=-1);return clone;};
    const before=originals.map(s=>makeClone(s,'before'));
    const after=originals.map(s=>makeClone(s,'after'));
    before.reverse().forEach(clone=>track.prepend(clone));
    after.forEach(clone=>track.append(clone));

    let all=[...track.children];
    let activeReal=Math.min(1,originals.length-1);
    let scrollTimer=0,resizeTimer=0,raf=0,normalizing=false;
    let pointerDown=false,pointerStartX=0,pointerStartScroll=0,pointerMoved=false;

    const middleStart=originals.length;
    const middleAt=real=>all[middleStart+((real+originals.length)%originals.length)];
    const centerLeft=el=>el.offsetLeft-(viewport.clientWidth-el.clientWidth)/2;
    const groupWidth=()=>{
      const first=all[middleStart],afterFirst=all[middleStart+originals.length];
      return first&&afterFirst?afterFirst.offsetLeft-first.offsetLeft:0;
    };
    const setActive=real=>{
      activeReal=(real+originals.length)%originals.length;
      all.forEach(el=>el.classList.toggle('is-active',Number(el.dataset.realIndex)===activeReal));
      carousel.dataset.active=String(activeReal);
    };
    const nearestIndex=()=>{
      const center=viewport.scrollLeft+viewport.clientWidth/2;let best=middleStart,distance=Infinity;
      all.forEach((slide,index)=>{const d=Math.abs((slide.offsetLeft+slide.clientWidth/2)-center);if(d<distance){distance=d;best=index;}});return best;
    };
    const centerElement=(el,smooth=true)=>{if(!el)return;viewport.scrollTo({left:centerLeft(el),behavior:smooth&&!reduceMotion?'smooth':'auto'});setActive(Number(el.dataset.realIndex)||0);};
    const normalizePosition=()=>{
      if(normalizing)return;const width=groupWidth();if(!width)return;
      const middleFirst=all[middleStart],middleLast=all[middleStart+originals.length-1];if(!middleFirst||!middleLast)return;
      const center=viewport.scrollLeft+viewport.clientWidth/2;
      const firstCenter=middleFirst.offsetLeft+middleFirst.clientWidth/2;
      const lastCenter=middleLast.offsetLeft+middleLast.clientWidth/2;
      let shift=0;
      if(center<firstCenter)shift=width;else if(center>lastCenter)shift=-width;
      if(shift){normalizing=true;viewport.scrollTo({left:viewport.scrollLeft+shift,behavior:'auto'});requestAnimationFrame(()=>{normalizing=false;setActive(Number(all[nearestIndex()]?.dataset.realIndex)||0);});}
    };
    const step=direction=>{
      const index=nearestIndex();const target=all[Math.max(0,Math.min(all.length-1,index+direction))];centerElement(target,true);
    };

    viewport.addEventListener('scroll',()=>{
      cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const near=all[nearestIndex()];if(near)setActive(Number(near.dataset.realIndex)||0);});
      clearTimeout(scrollTimer);scrollTimer=setTimeout(normalizePosition,110);
    },{passive:true});

    viewport.addEventListener('keydown',event=>{
      if(event.key==='ArrowRight'){event.preventDefault();step(1);}else if(event.key==='ArrowLeft'){event.preventDefault();step(-1);}else if(event.key==='Home'){event.preventDefault();centerElement(middleAt(0),true);}else if(event.key==='End'){event.preventDefault();centerElement(middleAt(originals.length-1),true);}
    });
    prev?.addEventListener('click',()=>step(-1));next?.addEventListener('click',()=>step(1));

    viewport.addEventListener('pointerdown',event=>{
      if(event.pointerType!=='mouse'||event.button!==0)return;pointerDown=true;pointerMoved=false;pointerStartX=event.clientX;pointerStartScroll=viewport.scrollLeft;viewport.classList.add('is-dragging');viewport.setPointerCapture?.(event.pointerId);
    });
    viewport.addEventListener('pointermove',event=>{if(!pointerDown)return;const delta=event.clientX-pointerStartX;if(Math.abs(delta)>5)pointerMoved=true;viewport.scrollLeft=pointerStartScroll-delta;});
    const endPointer=event=>{if(!pointerDown)return;pointerDown=false;viewport.classList.remove('is-dragging');try{viewport.releasePointerCapture?.(event.pointerId);}catch{}clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{const target=all[nearestIndex()];centerElement(target,true);setTimeout(normalizePosition,220);},30);};
    viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);viewport.addEventListener('mouseleave',event=>{if(pointerDown)endPointer(event);});
    viewport.addEventListener('click',event=>{if(pointerMoved){event.preventDefault();event.stopPropagation();pointerMoved=false;}},true);

    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{all=[...track.children];centerElement(middleAt(activeReal),false);},120);},{passive:true});

    requestAnimationFrame(()=>requestAnimationFrame(()=>centerElement(middleAt(activeReal),false)));
  });
})();
