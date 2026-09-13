/* Home: navegação e carrossel infinito contínuo, sem rewind visível. */
(()=>{
  document.querySelectorAll('a[href]').forEach(link=>{
    const label=(link.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(label==='entrar na comunidade'){link.href='comunidade.html';link.removeAttribute('target');link.removeAttribute('rel')}
  });

  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.querySelectorAll('[data-video-carousel]').forEach(carousel=>{
    const viewport=carousel.querySelector('.r-video-viewport');
    const track=carousel.querySelector('.r-video-track');
    const originals=[...track.querySelectorAll('[data-slide]')];
    const prev=carousel.closest('.r-video-carousel-shell')?.querySelector('[data-carousel-prev]')||carousel.querySelector('[data-carousel-prev]');
    const next=carousel.closest('.r-video-carousel-shell')?.querySelector('[data-carousel-next]')||carousel.querySelector('[data-carousel-next]');
    if(!viewport||!track||originals.length<2)return;

    const count=originals.length;
    originals.forEach((slide,index)=>{slide.dataset.realIndex=String(index);slide.dataset.carouselCopy='middle'});
    const clone=(slide,where)=>{const x=slide.cloneNode(true);x.removeAttribute('data-slide');x.dataset.realIndex=slide.dataset.realIndex;x.dataset.carouselCopy=where;x.setAttribute('aria-hidden','true');x.tabIndex=-1;x.querySelectorAll('a,button,input,select,textarea,[tabindex]').forEach(el=>el.tabIndex=-1);return x};
    const before=document.createDocumentFragment(),after=document.createDocumentFragment();
    originals.forEach(slide=>before.append(clone(slide,'before')));
    originals.forEach(slide=>after.append(clone(slide,'after')));
    track.prepend(before);track.append(after);

    let slides=[...track.children],activeReal=Math.min(1,count-1),scrollTimer=0,resizeTimer=0,raf=0,pointerDown=false,pointerMoved=false,startX=0,startScroll=0,normalizing=false;
    const centerLeft=el=>el.offsetLeft-(viewport.clientWidth-el.clientWidth)/2;
    const middleIndex=real=>count+((real%count)+count)%count;
    const nearestIndex=()=>{const center=viewport.scrollLeft+viewport.clientWidth/2;let best=0,bestDistance=Infinity;slides.forEach((slide,index)=>{const d=Math.abs(slide.offsetLeft+slide.clientWidth/2-center);if(d<bestDistance){bestDistance=d;best=index}});return best};
    const setActive=real=>{activeReal=((Number(real)||0)%count+count)%count;slides.forEach((slide,index)=>slide.classList.toggle('is-active',index>=count&&index<2*count&&Number(slide.dataset.realIndex)===activeReal));carousel.dataset.active=String(activeReal)};
    const jumpToIndex=index=>{const el=slides[index];if(!el)return;normalizing=true;const oldBehavior=viewport.style.scrollBehavior,oldSnap=viewport.style.scrollSnapType;viewport.style.scrollBehavior='auto';viewport.style.scrollSnapType='none';viewport.scrollLeft=centerLeft(el);setActive(el.dataset.realIndex);requestAnimationFrame(()=>{viewport.style.scrollBehavior=oldBehavior;viewport.style.scrollSnapType=oldSnap;normalizing=false})};
    const normalize=()=>{if(pointerDown||normalizing)return;let index=nearestIndex();if(index<count)index+=count;else if(index>=2*count)index-=count;if(index!==nearestIndex())jumpToIndex(index);else setActive(slides[index]?.dataset.realIndex)};
    const settle=()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(normalize,220)};
    const smoothTo=index=>{const el=slides[index];if(!el)return;setActive(el.dataset.realIndex);viewport.scrollTo({left:centerLeft(el),behavior:reduceMotion?'auto':'smooth'});settle()};
    const step=direction=>{const index=nearestIndex(),target=Math.max(0,Math.min(slides.length-1,index+direction));smoothTo(target)};

    viewport.addEventListener('scroll',()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{const near=slides[nearestIndex()];if(near)setActive(near.dataset.realIndex)});if(!('onscrollend' in viewport))settle()},{passive:true});
    if('onscrollend' in viewport)viewport.addEventListener('scrollend',normalize,{passive:true});

    prev?.addEventListener('click',()=>step(-1));next?.addEventListener('click',()=>step(1));
    viewport.addEventListener('keydown',event=>{if(event.key==='ArrowRight'){event.preventDefault();step(1)}else if(event.key==='ArrowLeft'){event.preventDefault();step(-1)}else if(event.key==='Home'){event.preventDefault();smoothTo(middleIndex(0))}else if(event.key==='End'){event.preventDefault();smoothTo(middleIndex(count-1))}});

    viewport.addEventListener('pointerdown',event=>{if(event.pointerType!=='mouse'||event.button!==0)return;pointerDown=true;pointerMoved=false;startX=event.clientX;startScroll=viewport.scrollLeft;viewport.classList.add('is-dragging');viewport.setPointerCapture?.(event.pointerId)});
    viewport.addEventListener('pointermove',event=>{if(!pointerDown)return;const delta=event.clientX-startX;if(Math.abs(delta)>5)pointerMoved=true;viewport.scrollLeft=startScroll-delta});
    const endPointer=event=>{if(!pointerDown)return;pointerDown=false;viewport.classList.remove('is-dragging');try{viewport.releasePointerCapture?.(event.pointerId)}catch{}const target=nearestIndex();smoothTo(target)};
    viewport.addEventListener('pointerup',endPointer);viewport.addEventListener('pointercancel',endPointer);viewport.addEventListener('mouseleave',event=>{if(pointerDown)endPointer(event)});
    viewport.addEventListener('click',event=>{if(pointerMoved){event.preventDefault();event.stopPropagation();pointerMoved=false}},true);

    window.addEventListener('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{slides=[...track.children];jumpToIndex(middleIndex(activeReal))},140)},{passive:true});
    document.addEventListener('visibilitychange',()=>{if(!document.hidden)requestAnimationFrame(()=>jumpToIndex(middleIndex(activeReal)))});

    requestAnimationFrame(()=>requestAnimationFrame(()=>jumpToIndex(middleIndex(activeReal))));
  });
})();