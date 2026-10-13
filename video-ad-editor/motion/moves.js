/* ═══ moves.js — مكتبة حركات المونتاج (معرض الحركات المرقّم) ═══
   كل حركة = دالة FX.<اسم>(ctx, t, o) ترسم على ctx.X بإحداثيات التصميم (1080×1920). t = الوقت العام.
   o.s = بداية الحركة (ثبّتها على توقيت الكلمة: ctx.wordTime('l2', 0).s). الألوان من ctx.P (هوية المستخدم) إلا لو مرّرت غيرها.
   الانتقالات تاخذ مشهدين كدوال رسم: o.A = (Y) => {...}, o.B = (Y) => {...} وكل وحدة ترسم الإطار كامل.
   الكتالوج والمعاينات والمصادر: motion/moves/catalog.json · اختيار المستخدم: scripts/35_moves.py · الدليل: references/moves.md
   ⚠ الكلمات العربية تتحرك ككلمات كاملة (أو السطر كله بنداء واحد) — لا تقسم الحروف، تنكسر الوصلات. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const pr = (t, a, b) => cl((t - a) / (b - a));
  const lerp = (a, b, k) => a + (b - a) * k;
  const ON = 0.01;                                      // ⚠ backOut(0) يرجع رقم موجب صغير — قارن بـON مو بـ0
  const pick = (o, k, d) => (o[k] === undefined ? d : o[k]);
  // الأغمق من لونين (للحدّ حول الكابشن الأبيض: بثيم غامق ink أبيض، فالحدّ يصير bg)
  const lum = h => { const c = String(h || '#000').replace('#', ''), f = c.length === 3 ? c.split('').map(x => x + x).join('') : c; return [0, 2, 4].reduce((a, j, n) => a + [0.2126, 0.7152, 0.0722][n] * parseInt(f.slice(j, j + 2), 16), 0); };
  const darker = (a, b) => (lum(a) <= lum(b) ? a : b);
  // نص مقسّم كلمات: يرجّع التخطيط وصناديق الكلمات بلا رسم
  const boxesOf = (ctx, str, x, y, o) => {
    const L = ctx.text.layout(ctx.X, str, { family: o.family || 'display', weight: o.weight || 400, size: o.size, maxWidth: o.maxWidth || 900, lineHeight: o.lineHeight || 1.2 });
    return { L, B: ctx.text.drawLayout(ctx.X, L, x, y, { perWord: () => ({ skip: true }) }) };
  };
  // توقيت الكلمة i: من الصوت لو o.line، وإلا s + i*step
  const wt = (ctx, o, i, step) => (o.line != null ? ctx.wordTime(o.line, i).s : o.s + i * step);
  const FX = {};

  /* ── أ) حركات الكلمات ─────────────────────────────────────────── */

  /* 1 كلمة تولّع — كابشن: الكلمة الحالية داخل كبسولة تنزلق. o: {text|line, s, step=.55, x=540, y=1290, size=104, color='#fff', stroke (لون، أو null بلا حدّ — الافتراضي الأغمق من ink/bg), pill=P.acc} */
  FX.caption = (ctx, t, o) => {
    const { X, P, E, at } = ctx, step = pick(o, 'step', 0.55), size = o.size || 104, x = pick(o, 'x', 540), y = pick(o, 'y', 1290);
    const text = o.text || ctx.lineSpan(o.line).text;
    const { L, B } = boxesOf(ctx, text, x, y, { size, maxWidth: o.maxWidth || 900, lineHeight: 1.25 });
    const n = B.length; let cur = -1; for (let i = 0; i < n; i++) if (t >= wt(ctx, o, i, step)) cur = i;
    if (cur >= 0) {
      const t0 = wt(ctx, o, cur, step), k = E.expoOut(pr(t, t0, t0 + 0.22)), a = B[Math.max(0, cur - 1)], b = B[cur], m = cur ? k : 1;
      X.fillStyle = o.pill || P.acc; X.beginPath(); X.roundRect(lerp(a.x, b.x, m) - 22, lerp(a.y, b.y, m) + 4, lerp(a.w, b.w, m) + 44, size * 1.22, size * 0.25); X.fill();
    }
    ctx.text.drawLayout(X, L, x, y, { perWord: (i) => {
      const t0 = wt(ctx, o, i, step), k = at(t, t0 - 0.05, t0 + 0.2, 'backOut');
      return { alpha: k > ON ? 1 : 0, scale: 0.85 + 0.15 * k, color: o.color || (i === cur && P.onAcc) || '#FFFFFF', stroke: i === cur ? null : (o.stroke === null ? null : { width: size * 0.13, color: typeof o.stroke === 'string' ? o.stroke : darker(P.ink, P.bg) }) };
    } });
  };

  /* 2 ضباب يصفى — كل كلمة من غباش لحدّة. o: {text, s, x=540, y=880, size=150, stagger=.22, dur=.75, accent:[i], out(time)} */
  FX.blurIn = (ctx, t, o) => {
    const { X, P, at } = ctx, size = o.size || 150, st = pick(o, 'stagger', 0.22), du = o.dur || 0.75;
    const { B } = boxesOf(ctx, o.text, pick(o, 'x', 540), pick(o, 'y', 880), { size, maxWidth: o.maxWidth });
    B.forEach((b, i) => {
      const k = at(t, o.s + i * st, o.s + i * st + du, 'cubicOut'), ko = o.out ? at(t, o.out, o.out + 0.5, 'cubicIn') : 0;
      const bl = 26 * (1 - k) + 26 * ko, a = Math.min(k, 1 - ko); if (a <= 0) return;
      X.save(); X.globalAlpha = a; X.filter = bl > 0.3 ? `blur(${bl.toFixed(1)}px)` : 'none';
      X.translate(b.cx, b.cy); const s = 1.25 - 0.25 * k; X.scale(s, s); X.translate(-b.cx, -b.cy - 40 * (1 - k));
      ctx.text(X, b.text, b.x + b.w, b.base, { family: 'display', size, align: 'right', color: (o.accent || []).includes(i) ? P.acc : (o.color || P.ink) }); X.restore();
    });
  };

  /* 3 طلعة متتابعة — الكلمات تطلع من خط مخفي. o: {text, s, x=540, y=880, size=190, stagger=.13, out(time), accent:[i], underline=true} */
  FX.riseUp = (ctx, t, o) => {
    const { X, P, at } = ctx, size = o.size || 190, st = pick(o, 'stagger', 0.13), x = pick(o, 'x', 540), y = pick(o, 'y', 880);
    const L = ctx.text.layout(X, o.text, { family: 'display', size, maxWidth: o.maxWidth || 900, lineHeight: 1.05 });
    ctx.text.drawLayout(X, L, x, y, { perWord: (i) => {
      const kin = at(t, o.s + i * st, o.s + 0.7 + i * st, 'expoOut'), kout = o.out ? at(t, o.out + i * 0.07, o.out + 0.55 + i * 0.07, 'expoIn') : 0;
      return { clipUp: 1, dy: (1 - kin) * size * 1.2 - kout * size * 1.2, color: (o.accent || []).includes(i) ? P.acc : (o.color || P.ink) };
    } });
    if (o.underline !== false) { const lw = Math.min(900, L.width) * at(t, o.s + 0.75, o.s + 1.35, 'expoOut') * (1 - (o.out ? at(t, o.out + 0.1, o.out + 0.5, 'expoIn') : 0));
      X.fillStyle = P.acc; X.fillRect(x - lw / 2, y + L.height - size * 0.55, lw, 10); }
  };

  /* 4 كلمة تتبدّل — الجملة ثابتة والكلمة تلف بعجلة. o: {lead, words[], s, every=.95, y=800, size=170} */
  FX.wordSwap = (ctx, t, o) => {
    const { X, P, E } = ctx, W = o.words, every = o.every || 0.95, y = pick(o, 'y', 800), size = o.size || 170;
    if (o.lead) ctx.text(X, o.lead, 540, y, { family: 'display', size: size * 0.88, color: o.color || P.ink });
    const i = Math.min(W.length - 1, Math.floor(Math.max(0, t - o.s) / every)), loc = t - o.s - i * every;
    const k = i === W.length - 1 && loc > every ? 1 : E.spring({ stiffness: 220, damping: 18 })(Math.max(0, loc));
    const by = y + size * 1.18, H = size * 1.53;
    X.font = ctx.font('Lalezar', 400, size); const pw = Math.max(...W.map(w => X.measureText(w).width)) + size * 0.8;
    X.save(); X.fillStyle = o.pill || P.acc; X.beginPath(); X.roundRect(540 - pw / 2, by - H / 2, pw, H, H * 0.17); X.fill(); X.clip();
    if (i > 0 && k < 1) ctx.text(X, W[i - 1], 540, by + size * 0.34 - H * k, { family: 'display', size, color: '#FFFFFF', alpha: 1 - k });
    ctx.text(X, W[i], 540, by + size * 0.34 + (i > 0 ? H * (1 - k) : 0), { family: 'display', size, color: '#FFFFFF' });
    X.restore();
  };

  /* 5 عدسة التركيز — الجملة مغبشة إلا كلمة، وأقواس تتنقّل. o: {text, s, seq:[i...], dwell=1.1, y=880, size=128} */
  FX.focus = (ctx, t, o) => {
    const { X, P, E } = ctx, size = o.size || 128, seq = o.seq || [0], dwell = o.dwell || 1.1;
    const { B } = boxesOf(ctx, o.text, 540, pick(o, 'y', 880), { size, lineHeight: 1.3 });
    const f = Math.max(0, (t - o.s) / dwell), i = Math.min(seq.length - 1, Math.floor(f)), m = E.expoInOut(cl((f - i) / 0.4));
    const a = B[seq[Math.max(0, i - 1)]], b = B[seq[i]], mv = i === 0 ? 1 : m, intro = E.expoOut(cl((t - o.s + 0.4) / 0.6));
    B.forEach((w, j) => {
      const isF = j === seq[i] ? mv : (i > 0 && j === seq[i - 1] ? 1 - mv : 0), bl = 4.5 * (1 - isF);
      X.save(); X.filter = bl > 0.2 ? `blur(${bl.toFixed(1)}px)` : 'none'; X.globalAlpha = (0.6 + 0.4 * isF) * intro;
      ctx.text(X, w.text, w.x + w.w, w.base, { family: 'display', size, align: 'right', color: isF > 0.5 ? P.ink : P.mut }); X.restore();
    });
    const pad = 22, x = lerp(a.x, b.x, mv) - pad, y = lerp(a.y, b.y, mv) + 6, w = lerp(a.w, b.w, mv) + pad * 2, h = size * 1.15, c = 34;
    X.save(); X.strokeStyle = P.acc; X.lineWidth = 9; X.lineCap = 'round'; X.globalAlpha = intro;
    [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([cx, cy, sx, sy]) => {
      X.beginPath(); X.moveTo(cx, cy + sy * c); X.lineTo(cx, cy); X.lineTo(cx + sx * c, cy); X.stroke(); });
    X.restore();
  };

  /* 6 فك الشفرة — حروف عربية تتقلب وتستقر من اليمين (السطر كله بنداء واحد فالوصلات سليمة). o: {text, s, per=.16, y=960, size=210, bar=true} */
  const POOL = 'ابتثجحخدذرزسشصضطظعغفقكلمنهوي';
  FX.decrypt = (ctx, t, o) => {
    const { X, P, at } = ctx, ch = [...o.text], n = ch.length, per = o.per || 0.16, fr = Math.floor(t * 18), y = pick(o, 'y', 960);
    let out = '';
    ch.forEach((c, i) => { const settle = o.s + 0.35 + i * per; if (t < o.s + i * 0.03) return; if (c === ' ' || t >= settle) { out += c; return; } out += POOL[Math.floor(ctx.hash01(fr, i) * POOL.length)]; });
    const done = at(t, o.s + 0.35 + n * per, o.s + 0.65 + n * per, 'backOut');
    ctx.text(X, out, 540, y, { family: 'display', size: o.size || 210, color: done > ON ? P.acc : (o.color || '#FFFFFF'), maxWidth: 900, scaleX: 1 + 0.04 * Math.sin(done * Math.PI) });
    if (o.bar !== false) { const p = cl((t - o.s) / (n * per + 0.35));
      X.fillStyle = 'rgba(128,128,128,.25)'; X.fillRect(240, y + 120, 600, 6); X.fillStyle = P.acc; X.fillRect(840 - 600 * p, y + 120, 600 * p, 6);
      ctx.text(X, ctx.num(Math.round(p * 100)) + '%', 540, y + 210, { family: 'num', weight: 600, size: 44, color: P.mut, dir: 'ltr' }); }
  };

  /* 7 عدّاد — كل خانة تلف وتوقف بالتتابع. o: {value:'1000', s, y=980, size=260, plus=true, label} */
  FX.counter = (ctx, t, o) => {
    const { X, P, at, E } = ctx, target = String(o.value), n = target.length, size = o.size || 260, dw = size * 0.58, y = pick(o, 'y', 980), s0 = o.s;
    X.save(); X.beginPath(); X.rect(0, y - size * 0.8, 1080, size * 0.9); X.clip();
    for (let j = 0; j < n; j++) {
      const d = +target[j], stop = 1.0 + (n - 1 - j) * 0.28, k = Math.min(1, E.spring({ stiffness: 140, damping: 14 })(Math.max(0, t - s0) * (1.32 / stop)));
      const pos = ((2 + j) * 10 + d) * k, fl = pos - Math.floor(pos), x = 540 - ((n - 1) / 2 - j) * dw - (o.plus === false ? 0 : 40);
      for (const off of [0, 1]) ctx.text(X, String((Math.floor(pos) + off) % 10), x, y + (off - fl) * size * 0.9, { family: 'num', weight: 900, size, color: o.color || '#FFFFFF', dir: 'ltr' });
    }
    X.restore();
    if (o.plus !== false) ctx.text(X, '+', 540 + (n * dw) / 2 + 20, y - 20, { family: 'num', weight: 900, size: size * 0.77, color: P.acc, dir: 'ltr', alpha: Math.min(1, at(t, s0 + 2, s0 + 2.4, 'backOut')) });
    if (o.label) { const a = at(t, s0 + 2.2, s0 + 2.7, 'expoOut'); ctx.text(X, o.label, 540, y + 200 + 40 * (1 - a), { family: 'body', weight: 700, size: 70, color: P.hi || P.acc, alpha: a }); }
  };

  /* 21 آلة كاتبة — النص ينكتب بمؤشر والحرف يحافظ على اتصاله. o: {text, s, dur=2, x=900 (يمين السطر), y=945, size=76, color} */
  FX.typewriter = (ctx, t, o) => {
    const { X, P } = ctx, size = o.size || 76, x = pick(o, 'x', 900), y = pick(o, 'y', 945), p = cl((t - o.s) / (o.dur || 2)), sub = ctx.text.typeSub(o.text, p);
    X.font = ctx.font('IBM Plex Sans Arabic', 700, size);
    ctx.text(X, sub, x, y, { family: 'body', weight: 700, size, align: 'right', color: o.color || P.ink });
    const w = X.measureText(sub).width;
    if (t >= o.s && (p < 1 || Math.floor(t * 3) % 2 === 0)) { X.fillStyle = P.acc; X.fillRect(x - w - 18, y - size * 0.85, 8, size * 1.13); }
  };

  /* 22 مطّ الكشيدة — الكلمة تتمدد بالعرض ثم ترجع. o: {text, s, hold=1.1, x=540, y=1000, size=300, w=960, underline=true} */
  FX.kashida = (ctx, t, o) => {
    const { X, P, at } = ctx, hold = pick(o, 'hold', 1.1), x = pick(o, 'x', 540), y = pick(o, 'y', 1000);
    const k = at(t, o.s + 0.45, o.s + 1.45, 'expoInOut') * (1 - at(t, o.s + 1.45 + hold, o.s + 2.05 + hold, 'expoInOut')), a = at(t, o.s, o.s + 0.35, 'backOut');
    if (a > ON) { X.save(); X.translate(x, y); X.scale(a, a); ctx.text.drawKashida(X, o.text, 0, 0, o.w || 960, { family: 'display', size: o.size || 300, color: o.color || P.acc }, k); X.restore(); }
    if (o.underline !== false) { const lw = (o.w || 960) * 0.94 * k; X.fillStyle = P.ink; X.fillRect(x - lw / 2, y + 70, lw, 8); }
  };

  /* ── ب) انتقالات بلا قصّ (A و B دوال ترسم الإطار كامل) ─────────── */

  /* 8 زوم مدموج — زوم وغباش يبلغ ذروته بالنص، والمركز يمشي يمين←يسار. o: {s, dur=1, A, B} */
  FX.crossZoom = (ctx, t, o) => {
    const { X, E } = ctx, p = pr(t, o.s, o.s + (o.dur || 1)), b = Math.sin(Math.PI * p), mix = E.expoInOut(p), cx = lerp(0.75, 0.25, p) * 1080;
    const layer = (fn, al, s) => { X.save(); X.globalAlpha = al; if (b > 0.02) X.filter = `blur(${(b * 18).toFixed(1)}px)`; X.translate(cx, 960); X.scale(s, s); X.translate(-cx, -960); fn(X); X.restore(); };
    if (mix < 0.998) layer(o.A, 1, 1 + 0.5 * b);
    if (mix > 0.002) layer(o.B, mix < 0.998 ? mix : 1, 1 + 0.5 * b);
    if (b > 0.05) for (let j = 1; j <= 3; j++) layer(mix < 0.5 ? o.A : o.B, 0.18 * b, 1 + 0.5 * b + 0.12 * j * b);
  };

  /* 9 مسحة — المشهد الجديد يمسح من اليمين لليسار بحافة مموّهة. o: {s, dur=1.3, A, B, band=260} */
  FX.softWipe = (ctx, t, o) => {
    const { X, at } = ctx, band = o.band || 260, k = at(t, o.s, o.s + (o.dur || 1.3), 'cubicInOut'), edge = 1080 + band - (1080 + 2 * band) * k;
    o.A(X); if (k <= 0) return;
    X.save(); X.beginPath(); X.rect(edge + band / 2, 0, 1200, 1920); X.clip(); o.B(X); X.restore();
    const n = 14, sw = band / n;
    for (let i = 0; i < n; i++) { X.save(); X.globalAlpha = (i + 0.5) / n; X.beginPath(); X.rect(edge - band / 2 + i * sw, 0, sw + 0.5, 1920); X.clip(); o.B(X); X.restore(); }
  };

  /* 10 فتحة دائرية — نقطة تكبر وتبلع الشاشة وتكشف B. o: {s, dur=1, A, B, at=[540,1135], dotIn=.4 (ظهور النقطة قبل s)} */
  FX.iris = (ctx, t, o) => {
    const { X, P, at } = ctx, c = o.at || [540, 1135], d = o.dur || 1;
    o.A(X);
    const r = 26 * at(t, o.s - 1, o.s - 1 + (o.dotIn || 0.4), 'backOut') + 2400 * at(t, o.s, o.s + d, 'expoIn');
    X.fillStyle = o.ring || P.acc; X.beginPath(); X.arc(c[0], c[1], r, 0, 6.283); X.fill();
    if (r > 30) { X.save(); X.beginPath(); X.arc(c[0], c[1], Math.max(0, r - 60), 0, 6.283); X.clip();
      const z = 1.25 - 0.25 * at(t, o.s + 0.2, o.s + 1.8, 'expoOut'); X.translate(c[0], c[1]); X.scale(z, z); X.translate(-c[0], -c[1]); o.B(X); X.restore(); }
  };

  /* 11 سحبة — ويب بان لليسار بغباش حركة. o: {s, dur=.6, A, B} */
  FX.whip = (ctx, t, o) => {
    const { X, E } = ctx, d = o.dur || 0.6, pos = tt => E.expoInOut(pr(tt, o.s, o.s + d)), k = pos(t);
    const v = Math.abs(pos(t + 0.008) - pos(t - 0.008)) / 0.016, bl = Math.min(40, v * 9 * (0.6 / d)), N = bl > 1 ? 7 : 1;
    for (let s = 0; s < N; s++) {
      const off = N > 1 ? (s / (N - 1) - 0.5) * bl * 4 : 0;
      X.save(); X.globalAlpha = 1 / (s + 1); if (bl > 1) X.filter = `blur(${(bl / 3).toFixed(1)}px)`;
      if (k < 0.999) { X.save(); X.translate(-1080 * k + off, 0); o.A(X); X.restore(); }
      if (k > 0.001) { X.save(); X.translate(1080 - 1080 * k + off, 0); o.B(X); X.restore(); }
      X.restore();
    }
  };

  /* 14 زوم ومسحة — A ينسحب لقدّام، وبذروته B يمسح من اليمين بشريط. o: {s, dur=.9, A, B, focus=[540,760], bar=P.ink} */
  FX.zoomWipe = (ctx, t, o) => {
    const { X, P, at } = ctx, p = pr(t, o.s, o.s + (o.dur || 0.9)), f = o.focus || [540, 760], z = 1 + 1.4 * at(p, 0, 0.45, 'expoIn');
    X.save(); X.translate(f[0], f[1]); X.scale(z, z); X.translate(-f[0], -f[1]); o.A(X); X.restore();
    const w = at(p, 0.35, 0.85, 'expoOut'), edge = 1080 - 1180 * w;
    if (w > 0) { X.save(); X.beginPath(); X.rect(edge, 0, 1200, 1920); X.clip(); o.B(X); X.restore(); X.fillStyle = o.bar || P.ink; X.fillRect(edge - 24, 0, 24, 1920); }
  };

  /* 23 زوم داخل النقطة — الكاميرا تدخل نقطة لين تصير الشاشة كلها، ثم B. o: {s, dur=1.1, A, B, dot=[x,y], r=30, color=P.acc} */
  FX.dotZoom = (ctx, t, o) => {
    const { X, P, at } = ctx, d = o.dur || 1.1, f = o.dot, k = at(t, o.s, o.s + d, 'expoIn'), z = Math.pow(90, k), r = (o.r || 30) * at(t, o.s - 0.7, o.s - 0.3, 'backOut');
    if (t < o.s + d) { X.save(); X.translate(f[0], f[1]); X.scale(z, z); X.translate(-f[0], -f[1]); o.A(X);
      X.fillStyle = o.color || P.acc; X.beginPath(); X.arc(f[0], f[1], r, 0, 6.283); X.fill(); X.restore(); }
    else o.B(X);
  };

  /* ── ج) كاميرا (تلف أي رسم: o.draw = (Y) => {...}) ─────────────── */

  /* 12 دخلة — زوم بطيء لقدّام على الجملة المهمة + غباش خفيف للخلفية. o: {s, dur=1.6, to=1.12, focus=[540,640], draw, sharp:(Y)=>{} (يرسم الجزء اللي يبقى حاد، اختياري)} */
  FX.pushIn = (ctx, t, o) => {
    const { X, at } = ctx, k = at(t, o.s, o.s + (o.dur || 1.6), 'sineInOut'), z = 1 + ((o.to || 1.12) - 1) * k, f = o.focus || [540, 640];
    X.save(); X.translate(f[0], f[1]); X.scale(z, z); X.translate(-f[0], -f[1]);
    if (o.blur !== false && k > 0.02) X.filter = `blur(${(3 * k).toFixed(2)}px)`;
    o.draw(X); X.filter = 'none'; if (o.sharp) o.sharp(X);
    X.restore();
  };

  /* 13 طلعة للخلف — نبدأ لاصقين بالعنصر والكاميرا ترجع وتكشف اللي حوله. o: {s, dur=1.8, from (زوم البداية), focus=[cx,cy], draw} */
  FX.pullOut = (ctx, t, o) => {
    const { X, at } = ctx, k = at(t, o.s, o.s + (o.dur || 1.8), 'cubicInOut'), z = lerp(o.from || 1.15, 1, k), f = o.focus || [540, 960];
    X.save(); X.translate(540, 960); X.scale(z, z); X.translate(-lerp(f[0], 540, k), -lerp(f[1], 960, k));
    o.draw(X); X.restore();
  };

  /* 20 تبطيء الضربة — يرجّع وقت المحتوى المعاد (τ) بدل t: سرعة عادية ← low بلحظة الضربة ← ترجع. استخدم τ مكان t بأي حركة.
     o: {hit (وقت الضربة), low=.25, ramp=.4, hold=.6} → FX.ramp(t, o) = τ */
  FX.ramp = (t, o) => {
    const low = pick(o, 'low', 0.25), rp = pick(o, 'ramp', 0.4), hold = pick(o, 'hold', 0.6), a = o.hit - rp, b = o.hit, c = o.hit + hold, d = c + rp;
    // تكامل السرعة تحليلياً (smoothstep): v = 1 - (1-low)*S(a,b) + (1-low)*S(c,d)
    const I = (x, p, q) => { if (x <= p) return 0; if (x >= q) return x - p - (q - p) / 2; const u = (x - p) / (q - p); return (q - p) * (u * u * u - u * u * u * u / 2); };
    return t - (1 - low) * I(t, a, b) + (1 - low) * I(t, c, d);
  };
  FX.speedAt = (t, o) => (FX.ramp(t + 1e-3, o) - FX.ramp(t - 1e-3, o)) / 2e-3;

  /* ── د) كروت وطبقات ──────────────────────────────────────────── */

  /* 15 إشعارات تتكدّس — كل نقطة إشعار جوال بسبرنق، والقديمة تنزاح تحت. o: {items:[[عنوان, سطر]], s, every=.85, y=560, gap=200, tag='الحين'} */
  FX.notifs = (ctx, t, o) => {
    const { X, P, E } = ctx, sp = E.spring({ stiffness: 350, damping: 30 }), N = o.items, every = o.every || 0.85, gap = o.gap || 200;
    const shown = N.filter((_, i) => t >= o.s + i * every).length;
    for (let i = N.length - 1; i >= 0; i--) {
      const d = t - (o.s + i * every); if (d < 0) continue;
      let slot = 0; for (let j = i + 1; j < N.length; j++) { const dj = t - (o.s + j * every); if (dj >= 0) slot += Math.min(1.05, sp(dj)); }
      const s = Math.min(1.08, sp(d));
      X.save(); X.translate(540, pick(o, 'y', 560) + slot * gap); X.scale(s, s);
      X.shadowColor = 'rgba(27,26,23,.13)'; X.shadowBlur = 40; X.shadowOffsetY = 14; X.fillStyle = o.card || '#FFFFFF';
      X.beginPath(); X.roundRect(-440, -80, 880, 160, 40); X.fill(); X.shadowColor = 'transparent';
      X.fillStyle = i === shown - 1 ? P.acc : P.ink; X.beginPath(); X.roundRect(300, -50, 100, 100, 28); X.fill();
      ctx.text(X, String(i + 1), 350, 22, { family: 'num', weight: 800, size: 60, color: '#fff', dir: 'ltr' });
      ctx.text(X, N[i][0], 260, N[i][1] ? -6 : 16, { family: 'body', weight: 700, size: 48, align: 'right', color: P.ink, maxWidth: 620 });
      if (N[i][1]) ctx.text(X, N[i][1], 260, 46, { family: 'body', weight: 400, size: 36, align: 'right', color: P.mut, maxWidth: 620 });
      if (o.tag !== null) ctx.text(X, o.tag || 'الحين', -400, -20, { family: 'body', weight: 400, size: 30, align: 'left', color: P.mut });
      X.restore();
    }
  };

  /* 16 قلم تحديد — ضربة ماركر ورا كلمة (يمين←يسار) وخط تحت ثانية. o: {text, s, mark=i, under=j, y=860, size=150} */
  FX.highlight = (ctx, t, o) => {
    const { X, P, at } = ctx, size = o.size || 150, y = pick(o, 'y', 860);
    const { L, B } = boxesOf(ctx, o.text, 540, y, { size, lineHeight: 1.3 });
    if (o.mark != null) { const b = B[o.mark]; [[at(t, o.s + 0.8, o.s + 1.2, 'cubicInOut'), 0], [at(t, o.s + 1.1, o.s + 1.4, 'cubicInOut'), 1]].forEach(([k, pass]) => { if (k <= 0) return;
      const pts = []; for (let i = 0; i <= 6; i++) pts.push([b.x + b.w + 14 - (b.w + 28) * i / 6, b.cy + 18 + (pass ? 10 : -6) + ctx.noise1(i * 1.7 + pass * 9, 4) * 7]);
      ctx.drawPath(X, pts, k, { width: size * 0.55, color: o.markColor || 'rgba(232,162,131,0.75)', cap: 'round' }); }); }
    if (o.under != null) { const b = B[o.under], pts = []; for (let i = 0; i <= 8; i++) pts.push([b.x + b.w + 10 - (b.w + 20) * i / 8, b.base + 26 + ctx.noise1(i * 1.3, 8) * 6]);
      ctx.drawPath(X, pts, at(t, o.s + 1.9, o.s + 2.4, 'cubicInOut'), { width: 12, color: P.acc, cap: 'round' }); }
    ctx.text.drawLayout(X, L, 540, y, { perWord: (i) => { const a = at(t, o.s + i * 0.1, o.s + 0.4 + i * 0.1, 'expoOut'); return { alpha: a, dy: 30 * (1 - a), color: o.color || P.ink }; } });
  };

  /* 17 لمعة — شريط ضوء مايل يعبر الأشكال اللي يرسمها o.draw (يمين←يسار) كل period. o: {s, period=2, draw:(Y)=>{}} */
  FX.shine = (ctx, t, o) => {
    const { X } = ctx, me = FX._shine || (FX._shine = { c: document.createElement('canvas') }), c = me.c;
    if (c.width !== X.canvas.width || c.height !== X.canvas.height) { c.width = X.canvas.width; c.height = X.canvas.height; }
    const Y = c.getContext('2d'); Y.setTransform(1, 0, 0, 1, 0, 0); Y.clearRect(0, 0, c.width, c.height); Y.setTransform(X.getTransform());
    o.draw(Y);
    const per = o.period || 2, ph = (((t - o.s) % per) + per) % per, sx = 1300 - 1700 * ctx.E.cubicInOut(Math.min(1, ph / (per * 0.55)));
    if (t > o.s) { Y.save(); Y.globalCompositeOperation = 'source-atop';
      const g = Y.createLinearGradient(sx - 160, 0, sx + 160, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,0.85)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      Y.translate(sx, 960); Y.transform(1, 0, -Math.tan(0.52), 1, 0, 0); Y.translate(-sx, -960); Y.fillStyle = g; Y.fillRect(sx - 160, 0, 320, 1920); Y.restore(); }
    X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.drawImage(c, 0, 0); X.restore();
  };

  /* ── هـ) قواعد مونتاج (مو رسم — تُطبّق على التايملاين/التوقيت) ─────
     18 J-cut  : صوت اللقطة الجاية يبدأ قبل صورتها بـ4–12 فريم (L-cut العكس: الصوت يكمل 12–24 فريم بعد القص).
     19 قطع مطابق: الشكل اللي يكمل (دايرة/خط/اتجاه) بنفس المكان والحجم بالضبط على فريم القص، والحركة نفسها مستمرة؛ فرق فريم أو فريمين يكسره.
     20 تبطيء الضربة: FX.ramp فوق. */
  FX.rules = { jcut: { leadFrames: [4, 12] }, lcut: { tailFrames: [12, 24] }, matchCut: { tolerancePx: 8 } };

  G.FX = FX;
})();
