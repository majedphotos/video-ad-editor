/* ═══ engine.js — محرّك «شرح بالموشن» (2D + 3D، حتمي بالزمن) ═══
   العقد والـAPI الكامل: ENGINE-API.md
   قاعدة ذهبية: الفريم t يعتمد على t فقط — لا rAF ولا Date ولا Math.random بأي مشهد. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FXAAPass } from 'three/addons/postprocessing/FXAAPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';
import { VignetteShader } from 'three/addons/shaders/VignetteShader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

const G = window;
const Q = new URLSearchParams(location.search);
const RENDER_MODE = Q.get('render') === '1';
const SCALE = parseFloat(Q.get('scale') || '1');
const SAFE = Q.get('safe') === '1';
const PROJ = (Q.get('proj') || '/proj/').replace(/\/?$/, '/');

/* ─────────────────────────── math · easing ─────────────────────────── */
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const prog = (t, a, b) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));
const map = (v, a, b, c, d, clampIt = true) => { const k = (v - a) / (b - a); return c + (d - c) * (clampIt ? clamp(k) : k); };
const smoothstep = (a, b, v) => { const k = clamp((v - a) / (b - a)); return k * k * (3 - 2 * k); };
const fract = v => v - Math.floor(v);

function cubicBezier(x1, y1, x2, y2) {            // CSS cubic-bezier solver (Newton + bisection)
  const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
  const sx = u => ((ax * u + bx) * u + cx) * u, sy = u => ((ay * u + by) * u + cy) * u, dx = u => (3 * ax * u + 2 * bx) * u + cx;
  return k => {
    if (k <= 0) return 0; if (k >= 1) return 1;
    let u = k; for (let i = 0; i < 8; i++) { const e = sx(u) - k, d = dx(u); if (Math.abs(e) < 1e-6) return sy(u); if (Math.abs(d) < 1e-6) break; u -= e / d; }
    let lo = 0, hi = 1; u = k; for (let i = 0; i < 30; i++) { const v = sx(u); if (Math.abs(v - k) < 1e-6) break; if (v < k) lo = u; else hi = u; u = (lo + hi) / 2; }
    return sy(u);
  };
}
function springFn({ stiffness = 170, damping = 16, mass = 1, velocity = 0 } = {}) {   // analytic damped spring, k in [0..1] mapped to 1s
  const w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
  return k => {
    const t = k; if (t <= 0) return 0;
    if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0 - velocity) / wd) * Math.sin(wd * t)); }
    return 1 - Math.exp(-w0 * t) * (1 + (w0 - velocity) * t);
  };
}
const E = (() => {
  const P = p => ({ in: k => Math.pow(k, p), out: k => 1 - Math.pow(1 - k, p), inOut: k => k < .5 ? Math.pow(2, p - 1) * Math.pow(k, p) : 1 - Math.pow(-2 * k + 2, p) / 2 });
  const q = P(2), c = P(3), qt = P(4), qn = P(5);
  const bounceOut = k => { const n = 7.5625, d = 2.75; if (k < 1 / d) return n * k * k; if (k < 2 / d) return n * (k -= 1.5 / d) * k + .75; if (k < 2.5 / d) return n * (k -= 2.25 / d) * k + .9375; return n * (k -= 2.625 / d) * k + .984375; };
  const backIn = (s = 1.70158) => k => (s + 1) * k * k * k - s * k * k;
  const backOut = (s = 1.70158) => k => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
  const backInOut = (s = 1.70158) => { const s2 = s * 1.525; return k => k < .5 ? (Math.pow(2 * k, 2) * ((s2 + 1) * 2 * k - s2)) / 2 : (Math.pow(2 * k - 2, 2) * ((s2 + 1) * (k * 2 - 2) + s2) + 2) / 2; };
  const elasticOut = (amp = 1, per = 0.3) => k => k <= 0 ? 0 : k >= 1 ? 1 : amp * Math.pow(2, -10 * k) * Math.sin((k - per / 4) * (2 * Math.PI) / per) + 1;
  const elasticIn = (amp = 1, per = 0.3) => k => 1 - elasticOut(amp, per)(1 - k);
  return {
    linear: k => k,
    quadIn: q.in, quadOut: q.out, quadInOut: q.inOut, cubicIn: c.in, cubicOut: c.out, cubicInOut: c.inOut,
    quartIn: qt.in, quartOut: qt.out, quartInOut: qt.inOut, quintIn: qn.in, quintOut: qn.out, quintInOut: qn.inOut,
    sineIn: k => 1 - Math.cos(k * Math.PI / 2), sineOut: k => Math.sin(k * Math.PI / 2), sineInOut: k => -(Math.cos(Math.PI * k) - 1) / 2,
    expoIn: k => k <= 0 ? 0 : Math.pow(2, 10 * k - 10), expoOut: k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k),
    expoInOut: k => k <= 0 ? 0 : k >= 1 ? 1 : k < .5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2,
    circIn: k => 1 - Math.sqrt(1 - k * k), circOut: k => Math.sqrt(1 - Math.pow(k - 1, 2)),
    circInOut: k => k < .5 ? (1 - Math.sqrt(1 - Math.pow(2 * k, 2))) / 2 : (Math.sqrt(1 - Math.pow(-2 * k + 2, 2)) + 1) / 2,
    backIn: backIn(), backOut: backOut(), backInOut: backInOut(), back: (s) => backOut(s), backInS: backIn,
    elasticOut: elasticOut(), elasticIn: elasticIn(), elastic: elasticOut,
    bounceOut, bounceIn: k => 1 - bounceOut(1 - k),
    spring: springFn,                                  // E.spring({stiffness,damping})(seconds)
    springK: k => springFn({ stiffness: 180, damping: 12 })(k * 1.2),   // ready-made spring over k∈[0,1]
    bezier: cubicBezier,                               // E.bezier(.2,.8,.2,1)(k)
    snappy: cubicBezier(.2, .9, .1, 1), smooth: cubicBezier(.45, 0, .2, 1), anticipate: cubicBezier(.6, -0.35, .3, 1.2),
  };
})();
/* keyframes: kf(t, [[t0,v0],[t1,v1,ease?],...]) — numbers or arrays */
function kf(t, keys) {
  if (t <= keys[0][0]) return keys[0][1];
  for (let i = 1; i < keys.length; i++) {
    const [t1, v1, ez] = keys[i], [t0, v0] = keys[i - 1];
    if (t <= t1) { const k = (typeof ez === 'function' ? ez : (E[ez] || E.cubicInOut))(prog(t, t0, t1)); return Array.isArray(v0) ? v0.map((a, j) => lerp(a, v1[j], k)) : lerp(v0, v1, k); }
  }
  return keys[keys.length - 1][1];
}

/* ─────────────────────────── seeded random · noise ─────────────────────────── */
function hashStr(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed = 1) {                               // mulberry32 → r() in [0,1), plus helpers
  let a = (typeof seed === 'string' ? hashStr(seed) : seed) >>> 0;
  const r = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  r.range = (lo, hi) => lo + (hi - lo) * r();
  r.int = (lo, hi) => Math.floor(lo + (hi - lo + 1) * r());
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < .5 ? -1 : 1);
  r.gauss = () => { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  return r;
}
const hash01 = (...n) => { let h = 0x9E3779B9; for (const v of n) { h ^= Math.imul((v * 1000003) | 0, 0x85EBCA6B); h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35); } return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
function noise1(x, seed = 0) { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash01(i, seed), hash01(i + 1, seed), u) * 2 - 1; }
function noise2(x, y, seed = 0) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
  const a = hash01(i, j, seed), b = hash01(i + 1, j, seed), c = hash01(i, j + 1, seed), d = hash01(i + 1, j + 1, seed);
  return lerp(lerp(a, b, ux), lerp(c, d, ux), uy) * 2 - 1;
}
const fbm = (x, y = 0, oct = 4, seed = 0) => { let s = 0, a = .5, f = 1; for (let o = 0; o < oct; o++) { s += a * noise2(x * f, y * f, seed + o * 17); f *= 2; a *= .5; } return s; };

