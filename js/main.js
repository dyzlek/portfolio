import {
  gsap, ScrollTrigger, SplitText, $, $$, reduceMotion, DEV,
  initTheme, initLenis, fontsReady, splitChars, revealLines, coverHTML, paintCovers, autoplayVideos, pad,
} from './common.js';
import { profile, projects, layers, marquee } from './data.js';
import { createScene } from './scene.js';
import { createLab } from './lab.js';
import { createCursor } from './cursor.js';

const isDesktop = () => window.matchMedia('(min-width: 768px)').matches;
const featured = projects.filter((p) => p.featured);

/* ---------------- Contenu depuis data.js ---------------- */

$('.layers').innerHTML = layers.map((l, i) => `
  <li class="layer">
    <span class="layer__num mono">0${i + 1}</span>
    <h3 class="layer__name">${l.name}</h3>
    <p class="layer__text">${l.text}</p>
    <ul class="layer__tags">${l.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
  </li>`).join('');

$$('.marquee__inner').forEach((row, r) => {
  const words = r ? [...marquee].reverse() : marquee;
  const html = words.map((w) => `<span>${w}</span>`).join('');
  row.innerHTML = html + html; // doublé pour la boucle infinie
});

$('.work__track').insertAdjacentHTML('beforeend', featured.map((p, i) => `
  <a class="project" href="projet.html?p=${p.slug}" data-cursor="Voir">
    <div class="project__cover">
      ${coverHTML(p, projects.indexOf(p))}
      <span class="project__index mono">${pad(i + 1)} / ${pad(featured.length)}</span>
      ${p.status ? `<span class="project__status mono">${p.status}</span>` : ''}
    </div>
    <div class="project__meta mono"><span>${p.kind}</span><span>${p.year}</span></div>
    <h3 class="project__title">${p.title}</h3>
    <p class="project__text">${p.summary}</p>
    <ul class="project__tags">${p.tags.map((t) => `<li>${t}</li>`).join('')}</ul>
  </a>`).join(''));

// Index de tous les projets
const categories = ['Tout', ...new Set(projects.map((p) => p.category))];
$('.archive__filters').innerHTML = categories.map((c, i) => {
  const n = c === 'Tout' ? projects.length : projects.filter((p) => p.category === c).length;
  return `<button type="button" class="filter${i ? '' : ' is-active'}" data-filter="${c}" aria-pressed="${!i}">${c}<sup>${n}</sup></button>`;
}).join('');
$('.archive__list').innerHTML = projects.map((p, i) => `
  <li class="row" data-category="${p.category}">
    <a href="projet.html?p=${p.slug}" data-preview="${i}">
      <span class="row__num mono">${pad(i + 1)}</span>
      <span class="row__title">${p.title}</span>
      <span class="row__kind">${p.kind}</span>
      <span class="row__cat mono">${p.category}</span>
      <span class="row__year mono">${p.year}</span>
      <span class="row__arrow" aria-hidden="true">→</span>
    </a>
  </li>`).join('');
$('.archive__preview').innerHTML = projects.map((p, i) => `<div class="preview__item" data-i="${i}">${coverHTML(p, i)}</div>`).join('');
// dans l'aperçu, les vidéos ne se lancent qu'au survol (pas de téléchargement inutile)
$$('.archive__preview video').forEach((v) => { v.removeAttribute('autoplay'); v.preload = 'none'; });

paintCovers(projects);
autoplayVideos($('.work'));

const mail = $('.js-mail');
mail.textContent = profile.email;
mail.href = `mailto:${profile.email}`;
$('.js-socials').innerHTML = profile.socials
  .map((s) => `<li><a href="${s.url}" target="_blank" rel="noopener">${s.label} ↗</a></li>`).join('');

/* ---------------- Thème, scroll, scène ---------------- */

let scene, lab;
initTheme(() => { scene?.refreshColors(); lab?.refreshColors(); });

const lenis = initLenis();
let velocity = 0;
lenis?.on('scroll', (e) => { velocity = e.velocity; });
lenis?.stop();

try {
  scene = createScene($('#webgl'), { reduceMotion });
} catch (err) {
  console.warn('WebGL indisponible, on continue sans la scène 3D.', err);
}
if (DEV) Object.assign(window, { __scene: scene, __gsap: gsap });

