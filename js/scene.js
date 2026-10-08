import * as THREE from 'three';

// Nuage de particules qui se transforme au scroll :
// sphère (hero) → nœud (à propos) → trois couches empilées (stack) → sphère (contact).

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);
  const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));
  vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);
  vec3 l=1.0-g;
  vec3 i1=min(g.xyz,l.zxy);
  vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;
  vec3 x2=x0-i2+C.yyy;
  vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;
  vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z);
  vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;
  vec4 y=y_*ns.x+ns.yyyy;
  vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);
  vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;
  vec4 s1=floor(b1)*2.0+1.0;
  vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
  vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);
  vec3 p1=vec3(a0.zw,h.y);
  vec3 p2=vec3(a1.xy,h.z);
  vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
  m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const vertexShader = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform float uIntro;
uniform float uAgitation;
uniform float uSize;
uniform float uPixelRatio;
uniform float uAspect;
uniform vec2 uMouse;
attribute vec3 aSphere;
attribute vec3 aKnot;
attribute vec3 aStack;
attribute float aRand;
varying float vRand;
varying float vAlpha;
${NOISE}
void main(){
  // Chaque particule part avec un petit décalage : la transformation "coule".
  float m1 = clamp(uMorph, 0.0, 1.0);
  float m2 = clamp(uMorph - 1.0, 0.0, 1.0);
  float s1 = smoothstep(0.0, 1.0, clamp(m1 * 1.5 - aRand * 0.5, 0.0, 1.0));
  float s2 = smoothstep(0.0, 1.0, clamp(m2 * 1.5 - aRand * 0.5, 0.0, 1.0));
  vec3 p = mix(aSphere, aKnot, s1);
  p = mix(p, aStack, s2);

  // Respiration organique
  float n = snoise(p * 0.7 + vec3(uTime * 0.12));
  p += normalize(p + 0.0001) * n * (0.12 + uAgitation);

  // Entrée : les particules arrivent de loin
  vec3 far = normalize(aSphere + 0.0001) * (6.0 + aRand * 8.0);
  p = mix(far, p, uIntro);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;

  // La souris repousse les particules (en espace écran)
  vec2 ndc = gl_Position.xy / gl_Position.w;
  vec2 d = ndc - uMouse;
  d.x *= uAspect;
  float f = smoothstep(0.32, 0.0, length(d));
  vec2 push = normalize(d + 0.0001) * f * 0.14;
  push.x /= uAspect;
  gl_Position.xy += push * gl_Position.w;

  gl_PointSize = uSize * uPixelRatio * (0.45 + aRand * 0.9) / -mv.z;
  vRand = aRand;
  vAlpha = clamp(1.0 - (-mv.z - 4.6) / 3.2, 0.2, 1.0) * (1.0 + f * 0.6);
}`;

const fragmentShader = /* glsl */ `
uniform vec3 uColor;
uniform vec3 uAccent;
uniform float uOpacity;
varying float vRand;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.1, d);
  vec3 col = vRand > 0.88 ? uAccent : uColor;
  gl_FragColor = vec4(col, a * uOpacity * vAlpha);
}`;

function buildShapes(count) {
  const sphere = new Float32Array(count * 3);
  const knot = new Float32Array(count * 3);
  const stack = new Float32Array(count * 3);
  const rand = new Float32Array(count);
  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i++) {
    const i3 = i * 3;
    rand[i] = Math.random();

    // Sphère de Fibonacci, un peu d'épaisseur
    const y = 1 - (i / (count - 1)) * 2;
    const r = Math.sqrt(1 - y * y);
    const th = golden * i;
    const R = 1.55 * (0.9 + Math.random() * 0.1);
    sphere[i3] = Math.cos(th) * r * R;
    sphere[i3 + 1] = y * R;
    sphere[i3 + 2] = Math.sin(th) * r * R;

    // Nœud torique (2,3) avec un tube
    const t = Math.random() * Math.PI * 2;
    const kr = Math.cos(3 * t) + 2;
    const tube = 0.18 * Math.cbrt(Math.random());
    const a = Math.random() * Math.PI * 2;
    const b = Math.acos(2 * Math.random() - 1);
    knot[i3] = kr * Math.cos(2 * t) * 0.62 + Math.sin(b) * Math.cos(a) * tube;
    knot[i3 + 1] = kr * Math.sin(2 * t) * 0.62 + Math.sin(b) * Math.sin(a) * tube;
    knot[i3 + 2] = -Math.sin(3 * t) * 0.62 + Math.cos(b) * tube;

    // Trois couches : front / back / infra. Bords plus denses.
    const layer = i % 3;
    const size = 1.25;
    let sx, sz;
    if (Math.random() < 0.35) {
      const edge = Math.floor(Math.random() * 4);
      const u = (Math.random() * 2 - 1) * size;
      sx = edge < 2 ? u : (edge === 2 ? -size : size);
      sz = edge < 2 ? (edge === 0 ? -size : size) : u;
    } else {
      // grille légèrement pixelisée = clin d'œil "écran"
      const g = 0.125;
      sx = Math.round(((Math.random() * 2 - 1) * size) / g) * g;
      sz = Math.round(((Math.random() * 2 - 1) * size) / g) * g;
    }
    stack[i3] = sx;
    stack[i3 + 1] = (layer - 1) * 0.85 + (Math.random() - 0.5) * 0.03;
    stack[i3 + 2] = sz;
  }
  return { sphere, knot, stack, rand };
}

const cssColor = (name) => new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());

export function createScene(canvas, { reduceMotion = false } = {}) {
  const isMobile = window.matchMedia('(max-width: 767px)').matches;
  const count = isMobile ? 7000 : 15000;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight, false);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 50);
  camera.position.z = 6;

  const shapes = buildShapes(count);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(shapes.sphere.slice(), 3));
  geometry.setAttribute('aSphere', new THREE.BufferAttribute(shapes.sphere, 3));
  geometry.setAttribute('aKnot', new THREE.BufferAttribute(shapes.knot, 3));
  geometry.setAttribute('aStack', new THREE.BufferAttribute(shapes.stack, 3));
  geometry.setAttribute('aRand', new THREE.BufferAttribute(shapes.rand, 1));

  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uIntro: { value: reduceMotion ? 1 : 0 },
    uAgitation: { value: 0 },
    uSize: { value: isMobile ? 20 : 30 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uAspect: { value: window.innerWidth / window.innerHeight },
    uMouse: { value: new THREE.Vector2(9, 9) },
    uColor: { value: cssColor('--fg') },
    uAccent: { value: cssColor('--accent') },
    uOpacity: { value: 1 },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader, fragmentShader, uniforms,
    transparent: true, depthWrite: false,
  });
  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;

  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  // État courant (lissé) et cible (venant du scroll)
  const state = { morph: 0, x: 0, y: 0, scale: 1, opacity: 1, tilt: 0.25 };
  const target = { ...state };
  const mouse = new THREE.Vector2(9, 9);
  const mouseTarget = new THREE.Vector2(9, 9);
  let agitation = 0;
  let stops = [];

  window.addEventListener('pointermove', (e) => {
    mouseTarget.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  });
  document.addEventListener('pointerleave', () => mouseTarget.set(9, 9));

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uAspect.value = w / h;
  }
  window.addEventListener('resize', resize);

  const smooth = (t) => t * t * (3 - 2 * t);

  // Trouve la section au centre de l'écran et mélange vers la suivante sur la fin.
  function computeTarget() {
    if (!stops.length) return;
    const mid = window.innerHeight / 2;
    let idx = 0, p = 0;
    for (let i = 0; i < stops.length; i++) {
      const el = stops[i].el.parentElement?.classList.contains('pin-spacer') ? stops[i].el.parentElement : stops[i].el;
      const r = el.getBoundingClientRect();
      if (r.top <= mid) { idx = i; p = Math.min(1, (mid - r.top) / r.height); }
    }
    const a = stops[idx].state;
    const b = (stops[idx + 1] || stops[idx]).state;
    const k = smooth(Math.min(1, Math.max(0, (p - 0.6) / 0.4)));
    for (const key in target) {
      if (a[key] !== undefined) target[key] = a[key] + (b[key] - a[key]) * k;
    }
  }

  function update(dt, velocity = 0) {
    computeTarget();
    const ease = 1 - Math.exp(-dt * 4);
    for (const key in state) state[key] += (target[key] - state[key]) * ease;
    mouse.lerp(mouseTarget, 1 - Math.exp(-dt * 8));
    agitation += (Math.min(Math.abs(velocity) * 0.012, 0.35) - agitation) * (1 - Math.exp(-dt * 6));

    uniforms.uTime.value += reduceMotion ? 0 : dt;
    uniforms.uMorph.value = state.morph;
    uniforms.uOpacity.value = state.opacity;
    uniforms.uMouse.value.copy(mouse);
    uniforms.uAgitation.value = agitation;

    group.position.set(state.x, state.y, 0);
    group.scale.setScalar(state.scale);
    if (!reduceMotion) group.rotation.y += dt * 0.12;
    group.rotation.x = state.tilt + mouse.y * 0.08 * (Math.abs(mouse.y) < 2 ? 1 : 0);
    group.rotation.z = -0.1;

    if (state.opacity > 0.01) renderer.render(scene, camera);
    else renderer.clear();
  }

  return {
    update,
    intro(gsap) {
      return gsap.to(uniforms.uIntro, { value: 1, duration: 2.4, ease: 'expo.out' });
    },
    setStops(list) { stops = list; computeTarget(); Object.assign(state, target); },
    refreshColors() {
      uniforms.uColor.value = cssColor('--fg');
      uniforms.uAccent.value = cssColor('--accent');
    },
    isMobile,
    debug: { state, target, uniforms, get stops() { return stops; } },
  };
}