/* ─────────────────────────── state ─────────────────────────── */
const M = G.MOTION = G.MOTION || {};
M.ready = false; M.error = null; M.version = '1.0';
const defs = [];                                       // registered scene defs
M.scene = def => { if (!def || !def.id) throw new Error('MOTION.scene needs {id}'); defs.push(def); return def; };
const S = { proj: null, tl: null, W: 1080, H: 1920, fps: 60, dur: 3, scenes: [], beats: [], bars: [], vo: {}, voList: [], fontsReady: false };

/* ─────────────────────────── fonts ─────────────────────────── */
const FONT_FILES = [
  ['Cairo', 'Cairo-VF.ttf', '200 1000'],
  ['IBM Plex Sans Arabic', 'IBMPlexSansArabic-Regular.ttf', '400'],
  ['IBM Plex Sans Arabic', 'IBMPlexSansArabic-Bold.ttf', '700'],
  ['Noto Kufi Arabic', 'NotoKufiArabic-VF.ttf', '100 900'],
  ['Lalezar', 'Lalezar-Regular.ttf', '400'],
  ['Readex Pro', 'ReadexPro-VF.ttf', '160 700'],
  ['Aref Ruqaa', 'ArefRuqaa-Regular.ttf', '400'],
  ['Aref Ruqaa', 'ArefRuqaa-Bold.ttf', '700'],
  ['Tajawal', 'Tajawal-Regular.ttf', '400'],
  ['Tajawal', 'Tajawal-Bold.ttf', '700'],
  ['Tajawal', 'Tajawal-Black.ttf', '900'],
  ['Inter', 'Inter-VF.ttf', '100 900'],
];
async function loadFonts(extra = []) {
  const list = FONT_FILES.map(([fam, file, weight]) => ({ fam, url: './fonts/' + file, weight })).concat(extra);
  await Promise.all(list.map(async f => { const face = new FontFace(f.fam, `url("${f.url}")`, { weight: f.weight || '400', style: 'normal' }); await face.load(); document.fonts.add(face); }));
  await document.fonts.ready;
  S.fontsReady = true;
}

/* ─────────────────────────── canvases ─────────────────────────── */
const OUT = document.getElementById('out');
let OX = null;                                        // final composite context
const layers = [];                                    // pooled scene layers
function makeCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function baseT(X) { X.setTransform(SCALE, 0, 0, SCALE, 0, 0); }
function layer(i) {
  if (!layers[i]) { const c = makeCanvas(Math.round(S.W * SCALE), Math.round(S.H * SCALE)); layers[i] = { c, X: c.getContext('2d') }; }
  const L = layers[i]; L.X.setTransform(1, 0, 0, 1, 0, 0); L.X.clearRect(0, 0, L.c.width, L.c.height); baseT(L.X); return L;
}
function resetCtxState(X) {
  X.globalAlpha = 1; X.globalCompositeOperation = 'source-over'; X.filter = 'none'; X.shadowColor = 'transparent'; X.shadowBlur = 0;
  X.shadowOffsetX = X.shadowOffsetY = 0; X.setLineDash([]); X.lineCap = 'butt'; X.lineJoin = 'miter'; X.textAlign = 'start'; X.textBaseline = 'alphabetic'; X.direction = 'inherit';
  X.imageSmoothingEnabled = true; X.imageSmoothingQuality = 'high';
  try { X.letterSpacing = '0px'; } catch (e) { }
}

/* ─────────────────────────── WebGL (shared renderer) ─────────────────────────── */
let GL = null;                                         // { renderer, canvas }
function getRenderer() {
  if (GL) return GL;
  const canvas = makeCanvas(Math.round(S.W * SCALE), Math.round(S.H * SCALE));
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(1); renderer.setSize(canvas.width, canvas.height, false);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x000000, 0);
  const gl = renderer.getContext(), dbg = gl.getExtension('WEBGL_debug_renderer_info');
  M.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  GL = { renderer, canvas };
  return GL;
}
const TONE = { aces: THREE.ACESFilmicToneMapping, agx: THREE.AgXToneMapping, neutral: THREE.NeutralToneMapping, filmic: THREE.ACESFilmicToneMapping, none: THREE.NoToneMapping, linear: THREE.LinearToneMapping };
/* OutputPass that tone-maps/encodes in UN-premultiplied space and re-premultiplies — keeps transparent
   3D (and bloom halos) correct when the WebGL canvas is composited over the 2D layer. */
function premulOutputPass() {
  const p = new OutputPass();
  p.material.fragmentShader = `
    precision highp float;
    uniform sampler2D tDiffuse;
    #include <tonemapping_pars_fragment>
    #include <colorspace_pars_fragment>
    varying vec2 vUv;
    void main() {
      vec4 c = texture2D( tDiffuse, vUv );
      float a = clamp( c.a, 0.0, 1.0 );
      vec3 col = a > 1e-5 ? c.rgb / a : vec3( 0.0 );
      #ifdef LINEAR_TONE_MAPPING
        col = LinearToneMapping( col );
      #elif defined( REINHARD_TONE_MAPPING )
        col = ReinhardToneMapping( col );
      #elif defined( CINEON_TONE_MAPPING )
        col = CineonToneMapping( col );
      #elif defined( ACES_FILMIC_TONE_MAPPING )
        col = ACESFilmicToneMapping( col );
      #elif defined( AGX_TONE_MAPPING )
        col = AgXToneMapping( col );
      #elif defined( NEUTRAL_TONE_MAPPING )
        col = NeutralToneMapping( col );
      #endif
      vec4 o = vec4( clamp( col, 0.0, 1.0 ), 1.0 );
      #ifdef SRGB_TRANSFER
        o = sRGBTransferOETF( o );
      #endif
      gl_FragColor = vec4( o.rgb * a, a );
    }`;
  p.material.needsUpdate = true;
  return p;
}
/* stage3D: scene+camera+composer. opts: {fov, near, far, camera:[x,y,z], lookAt:[x,y,z], background:null|'#hex', env:'room'|null,
   bloom:false|{strength,radius,threshold}, tone:'aces'|'agx'|'neutral'|'none', exposure, fxaa:false, rgbShift:0, vignette:0, samples:4} */
function stage3D(opts = {}) {
  const { renderer, canvas } = getRenderer();
  const w = canvas.width, h = canvas.height;
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov || 35, S.W / S.H, opts.near || 0.1, opts.far || 200);
  const cp = opts.camera || [0, 0, 10]; camera.position.set(cp[0], cp[1], cp[2]); const la = opts.lookAt || [0, 0, 0]; camera.lookAt(la[0], la[1], la[2]);
  if (opts.background) scene.background = new THREE.Color(opts.background);
  if (opts.env === 'room' || opts.env === true) { const pm = new THREE.PMREMGenerator(renderer); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; pm.dispose(); }
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: opts.samples ?? 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(1); composer.setSize(w, h);
  composer.addPass(new RenderPass(scene, camera));
  let bloom = null, rgb = null, vig = null;
  if (opts.bloom) { const b = opts.bloom === true ? {} : opts.bloom; bloom = new UnrealBloomPass(new THREE.Vector2(w, h), b.strength ?? 1.1, b.radius ?? 0.55, b.threshold ?? 0.8); composer.addPass(bloom); }
  if (opts.rgbShift) { rgb = new ShaderPass(RGBShiftShader); rgb.uniforms.amount.value = opts.rgbShift; composer.addPass(rgb); }
  composer.addPass(premulOutputPass());
  if (opts.vignette) { vig = new ShaderPass(VignetteShader); vig.uniforms.offset.value = 1.0; vig.uniforms.darkness.value = opts.vignette; composer.addPass(vig); }
  if (opts.fxaa) composer.addPass(new FXAAPass());
  const tone = TONE[opts.tone || 'aces'] ?? THREE.ACESFilmicToneMapping, exposure = opts.exposure ?? 1;
  const st = {
    THREE, scene, camera, composer, renderer, bloom, rgbShift: rgb, vignette: vig, canvas,
    /* render the 3D stage and composite it into X (current scene layer) — call where you want its z-order */
    draw(X = CUR.X, o = {}) {
      renderer.toneMapping = tone; renderer.toneMappingExposure = o.exposure ?? exposure;
      renderer.setRenderTarget(null); renderer.setClearColor(0x000000, 0); renderer.clear();
      composer.render();
      X.save(); if (o.alpha != null) X.globalAlpha *= o.alpha; if (o.blend) X.globalCompositeOperation = o.blend; if (o.filter) X.filter = o.filter;
      X.drawImage(canvas, 0, 0, canvas.width, canvas.height, o.x || 0, o.y || 0, o.w || S.W, o.h || S.H);
      X.restore();
    },
    /* orbit helper: set camera on a sphere around target */
    orbit(az, el, dist, target = [0, 0, 0]) { camera.position.set(target[0] + dist * Math.cos(el) * Math.sin(az), target[1] + dist * Math.sin(el), target[2] + dist * Math.cos(el) * Math.cos(az)); camera.lookAt(target[0], target[1], target[2]); },
    add(...o) { scene.add(...o); return o[0]; },
  };
  return st;
}

