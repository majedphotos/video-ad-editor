/* ═══ beat-fx.js — مكتبة مؤثرات على النبضة (v1.1 · 28 سبتمبر 2026) ═══
   الفكرة (مرجع celina): المؤثر يضرب على النبضة أو على تغيير اللقطة، مو بتوقيت تقريبي.
   كل مؤثر = دالة نقية بالزمن: نفس (t, الحدث) = نفس الرسم دائماً → أي فريم ينرسم لحاله (استئناف/رسم جزئي آمن).

   ثلاث طرق للاستخدام:
   1) محرّك الكلام (compose.html) — بعد سكربت المحرّك:
        <script src="beat-fx.js"></script>
        <script>BFX.attach({beats:'beats.json', density:'mid'});</script>
      تسجّل نفسها بـSCENE_LIST: 'beatFxVideo' (طبقة الفيديو) + 'beatFxTop' (فوق الرسم، تحت الكابشن).
   2) المونتاج: node scripts/23_beatfx_render.js — يركّب المؤثرات على montage.mp4 وقطعاته على النبضة.
   3) أي كانفس (وضع الموشن أو صفحة تجربة):
        const ev = BFX.plan(beatsJson, {density:'mid', cuts:[...]});   // المصمّم الآلي
        BFX.apply(ctx, t, ev);                                        // بعد رسم الفريم
      أو مؤثر واحد على كل نبضة:  BFX.at(ctx, 'zoomPunch', t, beatsJson.beats, {k:0.8})

   الألوان: BFX.theme = {acc, clay, ink, bg, font} — وإلا تُقرأ من متغيرات المحرّك (ACC/CLAY/INK/BG/FONT).
   ⛔ لا لون ثابت من هوية أحد. بلا ثيم (مونتاج بلا theme.json) = وضع محايد: المسح أسود بحافة رمادية، الكلمة بيضاء
      بحد أسود، خطوط القليتش بيضاء، والتسريب ياخذ لونه من اللقطة نفسها — والمصمّم الآلي يشيل التسريب.
   الدليل: references/beat-fx.md */
