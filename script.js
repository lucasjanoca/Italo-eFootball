const menuBtn=document.querySelector('.menu-btn');
const mobileMenu=document.querySelector('.mobile-menu');
function setMenu(open){if(!menuBtn||!mobileMenu)return;mobileMenu.classList.toggle('open',open);menuBtn.classList.toggle('open',open);menuBtn.setAttribute('aria-expanded',String(open));mobileMenu.setAttribute('aria-hidden',String(!open));document.body.classList.toggle('menu-open',open)}
if(menuBtn&&mobileMenu){menuBtn.addEventListener('click',()=>setMenu(!mobileMenu.classList.contains('open')));mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>setMenu(false)));document.addEventListener('click',e=>{if(mobileMenu.classList.contains('open')&&!mobileMenu.contains(e.target)&&!menuBtn.contains(e.target))setMenu(false)})}
document.addEventListener('keydown',e=>{if(e.key==='Escape')setMenu(false)});
window.addEventListener('resize',()=>{if(innerWidth>760)setMenu(false)},{passive:true});

const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems=document.querySelectorAll('.reveal');
if('IntersectionObserver'in window&&!reduceMotion){const o=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');o.unobserve(e.target)}}),{threshold:.1,rootMargin:'0px 0px -24px'});revealItems.forEach(el=>o.observe(el))}else revealItems.forEach(el=>el.classList.add('visible'));
const year=document.querySelector('#year');if(year)year.textContent=new Date().getFullYear();

const config=window.ITALO_SITE_CONFIG||{};
const courseUrl=config.courseUrl||'https://pay.kiwify.com.br/yAdCPJy';
const youtubeChannelUrl=config.youtubeChannelUrl||'https://www.youtube.com/channel/UCaThC5oHN4mG59Ya8WGQLmQ';
document.querySelectorAll('[data-course-checkout]').forEach(a=>{a.href=courseUrl;a.target='_blank';a.rel='noopener noreferrer'});

document.querySelectorAll('.desktop-nav,.mobile-menu').forEach(nav=>{
  if(nav.querySelector('a[href="torneios.html"]'))return;
  const link=document.createElement('a');link.href='torneios.html';link.textContent='Torneios';
  if(/torneios\.html$/i.test(location.pathname))link.classList.add('active');
  const contact=[...nav.querySelectorAll('a')].find(a=>/contato\.html/.test(a.getAttribute('href')||''));
  contact?nav.insertBefore(link,contact):nav.append(link);
});

document.querySelectorAll('.desktop-nav a[href="curso.html"],.mobile-menu a[href="curso.html"]').forEach(a=>a.textContent='Cursos');

document.querySelectorAll('a[href]').forEach(link=>{
  const raw=link.getAttribute('href')||'';const label=(link.textContent||'').replace(/\s+/g,' ').trim().toLowerCase();
  if(label.includes('entrar na comunidade')){link.href='comunidade.html';const t=link.querySelector('.r-action-label');if(t)t.textContent='Abrir comunidade';}
  try{const url=new URL(raw,location.href);const host=url.hostname.replace(/^www\./,'').toLowerCase();const isVideo=host==='youtu.be'||(['youtube.com','m.youtube.com'].includes(host)&&(url.pathname==='/watch'||url.searchParams.has('v')||/^\/(shorts|live|embed)\//i.test(url.pathname)));if(['youtube.com','m.youtube.com'].includes(host)&&!isVideo){link.href=youtubeChannelUrl}const finalUrl=new URL(link.getAttribute('href'),location.href);if(/^https?:$/.test(finalUrl.protocol)&&finalUrl.origin!==location.origin){link.target='_blank';link.rel='noopener noreferrer'}}catch{}
});

const logo='assets/italo-football-logo.svg';
document.querySelectorAll('a.brand').forEach(brand=>{const footer=brand.classList.contains('brand-footer');brand.classList.add('brand-upgraded');brand.innerHTML=`<img class="brand-unified-logo${footer?' brand-unified-logo-footer':''}" src="${logo}" alt="Ítalo Football" decoding="async"${footer?' loading="lazy"':''}>`});

const infoLogo='https://infotech-io.com.br/assets/brand/logo.webp';
const plexoUrl='https://www.tiktok.com/@plexoplace?_r=1&_t=ZS-99E1bmV05YI';
document.querySelectorAll('.site-footer .credit').forEach(credit=>{
  const box=document.createElement('div');box.className='site-partners';box.setAttribute('aria-label','Desenvolvimento e Design');box.innerHTML=`
    <span class="site-partners-title">Desenvolvimento e Design</span>
    <a class="site-partner site-partner-info" href="https://infotech-io.com.br/" target="_blank" rel="noopener noreferrer" aria-label="Abrir site da InfoTech.io"><img src="${infoLogo}" alt="InfoTech.io" loading="lazy" decoding="async"><span><strong>InfoTech.io</strong><small>Desenvolvimento</small></span></a>
    <a class="site-partner site-partner-plexo" href="${plexoUrl}" target="_blank" rel="noopener noreferrer" aria-label="Abrir perfil da Plexo"><span class="site-plexo-brand" aria-hidden="true"><svg viewBox="0 0 100 100"><path d="M50 7 L62 37 L93 50 L62 63 L50 93 L38 63 L7 50 L38 37 Z" fill="none" stroke="currentColor" stroke-width="7" stroke-linejoin="round"/><path d="M50 42 L55 50 L50 58 L45 50 Z" fill="currentColor"/></svg><b>PLEXO</b></span><span><strong>Plexo</strong><small>Design</small></span></a>
    <span class="site-partners-bottom">InfoTech.io + Plexo</span>`;
  box.querySelector('img')?.addEventListener('error',e=>e.currentTarget.style.display='none',{once:true});credit.replaceWith(box)
});

if(!document.querySelector('#brand-partners-style')){const s=document.createElement('style');s.id='brand-partners-style';s.textContent=`
.brand.brand-upgraded{display:flex;align-items:center;width:auto;line-height:1}.brand-upgraded .brand-unified-logo{display:block;width:190px;height:auto;max-height:56px;object-fit:contain;object-position:left center}.brand-upgraded .brand-unified-logo-footer{width:172px;max-height:52px}.site-partners{grid-column:1/-1;width:min(100%,680px);margin:2px auto 22px;display:grid;grid-template-columns:1fr 1fr;gap:10px;align-items:stretch;justify-self:center}.site-partners-title{grid-column:1/-1;text-align:center;font-size:9px;letter-spacing:.19em;text-transform:uppercase;color:#75808d;font-weight:900}.site-partner{min-height:72px;border-radius:18px;display:flex;align-items:center;justify-content:center;gap:12px;padding:11px 15px;transition:.18s}.site-partner:hover{transform:translateY(-2px)}.site-partner>span:last-child{display:flex;flex-direction:column;line-height:1.1}.site-partner strong{font-size:13px;color:#fff}.site-partner small{margin-top:5px;color:#82909e;font-size:8px;text-transform:uppercase;font-weight:900;letter-spacing:.08em}.site-partner-info{background:#020712;border:1px solid rgba(120,218,255,.18)}.site-partner-info img{width:118px;height:42px;object-fit:contain}.site-partner-plexo{background:linear-gradient(145deg,#052636,#073e51);border:1px solid rgba(24,215,255,.28)}.site-plexo-brand{display:flex!important;align-items:center;gap:7px;color:#18d7ff}.site-plexo-brand svg{width:34px;height:34px}.site-plexo-brand b{font-size:13px;color:#fff;letter-spacing:.08em}.site-partners-bottom{grid-column:1/-1;text-align:center;color:#59636f;font-size:9px;letter-spacing:.12em;text-transform:uppercase}@media(max-width:760px){.brand-upgraded .brand-unified-logo{width:176px}.site-partners{grid-template-columns:1fr;width:min(100%,520px)}.site-partners-title,.site-partners-bottom{grid-column:1}.site-partner{min-height:64px}}
`;document.head.appendChild(s)}
