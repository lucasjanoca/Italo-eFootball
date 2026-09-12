(() => {
  const client=window.ITALO_SUPABASE;if(!client)return;
  const $=(s,r=document)=>r.querySelector(s),host=$('[data-video-grid]'),state=$('[data-video-state]'),search=$('[data-video-search]');
  if(!host)return;
  let videos=[];
  const metadata=new Map(),pending=new Map();
  const setState=(t,k='')=>{if(!state)return;state.textContent=t;state.dataset.state=k;state.hidden=!t};
  const norm=v=>String(v||'').toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[\u0300-\u036f]/g,'');

  function requestMetadata(id){
    if(metadata.has(id))return Promise.resolve(metadata.get(id));
    if(pending.has(id))return pending.get(id);
    const task=fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}&format=json`,{credentials:'omit'})
      .then(r=>r.ok?r.json():null).then(data=>{metadata.set(id,data||null);pending.delete(id);return data||null})
      .catch(()=>{metadata.set(id,null);pending.delete(id);return null});
    pending.set(id,task);return task;
  }

  function card(v){
    const a=document.createElement('a');a.className='video-real-card';a.href=`https://www.youtube.com/watch?v=${encodeURIComponent(v.video_id)}`;a.target='_blank';a.rel='noopener noreferrer';a.dataset.videoId=v.video_id;
    const media=document.createElement('div');media.className='video-real-thumb';const img=document.createElement('img');img.src=`https://i.ytimg.com/vi/${v.video_id}/maxresdefault.jpg`;img.alt=v.title;img.loading='lazy';img.decoding='async';img.width=1280;img.height=720;img.onerror=()=>{img.onerror=null;img.src=`https://i.ytimg.com/vi/${v.video_id}/hqdefault.jpg`};const play=document.createElement('span');play.className='video-real-play';play.textContent='▶';media.append(img,play);
    const copy=document.createElement('div');copy.className='video-real-copy';const source=document.createElement('span');source.className='video-real-source';source.textContent='YouTube';const title=document.createElement('strong');const cached=metadata.get(v.video_id);title.textContent=cached?.title||v.title;const meta=document.createElement('small');meta.textContent=cached?.author_name?`Canal: ${cached.author_name}`:'Abrir vídeo no canal';copy.append(source,title,meta);a.append(media,copy);
    if(!metadata.has(v.video_id))requestMetadata(v.video_id).then(data=>{if(!a.isConnected||!data)return;if(data.title){title.textContent=data.title;img.alt=data.title}if(data.author_name)meta.textContent=`Canal: ${data.author_name}`});
    return a;
  }
  function render(){
    const q=norm(search?.value),rows=videos.filter(v=>!q||norm(`${v.title} ${metadata.get(v.video_id)?.title||''}`).includes(q));host.replaceChildren();
    if(!rows.length){setState('Nenhum vídeo corresponde à busca.','empty');return}
    setState(`${rows.length} vídeo${rows.length===1?'':'s'} na seleção.`,'success');rows.forEach(v=>host.append(card(v)));
  }
  async function init(){
    setState('Carregando vídeos…','loading');const r=await client.from('italo_videos').select('video_id,title,channel_url,featured,sort_order').eq('is_active',true).order('sort_order');
    if(r.error){setState('Não foi possível carregar a seleção de vídeos.','error');return}
    videos=r.data||[];render();videos.forEach(v=>requestMetadata(v.video_id));search?.addEventListener('input',render);
  }
  init();
})();