/* ─────────────────────────── Arabic text ─────────────────────────── */
const AR_INDIC = '٠١٢٣٤٥٦٧٨٩', FA_INDIC = '۰۱۲۳۴۵۶۷۸۹';
const westernDigits = s => String(s).replace(/[٠-٩]/g, d => AR_INDIC.indexOf(d)).replace(/[۰-۹]/g, d => FA_INDIC.indexOf(d));
// joining classes (Unicode ArabicShaping): D = dual, R = right-only (does not connect to the following letter)
const DUAL = new Set('بتثجحخسشصضطظعغفقكلمنهيئىـپچگکیڤ'.split(''));
const RIGHT = new Set('اأإآدذرزوؤةٱژ'.split(''));
const HARAKAT = /[ً-ٰٟۖ-ۭ]/;
const isJoinable = ch => DUAL.has(ch) || RIGHT.has(ch);
let FAMS = { display: 'Lalezar', body: 'IBM Plex Sans Arabic', num: 'Inter', kufi: 'Noto Kufi Arabic', cairo: 'Cairo' };
function fontStr(family = 'body', weight = 700, size = 80) { const fam = FAMS[family] || family; return `${weight} ${size}px "${fam}"`; }
function applyFont(X, o) { X.font = o.font || fontStr(o.family || 'body', o.weight ?? 700, o.size || 80); }
/* kashida positions: after a dual-joining letter, when the next base letter joins; priority ranked (seen/sad/lam-final zones first) */
function kashidaSlots(word) {
  const ch = [...word], slots = [];
  for (let i = 0; i < ch.length - 1; i++) {
    if (!DUAL.has(ch[i])) continue;
    let j = i + 1; while (j < ch.length && HARAKAT.test(ch[j])) j++;       // insert after diacritics
    if (j >= ch.length || !isJoinable(ch[j])) continue;
    if (ch[i] === 'ل' && 'اأإآ'.includes(ch[j])) continue;                 // keep lam-alef ligature
    const pr = ('سشصض'.includes(ch[i]) ? 3 : 0) + ('بتثنيئ'.includes(ch[i]) && j === ch.length - 1 ? -1 : 0) + (j === ch.length - 1 ? 2 : 0) + ('ـ' === ch[i] ? -5 : 0);
    slots.push({ at: j, pr });
  }
  return slots.sort((a, b) => b.pr - a.pr);
}
/* kashida(str, targetWidth, X/font) → {text, scaleX, width, count} — inserts tatweel (U+0640) round-robin until width reached */
function kashida(X, str, target, o = {}) {
  if (o.font || o.size) applyFont(X, o);
  str = westernDigits(str);
  const base = X.measureText(str).width;
  if (target <= base) return { text: str, scaleX: target / base, width: target, count: 0, base };
  const words = str.split(' ');
  const slots = []; words.forEach((w, wi) => kashidaSlots(w).forEach(s => slots.push({ wi, at: s.at, pr: s.pr })));
  if (!slots.length) return { text: str, scaleX: target / base, width: target, count: 0, base };
  slots.sort((a, b) => b.pr - a.pr);
  const counts = new Array(slots.length).fill(0);
  const build = () => words.map((w, wi) => { const ch = [...w]; const ins = slots.map((s, k) => ({ ...s, n: counts[k] })).filter(s => s.wi === wi && s.n > 0).sort((a, b) => b.at - a.at); ins.forEach(s => ch.splice(s.at, 0, 'ـ'.repeat(s.n))); return ch.join(''); }).join(' ');
  let text = str, width = base, n = 0, guard = 0, maxPer = o.maxPerSlot || 40;
  while (guard++ < 2000) {
    const k = n % slots.length; if (counts[k] >= maxPer) break; counts[k]++;
    const tt = build(), ww = X.measureText(tt).width;
    if (ww > target) { counts[k]--; break; }
    text = tt; width = ww; n++;
  }
  return { text, scaleX: target / width, width: target, count: n, base };
}
/* simple bidi: word list in visual order (RTL line), keeping runs of Latin words LTR */
const isLatin = w => /[A-Za-z]/.test(w) && !/[؀-ۿ]/.test(w);
const isNum = w => /^[\d.,%+\-$:/]+$/.test(w);
function visualOrder(words) {                          // returns indices in right→left placement order
  const idx = words.map((_, i) => i), out = [];
  let i = 0;
  while (i < idx.length) {
    if (isLatin(words[i])) {
      let j = i; while (j + 1 < words.length && (isLatin(words[j + 1]) || (isNum(words[j + 1]) && j + 2 < words.length && isLatin(words[j + 2])))) j++;
      for (let k = j; k >= i; k--) out.push(k); i = j + 1;
    } else { out.push(i); i++; }
  }
  return out;
}
/* layout(X, str, {family,weight,size,maxWidth,lineHeight,letterSpacing}) → {lines:[{words:[{text,i,x,w}],width,y}],width,height,size,ascent}
   x of each word = its LEFT edge relative to line's right edge going left (negative numbers); use drawLayout to place */
function layout(X, str, o = {}) {
  X.save(); applyFont(X, o);
  str = westernDigits(str);
  const size = o.size || 80, lh = (o.lineHeight || 1.35) * size, maxW = o.maxWidth || 1e9, sp = X.measureText(' ').width * (o.wordSpacing || 1);
  const words = str.split(/\s+/).filter(Boolean), W = words.map(w => X.measureText(w).width);
  const lines = []; let cur = [], cw = 0;
  words.forEach((w, i) => { const add = (cur.length ? sp : 0) + W[i]; if (cur.length && cw + add > maxW) { lines.push(cur); cur = []; cw = 0; } cur.push(i); cw += (cur.length > 1 ? sp : 0) + W[i]; });
  if (cur.length) lines.push(cur);
  const m = X.measureText('أبجد Hg'); X.restore();
  const out = lines.map((li, L) => {
    const ws = li.map(i => words[i]), order = visualOrder(ws);
    let x = 0; const placed = [];
    order.forEach(k => { const i = li[k]; placed.push({ text: words[i], i, x: x - W[i], w: W[i], line: L }); x -= W[i] + sp; });
    const width = -x - sp;
    placed.sort((a, b) => a.i - b.i);
    return { words: placed, width, y: L * lh };
  });
  return { lines: out, width: Math.max(0, ...out.map(l => l.width)), height: (out.length - 1) * lh + size, size, lh, words, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent, o };
}
/* drawLayout(X, L, x, y, {align:'center'|'right'|'left', color, perWord:(i,word,box)=>({alpha,dx,dy,scale,rot,color,reveal,clipUp,skip})})
   (x,y) = anchor: align point horizontally, first baseline vertically. Returns word boxes in canvas coords. */
