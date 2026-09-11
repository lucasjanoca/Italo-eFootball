# Ítalo eFootball

Site responsivo do **Ítalo Football**, desenvolvido pela **InfoTech.io**.

## Estrutura

- `index.html` — página principal
- `videos.html` — melhores vídeos e acesso ao canal
- `curso.html` — apresentação e acesso ao curso
- `comunidade.html` — página da comunidade
- `grupos.html` — grupos oficiais do WhatsApp
- `contato.html` — redes e contato
- `styles.css` — base visual e responsividade
- `pages.css` — estilos das páginas internas
- `polish.css` — acabamento visual e ajustes mobile
- `site-config.js` — URLs e configurações centralizadas
- `script.js` — menu, animações, navegação e normalização de links
- `assets/` — imagens locais e fallbacks do projeto

## Links oficiais configurados

- YouTube: `https://youtube.com/@italoefootballives?si=0cd7d6id502UjSVx`
- Instagram: `https://www.instagram.com/italoefootball/`
- TikTok: `https://www.tiktok.com/@italoefootbal`
- Curso: configurado centralmente em `site-config.js`
- Comunidades: configuradas em `grupos.html`

Os links de vídeos individuais continuam apontando diretamente para cada vídeo no YouTube. Os links que representam o **canal** são normalizados pelo `script.js` para sempre abrir o canal oficial configurado em `site-config.js`.

## Publicação

O projeto é estático e compatível com GitHub Pages. A publicação usa a branch `main` a partir da raiz do repositório.