function sceneStops() {
  const d = isDesktop();
  const faint = { morph: 2, x: 0, y: 0, scale: 1.8, opacity: 0.12, tilt: 0.6 };
  const S = {
    hero: { morph: 0, x: d ? 1.45 : 0, y: d ? 0.1 : 0.7, scale: d ? 0.95 : 0.6, opacity: 1, tilt: 0.25 },
    about: { morph: 1, x: d ? -1.75 : 0, y: 0, scale: d ? 0.95 : 0.85, opacity: d ? 1 : 0.35, tilt: 0.1 },
    stack: { morph: 2, x: d ? 1.7 : 0, y: 0, scale: d ? 1 : 0.8, opacity: d ? 1 : 0.35, tilt: 0.45 },
    work: faint,
    archive: { ...faint, opacity: 0.08 },
    lab: { ...faint, opacity: 0 },
    contact: { morph: 0, x: d ? 1.6 : 0, y: d ? 0.35 : 0.9, scale: d ? 1.05 : 0.7, opacity: d ? 0.9 : 0.45, tilt: 0.25 },
  };
  return $$('[data-scene]').map((el) => ({ el, state: S[el.dataset.scene] }));
}

gsap.ticker.add((time, deltaMs) => {
  scene?.update(Math.min(deltaMs / 1000, 0.05), velocity);
  updateElasticType();
});

/* ---------------- Typo élastique du hero ---------------- */

const heroChars = [];
const pointer = { x: -9999, y: -9999 };
let elasticOn = false;
window.addEventListener('pointermove', (e) => { pointer.x = e.clientX; pointer.y = e.clientY; });

function updateElasticType() {
  if (!elasticOn) return;
  for (const c of heroChars) {
    const r = c.el.getBoundingClientRect();
    if (r.bottom < 0) { if (c.w !== 62) { c.w = 62; c.el.style.fontVariationSettings = "'wdth' 62"; } continue; }
    const dx = pointer.x - (r.left + r.width / 2);
    const dy = pointer.y - (r.top + r.height / 2);
    const k = Math.max(0, 1 - Math.hypot(dx, dy * 0.6) / 380);
    const target = 62 + 63 * k * k;
    c.w += (target - c.w) * 0.12;
    c.el.style.fontVariationSettings = `'wdth' ${c.w.toFixed(1)}`;
  }
}

/* ---------------- Index : filtres + aperçu qui suit la souris ---------------- */

function setupArchive() {
  const rows = $$('.archive .row');
  $$('.filter').forEach((btn) => btn.addEventListener('click', () => {
    $$('.filter').forEach((b) => { b.classList.toggle('is-active', b === btn); b.setAttribute('aria-pressed', b === btn); });
    const f = btn.dataset.filter;
    const show = rows.filter((r) => f === 'Tout' || r.dataset.category === f);
    const hide = rows.filter((r) => !show.includes(r));
    gsap.set(hide, { display: 'none' });
    gsap.set(show, { display: '' });
    gsap.fromTo(show, { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.6, ease: 'expo.out', stagger: 0.03 });
    ScrollTrigger.refresh();
  }));

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const preview = $('.archive__preview');
  const items = $$('.preview__item', preview);
  const px = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
  const py = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
  const list = $('.archive__list');
  let lastX = 0;

  list.addEventListener('pointermove', (e) => {
    px(e.clientX + 24); py(e.clientY - 120);
    gsap.to(preview, { rotate: gsap.utils.clamp(-8, 8, (e.clientX - lastX) * 0.6), duration: 0.5, ease: 'power3' });
    lastX = e.clientX;
  });
  $$('[data-preview]', list).forEach((a) => a.addEventListener('pointerenter', () => {
    items.forEach((it) => {
      const on = it.dataset.i === a.dataset.preview;
      it.classList.toggle('is-on', on);
      const v = $('video', it);
      if (v) on ? v.play().catch(() => {}) : v.pause();
    });
    preview.classList.add('is-visible');
  }));
  list.addEventListener('pointerleave', () => preview.classList.remove('is-visible'));
}

/* ---------------- Animations de scroll ---------------- */

