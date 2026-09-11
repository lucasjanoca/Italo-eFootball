/* Ajustes exclusivos da nova Home, executados depois do script global. */
(() => {
  /* Carrega por último a camada das artes geradas, sem mexer nas folhas existentes. */
  if (!document.querySelector('link[data-generated-assets]')) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'generated-assets.css';
    link.dataset.generatedAssets = 'true';
    document.head.appendChild(link);
  }

  document.querySelectorAll('a[href]').forEach(link=>{
    const label=(link.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
    if(label==='entrar na comunidade'){
      link.href='comunidade.html';
      link.removeAttribute('target');
      link.removeAttribute('rel');
    }
  });

  /* Carrossel infinito: mantém 3 cartões visíveis, swipe, dots e destaque central. */
  document.querySelectorAll('[data-video-carousel]').forEach(carousel=>{
    const viewport=carousel.querySelector('.r-video-viewport');
    const track=carousel.querySelector('.r-video-track');
    const originals=[...carousel.querySelectorAll('[data-slide]')];
    const dots=[...carousel.querySelectorAll('[data-dot]')];
    if(!viewport||!track||originals.length<3)return;

    const originalCount=originals.length;
    const cloneCount=Math.min(2, originalCount);

    /* Evita clonar duas vezes caso o script seja reexecutado. */
    if(!track.dataset.loopReady){
      const before=originals.slice(-cloneCount).map((slide,index)=>{
        const clone=slide.cloneNode(true);
        clone.removeAttribute('data-slide');
        clone.dataset.loopIndex=String(originalCount-cloneCount+index);
        return clone;
      });
      const after=originals.slice(0,cloneCount).map((slide,index)=>{
        const clone=slide.cloneNode(true);
        clone.removeAttribute('data-slide');
        clone.dataset.loopIndex=String(index);
        return clone;
      });
      originals.forEach((slide,index)=>slide.dataset.loopIndex=String(index));
      before.reverse().forEach(clone=>track.prepend(clone));
      after.forEach(clone=>track.append(clone));
      track.dataset.loopReady='true';
    }

    let slides=[...track.querySelectorAll('.r-video-slide')];
    let activeOriginal=1 % originalCount;
    let raf=0;
    let settleTimer=0;
    let jumping=false;

    const visualIndexForOriginal=index=>cloneCount+index;
    const normalize=index=>((index%originalCount)+originalCount)%originalCount;

    const setActive=originalIndex=>{
      activeOriginal=normalize(originalIndex);
      slides.forEach(slide=>{
        const idx=Number(slide.dataset.loopIndex);
        slide.classList.toggle('is-active',idx===activeOriginal);
      });
      dots.forEach((dot,i)=>{
        const on=i===activeOriginal%dots.length;
        dot.classList.toggle('is-active',on);
        dot.setAttribute('aria-current',on?'true':'false');
      });
    };

    const scrollToVisual=(visualIndex,smooth=true)=>{
      slides=[...track.querySelectorAll('.r-video-slide')];
      const slide=slides[visualIndex];
      if(!slide)return;
      const left=slide.offsetLeft-(viewport.clientWidth-slide.clientWidth)/2;
      viewport.scrollTo({left:Math.max(0,left),behavior:smooth?'smooth':'auto'});
      setActive(Number(slide.dataset.loopIndex)||0);
    };

    const centerOriginal=(originalIndex,smooth=true)=>{
      const normalized=normalize(originalIndex);
      scrollToVisual(visualIndexForOriginal(normalized),smooth);
    };

    const nearestVisual=()=>{
      const center=viewport.scrollLeft+viewport.clientWidth/2;
      let best=0,bestDistance=Infinity;
      slides.forEach((slide,i)=>{
        const slideCenter=slide.offsetLeft+slide.clientWidth/2;
        const distance=Math.abs(slideCenter-center);
        if(distance<bestDistance){bestDistance=distance;best=i;}
      });
      return best;
    };

    const settleLoop=()=>{
      if(jumping)return;
      const visual=nearestVisual();
      const slide=slides[visual];
      if(!slide)return;
      setActive(Number(slide.dataset.loopIndex)||0);

      /* Se chegou nos clones das pontas, volta para a cópia equivalente sem animação. */
      if(visual<cloneCount || visual>=cloneCount+originalCount){
        jumping=true;
        const originalIndex=Number(slide.dataset.loopIndex)||0;
        requestAnimationFrame(()=>{
          scrollToVisual(visualIndexForOriginal(originalIndex),false);
          requestAnimationFrame(()=>{jumping=false;});
        });
      }
    };

    viewport.addEventListener('scroll',()=>{
      cancelAnimationFrame(raf);
      raf=requestAnimationFrame(()=>{
        const visual=nearestVisual();
        const slide=slides[visual];
        if(slide)setActive(Number(slide.dataset.loopIndex)||0);
      });
      clearTimeout(settleTimer);
      settleTimer=setTimeout(settleLoop,120);
    },{passive:true});

    dots.forEach((dot,i)=>dot.addEventListener('click',()=>centerOriginal(i,true)));

    viewport.addEventListener('keydown',event=>{
      if(event.key==='ArrowRight'){
        event.preventDefault();
        centerOriginal(activeOriginal+1,true);
      }
      if(event.key==='ArrowLeft'){
        event.preventDefault();
        centerOriginal(activeOriginal-1,true);
      }
    });

    /* Roda do mouse/trackpad também navega e nunca trava na última imagem. */
    viewport.addEventListener('wheel',event=>{
      if(Math.abs(event.deltaY)<=Math.abs(event.deltaX))return;
      event.preventDefault();
      centerOriginal(activeOriginal+(event.deltaY>0?1:-1),true);
    },{passive:false});

    window.addEventListener('resize',()=>centerOriginal(activeOriginal,false),{passive:true});
    requestAnimationFrame(()=>centerOriginal(activeOriginal,false));
  });
})();
