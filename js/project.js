import {
  gsap, $, $$, reduceMotion, initTheme, initLenis, fontsReady, splitChars, revealLines,
  coverHTML, paintCovers, autoplayVideos, pad,
} from './common.js';
import { projects, profile } from './data.js';
import { createCursor } from './cursor.js';

const slug = new URLSearchParams(location.search).get('p');
const index = Math.max(0, projects.findIndex((p) => p.slug === slug));
const p = projects[index];
const next = projects[(index + 1) % projects.length];

document.title = `${p.title} — ${profile.firstName} ${profile.lastName}`;
$('meta[name="description"]').setAttribute('content', p.summary);
document.documentElement.style.setProperty('--project', p.color);

// 1 image : pleine largeur ; nombre pair : 2 colonnes ; impair : la première en grand
const galleryCols = (n) => (n === 1 ? 1 : n % 2 ? 3 : 2);
const isExternal = (url) => /^https?:/.test(url);
const media = (src) => `<button type="button" class="pj-media" data-zoom="${src}" data-cursor="Zoom"><img src="${src}" alt="" loading="lazy" decoding="async" /></button>`;
const video = (src) => `<video class="pj-video" src="${src}" controls playsinline preload="metadata"></video>`;

$('.pj').innerHTML = `
  <section class="pj-hero">
    <p class="pj-eyebrow mono"><span class="sq"></span>${pad(index + 1)} / ${pad(projects.length)} — ${p.category}</p>
    <h1 class="pj-title"><span class="js-split">${p.title}</span></h1>
    <div class="pj-meta">
      <dl class="pj-meta__list mono">
        <div><dt>Année</dt><dd>${p.year}</dd></div>
        <div><dt>Type</dt><dd>${p.kind}</dd></div>
        <div><dt>Stack</dt><dd>${p.tags.join(', ')}</dd></div>
        ${p.status ? `<div><dt>Statut</dt><dd class="pj-status">${p.status}</dd></div>` : ''}
      </dl>
      ${p.links.length ? `<div class="pj-links">${p.links.map((l) => `
        <a class="btn${isExternal(l.url) ? '' : ' btn--ghost'}" href="${l.url}" ${isExternal(l.url) || l.url.endsWith('.pdf') ? 'target="_blank" rel="noopener"' : ''} data-magnetic>${l.label} ↗</a>`).join('')}
      </div>` : ''}
    </div>
  </section>

  <figure class="pj-cover">${coverHTML(p, index, { eager: true })}</figure>

  <section class="pj-intro">
    <div class="section-label mono"><span>[01]</span> Le projet</div>
    <div class="pj-intro__body">
      <p class="pj-summary js-lines">${p.summary}</p>
      ${p.intro.map((t) => `<p class="pj-text">${t}</p>`).join('')}
    </div>
    <ul class="pj-facts mono">
      ${p.facts.map(([k, v]) => `<li><span>${k}</span>${v}</li>`).join('')}
    </ul>
  </section>

  ${p.sections.map((s, i) => `
  <section class="pj-section">
    <div class="pj-section__head">
      <span class="mono pj-section__num">${pad(i + 2)}</span>
      <h2 class="pj-section__title js-lines">${s.title}</h2>
      ${s.text ? `<p class="pj-text">${s.text}</p>` : ''}
    </div>
    ${s.images?.length ? `<div class="pj-gallery pj-gallery--${galleryCols(s.images.length)}">${s.images.map(media).join('')}</div>` : ''}
    ${s.videos?.length ? `<div class="pj-gallery pj-gallery--${galleryCols(s.videos.length)}">${s.videos.map(video).join('')}</div>` : ''}
  </section>`).join('')}

  <a class="pj-next" href="projet.html?p=${next.slug}" data-cursor="Suivant">
    <span class="mono">Projet suivant</span>
    <span class="pj-next__title">${next.title}</span>
    <span class="pj-next__kind mono">${next.kind} — ${next.year}</span>
  </a>

  <footer class="footer mono pj-footer">
    <span>© 2026 ${profile.firstName} ${profile.lastName}</span>
    <a href="mailto:${profile.email}">${profile.email}</a>
    <a href="index.html">Accueil ↑</a>
  </footer>`;

paintCovers(projects);
autoplayVideos($('.pj-cover'));
initTheme();
const lenis = initLenis();
createCursor(gsap);

/* Lightbox */
const box = $('.lightbox');
const boxImg = $('img', box);
const close = () => { box.hidden = true; lenis?.start(); };
$$('[data-zoom]').forEach((b) => b.addEventListener('click', () => {
  boxImg.src = b.dataset.zoom;
  box.hidden = false;
  lenis?.stop();
  $('.lightbox__close').focus();
  if (!reduceMotion) gsap.fromTo(boxImg, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.5, ease: 'expo.out' });
}));
box.addEventListener('click', close);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !box.hidden) close(); });

/* Transition : rideau à la couleur du projet suivant */
$('.pj-next').addEventListener('click', (e) => {
  if (reduceMotion || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  const href = e.currentTarget.href;
  const curtain = $('.curtain');
  curtain.style.background = next.color;
  gsap.fromTo(curtain, { yPercent: 100 }, { yPercent: 0, duration: 0.8, ease: 'expo.inOut', onComplete: () => { location.href = href; } });
});

(async () => {
  await fontsReady();
  revealLines();
  if (reduceMotion) return;
  const chars = splitChars($('.pj-hero'));
  const tl = gsap.timeline();
  tl.fromTo('.curtain', { yPercent: 0, background: p.color }, { yPercent: -100, duration: 1, ease: 'expo.inOut' })
    .from(chars, { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.025 }, '-=0.5')
    .from('.pj-eyebrow, .pj-meta', { y: 20, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.1 }, '-=1')
    .from('.pj-cover', { clipPath: 'inset(100% 0 0 0)', duration: 1.4, ease: 'expo.inOut' }, '-=1.1');
  $$('.pj-gallery > *').forEach((el) => gsap.from(el, {
    y: 60, opacity: 0, duration: 1.1, ease: 'expo.out',
    scrollTrigger: { trigger: el, start: 'top 92%' },
  }));
  gsap.from('.pj-facts li', {
    y: 20, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.06,
    scrollTrigger: { trigger: '.pj-facts', start: 'top 88%' },
  });
})();