function drawLayout(X, L, x, y, o = {}) {
  const align = o.align || 'center', boxes = [];
  X.save(); applyFont(X, L.o); X.direction = 'rtl'; X.textAlign = 'left'; X.textBaseline = 'alphabetic';
  for (const line of L.lines) {
    const right = align === 'right' ? x : align === 'left' ? x + line.width : x + line.width / 2;
    for (const w of line.words) {
      const bx = right + w.x, by = y + line.y, box = { x: bx, y: by - L.size * 0.95, w: w.w, h: L.size * 1.3, cx: bx + w.w / 2, cy: by - L.size * 0.32, base: by, text: w.text, i: w.i };
      boxes.push(box);
      const st = o.perWord ? (o.perWord(w.i, w.text, box) || {}) : {};
      if (st.skip || st.alpha === 0) continue;
      X.save();
      if (st.alpha != null) X.globalAlpha *= clamp(st.alpha);
      if (st.clip || st.reveal != null || st.clipUp != null) {         // masks
        X.beginPath();
        if (st.reveal != null) { const rw = (box.w + 20) * clamp(st.reveal); X.rect(box.x + box.w + 10 - rw, box.y - L.size * .3, rw, box.h + L.size * .6); }   // RTL wipe
        else if (st.clipUp != null) X.rect(box.x - 20, box.y - L.size * .3, box.w + 40, box.h + L.size * .3);                                           // rise from below baseline
        else X.rect(st.clip.x, st.clip.y, st.clip.w, st.clip.h);
        X.clip();
      }
      X.translate(box.cx + (st.dx || 0), box.cy + (st.dy || 0)); if (st.rot) X.rotate(st.rot); if (st.scale != null) X.scale(st.scale, st.scaleY ?? st.scale);
      X.translate(-box.cx, -box.cy);
      if (st.shadow) { X.shadowColor = st.shadow.color || 'rgba(0,0,0,.3)'; X.shadowBlur = st.shadow.blur || 20; X.shadowOffsetY = st.shadow.y || 8; }
      if (st.stroke) { X.lineJoin = 'round'; X.lineWidth = st.stroke.width || 8; X.strokeStyle = st.stroke.color || '#000'; X.strokeText(w.text, box.x, box.base); }
      X.fillStyle = st.color || o.color || S.P.ink || '#111';
      X.fillText(w.text, box.x, box.base);
      X.restore();
    }
  }
  X.restore();
  return boxes;
}
/* one-call text: text(X, str, x, y, {family,weight,size,color,align,maxWidth(→shrink),stroke,shadow,alpha}) */
function text(X, str, x, y, o = {}) {
  X.save(); applyFont(X, o); str = westernDigits(str);
  X.direction = o.dir || (/[؀-ۿ]/.test(str) ? 'rtl' : 'ltr'); X.textAlign = o.align || 'center'; X.textBaseline = o.baseline || 'alphabetic';
  if (o.letterSpacing) try { X.letterSpacing = o.letterSpacing + 'px'; } catch (e) { }
  let sx = 1; if (o.maxWidth) { const w = X.measureText(str).width; if (w > o.maxWidth) sx = o.maxWidth / w; }
  if (o.alpha != null) X.globalAlpha *= o.alpha;
  X.translate(x, y); if (sx !== 1 || o.scaleX) X.scale(sx * (o.scaleX || 1), 1);
  if (o.shadow) { X.shadowColor = o.shadow.color || 'rgba(0,0,0,.35)'; X.shadowBlur = o.shadow.blur || 24; X.shadowOffsetY = o.shadow.y || 10; }
  if (o.stroke) { X.lineJoin = 'round'; X.lineWidth = o.stroke.width || 8; X.strokeStyle = o.stroke.color || '#000'; X.strokeText(str, 0, 0); }
  if (o.color !== null) { X.fillStyle = o.color || S.P.ink || '#111'; X.fillText(str, 0, 0); }
  X.restore();
}
/* drawKashida: stretch a line to width `w` (amount 0..1 animates from natural width to w) — anchored at (x,y) by align */
function drawKashida(X, str, x, y, w, o = {}, amount = 1) {
  X.save(); applyFont(X, o);
  const base = X.measureText(westernDigits(str)).width, target = lerp(base, w, clamp(amount));
  const K = kashida(X, str, target);
  X.direction = 'rtl'; X.textAlign = o.align || 'center'; X.textBaseline = 'alphabetic';
  X.translate(x, y); X.scale(K.scaleX, 1);
  if (o.stroke) { X.lineJoin = 'round'; X.lineWidth = o.stroke.width || 8; X.strokeStyle = o.stroke.color; X.strokeText(K.text, 0, 0); }
  X.fillStyle = o.color || S.P.ink || '#111'; X.fillText(K.text, 0, 0);
  X.restore(); return K;
}
/* fit(X, str, {family,weight,box:{w,h},lineHeight,min,max}) → {size, layout} biggest size that fits */
function fit(X, str, o = {}) {
  let lo = o.min || 20, hi = o.max || 400, best = lo;
  for (let i = 0; i < 18; i++) { const mid = (lo + hi) / 2, L = layout(X, str, { ...o, size: mid, maxWidth: o.box.w }); if (L.width <= o.box.w && L.height + mid * .35 <= o.box.h && (o.maxLines ? L.lines.length <= o.maxLines : true)) { best = mid; lo = mid; } else hi = mid; }
  best = Math.floor(best); return { size: best, layout: layout(X, str, { ...o, size: best, maxWidth: o.box.w }) };
}
/* typewriter substring that keeps the joining form of the last letter (ZWJ) */
function typeSub(str, k) { const ch = [...westernDigits(str)], n = Math.round(clamp(k) * ch.length); const s = ch.slice(0, n).join(''); return n < ch.length && n > 0 && DUAL.has(ch[n - 1]) ? s + '‍' : s; }
/* text → offscreen canvas (for 3D textures / caching). returns {canvas, w, h} */
function textCanvas(str, o = {}) {
  const size = o.size || 200, pad = o.pad ?? Math.round(size * 0.35);
  const tmp = makeCanvas(8, 8).getContext('2d'); applyFont(tmp, { ...o, size }); str = westernDigits(str);
  tmp.direction = 'rtl'; const m = tmp.measureText(str);
  const w = Math.ceil(m.width + pad * 2), h = Math.ceil(size * 1.6 + pad * 2);
  const c = makeCanvas(w, h), X = c.getContext('2d'); applyFont(X, { ...o, size });
  X.direction = /[؀-ۿ]/.test(str) ? 'rtl' : 'ltr'; X.textAlign = 'center'; X.textBaseline = 'middle';
  if (o.glowBlur) { X.shadowColor = o.color || '#fff'; X.shadowBlur = o.glowBlur; }
  if (o.stroke) { X.lineJoin = 'round'; X.lineWidth = o.stroke.width; X.strokeStyle = o.stroke.color; X.strokeText(str, w / 2, h / 2 + size * 0.08); }
  X.fillStyle = o.color || '#ffffff'; X.fillText(str, w / 2, h / 2 + size * 0.08);
  return { canvas: c, w, h };
}
function textTexture(str, o = {}) {
  const { canvas, w, h } = textCanvas(str, o); const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter; tex.needsUpdate = true;
  return { tex, w, h, aspect: w / h };
}
/* 3D text plane. o: {height (world units of the canvas box), color, glow (HDR multiplier >1 → bloom), family, weight, size (px), lit:false} */
function textPlane(str, o = {}) {
  const T = textTexture(str, { ...o, color: '#ffffff' });
  const hgt = o.height || 1, geo = new THREE.PlaneGeometry(hgt * T.aspect, hgt);
  const col = new THREE.Color(o.color || '#ffffff'); if (o.glow) col.multiplyScalar(o.glow);
  const mat = o.lit ? new THREE.MeshStandardMaterial({ map: T.tex, color: col, transparent: true, roughness: .6, metalness: 0, side: THREE.DoubleSide })
    : new THREE.MeshBasicMaterial({ map: T.tex, color: col, transparent: true, side: THREE.DoubleSide, toneMapped: o.toneMapped ?? !o.glow });
  const mesh = new THREE.Mesh(geo, mat); mesh.userData.textInfo = T; return mesh;
}
/* stacked-layer "extruded" 3D text: front face + N alpha-tested layers going back. o: {height, depth, layers, color, sideColor, sideColor2, glow, family, weight, size} */
function extrudedText(str, o = {}) {
  const T = textTexture(str, { ...o, color: '#ffffff' });
  const hgt = o.height || 1, depth = o.depth ?? hgt * 0.22, n = o.layers || 28;
  const geo = new THREE.PlaneGeometry(hgt * T.aspect, hgt), g = new THREE.Group();
  const c1 = new THREE.Color(o.sideColor || '#7a2f18'), c2 = new THREE.Color(o.sideColor2 || o.sideColor || '#3a150a');
  for (let i = n; i >= 1; i--) {
    const m = new THREE.MeshBasicMaterial({ map: T.tex, color: c1.clone().lerp(c2, i / n), alphaTest: 0.5, side: THREE.DoubleSide, toneMapped: true });
    const p = new THREE.Mesh(geo, m); p.position.z = -depth * i / n; p.renderOrder = -i; g.add(p);
  }
  const fc = new THREE.Color(o.color || '#ffffff'); if (o.glow) fc.multiplyScalar(o.glow);
  const front = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: T.tex, color: fc, transparent: true, side: THREE.DoubleSide, toneMapped: !o.glow, depthWrite: false }));
  front.position.z = 0.001; front.renderOrder = 1; g.add(front); g.userData = { front, textInfo: T };
  return g;
}

