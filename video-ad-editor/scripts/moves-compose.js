/* ═══ moves-compose.js — يشغّل حركات المعرض (motion/moves.js → FX) داخل ريل الكلام (compose.html) ═══
   FX مكتوبة لمحرّك الموشن وتطلب ctx فيه أدوات نص وتوقيت. هالملف يبني نفس الـctx فوق كانفس compose وثيمه وكلماته:
     window.MV = ctx  →  FX.<id>(MV, t, o)
   التحميل: انسخ motion/moves.js وهالملف لمجلد الشغل (compose.REFERENCE.html يحمّلهم بعد سكربته).
   لو ناقصين، 04_render_frames.js و08_safe_check.js يركّبونهم وحدهم من السكل.
   الأسطر: MV.wordTime(3, 0) = الكلمة 0 من الجملة 3 بـcaps.json (أو 'c3' / 'l3'). FX.caption ياخذ line: 3.
   الألوان: MV.P من theme.json (bg ink acc clay mut) — لا تمرر ألوان ثابتة.
   الخط: كل العائلات (display/body/num) = خط الثيم؛ display بوزن 800 على الأقل عشان يطلع عريض مثل Lalezar.
   أدوات compose:
     MV.video(Y, R?)        يرسم فريم الفيديو الحالي على Y بمستطيل R (افتراضي ملء الشاشة) — للانتقالات وpushIn
     MV.person(Y, R?)       المتحدث مقصوص لهالفريم (ماك: 11_behind_text.js person) — MV.person.ok() يقول موجود ولا
     MV.panel(Y, fn?)       يعبّي Y بلون الخلفية ثم fn(Y) — مشهد B جاهز للانتقال
     MV.hideCaption(s, e)   يطفي كابشن المحرّك بنافذة (لما FX.caption يرسم الكابشن بداله)
     MV.scene(name, fn, layer?)  = SCENE_LIST.push بنفس safe() — fn(t) تُنادى كل فريم
     MV.ready(fn)           يشغّل fn بعد init (لما caps.json يوصل) — أي wordTime/lineSpan/hideCaption برّا الرسم يكون داخله
   أدوات النص والتوقيت أدناه منقولة من motion/engine.js (نفس السلوك) — أي تعديل هناك انقله هني. */
