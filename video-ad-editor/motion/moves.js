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

  G.FX = FX;
})();