/* ─────────────────────────── particles ─────────────────────────── */
/* 3D instanced particles, analytic motion (no integration → deterministic at any t).
   o: {count, seed, geometry:'sphere'|'box'|'tetra'|'octa'|'plane'|'rounded'|THREE.BufferGeometry, size, color, glow, material,
       spawn:(i,r)=>({p:[x,y,z], v:[x,y,z], s, spin:[x,y,z], delay, life, color}), gravity:[x,y,z], drag} → {mesh, update(lt)} */
function particles3D(o = {}) {
  const n = o.count || 200, r = rng(o.seed ?? 7);
  const geoms = { sphere: () => new THREE.IcosahedronGeometry(0.5, 2), box: () => new THREE.BoxGeometry(1, 1, 1), tetra: () => new THREE.TetrahedronGeometry(0.6), octa: () => new THREE.OctahedronGeometry(0.6), plane: () => new THREE.PlaneGeometry(1, 1), rounded: () => new RoundedBoxGeometry(1, 1, 1, 3, 0.18) };
  const geo = o.geometry instanceof THREE.BufferGeometry ? o.geometry : (geoms[o.geometry || 'sphere'])();
  const col = new THREE.Color(o.color || '#ffffff'); if (o.glow) col.multiplyScalar(o.glow);
  const mat = o.material || new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: !o.glow });
  const mesh = new THREE.InstancedMesh(geo, mat, n); mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const P = []; for (let i = 0; i < n; i++) {
    const s = (o.spawn ? o.spawn(i, r) : { p: [r.range(-3, 3), r.range(-5, 5), r.range(-3, 3)], v: [r.gauss() * .2, r.range(.2, .8), r.gauss() * .2], s: r.range(.02, .08) }) || {};
    P.push({ p: s.p || [0, 0, 0], v: s.v || [0, 0, 0], s: s.s ?? 0.05, spin: s.spin || [r.range(-2, 2), r.range(-2, 2), 0], delay: s.delay || 0, life: s.life || 1e9, rot0: [r() * 6.28, r() * 6.28, r() * 6.28] });
    const c = s.color ? new THREE.Color(s.color) : col.clone(); if (s.color && o.glow) c.multiplyScalar(o.glow); mesh.setColorAt(i, c);
  }
  const g = o.gravity || [0, 0, 0], d = o.drag || 0, m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
  const update = (lt) => {
    for (let i = 0; i < n; i++) {
      const Pi = P[i], a = lt - Pi.delay;
      if (a < 0 || a > Pi.life) { m4.makeScale(0, 0, 0); mesh.setMatrixAt(i, m4); continue; }
      const disp = d > 0 ? (1 - Math.exp(-d * a)) / d : a;
      pos.set(Pi.p[0] + Pi.v[0] * disp + .5 * g[0] * a * a, Pi.p[1] + Pi.v[1] * disp + .5 * g[1] * a * a, Pi.p[2] + Pi.v[2] * disp + .5 * g[2] * a * a);
      e.set(Pi.rot0[0] + Pi.spin[0] * a, Pi.rot0[1] + Pi.spin[1] * a, Pi.rot0[2] + Pi.spin[2] * a); q.setFromEuler(e);
      const lifeK = Pi.life < 1e8 ? Math.sin(Math.PI * clamp(a / Pi.life)) : clamp(a / 0.25);
      const s = Pi.s * (o.sizeOverLife ? o.sizeOverLife(a, Pi, i) : lifeK); sc.set(s, s, s);
      m4.compose(pos, q, sc); mesh.setMatrixAt(i, m4);
    }
    mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  update(0);
  return { mesh, update, data: P };
}
/* 2D particles: {count, seed, spawn:(i,r)=>({x,y,vx,vy,r,color,delay,life,shape:'circle'|'rect'|'tri'}), gravity, drag} → draw(X, lt) */
function particles2D(o = {}) {
  const n = o.count || 60, r = rng(o.seed ?? 3), P = [];
  for (let i = 0; i < n; i++) { const s = o.spawn ? o.spawn(i, r) : { x: r.range(0, S.W), y: r.range(0, S.H), vx: r.gauss() * 20, vy: -r.range(20, 80), r: r.range(2, 6) }; P.push({ life: 1e9, delay: 0, color: S.P.acc, shape: 'circle', rot: r() * 6.28, spin: r.range(-3, 3), ...s }); }
  const g = o.gravity || [0, 0], d = o.drag || 0;
  return {
    data: P,
    draw(X, lt, alpha = 1) {
      X.save();
      for (const p of P) {
        const a = lt - p.delay; if (a < 0 || a > p.life) continue;
        const disp = d > 0 ? (1 - Math.exp(-d * a)) / d : a, x = p.x + p.vx * disp + .5 * g[0] * a * a, y = p.y + p.vy * disp + .5 * g[1] * a * a;
        const k = p.life < 1e8 ? Math.sin(Math.PI * clamp(a / p.life)) : 1;
        X.globalAlpha = alpha * k; X.fillStyle = p.color;
        X.save(); X.translate(x, y); X.rotate(p.rot + p.spin * a);
        if (p.shape === 'rect') X.fillRect(-p.r, -p.r * .45, p.r * 2, p.r * .9);
        else if (p.shape === 'tri') { X.beginPath(); X.moveTo(0, -p.r); X.lineTo(p.r * .87, p.r * .5); X.lineTo(-p.r * .87, p.r * .5); X.closePath(); X.fill(); }
        else { X.beginPath(); X.arc(0, 0, p.r, 0, 6.2832); X.fill(); }
        X.restore();
      }
      X.restore();
    }
  };
}