(function () {
  const G = window;
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const prog = (t, a, b) => (b === a ? (t >= b ? 1 : 0) : clamp((t - a) / (b - a)));

  /* ── تسهيل (من engine.js) ── */
  function cubicBezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = u => ((ax * u + bx) * u + cx) * u, sy = u => ((ay * u + by) * u + cy) * u, dx = u => (3 * ax * u + 2 * bx) * u + cx;
    return k => {
      if (k <= 0) return 0; if (k >= 1) return 1;
      let u = k; for (let i = 0; i < 8; i++) { const e = sx(u) - k, d = dx(u); if (Math.abs(e) < 1e-6) return sy(u); if (Math.abs(d) < 1e-6) break; u -= e / d; }
      let lo = 0, hi = 1; u = k; for (let i = 0; i < 30; i++) { const v = sx(u); if (Math.abs(v - k) < 1e-6) break; if (v < k) lo = u; else hi = u; u = (lo + hi) / 2; }
      return sy(u);
    };
  }
  function springFn({ stiffness = 170, damping = 16, mass = 1, velocity = 0 } = {}) {
    const w0 = Math.sqrt(stiffness / mass), z = damping / (2 * Math.sqrt(stiffness * mass));
    return t => {
      if (t <= 0) return 0;
      if (z < 1) { const wd = w0 * Math.sqrt(1 - z * z); return 1 - Math.exp(-z * w0 * t) * (Math.cos(wd * t) + ((z * w0 - velocity) / wd) * Math.sin(wd * t)); }
      return 1 - Math.exp(-w0 * t) * (1 + (w0 - velocity) * t);
    };
  }
  const E = (() => {
    const P = p => ({ in: k => Math.pow(k, p), out: k => 1 - Math.pow(1 - k, p), inOut: k => k < .5 ? Math.pow(2, p - 1) * Math.pow(k, p) : 1 - Math.pow(-2 * k + 2, p) / 2 });
    const q = P(2), c = P(3), qt = P(4), qn = P(5);
    const backIn = (s = 1.70158) => k => (s + 1) * k * k * k - s * k * k;
    const backOut = (s = 1.70158) => k => 1 + (s + 1) * Math.pow(k - 1, 3) + s * Math.pow(k - 1, 2);
    return {
      linear: k => k,
      quadIn: q.in, quadOut: q.out, quadInOut: q.inOut, cubicIn: c.in, cubicOut: c.out, cubicInOut: c.inOut,
      quartIn: qt.in, quartOut: qt.out, quartInOut: qt.inOut, quintIn: qn.in, quintOut: qn.out, quintInOut: qn.inOut,
      sineIn: k => 1 - Math.cos(k * Math.PI / 2), sineOut: k => Math.sin(k * Math.PI / 2), sineInOut: k => -(Math.cos(Math.PI * k) - 1) / 2,
      expoIn: k => k <= 0 ? 0 : Math.pow(2, 10 * k - 10), expoOut: k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k),
      expoInOut: k => k <= 0 ? 0 : k >= 1 ? 1 : k < .5 ? Math.pow(2, 20 * k - 10) / 2 : (2 - Math.pow(2, -20 * k + 10)) / 2,
      backIn: backIn(), backOut: backOut(), back: s => backOut(s),
      spring: springFn, bezier: cubicBezier,
      snappy: cubicBezier(.2, .9, .1, 1), smooth: cubicBezier(.45, 0, .2, 1),
    };
  })();

  /* ── عشوائية ثابتة (من engine.js) ── */
  const hash01 = (...n) => { let h = 0x9E3779B9; for (const v of n) { h ^= Math.imul((v * 1000003) | 0, 0x85EBCA6B); h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35); } return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const noise1 = (x, seed = 0) => { const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f); return lerp(hash01(i, seed), hash01(i + 1, seed), u) * 2 - 1; };

  /* ── الخط والألوان من الثيم (globals compose: FONT BG INK ACC CLAY MUT) ── */
  const theme = () => ({ FONT: typeof FONT !== 'undefined' ? FONT : 'Cairo' });   // FONT = خط theme.json (يتعيّن داخل init)
  const ALIAS = { display: 'display', body: 'body', num: 'num', Lalezar: 'display', 'IBM Plex Sans Arabic': 'body', Inter: 'num', cairo: 'body', kufi: 'display' };
  function fontStr(family = 'body', weight = 700, size = 80) {
    const role = ALIAS[family];
    if (!role) return `${weight} ${size}px "${family}"`;           // عائلة مو معروفة: نمرّرها كما هي
    const w = role === 'display' ? Math.max(800, +weight || 0) : weight;
    return `${w} ${size}px "${theme().FONT}"`;
  }
  const applyFont = (X, o) => { X.font = o.font || fontStr(o.family || 'body', o.weight ?? 700, o.size || 80); };
  const PAL = () => {
    /* let globals بـcompose ما تبين على window بس تنقرا بالاسم (نفس النطاق العام) — typeof يحمي لو الصفحة مو compose */
    const acc = typeof ACC !== 'undefined' ? ACC : '#D97757', clay = typeof CLAY !== 'undefined' ? CLAY : acc;
    return { bg: typeof BG !== 'undefined' ? BG : '#F3EFEA', ink: typeof INK !== 'undefined' ? INK : '#1F1F1D', acc, clay, hi: clay, mut: typeof MUT !== 'undefined' ? MUT : '#8A847A',
      onAcc: typeof onACC === 'function' ? onACC() : '#FFFFFF' };
  };

  /* ── نص عربي (من engine.js: layout · drawLayout · text · kashida · typeSub) ── */
  const AR_INDIC = '٠١٢٣٤٥٦٧٨٩', FA_INDIC = '۰۱۲۳۴۵۶۷۸۹';
  const westernDigits = s => String(s).replace(/[٠-٩]/g, d => AR_INDIC.indexOf(d)).replace(/[۰-۹]/g, d => FA_INDIC.indexOf(d));
  const DUAL = new Set('بتثجحخسشصضطظعغفقكلمنهيئىـپچگکیڤ'.split(''));
  const RIGHT = new Set('اأإآدذرزوؤةٱژ'.split(''));
  const HARAKAT = /[ً-ٰٟۖ-ۭ]/;
  const isJoinable = ch => DUAL.has(ch) || RIGHT.has(ch);
  function kashidaSlots(word) {
    const ch = [...word], slots = [];
    for (let i = 0; i < ch.length - 1; i++) {
      if (!DUAL.has(ch[i])) continue;
      let j = i + 1; while (j < ch.length && HARAKAT.test(ch[j])) j++;
      if (j >= ch.length || !isJoinable(ch[j])) continue;
      if (ch[i] === 'ل' && 'اأإآ'.includes(ch[j])) continue;
      const pr = ('سشصض'.includes(ch[i]) ? 3 : 0) + ('بتثنيئ'.includes(ch[i]) && j === ch.length - 1 ? -1 : 0) + (j === ch.length - 1 ? 2 : 0) + ('ـ' === ch[i] ? -5 : 0);
      slots.push({ at: j, pr });
    }
    return slots.sort((a, b) => b.pr - a.pr);
  }
  function kashida(X, str, target, o = {}) {
    if (o.font || o.size) applyFont(X, o);
    str = westernDigits(str);
    const base = X.measureText(str).width;
    if (target <= base) return { text: str, scaleX: target / base, width: target, count: 0, base };
    const words = str.split(' '), slots = [];
    words.forEach((w, wi) => kashidaSlots(w).forEach(s => slots.push({ wi, at: s.at, pr: s.pr })));
    if (!slots.length) return { text: str, scaleX: target / base, width: target, count: 0, base };
    slots.sort((a, b) => b.pr - a.pr);
    const counts = new Array(slots.length).fill(0);
    const build = () => words.map((w, wi) => { const ch = [...w]; slots.map((s, k) => ({ ...s, n: counts[k] })).filter(s => s.wi === wi && s.n > 0).sort((a, b) => b.at - a.at).forEach(s => ch.splice(s.at, 0, 'ـ'.repeat(s.n))); return ch.join(''); }).join(' ');
    let text = str, width = base, n = 0, guard = 0;
    while (guard++ < 2000) {
      const k = n % slots.length; if (counts[k] >= (o.maxPerSlot || 40)) break; counts[k]++;
      const tt = build(), ww = X.measureText(tt).width;
      if (ww > target) { counts[k]--; break; }
      text = tt; width = ww; n++;
    }
    return { text, scaleX: target / width, width: target, count: n, base };
  }
  const isLatin = w => /[A-Za-z]/.test(w) && !/[؀-ۿ]/.test(w);
  const isNum = w => /^[\d.,%+\-$:/]+$/.test(w);
  function visualOrder(words) {
    const out = []; let i = 0;
    while (i < words.length) {
      if (isLatin(words[i])) { let j = i; while (j + 1 < words.length && (isLatin(words[j + 1]) || (isNum(words[j + 1]) && j + 2 < words.length && isLatin(words[j + 2])))) j++; for (let k = j; k >= i; k--) out.push(k); i = j + 1; }
      else { out.push(i); i++; }
    }
    return out;
  }
  function layout(X, str, o = {}) {
    X.save(); applyFont(X, o); str = westernDigits(str);
    const size = o.size || 80, lh = (o.lineHeight || 1.35) * size, maxW = o.maxWidth || 1e9, sp = X.measureText(' ').width * (o.wordSpacing || 1);
    const words = str.split(/\s+/).filter(Boolean), W = words.map(w => X.measureText(w).width);
    const lines = []; let cur = [], cw = 0;
    words.forEach((w, i) => { const add = (cur.length ? sp : 0) + W[i]; if (cur.length && cw + add > maxW) { lines.push(cur); cur = []; cw = 0; } cur.push(i); cw += (cur.length > 1 ? sp : 0) + W[i]; });
    if (cur.length) lines.push(cur);
    const m = X.measureText('أبجد Hg'); X.restore();
    const out = lines.map((li, L) => {
      const ws = li.map(i => words[i]), order = visualOrder(ws); let x = 0; const placed = [];
      order.forEach(k => { const i = li[k]; placed.push({ text: words[i], i, x: x - W[i], w: W[i], line: L }); x -= W[i] + sp; });
      placed.sort((a, b) => a.i - b.i);
      return { words: placed, width: -x - sp, y: L * lh };
    });
    return { lines: out, width: Math.max(0, ...out.map(l => l.width)), height: (out.length - 1) * lh + size, size, lh, words, ascent: m.actualBoundingBoxAscent, descent: m.actualBoundingBoxDescent, o };
  }
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
        if (st.clip || st.reveal != null || st.clipUp != null) {
          X.beginPath();
          if (st.reveal != null) { const rw = (box.w + 20) * clamp(st.reveal); X.rect(box.x + box.w + 10 - rw, box.y - L.size * .3, rw, box.h + L.size * .6); }
          else if (st.clipUp != null) X.rect(box.x - 20, box.y - L.size * .3, box.w + 40, box.h + L.size * .3);
          else X.rect(st.clip.x, st.clip.y, st.clip.w, st.clip.h);
          X.clip();
        }
        X.translate(box.cx + (st.dx || 0), box.cy + (st.dy || 0)); if (st.rot) X.rotate(st.rot); if (st.scale != null) X.scale(st.scale, st.scaleY ?? st.scale);
        X.translate(-box.cx, -box.cy);
        if (st.shadow) { X.shadowColor = st.shadow.color || 'rgba(0,0,0,.3)'; X.shadowBlur = st.shadow.blur || 20; X.shadowOffsetY = st.shadow.y || 8; }
        if (st.stroke) { X.lineJoin = 'round'; X.lineWidth = st.stroke.width || 8; X.strokeStyle = st.stroke.color || '#000'; X.strokeText(w.text, box.x, box.base); }
        X.fillStyle = st.color || o.color || PAL().ink; X.fillText(w.text, box.x, box.base);
        X.restore();
      }
    }
    X.restore();
    return boxes;
  }
  function text(X, str, x, y, o = {}) {
    X.save(); applyFont(X, o); str = westernDigits(str);
    X.direction = o.dir || (/[؀-ۿ]/.test(str) ? 'rtl' : 'ltr'); X.textAlign = o.align || 'center'; X.textBaseline = o.baseline || 'alphabetic';
    let sx = 1; if (o.maxWidth) { const w = X.measureText(str).width; if (w > o.maxWidth) sx = o.maxWidth / w; }
    if (o.alpha != null) X.globalAlpha *= o.alpha;
    X.translate(x, y); if (sx !== 1 || o.scaleX) X.scale(sx * (o.scaleX || 1), 1);
    if (o.shadow) { X.shadowColor = o.shadow.color || 'rgba(0,0,0,.35)'; X.shadowBlur = o.shadow.blur || 24; X.shadowOffsetY = o.shadow.y || 10; }
    if (o.stroke) { X.lineJoin = 'round'; X.lineWidth = o.stroke.width || 8; X.strokeStyle = o.stroke.color || '#000'; X.strokeText(str, 0, 0); }
    if (o.color !== null) { X.fillStyle = o.color || PAL().ink; X.fillText(str, 0, 0); }
    X.restore();
  }
  function drawKashida(X, str, x, y, w, o = {}, amount = 1) {
    X.save(); applyFont(X, o);
    const base = X.measureText(westernDigits(str)).width, K = kashida(X, str, lerp(base, w, clamp(amount)));
    X.direction = 'rtl'; X.textAlign = o.align || 'center'; X.textBaseline = 'alphabetic';
    X.translate(x, y); X.scale(K.scaleX, 1);
    if (o.stroke) { X.lineJoin = 'round'; X.lineWidth = o.stroke.width || 8; X.strokeStyle = o.stroke.color; X.strokeText(K.text, 0, 0); }
    X.fillStyle = o.color || PAL().ink; X.fillText(K.text, 0, 0);
    X.restore(); return K;
  }
  function typeSub(str, k) { const ch = [...westernDigits(str)], n = Math.round(clamp(k) * ch.length); const s = ch.slice(0, n).join(''); return n < ch.length && n > 0 && DUAL.has(ch[n - 1]) ? s + '‍' : s; }

  /* ── خط يرتسم (من engine.js: drawPath) ── */
  const _pc = new Map();
  function pathInfo(src, smooth = true) {
    const key = (typeof src === 'string' ? src : JSON.stringify(src)) + '|' + smooth; if (_pc.has(key)) return _pc.get(key);
    let d = src;
    if (Array.isArray(src)) {
      const p = src; d = `M${p[0][0]} ${p[0][1]}`;
      if (!smooth || p.length < 3) for (let i = 1; i < p.length; i++) d += ` L${p[i][0]} ${p[i][1]}`;
      else for (let i = 0; i < p.length - 1; i++) { const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2; d += ` C${p1[0] + (p2[0] - p0[0]) / 6} ${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6} ${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]} ${p2[1]}`; }
    }
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'path'); el.setAttribute('d', d);
    const info = { d, path: new Path2D(d), len: el.getTotalLength(), at: l => { const q = el.getPointAtLength(l); return [q.x, q.y]; } };
    _pc.set(key, info); return info;
  }
  function drawPath(X, src, k, o = {}) {
    const P = pathInfo(src, o.smooth !== false), L = P.len, a = clamp(o.from || 0) * L, b = clamp(k) * L;
    if (b <= a) return null;
    X.save(); X.lineCap = o.cap || 'round'; X.lineJoin = 'round'; X.lineWidth = o.width || 8; X.strokeStyle = o.color || PAL().acc;
    X.setLineDash([b - a, L + 10]); X.lineDashOffset = -a;
    if (o.glow) { X.shadowColor = o.glowColor || o.color || PAL().acc; X.shadowBlur = o.glow; }
    X.stroke(P.path); X.restore();
    return P.at(b);
  }

  /* ── التوقيت من caps.json: السطر = رقم الجملة (CAPS[i]) ── */
  const caps = () => (typeof CAPS !== 'undefined' ? CAPS : []);
  function card(id) {
    const n = typeof id === 'number' ? id : +(String(id).match(/(\d+)$/) || [])[1];
    const c = caps()[n]; if (!c) throw new Error('ما فيه جملة رقم ' + id + ' بـcaps.json'); return c;
  }
  function wordTime(id, i) { const c = card(id), W = c.w || []; const w = W[Math.max(0, Math.min(W.length - 1, i < 0 ? W.length + i : i))]; return w ? { s: w.s, e: w.e, w: w.t } : { s: c.s, e: c.e, w: '' }; }
  function lineSpan(id) { const c = card(id); return { s: c.s, e: c.e, text: (c.w || []).map(w => w.t).join(' ') }; }
  function wordsOf(id) { return (card(id).w || []).map(w => ({ w: w.t, s: w.s, e: w.e })); }

  /* ── أدوات compose ── */
  function video(Y, R) {
    R = R || { x: 0, y: 0, w: 1080, h: 1920 };
    const VF = document.getElementById('VF'); if (!VF || !VF.naturalWidth) return;
    const sw = VF.naturalWidth, shh = VF.naturalHeight, sc = Math.max(R.w / sw, R.h / shh), cw = R.w / sc, ch = R.h / sc;
    const fa = typeof FACE_ANCH === 'number' ? FACE_ANCH : 0.3;
    Y.drawImage(VF, (sw - cw) / 2, (shh - ch) * fa, cw, ch, R.x, R.y, R.w, R.h);
  }
  /* المتحدث مقصوص (ماك): صورة bt/person لهالفريم بنفس تأطير MV.video — للحركات 51–61. مرّره كما هو: person: MV.person
     يجهّزه: node 11_behind_text.js <work> person <من-إلى>. بلاه MV.person.ok() = false والحركة ترجع لبديلها (كرت فيديو). */
  function person(Y, R) {
    if (!person.ok()) return false;
    const PI = document.getElementById('PRS'); R = R || { x: 0, y: 0, w: 1080, h: 1920 };
    const sw = PI.naturalWidth, shh = PI.naturalHeight, sc = Math.max(R.w / sw, R.h / shh), cw = R.w / sc, ch = R.h / sc;
    const fa = typeof FACE_ANCH === 'number' ? FACE_ANCH : 0.3;
    Y.drawImage(PI, (sw - cw) / 2, (shh - ch) * fa, cw, ch, R.x, R.y, R.w, R.h); return true;
  }
  person.ok = () => { const PI = document.getElementById('PRS'); return typeof PRS_OK !== 'undefined' && !!PRS_OK && !!PI && PI.naturalWidth > 0; };
  function panel(Y, fn) { Y.save(); Y.fillStyle = PAL().bg; Y.fillRect(0, 0, 1080, 1920); Y.restore(); if (fn) { Y.save(); fn(Y); Y.restore(); } }
  const HIDE = [];
  function hideCaption(s, e) {
    HIDE.push([s, e]);
    if (!G.__mvCapWrapped && typeof G.caption === 'function') {
      const orig = G.caption; G.caption = t => { if (HIDE.some(([a, b]) => t >= a && t < b)) return; return orig(t); }; G.__mvCapWrapped = true;
    }
  }
  /* caps.json يوصل بـinit() بعد تحميل الصفحة — أي حساب توقيت (wordTime/lineSpan/hideCaption) حطه داخل MV.ready */
  const READY = []; let inited = false;
  function ready(fn) { if (inited) fn(); else READY.push(fn); }
  if (typeof G.init === 'function' && !G.init.__mv) {
    const orig = G.init;
    G.init = function (d) { const r = orig.apply(this, arguments); inited = true; READY.splice(0).forEach(f => { try { f(); } catch (e) { console.error('⚠️ MV.ready: ' + e.message); } }); return r; };
    G.init.__mv = true;
  }
  function scene(name, fn, layer) { if (typeof SCENE_LIST === 'undefined') throw new Error('MV.scene: هالصفحة مو compose'); if (layer) fn.layer = layer; SCENE_LIST.push([name, fn, layer]); }

  const MV = {
    get X() { return typeof X !== 'undefined' ? X : null; }, W: 1080, H: 1920, fps: 30,
    get P() { return PAL(); }, get palette() { return PAL(); },
    E, ease: E, clamp, lerp, prog, hash01, noise1,
    at: (lt, a, b, ez = 'cubicOut') => (typeof ez === 'function' ? ez : E[ez])(prog(lt, a, b)),
    wordTime, lineSpan, wordsOf,
    font: fontStr, F: fontStr,
    text: Object.assign((X, s, x, y, o) => text(X, s, x, y, o), { draw: text, layout, drawLayout, kashida, drawKashida, typeSub, westernDigits, visualOrder }),
    num: (v, d = 0) => westernDigits(Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })),
    drawPath, pathInfo,
    video, person, panel, hideCaption, scene, ready,
  };
  G.MV = MV;
})();
