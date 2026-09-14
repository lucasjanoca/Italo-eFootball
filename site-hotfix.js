(()=>{
  'use strict';

  const normalizeRoleBadges=(root=document)=>{
    const badges=[];
    if(root?.nodeType===1&&root.matches?.('.role-badge.owner'))badges.push(root);
    root?.querySelectorAll?.('.role-badge.owner').forEach(el=>badges.push(el));
    badges.forEach(badge=>{
      badge.classList.remove('owner');
      badge.classList.add('admin');
      badge.textContent='ADM';
      badge.setAttribute('title','Administrador');
      badge.setAttribute('aria-label','Administrador');
    });
  };

  const startBadgeObserver=()=>{
    normalizeRoleBadges(document);
    const target=document.body||document.documentElement;
    if(!target)return;
    const observer=new MutationObserver(records=>{
      records.forEach(record=>record.addedNodes.forEach(node=>{
        if(node.nodeType===1)normalizeRoleBadges(node);
      }));
    });
    observer.observe(target,{childList:true,subtree:true});
  };

  const topicToast=(message,kind='info')=>{
    if(window.ITALO_SOCIAL?.toast)return window.ITALO_SOCIAL.toast(message,kind);
    const host=document.querySelector('[data-social-toast]');
    if(!host)return;
    host.textContent=message;
    host.dataset.kind=kind;
    host.classList.add('show');
    clearTimeout(host._hotfixTimer);
    host._hotfixTimer=setTimeout(()=>host.classList.remove('show'),2800);
  };

  const handleCreateTopic=async event=>{
    const button=event.target.closest?.('[data-create-topic]');
    if(!button)return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const social=window.ITALO_SOCIAL;
    const user=social?.state?.session?.user;
    if(!social?.client||!user){
      topicToast('Entre para criar um tópico.','error');
      return;
    }

    const raw=window.prompt('Nome do tópico:');
    if(raw===null)return;
    const title=raw.trim();
    if(title.length<3||title.length>100){
      topicToast('Use entre 3 e 100 caracteres.','error');
      return;
    }

    button.disabled=true;
    const originalLabel=button.textContent;
    button.textContent='Criando…';

    try{
      const result=await social.client.rpc('italo_create_topic',{
        topic_title:title,
        topic_category:'Comunidade'
      });
      if(result.error)throw result.error;

      topicToast('Tópico criado com sucesso.','success');
      location.hash='topics-title';
      setTimeout(()=>location.reload(),220);
    }catch(error){
      console.error('[Ítalo Football] Falha ao criar tópico:',error);
      topicToast('Não foi possível criar o tópico. Tente novamente.','error');
      button.disabled=false;
      button.textContent=originalLabel;
    }
  };

  const init=()=>{
    startBadgeObserver();
    document.addEventListener('click',handleCreateTopic,true);
  };

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})();
