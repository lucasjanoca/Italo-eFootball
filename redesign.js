/* Ajustes exclusivos da nova Home, executados depois do script global. */
document.querySelectorAll('a[href]').forEach(link=>{
  const label=(link.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
  if(label==='entrar na comunidade'){
    link.href='comunidade.html';
    link.removeAttribute('target');
    link.removeAttribute('rel');
  }
});