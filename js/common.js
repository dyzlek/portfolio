// Code partagé entre l'accueil et les pages projet.
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { SplitText } from 'gsap/SplitText';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger, SplitText);
export { gsap, ScrollTrigger, SplitText };

export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export const DEV = ['localhost', '127.0.0.1'].includes(location.hostname);

/* Thème clair / sombre (la valeur initiale est posée par un script inline dans <head>) */
export function initTheme(onChange) {
  $('.theme-toggle')?.addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem('theme', next); } catch (e) { /* stockage indisponible */ }
    onChange?.(next);
  });
}

/* Smooth scroll Lenis branché sur le ticker GSAP */
export function initLenis() {
  if (reduceMotion) return null;
  const lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.lagSmoothing(0);
  gsap.ticker.add((time) => lenis.raf(time * 1000));

  $$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2 && id !== '#') return;
    e.preventDefault();
    lenis.scrollTo(id === '#top' || id === '#' ? 0 : id, { duration: 1.6 });
  }));
  return lenis;
}

/* Menu mobile : les liens de la nav passent en panneau plein écran (< 900 px). */
export function initMenu(lenis) {
  const nav = $('.nav'), links = $('.nav__links');
  if (!nav || !links) return;
  links.id = 'nav-links';
  const btn = document.createElement('button');
  btn.className = 'nav__burger';
  btn.type = 'button';
  btn.setAttribute('aria-controls', links.id);
  btn.innerHTML = '<span></span><span></span>';
  $('.nav__right').append(btn);
  const set = (open) => {
    nav.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open);
    btn.setAttribute('aria-label', open ? 'Fermer le menu' : 'Ouvrir le menu');
    document.documentElement.classList.toggle('menu-open', open);
    open ? lenis?.stop() : lenis?.start();
  };
  set(false);
  btn.addEventListener('click', () => set(!nav.classList.contains('is-open')));
  // capture : on referme (et relance Lenis) avant que le lien ne lance le scroll
  links.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); }, true);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
  matchMedia('(min-width: 901px)').addEventListener('change', (e) => e.matches && set(false));
}

/* Les découpages de texte dépendent des métriques : on attend les vraies polices. */
export async function fontsReady() {
  await Promise.all([
    document.fonts.load('800 100px Archivo'),
    document.fonts.load('400 16px Geist'),
    document.fonts.load('400 12px "Geist Mono"'),
  ]).catch(() => {});
  await document.fonts.ready;
}

export function splitChars(scope) {
  return $$('.js-split', scope).flatMap((el) => new SplitText(el, { type: 'words,chars', wordsClass: 'word', charsClass: 'char' }).chars);
}

/* Titres révélés ligne par ligne (autoSplit : redécoupe si la police ou la largeur change) */
export function revealLines(selector = '.js-lines') {
  $$(selector).forEach((el) => {
    SplitText.create(el, {
      type: 'lines', mask: 'lines', autoSplit: true,
      onSplit: (self) => gsap.from(self.lines, {
        yPercent: 105, duration: 1.2, ease: 'expo.out', stagger: 0.08,
        scrollTrigger: { trigger: el, start: 'top 88%' },
      }),
    });
  });
}

/* Couverture générative pour les projets sans image */
export function drawCover(canvas, project, index) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  let s = index * 9301 + 49297;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const ink = '#141311';
  ctx.fillStyle = project.color;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = ink; ctx.fillStyle = ink; ctx.lineWidth = 3;

  if (project.pattern === 'rings') {
    const cx = W * 0.62, cy = H * 0.55;
    for (let r = 20; r < 700; r += 22 + rnd() * 10) {
      ctx.beginPath(); ctx.arc(cx + rnd() * 6, cy, r, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.fill();
  } else if (project.pattern === 'waves') {
    for (let y = 40; y < H + 40; y += 26) {
      ctx.beginPath();
      for (let x = 0; x <= W; x += 8) {
        const yy = y + Math.sin(x * 0.012 + y * 0.03) * 22 + Math.sin(x * 0.031) * 6;
        x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy);
      }
      ctx.stroke();
    }
  } else if (project.pattern === 'grid') {
    const n = 12, cell = W / n;
    for (let x = 0; x < n; x++) for (let y = 0; y < Math.ceil(H / cell); y++) {
      const k = rnd();
      const sz = cell * (k < 0.25 ? 0.85 : k < 0.6 ? 0.4 : 0.12);
      ctx.fillRect(x * cell + (cell - sz) / 2, y * cell + (cell - sz) / 2, sz, sz);
    }
  } else {
    const n = 48, bw = W / n;
    for (let i = 0; i < n; i++) {
      const bh = (0.15 + Math.abs(Math.sin(i * 0.35)) * 0.6 + rnd() * 0.2) * H;
      ctx.fillRect(i * bw + 2, (H - bh) / 2, bw - 5, bh);
    }
  }
  ctx.font = '500 22px "Geist Mono", monospace';
  ctx.fillText(project.tags[0].toUpperCase(), 26, H - 28);
}

/* <img> ou <canvas> génératif selon le projet */
export function coverHTML(p, i, { eager = false } = {}) {
  if (p.coverVideo) return `<video src="${p.coverVideo}#t=3" muted loop playsinline autoplay preload="metadata" data-autoplay></video>`;
  return p.cover
    ? `<img src="${p.cover}" alt="" ${eager ? '' : 'loading="lazy"'} decoding="async" />`
    : `<canvas width="800" height="600" data-cover="${i}"></canvas>`;
}
export function paintCovers(projects, scope = document) {
  $$('canvas[data-cover]', scope).forEach((c) => drawCover(c, projects[c.dataset.cover], +c.dataset.cover));
}

/* Les vidéos de couverture ne jouent que quand elles sont à l'écran */
export function autoplayVideos(scope = document) {
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting && !reduceMotion) e.target.play().catch(() => {});
    else e.target.pause();
  }));
  $$('video[data-autoplay]', scope).forEach((v) => io.observe(v));
}

export const pad = (n) => String(n).padStart(2, '0');