/* ─────────────────────────── hand-drawn strokes ─────────────────────────── */
const _pathCache = new Map();
function pathInfo(src, smooth = true) {
  const key = typeof src === 'string' ? src : JSON.stringify(src) + smooth;
  if (_pathCache.has(key)) return _pathCache.get(key);
  let d = src;
  if (Array.isArray(src)) {                              // points → (catmull-rom) path string
    const p = src; d = `M${p[0][0]} ${p[0][1]}`;
    if (!smooth || p.length < 3) for (let i = 1; i < p.length; i++) d += ` L${p[i][0]} ${p[i][1]}`;
    else for (let i = 0; i < p.length - 1; i++) { const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2; d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`; }
  }
  const el = document.createElementNS('http://www.w3.org/2000/svg', 'path'); el.setAttribute('d', d);
  const info = { d, path: new Path2D(d), len: el.getTotalLength(), el, at: l => { const q = el.getPointAtLength(l); return [q.x, q.y]; } };
  _pathCache.set(key, info); return info;
}
/* drawPath(X, svgD|points, k(0..1), {width,color,cap,smooth,tip:{r,color,glow},glow,from(0..1)}) → pen tip [x,y] */
function drawPath(X, src, k, o = {}) {
  const P = pathInfo(src, o.smooth !== false), L = P.len, a = clamp(o.from || 0) * L, b = clamp(k) * L;
  if (b <= a) return null;
  X.save(); X.lineCap = o.cap || 'round'; X.lineJoin = 'round'; X.lineWidth = o.width || 8; X.strokeStyle = o.color || S.P.acc;
  X.setLineDash([b - a, L + 10]); X.lineDashOffset = -a;
  if (o.glow) { X.shadowColor = o.glowColor || o.color || S.P.acc; X.shadowBlur = o.glow; }
  X.stroke(P.path); X.restore();
  const tip = P.at(b);
  if (o.tip && k < 1) { X.save(); X.fillStyle = o.tip.color || '#fff'; if (o.tip.glow) { X.shadowColor = o.tip.color || '#fff'; X.shadowBlur = o.tip.glow; } X.beginPath(); X.arc(tip[0], tip[1], o.tip.r || 7, 0, 6.2832); X.fill(); X.restore(); }
  return tip;
}

/* ─────────────────────────── timeline · beats · vo ─────────────────────────── */
function beatIndex(t) { const B = S.beats; if (!B.length || t < B[0]) return -1; let lo = 0, hi = B.length - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (B[m] <= t) lo = m; else hi = m - 1; } return lo; }
function beatTime(i) { const B = S.beats; if (i < 0) return B[0] - (S.spb * -i); if (i < B.length) return B[i]; return B[B.length - 1] + (i - B.length + 1) * S.spb; }
function beatPhase(t) { const i = beatIndex(t); if (i < 0) return 0; return clamp((t - beatTime(i)) / S.spb); }
function beatPulse(t, decay = 8, every = 1) { let i = beatIndex(t); if (i < 0) return 0; i -= i % every; return Math.exp(-decay * (t - beatTime(i))); }
function barIndex(t) { const i = beatIndex(t); return i < 0 ? -1 : Math.floor(i / S.bpb); }
function onBar(t, n = 1) { const i = beatIndex(t); return i >= 0 && i % (S.bpb * n) === 0 && (t - beatTime(i)) < 1 / S.fps; }
function barPulse(t, decay = 5) { return beatPulse(t, decay, S.bpb); }
function nearestBeat(t) { const i = beatIndex(t); if (i < 0) return S.beats[0] ?? 0; const a = beatTime(i), b = beatTime(i + 1); return (t - a) < (b - t) ? a : b; }
function section(t) { return (S.tl.sections || []).find(s => t >= s.start && t < s.end) || null; }
function line(id) { const L = S.vo[id]; if (!L) throw new Error('unknown vo line: ' + id); return L; }
function wordTime(id, i) { const L = line(id), w = L.words[Math.max(0, Math.min(L.words.length - 1, i < 0 ? L.words.length + i : i))]; return w ? { s: w.s, e: w.e, w: w.w } : { s: L.start, e: L.end, w: '' }; }
function lineSpan(id) { const L = line(id); return { s: L.start, e: L.end, text: L.text }; }
function wordsOf(id) { return line(id).words; }
function activeWord(t, id) { const lines = id ? [line(id)] : S.voList; for (const L of lines) for (let i = 0; i < L.words.length; i++) { const w = L.words[i]; if (t >= w.s && t < (L.words[i + 1] ? L.words[i + 1].s : w.e + 0.15)) return { line: L.id, i, ...w }; } return null; }

/* ─────────────────────────── transitions ─────────────────────────── */
/* comp(OX, A(layer canvas out), B(layer canvas in), k 0..1, o) — everything in device pixels */
const TR = {
  cut(X, A, B, k) { X.drawImage(k < .5 ? A : B, 0, 0); },
  crossfade(X, A, B, k) { X.drawImage(A, 0, 0); X.globalAlpha = k; X.drawImage(B, 0, 0); X.globalAlpha = 1; },
  dip(X, A, B, k, o) { const c = o.color || S.P.ink; X.drawImage(k < .5 ? A : B, 0, 0); X.fillStyle = c; X.globalAlpha = 1 - Math.abs(k * 2 - 1); X.fillRect(0, 0, A.width, A.height); X.globalAlpha = 1; },
  flash(X, A, B, k, o) { TR.dip(X, A, B, k, { color: o.color || '#fff' }); },
  wipe(X, A, B, k, o) {   // directional wipe with accent edge. o.dir: 'rtl'|'ltr'|'up'|'down'
    const w = A.width, h = A.height, dir = o.dir || 'rtl', e = E.expoInOut(k), bar = (o.bar ?? 26) * SCALE;
    X.drawImage(A, 0, 0); X.save(); X.beginPath();
    let edge;
    if (dir === 'rtl') { edge = w * (1 - e); X.rect(edge, 0, w - edge, h); } else if (dir === 'ltr') { edge = w * e; X.rect(0, 0, edge, h); }
    else if (dir === 'up') { edge = h * (1 - e); X.rect(0, edge, w, h - edge); } else { edge = h * e; X.rect(0, 0, w, edge); }
    X.clip(); X.drawImage(B, 0, 0); X.restore();
    if (k > 0 && k < 1) { X.fillStyle = o.color || S.P.acc; if (dir === 'rtl' || dir === 'ltr') X.fillRect(edge - bar / 2, 0, bar, h); else X.fillRect(0, edge - bar / 2, w, bar); }
  },
  push(X, A, B, k, o) {   // slide both, RTL by default (new scene enters from the left in RTL reading? → from right)
    const w = A.width, h = A.height, e = E.quartInOut(k), s = (o.dir === 'ltr' ? 1 : -1), vert = o.dir === 'up' || o.dir === 'down', sv = o.dir === 'down' ? 1 : -1;
    if (vert) { X.drawImage(A, 0, sv * e * h); X.drawImage(B, 0, sv * (e - 1) * h); }
    else { X.drawImage(A, -s * e * w, 0); X.drawImage(B, -s * (e - 1) * w, 0); }
  },
  zoom(X, A, B, k) {      // outgoing scales up & fades, incoming scales from .85
    const w = A.width, h = A.height, e = E.expoInOut(k);
    X.save(); X.translate(w / 2, h / 2); X.scale(1 + e * .6, 1 + e * .6); X.globalAlpha = 1 - e; X.drawImage(A, -w / 2, -h / 2); X.restore();
    X.save(); X.translate(w / 2, h / 2); const s = lerp(.82, 1, e); X.scale(s, s); X.globalAlpha = e; X.drawImage(B, -w / 2, -h / 2); X.restore();
  },
  iris(X, A, B, k, o) {   // circle reveal from point o.at=[x,y] (design px)
    const w = A.width, h = A.height, c = o.at ? [o.at[0] * SCALE, o.at[1] * SCALE] : [w / 2, h / 2], R = Math.hypot(w, h) * E.expoIn(k) * 1.05 + 1;
    X.drawImage(A, 0, 0); X.save(); X.beginPath(); X.arc(c[0], c[1], R, 0, 6.2832); X.clip(); X.drawImage(B, 0, 0); X.restore();
    if (o.ring !== false && k > 0 && k < 1) { X.strokeStyle = o.color || S.P.acc; X.lineWidth = 18 * SCALE; X.beginPath(); X.arc(c[0], c[1], R, 0, 6.2832); X.stroke(); }
  },
  blinds(X, A, B, k, o) {
    const w = A.width, h = A.height, n = o.n || 8, bh = h / n; X.drawImage(A, 0, 0);
    for (let i = 0; i < n; i++) { const kk = E.expoOut(clamp(k * 1.6 - i * (0.6 / n))); X.save(); X.beginPath(); X.rect(0, i * bh, w, bh * kk); X.clip(); X.drawImage(B, 0, 0); X.restore(); }
  },
  glitch(X, A, B, k, o) { // seeded slice displacement, deterministic by frame
    const w = A.width, h = A.height, src = k < .5 ? A : B, amp = Math.sin(Math.PI * k), r = rng(Math.floor(k * 24) + 99), n = 14;
    X.drawImage(src, 0, 0);
    for (let i = 0; i < n; i++) { const y = r() * h, sh = r.range(8, 90) * SCALE, dx = r.gauss() * 120 * SCALE * amp; X.drawImage(src, 0, y, w, sh, dx, y, w, sh); }
    if (amp > .2) { X.globalCompositeOperation = 'screen'; X.globalAlpha = .45 * amp; X.drawImage(src, 14 * SCALE * amp, 0); X.globalCompositeOperation = 'source-over'; X.globalAlpha = 1; }
  },
};
M.transitions = TR;

/* ─────────────────────────── post (grain · vignette · safe zone) ─────────────────────────── */
let grainTiles = null;
function grain(X, t, amt) {
  if (!grainTiles) { grainTiles = []; for (let g = 0; g < 6; g++) { const c = makeCanvas(256, 256), x = c.getContext('2d'), id = x.createImageData(256, 256), r = rng(1000 + g); for (let i = 0; i < id.data.length; i += 4) { const v = 128 + r.gauss() * 48; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } x.putImageData(id, 0, 0); grainTiles.push(c); } }
  const f = Math.round(t * S.fps), tile = grainTiles[f % 6], r = rng(f + 7), pat = X.createPattern(tile, 'repeat');
  pat.setTransform(new DOMMatrix().translate(r() * 256, r() * 256));
  X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.globalCompositeOperation = 'overlay'; X.globalAlpha = amt; X.fillStyle = pat; X.fillRect(0, 0, OUT.width, OUT.height); X.restore();
}
function vignette(X, amt) {
  const w = OUT.width, h = OUT.height; X.save(); X.setTransform(1, 0, 0, 1, 0, 0);
  const g = X.createRadialGradient(w / 2, h / 2, h * .28, w / 2, h / 2, h * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${amt})`);
  X.fillStyle = g; X.fillRect(0, 0, w, h); X.restore();
}
function safeOverlay(X) {                               // reels safe zone (1080x1920 design px)
  X.save(); baseT(X);
  X.fillStyle = 'rgba(255,0,60,.28)'; X.fillRect(0, 0, 1080, 150); X.fillRect(0, 1620, 1080, 300); X.fillRect(950, 1100, 130, 520);
  X.fillStyle = 'rgba(255,190,0,.22)'; X.fillRect(0, 1500, 1080, 120);
  X.strokeStyle = 'rgba(255,0,60,.9)'; X.lineWidth = 3; X.setLineDash([14, 10]); X.strokeRect(0, 150, 1080, 1470); X.strokeRect(950, 1100, 130, 650);
  X.setLineDash([]); X.fillStyle = '#fff'; X.font = '600 26px Inter'; X.textAlign = 'left'; X.fillText('SAFE ZONE', 20, 190);
  X.restore();
}

/* ─────────────────────────── ctx ─────────────────────────── */
const CUR = { X: null, scene: null };
function makeCtx(sc) {
  const ctx = {
    THREE, RoundedBoxGeometry, BufferGeometryUtils, EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass,
    get X() { return CUR.X; }, get OUT() { return OX; },
    W: S.W, H: S.H, fps: S.fps, get P() { return S.P; }, get palette() { return S.P; }, project: S.proj, timeline: S.tl, scene: sc,
    rng: (salt = '') => rng(hashStr(sc.id + '|' + salt)), seeded: rng, noise1, noise2, fbm, hash01,
    E, ease: E, clamp, lerp, prog, map, smoothstep, fract, kf,
    /* sub-timeline helper: at(lt, a, b, easeName|fn) = eased progress between local times a..b */
    at: (lt, a, b, ez = 'cubicOut') => (typeof ez === 'function' ? ez : E[ez])(prog(lt, a, b)),
    resetTransform: X => { (X || CUR.X).setTransform(SCALE, 0, 0, SCALE, 0, 0); },
    // beats
    bpm: S.bpm, spb: S.spb, beats: S.beats, bars: S.bars, beatIndex, beatTime, beatPhase, beatPulse, barIndex, onBar, barPulse, nearestBeat, section,
    // vo
    wordTime, lineSpan, wordsOf, activeWord, vo: S.vo,
    // text
    font: fontStr, F: fontStr, text: Object.assign((X, s, x, y, o) => text(X, s, x, y, o), { draw: text, layout, drawLayout, kashida, drawKashida, fit, typeSub, canvas: textCanvas, westernDigits, visualOrder }),
    num: (v, d = 0) => westernDigits(Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })),
    textTexture, textPlane, extrudedText,
    // 3D
    stage3D, renderer: () => getRenderer().renderer,
    // fx
    particles3D, particles2D, drawPath, pathInfo,
    // images
    images: S.images, img: name => S.images[name],
    // motion-kit (2D) — globals X/BG/INK/ACC/FONT are set before every draw
    get MK() { return G.MK; },
  };
  return ctx;
}

