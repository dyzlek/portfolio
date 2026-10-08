// Curseur custom (point + anneau qui suit avec retard) et boutons magnétiques.

export function createCursor(gsap) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  document.documentElement.classList.add('has-cursor');

  const root = document.querySelector('.cursor');
  const dot = root.querySelector('.cursor__dot');
  const ring = root.querySelector('.cursor__ring');
  const label = root.querySelector('.cursor__label');

  const dotX = gsap.quickTo(dot, 'x', { duration: 0.08, ease: 'power3' });
  const dotY = gsap.quickTo(dot, 'y', { duration: 0.08, ease: 'power3' });
  const ringX = gsap.quickTo(ring, 'x', { duration: 0.45, ease: 'power3' });
  const ringY = gsap.quickTo(ring, 'y', { duration: 0.45, ease: 'power3' });

  window.addEventListener('pointermove', (e) => {
    dotX(e.clientX); dotY(e.clientY);
    ringX(e.clientX); ringY(e.clientY);
    root.classList.remove('is-hidden');
  });
  document.addEventListener('pointerleave', () => root.classList.add('is-hidden'));

  document.addEventListener('pointerover', (e) => {
    const withLabel = e.target.closest('[data-cursor]');
    const interactive = e.target.closest('a, button');
    root.classList.toggle('is-label', !!withLabel);
    root.classList.toggle('is-hover', !withLabel && !!interactive);
    if (withLabel) label.textContent = withLabel.dataset.cursor;
  });

  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const x = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    const y = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'elastic.out(1, 0.4)' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      x((e.clientX - (r.left + r.width / 2)) * 0.3);
      y((e.clientY - (r.top + r.height / 2)) * 0.4);
    });
    el.addEventListener('pointerleave', () => { x(0); y(0); });
  });
}