(function (root) {
  'use strict';
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, k) => a + (b - a) * k;
  const eo = k => 1 - Math.pow(1 - cl(k, 0, 1), 3);
  const eio = k => { k = cl(k, 0, 1); return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; };
  const decay = (k, p) => Math.pow(1 - cl(k, 0, 1), p || 2);
  /* عشوائي ثابت بالبذرة — نفس الفريم يطلع نفس الشي كل مرة */
  function rng(seed) {
    let a = (Math.floor(seed * 9973) ^ 0x9E3779B9) >>> 0;
    return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }

  const BFX = {};
  BFX.FPS = 30;
  BFX.theme = null;
  BFX.history = null;          // [صورة/كانفس الفريم السابق، اللي قبله، …] — الريندرر يعبيها لمؤثر echo
  BFX.version = '1.1';

  /* ── الثيم: من BFX.theme أو من متغيرات المحرّك ── */
  /* ⛔ بلا ثيم ما فيه «لون افتراضي» من هوية أحد: محايد (أبيض/أسود) ونعلّم neutral=true */
  const NEUTRAL = { acc: '#FFFFFF', clay: '#9A9A9A', ink: '#111111', bg: '#000000' };
  function theme() {
    const T = BFX.theme || {};
    const g = name => { try { return ({ ACC: typeof ACC !== 'undefined' ? ACC : null, CLAY: typeof CLAY !== 'undefined' ? CLAY : null,
      INK: typeof INK !== 'undefined' ? INK : null, BG: typeof BG !== 'undefined' ? BG : null, FONT: typeof FONT !== 'undefined' ? FONT : null })[name] || null; } catch (e) { return null; } };
    const acc = T.acc || g('ACC');
    if (!acc) return Object.assign({ neutral: true, font: T.font || g('FONT') || 'Cairo' }, NEUTRAL);
    return { neutral: false, acc, clay: T.clay || g('CLAY') || acc, ink: T.ink || g('INK') || '#111111',
      bg: T.bg || g('BG') || '#000000', font: T.font || g('FONT') || 'Cairo' };
  }
  BFX.themeNow = theme;
  /* لون من اللقطة نفسها (للتسريب بالوضع المحايد): أكثر بكسل مشبّع ومضي بعد تصغير الكادر لـ12×12 */
  function footageColor(ctx, R) {
    try { const c = buf('fc', 12, 12), x = c.getContext('2d', { willReadFrequently: true });
      x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy'; x.drawImage(ctx.canvas, R.x, R.y, R.w, R.h, 0, 0, 12, 12);
      const d = x.getImageData(0, 0, 12, 12).data; let best = -1, col = [255, 236, 214];
      for (let i = 0; i < d.length; i += 4) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
        const sc = (mx - mn) / (mx + 1) * (mx / 255); if (sc > best) { best = sc; col = [d[i], d[i + 1], d[i + 2]]; } }
      const m = Math.max(col[0], col[1], col[2], 1), k = 255 / m;          /* نرفع الإضاءة ونخلي الصبغة */
      return '#' + col.map(v => Math.round(cl(v * k * 0.85 + 255 * 0.15, 0, 255)).toString(16).padStart(2, '0')).join('');
    } catch (e) { return '#FFECD6'; } }
  function hx(h) { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
  const rgba = (h, a) => { const c = hx(h); return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; };
  const mix = (h1, h2, k) => { const a = hx(h1), b = hx(h2); return '#' + a.map((v, i) => Math.round(lerp(v, b[i], k)).toString(16).padStart(2, '0')).join(''); };

  /* ── مخازن الكانفس (تنخلق مرة) ── */
  const BUF = {};
  function buf(name, w, h) {
    let c = BUF[name];
    if (!c) { c = BUF[name] = (typeof OffscreenCanvas !== 'undefined' && !root.document) ? new OffscreenCanvas(w, h) : root.document.createElement('canvas'); }
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    return c;
  }
  /* لقطة من المنطقة R قبل المؤثر */
  function snap(ctx, R) {
    const c = buf('snap', R.w, R.h), x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'copy'; x.globalAlpha = 1;
    x.drawImage(ctx.canvas, R.x, R.y, R.w, R.h, 0, 0, R.w, R.h);
    x.globalCompositeOperation = 'source-over';
    return c;
  }
  /* يرسم اللقطة داخل R بتحويل حول مركزها (مقصوصة بحدود R) */
  function redraw(ctx, S, R, o) {
    o = o || {};
    const s = o.s || 1, cx = R.x + R.w / 2 + (o.dx || 0), cy = R.y + R.h / 2 + (o.dy || 0);
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
    if (o.comp) ctx.globalCompositeOperation = o.comp;
    ctx.translate(cx, cy); if (o.rot) ctx.rotate(o.rot); ctx.scale(s * (o.sx || 1), s * (o.sy || 1));
    ctx.drawImage(S, -R.w / 2, -R.h / 2, R.w, R.h);
    ctx.restore();
  }
  /* قناة لونية وحدة من اللقطة (للتفكيك RGB) */
  function channel(S, R, rgb, name) {
    const c = buf('ch' + name, R.w, R.h), x = c.getContext('2d');
    x.setTransform(1, 0, 0, 1, 0, 0); x.globalAlpha = 1;
    x.globalCompositeOperation = 'copy'; x.drawImage(S, 0, 0);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = rgb; x.fillRect(0, 0, R.w, R.h);
    x.globalCompositeOperation = 'source-over';
    return c;
  }
  function splitDraw(ctx, S, R, d, dy) {
    const r = channel(S, R, '#FF0000', 'r'), g = channel(S, R, '#00FF00', 'g'), b = channel(S, R, '#0000FF', 'b');
    ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
    ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#000'; ctx.fillRect(R.x, R.y, R.w, R.h);
    ctx.globalCompositeOperation = 'lighter';
    /* كل قناة متمددة شوي (±d) عشان الحواف ما تطلع خطوط ملوّنة */
    const e = Math.abs(d) + Math.abs(dy || 0), W2 = R.w + 2 * e, H2 = R.h + 2 * e;
    ctx.drawImage(r, R.x - e - d, R.y - e - (dy || 0), W2, H2);
    ctx.drawImage(g, R.x - e, R.y - e, W2, H2);
    ctx.drawImage(b, R.x - e + d, R.y - e + (dy || 0), W2, H2);
    ctx.restore();
  }

  /* ════════════════════ المؤثرات ════════════════════
     كل مؤثر: {layer:'video'|'top', fam, dur, pre, label, draw(ctx, dt, ev, env)}
       dt  = الثواني من لحظة الضربة (سالب = قبلها، لمؤثرات الانتقال اللي تبدأ قبل القطع)
       ev  = {t, k (الشدة 0..1), dur, pre, seed, …معاملات}
       env = {R: المنطقة, W, H, S: لقطة المنطقة (طبقة الفيديو بس), fi: رقم الفريم من الضربة}
     الفريم الأقرب للضربة ياخذ dt=0 (الذروة) — الخطأ الأقصى نص فريم (17 ملّي بـ30 فريم). */
  const FX = BFX.FX = {};

  /* 🔍 زوم ضربة: يدخل فجأة ويرجع بنعومة */
  FX.zoomPunch = { layer: 'video', fam: 'zoom', dur: 0.32, label: 'زوم ضربة',
    draw(ctx, dt, ev, E) { const p = dt / ev.dur; if (dt < 0) return;
      const s = 1 + (ev.amt || 0.16) * ev.k * decay(p, 2.4);
      redraw(ctx, E.S, E.R, { s }); } };

  /* 📳 اهتزاز كاميرا: إزاحة + دوران خفيف يخمد */
  FX.shake = { layer: 'video', fam: 'shake', dur: 0.36, label: 'اهتزاز',
    draw(ctx, dt, ev, E) { if (dt < 0) return; const p = dt / ev.dur, a = (ev.amt || 38) * ev.k * decay(p, 1.6);
      const r = rng(ev.seed * 131 + E.fi * 17);
      const dx = (r() * 2 - 1) * a, dy = (r() * 2 - 1) * a * 0.7, rot = (r() * 2 - 1) * 0.018 * ev.k * decay(p, 1.6);
      const s = 1 + 2.4 * a / Math.min(E.R.w, E.R.h) + Math.abs(rot) * 1.2;   /* تكبير يخفي الحواف */
      redraw(ctx, E.S, E.R, { s, dx, dy, rot }); } };

  /* 🌈 تفكيك RGB: القنوات تنفصل وترجع */
  FX.rgbSplit = { layer: 'video', fam: 'color', dur: 0.26, label: 'تفكيك ألوان',
    draw(ctx, dt, ev, E) { if (dt < 0) return; const p = dt / ev.dur, d = (ev.amt || 30) * ev.k * decay(p, 1.5);
      if (d < 0.6) return; splitDraw(ctx, E.S, E.R, Math.round(d), Math.round(d * 0.25)); } };

  /* 📺 قليتش شرائح: شرائح أفقية تنزاح + تفكيك ألوان، يتغيّر كل فريمين */
  FX.glitch = { layer: 'video', fam: 'distort', dur: 0.24, label: 'قليتش',
    draw(ctx, dt, ev, E) { if (dt < 0) return; const p = dt / ev.dur, a = ev.k * decay(p, 1.2); if (a < 0.03) return;
      const R = E.R, r = rng(ev.seed * 71 + Math.floor(E.fi / 2) * 13);
      splitDraw(ctx, E.S, R, Math.round(14 * a), 0);
      const S2 = snap(ctx, R);                             /* نشرّح النسخة المفكّكة */
      const n = 5 + Math.floor(r() * 6);
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      for (let i = 0; i < n; i++) {
        const y = Math.floor(r() * R.h), h = Math.floor(10 + r() * 130 * a), off = Math.round((r() * 2 - 1) * 140 * a);
        ctx.drawImage(S2, 0, y, R.w, h, R.x + off, R.y + y, R.w, h);
        ctx.drawImage(S2, 0, y, R.w, h, R.x + off - Math.sign(off || 1) * R.w, R.y + y, R.w, h);   /* لفّ — بلا فراغ */
      }
      /* خطوط مسح رفيعة بلون التمييز */
      const T = theme(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 3; i++) { ctx.fillStyle = rgba(T.neutral ? '#FFFFFF' : T.acc, 0.35 * a); ctx.fillRect(R.x, R.y + Math.floor(r() * R.h), R.w, 2 + Math.floor(r() * 5)); }
      ctx.restore(); } };

  /* ⚡ ستروب: تناوب إضاءة/قلب كل فريم — ⛔ خطر على الحساسين للوميض، المصمّم الآلي ما يستخدمه إلا بـsafe:false */
  FX.strobe = { layer: 'video', fam: 'light', dur: 0.2, label: 'ستروب', flash: true,
    draw(ctx, dt, ev, E) { if (dt < 0) return; if (E.fi % 2) return; const R = E.R;
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      if ((E.fi / 2) % 2 === 0) { ctx.globalCompositeOperation = 'difference'; ctx.fillStyle = '#FFFFFF'; ctx.fillRect(R.x, R.y, R.w, R.h); }
      else { ctx.fillStyle = 'rgba(255,255,255,' + (0.75 * ev.k) + ')'; ctx.fillRect(R.x, R.y, R.w, R.h); }
      ctx.restore(); } };

  /* 💨 ويب-بان: قبل القطع الصورة تنسحب بضبابية اتجاهية، وبعده الجديدة تدخل من الجهة الثانية */
  FX.whip = { layer: 'video', fam: 'move', dur: 0.16, pre: 0.14, label: 'ويب بان', trans: true,
    draw(ctx, dt, ev, E) { const R = E.R, dir = ev.dir || 1;
      const m = dt < 0 ? eo((dt + ev.pre) / ev.pre) : 1 - eo(dt / ev.dur);
      if (m < 0.02) return;
      const off = (dt < 0 ? 1 : -1) * dir * m * R.w * 0.42 * ev.k, L = m * R.w * 0.22 * ev.k, N = 9;
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      ctx.fillStyle = '#000'; ctx.fillRect(R.x, R.y, R.w, R.h); ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 1 / N;
      for (let i = 0; i < N; i++) { const x = R.x + off + (i / (N - 1) - 0.5) * L * dir;
        ctx.drawImage(E.S, x, R.y); ctx.drawImage(E.S, x - Math.sign(off || dir) * R.w, R.y); }
      ctx.restore(); } };

  /* 👻 إيكو (إحساس تبطيء/تسريع): آثار الفريمات السابقة فوق الحالي. بلا تاريخ → أثر زوم شعاعي */
  FX.echo = { layer: 'video', fam: 'time', dur: 0.42, label: 'إيكو زمني',
    draw(ctx, dt, ev, E) { if (dt < 0) return; const p = dt / ev.dur, a = 0.62 * ev.k * decay(p, 1.3); if (a < 0.03) return;
      const R = E.R, H = BFX.history;
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      if (H && H.length) {
        H.forEach((im, j) => { if (!im) return; ctx.globalAlpha = a * Math.pow(0.62, j);
          ctx.drawImage(im, 0, 0, im.width || im.naturalWidth, im.height || im.naturalHeight, R.x, R.y, R.w, R.h); });
      } else {
        for (let j = 1; j <= 5; j++) { ctx.globalAlpha = a * Math.pow(0.6, j); const s = 1 + 0.028 * j * ev.k;
          ctx.save(); ctx.translate(R.x + R.w / 2, R.y + R.h / 2); ctx.scale(s, s); ctx.drawImage(E.S, -R.w / 2, -R.h / 2); ctx.restore(); }
      }
      ctx.restore(); } };

  /* 🔄 قلب ألوان خاطف: فريمان مقلوبة ثم ترجع */
  FX.invert = { layer: 'video', fam: 'color', dur: 0.11, label: 'قلب ألوان', flash: true,
    draw(ctx, dt, ev, E) { if (dt < 0) return; const R = E.R, fr = E.fi, a = fr < 2 ? 1 : 1 - (dt - 2 / BFX.FPS) / (ev.dur - 2 / BFX.FPS);
      if (a <= 0.02) return;
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      ctx.globalCompositeOperation = 'difference'; ctx.globalAlpha = cl(a, 0, 1); ctx.fillStyle = '#FFFFFF'; ctx.fillRect(R.x, R.y, R.w, R.h);
      ctx.restore(); } };

  /* ⚪ فلاش أبيض: ومضة تنطفي بسرعة (اللون قابل للتغيير: ev.color) */
  FX.flash = { layer: 'top', fam: 'light', dur: 0.2, label: 'فلاش', flash: true,
    draw(ctx, dt, ev, E) { if (dt < 0) return; const a = 0.92 * ev.k * decay(dt / ev.dur, 2.2); if (a < 0.02) return;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = ev.color || '#FFFFFF'; ctx.fillRect(E.R.x, E.R.y, E.R.w, E.R.h); ctx.restore(); } };

  /* 🎬 أشرطة سينما: تنزل وتطلع بضربة وتثبت لين آخر المدة */
  FX.letterbox = { layer: 'top', fam: 'frame', dur: 0.9, label: 'أشرطة سينما',
    draw(ctx, dt, ev, E) { if (dt < 0) return; const R = E.R;
      /* تضرب كاملة على فريم الضربة (مع تجاوز 25٪ يرتد) — مو تنزل بالتدريج بعدها */
      const slam = 1 + 0.25 * decay(dt / 0.12, 2);
      const outK = 1 - eio((dt - (ev.dur - 0.2)) / 0.2);
      const h = R.h * (ev.amt || 0.13) * lerp(0.7, 1, ev.k) * slam * (dt > ev.dur - 0.2 ? outK : 1);
      if (h < 1) return;
      ctx.save(); ctx.fillStyle = ev.color || '#000'; ctx.fillRect(R.x, R.y, R.w, h); ctx.fillRect(R.x, R.y + R.h - h, R.w, h); ctx.restore(); } };

  /* 🌅 تسريب ضوء: بقع دافية بلون التمييز تعبر الكادر (screen) */
  FX.leak = { layer: 'top', fam: 'light', dur: 0.9, label: 'تسريب ضوء',
    draw(ctx, dt, ev, E) { if (dt < 0) return; const p = dt / ev.dur, a = ev.k * (0.6 + 0.4 * eo(dt / 0.08)) * decay(p, 1.3); if (a < 0.02) return;   /* يوهج على الضربة ويخفت وهو يعبر */
      const T = theme(), R = E.R, r = rng(ev.seed * 37), dir = r() < 0.5 ? 1 : -1;
      const base = ev.color || (T.neutral ? footageColor(ctx, R) : T.acc);
      const cols = [base, mix(base, '#FFFFFF', 0.55), ev.color || T.neutral ? mix(base, '#000000', 0.2) : T.clay];
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip(); ctx.globalCompositeOperation = 'screen';
      for (let i = 0; i < 3; i++) {
        /* تبدأ داخل الكادر (يمين/يسار الثلث) فتوهج على فريم الضربة نفسه، ثم تعبر للجهة الثانية */
        const x = R.x + R.w * (dir > 0 ? lerp(0.12, 1.35, eo(p) - i * 0.1) : lerp(0.88, -0.35, eo(p) - i * 0.1));
        const y = R.y + R.h * (0.2 + 0.3 * i + 0.1 * r()), rad = R.w * (0.55 + 0.25 * r());
        const g = ctx.createRadialGradient(x, y, 0, x, y, rad);
        g.addColorStop(0, rgba(cols[i], a * 0.9)); g.addColorStop(0.45, rgba(cols[i], a * 0.35)); g.addColorStop(1, rgba(cols[i], 0));
        ctx.fillStyle = g; ctx.fillRect(R.x, R.y, R.w, R.h);
      }
      ctx.restore(); } };

  /* ⭕ مسح دائري: دائرة بلون التمييز تكبر وتغطي قبل القطع، وبعده تنفتح فتحة تكشف اللقطة الجديدة */
  FX.wipeCircle = { layer: 'top', fam: 'matte', dur: 0.24, pre: 0.18, label: 'مسح دائري', trans: true,
    draw(ctx, dt, ev, E) { const T = theme(), R = E.R, r = rng(ev.seed * 53);
      const cx = R.x + R.w * (0.3 + 0.4 * r()), cy = R.y + R.h * (0.35 + 0.3 * r());
      const maxR = Math.hypot(Math.max(cx - R.x, R.x + R.w - cx), Math.max(cy - R.y, R.y + R.h - cy)) + 4;
      const col = ev.color || (T.neutral ? T.ink : T.acc), ring = mix(col, '#FFFFFF', 0.35);
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      if (dt < 0) { const k = eio((dt + ev.pre) / ev.pre), rr = maxR * k;
        ctx.fillStyle = ring; ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx, cy, Math.max(0, rr * 0.86 - 6), 0, Math.PI * 2); ctx.fill(); }
      else { const f1 = 1 / BFX.FPS, k = eo((dt + f1) / (ev.dur + f1)), hole = maxR * k; if (k >= 1) { ctx.restore(); return; }   /* فريم الضربة فيه فتحة صغيرة من أوله — ما يطوّل اللون الصافي */
        ctx.fillStyle = col; ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h);
        if (hole > 0.5) { ctx.moveTo(cx + hole, cy); ctx.arc(cx, cy, hole, 0, Math.PI * 2, true); }   /* moveTo: بدونها يرتسم خط من زاوية المستطيل */
        ctx.fill('evenodd');
        if (hole > 0.5) { ctx.strokeStyle = ring; ctx.lineWidth = 14 * (1 - k) + 2; ctx.beginPath(); ctx.arc(cx, cy, hole, 0, Math.PI * 2); ctx.stroke(); } }
      ctx.restore(); } };

  /* ⧄ مسح مائل: شريط مائل بلونين يعبر الكادر، والقطع يصير تحته */
  FX.wipeDiag = { layer: 'top', fam: 'matte', dur: 0.2, pre: 0.16, label: 'مسح مائل', trans: true,
    draw(ctx, dt, ev, E) { const T = theme(), R = E.R, sl = R.h * 0.36, dir = ev.dir || 1;
      const col = ev.color || (T.neutral ? T.ink : T.acc), edge = T.neutral && !ev.color ? '#8A8A8A' : mix(col, T.ink, 0.35);
      /* الحافة الأمامية تمشي من خارج اليسار إلى خارج اليمين (أو العكس) */
      const span = R.w + sl * 2;
      let a0, a1;
      if (dt < 0) { const k = eio((dt + ev.pre) / ev.pre); a0 = -sl; a1 = -sl + span * k; }
      else { const f1 = 1 / BFX.FPS, k = eo((dt + f1) / (ev.dur + f1)); if (k >= 1) return; a0 = -sl + span * k; a1 = R.w + sl; }
      const poly = (x0, x1, c) => { ctx.fillStyle = c; ctx.beginPath();
        const X0 = dir > 0 ? R.x + x0 : R.x + R.w - x0, X1 = dir > 0 ? R.x + x1 : R.x + R.w - x1, s = dir > 0 ? sl : -sl;
        ctx.moveTo(X0 + s, R.y); ctx.lineTo(X1 + s, R.y); ctx.lineTo(X1 - s, R.y + R.h); ctx.lineTo(X0 - s, R.y + R.h); ctx.closePath(); ctx.fill(); };
      ctx.save(); ctx.beginPath(); ctx.rect(R.x, R.y, R.w, R.h); ctx.clip();
      poly(a0, a1, col);
      const eW = 26; if (dt < 0) poly(a1 - eW, a1, edge); else poly(a0, a0 + eW, edge);
      ctx.restore(); } };

  /* 🔠 كلمة تضرب: تنزل ضخمة وتخبط بمكانها مع رجّة (ev.text — عربي RTL)
     ⛔ ev.y الافتراضي 0.68 من الارتفاع: تحت الوجه وفوق أزرار انستقرام — لا ترفعها على الوجه (قاعدة: الكتابة ما تنحط على وجهه) */
  FX.textSlam = { layer: 'top', fam: 'text', dur: 0.6, label: 'كلمة تضرب',
    draw(ctx, dt, ev, E) { if (dt < 0 || !ev.text) return; const T = theme(), R = E.R, p = dt / ev.dur;
      const out = p > 0.8 ? 1 - (p - 0.8) / 0.2 : 1; if (out <= 0) return;
      let fs = ev.size || 190; ctx.save(); ctx.font = '900 ' + fs + 'px ' + (ev.font || T.font);
      while (ctx.measureText(ev.text).width > R.w * 0.84 && fs > 60) { fs -= 8; ctx.font = '900 ' + fs + 'px ' + (ev.font || T.font); }
      /* تبين من فريم الضربة نفسه وتنزل من حجم أكبر — بس بسقف: الكلمة كاملة داخل 92٪ من العرض حتى على فريم الضربة
         (قبل: ×1.9 ثابتة → الكلمة تطلع من الحافتين وما تنقرا فريمين) */
      const tw = ctx.measureText(ev.text).width + fs * 0.07, s0 = cl(R.w * 0.92 / Math.max(1, tw), 1, 1.45);
      const land = 0.09, k = cl(dt / land, 0, 1), sc = dt < land ? lerp(s0, 1, eo(k)) : 1 + 0.06 * decay((dt - land) / 0.25, 2);
      const r = rng(ev.seed * 19 + E.fi), jit = dt > land && dt < land + 0.14 ? (1 - (dt - land) / 0.14) * 12 * ev.k : 0;
      const cx = R.x + R.w / 2 + (r() * 2 - 1) * jit, cy = R.y + R.h * (ev.y || 0.68) + (r() * 2 - 1) * jit;
      ctx.globalAlpha = out * (0.75 + 0.25 * k); ctx.translate(cx, cy); ctx.scale(sc, sc);
      ctx.direction = 'rtl'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 30; ctx.shadowOffsetY = 10;
      ctx.lineJoin = 'round'; ctx.lineWidth = fs * 0.07; ctx.strokeStyle = ev.stroke || T.ink; ctx.strokeText(ev.text, 0, 0);
      ctx.shadowColor = 'transparent'; ctx.fillStyle = ev.color || (ev.style === 'white' || T.neutral ? '#FFFFFF' : T.acc); ctx.fillText(ev.text, 0, 0);
      ctx.restore(); } };

  /* ترتيب التطبيق داخل الطبقة: الزمن ← الحركة ← اللون ← الإضاءة */
  const ORDER = ['echo', 'whip', 'zoomPunch', 'shake', 'glitch', 'rgbSplit', 'invert', 'strobe', 'leak', 'flash', 'letterbox', 'wipeDiag', 'wipeCircle', 'textSlam'];
  BFX.names = Object.keys(FX);

  function norm(ev) {
    const f = FX[ev.fx]; if (!f) return null;
    if (ev.dur === undefined) ev.dur = f.dur; if (ev.pre === undefined) ev.pre = f.pre || 0;
    if (ev.k === undefined) ev.k = 0.8; if (ev.seed === undefined) ev.seed = Math.round(ev.t * 1000) % 100000 + 1;
    return ev;
  }
  /* الزمن من الضربة، مقرّب لأقرب فريم: الفريم الأقرب للضربة = الذروة */
  function since(t, ev) {
    const half = 0.5 / BFX.FPS; let dt = t - ev.t;
    if (dt < -ev.pre - half || dt > ev.dur) return null;
    if (dt < 0 && dt >= -half) dt = 0;
    if (dt < 0 && !ev.pre) return null;
    return dt;
  }
  BFX.since = since;

  /* يرسم طبقة وحدة ('video' أو 'top') لكل الأحداث الشغالة عند t */
  BFX.applyLayer = function (ctx, t, events, layer, o) {
    o = o || {}; const W = ctx.canvas.width, H = ctx.canvas.height;
    const R1 = typeof o.region === 'function' ? o.region(t) : o.region, R0 = R1 || { x: 0, y: 0, w: W, h: H };
    /* المحرّك يزيح طبقة الفيديو (videoShift: رجّة/طيحة الكلمة) بـtranslate قبل مشاهد الفيديو — المنطقة تمشي معه،
       وإلا اللقطة تنسخ شريط خلفية وتفوّت حافة الفيديو. (المنطقة الكاملة ما تنزاح: هي الكانفس كله) */
    let ox = 0, oy = 0;
    if (R1 && o.follow !== false && ctx.getTransform) { const m = ctx.getTransform(); ox = m.e || 0; oy = m.f || 0; }
    const R = { x: Math.round(R0.x + ox), y: Math.round(R0.y + oy), w: Math.round(R0.w), h: Math.round(R0.h) };
    if (R.w < 2 || R.h < 2) return 0;
    const act = [];
    for (const ev0 of events) { const f = FX[ev0.fx]; if (!f || f.layer !== layer) continue; const ev = norm(ev0); const dt = since(t, ev);
      if (dt !== null) act.push([ORDER.indexOf(ev.fx), ev, dt, f]); }
    if (!act.length) return 0;
    act.sort((a, b) => a[0] - b[0]);
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none';
    ctx.shadowColor = 'transparent';
    for (const [, ev, dt, f] of act) {
      const E = { R, W, H, fi: Math.max(0, Math.round(dt * BFX.FPS)) };
      if (layer === 'video') E.S = snap(ctx, R);
      ctx.save(); try { f.draw(ctx, dt, ev, E); } catch (e) { if (root.console) console.error('⚠️ beat-fx ' + ev.fx + ': ' + e.message); } ctx.restore();
    }
    ctx.restore();
    return act.length;
  };
  /* الطبقتين مرة وحدة — للكانفس العام (المونتاج/الموشن) */
  BFX.apply = function (ctx, t, events, o) { return BFX.applyLayer(ctx, t, events, 'video', o) + BFX.applyLayer(ctx, t, events, 'top', o); };

  /* مؤثر واحد على كل نبضة من قائمة — دالة نقية بـ(t, النبضات, المعاملات) */
  BFX.at = function (ctx, name, t, beats, params) {
    const f = FX[name]; if (!f) return 0; params = params || {};
    const dur = params.dur || f.dur, pre = params.pre !== undefined ? params.pre : (f.pre || 0), half = 0.5 / BFX.FPS;
    let hit = null;
    for (const b of beats) { if (t - b >= -pre - half && t - b <= dur) { hit = b; if (t - b >= -half) break; } }
    if (hit === null) return 0;
    return BFX.apply(ctx, t, [Object.assign({ t: hit, fx: name }, params)], params);
  };

  /* ════════════════════ المصمّم الآلي ════════════════════
     BFX.plan(beats, o) → [{t, fx, k, dur, pre, seed, text?, sfx}]  (+ .unusedWords = كلمات ما لقت مكان)
     o: density 'low'|'mid'|'high' · cuts:[ث] (قطعات المونتاج — انتقال على كل وحدة على النبضة) · words:[كلمات للضربة]
        start/end · avoid:[[من,إلى]] (نوافذ بلا مؤثرات: الهوك مثلاً) · safe (افتراضي true) · seed · pool:[أسماء مسموحة]
        style: 'clean' (زوم/هزة/فلاش بس — للكلام) | 'hype' (كل شي) — الافتراضي hype للمونتاج
        themed: فيه ثيم ألوان؟ (الافتراضي: يُكشف) — بلا ثيم التسريب ينشال من الاختيار الآلي
        loop: طول الفيديو — لو أطول من الأغنية والأغنية تتكرر (06b_master يكررها) النبضات تتكرر معها
     القواعد: لا نفس المؤثر مرتين ورا بعض · لا نفس العائلة ورا بعض بالضربات الكبيرة ·
              الشدة تمشي مع طاقة «القسم» (beats.energy — متوسط مازورة، مو كيك ضد سنير) ·
              الكلمات تنحجز لها ضربات أول (موزعة على المقطع) — ما تنبلع بصمت ·
              القطع اللي مو على نبضة/ضربة مسموعة ما ياخذ انتقال (ما نبرز قطعاً طايح برا الإيقاع) ·
              ⛔ safe: بلا ستروب، والومضات (فلاش/قلب/ستروب) ≤ 3 بأي ثانية (معيار WCAG 2.3.1) */
  BFX.loop = function (B, until) {
    const D = +B.duration || 0; if (!(D > 1) || !(until > D + 0.05)) return B;
    const out = Object.assign({}, B), n = Math.ceil(until / D);
    const rep = (arr, f) => { const r = []; for (let k = 0; k < n; k++) (arr || []).forEach(v => r.push(f(v, k * D))); return r; };
    const sh = (v, d) => +(v + d).toFixed(3);
    ['beats', 'accents', 'downbeats', 'drops', 'hits'].forEach(key => { out[key] = rep(B[key], sh); });
    ['energy', 'strength'].forEach(key => { out[key] = rep(B[key], v => v); });
    out.onsets = rep(B.onsets, (v, d) => [sh(v[0], d), v[1]]);
    out.looped = n; return out;
  };
  BFX.plan = function (B, o) {
    o = o || {}; const dens = o.density || 'mid', safe = o.safe !== false, style = o.style || 'hype';
    if (o.loop) B = BFX.loop(B, o.loop);
    const beats = (B.beats || []).slice(), E = B.energy || [];
    const accS = new Set((B.accents || []).map(x => Math.round(x * 1000)));
    const dropS = new Set((B.drops || []).map(x => Math.round(x * 1000)));
    const downS = new Set((B.downbeats || []).map(x => Math.round(x * 1000)));
    const P = B.bpm ? 60 / B.bpm : (beats.length > 1 ? (beats[beats.length - 1] - beats[0]) / (beats.length - 1) : 0.5);
    const start = o.start || 0, end = o.end === undefined ? Infinity : o.end;
    const avoid = o.avoid || [], inAvoid = t => avoid.some(a => t >= a[0] - 0.05 && t <= a[1]);
    const r = rng(o.seed || 7);
    const words = (o.words || []).filter(Boolean);
    const themed = o.themed === undefined ? !theme().neutral : !!o.themed;
    const cuts = (o.cuts || []).filter(c => c > start + 0.05 && c < end - 0.05);
    const near = (t, set, tol) => { for (const v of set) if (Math.abs(v / 1000 - t) <= tol) return true; return false; };
    const nearestI = t => { let j = -1, bd = 1e9; for (let i = 0; i < beats.length; i++) { const d = Math.abs(beats[i] - t); if (d < bd) { bd = d; j = i; } } return j; };
    const energyAt = t => { const j = nearestI(t); return j < 0 || E[j] === undefined ? 0.7 : E[j]; };
    const K = t => 0.35 + 0.65 * energyAt(t);
    const allow = n => !o.pool || o.pool.includes(n);
    const clean = style === 'clean';
    /* الكلمة (textSlam) ما تنختار عشوائي — لها حجز خاص تحت */
    const BIG = (clean ? ['zoomPunch', 'shake', 'flash', 'letterbox'] : ['zoomPunch', 'rgbSplit', 'glitch', 'shake', 'invert', 'letterbox', 'leak', 'flash', 'echo'])
      .filter(n => allow(n) && (themed || n !== 'leak'));
    /* ⛔ echo برّا انتقالات القطع: يرسم فريمات قبل القطع (اللقطة القديمة) فوق فريم القطع → القطع يبين متأخر فريمين */
    const TRANS = (clean ? ['zoomPunch', 'flash', 'whip'] : ['whip', 'wipeCircle', 'wipeDiag', 'flash', 'zoomPunch', 'glitch', 'rgbSplit']).filter(allow);
    const TR_LIGHT = ['zoomPunch', 'flash', 'rgbSplit', 'shake'].filter(allow);
    const SMALL = ['zoomPunch', 'shake'].filter(allow);
    const ev = [];
    let lastBig = null, lastFam = null, lastT = {};
    const fam = n => FX[n] ? FX[n].fam : '';
    const gap = { letterbox: 4.0, leak: 3.0, invert: 2.0, echo: 1.5, wipeCircle: 1.2, wipeDiag: 1.2 };
    /* prev = كل المؤثرات الكبيرة بالضربة اللي قبل (الانفجار/الكلمة فيهم أكثر من وحدة) — ولا وحدة منها تتكرر */
    function pick(pool, t, prev, strict) {
      prev = [].concat(prev || []);
      let c = pool.filter(n => !prev.includes(n) && (!strict || fam(n) !== lastFam) && !(gap[n] && lastT[n] !== undefined && t - lastT[n] < gap[n]));
      if (!c.length) c = pool.filter(n => !prev.includes(n));
      if (!c.length) return null;
      return c[Math.floor(r() * c.length)];
    }
    function push(t, fx, k, extra) {
      if (!FX[fx]) return; const e = Object.assign({ t: +t.toFixed(3), fx, k: +cl(k, 0.05, 1).toFixed(3), seed: ev.length * 7 + 11 }, extra || {});
      const f = FX[fx]; e.dur = e.dur || +(fx === 'letterbox' ? Math.max(0.6, Math.min(1.6, P * 2)) : fx === 'textSlam' ? Math.max(0.55, Math.min(0.9, P * 1.4)) : f.dur).toFixed(3);
      if (f.pre) e.pre = e.pre || f.pre;
      if (fx === 'whip' || fx === 'wipeDiag') e.dir = r() < 0.5 ? 1 : -1;
      e.sfx = ({ whip: 'whoosh', wipeCircle: 'whoosh', wipeDiag: 'whoosh', textSlam: 'thud', letterbox: 'thud', glitch: 'tap', rgbSplit: 'tap' })[fx] || (fx === 'zoomPunch' && k > 0.6 ? 'thud' : null);
      ev.push(e); lastT[fx] = t;
    }
    const cutSet = new Set(cuts.map(c => Math.round(c * 1000)));
    /* القطع «على الإيقاع» = قريب (±50 ملّي) من نبضة أو ضربة مسموعة */
    const rhythm = new Set([].concat(beats, B.hits || [], (B.onsets || []).map(x => x[0])).map(x => Math.round(x * 1000)));
    /* طور المازورة: mid ياخذ النبضة 1 و3 (الكيك غالباً)، مو زوجي/فردي من أول نبضة لقاها الكاشف */
    let ph = 0; for (let i = 0; i < beats.length; i++) if (downS.has(Math.round(beats[i] * 1000))) { ph = i; break; }
    /* خط زمني واحد مرتّب: القطعات + النبضات — الاختيار بالترتيب فقاعدة «لا تكرار ورا بعض» تشتغل عبر النوعين */
    const slots = cuts.map(c => ({ t: c, cut: true, i: nearestI(c) }));
    beats.forEach((b, i) => { if (!near(b, cutSet, 0.07)) slots.push({ t: b, i }); });
    slots.sort((a, b) => a.t - b.t);
    const live = slots.filter(sl => sl.t >= start && sl.t <= end && !inAvoid(sl.t));
    live.forEach(sl => { sl.acc = near(sl.t, accS, 0.07); sl.drop = near(sl.t, dropS, 0.07); sl.down = near(sl.t, downS, 0.07);
      sl.onBeat = !sl.cut || near(sl.t, rhythm, 0.05); });

    /* 🔠 حجز الكلمات أول: كل كلمة حول موضعها بالتوزيع المتساوي، على أقوى ضربة قريبة (ضربة قوية بلا قطع > قطع على ضربة > أول مازورة > نبضة) */
    const wordAt = new Map(), unused = [];
    if (words.length && allow('textSlam')) {
      const cand = live.filter(sl => !sl.drop && sl.onBeat);
      const minGap = Math.max(0.9, P * 1.6);
      const score = sl => (sl.acc && !sl.cut ? 4 : sl.acc ? 3 : sl.down ? 2 : sl.cut ? 1.5 : 1) + 0.5 * energyAt(sl.t);
      if (cand.length) {
        const t0 = cand[0].t, t1 = cand[cand.length - 1].t, seg = Math.max(0.5, (t1 - t0) / words.length);
        let prevT = -1e9;
        words.forEach((w, j) => {
          const target = t0 + (j + 0.5) * seg;
          const ok = cand.filter(sl => !wordAt.has(sl) && sl.t >= prevT + minGap);
          const win = ok.filter(sl => Math.abs(sl.t - target) <= seg * 0.5);
          const best = (win.length ? win : ok).reduce((b, sl) => { if (!b) return sl;
            const sb = score(b) - (win.length ? 0 : Math.abs(b.t - target)), ss = score(sl) - (win.length ? 0 : Math.abs(sl.t - target));
            return ss > sb || (ss === sb && Math.abs(sl.t - target) < Math.abs(b.t - target)) ? sl : b; }, null);
          if (best) { wordAt.set(best, w); prevT = best.t; } else unused.push(w);
        });
      } else unused.push(...words);
    } else if (words.length) unused.push(...words);

    for (const sl of live) {
      const t = sl.t, k = K(t), isAcc = sl.acc, isDrop = sl.drop;
      if (wordAt.has(sl)) {                   /* الكلمة + زوم خفيف = أقوى إحساس (وعلى القطع الزوم هو الانتقال) */
        push(t, 'textSlam', Math.max(0.7, k), { text: wordAt.get(sl) });
        /* الرفيق: زوم خفيف — إلا لو الضربة اللي قبل زوم (لا تكرار ورا بعض) فرجّة خفيفة */
        const comp = [].concat(lastBig || []).includes('zoomPunch') ? 'shake' : 'zoomPunch';
        if (allow(comp)) push(t, comp, k * (sl.cut ? 0.75 : 0.6), comp === 'shake' ? { amt: 26 } : {});
        lastBig = ['textSlam', comp]; lastFam = 'text'; continue;
      }
      if (isDrop && !clean) {                 /* الانفجار: أكبر لحظة — ثلاثة مع بعض */
        push(t, 'flash', 1.0); push(t, 'zoomPunch', 1.0, { amt: 0.22 }); push(t, safe ? 'rgbSplit' : 'strobe', 1.0);
        lastBig = ['flash', 'zoomPunch', 'rgbSplit', 'strobe']; lastFam = 'light'; continue;
      }
      if (sl.cut) {                            /* 1) انتقال على القطع */
        if (!sl.onBeat) continue;              /* قطع طايح برا الإيقاع: قطع حاف أحسن من مؤثر يبرزه */
        if (dens === 'low' && !isAcc) continue;
        /* على الضربة القوية: الأغلب انتقال حقيقي (ويب/مسح) — هو اللي يحس المشاهد إن القطع «على الإيقاع» */
        const real = TRANS.filter(n => FX[n].trans);
        const pool = isAcc || dens === 'high' ? (real.length && r() < 0.65 ? real : TRANS) : TR_LIGHT;
        const n = pick(pool, t, lastBig, false); if (!n) continue;
        push(t, n, isAcc ? k : k * 0.7); lastBig = n; lastFam = fam(n); continue;
      }
      if (isAcc) {                             /* 2) ضربة قوية */
        const n = pick(BIG, t, lastBig, true); if (!n) continue;
        push(t, n, k); lastBig = n; lastFam = fam(n);
        continue;
      }
      /* 3) نبضة عادية — خفيفة: high كل نبضة · mid النبضة 1 و3 بالمازورة · low ولا شي. تسكت بالأقسام الهادية */
      const i = sl.i, en = energyAt(t);
      const every = dens === 'high' ? 1 : dens === 'mid' ? 2 : 0;
      if (!every || (((i - ph) % every) + every) % every || en < 0.35 || !SMALL.length) continue;
      const n = SMALL[Math.floor((i - ph) / every + 1e4) % SMALL.length];
      push(t, n, (n === 'zoomPunch' ? 0.35 : 0.3) * k, n === 'zoomPunch' ? { amt: 0.1 } : { amt: 22 });
    }
    /* المؤثر اللي يطوّل (الإيكو/الزوم/…) ما يعبر القطع الجاي — ينقص لين قبله بفريم. الكلمة تعبر عادي (نص فوق اللقطة الجديدة) */
    const allCuts = cuts.slice().sort((a, b) => a - b);
    ev.forEach(e => { if (FX[e.fx].trans || e.fx === 'letterbox' || e.fx === 'leak' || e.fx === 'textSlam') return;
      const nx = allCuts.find(c => c > e.t + 0.05); if (nx !== undefined && e.t + e.dur > nx - 1 / BFX.FPS) e.dur = +Math.max(0.12, nx - e.t - 1 / BFX.FPS).toFixed(3); });
    ev.sort((a, b) => a.t - b.t);
    /* ⛔ سقف الومضات: ≤ 3 بأي ثانية (safe) — الزايد ينقلب زوم */
    if (safe) {
      const fl = ev.filter(e => FX[e.fx].flash);
      for (let i = 0; i < fl.length; i++) {
        const w = fl.filter(e => e !== fl[i] && e.fx !== 'zoomPunch' && Math.abs(e.t - fl[i].t) < 1.0 && e.t < fl[i].t);
        if (w.length >= 3) { fl[i].fx = 'zoomPunch'; fl[i].dur = FX.zoomPunch.dur; }
      }
      ev.forEach(e => { if (e.fx === 'strobe') { e.fx = 'rgbSplit'; e.dur = FX.rgbSplit.dur; } });
    }
    ev.unusedWords = unused;
    if (unused.length && root.console) console.warn('⚠️ beat-fx: ' + unused.length + ' كلمة ما لقت ضربة (' + unused.join('، ') + ') — قلّل الكلمات أو طوّل المقطع');
    return ev;
  };

  /* ════════════════════ ربط محرّك الكلام ════════════════════ */
  BFX.load = function (url) {
    try { const x = new XMLHttpRequest(); x.open('GET', url, false); x.overrideMimeType('application/json'); x.send(null);
      if (x.status === 0 || x.status === 200) return JSON.parse(x.responseText); } catch (e) { console.error('⚠️ beat-fx: ما قدرت أقرأ ' + url + ' — ' + e.message); }
    return null;
  };
  /* o: {beats:'beats.json'|{…}, events?:[…] أو 'beatfx.json' (من 23_beatfx_render.js --plan-only), density, style, cuts, words, avoid,
        region:'video'|'full', safe, loop?} */
  BFX.attach = function (o) {
    o = o || {};
    const B = typeof o.beats === 'string' ? BFX.load(o.beats) : o.beats;
    let evs = typeof o.events === 'string' ? BFX.load(o.events) : o.events;
    if (evs && evs.events) evs = evs.events;
    const planned = !evs;
    const mk = loop => { const e = BFX.plan(B, Object.assign({ style: 'clean' }, o, loop ? { loop } : {}));
      if (e.unusedWords && e.unusedWords.length) console.error('⚠️ beat-fx: كلمات ما لقت ضربة: ' + e.unusedWords.join('، '));
      return e; };
    if (!evs) { if (!B) { console.error('⚠️ beat-fx: ما فيه نبضات — شغّل scripts/beat.py على ملف الصوت'); return []; }
      evs = mk(o.loop); }
    BFX.events = evs;
    /* 06b_master يكرر الملف الصوتي لين آخر الفيديو (stream_loop) — النبضات لازم تتكرر معه.
       طول الفيديو (DUR) ينعرف بعد init()، فنعيد التخطيط مرة على أول فريم لو الفيديو أطول من الأغنية */
    let checked = !planned || !!o.loop;
    const cur = () => { if (!checked) { checked = true; const D = typeof DUR !== 'undefined' ? DUR : 0;
      if (D > (+B.duration || 1e9) + 0.05) { evs = mk(D); BFX.events = evs; } } return evs; };
    const regionFn = o.region === 'full' ? null : (t => (typeof vrect === 'function' ? vrect(t) : null));
    const ctx = () => (typeof X !== 'undefined' ? X : root.X);
    const vfn = t => BFX.applyLayer(ctx(), t, cur(), 'video', { region: regionFn });
    const tfn = t => BFX.applyLayer(ctx(), t, cur(), 'top', { region: o.topRegion === 'video' ? regionFn : null });
    vfn.layer = 'video'; root.beatFxVideo = vfn; root.beatFxTop = tfn;
    if (typeof SCENE_LIST !== 'undefined') {
      if (!SCENE_LIST.some(x => x[0] === 'beatFxVideo')) SCENE_LIST.push(['beatFxVideo', vfn, 'video']);
      if (!SCENE_LIST.some(x => x[0] === 'beatFxTop')) SCENE_LIST.push(['beatFxTop', tfn]);
    }
    return evs;
  };

  root.BFX = BFX;
  if (typeof module !== 'undefined' && module.exports) module.exports = BFX;
})(typeof window !== 'undefined' ? window : globalThis);
