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


  /* ═══ 24–50: توسعة البنك (13 أكتوبر) — نفس العقد: كل خاصية من t، الألوان من P، الكلمات العربية كاملة ═══ */
  const ss = (a, b, x) => { const k = cl((x - a) / (b - a)); return k * k * (3 - 2 * k); };
  const zoomAt = (X, f, z) => { X.translate(f[0], f[1]); X.scale(z, z); X.translate(-f[0], -f[1]); };
  // لقطة من الإطار: يرسم fn على X نفسه (فأي FX متداخل يرسم على ctx.X يطلع صح) ثم ينسخ البكسلات لكانفس جانبي. slot = اسم ثابت لكل استخدام
  const snap = (X, slot, fn) => {
    const me = FX['_' + slot] || (FX['_' + slot] = { c: document.createElement('canvas') }), c = me.c;
    if (c.width !== X.canvas.width || c.height !== X.canvas.height) { c.width = X.canvas.width; c.height = X.canvas.height; }
    X.save(); fn(X); X.restore();
    const Y = c.getContext('2d'); Y.setTransform(1, 0, 0, 1, 0, 0); Y.clearRect(0, 0, c.width, c.height); Y.drawImage(X.canvas, 0, 0); return c;
  };
  // يرسم جزء من اللقطة (بإحداثيات التصميم) لمستطيل وجهة (بإحداثيات التصميم)
  const blit = (X, c, sx, sy, sw, sh, dx, dy, dw, dh) => {
    const m = X.getTransform(); if (sw <= 0 || sh <= 0) return;
    X.save(); X.setTransform(1, 0, 0, 1, 0, 0);
    X.drawImage(c, m.a * sx + m.e, m.d * sy + m.f, m.a * sw, m.d * sh, m.a * dx + m.e, m.d * dy + m.f, m.a * dw, m.d * dh); X.restore();
  };

  /* ── و) انتقالات (A و B دوال ترسم الإطار كامل) ── */

  /* 24 غمضة لون — A يغيب بلون الخلفية ويرجع B، مع نفَس زوم خفيف. o: {s, dur=1.2, A, B, color=P.bg, hold=.4 (طول اللون بالنص)} */
  FX.dipFade = (ctx, t, o) => {
    const { X, P } = ctx, p = pr(t, o.s, o.s + (o.dur || 1.2)), cp = pick(o, 'hold', 0.4);
    const a = (1 - p) * ss(1 - cp, 0, p), b = p * ss(cp, 1, p);
    X.fillStyle = o.color || P.bg; X.fillRect(0, 0, 1080, 1920);
    if (a > 0.002) { X.save(); X.globalAlpha = a; zoomAt(X, [540, 960], 1 + 0.04 * p); o.A(X); X.restore(); }
    if (b > 0.002) { X.save(); X.globalAlpha = b; zoomAt(X, [540, 960], 1.04 - 0.04 * p); o.B(X); X.restore(); }
  };

  /* 25 كرت يغطي — B يطلع من تحت ككرت بزوايا دائرية ويغطي A، وA يرجع لورا ويغمق. o: {s, dur=.9, A, B, dir='up'|'left'} */
  FX.slideOver = (ctx, t, o) => {
    const { X, P, E } = ctx, k = E.smooth(pr(t, o.s, o.s + (o.dur || 0.9))), up = o.dir !== 'left';
    X.save(); zoomAt(X, [540, 960], 1 - 0.06 * k); X.translate(up ? 0 : 120 * k, up ? -140 * k : 0); o.A(X); X.restore();
    if (k <= 0.001) return;
    X.save(); X.globalAlpha = 0.45 * k; X.fillStyle = P.ink; X.fillRect(0, 0, 1080, 1920); X.restore();
    const off = (1 - k) * (up ? 1920 : -1080), r = 70 * (1 - k);
    X.save(); X.translate(up ? 0 : off, up ? off : 0);
    if (k < 0.999) { X.shadowColor = 'rgba(0,0,0,.35)'; X.shadowBlur = 60; X.shadowOffsetY = -10; X.fillStyle = P.bg; X.beginPath(); X.roundRect(0, 0, 1080, 1920, r); X.fill(); X.shadowColor = 'transparent'; }
    X.beginPath(); X.roundRect(0, 0, 1080, 1920, r); X.clip(); o.B(X); X.restore();
  };

  /* 26 عقرب الساعة — B ينكشف بدورة من فوق مع عقرب بلون الهوية. o: {s, dur=1, A, B, at=[540,960], hand=true} */
  FX.clockWipe = (ctx, t, o) => {
    const { X, P, E } = ctx, k = E.cubicInOut(pr(t, o.s, o.s + (o.dur || 1))), c = o.at || [540, 960], R = 2300, a0 = -Math.PI / 2, a1 = a0 + 6.2832 * k;
    o.A(X); if (k <= 0.001) return;
    X.save(); X.beginPath(); X.moveTo(c[0], c[1]); X.arc(c[0], c[1], R, a0, a1); X.closePath(); X.clip(); o.B(X); X.restore();
    if (o.hand !== false && k < 0.999) { X.save(); X.strokeStyle = o.color || P.acc; X.lineWidth = 16; X.lineCap = 'round'; X.beginPath(); X.moveTo(c[0], c[1]); X.lineTo(c[0] + Math.cos(a1) * R, c[1] + Math.sin(a1) * R); X.stroke();
      X.fillStyle = o.color || P.acc; X.beginPath(); X.arc(c[0], c[1], 26, 0, 6.283); X.fill(); X.restore(); }
  };

  /* 27 شرائح — B يطلع من شرائح طولية تعرض، من اليمين لليسار. o: {s, dur=1, A, B, count=8, soft=.5, edge=P.acc} */
  FX.slices = (ctx, t, o) => {
    const { X, P } = ctx, n = o.count || 8, sm = pick(o, 'soft', 0.5), p = pr(t, o.s, o.s + (o.dur || 1)), cw = 1080 / n;
    o.A(X); if (p <= 0) return;
    const cells = [];
    for (let i = 0; i < n; i++) { const xr = (i + 0.5) / n, q = ss(-sm, 0, xr - p * (1 + sm)), w = cw * (1 - q); if (w > 0.5) cells.push([1080 - (i + 1) * cw, w]); }
    X.save(); X.beginPath(); cells.forEach(([x, w]) => X.rect(x + cw - w, 0, w, 1920)); X.clip(); o.B(X); X.restore();
    if (o.edge !== null && p < 1) { X.fillStyle = o.edge || P.acc; cells.forEach(([x, w]) => { if (w < cw - 1) X.fillRect(x + cw - w - 5, 0, 10, 1920); }); }
  };

  /* 28 قلتش — كتل الإطار تنزاح أفقياً مع ظل لوني، ويقلب من A لـB بالنص. o: {s, dur=.5, A, B, amp=90} */
  FX.glitch = (ctx, t, o) => {
    const { X, P } = ctx, d = o.dur || 0.5, p = pr(t, o.s, o.s + d), g = Math.sin(Math.PI * p), fr = Math.floor(t * 24);
    if (g < 0.02) { (p < 0.5 ? o.A : o.B)(X); return; }
    const Sc = snap(X, 'glA', o.A), Tc = snap(X, 'glB', o.B);
    const base = p < 0.5 ? Sc : Tc, other = p < 0.5 ? Tc : Sc, amp = (o.amp || 90) * g;
    blit(X, base, 0, 0, 1080, 1920, 0, 0, 1080, 1920);
    let y = 0, j = 0;
    while (y < 1920) {
      const h = 30 + 170 * ctx.hash01(fr, j, 1), r = ctx.hash01(fr, j, 2);
      if (r < 0.55 * g) { const dx = (ctx.hash01(fr, j, 3) - 0.5) * 2 * amp, src = ctx.hash01(fr, j, 4) < 0.35 * g ? other : base;
        blit(X, src, 0, y, 1080, h, dx, y, 1080, h);
        if (r < 0.18 * g) { X.save(); X.globalAlpha = 0.5 * g; X.fillStyle = ctx.hash01(fr, j, 5) < 0.5 ? P.acc : P.ink; X.fillRect(0, y, 1080, Math.min(h, 14)); X.restore(); } }
      y += h; j++;
    }
    X.save(); X.globalAlpha = 0.28 * g; blit(X, base, 0, 0, 1080, 1920, 14 * g, 0, 1080, 1920); blit(X, base, 0, 0, 1080, 1920, -14 * g, 0, 1080, 1920); X.restore();
  };

  /* 29 قلبة — الإطار يقلب كرت بمنظور حول محور طولي، وB على ظهره. o: {s, dur=.9, A, B, bg (الأغمق من ink/bg), depth=2200} */
  FX.flip = (ctx, t, o) => {
    const { X, P, E } = ctx, k = E.cubicInOut(pr(t, o.s, o.s + (o.dur || 0.9)));
    if (k <= 0.001) { o.A(X); return; } if (k >= 0.999) { o.B(X); return; }
    const th = Math.PI * k, back = k > 0.5, ang = back ? th - Math.PI : th, D = o.depth || 2200, Sc = snap(X, 'flip', back ? o.B : o.A), S = { c: Sc }, dk = darker(P.ink, P.bg);
    X.fillStyle = o.bg || dk; X.fillRect(0, 0, 1080, 1920);
    const N = 90, push = 1 - 0.12 * Math.sin(th);
    for (let i = 0; i < N; i++) {
      const u0 = -1 + 2 * i / N, u1 = u0 + 2 / N, P0 = u => { const x = u * 540 * Math.cos(ang), z = u * 540 * Math.sin(ang) * (back ? -1 : 1), f = D / (D + z) * push; return [540 + x * f, f]; };
      const [x0, f0] = P0(u0), [x1, f1] = P0(u1), f = (f0 + f1) / 2, h = 1920 * f, w = x1 - x0;
      if (Math.abs(w) < 0.1) continue;
      blit(X, S.c, (u0 + 1) * 540, 0, 1080 / N, 1920, Math.min(x0, x1), 960 - h / 2, Math.abs(w) + 0.6, h);
    }
    const E0 = u => { const x = u * 540 * Math.cos(ang), z = u * 540 * Math.sin(ang) * (back ? -1 : 1), f = D / (D + z) * push; return [540 + x * f, 960 * f]; }, [ax, ah] = E0(-1), [bx, bh] = E0(1);
    X.save(); X.globalAlpha = 0.3 * Math.sin(th); X.fillStyle = dk; X.beginPath(); X.moveTo(ax, 960 - ah); X.lineTo(bx, 960 - bh); X.lineTo(bx, 960 + bh); X.lineTo(ax, 960 + ah); X.closePath(); X.fill(); X.restore();
  };

  /* 30 تسريب ضوء — بقع ضوء دافية (من ألوان الهوية) تعبر من اليمين ويتبدل المشهد تحتها. o: {s, dur=1.4, A, B, colors=[P.hi, P.acc]} */
  FX.lightLeak = (ctx, t, o) => {
    const { X, P } = ctx, p = pr(t, o.s, o.s + (o.dur || 1.4)), g = Math.sin(Math.PI * p), mix = ss(0.35, 0.65, p), cols = o.colors || [P.hi || P.acc, P.acc];
    if (mix < 1) o.A(X);
    if (mix > 0) { X.save(); X.globalAlpha = mix; o.B(X); X.restore(); }
    if (g < 0.01) return;
    X.save(); X.globalCompositeOperation = 'screen';
    [[0, 1.0, 900], [1, 0.75, 700], [0, 0.55, 520]].forEach(([ci, sp, rad], j) => {
      const cx = 1500 - 1900 * p * sp - j * 120, cy = 700 + 500 * j + 120 * ctx.noise1(p * 3 + j * 7, 3);
      const gr = X.createRadialGradient(cx, cy, 0, cx, cy, rad); gr.addColorStop(0, cols[ci]); gr.addColorStop(1, 'rgba(0,0,0,0)');
      X.globalAlpha = 0.65 * g; X.fillStyle = gr; X.fillRect(0, 0, 1080, 1920);
    });
    X.restore();
  };

  /* ── ز) كاميرا (o.draw = (Y) => {...}) ── */

  /* 31 كاميرا باليد — اهتزاز ناعم مستمر (wiggle) كأنها كاميرا محمولة. o: {s=0, draw, amp=10, freq=.7, rot=.004, zoom=1.04, fade=.4, e (نهاية اختيارية)} */
  FX.handheld = (ctx, t, o) => {
    const { X } = ctx, s = o.s || 0, env = ss(s, s + pick(o, 'fade', 0.4), t) * (o.e != null ? 1 - ss(o.e - 0.4, o.e, t) : 1), f = o.freq || 0.7, A = pick(o, 'amp', 10) * env;
    const n = (sd) => ctx.noise1(t * f, sd) + 0.5 * ctx.noise1(t * f * 2.1, sd + 10);
    X.save(); X.translate(540 + A * n(1), 960 + A * n(2)); X.rotate(pick(o, 'rot', 0.004) * env * n(3)); const z = 1 + (pick(o, 'zoom', 1.04) - 1) * env; X.scale(z, z); X.translate(-540, -960);
    o.draw(X); X.restore();
  };

  /* 32 كين بيرنز — زوم وتحريك بطيء من نقطة لنقطة. o: {s, dur=4, from=[cx,cy,zoom], to=[cx,cy,zoom], draw, clamp=true (المركز ينحصر فما يبين طرف فاضي)} */
  FX.kenBurns = (ctx, t, o) => {
    const { X, at } = ctx, k = at(t, o.s, o.s + (o.dur || 4), 'sineInOut'), a = o.from || [580, 920, 1.08], b = o.to || [480, 1010, 1.2];
    const z = lerp(a[2], b[2], k), cv = (v, half) => (o.clamp === false || z < 1 ? v : cl(v, half / z, (half * 2) - half / z));   // ما يطلع طرف فاضي
    const cx = cv(lerp(a[0], b[0], k), 540), cy = cv(lerp(a[1], b[1], k), 960);
    X.save(); X.translate(540, 960); X.scale(z, z); X.translate(-cx, -cy); o.draw(X); X.restore();
  };

  /* 33 زوم الضربة — قفزة زوم سريعة بلحظة الكلمة ترتد وتثبت (inertial bounce)، وترجع لو o.back. o: {s, to=1.22, focus=[540,800], back (وقت الرجوع), draw} */
  FX.snapZoom = (ctx, t, o) => {
    const { X, E } = ctx, to = o.to || 1.22, dt = t - o.s - 0.1;
    let k = E.quartOut(pr(t, o.s, o.s + 0.1));
    if (dt > 0) k = 1 + 0.12 * Math.sin(2.2 * dt * 6.2832) / Math.exp(7 * dt);
    if (o.back != null) k *= 1 - E.expoInOut(pr(t, o.back, o.back + 0.35));
    X.save(); zoomAt(X, o.focus || [540, 800], 1 + (to - 1) * k); o.draw(X); X.restore();
  };

  /* 34 رجّة — رجّة كاميرا بضجيج تخف وتختفي (magnitude/roughness). o: {s, mag=28, rough=14, fadeIn=.05, fadeOut=.7, draw} */
  FX.shake = (ctx, t, o) => {
    const { X } = ctx, fi = pick(o, 'fadeIn', 0.05), fo = pick(o, 'fadeOut', 0.7), env = t < o.s ? 0 : (t < o.s + fi ? (t - o.s) / fi : Math.max(0, 1 - (t - o.s - fi) / fo) ** 2);
    const m = (o.mag || 28) * env, r = o.rough || 14;
    X.save(); X.translate(540 + m * ctx.noise1(t * r, 11), 960 + m * ctx.noise1(t * r, 12)); X.rotate(0.0016 * m * ctx.noise1(t * r, 13));
    const z = 1 + m / 500; X.scale(z, z); X.translate(-540, -960); o.draw(X); X.restore();
  };

  /* 35 تحويل الفوكس — الحدّة تنتقل من الطبقة القريبة للبعيدة (أو العكس). o: {s, dur=1, back:(Y)=>{}, front:(Y)=>{}, max=14, to='back'|'front'} */
  FX.rackFocus = (ctx, t, o) => {
    const { X, at } = ctx, k0 = at(t, o.s, o.s + (o.dur || 1), 'sineInOut'), k = o.to === 'front' ? 1 - k0 : k0, mx = o.max || 14;
    const lay = (fn, b, z) => { X.save(); if (b > 0.3) X.filter = `blur(${b.toFixed(1)}px)`; zoomAt(X, [540, 960], z); fn(X); X.restore(); };
    lay(o.back, mx * (1 - k), 1 + 0.02 * k);
    lay(o.front, mx * k, 1);
  };

  /* 36 بارالاكس — طبقات تتحرك بسرعات مختلفة (القريبة أسرع) فيبين عمق. o: {s, dur=2.5, dist=[-260,0], zoom=1.06, layers:[{draw, depth 0..1}]} */
  FX.parallax = (ctx, t, o) => {
    const { X, at } = ctx, k = at(t, o.s, o.s + (o.dur || 2.5), 'sineInOut'), d = o.dist || [-260, 0], zm = o.zoom || 1.06;
    o.layers.forEach(L => { const dp = L.depth == null ? 0.5 : L.depth, z = 1 + (zm - 1) * dp * k;
      X.save(); X.translate(d[0] * dp * k, d[1] * dp * k); zoomAt(X, [540, 960], z); L.draw(X); X.restore(); });
  };

  /* 37 دولي زوم (فيرتيقو) — الشخص ثابت الحجم والخلفية تنفتح أو تنضم وراه. o: {s, dur=2, back, front, amount=.35, dir='out'|'in', focus=[540,960]} */
  FX.dollyZoom = (ctx, t, o) => {
    const { X, at } = ctx, k = at(t, o.s, o.s + (o.dur || 2), 'cubicInOut'), A = pick(o, 'amount', 0.35), f = o.focus || [540, 960];
    const zb = o.dir === 'in' ? 1 + A * k : 1 + A * (1 - k);
    X.save(); zoomAt(X, f, zb); o.back(X); X.restore();
    X.save(); zoomAt(X, f, 1 + 0.02 * k); o.front(X); X.restore();
  };

  /* ── ح) حركات كلمات ── */

  /* 38 كشف بالقراءة — الجملة باهتة وكل كلمة تصحى (من غباش وميلة) بتوقيتها. o: {text|line, s, step=.32, x=540, y=880, size=120, dim=.16, accent:[i]} */
  FX.scrollReveal = (ctx, t, o) => {
    const { X, P, at } = ctx, size = o.size || 120, step = pick(o, 'step', 0.32), text = o.text || ctx.lineSpan(o.line).text;
    const { B } = boxesOf(ctx, text, pick(o, 'x', 540), pick(o, 'y', 880), { size, maxWidth: o.maxWidth, lineHeight: 1.3 });
    const intro = at(t, (o.line != null ? ctx.lineSpan(o.line).s : o.s) - 0.5, (o.line != null ? ctx.lineSpan(o.line).s : o.s) - 0.1, 'cubicOut');
    B.forEach((b, i) => {
      const t0 = wt(ctx, o, i, step), k = at(t, t0 - 0.08, t0 + 0.32, 'cubicOut'), a = intro * lerp(pick(o, 'dim', 0.16), 1, k), bl = 4 * (1 - k);
      if (a <= 0.003) return;
      X.save(); X.globalAlpha = a; if (bl > 0.3) X.filter = `blur(${bl.toFixed(1)}px)`;
      X.translate(b.x + b.w, b.cy); X.rotate(0.05 * (1 - k)); X.translate(-(b.x + b.w), -b.cy);
      ctx.text(X, b.text, b.x + b.w, b.base, { family: 'display', size, align: 'right', color: (o.accent || []).includes(i) && k > 0.5 ? P.acc : (o.color || P.ink) }); X.restore();
    });
  };

  /* 39 كلمات تطيح — كل كلمة تطيح من فوق وتنط وتستقر (bounceInDown). o: {text, s, x=540, y=880, size=170, stagger=.14, out (وقت الطيحة لتحت), accent:[i]} */
  const BID = [[0, -1500, 3], [0.6, 25, 0.9], [0.75, -10, 0.95], [0.9, 5, 0.985], [1, 0, 1]];
  FX.wordDrop = (ctx, t, o) => {
    const { X, P, E, at } = ctx, size = o.size || 170, st = pick(o, 'stagger', 0.14);
    const L = ctx.text.layout(X, o.text, { family: 'display', size, maxWidth: o.maxWidth || 900, lineHeight: 1.1 });
    ctx.text.drawLayout(X, L, pick(o, 'x', 540), pick(o, 'y', 880), { perWord: (i) => {
      const p = pr(t, o.s + i * st, o.s + i * st + 0.9); if (p <= 0) return { skip: true };
      let j = 0; while (j < BID.length - 2 && p > BID[j + 1][0]) j++;
      const [p0, y0, s0] = BID[j], [p1, y1, s1] = BID[j + 1], q = E.cubicOut(cl((p - p0) / (p1 - p0)));
      const ko = o.out ? at(t, o.out + i * 0.06, o.out + 0.5 + i * 0.06, 'cubicIn') : 0;
      return { dy: lerp(y0, y1, q) + ko * 1300, scale: 1, scaleY: lerp(s0, s1, q), alpha: Math.min(1, p / 0.6) * (1 - ko), color: (o.accent || []).includes(i) ? P.acc : (o.color || P.ink) };
    } });
  };

  /* 40 فرقعة مطاطية — كلمة تفرقع وتتمطط (rubberBand) مع خطوط ضربة. o: {text, s, x=540, y=960, size=260, color=P.acc, burst=true} */
  const RB = [[0, 1, 1], [0.3, 1.25, 0.75], [0.4, 0.75, 1.25], [0.5, 1.15, 0.85], [0.65, 0.95, 1.05], [0.75, 1.05, 0.95], [1, 1, 1]];
  FX.rubberPop = (ctx, t, o) => {
    const { X, P, at } = ctx, size = o.size || 260, x = pick(o, 'x', 540), y = pick(o, 'y', 960), pop = at(t, o.s, o.s + 0.2, 'backOut');
    if (pop <= ON) return;
    const p = pr(t, o.s + 0.2, o.s + 1.0); let j = 0; while (j < RB.length - 2 && p > RB[j + 1][0]) j++;
    const q = ss(0, 1, cl((p - RB[j][0]) / (RB[j + 1][0] - RB[j][0]))), sx = lerp(RB[j][1], RB[j + 1][1], q), sy = lerp(RB[j][2], RB[j + 1][2], q), cy = y - size * 0.35;
    if (o.burst !== false) { const b = at(t, o.s + 0.12, o.s + 0.6, 'expoOut'), fade = 1 - at(t, o.s + 0.45, o.s + 0.8);
      if (b > 0 && fade > 0) { X.save(); X.strokeStyle = o.burstColor || P.ink; X.lineWidth = 12; X.lineCap = 'round'; X.globalAlpha = fade;
        for (let i = 0; i < 8; i++) { const a = i * 0.785 + 0.39, r0 = size * 0.9 + 60 * b, r1 = r0 + 90 * b * fade;
          X.beginPath(); X.moveTo(x + Math.cos(a) * r0 * 1.5, cy + Math.sin(a) * r0 * 0.75); X.lineTo(x + Math.cos(a) * r1 * 1.5, cy + Math.sin(a) * r1 * 0.75); X.stroke(); }
        X.restore(); } }
    X.save(); X.translate(x, cy); X.scale(pop * sx, pop * sy); X.translate(-x, -cy);
    ctx.text(X, o.text, x, y, { family: 'display', size, color: o.color || P.acc, maxWidth: 940 }); X.restore();
  };

  /* 41 خط يرتسم ويتعبّى — حدود الكلمة ترتسم ثم تتعبّى من تحت لفوق بموجة. o: {text, s, x=540, y=1000, size=260, draw=1.1, fill=.8, color=P.acc, line=P.ink} */
  FX.strokeFill = (ctx, t, o) => {
    const { X, P, at } = ctx, size = o.size || 260, x = pick(o, 'x', 540), y = pick(o, 'y', 1000), dr = pick(o, 'draw', 1.1), D = size * 7;
    const kd = at(t, o.s, o.s + dr, 'cubicInOut'), kf = at(t, o.s + dr * 0.8, o.s + dr * 0.8 + pick(o, 'fill', 0.8), 'cubicInOut');
    if (kd <= 0) return;
    const sty = { family: 'display', size, maxWidth: 960 };
    if (kf > 0) { const top = y + size * 0.3 - (size * 1.45) * kf, amp = 14 * Math.sin(Math.PI * kf);
      X.save(); X.beginPath(); X.moveTo(0, 1920); X.lineTo(0, top);
      for (let i = 0; i <= 24; i++) X.lineTo(i * 45, top + amp * Math.sin(i * 0.7 + t * 9));
      X.lineTo(1080, 1920); X.closePath(); X.clip(); ctx.text(X, o.text, x, y, Object.assign({ color: o.color || P.acc }, sty)); X.restore(); }
    X.save(); X.setLineDash([D * kd, D]); ctx.text(X, o.text, x, y, Object.assign({ color: null, stroke: { width: size * 0.028, color: o.line || P.ink } }, sty)); X.restore();
  };

  /* 42 ضد — كلمتين يدخلون من الجهتين (backIn) ويتواجهون، وعلامة × بالنص؛ واختياري وحدة تفوز. o: {a, b, s, y=960, size=190, win (0|1), winAt} */
  FX.versus = (ctx, t, o) => {
    const { X, P, at } = ctx, size = o.size || 190, y = pick(o, 'y', 960);
    const side = (txt, i) => {
      const p = pr(t, o.s + i * 0.15, o.s + i * 0.15 + 0.75); if (p <= 0) return;
      const m = ctx.E.cubicOut(cl(p / 0.8)), s = p < 0.8 ? 0.7 : lerp(0.7, 1, at(p, 0.8, 1, 'backOut'));
      const lose = o.win != null && o.win !== i ? at(t, o.winAt || o.s + 1.6, (o.winAt || o.s + 1.6) + 0.4) : 0, win = o.win === i ? at(t, o.winAt || o.s + 1.6, (o.winAt || o.s + 1.6) + 0.4, 'backOut') : 0;
      const yy = y + (i ? 1 : -1) * size * 0.95, dx = (i ? -1 : 1) * 1300 * (1 - m);
      X.save(); X.globalAlpha = (p < 0.8 ? 0.7 : 1) * (1 - 0.6 * lose); X.translate(540 + dx, yy - size * 0.35); const sc = s * (1 + 0.12 * win); X.scale(sc, sc); X.translate(-540, -(yy - size * 0.35));
      ctx.text(X, txt, 540, yy, { family: 'display', size, color: lose > 0.5 ? P.mut : (i ? P.acc : (o.color || P.ink)), maxWidth: 900 });
      if (lose > 0) { X.font = ctx.font('display', 400, size); const w = Math.min(900, X.measureText(txt).width); X.strokeStyle = P.ink; X.lineWidth = 12; X.lineCap = 'round'; X.beginPath(); X.moveTo(540 + w / 2 + 20, yy - size * 0.3); X.lineTo(540 + w / 2 + 20 - (w + 40) * lose, yy - size * 0.3); X.stroke(); }
      X.restore();
    };
    side(o.a, 0); side(o.b, 1);
    const k = at(t, o.s + 0.7, o.s + 1.0, 'backOut');
    if (k > ON) { X.save(); X.translate(540, y - size * 0.35); X.scale(k, k); X.rotate((1 - k) * 1.5); X.fillStyle = P.ink; X.beginPath(); X.arc(0, 0, 70, 0, 6.283); X.fill();
      X.strokeStyle = P.bg; X.lineWidth = 14; X.lineCap = 'round'; X.beginPath(); X.moveTo(-26, -26); X.lineTo(26, 26); X.moveTo(26, -26); X.lineTo(-26, 26); X.stroke(); X.restore(); }
  };

  /* 43 مسار الكلمات — الكلمات منثورة على مسار والكاميرا تمشي من كلمة لكلمة بلقطة وحدة. o: {words[], s, every=.8, size=150, gapY=480, swing=200, at:[t...] (توقيت كل كلمة، اختياري)} */
  FX.wordPath = (ctx, t, o) => {
    const { X, P, E, at } = ctx, W = o.words, n = W.length, every = o.every || 0.8, size = o.size || 150, gy = o.gapY || 480, sw = pick(o, 'swing', 200);
    const T = i => (o.at ? o.at[i] : o.s + i * every), pos = i => [540 + (i % 2 ? -sw : sw) * (i ? 1 : 0.3), 960 + i * gy];
    let cur = 0; for (let i = 0; i < n; i++) if (t >= T(i)) cur = i;
    const m = cur > 0 ? E.expoInOut(pr(t, T(cur), T(cur) + 0.5)) : 1, a = pos(Math.max(0, cur - 1)), b = pos(cur), cam = [lerp(a[0], b[0], m), lerp(a[1], b[1], m)];
    const intro = at(t, o.s - 0.4, o.s + 0.2, 'cubicOut');
    X.save(); X.translate(540 - cam[0], 960 - cam[1]);
    const pts = W.map((_, i) => [pos(i)[0], pos(i)[1] + size * 0.45]);
    if (n > 1) { X.save(); X.globalAlpha = 0.3 * intro; X.setLineDash([4, 26]); ctx.drawPath(X, pts, 1, { width: 8, color: P.mut, cap: 'round' }); X.restore();
      const kk = cur > 0 ? (cur - 1 + m) / (n - 1) : 0; if (kk > 0) ctx.drawPath(X, pts, kk, { width: 10, color: P.acc, cap: 'round' }); }
    W.forEach((w, i) => { const pp = pos(i), on = i < cur ? 1 : i === cur ? (cur ? m : 1) : 0, al = intro * (i <= cur ? lerp(0.3, 1, i === cur ? on : 0.7) : 0.2);
      ctx.text(X, w, pp[0], pp[1], { family: 'display', size: size * (1 + 0.12 * (i === cur ? on : 0)), color: i === cur ? (o.color || P.ink) : P.mut, alpha: al, maxWidth: 800 });
      if (i === cur && on > 0.05) { X.fillStyle = P.acc; X.beginPath(); X.arc(pp[0], pp[1] + size * 0.45, 16 * on, 0, 6.283); X.fill(); } });
    X.restore();
  };

  /* ── ط) كروت وطبقات ── */

  /* 44 اسم وتعريف — شريط بلون الهوية ينمو، ويطلع منه كرت الاسم ثم سطر التعريف (يمين، داخل المنطقة الآمنة). o: {name, title, s, out, y=1380, x=920 (حافة اليمين)} */
  FX.lowerThird = (ctx, t, o) => {
    const { X, P, at } = ctx, y = pick(o, 'y', 1380), xr = pick(o, 'x', 920);
    const bar = at(t, o.s, o.s + 0.35, 'expoOut'), box = at(t, o.s + 0.25, o.s + 0.8, 'expoOut'), sub = at(t, o.s + 0.55, o.s + 1.05, 'expoOut');
    const out = o.out ? at(t, o.out, o.out + 0.5, 'expoIn') : 0; if (bar <= 0 || out >= 1) return;
    X.font = ctx.font('display', 400, 84); const nw = Math.min(700, X.measureText(o.name).width) + 70; X.font = ctx.font('body', 700, 44); const tw = o.title ? Math.min(700, X.measureText(o.title).width) + 50 : 0;
    const k1 = box * (1 - out), k2 = sub * (1 - out);
    X.save(); X.fillStyle = P.acc; X.fillRect(xr - 14, y - 70 + 150 * (1 - bar) * 0.5 + 150 * out * 0.5, 14, 150 * bar * (1 - out) + (o.title ? 80 * bar * (1 - out) : 0)); X.restore();
    if (k1 > 0) { X.save(); X.beginPath(); X.rect(xr - 14 - nw * k1, y - 80, nw * k1, 120); X.clip(); X.fillStyle = P.ink; X.fillRect(xr - 14 - nw, y - 70, nw, 105);
      ctx.text(X, o.name, xr - 44 + 30 * (1 - k1), y + 12, { family: 'display', size: 84, align: 'right', color: P.bg, maxWidth: 700 }); X.restore(); }
    if (o.title && k2 > 0) { X.save(); X.beginPath(); X.rect(xr - 14 - tw * k2, y + 35, tw * k2, 90); X.clip(); X.fillStyle = P.bg; X.fillRect(xr - 14 - tw, y + 35, tw, 75);
      ctx.text(X, o.title, xr - 39, y + 88, { family: 'body', weight: 700, size: 44, align: 'right', color: P.ink, maxWidth: 700 }); X.restore(); }
  };

  /* 45 قائمة صح — كل نقطة دايرة تتعبّى وصح يرتسم، والخط بين النقاط يتقدم (Stepper). o: {items[], s, every=.8, x=880 (مركز الدواير), y=620, gap=170, size=64, at:[t...]} */
  FX.checklist = (ctx, t, o) => {
    const { X, P, at } = ctx, N = o.items, every = o.every || 0.8, x = pick(o, 'x', 880), y0 = pick(o, 'y', 620), gap = o.gap || 170, size = o.size || 64, R = 42;
    const T = i => (o.at ? o.at[i] : o.s + i * every), intro = at(t, o.s - 0.5, o.s, 'cubicOut');
    for (let i = 0; i < N.length - 1; i++) { const k = at(t, T(i) + 0.2, T(i + 1), 'cubicInOut'), ya = y0 + i * gap + R, yb = y0 + (i + 1) * gap - R;
      X.fillStyle = 'rgba(128,128,128,.25)'; X.globalAlpha = intro; X.fillRect(x - 3, ya, 6, yb - ya); X.globalAlpha = 1; if (k > 0) { X.fillStyle = P.acc; X.fillRect(x - 3, ya, 6, (yb - ya) * k); } }
    N.forEach((it, i) => {
      const yy = y0 + i * gap, k = at(t, T(i), T(i) + 0.3, 'backOut'), ck = at(t, T(i) + 0.15, T(i) + 0.45, 'cubicOut'), tx = at(t, T(i) + 0.05, T(i) + 0.5, 'expoOut');
      X.save(); X.globalAlpha = intro; X.strokeStyle = P.mut; X.lineWidth = 6; X.beginPath(); X.arc(x, yy, R, 0, 6.283); X.stroke(); X.restore();
      if (k > ON) { X.save(); X.translate(x, yy); X.scale(k, k); X.fillStyle = P.acc; X.beginPath(); X.arc(0, 0, R + 3, 0, 6.283); X.fill(); X.restore();
        if (ck > 0) ctx.drawPath(X, [[x - 18, yy + 2], [x - 5, yy + 15], [x + 19, yy - 13]], ck, { width: 9, color: P.onAcc || '#fff', cap: 'round', smooth: false }); }
      ctx.text(X, it, x - 75 + 40 * (1 - tx), yy + size * 0.35, { family: 'body', weight: 700, size, align: 'right', color: tx > 0.05 ? P.ink : P.mut, alpha: intro * lerp(0.35, 1, tx), maxWidth: 720 });
    });
  };

  /* 46 بطاقة سعر — بطاقة تتأرجح، السعر القديم ينشطب، والجديد يعد لتحت لين يوقف. o: {old, now, s, unit='د.ك', y=960, label} */
  FX.priceTag = (ctx, t, o) => {
    const { X, P, at, E } = ctx, y = pick(o, 'y', 960), sp = E.spring({ stiffness: 120, damping: 9 }), dt = Math.max(0, t - o.s);
    if (t < o.s) return;
    const ang = -0.5 * (1 - Math.min(1.2, sp(dt))), drop = at(t, o.s, o.s + 0.35, 'backOut');
    const strike = at(t, o.s + 0.7, o.s + 1.0, 'cubicInOut'), tick = at(t, o.s + 1.0, o.s + 2.1, 'expoOut'), oldV = +o.old, nowV = +o.now;
    const v = Math.round(lerp(oldV, nowV, tick)), unit = o.unit === undefined ? 'د.ك' : o.unit;
    X.save(); X.translate(540, y - 330); X.rotate(ang); X.translate(0, -300 * (1 - drop));
    X.strokeStyle = P.mut; X.lineWidth = 6; X.beginPath(); X.moveTo(0, -200); X.lineTo(0, 0); X.stroke();
    X.shadowColor = 'rgba(0,0,0,.18)'; X.shadowBlur = 40; X.shadowOffsetY = 16; X.fillStyle = P.ink; X.beginPath(); X.roundRect(-330, 0, 660, 600, 60); X.fill(); X.shadowColor = 'transparent';
    X.fillStyle = P.bg; X.beginPath(); X.arc(0, 60, 24, 0, 6.283); X.fill();
    X.font = ctx.font('num', 800, 96); const ow = X.measureText(String(o.old)).width;
    ctx.text(X, String(o.old), 0, 220, { family: 'num', weight: 800, size: 96, color: P.mut, dir: 'ltr' });
    if (strike > 0) { X.strokeStyle = P.acc; X.lineWidth = 12; X.lineCap = 'round'; X.beginPath(); X.moveTo(-ow / 2 - 20, 186); X.lineTo(-ow / 2 - 20 + (ow + 40) * strike, 186 - 30 * strike); X.stroke(); }
    const pop = 1 + 0.08 * Math.sin(Math.PI * at(t, o.s + 2.0, o.s + 2.3));
    X.save(); X.translate(0, 390); X.scale(pop, pop); ctx.text(X, ctx.num(v), unit ? 60 : 0, 0, { family: 'num', weight: 900, size: 190, color: P.acc, dir: 'ltr', maxWidth: 440 });
    if (unit) { X.font = ctx.font('num', 900, 190); const vw = Math.min(440, X.measureText(ctx.num(v)).width); ctx.text(X, unit, 60 - vw / 2 - 24, 0, { family: 'body', weight: 700, size: 64, align: 'right', color: P.bg }); }
    X.restore();
    if (o.label) ctx.text(X, o.label, 0, 530, { family: 'body', weight: 700, size: 48, color: P.bg, alpha: at(t, o.s + 2.0, o.s + 2.4), maxWidth: 580 });
    X.restore();
  };

  /* 47 زر ينبض — زر بلون الهوية بحلقات نبض، ونقرة إصبع تضغطه. o: {text, s, y=1300, period=1.4, tap (وقت النقرة), w} */
  FX.ctaPulse = (ctx, t, o) => {
    const { X, P, at } = ctx, y = pick(o, 'y', 1300), per = o.period || 1.4, k = at(t, o.s, o.s + 0.4, 'backOut'); if (k <= ON) return;
    X.font = ctx.font('body', 700, 66); const w = o.w || Math.min(800, X.measureText(o.text).width + 160), h = 150;
    const tap = o.tap != null ? o.tap : o.s + 2.2, press = 1 - 0.07 * Math.sin(Math.PI * pr(t, tap - 0.05, tap + 0.2));
    if (t > o.s + 0.4) for (let j = 0; j < 2; j++) { const ph = ((((t - o.s - 0.4) / per) - j * 0.5) % 1 + 1) % 1; if (t - o.s - 0.4 < j * per * 0.5) continue; const g = 1 + 0.35 * ph;
      X.save(); X.globalAlpha = 0.45 * (1 - ph); X.strokeStyle = P.acc; X.lineWidth = 8; X.beginPath(); X.roundRect(540 - w * g / 2, y - h * g / 2 - h * 0.1, w * g, h * g, h * g / 2); X.stroke(); X.restore(); }
    const rip = pr(t, tap, tap + 0.6);
    X.save(); X.translate(540, y); X.scale(k * press, k * press); X.fillStyle = P.acc; X.beginPath(); X.roundRect(-w / 2, -h / 2 - h * 0.1, w, h, h / 2); X.fill();
    if (rip > 0 && rip < 1) { X.save(); X.beginPath(); X.roundRect(-w / 2, -h / 2 - h * 0.1, w, h, h / 2); X.clip(); X.globalAlpha = 0.35 * (1 - rip); X.fillStyle = P.bg; X.beginPath(); X.arc(w * 0.18, 10, w * rip, 0, 6.283); X.fill(); X.restore(); }
    ctx.text(X, o.text, 0, 8, { family: 'body', weight: 700, size: 66, color: P.onAcc || '#fff', maxWidth: w - 80 }); X.restore();
    const fin = at(t, tap - 0.6, tap - 0.05, 'cubicOut'), fout = at(t, tap + 0.35, tap + 0.8, 'cubicIn');
    if (fin > 0 && fout < 1 && o.tap !== null) { const fx = 540 + w * 0.18 + 160 * (1 - fin) + 120 * fout, fy = y + 10 + 260 * (1 - fin) + 200 * fout;
      X.save(); X.globalAlpha = (1 - fout); X.fillStyle = P.ink; X.strokeStyle = P.bg; X.lineWidth = 8; X.beginPath(); X.arc(fx, fy, 38 * (t > tap && t < tap + 0.2 ? 0.85 : 1), 0, 6.283); X.fill(); X.stroke(); X.restore(); }
  };

  /* 48 قبل وبعد — خط فاصل يمشي من اليمين ويكشف B، ويتمرجح مثل سلايدر المقارنة. o: {s, A, B, labels=['قبل','بعد'], to=540, sweep=true} */
  FX.compare = (ctx, t, o) => {
    const { X, P, at, E } = ctx, k = at(t, o.s, o.s + 0.9, 'cubicInOut'), to = pick(o, 'to', 540);
    let d = lerp(1080, to, k); if (o.sweep !== false) d += -150 * Math.sin(Math.PI * 2 * at(t, o.s + 1.0, o.s + 2.6, 'sineInOut')) * (1 - at(t, o.s + 2.4, o.s + 2.8));
    o.A(X); if (k <= 0) return;
    X.save(); X.beginPath(); X.rect(d, 0, 1080 - d + 1, 1920); X.clip(); o.B(X); X.restore();
    X.fillStyle = P.bg; X.fillRect(d - 5, 0, 10, 1920);
    X.save(); X.translate(d, 960); X.fillStyle = P.bg; X.beginPath(); X.arc(0, 0, 54, 0, 6.283); X.fill(); X.strokeStyle = P.ink; X.lineWidth = 7; X.lineCap = 'round'; X.lineJoin = 'round';
    X.beginPath(); X.moveTo(-14, -16); X.lineTo(-28, 0); X.lineTo(-14, 16); X.moveTo(14, -16); X.lineTo(28, 0); X.lineTo(14, 16); X.stroke(); X.restore();
    const lb = o.labels || ['قبل', 'بعد'], la = at(t, o.s + 0.6, o.s + 1.0, 'expoOut');
    const chip = (s, x, bg, fg) => { X.font = ctx.font('body', 700, 46); const w = X.measureText(s).width + 60; X.save(); X.globalAlpha = la; X.fillStyle = bg; X.beginPath(); X.roundRect(x - w / 2, 230, w, 86, 43); X.fill(); X.restore(); ctx.text(X, s, x, 289, { family: 'body', weight: 700, size: 46, color: fg, alpha: la }); };
    if (d > 200) chip(lb[0], Math.min(d / 2, 300), P.ink, P.bg); if (d < 880) chip(lb[1], Math.max((1080 + d) / 2, 780), P.acc, P.onAcc || '#fff');
  };

  /* 49 حلقة نسبة — حلقة تتعبّى للنسبة والرقم يعد بنصها، وتحتها التعريف. o: {value=73, s, dur=1.6, y=900, r=230, label, suffix='%'} */
  FX.ringStat = (ctx, t, o) => {
    const { X, P, at } = ctx, y = pick(o, 'y', 900), r = o.r || 230, v = o.value == null ? 73 : +o.value, k = at(t, o.s, o.s + (o.dur || 1.6), 'cubicOut'), intro = at(t, o.s - 0.3, o.s + 0.2, 'backOut');
    if (intro <= ON) return;
    const a0 = -Math.PI / 2, gap = 0.12, pct = (v / 100) * k, ae = a0 + 6.2832 * pct;
    X.save(); X.translate(540, y); X.scale(intro, intro); X.lineCap = 'round'; X.lineWidth = 46;
    if (pct < 0.97) { X.strokeStyle = 'rgba(128,128,128,.22)'; X.beginPath(); X.arc(0, 0, r, ae + (pct > 0.005 ? gap : 0), a0 + 6.2832 - (pct > 0.005 ? gap : 0)); X.stroke(); }
    if (pct > 0.005) { X.strokeStyle = o.color || P.acc; X.beginPath(); X.arc(0, 0, r, a0, ae); X.stroke(); }
    const suf = o.suffix === undefined ? '%' : o.suffix;
    ctx.text(X, ctx.num(Math.round(v * k)) + suf, 0, 52, { family: 'num', weight: 900, size: 150, color: P.ink, dir: 'ltr' }); X.restore();
    if (o.label) { const a = at(t, o.s + 0.8, o.s + 1.3, 'expoOut'); ctx.text(X, o.label, 540, y + r + 150 + 30 * (1 - a), { family: 'body', weight: 700, size: 62, color: P.ink, alpha: a, maxWidth: 900 }); }
  };

  /* 50 أعمدة تكبر — أعمدة تطلع من خط الأساس بالتتابع (أول عنصر يمين) وأرقامها تعد، وعمود مميز بلون الهوية. o: {data:[[اسم, رقم]], s, hi (رقم العمود), y0=1320, h=640, suffix=''} */
  FX.barChart = (ctx, t, o) => {
    const { X, P, at } = ctx, D = o.data, n = D.length, y0 = pick(o, 'y0', 1320), H = o.h || 640, x0 = 140, x1 = 940, slot = (x1 - x0) / n, bw = slot * 0.62;
    const mx = Math.max(...D.map(d => +d[1])), base = at(t, o.s - 0.4, o.s, 'cubicOut');
    X.save(); X.globalAlpha = base; X.fillStyle = P.ink; X.fillRect(x0 - 20, y0, (x1 - x0 + 40) * base, 6); X.restore();
    D.forEach(([lab, val], i) => {
      const k = at(t, o.s + i * 0.15, o.s + i * 0.15 + 1.0, 'quartOut'), cx = x1 - slot * (i + 0.5), bh = H * (+val / mx) * k, hi = i === o.hi;
      if (k > 0) { X.fillStyle = hi ? P.acc : (o.color || P.ink); X.globalAlpha = hi || o.hi == null ? 1 : 0.35 + 0.65 * (1 - at(t, o.s + n * 0.15 + 0.9, o.s + n * 0.15 + 1.3)) ; X.beginPath(); X.roundRect(cx - bw / 2, y0 - bh, bw, bh, [18, 18, 0, 0]); X.fill(); X.globalAlpha = 1;
        ctx.text(X, ctx.num(Math.round(+val * k)) + (o.suffix || ''), cx, y0 - bh - 26, { family: 'num', weight: 800, size: hi ? 64 : 52, color: hi ? P.acc : P.ink, dir: 'ltr' }); }
      ctx.text(X, lab, cx, y0 + 76, { family: 'body', weight: 700, size: 44, color: hi ? P.acc : P.mut, alpha: base, maxWidth: slot - 10 });
    });
  };


  /* ═══ 51–61: توسعة المتحدث المقصوص (16 أكتوبر) — نفس العقد ═══
     o.person(Y) يرسم المتحدث مقصوص بخلفية شفافة (الإطار كامل 1080×1920، بنفس مكانه بالفيديو).
       بريل الكلام: person: MV.person (ماك بس — القصّ من 11_behind_text.js <work> person <من-إلى>). مرّره كما هو (لا تلفّه بدالة): FX يسأل MV.person.ok().
     o.video(Y) يرسم الفيديو كامل (MV.video). بلا قصّ كل حركة ترجع لبديل: الفيديو داخل كرت/صورة، والحركة تمشي. */
  const hasP = o => typeof o.person === 'function' && (typeof o.person.ok === 'function' ? !!o.person.ok() : true);
  const offC = (X, slot) => {
    const me = FX['_' + slot] || (FX['_' + slot] = { c: document.createElement('canvas') }), c = me.c;
    if (c.width !== X.canvas.width || c.height !== X.canvas.height) { c.width = X.canvas.width; c.height = X.canvas.height; }
    const Y = c.getContext('2d'); Y.setTransform(1, 0, 0, 1, 0, 0); Y.globalAlpha = 1; Y.globalCompositeOperation = 'source-over'; Y.filter = 'none';
    Y.clearRect(0, 0, c.width, c.height); Y.setTransform(X.getTransform()); return { c, Y };
  };
  const putC = (X, c, a) => { X.save(); X.setTransform(1, 0, 0, 1, 0, 0); if (a != null) X.globalAlpha *= a; X.drawImage(c, 0, 0); X.restore(); };
  // حدود جسم المتحدث (بإحداثيات التصميم) من نسخة مصغّرة 108×192
  const pbox = (o, pl) => {
    const me = FX._pb || (FX._pb = { c: document.createElement('canvas') }), c = me.c; c.width = 108; c.height = 192;
    const Y = me.Y || (me.Y = c.getContext('2d', { willReadFrequently: true })); Y.setTransform(0.1, 0, 0, 0.1, 0, 0);
    if (pl) placeP(Y, pl); o.person(Y); const d = Y.getImageData(0, 0, 108, 192).data; let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < 192; y++) for (let x = 0; x < 108; x++) if (d[(y * 108 + x) * 4 + 3] > 110) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return x1 < 0 ? null : { x0: x0 * 10, y0: y0 * 10, x1: x1 * 10 + 10, y1: y1 * 10 + 10, cx: (x0 + x1 + 1) * 5 };
  };
  // مكان المتحدث الجديد: يكبر/يصغر حول أسفل الشاشة (540,1920) ثم يتزحزح. pl: {x, y, s, r}
  const placeP = (Y, pl) => { Y.translate(540 + (pl.x || 0), 1920 + (pl.y || 0)); if (pl.r) Y.rotate(pl.r); const s = pl.s == null ? 1 : pl.s; Y.scale(s, s); Y.translate(-540, -1920); };
  const lerpPl = (b, k) => ({ x: (b.x || 0) * k, y: (b.y || 0) * k, s: lerp(1, b.s == null ? 1 : b.s, k), r: (b.r || 0) * k });
  // الفيديو داخل مستطيل R (قصّ cover، الوجه على ثلث الطول فوق)
  const vidIn = (X, o, R, rad) => {
    X.save(); X.beginPath(); X.roundRect(R.x, R.y, R.w, R.h, rad || 0); X.clip();
    const sc = Math.max(R.w / 1080, R.h / 1920); X.translate(R.x + R.w / 2, R.y + R.h * 0.34); X.scale(sc, sc); X.translate(-540, -1920 * 0.34);
    if (o.video) o.video(X); X.restore();
  };
  const lerpR = (a, b, k) => ({ x: lerp(a.x, b.x, k), y: lerp(a.y, b.y, k), w: lerp(a.w, b.w, k), h: lerp(a.h, b.h, k) });
  const FULL = { x: 0, y: 0, w: 1080, h: 1920 };
  // حبيبات ورق (ثابتة، تنبني مرة)
  const h2 = (a, b) => { let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263); h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
  const grain = () => FX._grain || (FX._grain = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const Y = c.getContext('2d'), im = Y.createImageData(256, 256);
    for (let i = 0; i < 65536; i++) { const v = 150 + 105 * (0.6 * h2(i, 7) + 0.4 * h2(i >> 2, 9)); im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v; im.data[i * 4 + 3] = 255; }
    Y.putImageData(im, 0, 0); return c; })());
  const paperFill = (X, x, y, w, h, a) => { X.save(); X.globalAlpha *= a == null ? 0.14 : a; X.globalCompositeOperation = 'multiply'; const g = grain();
    for (let yy = y; yy < y + h; yy += 256) for (let xx = x; xx < x + w; xx += 256) X.drawImage(g, xx, yy); X.restore(); };
  const tornRect = (X, x, y, w, h, seed, amp) => { const a = amp || 12, st = 20; X.beginPath(); X.moveTo(x, y);
    for (let i = 0; i <= w; i += st) X.lineTo(x + i, y + (h2(seed, i) - 0.5) * a);
    for (let j = 0; j <= h; j += st) X.lineTo(x + w + (h2(seed + 1, j) - 0.5) * a, y + j);
    for (let i = w; i >= 0; i -= st) X.lineTo(x + i, y + h + (h2(seed + 2, i) - 0.5) * a);
    for (let j = h; j >= 0; j -= st) X.lineTo(x + (h2(seed + 3, j) - 0.5) * a, y + j); X.closePath(); };
  const shd = (X, b, y, a) => { X.shadowColor = 'rgba(0,0,0,' + (a == null ? 0.25 : a) + ')'; X.shadowBlur = b; X.shadowOffsetY = y; };
  const noShd = X => { X.shadowColor = 'transparent'; X.shadowBlur = 0; X.shadowOffsetY = 0; X.shadowOffsetX = 0; };
  /* المسرح المشترك: k 0←1. بالقصّ: الخلفية الجديدة تنفتح دايرة من ورا المتحدث، وهو نفسه يمشي لمكانه (pl). بلا قصّ: الفيديو يصغر لكرت R.
     bg(Y) الخلفية الجديدة · mid(Y) طبقة بين الخلفية والمتحدث (اختياري) · يرجّع true لو بالقصّ */
  const stage = (ctx, t, o, k, bg, pl, R, mid, rad) => {
    const { X } = ctx, P = hasP(o);
    if (P) {
      if (k < 0.999 && o.video) o.video(X);
      if (k > 0.001) { X.save(); if (k < 0.999) { X.beginPath(); X.arc(540, 820, 2300 * ctx.E.cubicIn(k) + 40 * k, 0, 6.2832); X.clip(); } bg(X); if (mid) mid(X); X.restore(); }
      X.save(); placeP(X, lerpPl(pl || {}, k)); if (k > 0.05 && o.shadow !== false) shd(X, 50 * k, 16 * k, 0.28 * k); o.person(X); X.restore(); noShd(X);
      return true;
    }
    bg(X); if (mid) mid(X);
    const r = lerpR(FULL, R, k);
    X.save(); if (k > 0.02) { shd(X, 60 * k, 24 * k, 0.3 * k); X.fillStyle = ctx.P.ink; X.beginPath(); X.roundRect(r.x, r.y, r.w, r.h, (rad || 48) * k); X.fill(); noShd(X); }
    vidIn(X, o, r, (rad || 48) * k); X.restore();
    return false;
  };
  const kIO = (ctx, t, o, d) => ctx.at(t, o.s, o.s + (d || 0.8), 'expoInOut') * (o.out != null ? 1 - ctx.at(t, o.out, o.out + 0.6, 'expoInOut') : 1);

  /* 51 مدار — الكاميرا تلف حول المتحدث: حلقة كلمات وأرضية تدور بعمق؛ اللي ورا يمر خلفه واللي قدام يمر قدامه. يحتاج قصّ (ماك) — بلاه: الحلقة تلف حول كرت الفيديو.
     o: {s, out, person, video, words:[...] (كلمات كاملة), turn=1.6 (راديان), ringY=1240, R=520, hi (رقم الكلمة المميزة)} */
  FX.orbit = (ctx, t, o) => {
    const { X, P, at } = ctx, k = kIO(ctx, t, o, 0.9), W = o.words || ['فكرة', 'صوت', 'تصوير', 'مونتاج', 'نشر', 'جمهور'], n = W.length;
    const az = (o.turn == null ? 1.6 : o.turn) * ctx.E.sineInOut(ctx.prog(t, o.s, o.s + (o.dur || 3.6))) - 0.5, ry = pick(o, 'ringY', 1160), Rr = o.R || 560, D = 1500;
    const items = W.map((w, i) => { const th = i * 6.2832 / n + az, x3 = Rr * Math.sin(th), z3 = Rr * Math.cos(th), f = D / (D - z3 * 0.9);
      return { w, i, th, z3, f, x: 540 + x3 * f, y: ry - 260 + z3 * 0.28 * f }; });
    const dk = darker(P.ink, P.bg);
    const bg = Y => { const g = Y.createRadialGradient(540, 900, 80, 540, 900, 1250); g.addColorStop(0, P.bg); g.addColorStop(1, dk === P.ink ? '#00000022' : P.bg); Y.fillStyle = P.bg; Y.fillRect(0, 0, 1080, 1920); Y.fillStyle = g; Y.fillRect(0, 0, 1080, 1920);
      // ستارة اسطوانية ورا: أعمدة تلف مع الكاميرا (النص البعيد بس)
      for (let j = 0; j < 28; j++) { const th = j * 6.2832 / 28 - az * 0.8, zc = Math.cos(th); if (zc > -0.05) continue; const xa = 540 + 1500 * Math.sin(th) * 0.62, xb = 540 + 1500 * Math.sin(th + 0.112) * 0.62;
        Y.globalAlpha = 0.05 + 0.07 * (-zc); Y.fillStyle = j % 2 ? P.ink : P.acc; Y.fillRect(Math.min(xa, xb), 0, Math.abs(xb - xa), 1920); }
      Y.globalAlpha = 1;
      // أرضية: دواير وخطوط شعاعية تلف مع الكاميرا
      Y.save(); Y.translate(540, ry + 330); Y.scale(1, 0.24); Y.strokeStyle = P.ink; Y.lineWidth = 3;
      for (let j = 1; j <= 6; j++) { Y.globalAlpha = 0.16 - j * 0.018; Y.beginPath(); Y.arc(0, 0, 180 * j, 0, 6.2832); Y.stroke(); }
      for (let j = 0; j < 24; j++) { const a = j * 0.2618 + az; Y.globalAlpha = 0.07; Y.beginPath(); Y.moveTo(Math.cos(a) * 160, Math.sin(a) * 160); Y.lineTo(Math.cos(a) * 1150, Math.sin(a) * 1150); Y.stroke(); }
      Y.restore();
      // نجوم بعيدة: بارالاكس أبطأ من الحلقة
      for (let j = 0; j < 40; j++) { const xx = ((h2(j, 3) * 1600 - az * 260 * (0.4 + h2(j, 4))) % 1600 + 1600) % 1600 - 260, yy = 160 + h2(j, 5) * 980;
        Y.globalAlpha = 0.18 + 0.3 * h2(j, 6); Y.fillStyle = j % 5 ? P.mut : P.acc; Y.beginPath(); Y.arc(xx, yy, 2 + 5 * h2(j, 8), 0, 6.2832); Y.fill(); }
      Y.globalAlpha = 1;
      // المدار نفسه (بيضاوي)
      Y.save(); Y.translate(540, ry - 260); Y.scale(1, 0.3); Y.strokeStyle = P.acc; Y.lineWidth = 5; Y.globalAlpha = 0.45; Y.setLineDash([2, 22]); Y.lineCap = 'round'; Y.beginPath(); Y.arc(0, 0, Rr * 1.02, 0, 6.2832); Y.stroke(); Y.restore();
    };
    const card = (Y, it, ka) => { const face = Math.cos(it.th), sx = Math.max(0.18, Math.abs(face)), sz = 92 * it.f, a = ka * cl(0.6 + 0.4 * (it.z3 / Rr + 1) / 2);
      Y.save(); Y.translate(it.x, it.y); Y.globalAlpha = a; Y.scale(sx, 1); Y.font = ctx.font('display', 400, sz); const w = Y.measureText(it.w).width + sz * 1.0, h = sz * 1.55;
      shd(Y, 30 * it.f, 12 * it.f, 0.22); Y.fillStyle = face < 0 ? P.mut : (it.i === (o.hi == null ? 0 : o.hi) ? P.acc : P.ink); Y.beginPath(); Y.roundRect(-w / 2, -h / 2, w, h, h / 2); Y.fill(); noShd(Y);
      if (face > 0.7) ctx.text(Y, it.w, 0, sz * 0.36, { alpha: cl((face - 0.7) / 0.2), family: 'display', size: sz, color: it.i === (o.hi == null ? 0 : o.hi) ? (P.onAcc || '#fff') : P.bg });
      Y.restore(); };
    const ka = at(t, o.s + 0.35, o.s + 1.0, 'expoOut') * (o.out != null ? 1 - at(t, o.out - 0.2, o.out + 0.3) : 1);
    const back = items.filter(i => i.z3 < 0).sort((a, b) => a.z3 - b.z3), front = items.filter(i => i.z3 >= 0).sort((a, b) => a.z3 - b.z3);
    const sway = Math.sin(az) * 70;
    stage(ctx, t, o, k, bg, { s: 0.92 + 0.04 * Math.cos(az), x: -sway, y: 10, r: -0.03 * Math.sin(az) }, { x: 290, y: 560, w: 500, h: 760 }, Y => { if (ka > 0.001) back.forEach(it => card(Y, it, ka));
      // ظل على الأرضية
      Y.save(); Y.globalAlpha = 0.25 * k; Y.fillStyle = P.ink; Y.translate(540, ry + 330); Y.scale(1, 0.2); Y.beginPath(); Y.arc(0, 0, 360, 0, 6.2832); Y.filter = 'blur(20px)'; Y.fill(); Y.restore(); }, 60);
    if (ka > 0.001) front.forEach(it => card(X, it, ka));
  };

  /* 52 جدار الكنبة — المتحدث ينقل لمشهد جديد: قاعد على كنبة وراه جدار بوستاته. يحتاج قصّ (ماك) — بلاه: الفيديو كرت على الكنبة.
     o: {s, out, person, video, posts:[[عنوان, رقم]], handle} */
  FX.couchWall = (ctx, t, o) => {
    const { X, P, at, E } = ctx, k = kIO(ctx, t, o, 0.9), posts = o.posts || [['أول ريل', '12K'], ['السر', '48K'], ['قبل وبعد', '9K'], ['شلون بديت', '31K'], ['الأداة', '22K'], ['غلطتي', '64K'], ['السؤال', '7K'], ['الخطة', '18K'], ['النتيجة', '120K']];
    const drift = at(t, o.s, o.s + 4.5, 'sineInOut'), cols = [P.ink, P.acc, P.clay || P.acc, P.mut];
    const bg = Y => { Y.fillStyle = P.bg; Y.fillRect(0, 0, 1080, 1920);
      Y.save(); Y.globalAlpha = 0.06; Y.fillStyle = P.ink; for (let x = 0; x < 1080; x += 120) Y.fillRect(x, 0, 3, 1920); Y.restore();
      Y.save(); Y.translate(0, -70 * drift); const tw = 292, gap = 22, x0 = 540 - (tw * 3 + gap * 2) / 2;
      posts.forEach((p, i) => { const c = i % 3, r = Math.floor(i / 3), x = x0 + (2 - c) * (tw + gap), y = 250 + r * (tw + gap), ki = at(t, o.s + 0.45 + i * 0.07, o.s + 0.95 + i * 0.07, 'backOut');
        if (ki <= ON) return; Y.save(); Y.translate(x + tw / 2, y + tw / 2); Y.scale(ki, ki); Y.rotate((h2(i, 2) - 0.5) * 0.05);
        shd(Y, 26, 10, 0.18); const col = cols[(i * 7) % 4]; Y.fillStyle = col; Y.beginPath(); Y.roundRect(-tw / 2, -tw / 2, tw, tw, 22); Y.fill(); noShd(Y);
        Y.globalAlpha = 0.16; Y.fillStyle = P.bg; Y.beginPath(); Y.arc(tw * 0.22, -tw * 0.2, tw * 0.22, 0, 6.2832); Y.fill(); Y.globalAlpha = 1;
        const fg = col === P.mut ? P.ink : (lum(col) > 150 ? P.ink : '#FFFFFF');
        ctx.text(Y, p[0], 0, 18, { family: 'display', size: 54, color: fg, maxWidth: tw - 40 });
        ctx.text(Y, '♥ ' + p[1], 0, tw / 2 - 30, { family: 'num', weight: 800, size: 30, color: fg, dir: 'ltr', alpha: 0.85 });
        Y.restore(); }); Y.restore(); };
    const couch = Y => { const kc = at(t, o.s + 0.3, o.s + 0.9, 'expoOut'), yy = 1430 + 400 * (1 - kc);
      Y.save(); Y.translate(0, yy); shd(Y, 50, -6, 0.25); Y.fillStyle = P.clay || P.acc; Y.beginPath(); Y.roundRect(40, 0, 1000, 330, 70); Y.fill(); noShd(Y);
      Y.fillStyle = 'rgba(0,0,0,.12)'; Y.beginPath(); Y.roundRect(40, 210, 1000, 300, 50); Y.fill();
      Y.fillStyle = P.clay || P.acc; [[0, 140], [930, 140]].forEach(([x, y]) => { Y.beginPath(); Y.roundRect(x, y, 150, 300, 60); Y.fill(); });
      Y.strokeStyle = 'rgba(0,0,0,.14)'; Y.lineWidth = 6; Y.beginPath(); Y.moveTo(540, 30); Y.lineTo(540, 200); Y.stroke(); Y.restore(); };
    const R = { x: 250, y: 900, w: 580, h: 700 };
    stage(ctx, t, o, k, bg, { s: 0.78, y: -60 }, R, couch, 44);
    if (o.handle) { const a = at(t, o.s + 1.1, o.s + 1.5, 'expoOut'); ctx.text(X, o.handle, 540, 205, { family: 'num', weight: 800, size: 40, color: P.mut, dir: 'ltr', alpha: a * k }); }
  };

  /* 53 عالم الواجهات — شاشات وكروت واجهة تطفو حول المتحدث بأعماق مختلفة (اللي ورا مغبشة خلفه، واللي قدام أكبر). بلاه قصّ: الكروت قدام الفيديو بس.
     o: {s, out, person, video, panels:[{type:'chat'|'stat'|'toggle'|'search'|'notif'|'spark', text, x, y, z}], dim=.55} */
  FX.uiWorld = (ctx, t, o) => {
    const { X, P, at, E } = ctx, k = kIO(ctx, t, o, 0.7), PM = hasP(o);
    const PN = o.panels || [{ type: 'search', text: 'شلون أبدأ؟', x: 540, y: 330, z: 0.55 }, { type: 'stat', text: '+38%', x: 230, y: 640, z: 0.7 }, { type: 'toggle', text: 'النشر التلقائي', x: 820, y: 760, z: 0.8 },
      { type: 'chat', text: 'جاهز الريل؟', x: 820, y: 1180, z: 1.35 }, { type: 'spark', text: 'المشاهدات', x: 250, y: 1320, z: 1.5 }, { type: 'notif', text: 'متابع جديد', x: 300, y: 470, z: 1.25 }];
    const push = at(t, o.s, o.s + 4.5, 'sineInOut');
    const panel = (Y, p, i) => { const ki = at(t, o.s + 0.3 + i * 0.11, o.s + 0.95 + i * 0.11, 'backOut') * (o.out != null ? 1 - at(t, o.out - 0.1, o.out + 0.4) : 1); if (ki <= ON) return;
      const z = p.z, par = (z - 1), zz = 1 + (z - 1) * 0.6 + 0.08 * push * z, bob = 14 * ctx.noise1(t * 0.6 + i * 3, i + 40);
      const px = 540 + (p.x - 540) * zz - par * 90 * Math.sin(t * 0.45), py = 960 + (p.y - 960) * zz + bob;
      const bl = Math.abs(z - 1) > 0.2 ? Math.abs(z - 1) * 7 : 0;
      Y.save(); Y.translate(px, py); Y.scale(zz * ki, zz * ki); Y.rotate((h2(i, 9) - 0.5) * 0.06); if (bl > 0.4) Y.filter = `blur(${bl.toFixed(1)}px)`; Y.globalAlpha = cl(0.55 + 0.45 * z);
      const card = (w, h, r) => { shd(Y, 40, 18, 0.22); Y.fillStyle = '#FFFFFF'; Y.beginPath(); Y.roundRect(-w / 2, -h / 2, w, h, r); Y.fill(); noShd(Y); };
      if (p.type === 'search') { card(560, 110, 55); Y.strokeStyle = P.mut; Y.lineWidth = 6; Y.beginPath(); Y.arc(220, -6, 20, 0, 6.2832); Y.moveTo(234, 8); Y.lineTo(250, 24); Y.stroke(); ctx.text(Y, p.text, 160, 14, { family: 'body', weight: 700, size: 40, align: 'right', color: P.ink, maxWidth: 400 }); }
      else if (p.type === 'stat') { card(300, 200, 36); ctx.text(Y, p.text, 0, 20, { family: 'num', weight: 900, size: 92, color: P.acc, dir: 'ltr' }); ctx.text(Y, 'هالأسبوع', 0, 74, { family: 'body', weight: 700, size: 28, color: P.mut }); }
      else if (p.type === 'toggle') { card(420, 120, 36); const on = at(t, o.s + 1.4, o.s + 1.7, 'cubicInOut'); Y.fillStyle = on > 0.5 ? P.acc : P.mut; Y.beginPath(); Y.roundRect(-180, -30, 110, 60, 30); Y.fill(); Y.fillStyle = '#fff'; Y.beginPath(); Y.arc(-150 + 50 * on, 0, 24, 0, 6.2832); Y.fill(); ctx.text(Y, p.text, 170, 12, { family: 'body', weight: 700, size: 36, align: 'right', color: P.ink, maxWidth: 300 }); }
      else if (p.type === 'chat') { shd(Y, 40, 18, 0.22); Y.fillStyle = P.acc; Y.beginPath(); Y.roundRect(-210, -60, 420, 120, [60, 60, 60, 12]); Y.fill(); noShd(Y); ctx.text(Y, p.text, 0, 14, { family: 'body', weight: 700, size: 42, color: P.onAcc || '#fff', maxWidth: 360 }); }
      else if (p.type === 'spark') { card(380, 210, 36); ctx.text(Y, p.text, 150, -50, { family: 'body', weight: 700, size: 30, align: 'right', color: P.mut }); const pts = [0, .2, .15, .45, .38, .7, 1].map((v, j) => [-150 + j * 50, 70 - v * 100]); ctx.drawPath(Y, pts, at(t, o.s + 0.9 + i * 0.1, o.s + 1.8 + i * 0.1, 'cubicInOut'), { width: 9, color: P.acc, cap: 'round' }); }
      else { card(470, 130, 36); Y.fillStyle = P.acc; Y.beginPath(); Y.arc(170, 0, 36, 0, 6.2832); Y.fill(); ctx.text(Y, p.text, 110, 0, { family: 'body', weight: 700, size: 38, align: 'right', color: P.ink, maxWidth: 300 }); ctx.text(Y, 'الحين', 110, 42, { family: 'body', weight: 400, size: 26, align: 'right', color: P.mut }); }
      Y.restore(); };
    const ord = PN.map((p, i) => [p, i]).sort((a, b) => a[0].z - b[0].z), backs = ord.filter(([p]) => p.z < 1), fronts = ord.filter(([p]) => p.z >= 1);
    if (PM) {
      X.save(); zoomAt(X, [540, 900], 1 + 0.05 * push * k); if (k > 0.01) X.filter = `blur(${(14 * k).toFixed(1)}px)`; if (o.video) o.video(X); X.restore();
      X.fillStyle = darker(P.ink, P.bg); X.globalAlpha = pick(o, 'dim', 0.55) * k; X.fillRect(0, 0, 1080, 1920); X.globalAlpha = 1;
      backs.forEach(([p, i]) => panel(X, p, i));
      X.save(); zoomAt(X, [540, 1200], 1 + 0.03 * push * k); shd(X, 60 * k, 0, 0.35 * k); o.person(X); X.restore(); noShd(X);
    } else { if (o.video) o.video(X); backs.forEach(([p, i]) => panel(X, Object.assign({}, p, { z: 1 + (1 - p.z) * 0.3 }), i)); }
    fronts.forEach(([p, i]) => panel(X, p, i));
  };

  /* 54 كسر الإطار — المتحدث داخل كرت، وراسه يطلع برّا حافته (والكلمة ورا راسه). يحتاج قصّ (ماك) — بلاه: كرت عادي بلا طلعة.
     o: {s, out, person, video, text (كلمة كبيرة ورا الراس، اختياري), R={x,y,w,h}} */
  FX.frameBreak = (ctx, t, o) => {
    const { X, P, at } = ctx, k = kIO(ctx, t, o, 0.8), PM = hasP(o), R0 = o.R || { x: 140, y: 420, w: 800, h: 1240 };
    const pop = PM ? at(t, o.s + 0.75, o.s + 1.55, 'expoOut') * (o.out != null ? 1 - at(t, o.out - 0.45, o.out) : 1) : 0;
    const sc0 = Math.max(R0.w / 1080, R0.h / 1920), my = y => R0.y + R0.h * 0.34 + (y - 1920 * 0.34) * sc0;   // من إحداثيات الفيديو لداخل الكرت
    const bb = PM ? pbox(o) : null, top = bb ? cl(my(bb.y0 + 0.37 * (bb.y1 - bb.y0)), R0.y, R0.y + R0.h - 380) : R0.y;
    const ct = lerp(R0.y, top, pop), M = lerpR(FULL, R0, k), C = lerpR(FULL, { x: R0.x, y: ct, w: R0.w, h: R0.y + R0.h - ct }, k), rad = 44 * k, bw = 16 * k;
    X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920); paperFill(X, 0, 0, 1080, 1920, 0.1 * k);
    if (o.text !== null) { const a = at(t, o.s + 0.9, o.s + 1.4, 'expoOut'); ctx.text(X, o.text || 'برّا الصندوق', 540, (bb ? my(bb.y0) - 10 : 330) + 60 * (1 - a), { family: 'display', size: 210, color: P.acc, alpha: a * k, maxWidth: 1000 }); }
    X.save(); shd(X, 70 * k, 30 * k, 0.32 * k); X.fillStyle = '#FFFFFF'; X.beginPath(); X.roundRect(C.x - bw, C.y - bw, C.w + 2 * bw, C.h + 2 * bw, rad + bw); X.fill(); X.restore(); noShd(X);
    const map = Y => { const sc = Math.max(M.w / 1080, M.h / 1920); Y.translate(M.x + M.w / 2, M.y + M.h * 0.34); Y.scale(sc, sc); Y.translate(-540, -1920 * 0.34); };
    X.save(); X.beginPath(); X.roundRect(C.x, C.y, C.w, C.h, rad); X.clip(); map(X); if (o.video) o.video(X); X.restore();
    if (PM && pop > ON && k > 0.98) {   // الراس برّا: نفس تأطير الكرت بالضبط (المتحدث وحده)، يكبر 5% لقدّام — الحافة البيضا تغطي اللحمة
      X.save(); X.beginPath(); X.rect(C.x - 160, 0, C.w + 320, C.y + 2); X.clip(); shd(X, 40, 16, 0.3 * pop);
      const cx = 540, cy = C.y + 10, z = 1 + 0.05 * pop; X.translate(cx, cy); X.scale(z, z); X.translate(-cx, -cy); map(X); X.globalAlpha = cl(pop * 1.6); o.person(X); X.restore(); noShd(X);
    }
  };

  /* 55 جدار العناوين — ورا المتحدث لوحة، والعناوين ورق ينلزق وحدة وحدة (دبوس وخيط بينهم). يحتاج قصّ (ماك) — بلاه: الفيديو صورة ملزوقة تحت.
     o: {s, out, person, video, items:[...عناوين], every=.42} */
  FX.headlineWall = (ctx, t, o) => {
    const { X, P, at, E } = ctx, k = kIO(ctx, t, o, 0.7), N = o.items || ['الذكاء الاصطناعي يغيّر كل شي', 'وظايف بتختفي', 'أداة جديدة كل يوم', 'المحتوى صار أسهل', 'بس الفكرة؟', 'لسا عندك'], ev = o.every || 0.42;
    const POS = [[380, 300, -4], [740, 440, 3], [330, 620, 2.5], [770, 780, -3], [560, 200, 1.5], [300, 940, -2], [800, 1080, 4], [520, 1200, -3]];
    const land = i => o.s + 0.55 + i * ev;
    let shake = 0; N.forEach((_, i) => { const d = t - land(i) - 0.22; if (d > 0 && d < 0.3) shake += (1 - d / 0.3) * 6; });
    const bg = Y => { Y.fillStyle = P.bg; Y.fillRect(0, 0, 1080, 1920); Y.fillStyle = darker(P.ink, P.bg); Y.globalAlpha = 0.06; Y.fillRect(0, 0, 1080, 1920); Y.globalAlpha = 1; paperFill(Y, 0, 0, 1080, 1920, 0.22); };
    const notes = Y => {
      const pins = [];
      N.forEach((s, i) => { const p = POS[i % POS.length], d = t - land(i); if (d < -0.25) return; const kk = E.cubicIn(cl((d + 0.25) / 0.25)), settle = d > 0 ? 1 + 0.04 * Math.sin(d * 30) * Math.exp(-d * 9) : 1;
        const sc = lerp(1.6, 1, kk) * settle, al = cl(kk * 1.5);
        Y.save(); Y.translate(p[0], p[1]); Y.rotate((p[2] + (1 - kk) * 8) * Math.PI / 180); Y.scale(sc, sc); Y.globalAlpha = al;
        Y.font = ctx.font('display', 400, 58); const w = Math.min(500, Y.measureText(s).width) + 70, h = 120;
        shd(Y, lerp(60, 14, kk), lerp(40, 8, kk), 0.3); Y.fillStyle = i % 4 === 3 ? P.acc : '#FBF7EE'; tornRect(Y, -w / 2, -h / 2, w, h, i * 13 + 5, 9); Y.fill(); noShd(Y);
        Y.save(); Y.clip(); paperFill(Y, -w / 2, -h / 2, w, h, 0.25); Y.restore();
        ctx.text(Y, s, 0, 20, { family: 'display', size: 58, color: i % 4 === 3 ? (P.onAcc || '#fff') : '#1B1A17', maxWidth: 500 });
        Y.restore(); if (d > 0) pins.push([p[0], p[1] - 52 * sc, i]); });
      if (pins.length > 1) { Y.save(); Y.strokeStyle = P.acc; Y.lineWidth = 4; Y.globalAlpha = 0.8; for (let j = 1; j < pins.length; j++) { const a = pins[j - 1], b = pins[j], kq = at(t, land(b[2]) + 0.05, land(b[2]) + 0.35, 'cubicOut');
        if (kq <= 0) continue; Y.beginPath(); Y.moveTo(a[0], a[1]); const mx = lerp(a[0], b[0], 0.5), my = Math.max(a[1], b[1]) + 60; Y.quadraticCurveTo(mx, my, lerp(a[0], b[0], kq), lerp(a[1], b[1], kq)); Y.stroke(); } Y.restore(); }
      pins.forEach(([x, y]) => { Y.fillStyle = P.ink; Y.beginPath(); Y.arc(x, y, 13, 0, 6.2832); Y.fill(); Y.fillStyle = 'rgba(255,255,255,.5)'; Y.beginPath(); Y.arc(x - 4, y - 4, 4, 0, 6.2832); Y.fill(); });
    };
    X.save(); X.translate(shake * ctx.noise1(t * 40, 1), shake * ctx.noise1(t * 40, 2));
    stage(ctx, t, o, k, bg, { s: 0.82, y: 0 }, { x: 250, y: 1060, w: 580, h: 640 }, notes, 18);
    X.restore();
  };

  /* 56 رسومات ترجف — دايرة وسهم ونجوم بخط اليد حول المتحدث، الخط «يغلي» (يترسم من جديد كل 5 فريمات). بالقصّ: الدايرة تلف ورا راسه. بلاه: كلها فوق.
     o: {s, out, person, video, text='شوف!', head:[x,y] (مركز الراس، تلقائي من القصّ), color=P.acc, fps=12} */
  FX.doodleBoil = (ctx, t, o) => {
    const { X, P, at } = ctx, PM = hasP(o), hold = Math.floor(t * (o.fps || 12)), col = o.color || '#FFFFFF', ink = o.ink || P.acc;
    const fade = o.out != null ? 1 - at(t, o.out, o.out + 0.3) : 1; if (o.video) o.video(X);
    let hx = 540, hy = 760, hr = 230;
    if (o.head) [hx, hy] = o.head; else if (PM) { const bb = pbox(o); if (bb) { hr = cl((bb.y1 - bb.y0) * 0.135, 150, 250); hy = bb.y0 + hr * 1.0; hx = bb.cx; } }
    const J = (i, a) => (h2(hold, i) - 0.5) * 2 * (a || 4.5);
    const ring = (from, to, seg) => { const pts = []; for (let i = 0; i <= 26; i++) { const a = lerp(from, to, i / 26), rr = hr * (1 + 0.06 * Math.sin(i * 1.7)); pts.push([hx + Math.cos(a) * rr * 1.08 + J(i + seg), hy + Math.sin(a) * rr * 1.18 + J(i + seg + 50)]); } return pts; };
    const kr = at(t, o.s, o.s + 0.7, 'cubicInOut'), ka = at(t, o.s + 0.6, o.s + 1.1, 'cubicOut'), kt = at(t, o.s + 1.0, o.s + 1.3, 'backOut');
    const st = (pts, k, w, c) => { if (k > 0) ctx.drawPath(X, pts, k, { width: (w || 14) + J(99, 1.5), color: c || col, cap: 'round' }); };
    X.save(); X.globalAlpha = fade;
    // الدايرة: النص اللي فوق الراس ورا الجسم (لو فيه قصّ)
    const A0 = -2.3, A1 = A0 + 6.2832 * 1.06, split = 3.6;   // 0..split خلف (تحت الذقن والجوانب)، الباقي قدام
    if (PM) { st(ring(A0, A1, 0), kr, 15); X.restore(); X.save(); X.globalAlpha = fade; o.person(X);
      X.save(); X.beginPath(); X.rect(0, 0, 1080, hy - hr * 0.35); X.clip(); st(ring(A0, A1, 0), kr, 15); X.restore(); }
    else st(ring(A0, A1, 0), kr, 15);
    // سهم من الكلمة للراس
    const ax0 = Math.min(hx + hr * 1.75, 800), ay0 = Math.max(hy - hr * 1.5, 330), ax1 = hx + hr * 1.15, ay1 = hy - hr * 0.55, mx = (ax0 + ax1) / 2 + 60, my = (ay0 + ay1) / 2 + 10;
    const arrow = []; for (let i = 0; i <= 10; i++) { const u = i / 10; arrow.push([(1 - u) * (1 - u) * ax0 + 2 * u * (1 - u) * mx + u * u * ax1 + J(i + 200, 3), (1 - u) * (1 - u) * ay0 + 2 * u * (1 - u) * my + u * u * ay1 + J(i + 230, 3)]); }
    st(arrow, ka, 13, ink); if (ka > 0.98) { const ang = Math.atan2(ay1 - my, ax1 - mx); [0.55, -0.55].forEach((d, j) => ctx.drawPath(X, [[ax1 + J(300 + j), ay1 + J(310 + j)], [ax1 - Math.cos(ang + d) * 52 + J(320 + j), ay1 - Math.sin(ang + d) * 52 + J(330 + j)]], 1, { width: 13, color: ink, cap: 'round', smooth: false })); }
    // نجوم وخطوط تعجب
    [[hx - hr * 1.5, hy - hr * 1.1, 1.0], [hx + hr * 1.55, hy + hr * 0.45, 0.8], [hx - hr * 1.25, hy + hr * 0.9, 0.6]].forEach(([sx, sy, s], j) => {
      const kk = at(t, o.s + 0.8 + j * 0.15, o.s + 1.15 + j * 0.15, 'cubicOut'); if (kk <= 0) return; const pts = [];
      for (let i = 0; i <= 10; i++) { const a = -Math.PI / 2 + i * Math.PI * 0.8, rr = 46 * s; pts.push([sx + Math.cos(a) * rr + J(400 + j * 20 + i, 2.5), sy + Math.sin(a) * rr + J(450 + j * 20 + i, 2.5)]); }
      ctx.drawPath(X, pts, kk, { width: 8, color: j === 1 ? ink : col, cap: 'round', smooth: false }); });
    for (let j = 0; j < 3; j++) { const kk = at(t, o.s + 1.2 + j * 0.06, o.s + 1.4 + j * 0.06); if (kk <= 0) continue; const a = -2.4 + j * 0.42, r0 = hr * 1.35, r1 = hr * 1.6;
      ctx.drawPath(X, [[hx + Math.cos(a) * r0 + J(500 + j), hy + Math.sin(a) * r0 * 1.15 + J(510 + j)], [hx + Math.cos(a) * r1 + J(520 + j), hy + Math.sin(a) * r1 * 1.15 + J(530 + j)]], kk, { width: 9, color: col, cap: 'round', smooth: false }); }
    // الكلمة: بخط عريض وترجف معها (الكلمة كاملة بنداء واحد)
    if (kt > ON) { X.save(); X.translate(Math.min(ax0, 760) + J(600, 2), ay0 - 40 + J(601, 2)); X.rotate(-0.12 + J(602, 0.02)); X.scale(kt, kt);
      ctx.text(X, o.text || 'شوف!', 0, 0, { family: 'display', size: 130, color: col, stroke: { width: 18, color: ink }, maxWidth: 420 }); ctx.text(X, o.text || 'شوف!', 0, 0, { family: 'display', size: 130, color: col, maxWidth: 420 }); X.restore(); }
    X.restore();
  };

  /* 57 غلاف مجلة — المتحدث يصير غلاف مجلة: اسم المجلة ورا راسه، سطر العدد، عناوين الغلاف وباركود. بالقصّ: الراس يغطي الاسم. بلاه: الاسم فوق الفيديو.
     o: {s, out, person, video, title='مكينة', issue='العدد 61 · أكتوبر 2026', lines:[[رقم/كلمة كبيرة, سطر]], big='السر بالبداية', bg=P.acc} */
  FX.coverStory = (ctx, t, o) => {
    const { X, P, at, E } = ctx, k = kIO(ctx, t, o, 0.45), PM = hasP(o), title = o.title || 'مكينة', zoom = 1 + 0.05 * at(t, o.s, o.s + 5, 'sineInOut');
    const L = o.lines || [['5', 'أدوات تختصر شغل أسبوع'], ['حصري', 'شلون أصوّر بالجوال'], ['ليش', 'أول 3 ثواني أهم شي']];
    const ka = i => at(t, o.s + 0.35 + i * 0.12, o.s + 0.85 + i * 0.12, 'expoOut') * (o.out != null ? 1 - at(t, o.out - 0.3, o.out) : 1);
    const bgc = o.bg || P.bg, fg = lum(bgc) > 150 ? '#1B1A17' : '#FFFFFF', tc = o.titleColor || (lum(bgc) > 150 ? P.acc : '#FFFFFF');
    const flash = Math.max(0, 1 - Math.abs(t - o.s - 0.22) / 0.12);
    if (k < 0.999 && o.video) o.video(X);
    if (k > 0.001) {
      X.save(); X.globalAlpha = k; zoomAt(X, [540, 960], zoom);
      if (PM) { X.fillStyle = bgc; X.fillRect(-60, -60, 1200, 2040); const g = X.createRadialGradient(540, 760, 100, 540, 900, 1100); g.addColorStop(0, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(0,0,0,.18)'); X.fillStyle = g; X.fillRect(-60, -60, 1200, 2040); }
      else if (o.video) o.video(X);
      const sh = PM ? { blur: 18, y: 0, color: bgc } : { blur: 18, y: 4, color: 'rgba(0,0,0,.45)' }, cf = PM ? fg : '#FFFFFF';
      const km = ka(0); X.save(); X.translate(0, -120 * (1 - km)); X.globalAlpha *= cl(km * 1.3);
      X.font = ctx.font('display', 400, 300); const tw = X.measureText(title).width, sx = Math.min(1.25, 940 / tw);
      ctx.text(X, title, 540, 410, { family: 'display', size: 300, color: PM ? tc : '#FFFFFF', scaleX: sx, shadow: PM ? null : { blur: 30, y: 8, color: 'rgba(0,0,0,.35)' } }); X.restore();
      const ki = ka(1); X.save(); X.globalAlpha *= ki; X.fillStyle = cf; X.fillRect(140, 452, 800 * ki, 4);
      ctx.text(X, o.issue || 'العدد 61 · أكتوبر 2026', 940, 500, { family: 'body', weight: 700, size: 32, align: 'right', color: cf, shadow: sh }); X.restore();
      X.restore();
      if (PM) { X.save(); X.globalAlpha = k; zoomAt(X, [540, 960], zoom); placeP(X, { s: 1.06, y: -40 }); shd(X, 40, 10, 0.3); o.person(X); X.restore(); noShd(X); }
      L.forEach((ln, i) => { const kk = ka(2 + i); if (kk <= 0) return; const right = i % 2 === 0, x = right ? 940 : 140, y = 680 + i * 210;
        X.save(); X.globalAlpha = k * kk; X.translate((right ? 1 : -1) * 80 * (1 - kk), 0);
        ctx.text(X, ln[0], x, y, { family: 'display', size: 120, align: right ? 'right' : 'left', color: i === 0 ? P.acc : cf, shadow: sh, dir: 'rtl' });
        ctx.text(X, ln[1], x, y + 62, { family: 'body', weight: 700, size: 36, align: right ? 'right' : 'left', color: cf, shadow: sh, maxWidth: 330, dir: 'rtl' }); X.restore(); });
      const kb = ka(2 + L.length); if (kb > 0) { X.save(); X.globalAlpha = k * kb; X.fillStyle = P.acc; X.fillRect(120, 1330, 840, 150); ctx.text(X, o.big || 'السر بالبداية', 540, 1432, { family: 'display', size: 96, color: P.onAcc || '#fff', maxWidth: 800 }); X.restore();
        X.save(); X.globalAlpha = k * kb; X.fillStyle = '#FFFFFF'; X.fillRect(150, 1500, 150, 90); X.fillStyle = '#111'; for (let i = 0; i < 26; i++) if (h2(i, 61) > 0.35) X.fillRect(160 + i * 5, 1508, h2(i, 62) > 0.6 ? 4 : 2, 62); X.restore(); }
      // لمعة ورق
      const sp = pr(t, o.s + 1.6, o.s + 2.4); if (sp > 0 && sp < 1) { X.save(); const sx2 = 1300 - 1800 * sp, g = X.createLinearGradient(sx2 - 200, 0, sx2 + 200, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.22)'); g.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = g; X.fillRect(0, 0, 1080, 1920); X.restore(); }
    }
    if (flash > 0) { X.fillStyle = '#FFFFFF'; X.globalAlpha = 0.85 * flash; X.fillRect(0, 0, 1080, 1920); X.globalAlpha = 1; }
  };

  /* 58 كلام زجاجي — كلمة كبيرة من زجاج مثلّج تكسر اللي وراها (غباش + انكسار + حافة ضوء)، ولوحة زجاج تحتها بسطر. ما يحتاج قصّ.
     o: {s, out, draw (اللي ورا الزجاج — MV.video), text='الفكرة', sub, y=820, size=300, panel=true} */
  FX.glassType = (ctx, t, o) => {
    const { X, P, at, E } = ctx, y = pick(o, 'y', 1180), size = o.size || 300, txt = o.text || 'الفكرة';
    const out = o.out != null ? at(t, o.out, o.out + 0.5, 'expoIn') : 0, kw = at(t, o.s, o.s + 0.9, 'expoOut') * (1 - out), kp = at(t, o.s + 0.45, o.s + 1.2, 'expoOut') * (1 - out);
    const base = snap(X, 'glass0', Y => o.draw(Y));   // يرسم الخلفية على X ويلقطها
    if (kw <= 0.001 && kp <= 0.001) return;
    const frosted = (Y, blur, z, cx, cy, br) => { Y.save(); Y.filter = `blur(${blur.toFixed(1)}px) brightness(${br || 1.18}) saturate(1.35)`; Y.translate(cx, cy); Y.scale(z, z); Y.translate(-cx, -cy); blit(Y, base, 0, 0, 1080, 1920, 0, 0, 1080, 1920); Y.restore(); };
    const sweep = pr(t, o.s + 1.0, o.s + 2.0), sx = 1300 - 1700 * E.cubicInOut(sweep);
    if (kw > 0.001) {
      const { c, Y } = offC(X, 'glassT'), yy = y + 60 * (1 - kw), sc = lerp(0.92, 1, kw);
      Y.save(); Y.translate(540, yy - size * 0.35); Y.scale(sc, sc); Y.translate(-540, -(yy - size * 0.35)); ctx.text(Y, txt, 540, yy, { family: 'display', size, color: '#FFFFFF', maxWidth: 980 }); Y.restore();
      Y.save(); Y.globalCompositeOperation = 'source-in'; frosted(Y, lerp(26, 7, kw), 1.08, 540, yy - size * 0.35, 1.3); Y.restore();
      Y.save(); Y.globalCompositeOperation = 'source-atop'; Y.fillStyle = 'rgba(255,255,255,.16)'; Y.fillRect(0, 0, 1080, 1920);
      const g = Y.createLinearGradient(sx - 140, 0, sx + 140, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); Y.fillStyle = g; Y.fillRect(0, 0, 1080, 1920); Y.restore();
      X.save(); shd(X, 40, 18, 0.3 * kw); X.globalAlpha = cl(kw * 1.4); putC(X, c); X.restore(); noShd(X);
      X.save(); X.globalAlpha = 0.7 * kw; X.translate(540, yy - size * 0.35); X.scale(sc, sc); X.translate(-540, -(yy - size * 0.35));
      const eg = X.createLinearGradient(0, yy - size, 0, yy + size * 0.2); eg.addColorStop(0, 'rgba(255,255,255,.95)'); eg.addColorStop(1, 'rgba(255,255,255,.15)');
      ctx.text(X, txt, 540, yy, { family: 'display', size, color: null, stroke: { width: 4, color: eg }, maxWidth: 980 }); X.restore();
    }
    if (o.panel !== false && kp > 0.001) {
      const pw = 900, ph = 200, px = 90, py = y + 120 + 120 * (1 - kp);
      X.save(); X.globalAlpha = cl(kp * 1.3); shd(X, 50, 20, 0.25); X.fillStyle = 'rgba(255,255,255,.08)'; X.beginPath(); X.roundRect(px, py, pw, ph, 46); X.fill(); noShd(X);
      X.save(); X.beginPath(); X.roundRect(px, py, pw, ph, 46); X.clip(); frosted(X, 22, 1.12, 540, py + ph / 2, 1.12); X.fillStyle = 'rgba(255,255,255,.16)'; X.fillRect(px, py, pw, ph); paperFill(X, px, py, pw, ph, 0.06);
      const g = X.createLinearGradient(sx - 160, 0, sx + 160, 0); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = g; X.fillRect(px, py, pw, ph); X.restore();
      const bg2 = X.createLinearGradient(0, py, 0, py + ph); bg2.addColorStop(0, 'rgba(255,255,255,.75)'); bg2.addColorStop(1, 'rgba(255,255,255,.12)'); X.strokeStyle = bg2; X.lineWidth = 2.5; X.beginPath(); X.roundRect(px + 1, py + 1, pw - 2, ph - 2, 45); X.stroke();
      ctx.text(X, o.sub || 'تشوف من خلالها كل شي', 540, py + ph / 2 + 24, { family: 'body', weight: 700, size: 62, color: '#FFFFFF', maxWidth: pw - 100, shadow: { blur: 14, y: 3, color: 'rgba(0,0,0,.35)' } });
      X.restore();
    }
  };

  /* 59 الفيديو داخل الجوال — فيديو المتحدث يصغر لين يصير شاشة جوال، والجوال يتمايل بمنظور ثلاثي. ما يحتاج قصّ.
     o: {s, out, video, title (كلمة ورا الجوال), handle, tilt=.32 (راديان), ui=true} */
  FX.phoneMockup = (ctx, t, o) => {
    const { X, P, at, E } = ctx, k = kIO(ctx, t, o, 1.0), dk = darker(P.ink, P.bg);
    const S = { x: 540 - 250, y: 300, w: 500, h: 1080 }, bez = 26, body = { x: S.x - bez, y: S.y - bez, w: S.w + 2 * bez, h: S.h + 2 * bez };
    const r = lerpR(FULL, S, k), rad = 64 * k;
    X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920);
    const g = X.createRadialGradient(540, 860, 50, 540, 860, 900); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = g; X.fillRect(0, 0, 1080, 1920);
    const kt = at(t, o.s + 0.7, o.s + 1.3, 'expoOut');
    if (o.title !== null) ctx.text(X, o.title || 'من جوالك', 540, 1620 - 40 * (1 - kt), { family: 'display', size: 120, color: P.ink, alpha: kt * k, maxWidth: 900 });
    const drawPhone = (Y, rr, kb) => {
      if (kb > 0.001) { Y.save(); Y.globalAlpha = kb; const b = { x: rr.x - bez * kb, y: rr.y - bez * kb, w: rr.w + 2 * bez * kb, h: rr.h + 2 * bez * kb };
        const bg = Y.createLinearGradient(b.x, 0, b.x + b.w, 0); bg.addColorStop(0, '#2A2A2C'); bg.addColorStop(0.5, '#111113'); bg.addColorStop(1, '#2A2A2C'); Y.fillStyle = bg; Y.beginPath(); Y.roundRect(b.x, b.y, b.w, b.h, rad + bez * kb); Y.fill();
        Y.strokeStyle = 'rgba(255,255,255,.18)'; Y.lineWidth = 3; Y.stroke(); Y.restore(); }
      vidIn(Y, o, rr, rad);
      if (o.ui !== false && kb > 0.5) { const a = cl((kb - 0.5) * 2); Y.save(); Y.globalAlpha = a; Y.fillStyle = '#000'; Y.beginPath(); Y.roundRect(rr.x + rr.w / 2 - 70, rr.y + 18, 140, 40, 20); Y.fill();
        ['♥', '✉', '➤'].forEach((ic, i) => ctx.text(Y, ic, rr.x + rr.w - 46, rr.y + rr.h - 360 + i * 100, { family: 'num', weight: 700, size: 46, color: '#fff', dir: 'ltr', shadow: { blur: 8, y: 2, color: 'rgba(0,0,0,.4)' } }));
        ctx.text(Y, o.handle || '@you', rr.x + 36, rr.y + rr.h - 70, { family: 'num', weight: 800, size: 30, color: '#fff', dir: 'ltr', align: 'left', shadow: { blur: 8, y: 2, color: 'rgba(0,0,0,.5)' } });
        Y.fillStyle = 'rgba(255,255,255,.85)'; Y.fillRect(rr.x + rr.w / 2 - 70, rr.y + rr.h - 22, 140, 6); Y.restore(); }
    };
    const kb = at(t, o.s + 0.55, o.s + 1.0, 'cubicOut'), tilt = (o.tilt == null ? 0.32 : o.tilt) * at(t, o.s + 0.9, o.s + 1.6, 'sineInOut');
    const ang = tilt * Math.sin((t - o.s - 0.9) * 1.1) - tilt * 0.25, float = 14 * Math.sin((t - o.s) * 1.6) * kb;
    // ظل تحت
    if (k > 0.3) { X.save(); X.globalAlpha = 0.3 * k; X.fillStyle = dk; X.filter = 'blur(28px)'; X.beginPath(); X.ellipse(540, body.y + body.h + 70, 260 * (1 - 0.3 * Math.abs(Math.sin(ang))), 30, 0, 0, 6.2832); X.fill(); X.restore(); }
    if (Math.abs(ang) < 0.003 || k < 0.999) { X.save(); X.translate(0, float); drawPhone(X, r, kb); X.restore(); return; }
    // منظور: نرسم الجوال مسطّح بكانفس جانبي ونقسمه شرايح طولية بعمق
    const { c: Sc, Y: PY } = offC(X, 'phone'); drawPhone(PY, r, kb);
    const D = 1800, N = 70, x0 = body.x - 10, w0 = body.w + 20, cy0 = body.y + body.h / 2;
    for (let i = 0; i < N; i++) { const pp = u => { const xl = (x0 + u * w0) - 540, z = xl * Math.sin(ang), f = D / (D + z); return [540 + xl * Math.cos(ang) * f, f]; };
      const [a0, f0] = pp(i / N), [a1, f1] = pp((i + 1) / N), f = (f0 + f1) / 2, h = 1920 * f;
      blit(X, Sc, x0 + i * w0 / N, 0, w0 / N, 1920, Math.min(a0, a1), cy0 + float - cy0 * f, Math.abs(a1 - a0) + 0.7, h); }
  };

  /* 60 قرين سكرين بالنص — مصدر كامل الشاشة (مقال، تغريدة، لقطة) يطلع كصفحة، يمشي ببطء، وقلم يحدد سطر، والمتحدث مقصوص قدامه تحت.
     يحتاج قصّ (ماك) — بلاه: وجه المتحدث بفقاعة دائرية تحت. o: {s, out, person, video, source:(Y)=>{} (يرسم المصدر 1080×1920), mark:[x,y,w] (سطر يتحدد), scroll=140} */
  FX.greenScreen = (ctx, t, o) => {
    const { X, P, at, E } = ctx, PM = hasP(o), kin = at(t, o.s, o.s + 0.75, 'expoOut'), kout = o.out != null ? at(t, o.out, o.out + 0.6, 'expoIn') : 0;
    const scr = (o.scroll == null ? 140 : o.scroll) * at(t, o.s + 0.4, o.s + 4.5, 'sineInOut');
    if (o.video) o.video(X);
    const off = (1 - kin + kout) * 1920; if (off >= 1919) return;
    X.save(); X.translate(0, off); shd(X, 70, -10, 0.35); X.fillStyle = '#FFFFFF'; X.beginPath(); X.roundRect(0, 0, 1080, 1920 + 80, 50 * (1 - kin)); X.fill(); noShd(X);
    X.beginPath(); X.roundRect(0, 0, 1080, 1920 + 80, 50 * (1 - kin)); X.clip(); X.save(); X.translate(0, -scr); const z = 1 + 0.04 * at(t, o.s, o.s + 5, 'sineInOut'); zoomAt(X, [540, 700], z);
    if (o.source) o.source(X); else { X.fillStyle = '#fff'; X.fillRect(0, 0, 1080, 2200); }
    if (o.mark) { const [mx, my, mw] = o.mark, km = at(t, o.s + 1.0, o.s + 1.5, 'cubicInOut'); if (km > 0) { X.save(); X.globalCompositeOperation = 'multiply'; X.fillStyle = P.hi || P.acc; X.globalAlpha = 0.55; X.beginPath(); X.roundRect(mx + mw - mw * km, my - 50, mw * km, 76, 12); X.fill(); X.restore(); } }
    X.restore(); X.restore();
    const ka = at(t, o.s + 0.5, o.s + 1.0, 'backOut') * (1 - kout);
    if (PM) { if (ka <= ON) return; X.save(); X.globalAlpha = cl(ka); X.translate(0, 300 * (1 - cl(ka))); placeP(X, { s: 0.6, x: -170, y: 0 }); shd(X, 40, 0, 0.45); o.person(X); X.restore(); noShd(X); }
    else if (ka > ON) { const cx = 300, cy = 1380, rr = 200 * ka; X.save(); shd(X, 40, 14, 0.3); X.fillStyle = P.acc; X.beginPath(); X.arc(cx, cy, rr + 12, 0, 6.2832); X.fill(); noShd(X); X.beginPath(); X.arc(cx, cy, rr, 0, 6.2832); X.clip();
      const sc = (2 * rr) / 760; X.translate(cx, cy); X.scale(sc, sc); X.translate(-540, -760); if (o.video) o.video(X); X.restore(); }
  };

  /* 61 قصاصة ورق — المتحدث مقصوص كأنه ملصق ورق: حافة بيضا ممزقة وملمس ورق وظل، ويتلصق بحركة ستوب موشن (12 فريم). يحتاج قصّ (ماك) — بلاه: الفيديو صورة ورق ممزقة.
     o: {s, out, person, video, text (كلمة على ورقة ممزقة), fps=12, bg} */
  FX.paperCut = (ctx, t, o) => {
    const { X, P, at, E } = ctx, PM = hasP(o), fps = o.fps || 12, tq = Math.floor(t * fps) / fps, hold = Math.floor(t * fps);
    const kin = at(tq, o.s, o.s + 0.45, 'backOut'), kout = o.out != null ? at(tq, o.out, o.out + 0.35, 'cubicIn') : 0, k = kin * (1 - kout);
    const jit = (i, a) => (h2(hold, i) - 0.5) * 2 * a;
    X.fillStyle = o.bg || P.bg; X.fillRect(0, 0, 1080, 1920); paperFill(X, 0, 0, 1080, 1920, 0.3);
    // شرايح ورق ملونة ورا (تتلصق قبل)
    [[P.acc, -8, 330, 0], [darker(P.ink, P.bg), 5, 1180, 1]].forEach(([c, rot, y, i]) => { const kk = at(tq, o.s - 0.2 + i * 0.12, o.s + 0.15 + i * 0.12, 'expoOut'); if (kk <= 0) return;
      X.save(); X.translate(540 + (1 - kk) * (i ? -1200 : 1200), y); X.rotate((rot + jit(10 + i, 0.4)) * Math.PI / 180); shd(X, 20, 8, 0.2); X.fillStyle = c; tornRect(X, -700, -110, 1400, 220, 31 + i * 7, 18); X.fill(); noShd(X); X.clip(); paperFill(X, -700, -110, 1400, 220, 0.3); X.restore(); });
    if (k <= ON) return;
    const rot = lerp(-9, -2.2, kin) + jit(1, 0.5), sc = lerp(1.25, 1, kin) * (1 - 0.15 * kout), dx = jit(2, 3), dy = jit(3, 3);
    X.save(); X.translate(540 + dx, 1000 + dy); X.rotate(rot * Math.PI / 180); X.scale(sc, sc); X.translate(-540, -1000);
    if (PM) {
      const pl = { s: 0.84, y: -40 };
      const A = offC(X, 'pcA'); A.Y.save(); placeP(A.Y, pl); o.person(A.Y); A.Y.restore();
      const B = offC(X, 'pcB'); B.Y.save(); B.Y.setTransform(1, 0, 0, 1, 0, 0); const m = X.getTransform().a;
      for (let i = 0; i < 28; i++) { const a = i * 6.2832 / 28, rr = (20 + 9 * h2(i, 77)) * m; B.Y.drawImage(A.c, Math.cos(a) * rr, Math.sin(a) * rr); }
      B.Y.globalCompositeOperation = 'source-in'; B.Y.fillStyle = '#FBF8F1'; B.Y.fillRect(0, 0, B.c.width, B.c.height); B.Y.restore();
      B.Y.save(); B.Y.globalCompositeOperation = 'source-atop'; paperFill(B.Y, -100, -100, 1300, 2100, 0.35); B.Y.restore();
      X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.shadowColor = 'rgba(0,0,0,.32)'; X.shadowBlur = 30 * m; X.shadowOffsetY = 18 * m; X.shadowOffsetX = 6 * m; X.drawImage(B.c, 0, 0); X.restore();
      putC(X, A.c);
      X.save(); X.globalAlpha = 0.12; X.globalCompositeOperation = 'multiply'; putC(X, B.c); X.restore();
    } else {
      const R = { x: 200, y: 520, w: 680, h: 920 }; shd(X, 30, 18, 0.32); X.fillStyle = '#FBF8F1'; tornRect(X, R.x - 30, R.y - 30, R.w + 60, R.h + 60, 51, 22); X.fill(); noShd(X);
      X.save(); X.clip(); paperFill(X, R.x - 40, R.y - 40, R.w + 80, R.h + 80, 0.3); X.restore(); vidIn(X, o, R, 0);
    }
    X.restore();
    const ktx = at(tq, o.s + 0.45, o.s + 0.75, 'backOut') * (1 - kout);
    if (o.text !== null && ktx > ON) { const s = o.text || 'قصّتي', size = 120; X.save(); X.translate(560 + jit(5, 2), 1460 + jit(6, 2)); X.rotate((3 + jit(7, 0.6)) * Math.PI / 180); X.scale(ktx, ktx);
      X.font = ctx.font('display', 400, size); const w = Math.min(820, X.measureText(s).width) + 90, h = size * 1.35; shd(X, 18, 8, 0.25); X.fillStyle = P.acc; tornRect(X, -w / 2, -h / 2, w, h, 71, 14); X.fill(); noShd(X);
      X.save(); X.clip(); paperFill(X, -w / 2, -h / 2, w, h, 0.3); X.restore();
      ctx.text(X, s, 0, size * 0.36, { family: 'display', size, color: P.onAcc || '#fff', maxWidth: 800 });
      X.fillStyle = 'rgba(240,232,214,.75)'; X.save(); X.rotate(-0.5); X.fillRect(-w / 2 - 30, -h / 2 + 10, 120, 40); X.restore(); X.restore(); }
  };


  /* ═══ 62–73: توسعة البنك — الدفعة أ (17 أكتوبر) — نفس العقد: كل خاصية من t، الألوان من ctx.P، والسطر العربي ينرسم كامل ═══
     حركات الحروف (62، 63، 66، 67) تحلّل السطر المرسوم كامل (الوصلات سليمة) أو الحرف بشكله المنفرد (66)، وكلها تخلص على الكلمة المتصلة الصحيحة. */
  const rgba = (h, a) => { const c = String(h || '#000').replace('#', ''), f = c.length === 3 ? c.split('').map(x => x + x).join('') : c;
    return `rgba(${parseInt(f.slice(0, 2), 16)},${parseInt(f.slice(2, 4), 16)},${parseInt(f.slice(4, 6), 16)},${a})`; };
  const vn2 = (x, y, sd) => { const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), r = (a, b) => h2(a * 7919 + sd, b * 104729 + sd);
    return lerp(lerp(r(i, j), r(i + 1, j), u), lerp(r(i, j + 1), r(i + 1, j + 1), u), v); };
  // الخط محمّل فعلاً؟ (check يرجع true لخط مو مسجّل أصلاً — فنعدّ الوجوه المحمّلة)
  const hasFace = fam => { try { return [...document.fonts].some(f => f.family.replace(/["']/g, '') === fam && f.status === 'loaded'); } catch (e) { return false; } };
  const fontOK = (f, s) => { try { return document.fonts.check(f, s); } catch (e) { return true; } };
  const fitSize = (X, font, str, size, maxW) => { X.save(); X.font = font(size); const w = X.measureText(str).width; X.restore(); return w > maxW ? size * maxW / w : size; };
  const tintC = (cm, col) => { const T = cm.tint || (cm.tint = {}); if (T[col]) return T[col];
    const c = document.createElement('canvas'); c.width = cm.c.width; c.height = cm.c.height; const Y = c.getContext('2d'); Y.drawImage(cm.c, 0, 0); Y.globalCompositeOperation = 'source-in'; Y.fillStyle = col; Y.fillRect(0, 0, c.width, c.height); return (T[col] = c); };
  /* يرسم السطر كامل على كانفس جانبي (دقة 1 = بكسل تصميم) ويقسمه لأجزاء متصلة: جسم حروف موصولة · نقاط · علامات.
     يرجّع {w,h,base,size,comps[],a (ألفا)}. السطر مركزه (w/2) وخط أساسه base: ارسم الجزء عند (x - w/2 + cm.x0, y - base + cm.y0) */
  const GLY = new Map();
  const glyphs = (font, str) => {
    const key = font + '|' + str; let g = GLY.get(key); if (g) return g;
    const size = parseFloat((font.match(/(\d+(?:\.\d+)?)px/) || [0, 100])[1]), c = document.createElement('canvas'), Y = c.getContext('2d', { willReadFrequently: true });
    Y.font = font; Y.direction = 'rtl'; const w = Math.ceil(Y.measureText(str).width + size * 0.8), h = Math.ceil(size * 2.3), base = Math.round(size * 1.5);
    c.width = w; c.height = h; Y.font = font; Y.direction = 'rtl'; Y.textAlign = 'center'; Y.textBaseline = 'alphabetic'; Y.fillStyle = '#000'; Y.fillText(str, w / 2, base);
    const d = Y.getImageData(0, 0, w, h).data, N = w * h, a = new Uint8Array(N), lab = new Int32Array(N), comps = [], st = [];
    for (let p = 0; p < N; p++) a[p] = d[p * 4 + 3];
    for (let p = 0; p < N; p++) {
      if (lab[p] || !a[p]) continue;
      const cm = { id: comps.length + 1, x0: 1e9, y0: 1e9, x1: -1, y1: -1, area: 0, mass: 0, sx: 0, sy: 0 }; lab[p] = cm.id; st.push(p);
      while (st.length) { const q = st.pop(), x = q % w, y = (q / w) | 0, al = a[q];
        cm.area++; cm.mass += al; cm.sx += x * al; cm.sy += y * al; if (x < cm.x0) cm.x0 = x; if (x > cm.x1) cm.x1 = x; if (y < cm.y0) cm.y0 = y; if (y > cm.y1) cm.y1 = y;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue; const r = yy * w + xx; if (!lab[r] && a[r]) { lab[r] = cm.id; st.push(r); } } }
      comps.push(cm);
    }
    comps.forEach(cm => { const cw = cm.x1 - cm.x0 + 1, ch = cm.y1 - cm.y0 + 1, s = document.createElement('canvas'); s.width = cw; s.height = ch;
      const S = s.getContext('2d'), im = S.createImageData(cw, ch), col = new Float32Array(cw), cnt = new Float32Array(cw);
      for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const q = (y + cm.y0) * w + x + cm.x0; if (lab[q] === cm.id) { im.data[(y * cw + x) * 4 + 3] = a[q]; col[x] += y * a[q]; cnt[x] += a[q]; } }
      S.putImageData(im, 0, 0); cm.c = s; cm.w = cw; cm.h = ch; cm.cx = cm.sx / cm.mass; cm.cy = cm.sy / cm.mass;
      cm.colY = col.map((v, i) => (cnt[i] ? v / cnt[i] : -1)); });
    g = { w, h, base, size, comps, a, ink: comps.reduce((b, c) => ({ x0: Math.min(b.x0, c.x0), y0: Math.min(b.y0, c.y0), x1: Math.max(b.x1, c.x1), y1: Math.max(b.y1, c.y1) }), { x0: 1e9, y0: 1e9, x1: -1, y1: -1 }) };
    if (fontOK(font, str)) GLY.set(key, g);   // الخط ما خلص تحميله؟ لا تخزّن (يرجع يحلّل الفريم الجاي)
    return g;
  };
  // نقطة/علامة = جزء صغير منفصل عن جسم الحرف (ممكن يلقط الهمزة والشدة — تنعامل مثل النقاط)
  const isDot = (cm, size) => cm.h < 0.34 * size && cm.w < 0.42 * size && cm.area < 0.06 * size * size;
  // صناديق الكلمات بنفس الخط والمقاس (بلا رسم) — لتلوين كلمة مفتاح
  const wordBoxes = (ctx, str, x, y, family, weight, size) => { const L = ctx.text.layout(ctx.X, str, { family, weight, size, maxWidth: 1e9 }); return ctx.text.drawLayout(ctx.X, L, x, y, { perWord: () => ({ skip: true }) }); };
  const inAcc = (B, acc, x) => (acc || []).some(i => B[i] && x >= B[i].x - 4 && x <= B[i].x + B[i].w + 4);
  // مثلث من صورة لمثلث بالتصميم (تحويل أفيني + قصّ) — أساس الإمالة الثلاثية بالكانفس
  const warpTri = (X, img, s, d) => {
    const [x0, y0, x1, y1, x2, y2] = s, [u0, v0, u1, v1, u2, v2] = d, den = (x1 - x0) * (y2 - y0) - (x2 - x0) * (y1 - y0); if (Math.abs(den) < 1e-6) return;
    const a = ((u1 - u0) * (y2 - y0) - (u2 - u0) * (y1 - y0)) / den, c = ((u2 - u0) * (x1 - x0) - (u1 - u0) * (x2 - x0)) / den, b = ((v1 - v0) * (y2 - y0) - (v2 - v0) * (y1 - y0)) / den, dd = ((v2 - v0) * (x1 - x0) - (v1 - v0) * (x2 - x0)) / den;
    const mx = (u0 + u1 + u2) / 3, my = (v0 + v1 + v2) / 3, inf = (u, v) => { const dx = u - mx, dy = v - my, l = Math.hypot(dx, dy) || 1; return [u + dx / l * 0.9, v + dy / l * 0.9]; };
    X.save(); X.beginPath(); X.moveTo(...inf(u0, v0)); X.lineTo(...inf(u1, v1)); X.lineTo(...inf(u2, v2)); X.closePath(); X.clip();
    X.transform(a, b, c, dd, u0 - a * x0 - c * y0, v0 - b * x0 - dd * y0); X.drawImage(img, 0, 0); X.restore();
  };

  /* 62 نقاط تنزل — السطر يطلع رسم بلا نقاط (مثل المصاحف الأولى) والنقاط تنزل وحدة وحدة من اليمين وتستقر بنقرة حبر، وآخرها يلوّن الكلمة المفتاح. ⛔ ممنوع على نص القرآن.
     o: {text, s, x=540, y=1000, size=260, gap=.08 (بين نقطة ونقطة), at (وقت استقرار آخر نقطة — wordTime الكلمة المفتاح؛ يحسب gap), accent:[رقم الكلمة], out} */
  FX.ijamDrop = (ctx, t, o) => {
    const { X, P, E, at } = ctx, x = pick(o, 'x', 540), y = pick(o, 'y', 1000), str = ctx.text.westernDigits(o.text);
    const size = fitSize(X, z => ctx.font('display', 400, z), str, o.size || 260, o.maxWidth || 920), font = ctx.font('display', 400, size), g = glyphs(font, str);
    const ko = o.out != null ? at(t, o.out, o.out + 0.45, 'cubicIn') : 0; if (t < o.s || ko >= 1) return;
    const dots = g.comps.filter(c => isDot(c, size)).sort((a, b) => b.cx - a.cx), body = g.comps.filter(c => !isDot(c, size)), n = dots.length;
    const fall = 0.42, t0 = o.s + 0.35, gap = o.at != null && n > 1 ? Math.max(0.02, (o.at - fall - t0) / (n - 1)) : pick(o, 'gap', 0.08), tEnd = t0 + Math.max(0, n - 1) * gap + fall;
    const B = o.accent ? wordBoxes(ctx, str, x, y, 'display', 400, size) : [], ka = at(t, tEnd, tEnd + 0.3, 'cubicOut'), ox = x - g.w / 2, oy = y - g.base - 40 * ko;
    X.save(); X.globalAlpha *= 1 - ko;
    const col = (cm, dx) => inAcc(B, o.accent, ox + cm.cx) && ka > 0 ? [P.ink, P.acc, ka] : [o.color || P.ink];
    const put = (cm, px, py, sx, sy, rot, al) => { const [c1, c2, k] = col(cm); X.save(); X.globalAlpha *= al; X.translate(px + cm.w / 2, py + cm.h / 2); if (rot) X.rotate(rot); X.scale(sx, sy);
      X.drawImage(tintC(cm, c1), -cm.w / 2, -cm.h / 2); if (c2) { X.globalAlpha *= k; X.drawImage(tintC(cm, c2), -cm.w / 2, -cm.h / 2); } X.restore(); };
    const a0 = at(t, o.s, o.s + 0.3, 'sineOut');
    body.forEach(cm => put(cm, ox + cm.x0, oy + cm.y0, 1, 1, 0, a0));
    dots.forEach((cm, i) => {
      const ts = t0 + i * gap, p = pr(t, ts, ts + fall); if (p <= 0) return;
      const k = E.backOut(p), land = ts + fall * 0.62, sq = t >= land ? Math.sin(Math.PI * pr(t, land, land + 0.12)) : 0;
      put(cm, ox + cm.x0, oy + cm.y0 - 180 * (1 - k) + sq * 3, 1 + 0.18 * sq, 1 - 0.3 * sq, (1 - E.cubicOut(p)) * Math.PI / 4, cl(p / 0.2));
      const pp = pr(t, land, land + 0.25);                             // 3 نقاط حبر
      if (pp > 0 && pp < 1) for (let j = 0; j < 3; j++) { const an = -Math.PI / 2 + (h2(i, j) - 0.5) * 2.4, v = 160 + 120 * h2(j, i + 9), tt = pp * 0.25;
        X.fillStyle = P.ink; X.globalAlpha = (1 - pp) * (1 - ko); X.beginPath(); X.arc(ox + cm.cx + Math.cos(an) * v * tt, oy + cm.y1 + Math.sin(an) * v * tt + 900 * tt * tt, 5 * (1 - pp) + 1.5, 0, 6.2832); X.fill(); X.globalAlpha = 1 - ko; }
    });
    X.restore();
  };

  /* 63 القلم يكتب — كل جزء متصل من الكلمة ينكتب بحافة قلم مايلة 70° (يمين←يسار)، والقلم يرفع بين الأجزاء، والحبر يطلع فاتح ويجف، والنقاط تنحط بنقرة بعد جزئها.
     الخط Aref Ruqaa لو محمّل (المحرّك)، وإلا خط العرض. o: {text, s, x=540, y=1000, size=250, per=.09 (ثانية لكل حرف), lift=.06, accent:[i], nib=true, family, out} */
  FX.qalamWrite = (ctx, t, o) => {
    const { X, P, E, at } = ctx, x = pick(o, 'x', 540), y = pick(o, 'y', 1000), str = ctx.text.westernDigits(o.text);
    const fam = o.family || (hasFace('Aref Ruqaa') ? 'Aref Ruqaa' : 'display'), wgt = fam === 'Aref Ruqaa' ? 700 : 400;
    const size = fitSize(X, z => ctx.font(fam, wgt, z), str, o.size || 250, o.maxWidth || 900), font = ctx.font(fam, wgt, size), g = glyphs(font, str);
    const ko = o.out != null ? at(t, o.out, o.out + 0.45, 'cubicIn') : 0; if (t < o.s || ko >= 1) return;
    const per = o.per || 0.09, lift = pick(o, 'lift', 0.06), SL = 0.364;                // ظل 70°
    // الترتيب: الأجسام من اليمين؛ كل علامة صغيرة تتبع الجسم اللي تحتها/فوقها
    if (!g.qalam) { const big = g.comps.filter(c => !isDot(c, g.size)).sort((a, b) => b.x1 - a.x1), small = g.comps.filter(c => isDot(c, g.size));
      big.forEach(b => (b.marks = []));
      small.forEach(m => { let best = null, bo = -1; big.forEach(b => { const ov = Math.min(m.x1, b.x1) - Math.max(m.x0, b.x0); if (ov > bo) { bo = ov; best = b; } }); if (!best || bo < 0) best = big.reduce((p, b) => (Math.abs(b.cx - m.cx) < Math.abs(p.cx - m.cx) ? b : p), big[0]); if (best) best.marks.push(m); });
      g.qalam = big; }
    const big = g.qalam, ox = x - g.w / 2, oy = y - g.base - 30 * ko, B = o.accent ? wordBoxes(ctx, str, x, y, fam, wgt, size) : [];
    let T = o.s; const sch = big.map(b => { const n = Math.max(1, Math.round(b.w / (size * 0.4))), d = per * n, r = { b, a: T, e: T + d }; T += d + lift; return r; });
    X.save(); X.globalAlpha *= 1 - ko; let nib = null;
    sch.forEach(({ b, a, e }, bi) => {
      const p = pr(t, a, e); if (p <= 0) return;
      const yc = b.h / 2, ex = lerp(b.w + yc * SL + 4, -yc * SL - 4, E.sineInOut(p)), px = ox + b.x0, py = oy + b.y0, acc = inAcc(B, o.accent, ox + b.cx), ka = acc ? at(t, e + 0.25, e + 0.55) : 0;
      const clipR = (x0) => { X.beginPath(); X.moveTo(px + x0 - yc * SL - 2, py - 4); X.lineTo(px + b.w + 4, py - 4); X.lineTo(px + b.w + 4, py + b.h + 4); X.lineTo(px + x0 + yc * SL + 2, py + b.h + 4); X.closePath(); };
      X.save(); if (p < 1) { clipR(ex); X.clip(); } X.drawImage(tintC(b, o.color || P.ink), px, py); if (ka > 0) { X.globalAlpha *= ka; X.drawImage(tintC(b, P.acc), px, py); } X.restore();
      // حبر مبلول: شريط ورا الحافة بلون فاتح يغمق خلال .35 ث
      const v = b.w / (e - a), band = Math.max(18, v * 0.35), wet = 1 - pr(t, e, e + 0.35);
      if (wet > 0) { const Wc = FX._qw || (FX._qw = document.createElement('canvas')); Wc.width = b.w; Wc.height = b.h; const Y = Wc.getContext('2d');
        Y.drawImage(tintC(b, P.hi || P.acc), 0, 0); Y.globalCompositeOperation = 'destination-in'; const gr = Y.createLinearGradient(ex - yc * SL, 0, ex + band, 0);
        gr.addColorStop(0, 'rgba(0,0,0,' + (0.95 * wet) + ')'); gr.addColorStop(0.25, 'rgba(0,0,0,' + (0.8 * wet) + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); Y.fillStyle = gr; Y.fillRect(0, 0, b.w, b.h);
        X.save(); if (p < 1) { clipR(ex); X.clip(); } X.drawImage(Wc, px, py); X.restore(); }
      if (p < 1) { const cx = Math.round(cl(ex, 0, b.w - 1)), cy = b.colY[cx] >= 0 ? b.colY[cx] : yc; nib = [px + ex, py + cy]; }
      b.marks.forEach((m, j) => { const tm = e + 0.04 + j * 0.05, k = at(t, tm, tm + 0.12, 'cubicOut'); if (k <= 0) return; const s2 = 1.4 - 0.4 * k, mc = inAcc(B, o.accent, ox + m.cx) && at(t, e + 0.25, e + 0.55) > 0 ? P.acc : (o.color || P.ink);
        X.save(); X.globalAlpha *= cl(k * 2); X.translate(ox + m.x0 + m.w / 2, oy + m.y0 + m.h / 2); X.scale(s2, s2); X.drawImage(tintC(m, mc), -m.w / 2, -m.h / 2); X.restore(); });
      if (!nib && bi < sch.length - 1 && t > e && t < sch[bi + 1].a) { const n2 = sch[bi + 1].b, q = pr(t, e, sch[bi + 1].a), sx = n2.x0 + n2.w + yc * SL; nib = [lerp(px, ox + sx, q), lerp(py + yc, oy + n2.y0 + n2.h / 2, q) - 26 * Math.sin(Math.PI * q)]; }
    });
    if (o.nib !== false && nib && t < T + 0.1) { X.save(); X.translate(nib[0], nib[1]); X.rotate(-(90 - 70) * Math.PI / 180 + Math.PI / 2); shd(X, 10, 6, 0.25); X.fillStyle = P.acc; X.beginPath(); X.roundRect(-6, -46, 12, 46, 3); X.fill(); noShd(X); X.restore(); }
    X.restore();
  };

  /* 64 كلمة بالفيديو — كلمة ضخمة فوق لون الخلفية، والفيديو الحي يشتغل داخل حروفها بس. وعلى o.out الكاميرا تدخل أعرض نقطة بالحرف لين الفيديو يصير الشاشة كلها (قطع مطابق).
     o: {text (كلمة أو كلمتين), s, out, video:(Y)=>{} (MV.video), x=540, y=1060, w=960, stroke=true} — بعد out ارجع لـvideo بنفسك */
  FX.videoText = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const str = ctx.text.westernDigits(o.text), x = pick(o, 'x', 540), y = pick(o, 'y', 1060);
    X.save(); X.font = ctx.font('display', 400, 100); const w100 = X.measureText(str).width; X.restore();
    const size = Math.min(o.size || 640, 100 * (o.w || 960) / w100), font = ctx.font('display', 400, size);
    const kz = o.out != null ? E.expoIn(pr(t, o.out - 0.6, o.out - 0.1)) : 0;
    if (kz >= 1) { if (o.video) o.video(X); return; }
    // أعرض نقطة داخل الحروف (مسافة عن الحافة — شامفر على نسخة ربع)
    const gs = glyphs(ctx.font('display', 400, size / 4), str);
    if (!gs.thick) { const { w, h, a } = gs, D = new Float32Array(w * h); for (let i = 0; i < w * h; i++) D[i] = a[i] > 127 ? 1e6 : 0;
      for (let yy = 1; yy < h; yy++) for (let xx = 1; xx < w - 1; xx++) { const i = yy * w + xx; if (D[i]) D[i] = Math.min(D[i], D[i - 1] + 1, D[i - w] + 1, D[i - w - 1] + 1.41, D[i - w + 1] + 1.41); }
      let best = 0, bi = 0; for (let yy = h - 2; yy >= 0; yy--) for (let xx = w - 2; xx > 0; xx--) { const i = yy * w + xx; if (D[i]) { D[i] = Math.min(D[i], D[i + 1] + 1, D[i + w] + 1, D[i + w + 1] + 1.41, D[i + w - 1] + 1.41); if (D[i] > best) { best = D[i]; bi = i; } } }
      gs.thick = [(bi % w - w / 2) * 4, ((bi / w | 0) - gs.base) * 4]; }
    const F = [x + gs.thick[0], y + gs.thick[1]], kin = at(t, o.s, o.s + 0.35, 'expoOut'), sc = (0.85 + 0.15 * kin) * (1 + 13 * kz), cy0 = y - size * 0.3;
    X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920);
    const tr = Y => { Y.translate(F[0], F[1]); Y.scale(1 + 13 * kz, 1 + 13 * kz); Y.translate(-F[0], -F[1]); Y.translate(x, cy0); Y.scale(0.85 + 0.15 * kin, 0.85 + 0.15 * kin); Y.translate(-x, -cy0); };
    const A = offC(X, 'vtA'); A.Y.save(); tr(A.Y); A.Y.font = font; A.Y.direction = 'rtl'; A.Y.textAlign = 'center'; A.Y.fillStyle = '#000'; A.Y.fillText(str, x, y); A.Y.restore();
    const V = offC(X, 'vtV'); if (o.video) o.video(V.Y); else { V.Y.fillStyle = P.acc; V.Y.fillRect(0, 0, 1080, 1920); }
    V.Y.save(); V.Y.setTransform(1, 0, 0, 1, 0, 0); V.Y.globalCompositeOperation = 'destination-in'; V.Y.drawImage(A.c, 0, 0); V.Y.restore();   // الفيديو داخل الحروف بس
    putC(X, V.c, cl(kin * 3));
    if (o.stroke !== false && kz < 0.6) { X.save(); tr(X); X.font = font; X.direction = 'rtl'; X.textAlign = 'center'; X.lineJoin = 'round'; X.lineWidth = 3 / sc * (0.85 + 0.15 * kin); X.strokeStyle = P.ink; X.globalAlpha = cl(kin * 3) * (1 - kz / 0.6); X.strokeText(str, x, y); X.restore(); }
  };

  /* 65 ستيكر — لحظة «وقف!»: فلاش، الخلفية تصير لون الهوية بنقاط هافتون، وأنت مجمّد كستيكر بحد أبيض يتقشّر، وستيكر كلمة ينلزق. على o.out يرجع كل شي بالعكس.
     يحتاج قصّ (ماك) — personAt يرسم القصّ بوقت ثاني (MV.personAt). بلاه: الفريم كامل مجمّد صورة بولارويد بنفس التقشير (videoAt = MV.frameAt).
     o: {s, out, person, personAt:(Y,t)=>bool, video, videoAt:(Y,t)=>bool, text='وقف!'} */
  const halftone = (X, col, ink) => { const key = col + ink, me = FX._ht || (FX._ht = {}); let c = me[key];
    if (!c) { c = me[key] = document.createElement('canvas'); c.width = 540; c.height = 960; const Y = c.getContext('2d'); Y.scale(0.5, 0.5); Y.fillStyle = col; Y.fillRect(0, 0, 1080, 1920); Y.fillStyle = ink;
      Y.save(); Y.translate(540, 960); Y.rotate(0.35); for (let gy = -1200; gy < 1200; gy += 30) for (let gx = -800; gx < 800; gx += 30) { const r = 1.5 + 8 * Math.pow(vn2((gx + 900) / 260, (gy + 1300) / 260, 5), 1.6) * (0.4 + 0.6 * (gy + 1200) / 2400);
        Y.beginPath(); Y.arc(gx, gy, r, 0, 6.2832); Y.fill(); } Y.restore(); }
    X.drawImage(c, 0, 0, 1080, 1920); };
  FX.stickerFreeze = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) { if (o.video) o.video(X); return; }
    const ko = o.out != null ? at(t, o.out, o.out + 0.3, 'cubicIn') : 0; if (ko >= 1) { if (o.video) o.video(X); return; }
    const frz = typeof o.personAt === 'function' && (typeof o.personAt.ok === 'function' ? !!o.personAt.ok(o.s) : true);
    if (ko > 0 && o.video) o.video(X);
    X.save(); X.globalAlpha *= 1 - ko; halftone(X, P.acc, rgba(P.onAcc || '#FFFFFF', 0.2));
    const kp = E.backOut(pr(t, o.s + 0.06, o.s + 0.42)) * (1 - ko), m = X.getTransform().a, piv = [540, 1250];
    const peel = Y => { Y.translate(piv[0], piv[1] - 18 * kp); Y.rotate(-4 * kp * Math.PI / 180); Y.scale(1 - 0.08 * kp, 1 - 0.08 * kp); Y.translate(-piv[0], -piv[1]); };
    if (frz) {
      const A = offC(X, 'sfA'); A.Y.save(); peel(A.Y); o.personAt(A.Y, o.s); A.Y.restore();
      const Bc = offC(X, 'sfB'); Bc.Y.save(); Bc.Y.setTransform(1, 0, 0, 1, 0, 0); for (let i = 0; i < 16; i++) { const an = i * 6.2832 / 16; Bc.Y.drawImage(A.c, Math.cos(an) * 16 * m, Math.sin(an) * 16 * m); }
      Bc.Y.globalCompositeOperation = 'source-in'; Bc.Y.fillStyle = '#FFFFFF'; Bc.Y.fillRect(0, 0, Bc.c.width, Bc.c.height); Bc.Y.restore();
      X.save(); X.setTransform(1, 0, 0, 1, 0, 0); X.shadowColor = rgba(P.ink, 0.3 + 0.15 * kp); X.shadowBlur = (10 + 16 * kp) * m; X.shadowOffsetX = (6 + 8 * kp) * m; X.shadowOffsetY = (8 + 10 * kp) * m; X.drawImage(Bc.c, 0, 0); X.restore();
      putC(X, A.c);
    } else {                                                   // بولارويد: الفريم كامل مجمّد
      const R = { x: 170, y: 300, w: 740, h: 1000 }; X.save(); peel(X); shd(X, 16 + 24 * kp, 10 + 12 * kp, 0.3); X.fillStyle = '#FFFFFF'; X.fillRect(R.x - 24, R.y - 24, R.w + 48, R.h + 140); noShd(X);
      X.save(); X.beginPath(); X.rect(R.x, R.y, R.w, R.h); X.clip(); const sc = Math.max(R.w / 1080, R.h / 1920); X.translate(R.x + R.w / 2, R.y + R.h * 0.34); X.scale(sc, sc); X.translate(-540, -1920 * 0.34);
      if (!(o.videoAt && o.videoAt(X, o.s)) && o.video) o.video(X); X.restore(); X.restore();
    }
    const ts = o.s + 0.2, kt = at(t, ts, ts + 0.25, 'backOut') * (1 - (o.out != null ? at(t, o.out - 0.12, o.out + 0.1, 'cubicIn') : 0));
    if (o.text !== null && kt > ON) { const s = o.text || 'وقف!', size = 130; X.save(); X.translate(560, 1420); X.rotate(3 * Math.PI / 180); const z = 1.3 - 0.3 * kt; X.scale(z, z); X.globalAlpha *= cl(kt * 3);
      X.font = ctx.font('display', 400, size); const w = Math.min(760, X.measureText(s).width) + 110, h = size * 1.45;
      shd(X, 22, 12, 0.3); X.fillStyle = '#FFFFFF'; X.beginPath(); X.roundRect(-w / 2 - 14, -h / 2 - 14, w + 28, h + 28, 40); X.fill(); noShd(X);
      X.fillStyle = P.ink; X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, 28); X.fill();
      ctx.text(X, s, 0, size * 0.36, { family: 'display', size, color: '#FFFFFF', maxWidth: 740 }); X.restore(); }
    const fl = pr(t, o.s, o.s + 0.05); if (fl < 1) { X.fillStyle = 'rgba(255,255,255,' + (0.6 * (1 - fl)) + ')'; X.fillRect(0, 0, 1080, 1920); }
    X.restore();
  };

  /* 66 حروف تتلاصق — الكلمة تطلع حروف منفصلة (كل حرف بشكله المنفرد = ZWNJ)، وعلى at تنسحب لبعض وتتلاصق وتصير الكلمة المتصلة بلمعة على نقاط الوصل ورجّة ومطّة.
     o: {text (كلمة وحدة), s, at (وقت التلاصق — wordTime)، x=540, y=1000, size=260, gap=60, color, out} */
  const JD = new Set('بتثجحخسشصضطظعغفقكلمنهيئىـپچگکیڤ'.split('')), JR = new Set('اأإآدذرزوؤةٱژ'.split(''));
  FX.joinSnap = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const x = pick(o, 'x', 540), y = pick(o, 'y', 1000), str = ctx.text.westernDigits(o.text).trim(), size0 = fitSize(X, z => ctx.font('display', 400, z), str, o.size || 260, 820), font0 = ctx.font('display', 400, size0);
    const ko = o.out != null ? at(t, o.out, o.out + 0.4, 'cubicIn') : 0; if (ko >= 1) return;
    const U = []; for (const ch of str) { if (/[ً-ٰٟ]/.test(ch) && U.length) U[U.length - 1] += ch; else U.push(ch); }
    X.save(); X.font = font0; X.direction = 'rtl'; const W0 = U.map(u => X.measureText(u).width); X.restore();
    const spread0 = W0.reduce((a, b) => a + b, 0) + pick(o, 'gap', 60) * (U.length - 1), fz = spread0 > 960 ? 960 / spread0 : 1, size = size0 * fz, font = ctx.font('display', 400, size);   // الحروف المنفصلة لازم تدخل الشاشة
    X.save(); X.font = font; X.direction = 'rtl'; const W = U.map(u => X.measureText(u).width), Wj = X.measureText(str).width; X.restore();
    const n = U.length, sw = W.reduce((a, b) => a + b, 0), snapT = o.at != null ? o.at : o.s + 1.3, gEnd = n > 1 ? Math.max((Wj - sw) / (n - 1), -size * 0.04) : 0;   // يتلامسون بلا تراكب، والقفزة للعرض المتصل = اللصقة
    const kj = E.expoIn(pr(t, snapT - 0.35, snapT)), G0 = pick(o, 'gap', 60) * fz, G = lerp(G0, gEnd, kj), tot = sw + G * (n - 1), sw2 = pr(t, snapT, snapT + 0.06);
    const shake = t >= snapT ? 4 * (1 - pr(t, snapT, snapT + 0.18)) * Math.sin(t * 90) : 0, rub = t >= snapT ? 1 + 0.04 * Math.exp(-6 * (t - snapT)) * Math.cos(18 * (t - snapT)) : 1;
    X.save(); X.globalAlpha *= 1 - ko; X.translate(x + shake, y); X.scale(rub, 1); X.translate(-x, -y);
    if (sw2 < 1) { let r = x + tot / 2;
      U.forEach((u, i) => { const ka = at(t, o.s + i * 0.06, o.s + i * 0.06 + 0.35, 'backOut'), cx = r - W[i] / 2, rot = (h2(i, 31) - 0.5) * 8 * Math.PI / 180 * (1 - kj), fy = 10 * Math.sin(t * 3 + i) * (1 - kj);
        r -= W[i] + G; if (ka <= ON) return;
        X.save(); X.globalAlpha *= cl(ka * 2) * (1 - sw2); X.translate(cx, y - size * 0.3 + fy); X.rotate(rot); X.scale(0.6 + 0.4 * ka, 0.6 + 0.4 * ka);
        ctx.text(X, u, 0, size * 0.3, { family: 'display', size, color: o.color || P.ink }); X.restore(); }); }
    if (sw2 > 0) { ctx.text(X, str, x, y, { family: 'display', size, color: o.color || P.ink, alpha: sw2 });
      const kf = pr(t, snapT, snapT + 0.25); if (kf < 1) { let acc = 0; const f = Wj / sw;
        for (let i = 0; i < n - 1; i++) { acc += W[i]; const a = U[i][0], b = U[i + 1][0]; if (!(JD.has(a) && (JD.has(b) || JR.has(b)))) continue;
          const bx = x + Wj / 2 - acc * f, by = y - size * 0.22; X.save(); X.globalAlpha *= 0.75 * (1 - kf); X.strokeStyle = P.acc; X.lineWidth = 5; X.beginPath(); X.arc(bx, by, 10 + 46 * E.cubicOut(kf), 0, 6.2832); X.stroke();
          X.fillStyle = '#FFFFFF'; X.beginPath(); X.ellipse(bx, by, 5 * (1 - kf) + 1, size * 0.22 * (1 - kf) + 2, 0, 0, 6.2832); X.fill(); X.restore(); } } }
    X.restore();
  };

  /* 67 كوفي مربع — الكلمة تنبني بلاط على شبكة (مثل الخط الكوفي المربع): الشبكة ترتسم، الخلايا تنقلب 90° عمود عمود من اليمين، وبعدين ترجع للنص الحاد بنفس المكان (أو تظل كوفي).
     o: {text, s, x=540, y=960 (مركز), w=920, rows=16, accent:[i], end='text'|'kufi', resolve (وقت الرجوع للنص، افتراضي بعد ما تخلص الخلايا بـ.6), out} */
  FX.kufiGrid = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const ko = o.out != null ? at(t, o.out, o.out + 0.4, 'cubicIn') : 0; if (ko >= 1) return;
    const str = ctx.text.westernDigits(o.text), x = pick(o, 'x', 540), y = pick(o, 'y', 960), rows = o.rows || 16, RS = 300, g = glyphs(ctx.font('kufi', 900, RS), str), I = g.ink;
    const key = 'k' + rows; if (!g[key]) { const c0 = (I.y1 - I.y0 + 1) / rows, cols = Math.ceil((I.x1 - I.x0 + 1) / c0), gx0 = (I.x0 + I.x1) / 2 - cols * c0 / 2, cells = [];
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { let s = 0, m = 0; const xa = Math.round(gx0 + c * c0), ya = Math.round(I.y0 + r * c0), xb = Math.round(gx0 + (c + 1) * c0), yb = Math.round(I.y0 + (r + 1) * c0);
        for (let yy = ya; yy < yb; yy++) for (let xx = xa; xx < xb; xx++) { m++; if (xx >= 0 && xx < g.w && yy >= 0 && yy < g.h) s += g.a[yy * g.w + xx]; }
        if (m && s / m > 127) cells.push({ r, c, gx: gx0 + (c + 0.5) * c0 }); }
      g[key] = { c0, cols, gx0, cells, cxm: gx0 + cols * c0 / 2, cym: I.y0 + rows * c0 / 2 }; }
    const K = g[key], fit = Math.min((o.w || 920) / (K.cols * K.c0), 860 / (rows * K.c0)), cs = K.c0 * fit, GW = K.cols * cs, GH = rows * cs, gx = x - GW / 2, gy = y - GH / 2;
    const B = o.accent ? wordBoxes(ctx, str, g.w / 2, g.base, 'kufi', 900, RS) : [], tCells = o.s + 0.3 + (K.cols - 1) * 0.018 + 0.3, res = o.end === 'kufi' ? Infinity : (o.resolve != null ? o.resolve : tCells + 0.6);
    const kr = at(t, res, res + 0.4, 'cubicInOut');
    X.save(); X.globalAlpha *= 1 - ko;
    // الشبكة
    const kg = at(t, o.s, o.s + 0.3, 'cubicOut') * (1 - at(t, tCells, tCells + 0.4)); if (kg > 0) { X.save(); X.strokeStyle = P.mut; X.globalAlpha *= 0.3 * Math.min(1, kg * 3); X.lineWidth = 1.5; X.beginPath();
      for (let c = -1; c <= K.cols + 1; c++) { const xx = gx + GW - c * cs; X.moveTo(xx, gy - cs); X.lineTo(xx, gy - cs + (GH + 2 * cs) * kg); }
      for (let r = -1; r <= rows + 1; r++) { const yy = gy + r * cs; X.moveTo(gx + GW + cs, yy); X.lineTo(gx + GW + cs - (GW + 2 * cs) * kg, yy); } X.stroke(); X.restore(); }
    if (kr < 1) { X.save(); X.globalAlpha *= 1 - kr; const ins = cs * 0.04;
      K.cells.forEach(cl2 => { const ci = K.cols - 1 - cl2.c, d = o.s + 0.3 + ci * 0.018 + 0.03 * h2(cl2.r, cl2.c), k = E.backOut(pr(t, d, d + 0.22)); if (k <= ON) return;
        const cx = gx + (cl2.c + 0.5) * cs, cy = gy + (cl2.r + 0.5) * cs, sx = k * (1 - 0.15 * kr);
        X.fillStyle = inAcc(B, o.accent, cl2.gx) ? P.acc : (o.color || P.ink); X.fillRect(cx - (cs / 2 - ins) * sx, cy - (cs / 2 - ins) * (1 - 0.15 * kr), (cs - 2 * ins) * sx, (cs - 2 * ins) * (1 - 0.15 * kr)); });
      X.restore(); }
    if (kr > 0) { const tx = x + (g.w / 2 - K.cxm) * fit, ty = y + (g.base - K.cym) * fit, L = ctx.text.layout(X, str, { family: 'kufi', weight: 900, size: RS * fit, maxWidth: 1e9 });
      X.save(); X.globalAlpha *= kr; ctx.text.drawLayout(X, L, tx, ty, { align: 'center', perWord: i => ({ color: (o.accent || []).includes(i) ? P.acc : (o.color || P.ink) }) }); X.restore(); }
    X.restore();
  };

  /* 68 شعاع الربط — عقد (أيقونة + اسم) حول مركز، ومسارات منحنية بينها، وشعاع ضوء يمشي عليها ويعيد، والعقدة تنبض لما يوصلها. المهم (المركز) يطلع أول.
     o: {s, hub:{label, icon}, nodes:[{label, icon}] (أكثر شي 6؛ icon: 'doc'|'mail'|'cal'|'chat'|'sheet'|'folder'|'spark' أو صورة), dur=1.6, y=900, out} */
  const ICON = (Y, k, c, c2) => { Y.save(); Y.strokeStyle = c; Y.fillStyle = c; Y.lineWidth = 5; Y.lineJoin = 'round'; Y.lineCap = 'round'; Y.beginPath();
    if (k === 'mail') { Y.roundRect(-30, -21, 60, 42, 6); Y.moveTo(-28, -18); Y.lineTo(0, 4); Y.lineTo(28, -18); Y.stroke(); }
    else if (k === 'cal') { Y.roundRect(-28, -24, 56, 52, 8); Y.stroke(); Y.fillRect(-28, -24, 56, 14); for (let i = 0; i < 6; i++) Y.fillRect(-18 + (i % 3) * 14, 0 + Math.floor(i / 3) * 12, 8, 7); }
    else if (k === 'chat') { Y.roundRect(-30, -24, 60, 40, 14); Y.moveTo(-10, 16); Y.lineTo(-18, 28); Y.lineTo(2, 16); Y.stroke(); Y.fillStyle = c2 || c; for (let i = -1; i <= 1; i++) { Y.beginPath(); Y.arc(i * 14, -4, 4, 0, 6.2832); Y.fill(); } }
    else if (k === 'sheet') { Y.roundRect(-26, -30, 52, 60, 6); Y.moveTo(-26, -10); Y.lineTo(26, -10); Y.moveTo(-26, 10); Y.lineTo(26, 10); Y.moveTo(0, -30); Y.lineTo(0, 30); Y.stroke(); }
    else if (k === 'folder') { Y.moveTo(-32, -20); Y.lineTo(-10, -20); Y.lineTo(-4, -12); Y.lineTo(32, -12); Y.lineTo(32, 24); Y.lineTo(-32, 24); Y.closePath(); Y.stroke(); }
    else if (k === 'spark') { for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; Y.moveTo(0, 0); Y.quadraticCurveTo(Math.cos(a + 0.785) * 8, Math.sin(a + 0.785) * 8, Math.cos(a) * 34, Math.sin(a) * 34); Y.quadraticCurveTo(Math.cos(a - 0.785) * 8, Math.sin(a - 0.785) * 8, 0, 0); } Y.fill(); }
    else { Y.moveTo(-22, -30); Y.lineTo(10, -30); Y.lineTo(24, -16); Y.lineTo(24, 30); Y.lineTo(-22, 30); Y.closePath(); Y.stroke(); Y.beginPath(); Y.moveTo(-10, 0); Y.lineTo(12, 0); Y.moveTo(-10, 13); Y.lineTo(12, 13); Y.stroke(); }
    Y.restore(); };
  FX.beamConnect = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const ko = o.out != null ? at(t, o.out, o.out + 0.4, 'cubicIn') : 0; if (ko >= 1) return;
    const N = (o.nodes || [{ label: 'الإيميل', icon: 'mail' }, { label: 'التقويم', icon: 'cal' }, { label: 'الملفات', icon: 'folder' }, { label: 'الجدول', icon: 'sheet' }, { label: 'الرسايل', icon: 'chat' }, { label: 'المستندات', icon: 'doc' }]).slice(0, 6);
    const hub = o.hub || { label: 'المساعد', icon: 'spark' }, cy = pick(o, 'y', 900), n = N.length, dur = o.dur || 1.6, H = [540, cy];
    const pos = N.map((_, i) => { const a = -Math.PI / 2 + (i + 0.5) * 6.2832 / n; return [540 + 340 * Math.cos(a), cy + 500 * Math.sin(a)]; });
    const paths = pos.map((p, i) => { const mx = (p[0] + H[0]) / 2, my = (p[1] + H[1]) / 2, dx = H[0] - p[0], dy = H[1] - p[1], l = Math.hypot(dx, dy), cv = (40 + 40 * h2(i, 3)) * (i % 2 ? 1 : -1);
      return `M${p[0].toFixed(1)} ${p[1].toFixed(1)} Q${(mx - dy / l * cv).toFixed(1)} ${(my + dx / l * cv).toFixed(1)} ${H[0]} ${H[1]}`; });
    X.save(); X.globalAlpha *= 1 - ko;
    const t0 = o.s + 0.95, pulses = new Array(n + 1).fill(0);
    paths.forEach((d, i) => { const kp = at(t, o.s + 0.35 + i * 0.08, o.s + 0.85 + i * 0.08, 'cubicInOut'); if (kp <= 0) return;
      X.save(); X.globalAlpha *= 0.35; ctx.drawPath(X, d, kp, { color: P.mut, width: 5 }); X.restore();
      if (t < t0) return; const inv = i % 2, ph = (t - t0 - i * 0.23) / dur; if (ph < 0) return; const f = ph - Math.floor(ph), seg = 0.22, head = f * (1 + seg), Pi = ctx.pathInfo(d), L = Pi.len;
      const ar = Math.floor(ph) >= 0 ? pr(t, t0 + i * 0.23 + Math.floor(ph) * dur + dur / (1 + seg), t0 + i * 0.23 + Math.floor(ph) * dur + dur / (1 + seg) + 0.4) : 0;
      if (ar > 0 && ar < 1) pulses[inv ? i + 1 : 0] = Math.max(pulses[inv ? i + 1 : 0], 1 - ar);
      const K = 10; for (let j = 0; j < K; j++) { const a = head - seg + seg * j / K, b = head - seg + seg * (j + 1) / K, ca = cl(a), cb = cl(b); if (cb <= ca) continue; const q = (j + 0.5) / K;
        const pa = Pi.at((inv ? 1 - ca : ca) * L), pb = Pi.at((inv ? 1 - cb : cb) * L); X.save(); X.globalAlpha *= Math.sin(Math.PI * q); X.strokeStyle = q > 0.7 ? (P.hi || P.acc) : P.acc; X.lineWidth = 8; X.lineCap = 'round';
        X.shadowColor = P.acc; X.shadowBlur = 14; X.beginPath(); X.moveTo(pa[0], pa[1]); X.lineTo(pb[0], pb[1]); X.stroke(); X.restore(); } });
    const node = (p, it, k, r, hubN, pu) => { if (k <= ON) return; X.save(); X.translate(p[0], p[1]); X.scale(k, k);
      if (pu > 0) { X.strokeStyle = P.acc; X.lineWidth = 5; X.globalAlpha *= pu; X.beginPath(); X.arc(0, 0, r + 8 + 22 * (1 - pu), 0, 6.2832); X.stroke(); X.globalAlpha = (1 - ko); }
      shd(X, 30, 12, 0.18); X.fillStyle = hubN ? P.acc : '#FFFFFF'; X.beginPath(); X.arc(0, 0, r, 0, 6.2832); X.fill(); noShd(X);
      if (it.icon && typeof it.icon === 'object') { X.save(); X.beginPath(); X.arc(0, 0, r * 0.62, 0, 6.2832); X.clip(); X.drawImage(it.icon, -r * 0.62, -r * 0.62, r * 1.24, r * 1.24); X.restore(); }
      else { X.save(); X.scale(r / 62, r / 62); ICON(X, it.icon, hubN ? (P.onAcc || '#fff') : P.ink, P.acc); X.restore(); }
      if (it.label) ctx.text(X, it.label, 0, r + 60, { family: 'body', weight: 700, size: hubN ? 50 : 44, color: P.ink, maxWidth: 260 }); X.restore(); };
    pos.forEach((p, i) => node(p, N[i], at(t, o.s + 0.2 + i * 0.08, o.s + 0.6 + i * 0.08, 'backOut'), 84, false, pulses[i + 1]));
    node(H, hub, at(t, o.s, o.s + 0.4, 'backOut'), 110, true, pulses[0]);
    X.restore();
  };

  /* 69 صفحة كتاب عربي — الكتاب العربي كعبه يمين، فالصفحة تنقلب من حافتها اليسار لليمين: خط طي مايل يمشي، الطيّة ورق بظهر الصفحة الباهت، وظل على المشهد الجديد.
     o: {s, dur=.8, A, B, tilt=8 (درجات), paper=P.bg} */
  FX.pageTurnRTL = (ctx, t, o) => {
    const { X, P, E } = ctx, k = E.cubicInOut(pr(t, o.s, o.s + (o.dur || 0.8)));
    if (k <= 0.001) { o.A(X); return; } if (k >= 0.999) { o.B(X); return; }
    const th = (o.tilt == null ? 8 : o.tilt) * Math.PI / 180, xf = lerp(-260, 1340, k), BIG = 3000;
    const frame = () => { X.translate(540, 960); X.rotate(th); X.translate(-540, -960); }, unframe = () => { X.translate(540, 960); X.rotate(-th); X.translate(-540, -960); };
    X.save(); frame(); X.beginPath(); X.rect(xf, -BIG, BIG, 3 * BIG); X.clip(); unframe(); o.A(X); X.restore();          // A: يمين الطي
    X.save(); frame(); X.beginPath(); X.rect(-BIG, -BIG, xf + BIG, 3 * BIG); X.clip(); unframe(); o.B(X); frame();       // B: يسار الطي + ظل الصفحة
    const sg = X.createLinearGradient(xf, 0, xf - 60, 0); sg.addColorStop(0, 'rgba(0,0,0,.28)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); X.fillStyle = sg; X.fillRect(xf - 60, -BIG, 60, 3 * BIG); X.restore();
    const fw = xf + 260;                                                                                                       // الطيّة = انعكاس [−260, xf] على خط الطي
    X.save(); frame(); X.beginPath(); X.rect(xf, -BIG, Math.max(0, fw), 3 * BIG); X.clip();
    X.save(); X.shadowColor = 'rgba(0,0,0,.3)'; X.shadowBlur = 40; X.shadowOffsetX = 14; X.fillStyle = o.paper || P.bg; X.fillRect(xf, -BIG, Math.max(0, fw), 3 * BIG); X.restore();
    X.save(); X.globalAlpha = 0.15; X.translate(2 * xf, 0); X.scale(-1, 1); unframe(); o.A(X); X.restore();               // ظهر الصفحة: A معكوس على خط الطي
    const g = X.createLinearGradient(xf, 0, xf + Math.max(1, fw), 0); g.addColorStop(0, 'rgba(0,0,0,.22)'); g.addColorStop(0.3, 'rgba(0,0,0,.04)'); g.addColorStop(0.75, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
    X.fillStyle = g; X.fillRect(xf, -BIG, Math.max(1, fw), 3 * BIG); X.restore();
  };

  /* 70 أشعة من وراك — أشعة ضوء تطلع من ورا راسك وتلف ببطء ونَفَسها يتغير. بالقصّ (ماك): الفيديو ← الأشعة ← أنت. بلاه: أشعة نازلة من فوق مثل ضوء شباك بـscreen.
     o: {s, out, person, video, at=[540,600] (ورا الراس), n=18, spin=4 (درجة/ث), color=P.hi, power=1} */
  FX.lightRays = (ctx, t, o) => {
    const { X, P, at } = ctx; if (o.video) o.video(X); if (t < o.s) return;
    const kin = at(t, o.s, o.s + 0.8, 'sineOut') * (o.out != null ? 1 - at(t, o.out, o.out + 0.6, 'sineIn') : 1) * (o.power || 1); if (kin <= 0.001) return;
    const PM = hasP(o), n = o.n || 18, col = o.color || P.hi || P.acc, rot = (o.spin == null ? 4 : o.spin) * (t - o.s) * Math.PI / 180;
    const [ax, ay] = PM ? (o.at || [540, 600]) : [760, -160], R = PM ? 1500 : 2400;
    X.save(); X.globalCompositeOperation = PM ? 'lighter' : 'screen'; X.globalAlpha *= PM ? 0.55 * kin : 0.38 * kin;
    const gr = X.createRadialGradient(ax, ay, 0, ax, ay, R); gr.addColorStop(0, col); gr.addColorStop(0.35, rgba(col, 0.55)); gr.addColorStop(1, rgba(col, 0)); X.fillStyle = gr;
    X.beginPath();
    for (let i = 0; i < n; i++) { const base = PM ? i * 6.2832 / n + rot : Math.PI * (0.32 + 0.5 * i / n) + rot * 0.3, w = (0.035 + 0.05 * (ctx.noise1(t * 0.6 + i * 3.1, i) * 0.5 + 0.5)) * (PM ? 1 : 0.6);
      const al = 0.5 + 0.5 * ctx.noise1(t * 0.8 + i * 1.7, 50 + i); if (al < 0.15) continue;
      X.moveTo(ax, ay); X.lineTo(ax + Math.cos(base - w) * R, ay + Math.sin(base - w) * R); X.lineTo(ax + Math.cos(base + w) * R, ay + Math.sin(base + w) * R); X.closePath(); }
    X.fill();
    const glow = X.createRadialGradient(ax, ay, 0, ax, ay, PM ? 420 : 900); glow.addColorStop(0, rgba(col, 0.9)); glow.addColorStop(1, rgba(col, 0)); X.fillStyle = glow; X.fillRect(0, 0, 1080, 1920);
    X.restore();
    if (PM) o.person(X);
  };

  /* 71 ميلة الفصل — الفيديو يصير لوح يميل بمنظور ثلاثي (يصغر ويلف) وعنوان الفصل يطفو قدامه من اليمين، يثبت، ويرجع. قاعدة: نفس الحركة لكل فصل بالفيديو.
     o: {s, out (وقت الرجوع؛ افتراضي s+2.2), video, title='النقطة الثانية', num='2', dur=.6, rotY=-22, rotX=8, scale=.72} */
  FX.tilt3D = (ctx, t, o) => {
    const { X, P, E, at } = ctx, dur = o.dur || 0.6, out = o.out != null ? o.out : o.s + 2.2;
    const k = at(t, o.s, o.s + dur, 'expoInOut') * (1 - at(t, out, out + dur, 'expoInOut'));
    if (k <= 0.001) { if (o.video) o.video(X); return; }
    const ay = (o.rotY == null ? -22 : o.rotY) * k * Math.PI / 180, ax = (o.rotX == null ? 8 : o.rotX) * k * Math.PI / 180, sc = 1 - (1 - (o.scale || 0.72)) * k, cx = 540 - 70 * k, cy = 960 - 120 * k, D = 2600;
    const proj = (u, v) => { const px = (u - 540) * sc, py = (v - 960) * sc, x1 = px * Math.cos(ay), z1 = -px * Math.sin(ay), y2 = py * Math.cos(ax) - z1 * Math.sin(ax), z2 = py * Math.sin(ax) + z1 * Math.cos(ax), f = D / (D + z2); return [cx + x1 * f, cy + y2 * f]; };
    const dk = darker(P.ink, P.bg), bg = X.createLinearGradient(0, 0, 0, 1920); bg.addColorStop(0, P.bg); bg.addColorStop(1, lum(P.bg) > 128 ? rgba(dk, 0.18) : P.bg);
    X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920); X.save(); X.globalAlpha = k; X.fillStyle = bg; X.fillRect(0, 0, 1080, 1920); X.restore();
    const A = offC(X, 'tlA'); A.Y.save(); A.Y.beginPath(); A.Y.roundRect(0, 0, 1080, 1920, 40 * k / sc); A.Y.clip(); if (o.video) o.video(A.Y); A.Y.restore();
    const C = [proj(0, 0), proj(1080, 0), proj(1080, 1920), proj(0, 1920)];                                // ظل تحت اللوح
    X.save(); X.globalAlpha = 0.35 * k; X.shadowColor = 'rgba(0,0,0,.5)'; X.shadowBlur = 80; X.shadowOffsetY = 50; X.fillStyle = P.bg; X.beginPath(); C.forEach((p, i) => (i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]))); X.closePath(); X.fill(); X.restore();
    const m = X.getTransform(), gx = 9, gy = 16, s = m.a;
    for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const u0 = 1080 * i / gx, u1 = 1080 * (i + 1) / gx, v0 = 1920 * j / gy, v1 = 1920 * (j + 1) / gy, a = proj(u0, v0), b = proj(u1, v0), c = proj(u1, v1), d = proj(u0, v1);
      warpTri(X, A.c, [u0 * s, v0 * s, u1 * s, v0 * s, u1 * s, v1 * s], [...a, ...b, ...c]); warpTri(X, A.c, [u0 * s, v0 * s, u1 * s, v1 * s, u0 * s, v1 * s], [...a, ...c, ...d]); }
    // لمعة على حافة اللوح
    X.save(); X.globalAlpha = 0.5 * k; X.strokeStyle = 'rgba(255,255,255,.6)'; X.lineWidth = 2; X.beginPath(); X.moveTo(...C[0]); X.lineTo(...C[1]); X.stroke(); X.restore();
    // العنوان يطفو قدام
    const kt = at(t, o.s + 0.25, o.s + 0.85, 'expoOut') * (1 - at(t, out - 0.15, out + 0.3, 'expoIn')); if (kt > ON && o.title !== null) {
      const title = o.title || 'النقطة الثانية', num = o.num == null ? '2' : String(o.num), size = 104;
      X.save(); X.translate(620 * (1 - kt), 1360); X.rotate(-0.035); X.font = ctx.font('display', 400, size); const tw = Math.min(600, X.measureText(title).width), R = 915;   // حافة الكرت اليمين داخل المنطقة الآمنة
      shd(X, 60, 30, 0.3); X.fillStyle = P.bg; X.beginPath(); X.roundRect(R - tw - 210, -100, tw + 210, 190, 34); X.fill(); noShd(X);
      X.fillStyle = P.acc; X.beginPath(); X.roundRect(R - 130, -70, 106, 128, 26); X.fill(); ctx.text(X, num, R - 77, 30, { family: 'num', weight: 900, size: 88, color: P.onAcc || '#fff', dir: 'ltr' });
      ctx.text(X, title, R - 156, 30, { family: 'display', size, align: 'right', color: P.ink, maxWidth: 600 }); X.restore(); }
  };

  /* 72 الجزيرة تتمدد — حبّة سودا فوق تتمدد بسبرنق لكرت (أيقونة، سطرين، ورقم يعد)، ووراها زجاج من الفيديو، وترجع حبّة وتختفي. فوقها y=170 (برّا المنطقة الممنوعة).
     o: {s, out (افتراضي s+2.1), video, title='وصلك متابع جديد', sub='من ريل اليوم', value=1000 (رقم يعد؛ null بلا رقم), prefix='+', icon (صورة) | 'check'} */
  FX.dynamicIsland = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return; const out = o.out != null ? o.out : o.s + 2.1; if (t > out + 0.6) return;
    const sp = E.spring({ stiffness: 180, damping: 18 }), ke = sp(Math.max(0, t - o.s - 0.15)) * (t < out ? 1 : 1 - E.cubicInOut(pr(t, out, out + 0.35)));
    const appear = at(t, o.s, o.s + 0.15) * (1 - at(t, out + 0.35, out + 0.55)); if (appear <= 0) return;
    const w = lerp(220, 900, ke), h = lerp(64, 260, ke), r = lerp(32, 56, cl(ke)), x0 = 540 - w / 2, y0 = 170;
    X.save(); X.globalAlpha *= appear; shd(X, 50 * cl(ke), 20 * cl(ke), 0.35);
    X.fillStyle = '#0B0B0D'; X.beginPath(); X.roundRect(x0, y0, w, h, r); X.fill(); noShd(X);
    X.save(); X.beginPath(); X.roundRect(x0, y0, w, h, r); X.clip();
    if (o.video && ke > 0.05) { const S = FX._diS || (FX._diS = document.createElement('canvas')); S.width = 108; S.height = 192; const Y = S.getContext('2d'); Y.setTransform(0.1, 0, 0, 0.1, 0, 0); o.video(Y);
      X.globalAlpha *= 0.32 * cl(ke); X.imageSmoothingQuality = 'high'; X.drawImage(S, -20, -40, 1120, 2000); X.globalAlpha = appear; }
    const sh = X.createLinearGradient(0, y0, 0, y0 + h * 0.5); sh.addColorStop(0, 'rgba(255,255,255,.16)'); sh.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = sh; X.fillRect(x0, y0, w, h * 0.5);
    const kc = at(t, o.s + 0.3, o.s + 0.6, 'cubicOut') * (1 - at(t, out - 0.25, out, 'cubicIn'));
    if (kc > 0.01) { X.globalAlpha = appear * kc; const icx = x0 + w - 110, icy = y0 + h / 2;
      X.fillStyle = P.acc; X.beginPath(); X.arc(icx, icy, 62, 0, 6.2832); X.fill();
      if (o.icon && typeof o.icon === 'object') { X.save(); X.beginPath(); X.arc(icx, icy, 62, 0, 6.2832); X.clip(); X.drawImage(o.icon, icx - 62, icy - 62, 124, 124); X.restore(); }
      else { const kk = at(t, o.s + 0.45, o.s + 0.75, 'cubicOut'); ctx.drawPath(X, [[icx - 26, icy + 2], [icx - 6, icy + 22], [icx + 28, icy - 20]], kk, { color: P.onAcc || '#fff', width: 11, smooth: false }); }
      ctx.text(X, o.title || 'وصلك متابع جديد', icx - 96, icy - 8, { family: 'body', weight: 700, size: 44, align: 'right', color: '#FFFFFF', maxWidth: o.value === null ? 600 : 420 });
      ctx.text(X, o.sub || 'من ريل اليوم', icx - 96, icy + 50, { family: 'body', weight: 400, size: 34, align: 'right', color: 'rgba(255,255,255,.62)', maxWidth: o.value === null ? 600 : 420 });
      if (o.value !== null) { const v = o.value == null ? 1000 : +o.value, kn = E.cubicOut(pr(t, o.s + 0.35, o.s + 1.3));
        ctx.text(X, (o.prefix == null ? '+' : o.prefix) + ctx.num(Math.round(v * kn)), x0 + 60, icy + 28, { family: 'num', weight: 900, size: 78, align: 'left', color: P.acc, dir: 'ltr' }); } }
    X.restore(); X.restore();
  };

  /* 73 الحقيقة تنكشف — السطر مكتوب وكلمات مغطاة بأشرطة حبر خشنة؛ كل شريط ينكمش لليسار بوقت كلمته فتنكشف بلون الهوية، ومع آخر كشف ختم ينطبع برجّة.
     o: {text, s, hide:[رقم الكلمة], at:[وقت كشف كل كلمة مخفية] (wordTime)، step=.7, x=540, y=880, size=120, stamp='سري' (null بلا ختم), out} */
  FX.redact = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const ko = o.out != null ? at(t, o.out, o.out + 0.4, 'cubicIn') : 0; if (ko >= 1) return;
    const size = o.size || 120, x = pick(o, 'x', 540), y = pick(o, 'y', 880), hide = o.hide || [0], step = o.step || 0.7;
    const T = j => (o.at && o.at[j] != null ? o.at[j] : o.s + 0.9 + j * step), last = T(hide.length - 1) + 0.3;
    const L = ctx.text.layout(X, o.text, { family: 'display', size, maxWidth: o.maxWidth || 900, lineHeight: 1.3 });
    const kst = o.stamp === null ? 0 : at(t, last + 0.1, last + 0.35, 'backOut'), sk = o.stamp === null ? 0 : 3 * (1 - pr(t, last + 0.25, last + 0.5)) * (t > last + 0.25 ? 1 : 0) * Math.sin(t * 80);
    X.save(); X.globalAlpha *= 1 - ko; X.translate(sk, sk * 0.6);
    const kin = at(t, o.s, o.s + 0.4, 'cubicOut');
    const B = ctx.text.drawLayout(X, L, x, y, { perWord: i => ({ alpha: kin, dy: 24 * (1 - kin), color: hide.includes(i) ? P.acc : (o.color || P.ink) }) });
    hide.forEach((wi, j) => { const b = B.find(q => q.i === wi); if (!b) return; const kb = at(t, o.s + 0.05 + j * 0.06, o.s + 0.35 + j * 0.06, 'expoOut'), kr = E.expoInOut(pr(t, T(j), T(j) + 0.3)), w = (b.w + 36) * kb * (1 - kr); if (w < 4 || kr >= 0.995) return;
      const bx = b.x - 18, by = b.y + size * 0.12, bh = size * 1.0, rot = (h2(wi, 4) - 0.5) * 2 * Math.PI / 180;
      X.save(); X.translate(bx, by + bh / 2); X.rotate(rot); X.fillStyle = darker(P.ink, P.bg); X.beginPath(); const st = 14;
      X.moveTo(0, -bh / 2 + (h2(wi, 0) - 0.5) * 6); for (let xx = st; xx <= w; xx += st) X.lineTo(Math.min(xx, w), -bh / 2 + ctx.noise1(xx / 40, wi * 7) * 3);
      X.lineTo(w + ctx.noise1(1, wi) * 3, bh / 2); for (let xx = w - st; xx >= 0; xx -= st) X.lineTo(xx, bh / 2 + ctx.noise1(xx / 40, wi * 7 + 3) * 3); X.closePath(); X.fill(); X.restore(); });
    if (kst > ON) { const s = o.stamp || 'سري', ss = 1.6 - 0.6 * kst, b0 = B[0], sx = Math.max(230, Math.min(...B.map(q => q.x)) + 90), sy = Math.min(1500, Math.max(...B.map(q => q.base)) + size * 0.95);
      X.save(); X.translate(sx, sy); X.rotate(-8 * Math.PI / 180); X.scale(ss, ss); X.globalAlpha *= cl(kst * 2) * 0.92; X.font = ctx.font('display', 400, 110); const w = X.measureText(s).width + 90;
      X.strokeStyle = P.acc; X.lineWidth = 9; X.beginPath(); X.roundRect(-w / 2, -78, w, 146, 18); X.stroke(); X.lineWidth = 3; X.beginPath(); X.roundRect(-w / 2 + 13, -65, w - 26, 120, 11); X.stroke();
      ctx.text(X, s, 0, 32, { family: 'display', size: 110, color: P.acc });
      X.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 70; i++) { X.globalAlpha = 0.3; X.beginPath(); X.arc((h2(i, 1) - 0.5) * w, (h2(i, 2) - 0.5) * 140, 1 + 3 * h2(i, 3), 0, 6.2832); X.fill(); }
      X.restore(); }
    X.restore();
  };



  /* ═══ 75–87: توسعة البنك — الدفعة ب (17 أكتوبر) — نفس العقد: كل خاصية من t، الألوان من ctx.P، والكلمات العربية كاملة ═══
     الوجه (85 فقاعة، 86 كاميرا ثانية): o.face = MV.faceAt (دالة t→{x,y,w,h,mx,my} من face.js — scripts/36_facetrack.py، ماك) أو {x,y,w,h} ثابت أو [x,y] — بلاه مكان افتراضي. */
  const faceOf = (o, t, def) => {
    let f = typeof o.face === 'function' ? o.face(t) : o.face; if (!f) f = def; if (!f) return null;
    if (Array.isArray(f)) f = { x: f[0] - 150, y: f[1] - 185, w: 300, h: 370 };
    return { x: f.x, y: f.y, w: f.w, h: f.h, cx: f.x + f.w / 2, cy: f.y + f.h / 2, mx: f.mx != null ? f.mx : f.x + f.w / 2, my: f.my != null ? f.my : f.y + f.h * 0.78 };
  };
  const hexRGB = h => { const c = String(h || '#000').replace('#', ''), f = c.length === 3 ? c.split('').map(x => x + x).join('') : c; return [0, 2, 4].map(j => parseInt(f.slice(j, j + 2), 16)); };
  const mixC = (a, b, k) => { const A = hexRGB(a), B = hexRGB(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], cl(k)))).join(',')})`; };
  const lighter = (a, b) => (lum(a) >= lum(b) ? a : b);
  const MONO = (w, s) => `${w} ${s}px Menlo, "SF Mono", Consolas, "DejaVu Sans Mono", monospace`;
  const invEase = (f, v) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (f(m) < v) lo = m; else hi = m; } return (lo + hi) / 2; };
  // يرسم فيديو/فريم داخل مستطيل R (قصّ cover، الوجه على ثلث الطول) — draw = (Y)=>bool|void
  const fitIn = (X, R, rad, draw) => { X.save(); X.beginPath(); X.roundRect(R.x, R.y, R.w, R.h, rad || 0); X.clip();
    const sc = Math.max(R.w / 1080, R.h / 1920); X.translate(R.x + R.w / 2, R.y + R.h * 0.34); X.scale(sc, sc); X.translate(-540, -1920 * 0.34); draw(X); X.restore(); };
  const pill = (ctx, X, str, x, y, o) => { const size = o.size || 40; X.save(); X.font = ctx.font('body', 700, size); const w = Math.min(o.maxWidth || 400, X.measureText(str).width) + size * 1.1, h = size * 1.55;
    if (o.k != null) { X.translate(x, y); X.scale(o.k, o.k); X.translate(-x, -y); }
    shd(X, 24, 10, 0.25); X.fillStyle = o.bg; X.beginPath(); X.roundRect(x - w / 2, y - h / 2, w, h, h / 2); X.fill(); noShd(X);
    ctx.text(X, str, x, y + size * 0.36, { family: 'body', weight: 700, size, color: o.color, maxWidth: o.maxWidth || 400 }); X.restore(); };

  /* 75 نسخ مني — «فيه 3 أنواع ناس»: نسختين منك تطلع وراك يمين ويسار (أصغر وأغمق شوي) بفرق 0.12 ث مع ومضة تصفيقة، وعلى صدر كل نسخة ملصق. مع personAt النسخ متأخرة (0.2/0.4 ث) فتتحرك بإيقاع ثاني.
     يحتاج قصّ (ماك). بلاه: 3 كروت فيديو جنب بعض (videoAt = MV.frameAt للتأخير) والملصقات فوقها.
     o: {s, out, person, personAt:(Y,t)=>bool, video, videoAt:(Y,t)=>bool, labels:['يمين','النص','يسار'] (null بلا ملصقات), lag=[.2,.4], dx=300, scale=.78} */
  FX.cloneTrio = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) { if (o.video) o.video(X); return; }
    const ko = o.out != null ? at(t, o.out, o.out + 0.4, 'cubicIn') : 0; if (ko >= 1) { if (o.video) o.video(X); return; }
    const LB = o.labels === null ? null : (o.labels || ['المتردد', 'المتحمس', 'المنفّذ']), lag = o.lag || [0.2, 0.4], dx = o.dx || 300, sc = o.scale || 0.78, side = [1, -1];
    const kc = j => E.backOut(pr(t, o.s + 0.12 * j, o.s + 0.12 * j + 0.42)) * (1 - ko);
    const flash = j => { const p = pr(t, o.s + 0.12 * j, o.s + 0.12 * j + 0.12); return p > 0 && p < 1 ? 0.22 * (1 - p) : 0; };
    if (hasP(o)) {
      if (o.video) o.video(X);
      for (let j = 1; j >= 0; j--) { const k = kc(j); if (k <= ON) continue;
        const C = offC(X, 'ct' + j); C.Y.save(); placeP(C.Y, { x: side[j] * dx * k, s: lerp(0.94, sc, cl(k)) });
        if (!(typeof o.personAt === 'function' && o.personAt(C.Y, t - lag[j]))) o.person(C.Y); C.Y.restore();
        C.Y.save(); C.Y.setTransform(1, 0, 0, 1, 0, 0); C.Y.globalCompositeOperation = 'source-atop'; C.Y.fillStyle = 'rgba(0,0,0,.15)'; C.Y.fillRect(0, 0, C.c.width, C.c.height); C.Y.restore();
        X.save(); X.shadowColor = 'rgba(0,0,0,.28)'; X.shadowBlur = 40 * X.getTransform().a; putC(X, C.c, cl(k * 4)); X.restore();
        const bp = pr(t, o.s + 0.12 * j + 0.05, o.s + 0.12 * j + 0.4);                 // تصفيقة: خطوط تطلع من الكتف
        if (bp > 0 && bp < 1) { const cx = 540 + side[j] * dx, cy = 1920 - (1920 - 860) * sc; X.save(); X.strokeStyle = P.acc; X.lineCap = 'round'; X.lineWidth = 7 * (1 - bp) + 1; X.globalAlpha = 1 - bp;
          for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + side[j] * (0.2 + i * 0.26) - (side[j] < 0 ? 0 : 0), r0 = 190 + 120 * E.cubicOut(bp), r1 = r0 + 60 * (1 - bp) + 14;
            X.beginPath(); X.moveTo(cx + side[j] * Math.abs(Math.cos(a)) * r0 * 0.9, cy + Math.sin(a) * r0 * 0.9); X.lineTo(cx + side[j] * Math.abs(Math.cos(a)) * r1 * 0.9, cy + Math.sin(a) * r1 * 0.9); X.stroke(); } X.restore(); } }
      o.person(X);
      if (LB) [[0, 0], [1, -1], [2, 1]].forEach(([li, j]) => { const k = j < 0 ? at(t, o.s + 0.3, o.s + 0.6, 'backOut') * (1 - ko) : at(t, o.s + 0.12 * j + 0.2, o.s + 0.12 * j + 0.5, 'backOut') * (1 - ko); if (k <= ON || !LB[li]) return;
        pill(ctx, X, LB[li], j < 0 ? 540 : 540 + side[j] * dx, j < 0 ? 1500 : 1440, { bg: j < 0 ? P.acc : P.bg, color: j < 0 ? (P.onAcc || '#fff') : P.ink, size: 42, maxWidth: 150, k }); });
    } else {                                                                              // بديل: 3 كروت فيديو
      const k = ctx.E.expoInOut(pr(t, o.s, o.s + 0.6)) * (1 - ko), mid = lerpR(FULL, { x: 385, y: 600, w: 310, h: 551 }, k);
      X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920);
      for (let j = 1; j >= 0; j--) { const kj = E.backOut(pr(t, o.s + 0.45 + 0.12 * j, o.s + 0.87 + 0.12 * j)) * (1 - ko); if (kj <= ON) continue;
        const cx = 540 + side[j] * 330 * kj, R = { x: cx - 155 * cl(kj), y: 600 + 275 * (1 - cl(kj)), w: 310 * cl(kj), h: 551 * cl(kj) };
        X.save(); shd(X, 40, 16, 0.25); X.fillStyle = P.ink; X.beginPath(); X.roundRect(R.x, R.y, R.w, R.h, 36); X.fill(); noShd(X); X.restore();
        fitIn(X, R, 36, Y => { if (!(o.videoAt && o.videoAt(Y, t - lag[j])) && o.video) o.video(Y); }); }
      X.save(); if (k > 0.02) { shd(X, 60 * k, 24 * k, 0.3 * k); X.fillStyle = P.ink; X.beginPath(); X.roundRect(mid.x, mid.y, mid.w, mid.h, 36 * k); X.fill(); noShd(X); } X.restore();
      fitIn(X, mid, 36 * k, Y => { if (o.video) o.video(Y); });
      if (LB) [[0, 0], [1, -1], [2, 1]].forEach(([li, j]) => { const kk = at(t, o.s + 0.6 + 0.12 * (j + 1), o.s + 0.9 + 0.12 * (j + 1), 'backOut') * (1 - ko); if (kk <= ON || !LB[li]) return;
        pill(ctx, X, LB[li], j < 0 ? 540 : 540 + side[j] * 330, 520, { bg: j < 0 ? P.acc : P.ink, color: j < 0 ? (P.onAcc || '#fff') : P.bg, size: 36, maxWidth: 200, k: kk }); });
    }
    const fl = Math.max(flash(0), flash(1)); if (fl > 0) { X.fillStyle = 'rgba(255,255,255,' + fl + ')'; X.fillRect(0, 0, 1080, 1920); }
  };

  /* 76 ستارة نقاط القلم — انتقال: معيّنات مايلة 45° (شكل نقطة القلم العربي) تكبر من نقطة البداية وتنتشر لين تغطي الشاشة بالمشهد الجديد، وحوافها بلون الهوية تختفي.
     o: {s, A, B, from=[540,960] (مثلاً مكان آخر نقطة بكلمة)، cell=90, speed=1400 (px/ث), dur=.28 (عمر المعيّن)} */
  FX.nuqtaCurtain = (ctx, t, o) => {
    const { X, P, E } = ctx, c = o.cell || 90, sp = o.speed || 1400, d = o.dur || 0.28, org = o.from || [540, 960];
    if (t < o.s) { o.A(X); return; }
    const maxD = Math.max(...[[0, 0], [1080, 0], [0, 1920], [1080, 1920]].map(q => Math.hypot(q[0] - org[0], q[1] - org[1])));
    if (t >= o.s + maxD / sp + d) { o.B(X); return; }
    o.A(X);
    const R = Math.ceil(1150 / c) + 1, ca = Math.SQRT1_2, list = [];
    for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) {
      const u = i * c, v = j * c, x = 540 + (u - v) * ca, y = 960 + (u + v) * ca; if (x < -c || x > 1080 + c || y < -c || y > 1920 + c) continue;
      const t0 = o.s + Math.hypot(x - org[0], y - org[1]) / sp, k = E.cubicIn(pr(t, t0, t0 + d)); if (k <= 0) continue;
      list.push([x, y, 0.8 * c * k * Math.SQRT2, k]); }
    if (!list.length) return;
    const dia = ([x, y, h]) => { X.moveTo(x, y - h); X.lineTo(x + h, y); X.lineTo(x, y + h); X.lineTo(x - h, y); X.closePath(); };
    X.save(); X.beginPath(); list.forEach(dia); X.clip(); o.B(X); X.restore();
    X.save(); X.strokeStyle = P.acc; X.lineWidth = 2; X.lineJoin = 'round';
    list.forEach(q => { const a = 1 - cl((q[3] - 0.8) / 0.2); if (a <= 0) return; X.globalAlpha = a; X.beginPath(); dia(q); X.stroke(); }); X.restore();
  };

  /* 77 خريطة نقاط — «من الكويت للعالم»: خريطة نقاط تطلع دايرياً من الكويت، دبوس ينبض، وأقواس تطير للمدن بسن مضيء، وعند كل وصول عدّاد. اليابسة مضلّعات مبسّطة مضمّنة (بلا ملف خارجي).
     o: {s, out, title='من الكويت للعالم' (null بلا عنوان), cities:[{name, lon, lat, value, side:'l'|'r'|'t'|'b'}] (أكثر شي 6), total:{value, label} (null بلاه), y=600 (أعلى الخريطة), from=[47.98,29.37] (الكويت)} */
  const LAND = [
    // أوراسيا (من البرتغال شمال لسيبيريا، شرق آسيا، الهند، الخليج، الشام، تركيا، البلقان، إيطاليا، فرنسا، إسبانيا)
    [-9, 37, -9, 43, -1.5, 43.5, -1.2, 46, -4.5, 48.3, -1.5, 49.5, 2, 51, 4.5, 52.5, 8, 53.8, 8.5, 55.5, 10.3, 54.4, 14, 54, 19, 54.5, 21, 56.5, 21.8, 57.5, 24, 59.4, 29, 60, 28.5, 60.8, 30.5, 62, 32, 65, 34.5, 66.2, 38, 66.2, 41, 67, 44, 68.5, 53, 68.6, 60, 69, 66, 70, 70, 73, 80, 73.3, 87, 75, 100, 77.5, 108, 76.5, 113, 74, 120, 73, 130, 71.5, 140, 72.5, 155, 71, 155, 59, 143, 59.3, 138, 54, 141, 52.5, 140, 48, 135.3, 43.5, 131, 42.6, 129.5, 40.5, 129.4, 36.5, 126.5, 34.5, 126.3, 37.5, 125, 39.6, 122, 39.2, 121.5, 40.7, 119.3, 39.3, 118.6, 38, 120.5, 37.5, 122.5, 37, 119.5, 34.8, 121, 32, 122, 30, 121, 28, 119.5, 25.5, 116.5, 23, 113, 22.2, 110, 21.2, 108, 21.6, 106, 20, 106.5, 18, 109, 15, 109.2, 12, 106.5, 9.5, 104.8, 8.6, 103, 10.5, 101, 12.5, 100.5, 13.5, 100.2, 12, 99.5, 10, 100.3, 8, 101.5, 6.2, 103.4, 4, 104, 1.5, 103.5, 1.3, 101.3, 2.8, 100.3, 4.5, 98.3, 8, 98.5, 10, 98, 13, 97.6, 16.5, 94.5, 16, 94, 19, 92.3, 21, 91.5, 22.6, 90, 21.8, 88, 21.6, 86.5, 20, 84, 18, 82, 16.5, 80.2, 13.5, 79.8, 10, 77.5, 8, 76.5, 9.5, 75, 12.5, 73.5, 16, 72.8, 19, 72.6, 21.5, 70, 22.5, 68.5, 23.5, 67, 24.8, 64, 25.3, 61.5, 25.2, 58, 25.6, 57, 27, 54.5, 26.6, 52, 27.8, 50.5, 29.5, 49, 30.2, 48, 30, 47, 30, 44, 33, 39, 33, 36, 33.6, 35.6, 34.3, 36, 35.6, 36.2, 36.8, 34.5, 36.8, 32, 36.2, 29, 36.6, 27.3, 37.3, 26.3, 39.5, 26.5, 40.5, 26, 41, 24, 40.6, 23, 39.6, 23.4, 38.1, 22, 36.8, 21.3, 37.8, 20.2, 39.5, 19.5, 41.5, 18.5, 42.5, 16, 43.5, 14.2, 45.2, 13.5, 45.8, 12.3, 45.3, 12.5, 44, 14, 42, 16, 41.5, 18.5, 40.2, 17, 39, 16.5, 38, 15.7, 38, 16, 39.5, 15.5, 40.1, 14, 40.8, 12.5, 41.8, 10.5, 43, 8.8, 44.4, 7.5, 43.8, 5, 43.4, 3.2, 43.2, 3.2, 42, 0.8, 41, 0, 39.5, -0.5, 38.5, -2, 36.8, -5.5, 36, -6.5, 36.8, -7.5, 37.2],
    // أفريقيا
    [-6, 35.8, -2, 35.2, 3, 36.8, 10, 37.2, 11, 35.5, 10.5, 34, 12, 32.8, 15.2, 32.3, 19, 30.4, 20, 32, 25, 32, 29, 30.9, 32.3, 31.2, 34, 31.2, 34.5, 28, 33.5, 27.5, 35.5, 24, 37.2, 21, 38.5, 18, 39.5, 15.5, 41.5, 13.5, 43.3, 12.4, 44.5, 10.4, 51, 11.8, 51.2, 10.5, 49.5, 6.5, 47.5, 4.5, 44, 1, 41.5, -1.7, 39.5, -5, 39.3, -8, 40.5, -10.5, 40.6, -15, 36.5, -19, 35.5, -21.5, 35.5, -24, 32.8, -26, 32.5, -28.8, 30, -31.5, 27, -33.8, 22.5, -34, 20, -34.8, 18.4, -34, 18, -32, 15.5, -27, 14.5, -22.5, 11.8, -17, 12.3, -13, 13.4, -10.5, 12, -6, 9.5, -2, 9.3, 1, 9.6, 3.8, 8.5, 4.5, 6, 4.3, 3, 6.3, 0, 5.6, -2, 4.8, -4, 5.2, -7.5, 4.4, -10, 6.2, -12.5, 7.6, -13.3, 9.5, -15, 11, -16.8, 12.5, -17.4, 14.8, -16.5, 16.8, -16.2, 19.5, -17, 21, -16, 23.5, -14.5, 26.2, -12.9, 27.9, -9.8, 30, -9.5, 32.5, -8.5, 33.5, -6.8, 34.2],
    // جزيرة العرب
    [34.9, 29.5, 35, 28, 36.6, 25.5, 38, 23.8, 39.2, 21.5, 40.8, 19, 42.6, 15.8, 43.2, 13.2, 45, 12.8, 48.5, 14, 51.5, 15.3, 52.2, 16, 55.2, 17.2, 56.8, 18.5, 57.8, 19.8, 59.8, 22.4, 58.5, 23.7, 56.4, 24.9, 56.3, 26.2, 55.5, 25.5, 54, 24.1, 52, 24, 51.5, 25.8, 50.7, 25.4, 50.2, 26.6, 49.4, 27.3, 48.4, 28.5, 48, 29.8, 47.2, 30, 46, 32, 39, 32.5, 37, 33, 35.6, 33],
    // بريطانيا · أيرلندا · آيسلندا · إسكندنافيا · صقلية
    [-5.6, 50, 1.4, 51.2, 1.7, 52.8, 0.2, 53.5, -1.4, 55, -2, 56.8, -1.8, 57.6, -4, 58.6, -5, 58.6, -6.2, 57.3, -5.6, 56, -4.9, 54.9, -3.1, 54.8, -3.2, 53.4, -4.6, 53.3, -4.4, 52.2, -5.2, 51.7, -3, 51.4],
    [-6, 52, -6, 54, -7.4, 55.3, -10, 54.2, -10, 51.6, -8, 51.7],
    [-24, 64, -22.5, 66.4, -16, 66.5, -13.5, 65, -18.5, 63.4],
    [5, 58.2, 5, 62, 10, 64, 14, 68, 19, 70, 24, 71, 28.5, 71, 31, 70, 28.8, 66.5, 25.3, 65.6, 21.5, 64, 18, 62.5, 17.2, 60.6, 18.6, 59.4, 16.5, 56.5, 14.2, 55.4, 12.6, 56.2, 11.5, 58.4, 8, 58.1],
    [12.4, 38.1, 15.6, 38.3, 15.1, 36.7, 12.6, 37.6],
    // جزر الشرق: اليابان · تايوان · سريلانكا · سومطرة · جاوة · بورنيو · سولاويسي · الفلبين · غينيا
    [130.9, 34, 132, 35.4, 135, 35.7, 136.2, 36.8, 137.3, 37.2, 139, 38, 140, 40, 140, 41.5, 141.5, 41.4, 142, 39.5, 141, 38, 140.8, 36, 140.8, 35, 139.8, 35, 138.8, 34.6, 137, 34.6, 135, 33.6, 133, 34, 131, 33.8],
    [140, 42, 141.3, 45.3, 142.2, 45.4, 145.5, 43.3, 143.3, 42, 141, 41.8],
    [129.8, 33, 131, 34, 132, 33, 131.3, 31.3, 130.2, 31.2],
    [120.2, 23, 121, 25.2, 122, 25, 121, 22, 120.7, 22], [79.8, 8, 80, 9.8, 81, 8.5, 81.8, 7, 80.6, 6],
    [95.3, 5.6, 97.5, 5.2, 100, 2.5, 103.7, -0.9, 106, -3, 105.8, -5.8, 104.5, -5.9, 102.3, -4, 100.3, -1, 98.7, 1.7, 96, 4],
    [105.2, -6.8, 106.5, -6, 108.5, -6.6, 111, -6.4, 114.5, -7.7, 114.4, -8.6, 110, -8.1, 106.5, -7.4],
    [109, 1.5, 110, 1.8, 111.5, 2.8, 113, 3.2, 115.5, 5.3, 117, 7, 119.3, 5.3, 118, 4.3, 118.5, 1, 117.5, 0, 116.5, -2.5, 116, -3.8, 114.5, -3.5, 111.5, -3, 110.2, -2.9, 109, -0.5],
    [119.5, -5.5, 119, -3, 120, 0.8, 122, 1, 125, 1.5, 123, -0.8, 121.5, -1, 122, -4.5, 121, -5.5],
    [120, 16, 120.5, 18.5, 122.3, 18.5, 122, 16, 121.5, 14, 123.8, 13, 124, 12.5, 121, 13.8], [122, 7, 124, 8.4, 126.3, 9, 126.5, 6.3, 125.3, 5.6, 123.5, 7.7],
    [131, -1.3, 135, -3.3, 138, -1.5, 141, -2.6, 145.5, -5, 147.5, -6.5, 148, -8.6, 150, -10.5, 146, -8, 144, -7.7, 141, -9, 138.5, -8.3, 137.8, -5.2, 134, -4, 132, -2.9],
    // أستراليا · مدغشقر · قرينلاند · سفالبارد · نوفايا زيمليا
    [113.5, -22, 114, -26.5, 115, -31.5, 115, -34.3, 118, -35, 123.5, -34, 126, -32.3, 131, -31.5, 135, -34.7, 138, -35.5, 140, -38, 144, -38.3, 146.5, -39, 150, -37.5, 151.3, -33.8, 153.1, -30.5, 153.5, -28, 153, -25, 151, -23.5, 149.5, -22.4, 146.3, -19, 145.4, -15, 143.5, -14, 142.5, -10.7, 141.6, -13, 141.5, -16.7, 140.5, -17.6, 139, -17, 136.5, -15.5, 135.9, -13, 136.8, -12.2, 133, -11.3, 130.2, -12.4, 129.5, -14.8, 127.5, -14, 125, -14.6, 122.3, -17.2, 121, -19.6, 118.8, -20.3, 116, -20.8, 114.2, -21.8],
    [49.3, -12, 50.4, -15.5, 49.4, -17.5, 47.1, -24.9, 45, -25.5, 43.3, -22, 44.3, -20, 44, -17, 46.3, -15.8, 48, -13.5],
    [-22, 70.5, -18, 76.5, -12, 81.5, -30, 83.5, -45, 82.5, -60, 80, -55, 70, -45, 60, -40, 65, -25, 68.5],
    [11, 78.5, 15, 80, 27, 80, 22, 77.5, 16, 76.8], [52, 71.5, 55, 73.5, 58, 76, 68, 77, 61, 75.5, 57, 73, 56, 71, 53, 70.6],
  ];
  const WATER = [   // البحر الأسود · قزوين (يتشالون من اليابسة)
    [28, 41.5, 28, 43, 29.6, 45.2, 31.5, 46.6, 33.5, 46, 33, 44.6, 34.5, 44.4, 36, 45.3, 37.5, 44.7, 38.5, 46.5, 39.2, 47, 38, 47.5, 36, 46.5, 35, 45.5, 37.5, 44.7, 41.5, 42, 40, 41, 36, 41.7, 32, 41.8, 30, 41.2],
    [47, 44.5, 49, 46.5, 52.5, 47, 53.2, 45, 51, 44.5, 51.3, 43, 52.8, 41.5, 54, 40.5, 53.2, 37.3, 51, 36.7, 49, 37.5, 48.8, 38.5, 49.5, 40.3, 47.5, 42.5],
  ];
  const MAPV = { lon0: -22, lon1: 152, lat0: 76, lat1: -42 };
  const landDots = () => FX._ld || (FX._ld = (() => {
    const W = 348, H = 236, c = document.createElement('canvas'); c.width = W; c.height = H; const Y = c.getContext('2d', { willReadFrequently: true });
    const pt = (lo, la) => [(lo - MAPV.lon0) / (MAPV.lon1 - MAPV.lon0) * W, (MAPV.lat0 - la) / (MAPV.lat0 - MAPV.lat1) * H];
    const poly = a => { Y.beginPath(); for (let i = 0; i < a.length; i += 2) { const [x, y] = pt(a[i], a[i + 1]); i ? Y.lineTo(x, y) : Y.moveTo(x, y); } Y.closePath(); Y.fill(); };
    Y.fillStyle = '#000'; LAND.forEach(poly); Y.globalCompositeOperation = 'destination-out'; WATER.forEach(poly);
    const d = Y.getImageData(0, 0, W, H).data, mh = 1080 * (MAPV.lat0 - MAPV.lat1) / (MAPV.lon1 - MAPV.lon0), out = [];
    for (let y = 7; y < mh; y += 14) for (let x = 7; x < 1080; x += 14) { const sx = Math.floor(x / 1080 * W), sy = Math.floor(y / mh * H); if (d[(sy * W + sx) * 4 + 3] > 100) out.push([x, y]); }
    return { dots: out, h: mh };
  })());
  FX.dotMap = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const ko = o.out != null ? at(t, o.out, o.out + 0.45, 'cubicIn') : 0; if (ko >= 1) return;
    const LD = landDots(), y0 = pick(o, 'y', 600), from = o.from || [47.98, 29.37];
    const XY = (lo, la) => [(lo - MAPV.lon0) / (MAPV.lon1 - MAPV.lon0) * 1080, y0 + (MAPV.lat0 - la) / (MAPV.lat0 - MAPV.lat1) * LD.h];
    const K = XY(from[0], from[1]), C = (o.cities || [{ name: 'لندن', lon: -0.13, lat: 51.5, value: 1240, side: 't' }, { name: 'القاهرة', lon: 31.2, lat: 30.05, value: 3100, side: 'l' },
      { name: 'دبي', lon: 55.3, lat: 25.2, value: 5600, side: 'b' }, { name: 'مومباي', lon: 72.9, lat: 19.1, value: 870, side: 'r' }, { name: 'طوكيو', lon: 139.7, lat: 35.7, value: 420, side: 'b' }]).slice(0, 6);
    X.save(); X.globalAlpha *= 1 - ko; X.translate(0, -30 * ko);
    if (o.title !== null) { const kt = at(t, o.s, o.s + 0.5, 'expoOut'); ctx.text(X, o.title || 'من الكويت للعالم', 540, y0 - 120 + 30 * (1 - kt), { family: 'display', size: 96, color: P.ink, alpha: kt, maxWidth: 900 }); }
    X.fillStyle = P.mut;
    LD.dots.forEach(([x, y]) => { const yy = y + y0, dd = Math.hypot(x - K[0], yy - K[1]), k = E.backOut(pr(t, o.s + 0.15 + dd * 0.0006, o.s + 0.4 + dd * 0.0006)); if (k <= ON) return;
      X.globalAlpha = (1 - ko) * 0.55 * cl(k * 2); X.beginPath(); X.arc(x, yy, 4.2 * k, 0, 6.2832); X.fill(); });
    X.globalAlpha = 1 - ko;
    // الأقواس — ملصقات المدن تنحسب كلها أول (مكانها ثابت ولا تتراكب)
    const placed = [], fs = 34, boxes = C.map(c => { const p = XY(c.lon, c.lat), sd = c.side || 'r';
      X.save(); X.font = ctx.font('body', 700, fs); const nw = X.measureText(c.name).width; X.font = ctx.font('num', 800, fs); const vw = X.measureText(ctx.num(c.value || 0)).width; X.restore();
      const bw = nw + vw + 54, bh = 58; let bx = sd === 'l' ? p[0] - 22 - bw : sd === 'r' ? p[0] + 22 : p[0] - bw / 2, by = sd === 't' ? p[1] - 30 - bh : sd === 'b' ? p[1] + 30 : p[1] - bh / 2;
      bx = Math.max(30, Math.min(940 - bw, bx)); for (let g = 0; g < 4 && placed.some(q => bx < q[0] + q[2] + 8 && bx + bw + 8 > q[0] && by < q[1] + q[3] + 8 && by + bh + 8 > q[1]); g++) by += sd === 't' ? -(bh + 10) : bh + 10;
      placed.push([bx, by, bw, bh]); return { p, bx, by, bw, bh }; });
    C.forEach((c, i) => { const { p, bx, by, bw, bh } = boxes[i], dist = Math.hypot(p[0] - K[0], p[1] - K[1]), ts = o.s + 0.8 + i * 0.28, dur = 0.55 + dist * 0.0005;
      const mx = (p[0] + K[0]) / 2, my = (p[1] + K[1]) / 2 - 0.3 * dist, d = `M${K[0].toFixed(1)} ${K[1].toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`;
      const k = E.cubicInOut(pr(t, ts, ts + dur)); if (k <= 0) return;
      X.save(); X.globalAlpha *= 0.85; const tip = ctx.drawPath(X, d, k, { color: P.acc, width: 4, glow: 10 }); X.restore();
      if (tip && k < 1) { X.save(); X.shadowColor = P.acc; X.shadowBlur = 18; X.fillStyle = P.hi || P.acc; X.beginPath(); X.arc(tip[0], tip[1], 8, 0, 6.2832); X.fill(); X.restore(); }
      const ka = at(t, ts + dur, ts + dur + 0.35, 'backOut'); if (ka <= ON) return;
      X.fillStyle = P.acc; X.beginPath(); X.arc(p[0], p[1], 9 * ka, 0, 6.2832); X.fill();
      const rp = pr(t, ts + dur, ts + dur + 0.6); if (rp < 1) { X.save(); X.strokeStyle = P.acc; X.lineWidth = 3; X.globalAlpha *= 1 - rp; X.beginPath(); X.arc(p[0], p[1], 9 + 34 * rp, 0, 6.2832); X.stroke(); X.restore(); }
      const v = Math.round((c.value || 0) * E.cubicOut(pr(t, ts + dur, ts + dur + 0.7)));
      X.save(); X.translate(bx + bw / 2, by + bh / 2); X.scale(ka, ka); shd(X, 20, 8, 0.18); X.fillStyle = P.bg; X.beginPath(); X.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2); X.fill(); noShd(X);
      ctx.text(X, c.name, bw / 2 - 18, 12, { family: 'body', weight: 700, size: fs, align: 'right', color: P.ink });
      ctx.text(X, ctx.num(v), -bw / 2 + 18, 12, { family: 'num', weight: 800, size: fs, align: 'left', color: P.acc, dir: 'ltr' }); X.restore(); });
    // دبوس الكويت
    const kp = at(t, o.s + 0.1, o.s + 0.45, 'backOut'); if (kp > ON) {
      for (let r = 0; r < 2; r++) { const ph = ((t - o.s) / 1.3 + r * 0.5) % 1; X.save(); X.strokeStyle = P.acc; X.lineWidth = 4; X.globalAlpha *= (1 - ph) * cl(kp); X.beginPath(); X.arc(K[0], K[1], 12 + 50 * ph, 0, 6.2832); X.stroke(); X.restore(); }
      X.save(); X.translate(K[0], K[1]); X.scale(kp, kp); shd(X, 16, 6, 0.3); X.fillStyle = '#FFFFFF'; X.beginPath(); X.arc(0, 0, 15, 0, 6.2832); X.fill(); noShd(X); X.fillStyle = P.acc; X.beginPath(); X.arc(0, 0, 10, 0, 6.2832); X.fill(); X.restore(); }
    if (o.total !== null) { const tt = o.total || { value: 38, label: 'دولة تتابعك' }, tk = at(t, o.s + 1.2, o.s + 1.6, 'expoOut'), vy = y0 + LD.h + 150;
      if (tk > ON) { const v = Math.round(tt.value * E.cubicOut(pr(t, o.s + 1.2, o.s + 2.4))); X.save(); X.globalAlpha *= tk;
        X.font = ctx.font('body', 700, 56); const lw = X.measureText(tt.label).width; X.font = ctx.font('num', 900, 110); const vw = X.measureText(ctx.num(tt.value)).width, tw = lw + vw + 30, x1 = 540 + tw / 2;
        ctx.text(X, ctx.num(v), x1, vy, { family: 'num', weight: 900, size: 110, align: 'right', color: P.acc, dir: 'ltr' });
        ctx.text(X, tt.label, x1 - vw - 30, vy, { family: 'body', weight: 700, size: 56, align: 'right', color: P.ink }); X.restore(); } }
    X.restore();
  };

  /* 78 خط حولك — خط بلون الهوية يرتسم على حدودك (من فوق راسك وينتشر للجهتين)، وبعدين نقطة مضيئة تلف على الحدود مثل border beam. الحدود تنحسب كل فريم من القصّ (تتبّع حدود على نسخة 270×480).
     يحتاج قصّ (ماك). بلاه: الفيديو يصير كرت بزوايا دائرية والشعاع يلف على إطاره.
     o: {s, out, person, video, width=6, lap=1.6 (ثانية للفّة), color=P.acc} */
  const traceRim = draw => {
    const me = FX._rim || (FX._rim = { c: document.createElement('canvas') }), W = 270, H = 480, c = me.c; c.width = W; c.height = H;
    const Y = me.Y || (me.Y = c.getContext('2d', { willReadFrequently: true })); Y.setTransform(0.25, 0, 0, 0.25, 0, 0); draw(Y);
    const d = Y.getImageData(0, 0, W, H).data, N = W * H, cham = src => { const D = new Float32Array(N); for (let i = 0; i < N; i++) D[i] = src[i] ? 0 : 1e6;   // مسافة لأقرب بكسل «1»
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const i = y * W + x; if (!D[i]) continue; let v = D[i]; if (x) v = Math.min(v, D[i - 1] + 1); if (y) { v = Math.min(v, D[i - W] + 1); if (x) v = Math.min(v, D[i - W - 1] + 1.41); if (x < W - 1) v = Math.min(v, D[i - W + 1] + 1.41); } D[i] = v; }
      for (let y = H - 1; y >= 0; y--) for (let x = W - 1; x >= 0; x--) { const i = y * W + x; if (!D[i]) continue; let v = D[i]; if (x < W - 1) v = Math.min(v, D[i + 1] + 1); if (y < H - 1) { v = Math.min(v, D[i + W] + 1); if (x < W - 1) v = Math.min(v, D[i + W + 1] + 1.41); if (x) v = Math.min(v, D[i + W - 1] + 1.41); } D[i] = v; } return D; };
    // إغلاق (تمديد ثم تآكل 7px = 28 تصميم): يوصل الراس بالجسم ويسد الفتحات الصغيرة، فالخط يطلع حد ستيكر نظيف
    const fg = new Uint8Array(N); for (let i = 0; i < N; i++) fg[i] = d[i * 4 + 3] > 127 ? 1 : 0;
    const D1 = cham(fg), nd = new Uint8Array(N); for (let i = 0; i < N; i++) nd[i] = D1[i] <= 7 ? 0 : 1;
    const D2 = cham(nd), cls = new Uint8Array(N); for (let i = 0; i < N; i++) cls[i] = D2[i] > 7 || fg[i] ? 1 : 0;
    const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && cls[y * W + x] === 1;
    let sx = -1, sy = -1; for (let y = 0; y < H && sx < 0; y++) for (let x = 0; x < W; x++) if (on(x, y)) { sx = x; sy = y; break; }
    if (sx < 0) return null;
    const N8 = [[-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1]], pts = [[sx, sy]];
    let cx = sx, cy = sy, b = 0, guard = 0;                                   // تتبّع مور: نبدأ والجار الغربي فاضي
    while (guard++ < 20000) { let found = false;
      for (let i = 0; i < 8; i++) { const k = (b + i) % 8, nx = cx + N8[k][0], ny = cy + N8[k][1]; if (on(nx, ny)) { b = (k + 6) % 8; cx = nx; cy = ny; found = true; break; } }
      if (!found || (cx === sx && cy === sy)) break; pts.push([cx, cy]); }
    const n = pts.length, sm = pts.map((_, i) => { let ax = 0, ay = 0; for (let j = -3; j <= 3; j++) { const q = pts[(i + j + n) % n]; ax += q[0]; ay += q[1]; } return [(ax / 7 + 0.5) * 4, (ay / 7 + 0.5) * 4]; });
    return sm;
  };
  const rrPts = (R, r) => { const out = [], seg = (x0, y0, x1, y1) => { const L = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.round(L / 10)); for (let i = 0; i < n; i++) out.push([lerp(x0, x1, i / n), lerp(y0, y1, i / n)]); },
    arc = (cx, cy, a0) => { for (let i = 0; i < 12; i++) { const a = a0 + i / 12 * Math.PI / 2; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } };
    out.push([R.x + R.w / 2, R.y]); seg(R.x + R.w / 2, R.y, R.x + R.w - r, R.y); arc(R.x + R.w - r, R.y + r, -Math.PI / 2); seg(R.x + R.w, R.y + r, R.x + R.w, R.y + R.h - r); arc(R.x + R.w - r, R.y + R.h - r, 0);
    seg(R.x + R.w - r, R.y + R.h, R.x + r, R.y + R.h); arc(R.x + r, R.y + R.h - r, Math.PI / 2); seg(R.x, R.y + R.h - r, R.x, R.y + r); arc(R.x + r, R.y + r, Math.PI); seg(R.x + r, R.y, R.x + R.w / 2, R.y); return out; };
  FX.rimOutline = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) { if (o.video) o.video(X); return; }
    const ko = o.out != null ? at(t, o.out, o.out + 0.4, 'cubicIn') : 0, col = o.color || P.acc, wd = o.width || 6, lap = o.lap || 1.6, PM = hasP(o);
    let pts, kcard = 0;
    if (PM) { if (o.video) o.video(X); pts = traceRim(Y => o.person(Y)); }
    else { kcard = ctx.E.expoInOut(pr(t, o.s, o.s + 0.6)) * (1 - ko); const R = lerpR(FULL, { x: 150, y: 210, w: 780, h: 1387 }, kcard);
      X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920); X.save(); shd(X, 60 * kcard, 24 * kcard, 0.3 * kcard); X.fillStyle = P.ink; X.beginPath(); X.roundRect(R.x, R.y, R.w, R.h, 56 * kcard); X.fill(); noShd(X); X.restore();
      fitIn(X, R, 56 * kcard, Y => { if (o.video) o.video(Y); }); pts = kcard > 0.98 ? rrPts(R, 56) : null; }
    if (!pts || pts.length < 20 || ko >= 1) return;
    const n = pts.length, vis = i => pts[(i + n) % n][1] < 1900, t0 = PM ? o.s : o.s + 0.6, kd = E.cubicInOut(pr(t, t0, t0 + 0.5)), half = Math.floor(n / 2 * kd);
    const stroke = (i0, i1, w, a, c, blur) => { X.save(); X.strokeStyle = c; X.lineWidth = w; X.lineCap = 'round'; X.lineJoin = 'round'; X.globalAlpha *= a; if (blur) { X.shadowColor = col; X.shadowBlur = blur; }
      X.beginPath(); let pen = false; for (let i = i0; i <= i1; i++) { const q = pts[(i + n) % n]; if (!vis(i)) { pen = false; continue; } pen ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1]); pen = true; } X.stroke(); X.restore(); };
    X.save(); X.globalAlpha *= 1 - ko;
    if (half > 1) { stroke(-half, half, wd + 10, 0.25, col, 24); stroke(-half, half, wd, 1, col, 10); }
    const kb = at(t, t0 + 0.45, t0 + 0.7); if (kb > 0) {                                   // نقطة مضيئة تلف (ذيل مذنّب)
      const head = Math.floor(((t - t0 - 0.45) / lap % 1) * n), tail = Math.floor(n * 0.16);
      for (let j = 0; j < 8; j++) { const a = head - tail + Math.floor(tail * j / 8), b = head - tail + Math.floor(tail * (j + 1) / 8); stroke(a, b + 1, wd + 2, kb * (j + 1) / 8, P.hi || col, 16); }
      const q = pts[(head + n) % n]; if (vis(head)) { X.save(); X.globalAlpha *= kb; X.shadowColor = P.hi || col; X.shadowBlur = 30; X.fillStyle = '#FFFFFF'; X.beginPath(); X.arc(q[0], q[1], wd + 3, 0, 6.2832); X.fill(); X.restore(); } }
    X.restore();
  };

  /* 79 رافعة — «وهذا جزء من صورة أكبر»: الكاميرا تبدأ لاصقة بالفيديو (يملأ الشاشة)، وبعدين ترتفع وتميل 40° فوق طاولة فيها كروت حوله (شبكة 3×3)، وبالآخر تنزل على الكرت الجاي لين يصير الشاشة كلها.
     o: {s, at (وقت النزول؛ افتراضي s+2.1), A|video (الفيديو)، B (يرسم الكرت الجاي — بعد النزول ارسمه بنفسك), next=1 (رقم خانة الكرت الجاي), cards:[(Y)=>{} أو {label, icon, value}] (أكثر شي 8، صور ثابتة), tilt=40} */
  const CRANE_SLOTS = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  const craneCard = (ctx, c, i) => Y => { const P = ctx.P, fills = [P.acc, P.ink, P.bg, lighter(P.bg, P.ink)], bg = fills[i % 3], fg = bg === P.acc ? (P.onAcc || '#fff') : bg === P.ink ? P.bg : P.ink;
    Y.fillStyle = bg; Y.fillRect(0, 0, 1080, 1920); Y.save(); Y.globalAlpha = 0.12; Y.strokeStyle = fg; Y.lineWidth = 3; for (let k = 0; k < 6; k++) { Y.beginPath(); Y.arc(540, 820, 160 + k * 110, 0, 6.2832); Y.stroke(); } Y.restore();
    Y.save(); Y.translate(540, 760); Y.scale(5, 5); ICON(Y, c.icon || 'doc', fg, P.acc); Y.restore();
    ctx.text(Y, c.label || '', 540, 1180, { family: 'display', size: 170, color: fg, maxWidth: 900 });
    if (c.value != null) ctx.text(Y, String(c.value), 540, 1360, { family: 'num', weight: 800, size: 110, color: bg === P.acc ? fg : P.acc, dir: 'ltr' }); };
  FX.craneUp = (ctx, t, o) => {
    const { X, P, E } = ctx, A = o.A || o.video || (Y => { Y.fillStyle = P.ink; Y.fillRect(0, 0, 1080, 1920); }); if (t < o.s) { A(X); return; }
    const tat = o.at != null ? o.at : o.s + 2.1, k1 = E.expoInOut(pr(t, o.s, o.s + 1.2)), k2 = E.expoIn(pr(t, tat, tat + 0.5));
    if (k2 >= 1 && o.B) { o.B(X); return; }
    const CD = (o.cards || [{ label: 'الأفكار', icon: 'spark' }, { label: 'التصوير', icon: 'cal' }, { label: 'المونتاج', icon: 'folder' }, { label: 'النشر', icon: 'chat' },
      { label: 'الإيميل', icon: 'mail' }, { label: 'الأرقام', icon: 'sheet', value: '+12K' }, { label: 'السكربت', icon: 'doc' }, { label: 'الإعلان', icon: 'spark' }]).slice(0, 8);
    const nx = o.next == null ? 1 : o.next, GW = 1080 + 170, GH = 1920 + 170, dest = [CRANE_SLOTS[nx][0] * GW, CRANE_SLOTS[nx][1] * GH];
    const hold = pr(t, o.s + 1.2, tat), cx = lerp(0, dest[0], k2), cy = lerp(lerp(0, 360, k1), dest[1], k2), sc = lerp(lerp(1, 0.34, k1) * (1 - 0.04 * hold), 1, k2);
    const th = lerp((o.tilt == null ? 40 : o.tilt) * k1, 0, k2) * Math.PI / 180, ph = lerp(-7 * k1 - 3 * hold * k1, 0, k2) * Math.PI / 180, D = 2600, cph = Math.cos(ph), sph = Math.sin(ph);
    const proj = (u, v) => { const a = (u - cx) * cph - (v - cy) * sph, b = (u - cx) * sph + (v - cy) * cph, px = a * sc, py = b * sc, y2 = py * Math.cos(th), z = -py * Math.sin(th), f = D / (D + z); return [540 + px * f, 960 + y2 * f]; };
    X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920);
    const vg = X.createRadialGradient(540, 960, 200, 540, 960, 1300); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, rgba(darker(P.ink, P.bg), 0.18 * k1)); X.fillStyle = vg; X.fillRect(0, 0, 1080, 1920);
    const m = X.getTransform().a, cache = FX._crc || (FX._crc = new Map());
    const items = CD.map((c, i) => ({ i, slot: CRANE_SLOTS[i] })).concat([{ i: -1, slot: [0, 0] }]).sort((p, q) => p.slot[1] - q.slot[1]);
    items.forEach(it => {
      const u0 = it.slot[0] * GW - 540, v0 = it.slot[1] * GH - 960, C = [proj(u0, v0), proj(u0 + 1080, v0), proj(u0 + 1080, v0 + 1920), proj(u0, v0 + 1920)];
      if (C.every(p => p[0] < -50) || C.every(p => p[0] > 1130) || C.every(p => p[1] < -50) || C.every(p => p[1] > 1970)) return;
      let img, s, gx = 4, gy = 6;
      if (it.i < 0) { const V = offC(X, 'crA'); V.Y.save(); V.Y.beginPath(); V.Y.roundRect(0, 0, 1080, 1920, 60 * k1); V.Y.clip(); A(V.Y); V.Y.restore(); img = V.c; s = m; gx = 6; gy = 10; }
      else if (it.i === nx && o.B) { const V = offC(X, 'crB'); V.Y.save(); V.Y.beginPath(); V.Y.roundRect(0, 0, 1080, 1920, 60 * (1 - k2)); V.Y.clip(); o.B(V.Y); V.Y.restore(); img = V.c; s = m; gx = 6; gy = 10; }
      else { const key = it.i + '|' + P.bg + P.acc + P.ink + '|' + JSON.stringify(typeof CD[it.i] === 'function' ? it.i : CD[it.i]); img = cache.get(key);
        if (!img) { img = document.createElement('canvas'); img.width = 540; img.height = 960; const Y = img.getContext('2d'); Y.scale(0.5, 0.5); Y.beginPath(); Y.roundRect(0, 0, 1080, 1920, 60); Y.clip();
          (typeof CD[it.i] === 'function' ? CD[it.i] : craneCard(ctx, CD[it.i], it.i))(Y); if (cache.size > 40) cache.clear(); cache.set(key, img); } s = 0.5; }
      if (k1 > 0.02) { X.save(); X.globalAlpha = 0.35 * k1; X.shadowColor = 'rgba(0,0,0,.6)'; X.shadowBlur = 50; X.shadowOffsetY = 30; X.fillStyle = P.bg; X.beginPath(); C.forEach((p, i) => (i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]))); X.closePath(); X.fill(); X.restore(); }
      for (let j = 0; j < gy; j++) for (let i = 0; i < gx; i++) { const ua = 1080 * i / gx, ub = 1080 * (i + 1) / gx, va = 1920 * j / gy, vb = 1920 * (j + 1) / gy, a = proj(u0 + ua, v0 + va), b = proj(u0 + ub, v0 + va), c = proj(u0 + ub, v0 + vb), d = proj(u0 + ua, v0 + vb);
        warpTri(X, img, [ua * s, va * s, ub * s, va * s, ub * s, vb * s], [...a, ...b, ...c]); warpTri(X, img, [ua * s, va * s, ub * s, vb * s, ua * s, vb * s], [...a, ...c, ...d]); }
    });
  };

  /* 80 كلمة تذوب بكلمة — «من خوف ← لثقة»: الكلمة الأولى تتغبّش وتذوب والثانية تتكوّن من نفس السائل (عتبة ألفا على الغباش)، واللون يمشي من الحبر للهوية.
     o: {from='خوف', to='ثقة', s (دخول الأولى), at (وقت الكلمة الثانية — wordTime؛ الذوبان يبدأ قبلها بـ0.3)، dur=.8, x=540, y=1040, size=320, lead (سطر صغير فوق، اختياري), out} */
  FX.morphWord = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const ko = o.out != null ? at(t, o.out, o.out + 0.4, 'cubicIn') : 0; if (ko >= 1) return;
    const A = ctx.text.westernDigits(o.from || 'خوف'), B = ctx.text.westernDigits(o.to || 'ثقة'), x = pick(o, 'x', 540), y = pick(o, 'y', 1040), fnt = z => ctx.font('display', 400, z);
    const size = Math.min(fitSize(X, fnt, A, o.size || 320, 860), fitSize(X, fnt, B, o.size || 320, 860));
    const t0 = o.at != null ? o.at - 0.3 : o.s + 1.0, k = E.sineInOut(pr(t, t0, t0 + (o.dur || 0.8))), kin = at(t, o.s, o.s + 0.5, 'expoOut');
    X.save(); X.globalAlpha *= 1 - ko;
    if (o.lead) ctx.text(X, o.lead, x, y - size * 0.95, { family: 'body', weight: 700, size: 56, color: P.mut, alpha: kin });
    const crisp = (s, c) => { X.save(); const z = 0.9 + 0.1 * kin; X.translate(x, y - size * 0.3); X.scale(z, z); X.translate(-x, -(y - size * 0.3)); ctx.text(X, s, x, y, { family: 'display', size, color: c, alpha: kin }); X.restore(); };
    if (k <= 0) { crisp(A, o.color || P.ink); X.restore(); return; }
    if (k >= 1) { crisp(B, P.acc); X.restore(); return; }
    const m = X.getTransform().a, bw = 1000, bh = size * 1.7, W = Math.ceil(bw * m), H = Math.ceil(bh * m), by = bh * 0.66;
    const me = FX._mw || (FX._mw = { c: document.createElement('canvas'), s: document.createElement('canvas') }); if (me.c.width !== W || me.c.height !== H) { me.c.width = W; me.c.height = H; me.Y = null; }
    const Y = me.Y || (me.Y = me.c.getContext('2d', { willReadFrequently: true })); Y.setTransform(1, 0, 0, 1, 0, 0); Y.globalCompositeOperation = 'source-over'; Y.globalAlpha = 1; Y.clearRect(0, 0, W, H);
    const layer = (s, a, blur) => { if (a <= 0.003) return; const f = 1 / (1 + blur * m / 2.5), sw = Math.max(2, Math.ceil(W * f)), sh = Math.max(2, Math.ceil(H * f)), S = me.s; S.width = sw; S.height = sh; const Z = S.getContext('2d');
      Z.setTransform(m * f, 0, 0, m * f, 0, 0); Z.font = fnt(size); Z.direction = 'rtl'; Z.textAlign = 'center'; Z.fillStyle = '#000'; Z.fillText(s, bw / 2, by);
      Y.globalAlpha = a; Y.globalCompositeOperation = 'lighter'; Y.imageSmoothingEnabled = true; Y.imageSmoothingQuality = 'high'; Y.drawImage(S, 0, 0, sw, sh, 0, 0, W, H); };
    const bl = size * 0.13; layer(A, Math.pow(1 - k, 0.4), bl * Math.pow(k, 1.3)); layer(B, Math.pow(k, 0.4), bl * Math.pow(1 - k, 1.3));   // الغباش نسبة من المقاس (8px على 60px بالأصل)
    const im = Y.getImageData(0, 0, W, H), d = im.data; for (let i = 3; i < d.length; i += 4) { const v = (d[i] - 107) / 41; d[i] = v <= 0 ? 0 : v >= 1 ? 255 : Math.round(255 * v * v * (3 - 2 * v)); }
    Y.putImageData(im, 0, 0); Y.globalAlpha = 1; Y.globalCompositeOperation = 'source-in'; Y.fillStyle = mixC(o.color || P.ink, P.acc, k); Y.fillRect(0, 0, W, H);
    X.drawImage(me.c, x - bw / 2, y - by, bw, bh); X.restore();
  };

  /* 81 طرفية — نافذة ترمنال: الأمر ينكتب حرف حرف (28 حرف/ث) بمؤشر يومض، والناتج يتدفق، ودوّامة تحميل، وبعدها علامة صح. سطر التعليق العربي (يبدأ بـ#) ينكتب RTL.
     o: {s, out, cmd='claude "build a landing page"', lines:[...] (ناتج إنقليزي/أرقام), done='Done in 48s', note='# خلصت الصفحة بدقيقة' (null بلاه), title='zsh', y=960} */
  FX.terminalType = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const ko = o.out != null ? at(t, o.out, o.out + 0.35, 'cubicIn') : 0; if (ko >= 1) return;
    const cmd = o.cmd || 'claude "build a landing page"', L = o.lines || ['Reading 14 files...', 'Writing index.html', 'Writing styles.css', 'Running tests: 12 passed'], done = o.done || 'Done in 48s', note = o.note === undefined ? '# خلصت الصفحة بدقيقة' : o.note;
    const W = 920, fs = 34, lh = 62, x0 = 80, H = 72 + 46 + lh * (L.length + 2 + (note ? 1 : 0)) + 34, yc = pick(o, 'y', 960), y0 = yc - H / 2;
    const dk = darker(P.ink, P.bg), lt = lighter(P.ink, P.bg), kin = at(t, o.s, o.s + 0.45, 'cubicOut');
    const tc = o.s + 0.5, cps = 28, tEnter = tc + cmd.length / cps + 0.25, tl = i => tEnter + 0.12 + i * 0.07, tSpin = tl(L.length) + 0.05, tDone = tSpin + 0.6, tNote = tDone + 0.25;
    X.save(); X.globalAlpha *= kin * (1 - ko); X.translate(0, 30 * (1 - kin) + 20 * ko); if (kin < 0.98) X.filter = `blur(${(8 * (1 - kin)).toFixed(1)}px)`;
    shd(X, 70, 30, 0.35); X.fillStyle = dk; X.beginPath(); X.roundRect(x0, y0, W, H, 28); X.fill(); noShd(X);
    X.save(); X.beginPath(); X.roundRect(x0, y0, W, H, 28); X.clip(); X.fillStyle = 'rgba(255,255,255,.06)'; X.fillRect(x0, y0, W, 72); X.restore();
    [P.acc, P.hi || P.acc, P.mut].forEach((c, i) => { X.fillStyle = c; X.beginPath(); X.arc(x0 + 44 + i * 36, y0 + 36, 10, 0, 6.2832); X.fill(); });
    X.font = MONO(500, 24); X.fillStyle = rgba(P.mut, 0.9); X.textAlign = 'center'; X.direction = 'ltr'; X.fillText(o.title || 'zsh', x0 + W / 2, y0 + 44);
    const rowY = r => y0 + 72 + 46 + lh * r, lx = x0 + 44;
    X.textAlign = 'left'; X.font = MONO(600, fs);
    const typed = cmd.slice(0, Math.max(0, Math.min(cmd.length, Math.floor((t - tc) * cps)))); X.fillStyle = P.acc; X.fillText('$', lx, rowY(0)); const pw = X.measureText('$ ').width;
    X.fillStyle = lt; X.fillText(typed, lx + pw, rowY(0));
    const cx = lx + pw + X.measureText(typed).width + 4, typing = t < tEnter; if (typing ? true : t < tl(0) && Math.floor(t * 4) % 2 === 0) { X.fillStyle = P.acc; X.fillRect(cx, rowY(0) - fs * 0.85, fs * 0.55, fs * 1.08); }
    X.font = MONO(500, fs - 2);
    L.forEach((s, i) => { const k = at(t, tl(i), tl(i) + 0.12); if (k <= 0) return; X.globalAlpha = kin * (1 - ko) * k; X.fillStyle = rgba(lt, 0.72); X.fillText(s, lx + 6 * (1 - k), rowY(1 + i)); });
    X.globalAlpha = kin * (1 - ko);
    const rd = rowY(1 + L.length);
    if (t >= tSpin && t < tDone) { const a = (t - tSpin) * 9; X.strokeStyle = P.acc; X.lineWidth = 4; X.lineCap = 'round'; X.beginPath(); X.arc(lx + 14, rd - 11, 13, a, a + 4.2); X.stroke(); X.fillStyle = rgba(lt, 0.6); X.fillText('Working' + '...'.slice(0, 1 + Math.floor((t - tSpin) * 6) % 3), lx + 46, rd); }
    if (t >= tDone) { const kd = at(t, tDone, tDone + 0.25, 'backOut'); X.save(); X.translate(lx + 14, rd - 11); X.scale(kd, kd); X.fillStyle = P.acc; X.beginPath(); X.arc(0, 0, 17, 0, 6.2832); X.fill(); X.restore();
      ctx.drawPath(X, [[lx + 5, rd - 11], [lx + 12, rd - 4], [lx + 24, rd - 19]], at(t, tDone + 0.05, tDone + 0.25), { color: P.onAcc || '#fff', width: 5, smooth: false });
      X.font = MONO(700, fs); X.fillStyle = lt; X.fillText(done, lx + 46, rd); }
    if (note && t >= tNote) { ctx.text(X, ctx.text.typeSub(note, pr(t, tNote, tNote + 0.6)), x0 + W - 44, rowY(2 + L.length), { family: 'body', weight: 700, size: fs, align: 'right', color: P.mut, dir: 'rtl' }); }
    X.restore();
  };

  /* 82 عدسة زجاج — انتقال «فاخر» بروح iOS 26: عدسة زجاج تدخل من اليمين وتستقر بالنص، داخلها المشهد الجديد مكبّر بتشوّه برميلي ولمعة وهامش لوني، وبعدين تكبر لين تغطي الشاشة.
     o: {s, A, B, hold=.2, y=960, size=520} */
  FX.glassLens = (ctx, t, o) => {
    const { X, P, E } = ctx; if (t < o.s) { o.A(X); return; }
    const hold = o.hold == null ? 0.2 : o.hold, k1 = E.expoOut(pr(t, o.s, o.s + 0.45)), k2 = E.expoIn(pr(t, o.s + 0.45 + hold, o.s + 0.8 + hold));
    if (k2 >= 1) { o.B(X); return; }
    const sz = o.size || 520, cx = lerp(lerp(1300, 540, k1), 540, k2), cy = lerp(pick(o, 'y', 960), 960, k2), w = lerp(sz, 1500, k2), h = lerp(sz, 2600, k2), r = lerp(160, 260, k2), mag = lerp(1.15, 1, k2);
    o.A(X);
    const Bo = offC(X, 'glB'); o.B(Bo.Y);
    const rr = (Y, ins) => { Y.beginPath(); Y.roundRect(cx - w / 2 + ins, cy - h / 2 + ins, w - 2 * ins, h - 2 * ins, Math.max(4, r - ins)); };
    X.save(); shd(X, 70, 30, 0.32 * (1 - k2)); X.fillStyle = P.bg; rr(X, 0); X.fill(); noShd(X); X.restore();
    for (let i = 0; i < 6; i++) { const ins = i * Math.min(w, h) * 0.06 * (1 - k2); X.save(); rr(X, ins); X.clip(); zoomAt(X, [cx, cy], mag + 0.04 * i * (1 - k2)); X.drawImage(Bo.c, 0, 0, 1080, 1920); X.restore(); }
    const a = 1 - k2; if (a > 0.01) {
      X.save(); rr(X, 0); X.clip();
      const g = X.createRadialGradient(cx - w * 0.3, cy - h * 0.34, 0, cx - w * 0.3, cy - h * 0.34, w * 0.55); g.addColorStop(0, 'rgba(255,255,255,' + 0.3 * a + ')'); g.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = g; X.fillRect(cx - w / 2, cy - h / 2, w, h);
      X.strokeStyle = 'rgba(0,0,0,' + 0.14 * a + ')'; X.lineWidth = 16; rr(X, 0); X.stroke();
      X.strokeStyle = 'rgba(255,255,255,' + 0.5 * a + ')'; X.lineWidth = 6; X.lineCap = 'round'; X.beginPath(); X.arc(cx - w / 2 + r, cy - h / 2 + r, r - 16, Math.PI * 1.08, Math.PI * 1.42); X.stroke(); X.restore();
      X.save(); X.lineWidth = 3; X.globalAlpha = 0.25 * a; X.strokeStyle = P.acc; X.translate(-2, 0); rr(X, 0); X.stroke(); X.strokeStyle = P.hi || P.acc; X.translate(4, 0); rr(X, 0); X.stroke(); X.restore();
      X.save(); X.lineWidth = 2; X.strokeStyle = 'rgba(255,255,255,' + 0.5 * a + ')'; rr(X, 1); X.stroke(); X.restore(); }
  };

  /* 83 خط يرتسم — رسم بياني: المحاور والشبكة تطلع، الخط ينرسم بقلم مضيء والمساحة تحته تتعبّى وراه، أرقام المحور تعد، وعند القمة دبوس فيه رقم يعد. (تطوير MK.lineChart)
     o: {s, out, data=[200,…,10000], labels=[…] (تحت المحور), title='المتابعين', sub='من 200 لـ10 آلاف' (null بلاهم), fmt:(v)=>string, y=760 (أعلى الرسم)} */
  FX.lineChartDraw = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const ko = o.out != null ? at(t, o.out, o.out + 0.4, 'cubicIn') : 0; if (ko >= 1) return;
    const D = o.data || [200, 350, 600, 1100, 2400, 5200, 10000], LB = o.labels || ['مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر'], n = D.length;
    const fmt = o.fmt || (v => (v >= 1000 ? ctx.num(v / 1000, v % 1000 && v < 9950 ? 1 : 0) + 'K' : ctx.num(v)));
    const Lx = 170, Rx = 880, T = pick(o, 'y', 760), B = T + 580, mx = Math.max(...D), step = Math.pow(10, Math.floor(Math.log10(mx / 4))), top = Math.ceil(mx / 4 / step) * step * 4;
    const pts = D.map((v, i) => [Lx + (Rx - Lx) * i / (n - 1), B - (B - T) * v / top]);
    X.save(); X.globalAlpha *= 1 - ko; X.translate(0, 30 * ko);
    if (o.title !== null) { const kt = at(t, o.s, o.s + 0.45, 'expoOut'); ctx.text(X, o.title || 'المتابعين', Rx, T - 150 + 24 * (1 - kt), { family: 'display', size: 92, align: 'right', color: P.ink, alpha: kt });
      if (o.sub !== null) ctx.text(X, o.sub || 'من 200 لـ10 آلاف', Rx, T - 78 + 24 * (1 - kt), { family: 'body', weight: 700, size: 44, align: 'right', color: P.acc, alpha: at(t, o.s + 0.1, o.s + 0.55) }); }
    const kg = at(t, o.s, o.s + 0.25), kc = E.cubicOut(pr(t, o.s + 0.15, o.s + 1.45));
    X.save(); X.globalAlpha *= kg; X.strokeStyle = rgba(P.mut, 0.35); X.lineWidth = 2;
    for (let j = 0; j <= 4; j++) { const gy = B - (B - T) * j / 4; X.beginPath(); X.moveTo(Lx, gy); X.lineTo(Lx + (Rx - Lx) * kg, gy); X.stroke();
      ctx.text(X, fmt(Math.round(top * j / 4 * kc)), Lx - 22, gy + 11, { family: 'num', weight: 600, size: 30, align: 'right', color: P.mut, dir: 'ltr' }); }
    X.strokeStyle = rgba(P.ink, 0.6); X.lineWidth = 3; X.beginPath(); X.moveTo(Lx, B); X.lineTo(Rx, B); X.stroke();
    const every = n > 7 ? 2 : 1; LB.forEach((s, i) => { if (i % every || i >= n) return; ctx.text(X, s, pts[i][0], B + 54, { family: 'body', weight: 700, size: 28, color: P.mut, maxWidth: (Rx - Lx) / (n - 1) * every - 8 }); });
    X.restore();
    const ez = E.cubicInOut, kl = ez(pr(t, o.s + 0.25, o.s + 1.45)); if (kl > 0) {
      const info = ctx.pathInfo(pts), tip = info.at(kl * info.len);
      X.save(); X.beginPath(); X.rect(Lx - 10, T - 200, tip[0] - Lx + 10, B - T + 210); X.clip();
      const area = new Path2D(info.d + ` L${Rx} ${B} L${Lx} ${B} Z`), g = X.createLinearGradient(0, T, 0, B); g.addColorStop(0, rgba(P.acc, 0.35)); g.addColorStop(1, rgba(P.acc, 0)); X.fillStyle = g; X.fill(area); X.restore();
      ctx.drawPath(X, pts, kl, { color: P.acc, width: 9, glow: 18 });
      if (kl < 1) { X.save(); X.shadowColor = P.acc; X.shadowBlur = 20; X.fillStyle = P.acc; X.beginPath(); X.arc(tip[0], tip[1], 13, 0, 6.2832); X.fill(); X.fillStyle = '#FFFFFF'; X.beginPath(); X.arc(tip[0], tip[1], 6, 0, 6.2832); X.fill(); X.restore(); }
      const pi = D.indexOf(mx), pp = pts[pi], tp = o.s + 0.25 + 1.2 * invEase(ez, Math.min(0.999, Math.max(0, (pp[0] - Lx) / (Rx - Lx)))), kp = at(t, tp, tp + 0.4, 'backOut');
      if (kp > ON) { const v = Math.round(mx * E.cubicOut(pr(t, tp, tp + 0.8))), label = o.peak || fmt(v);
        X.save(); X.fillStyle = P.acc; X.beginPath(); X.arc(pp[0], pp[1], 12 * cl(kp), 0, 6.2832); X.fill(); X.fillStyle = '#fff'; X.beginPath(); X.arc(pp[0], pp[1], 5 * cl(kp), 0, 6.2832); X.fill();
        X.font = ctx.font('num', 900, 64); const bw = Math.max(X.measureText(fmt(mx)).width, X.measureText(label).width) + 60, bh = 96, bx = Math.max(Lx, Math.min(Rx + 40 - bw, pp[0] - bw / 2)), byy = pp[1] - 52 - bh;
        X.translate(pp[0], pp[1] - 30); X.scale(kp, kp); X.translate(-pp[0], -(pp[1] - 30)); shd(X, 30, 12, 0.25);
        X.fillStyle = P.acc; X.beginPath(); X.roundRect(bx, byy, bw, bh, 26); X.fill(); X.beginPath(); X.moveTo(pp[0] - 16, byy + bh - 1); X.lineTo(pp[0], byy + bh + 18); X.lineTo(pp[0] + 16, byy + bh - 1); X.fill(); noShd(X);
        ctx.text(X, label, bx + bw / 2, byy + 70, { family: 'num', weight: 900, size: 64, color: P.onAcc || '#fff', dir: 'ltr' }); X.restore(); } }
    X.restore();
  };

  /* 84 زخرفة تتفتح — زخرفة هندسية (شبكة مثمّنات ومربعات، وداخل كل مثمّن نجمة ثمانية) ترتسم من المركز لبرّا وتلف ببطء، وبعد 1.5 ث تهدأ لملمس خفيف 15%. آمنة ورا الآية (هندسة بلا كائنات).
     بالقصّ (ماك) تنحط ورا الشخص؛ بلاه فوق الفيديو. o: {s, out, video, person, at=[540,760] (المركز), cell=240, color=P.acc, settle=1.5, power=1} */
  const GIRIH = (() => { const R = 100 / Math.cos(Math.PI / 8), V = i => [R * Math.cos(Math.PI / 8 + i * Math.PI / 4), R * Math.sin(Math.PI / 8 + i * Math.PI / 4)].map(v => v.toFixed(2));
    let d = 'M' + V(0).join(' '); for (let i = 1; i <= 8; i++) d += ' L' + V(i % 8).join(' ');
    const Q = (a0) => { let q = ''; for (let i = 0; i <= 4; i++) { const a = a0 + i * Math.PI / 2; q += (i ? ' L' : 'M') + (100 * Math.cos(a)).toFixed(2) + ' ' + (100 * Math.sin(a)).toFixed(2); } return q; };
    return [d, Q(0) + ' ' + Q(Math.PI / 4)]; })();   // المثمّن + نجمة ثمانية (مربعين متراكبين، رؤوسها على منتصف أضلاع المثمّن) — شبكة مثمّنات ومربعات
  FX.girihBloom = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (o.video) o.video(X); if (t < o.s) return;
    const ko = o.out != null ? at(t, o.out, o.out + 0.6, 'cubicIn') : 0, PM = hasP(o);
    if (ko < 1) { const c = o.cell || 240, sc = c / 200, C = o.at || [540, 760], rot = 2 * (t - o.s) * Math.PI / 180, kf = E.sineInOut(pr(t, o.s + (o.settle || 1.5), o.s + (o.settle || 1.5) + 0.8));
      const al = lerp(0.5, 0.15, kf) * (1 - ko) * (o.power || 1), R = Math.ceil(1500 / c);
      X.save(); X.translate(C[0], C[1]); X.rotate(rot); X.globalAlpha *= al;
      for (let i = -R; i <= R; i++) for (let j = -R; j <= R; j++) { const u = i * c, v = j * c, dd = Math.hypot(u, v); if (dd > 1500) continue;
        const k = E.cubicOut(pr(t, o.s + dd * 0.0008, o.s + dd * 0.0008 + 0.6)); if (k <= 0) continue;
        X.save(); X.translate(u, v); X.scale(sc, sc); ctx.drawPath(X, GIRIH[0], k, { color: o.color || P.acc, width: 3 / sc, smooth: false }); ctx.drawPath(X, GIRIH[1], k, { color: o.color || P.acc, width: 3 / sc, smooth: false }); X.restore(); }
      X.restore(); }
    if (PM) o.person(X);
  };

  /* 85 فقاعة كلام — فقاعة كوميك تطلع فوق يسار فمك (من تتبع الوجه) وذيلها يأشر عليه، تكبر من رأس الذيل بنطّة، الكلام ينكتب داخلها كلمة كلمة، تنبض مع الإيقاع، وتطلع بفرقعة.
     o: {s, out, text='قلت بخاطري: خلاص', face (MV.faceAt | {x,y,w,h} | [x,y]) — بلاه الوجه (390,560,300×370) والفقاعة فوق يساره، line (أوقات الكلمات من الصوت), thought=false (ذيل دواير = «قلت بخاطري»), accent:[i], size=84} */
  FX.speechBubble = (ctx, t, o) => {
    const { X, P, E, at } = ctx; if (t < o.s) return;
    const out = o.out != null ? o.out : o.s + 2.6, ko = pr(t, out, out + 0.16); if (ko >= 1 && t > out + 0.5) return;
    const f = faceOf(o, o.s, { x: 390, y: 560, w: 300, h: 370 }), M = [f.mx, f.my], size = o.size || 84, str = o.text || 'قلت بخاطري: خلاص';
    const L = ctx.text.layout(X, str, { family: 'display', size, maxWidth: 640, lineHeight: 1.25 }), bw = Math.max(280, L.width + 120), bh = L.height + 100;
    // فوق يسار الوجه (بعيد عن أزرار اليمين) — ولو ما فيه مكان فوق، جنبه يسار
    let cx = f.cx - 150 - bw * 0.25, cy = f.y - 50 - bh / 2; if (cy - bh / 2 < 190) { cy = 190 + bh / 2; cx = Math.min(cx, f.x - 40 - bw / 2); }
    cx = Math.max(60 + bw / 2, Math.min(900 - bw / 2, cx)); cy = Math.min(1500 - bh / 2, cy);
    const dx = M[0] - cx, dy = M[1] - cy, dl = Math.hypot(dx, dy) || 1, ux = dx / dl, uy = dy / dl, edge = Math.min(bw / 2 / Math.max(0.01, Math.abs(ux)), bh / 2 / Math.max(0.01, Math.abs(uy))) - 34;
    const inF = (x, y) => ((x - f.cx) / (f.w * 0.56)) ** 2 + ((y - f.cy) / (f.h * 0.56)) ** 2 < 1;   // الذيل يوقف قبل الوجه
    let tl = edge + 40; while (tl < dl - 40 && !inF(cx + ux * tl, cy + uy * tl)) tl += 6; tl = Math.max(edge + 70, tl - 24);
    const tip = [cx + ux * tl, cy + uy * tl], base = [cx + ux * edge, cy + uy * edge], px = -uy, py = ux;
    const kin = E.backOut(pr(t, o.s, o.s + 0.25)), bp = ctx.beatPulse ? ctx.beatPulse(t) : Math.pow(Math.max(0, Math.sin((t - o.s) * Math.PI * 4)), 6) * 0.6, z = (ko > 0 ? 1 + 0.15 * ko : kin) * (1 + 0.025 * bp);
    X.save(); X.globalAlpha *= 1 - ko; X.translate(tip[0], tip[1]); X.scale(z, z); X.rotate(0.015 * Math.sin((t - o.s) * 5)); X.translate(-tip[0], -tip[1]);
    const body = () => { X.beginPath(); X.roundRect(cx - bw / 2, cy - bh / 2, bw, bh, Math.min(bh / 2, 70)); };
    const tail = () => { X.beginPath(); X.moveTo(base[0] + px * 36, base[1] + py * 36); X.quadraticCurveTo(lerp(base[0], tip[0], 0.6) + px * 12, lerp(base[1], tip[1], 0.6) + py * 12, tip[0], tip[1]);
      X.quadraticCurveTo(lerp(base[0], tip[0], 0.5) - px * 4, lerp(base[1], tip[1], 0.5) - py * 4, base[0] - px * 36, base[1] - py * 36); X.closePath(); };
    const dots = [[0.45, 26], [0.72, 17], [0.95, 10]].map(([q, r]) => [lerp(base[0] + ux * 30, tip[0], q), lerp(base[1] + uy * 30, tip[1], q), r]);
    shd(X, 30, 14, 0.22); X.fillStyle = P.bg; body(); X.fill(); noShd(X);
    X.lineWidth = 10; X.strokeStyle = P.ink; X.lineJoin = 'round'; X.fillStyle = P.bg;
    if (o.thought) dots.forEach(([xx, yy, r]) => { X.beginPath(); X.arc(xx, yy, r, 0, 6.2832); X.lineWidth = 6; X.stroke(); X.fill(); });
    else { tail(); X.stroke(); } X.lineWidth = 10; body(); X.stroke(); body(); X.fill(); if (!o.thought) { tail(); X.fill(); }
    ctx.text.drawLayout(X, L, cx, cy - L.height / 2 + size * 0.88, { perWord: i => { const w0 = o.line != null ? ctx.wordTime(o.line, i).s : o.s + 0.2 + i * 0.13, k = at(t, w0, w0 + 0.16, 'backOut');
      return { alpha: k > ON ? 1 : 0, scale: 0.7 + 0.3 * k, color: (o.accent || []).includes(i) ? P.acc : P.ink }; } });
    X.restore();
    const pp = pr(t, out, out + 0.35); if (pp > 0 && pp < 1) for (let i = 0; i < 3; i++) { const a = -2.4 + i * 0.9, d = 30 + 110 * E.cubicOut(pp); X.fillStyle = i === 1 ? P.acc : P.ink; X.globalAlpha = 1 - pp;
      X.beginPath(); X.arc(cx + Math.cos(a) * (bw / 2 + d - 40), cy + Math.sin(a) * (bh / 2 + d - 40), 12 * (1 - pp) + 3, 0, 6.2832); X.fill(); X.globalAlpha = 1; }
  };

  /* 86 كاميرا ثانية — أقوى ادعاء: قص مباشر (بلا تسهيل) لكروب ×1.35 والوجه على خط الثلث، يثبت لين آخر الجملة ويرجع بقص. ولو third: قص ثالث ×1.15 مزاح كأنها كاميرا ثالثة. داخل الكروب drift 2% عشان ما يموت.
     الوجه ثابت على أول فريم بكل لقطة (الكاميرا الحقيقية ما تلحق). o: {s, out (آخر الجملة), video|draw, face (MV.faceAt…) بلاه [540,700], zoom=1.35, third (وقت القص الثالث), z3=1.15, drift=.02}. الحد ×2. */
  FX.punchCut = (ctx, t, o) => {
    const { X } = ctx, V = o.draw || o.video; if (t < o.s || (o.out != null && t >= o.out)) { V(X); return; }
    const th = o.third != null && t >= o.third, seg = th ? o.third : o.s, segE = o.out != null ? o.out : seg + 2, z0 = Math.min(2, th ? (o.z3 || 1.15) : (o.zoom || 1.35));
    const f = faceOf(o, seg, [540, 700]), zz = z0 * (1 + (o.drift == null ? 0.02 : o.drift) * pr(t, seg, segE)), tg = th ? [430, 660] : [540, 640];
    const tx = cl(tg[0] - f.cx * zz, 1080 - 1080 * zz, 0), ty = cl(tg[1] - f.cy * zz, 1920 - 1920 * zz, 0);
    X.save(); X.translate(tx, ty); X.scale(zz, zz); V(X); X.restore();
  };

  /* 87 خط المسح — انتقال: خط مضيء ينزل من فوق لتحت، فوقه المشهد الجديد وتحته القديم (مجمّد لو Aat = MV.frameAt)، وتحت الخط شريط سلِت سكان: صف البكسل اللي عند الخط ممطوط ويبهت.
     o: {s, dur=.9, A, B, Aat:(Y,t)=>bool, band=60, hud=true (قراءة SCAN % يسار)} */
  FX.scanLine = (ctx, t, o) => {
    const { X, P, E } = ctx, k = E.cubicInOut(pr(t, o.s, o.s + (o.dur || 0.9))); if (k <= 0) { o.A(X); return; } if (k >= 1) { o.B(X); return; }
    const ly = 1920 * k, band = o.band || 60, m = X.getTransform().a;
    const Ao = offC(X, 'scA'); if (!(o.Aat && o.Aat(Ao.Y, o.s))) o.A(Ao.Y);
    X.save(); X.beginPath(); X.rect(0, 0, 1080, ly); X.clip(); o.B(X); X.restore();
    X.save(); X.beginPath(); X.rect(0, ly, 1080, 1920 - ly); X.clip(); X.drawImage(Ao.c, 0, 0, 1080, 1920);
    const S = offC(X, 'scS'); S.Y.save(); S.Y.setTransform(1, 0, 0, 1, 0, 0); S.Y.imageSmoothingEnabled = false; const ry = Math.min(Ao.c.height - 1, Math.floor(ly * m));
    S.Y.drawImage(Ao.c, 0, ry, Ao.c.width, 1, 0, 0, Ao.c.width, Math.ceil(band * m)); S.Y.globalCompositeOperation = 'destination-in'; const g = S.Y.createLinearGradient(0, 0, 0, band * m); g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(1, 'rgba(0,0,0,0)'); S.Y.fillStyle = g; S.Y.fillRect(0, 0, Ao.c.width, Math.ceil(band * m)); S.Y.restore();
    X.drawImage(S.c, 0, 0, S.c.width, Math.ceil(band * m), 0, ly, 1080, band); X.restore();
    const gl = X.createLinearGradient(0, ly - 40, 0, ly + 40); gl.addColorStop(0, rgba(P.acc, 0)); gl.addColorStop(0.5, rgba(P.acc, 0.35)); gl.addColorStop(1, rgba(P.acc, 0)); X.fillStyle = gl; X.fillRect(0, ly - 40, 1080, 80);
    X.save(); X.shadowColor = P.acc; X.shadowBlur = 30; X.fillStyle = P.acc; X.fillRect(0, ly - 2, 1080, 4); X.fillStyle = '#FFFFFF'; X.globalAlpha = 0.7; X.fillRect(0, ly - 0.75, 1080, 1.5); X.restore();
    if (o.hud !== false && ly > 190 && ly < 1600) { X.save(); X.fillStyle = P.acc; X.fillRect(40, ly - 52, 6, 34); ctx.text(X, 'SCAN ' + ctx.num(Math.round(k * 100)) + '%', 60, ly - 24, { family: 'num', weight: 700, size: 30, align: 'left', color: P.acc, dir: 'ltr' }); X.restore(); }
  };

  G.FX = FX;
})();
