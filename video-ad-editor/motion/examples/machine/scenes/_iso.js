// رسّام الآلات المشترك: يحمّل بيانات الآلة (machines/*.mjs ← assets/*.json)، يرسم الخطوط بموجة حبر، والإطار والطلب والعنوان والخطوات.
export const PLATE = { x: 30, y: 390, w: 1020, h: 1080 };
export const TONE = { hi: '#2B2925', mid: '#8A847A', lo: '#B9B1A4', faint: '#D8D0C2' };
export const FILL = { paper: '#FBF8F2', top: '#FFFDF9', shade: ['#DDD5C6', '#E6DFD2', '#EEE8DD', '#F5F1E9'], litTop: '#F6C9B4', litShade: '#E8A283' };

const polyOf = (d) => { const pts = []; d.replace(/[ML]\s*(-?[\d.]+)\s+(-?[\d.]+)/g, (_, x, y) => pts.push([+x, +y])); return pts; };
const lenOf = (pts) => { let l = 0; for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; };
const pointAt = (pts, l) => { for (let i = 1; i < pts.length; i++) { const s = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); if (l <= s) { const k = s ? l / s : 0; return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]; } l -= s; } return pts[pts.length - 1]; };

export async function loadMachine(ctx, file, { t0, span, seed }) {
  const M = await (await fetch(new URL('../assets/' + file, import.meta.url), { cache: 'no-store' })).json();
  const P = M.P, a = P.azimuth * Math.PI / 180, e = P.elevation * Math.PI / 180, kk = P.scale * Math.sqrt(1.6);
  const iso = ([x, y, z]) => [P.origin[0] + (x * Math.sin(a) - y * Math.cos(a)) * kk, P.origin[1] + ((x * Math.cos(a) + y * Math.sin(a)) * Math.sin(e) - z * Math.cos(e)) * kk];
  const mv = (x, y, z) => { const A = M.axes; return [A.x[0] * x + A.y[0] * y + A.z[0] * z, A.x[1] * x + A.y[1] * y + A.z[1] * z]; };
  const [W0, H0] = M.size, r = ctx.rng(seed || 'wave');
  const prep = (it) => {
    const o = { ...it };
    if (it.fill) o.fillP = new Path2D(it.fill);
    if (it.top) o.topP = new Path2D(it.top);
    if (it.shades) o.shadeP = it.shades.map(d => d ? new Path2D(d) : null);
    const mk = (d, tone, w) => { const pts = polyOf(d); return { p: new Path2D(d), pts, len: lenOf(pts), tone, w }; };
    o.strokes = [];
    (it.crease || []).concat(it.bevel || []).forEach(d => o.strokes.push(mk(d, 'faint', 1.3)));
    (it.edge || []).forEach(d => o.strokes.push(mk(d, it.lit ? 'lit' : it.tone, 2.1)));
    (it.k === 'l' ? it.d : []).forEach(d => o.strokes.push(mk(d, it.tone, 1.6)));
    let sum = 0, n = 0;
    o.strokes.forEach(s => { const c = s.pts[0] || [0, 0]; s.t0 = t0 + span * ctx.clamp((c[0] / W0) * 0.55 + (c[1] / H0) * 0.45, 0, 1) + r.range(0, 0.2); s.tip = r() < 0.18; sum += s.t0; n++; });
    const c = it.pts ? it.pts[0] : [W0 / 2, H0 / 2];
    o.t0 = n ? sum / n : t0 + span * ctx.clamp((c[0] / W0) * 0.55 + (c[1] / H0) * 0.45, 0, 1);
    return o;
  };
  const L = {}; for (const k in M.layers) L[k] = M.layers[k].map(prep);
  const T = {}; for (const k in (M.templates || {})) T[k] = M.templates[k].map(prep);
  return { M, W: M.world, iso, mv, L, T };
}