/* ─────────────────────────── boot ─────────────────────────── */
async function j(url) { const r = await fetch(url, { cache: 'no-store' }); if (!r.ok) throw new Error(url + ' → ' + r.status); return r.json(); }
async function jOpt(url) { try { return await j(url); } catch (e) { return null; } }
function loadImage(url) { return new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('image ' + url)); im.src = url; }); }

async function boot() {
  try {
    const proj = S.proj = await j(PROJ + 'project.json');
    S.W = proj.width || 1080; S.H = proj.height || 1920; S.fps = proj.fps || 60;
    S.P = Object.assign({ bg: '#F0EBE0', ink: '#1B1A17', acc: '#D97757', clay: '#C15F3C', hi: '#E8A283', mut: '#8A847A' }, proj.palette || {});
    FAMS = Object.assign(FAMS, proj.fonts || {});
    const tl = S.tl = (await jOpt(PROJ + 'timeline.json')) || {};
    S.bpm = tl.bpm || proj.bpm || 120; S.spb = 60 / S.bpm; S.bpb = tl.beatsPerBar || proj.beatsPerBar || 4;
    await loadFonts((proj.extraFonts || []).map(f => ({ fam: f.family, url: PROJ + f.file, weight: f.weight || '400' })));
    // images: project.images {name: 'assets/x.png'}; '@logo/claude_mark' → hook-assets logos
    S.images = {};
    await Promise.all(Object.entries(proj.images || {}).map(async ([k, v]) => { S.images[k] = await loadImage(v.startsWith('@logos/') ? '/@logos/' + v.slice(7) : PROJ + v); }));
    // scenes: import each file (scene files call MOTION.scene)
    const list = (tl.scenes && tl.scenes.length ? tl.scenes : proj.scenes) || [];
    const files = [...new Set(list.map(s => s.file || ('scenes/' + s.id + '.js')))];
    for (const f of files) await import(PROJ + f);   // server sends no-cache headers
    // merge timeline windows with defs
    const byId = Object.fromEntries(list.map(s => [s.id, s]));
    S.scenes = defs.map((d, i) => {
      const T = byId[d.id] || {};
      const start = T.start ?? d.start ?? 0, end = T.end ?? d.end ?? (start + (d.duration || 2));
      return { ...d, start, end, dur: end - start, transition: T.transition || d.transition || null, order: list.findIndex(s => s.id === d.id), lines: T.lines || d.lines || [] };
    }).sort((a, b) => a.start - b.start || a.order - b.order);
    S.dur = tl.duration ?? proj.duration ?? Math.max(...S.scenes.map(s => s.end));
    // beats (from timeline, else from bpm)
    if (tl.beats && tl.beats.length) S.beats = tl.beats; else { const off = proj.beatOffset || 0; S.beats = []; for (let t = off; t < S.dur + S.spb * 8; t += S.spb) S.beats.push(+t.toFixed(6)); }
    S.bars = S.beats.filter((_, i) => i % S.bpb === 0);
    // vo lines with absolute word times
    S.voList = (tl.vo || []).map(L => ({ ...L, words: (L.words || []).map(w => ({ w: w.w, s: w.s, e: w.e })) }));
    S.vo = Object.fromEntries(S.voList.map(L => [L.id, L]));
    // canvas
    OUT.width = Math.round(S.W * SCALE); OUT.height = Math.round(S.H * SCALE); OX = OUT.getContext('2d');
    // motion-kit shim globals
    G.BG = S.P.bg; G.INK = S.P.ink; G.ACC = S.P.acc; G.CLAY = S.P.clay; G.MUT = S.P.mut; G.FONT = FAMS[proj.mkFont || 'body'] ? `"${FAMS[proj.mkFont || 'body']}"` : '"IBM Plex Sans Arabic"';
    // setup
    for (const sc of S.scenes) { sc.ctx = makeCtx(sc); CUR.scene = sc; if (sc.setup) await sc.setup(sc.ctx); }
    M.info = { W: S.W, H: S.H, fps: S.fps, duration: S.dur, frames: Math.round(S.dur * S.fps), scale: SCALE, bpm: S.bpm, scenes: S.scenes.map(s => ({ id: s.id, start: s.start, end: s.end, transition: s.transition })), gpu: M.gpu || null };
    M.ready = true;
    if (!RENDER_MODE) player();
  } catch (e) { fail(e); }
}
function fail(e) { M.error = String(e && e.stack || e); console.error(e); const el = document.getElementById('err'); el.textContent = M.error; el.style.display = 'block'; }
window.addEventListener('error', ev => fail(ev.error || ev.message));
window.addEventListener('unhandledrejection', ev => fail(ev.reason));

