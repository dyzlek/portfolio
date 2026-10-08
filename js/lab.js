// Lab : champ de flux 2D sur canvas. Les particules laissent des traînées,
// la souris crée un tourbillon, un clic envoie une onde.

const hexToRgb = (hex) => {
  const h = hex.trim().replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

const MODES = ['Flux', 'Orbite', 'Grille'];

export function createLab(section, { reduceMotion = false } = {}) {
  const canvas = section.querySelector('.lab__canvas');
  const ctx = canvas.getContext('2d');
  const modeBtn = section.querySelector('.js-lab-mode');
  const seedBtn = section.querySelector('.js-lab-seed');
  const countEl = section.querySelector('.js-lab-count');

  let w = 0, h = 0, dpr = 1;
  let particles = [];
  let seed = Math.random() * 1000;
  let ideaCount = 1;
  let mode = 0;
  let running = false;
  let colors = {};
  const pointer = { x: -9999, y: -9999, active: false };

  function readColors() {
    const cs = getComputedStyle(document.documentElement);
    colors = {
      bg: hexToRgb(cs.getPropertyValue('--bg-2')),
      fg: cs.getPropertyValue('--fg').trim(),
      accent: cs.getPropertyValue('--accent').trim(),
    };
  }

  function spawn(p) {
    p.x = Math.random() * w;
    p.y = Math.random() * h;
    p.vx = 0; p.vy = 0;
    p.life = 80 + Math.random() * 220;
    return p;
  }

  function resize() {
    const r = section.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio, 2);
    w = r.width; h = r.height;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = Math.round(Math.min(2200, (w * h) / 650));
    particles = Array.from({ length: n }, (_, i) => spawn({ accent: i % 9 === 0 }));
    clear();
  }

  function clear() {
    const [r, g, b] = colors.bg;
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, w, h);
  }

  function angleAt(x, y, t) {
    const s = seed;
    const f1 = 0.0016 + (s % 7) * 0.0004;
    const f2 = 0.0021 + (s % 5) * 0.0003;
    return (Math.sin(x * f1 + s) + Math.cos(y * f2 - s * 1.3) + Math.sin((x + y) * 0.0009 + t * 0.00025)) * Math.PI * 0.9;
  }

  function step(t) {
    const [r, g, b] = colors.bg;
    ctx.fillStyle = `rgba(${r},${g},${b},0.07)`;
    ctx.fillRect(0, 0, w, h);

    for (const p of particles) {
      let ax = 0, ay = 0;
      if (mode === 0) {
        const a = angleAt(p.x, p.y, t);
        ax = Math.cos(a) * 0.35; ay = Math.sin(a) * 0.35;
      } else if (mode === 1) {
        const cx = pointer.active ? pointer.x : w / 2;
        const cy = pointer.active ? pointer.y : h / 2;
        const dx = cx - p.x, dy = cy - p.y;
        const d = Math.hypot(dx, dy) + 30;
        ax = (dx / d) * 0.25 + (-dy / d) * 0.55;
        ay = (dy / d) * 0.25 + (dx / d) * 0.55;
      } else {
        // Grille : déplacements orthogonaux, look circuit imprimé
        const a = angleAt(p.x, p.y, t);
        const q = Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
        ax = Math.cos(q) * 0.45; ay = Math.sin(q) * 0.45;
      }

      if (pointer.active && mode !== 1) {
        const dx = p.x - pointer.x, dy = p.y - pointer.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 160 * 160) {
          const d = Math.sqrt(d2) + 1;
          const f = (1 - d / 160) * 1.6;
          ax += (-dy / d) * f + (dx / d) * f * 0.3;
          ay += (dx / d) * f + (dy / d) * f * 0.3;
        }
      }

      p.vx = (p.vx + ax) * 0.9;
      p.vy = (p.vy + ay) * 0.9;
      const ox = p.x, oy = p.y;
      p.x += p.vx * 2.2;
      p.y += p.vy * 2.2;
      p.life--;

      if (p.life < 0 || p.x < -10 || p.x > w + 10 || p.y < -10 || p.y > h + 10) { spawn(p); continue; }

      ctx.strokeStyle = p.accent ? colors.accent : colors.fg;
      ctx.globalAlpha = p.accent ? 0.9 : 0.55;
      ctx.lineWidth = p.accent ? 1.6 : 1;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y) {
    for (const p of particles) {
      const dx = p.x - x, dy = p.y - y;
      const d = Math.hypot(dx, dy) + 1;
      if (d < 280) {
        const f = (1 - d / 280) * 14;
        p.vx += (dx / d) * f; p.vy += (dy / d) * f;
      }
    }
  }

  function loop(t) {
    if (!running) return;
    step(t);
    requestAnimationFrame(loop);
  }

  const local = (e) => {
    const r = canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  section.addEventListener('pointermove', (e) => { [pointer.x, pointer.y] = local(e); pointer.active = true; });
  section.addEventListener('pointerleave', () => { pointer.active = false; });
  canvas.addEventListener('pointerdown', (e) => { const [x, y] = local(e); burst(x, y); });

  modeBtn.addEventListener('click', () => {
    mode = (mode + 1) % MODES.length;
    modeBtn.querySelector('b').textContent = MODES[mode];
  });
  seedBtn.addEventListener('click', () => {
    seed = Math.random() * 1000;
    ideaCount++;
    countEl.textContent = String(ideaCount).padStart(3, '0');
    particles.forEach(spawn);
    clear();
  });

  readColors();
  resize();
  let rw = window.innerWidth;
  window.addEventListener('resize', () => {
    // sur mobile, la barre d'adresse change la hauteur : on ignore ces resizes
    if (window.innerWidth === rw && Math.abs(section.getBoundingClientRect().height - h) < 120) return;
    rw = window.innerWidth;
    resize();
  });

  if (reduceMotion) {
    // un rendu figé de quelques centaines d'étapes
    for (let i = 0; i < 240; i++) step(i * 16);
  } else {
    new IntersectionObserver(([entry]) => {
      const was = running;
      running = entry.isIntersecting;
      if (running && !was) requestAnimationFrame(loop);
    }).observe(section);
  }

  return {
    refreshColors() { readColors(); clear(); },
  };
}