function setupScroll() {
  revealLines();

  // Paragraphes : les mots s'allument au scroll
  $$('.js-words').forEach((el) => {
    const split = new SplitText(el, { type: 'words' });
    gsap.fromTo(split.words, { opacity: 0.14 }, {
      opacity: 1, stagger: 0.06, ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 85%', end: 'bottom 55%', scrub: true },
    });
  });

  gsap.from('.about__facts li', {
    y: 30, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08,
    scrollTrigger: { trigger: '.about__facts', start: 'top 90%' },
  });
  $$('.layer').forEach((el) => gsap.from(el, {
    y: 40, opacity: 0, duration: 1, ease: 'expo.out',
    scrollTrigger: { trigger: el, start: 'top 90%' },
  }));
  gsap.from('.archive .row', {
    y: 30, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.04,
    scrollTrigger: { trigger: '.archive__list', start: 'top 85%' },
  });

  // Marquee : se penche avec la vitesse de scroll
  const skew = gsap.quickTo('.marquee__inner', 'skewX', { duration: 0.5, ease: 'power3' });
  gsap.ticker.add(() => skew(gsap.utils.clamp(-12, 12, -velocity * 0.4)));

  // Projets : scroll horizontal épinglé (desktop)
  const mm = gsap.matchMedia();
  mm.add('(min-width: 768px)', () => {
    const track = $('.work__track');
    const dist = () => track.scrollWidth - window.innerWidth;
    gsap.to(track, {
      x: () => -dist(), ease: 'none',
      scrollTrigger: {
        trigger: '.work', pin: true, scrub: 0.8, end: () => `+=${dist()}`, invalidateOnRefresh: true,
        onUpdate: (st) => gsap.set('.work__progress span', { scaleX: st.progress }),
      },
    });
  });
  mm.add('(max-width: 767px)', () => {
    $$('.project').forEach((el) => gsap.from(el, {
      y: 50, opacity: 0, duration: 1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' },
    }));
  });

  // Contact : grosses lettres qui montent
  gsap.from(splitChars($('.contact__title')), {
    yPercent: 110, rotate: 6, duration: 1.1, ease: 'expo.out', stagger: 0.025,
    scrollTrigger: { trigger: '.contact__title', start: 'top 80%' },
  });

  // Nav : lien actif + se cache quand on descend
  const nav = $('.nav');
  $$('main section[id]').forEach((sec) => {
    const link = $(`.nav__links a[href="#${sec.id}"]`);
    if (!link) return;
    ScrollTrigger.create({
      trigger: sec, start: 'top 50%', end: 'bottom 50%',
      onToggle: (st) => link.classList.toggle('is-active', st.isActive),
    });
  });
  let lastY = 0;
  ScrollTrigger.create({
    start: 0, end: 'max',
    onUpdate: (st) => {
      const y = st.scroll();
      nav.classList.toggle('is-hidden', y > 200 && y > lastY);
      lastY = y;
    },
  });

  scene?.setStops(sceneStops());
  ScrollTrigger.addEventListener('refresh', () => scene?.setStops(sceneStops()));
}

/* ---------------- Loader + intro ---------------- */

async function boot() {
  await fontsReady();
  const heroSplit = splitChars($('.hero__title'));
  heroSplit.forEach((el) => heroChars.push({ el, w: 62 }));

  setupScroll();
  setupArchive();
  lab = createLab($('.lab'), { reduceMotion });
  createCursor(gsap);

  const finish = () => {
    document.body.classList.remove('is-loading');
    lenis?.start();
    elasticOn = !reduceMotion && window.matchMedia('(hover: hover)').matches;
    ScrollTrigger.refresh();
    // retour depuis une page projet (index.html#work)
    if (location.hash && lenis) lenis.scrollTo(location.hash, { immediate: true });
  };

  // Le loader ne se joue qu'à la première visite de la session
  let seen = false;
  try { seen = sessionStorage.getItem('loaded') === '1'; sessionStorage.setItem('loaded', '1'); } catch (e) { /* ignore */ }

  if (reduceMotion || seen) {
    $('.loader').remove();
    finish();
    if (!reduceMotion) {
      scene?.intro(gsap);
      gsap.from(heroSplit, { yPercent: 115, duration: 1.2, ease: 'expo.out', stagger: 0.03 });
    }
    return;
  }

  const counter = { v: 0 };
  const tl = gsap.timeline();
  tl.to(counter, {
    v: 100, duration: 1.8, ease: 'power2.inOut',
    onUpdate: () => { $('.loader__num').textContent = String(Math.round(counter.v)).padStart(3, '0'); },
  })
    .to('.loader__bar span', { scaleX: 1, duration: 1.8, ease: 'power2.inOut' }, 0)
    .to('.loader__num', { yPercent: -100, duration: 0.6, ease: 'expo.in' }, '+=0.1')
    .to('.loader', { yPercent: -100, duration: 1.1, ease: 'expo.inOut' }, '-=0.15')
    .add(() => { $('.loader').remove(); finish(); })
    .add(() => scene?.intro(gsap), '-=0.9')
    .from(heroSplit, { yPercent: 115, duration: 1.3, ease: 'expo.out', stagger: 0.035 }, '-=0.7')
    .from('.hero__eyebrow, .hero__bottom > *', { y: 20, opacity: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }, '-=1')
    .from('.nav', { yPercent: -100, opacity: 0, duration: 1, ease: 'expo.out' }, '<');
}

/* ---------------- Petits détails ---------------- */

const clock = $('.js-clock');
const fmt = new Intl.DateTimeFormat('fr-FR', { timeZone: profile.timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' });
const tick = () => { clock.textContent = `${fmt.format(new Date())} — ${profile.location}`; };
tick();
setInterval(tick, 1000);

const toast = $('.toast');
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('is-visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

$('.js-copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(profile.email);
    showToast('Email copié ✓');
  } catch {
    showToast(profile.email);
  }
});

boot();