/* ─────────────────────────── frame ─────────────────────────── */
function drawScene(sc, t, X) {
  CUR.X = X; CUR.scene = sc; G.X = X;
  resetCtxState(X); baseT(X);
  X.save(); sc.draw(t, t - sc.start, sc.ctx); X.restore();
}
function visibleWindow(sc, i) {
  const tin = sc.transition ? (sc.transition.dur ?? 0.4) : 0;
  const next = S.scenes[i + 1], tout = next && next.transition && Math.abs(next.start - sc.end) < 1e-3 ? (next.transition.dur ?? 0.4) : 0;
  return [sc.start - tin / 2, sc.end + tout / 2];
}
function renderFrame(t) {
  if (!M.ready) throw new Error('engine not ready');
  OX.setTransform(1, 0, 0, 1, 0, 0); resetCtxState(OX);
  OX.fillStyle = S.P.bg; OX.fillRect(0, 0, OUT.width, OUT.height);
  const vis = []; S.scenes.forEach((sc, i) => { const [a, b] = visibleWindow(sc, i); if (t >= a && t < b) vis.push(sc); });
  if (!vis.length && S.scenes.length) vis.push(t < S.scenes[0].start ? S.scenes[0] : S.scenes[S.scenes.length - 1]);
  if (vis.length === 1) { drawScene(vis[0], t, OX); }
  else {
    // composite pairwise: [A, B] with B's transition
    let acc = layer(0); drawScene(vis[0], t, acc.X);
    for (let i = 1; i < vis.length; i++) {
      const B = vis[i], L = layer(1); drawScene(B, t, L.X);
      const tr = B.transition || { type: 'cut', dur: 0 }, d = tr.dur ?? 0.4, k = clamp((t - (B.start - d / 2)) / Math.max(d, 1e-6));
      const fn = typeof tr.type === 'function' ? tr.type : (TR[tr.type] || TR.crossfade);
      const last = i === vis.length - 1, target = last ? { X: OX, c: OUT } : (acc === layers[2] ? layer(0) : layer(2));
      target.X.setTransform(1, 0, 0, 1, 0, 0); resetCtxState(target.X);
      if (last) { OX.fillStyle = S.P.bg; OX.fillRect(0, 0, OUT.width, OUT.height); }
      fn(target.X, acc.c, L.c, (tr.ease ? (E[tr.ease] || E.linear) : E.linear)(k), tr);
      acc = target;
    }
  }
  OX.setTransform(1, 0, 0, 1, 0, 0); resetCtxState(OX);
  const post = S.proj.post || {};
  if (post.vignette) vignette(OX, post.vignette);
  if (post.grain) grain(OX, t, post.grain);
  if (SAFE) safeOverlay(OX);
  M.lastT = t;
}
M.renderFrame = renderFrame;
M.frameData = (t, type = 'image/jpeg', q = 0.95) => { renderFrame(t); return OUT.toDataURL(type, q); };
M.frameJPEG = (t, q = 0.95) => M.frameData(t, 'image/jpeg', q);
M.framePNG = t => M.frameData(t, 'image/png');
/* contact sheet of times → PNG dataURL */
M.contactSheet = (times, cols = 4, thumbW = 270) => {
  const th = Math.round(thumbW * S.H / S.W), rows = Math.ceil(times.length / cols), pad = 14, lab = 34;
  const c = makeCanvas(cols * (thumbW + pad) + pad, rows * (th + pad + lab) + pad), X = c.getContext('2d');
  X.fillStyle = '#161616'; X.fillRect(0, 0, c.width, c.height);
  times.forEach((t, i) => {
    renderFrame(t); const x = pad + (i % cols) * (thumbW + pad), y = pad + Math.floor(i / cols) * (th + pad + lab);
    X.drawImage(OUT, x, y, thumbW, th);
    X.fillStyle = '#eee'; X.font = '600 22px Inter'; X.textAlign = 'left'; X.direction = 'ltr';
    const f = Math.round(t * S.fps); X.fillText(`t=${t.toFixed(2)}s  f${f}`, x + 4, y + th + 26);
  });
  return c.toDataURL('image/png');
};
M.state = S;                                           // debug/inspection only
M.helpers = { E, rng, noise1, noise2, fbm, kashida, layout, westernDigits, visualOrder, kashidaSlots };
M.THREE = THREE;

/* ─────────────────────────── player (preview only — never used for export) ─────────────────────────── */
function player() {
  document.body.classList.add('player');
  const sc = document.getElementById('scrub'), tc = document.getElementById('tc'), pb = document.getElementById('play');
  sc.max = S.dur; let playing = false, t0 = 0, tStart = 0;
  const show = t => { renderFrame(t); sc.value = t; tc.textContent = t.toFixed(2) + ' / ' + S.dur.toFixed(2); };
  sc.oninput = () => { playing = false; pb.textContent = '▶'; show(+sc.value); };
  pb.onclick = () => { playing = !playing; pb.textContent = playing ? '❚❚' : '▶'; tStart = +sc.value >= S.dur - .02 ? 0 : +sc.value; t0 = performance.now(); if (playing) requestAnimationFrame(loop); };
  const loop = now => { if (!playing) return; const t = tStart + (now - t0) / 1000; if (t >= S.dur) { playing = false; pb.textContent = '▶'; show(S.dur - 1 / S.fps); return; } show(t); requestAnimationFrame(loop); };
  document.addEventListener('keydown', e => { if (e.code === 'Space') pb.onclick(); });
  show(0);
}
if (RENDER_MODE) document.body.classList.add('render');
boot();