// يرسم عنصر: rev = وقت رسم الخط (الحبر)، heat(tag) = لون إضافي للخطوط الموسومة (السلك الحار)
export function drawItem(ctx, X, t, it, { dx = 0, dy = 0, rev = false, alpha = 1, tint } = {}) {
  const { at, E, P: C } = ctx, tone = (n) => n === 'lit' ? C.clay : TONE[n];
  X.save(); X.translate(dx, dy); X.globalAlpha = alpha;
  const fa = rev ? at(t, it.t0 + 0.25, it.t0 + 0.7) : 1;
  if (it.k === 'h') { if (fa > 0) { X.globalAlpha = alpha * fa * 0.22; X.filter = 'blur(10px)'; X.fillStyle = '#6b604f'; X.translate(0, 4); X.fill(it.fillP); } X.restore(); return; }
  if (it.k === 'd') { const da = rev ? at(t, it.t0, it.t0 + 0.3) : 1; if (da > 0) { X.globalAlpha = alpha * da; X.fillStyle = TONE[it.tone]; for (const [x, y] of it.pts) { X.beginPath(); X.arc(x, y, it.size * 1.4, 0, 6.283); X.fill(); } } X.restore(); return; }
  if (it.k === 's' && fa > 0) {
    X.globalAlpha = alpha * fa; X.fillStyle = FILL.paper; X.fill(it.fillP);
    if (!it.flat) { it.shadeP.forEach((p, i) => { if (p) { X.fillStyle = it.lit ? FILL.litShade : FILL.shade[i]; X.fill(p); } }); X.fillStyle = it.lit ? FILL.litTop : FILL.top; X.fill(it.topP); }
    const tn = tint && tint(it.tag); if (tn) { X.globalAlpha = alpha * fa * tn[1]; X.fillStyle = tn[0]; X.fill(it.topP); it.shadeP.forEach(p => p && X.fill(p)); }
    X.globalAlpha = alpha;
  }
  X.lineCap = 'round'; X.lineJoin = 'round';
  const tn = it.k === 'l' && tint && tint(it.tag);
  for (const s of it.strokes) {
    const k = rev ? E.cubicInOut(at(t, s.t0, s.t0 + 0.5, 'linear')) : 1;
    if (k <= 0) continue;
    X.strokeStyle = tone(s.tone); X.lineWidth = s.w;
    if (k < 1) { X.setLineDash([s.len * k, s.len + 1]); X.stroke(s.p); X.setLineDash([]);
      if (s.tip) { const p = pointAt(s.pts, s.len * k); X.fillStyle = C.acc; X.beginPath(); X.arc(p[0], p[1], 4, 0, 6.283); X.fill(); } }
    else X.stroke(s.p);
    const ink = rev ? 1 - at(t, s.t0 + 0.45, s.t0 + 0.95) : 0;
    if (ink > 0) { X.save(); X.globalAlpha *= ink; X.strokeStyle = C.clay; if (k < 1) X.setLineDash([s.len * k, s.len + 1]); X.stroke(s.p); X.restore(); }
    if (tn && k >= 1) { X.save(); X.globalAlpha *= tn[1]; X.strokeStyle = tn[0]; X.lineWidth = s.w + 1.4; X.stroke(s.p); X.restore(); }
  }
  X.restore();
}

// الإطار: Fig. n + الطلب (ask) + عنوان من سطرين (ينكتب) + الخطوات تحت + كابشن فوق الإطار
export function frame(ctx, X, lt, { fig, title, sub, top, ask, steps = [], typeAt = 0.1 }) {
  const { at, P: C } = ctx;
  X.save(); X.fillStyle = 'rgba(251,248,242,.45)'; X.strokeStyle = TONE.lo; X.lineWidth = 1.6; X.beginPath(); X.roundRect(PLATE.x, PLATE.y, PLATE.w, PLATE.h, 14); X.fill(); X.stroke(); X.restore();
  ctx.text(X, 'Fig. ' + fig, PLATE.x + 40, PLATE.y + 62, { family: 'num', weight: 600, size: 28, color: C.mut, dir: 'ltr', align: 'left' });
  // الطلب ينكتب بفقاعة (جملة المستخدم كما كتبها) + العنوان
  if (ask) { const kc = at(lt, typeAt, typeAt + 0.25, 'expoOut'), kt = at(lt, typeAt + 0.1, typeAt + 0.1 + ask.length * 0.03);
    X.save(); X.font = ctx.font('body', 700, 26); const w = X.measureText(ask).width + 48; X.restore();
    X.save(); X.globalAlpha = kc; X.fillStyle = C.acc; X.beginPath(); X.roundRect(PLATE.x + 130, PLATE.y + 32, w, 48, 24); X.fill(); X.restore();
    const sub = ctx.text.typeSub(ask, kt) + (kt < 1 && (lt * 3 | 0) % 2 ? '|' : '');
    ctx.text(X, sub, PLATE.x + 130 + w - 24, PLATE.y + 65, { family: 'body', weight: 700, size: 26, color: '#FFF', align: 'right', alpha: kc }); }
  const L1 = ctx.text.layout(X, title, { family: 'display', weight: 700, size: 46 });
  ctx.text.drawLayout(X, L1, PLATE.x + PLATE.w - 40, PLATE.y + 74, { align: 'right', color: C.ink, perWord: (i) => { const k = at(lt, typeAt + 0.1 + i * 0.18, typeAt + 0.3 + i * 0.18, 'cubicOut'); return { reveal: k, alpha: k > 0 ? 1 : 0 }; } });
  if (sub) ctx.text(X, sub, PLATE.x + PLATE.w - 40, PLATE.y + 118, { family: 'body', weight: 700, size: 34, color: C.clay, align: 'right', alpha: at(lt, typeAt + 0.4, typeAt + 0.7) });
  if (top) { const ka = at(lt, 0.05, 0.4, 'expoOut'); const Lt = ctx.text.layout(X, top, { family: 'display', weight: 700, size: 52, maxWidth: 960 });
    ctx.text.drawLayout(X, Lt, 540, 300 + (1 - ka) * 30, { align: 'center', color: C.ink, perWord: () => ({ alpha: ka }) }); }
  for (const [a, b, n, s] of steps) { const k = at(lt, a, a + 0.3, 'expoOut') * (1 - at(lt, b - 0.2, b)); if (k <= 0) continue;
    const L = ctx.text.layout(X, s, { family: 'body', weight: 700, size: 40 });
    ctx.text.drawLayout(X, L, 860, 1430 + (1 - k) * 24, { align: 'right', color: C.ink, perWord: () => ({ alpha: k }) });
    X.globalAlpha = k; X.fillStyle = C.acc; X.beginPath(); X.arc(910, 1416 + (1 - k) * 24, 24, 0, 6.283); X.fill(); X.globalAlpha = 1;
    ctx.text(X, n, 910, 1428 + (1 - k) * 24, { family: 'num', weight: 800, size: 32, color: '#FFF', dir: 'ltr', alpha: k }); }
}
