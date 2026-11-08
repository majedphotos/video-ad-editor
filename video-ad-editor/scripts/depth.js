/* ═══ depth.js — 🎥 «العمق» (6.5 — من دليل «How I edited my captions reel with AI») ═══
   ترتيب الطبقات: الغرفة ← كلام ورا ← أنت (مقصوص) ← كلام قدام، وكاميرا افتراضية تتحرك بينهم حركة خفيفة:
   القريب يتحرك أكثر من البعيد (بارالاكس) فالكلام يبين مجسّم بين الغرفة وبينك.
   + الكلمة المضيئة تنوّر وجهك والمكان بلونها      DEPTH.word({…, glow:'#5AA2D2'})
   + لون الغرفة يتغيّر (قريب من لون غرفتك أو البراند — الحواف تذوب بلا هالة، ملاحظة ماجد)   DEPTH.room({…})
   + مربع ينرسم بالضبط على المعلومة (43_textbox.py) وصوت القلم معه                        DEPTH.box({…})
   كل حركة تسجّل صوتها بـMV.cue (قلم، تكّة، ضربة…) ← `node 04_render_frames.js <work> cues` ← 05_sfx.py

   يحتاج القصّ لفريمات اللقطة: node scripts/11_behind_text.js <work> person <من-إلى>   (بيريف نت تلقائياً — 44_matte.py)
   التحميل: compose.html ← <script src="depth.js"></script> بعد moves-compose.js (04_render_frames.js ينسخه لو ناقص)

   الاستخدام (بملف مشاهدك):
     DEPTH.shot({s:8.5, e:20.9, cam:[[8.5,1.00,0,0],[12.9,1.07,-14,0],[20.9,1.12,10,-6]]})   [ثانية, زوم, x, y]
     DEPTH.word({t:10.23, e:11.4, text:'رقم واحد', at:'back', x:540, y:430, size:170})
     DEPTH.word({t:12.24, e:12.85, text:'كم واط؟', at:'back', x:540, y:400, size:180, glow:'#5AA2D2'})
     DEPTH.room({s:12.2, e:12.9, tint:'auto', amt:0.6})          'auto' = لون غرفتك (depth.json من 44_matte.py) أو acc الثيم
     DEPTH.layer('back', (t, Y, L) => { … })                     رسمك الخاص بطبقة بنفس تحويل الكاميرا (L.s = مقياسها)
     DEPTH.box({s:23.5, e:25.2, quad:t=>TB.at('wh',t), pad:10, color:'#fff'})
   الطبقات: at:'back' = ورا راسك (جسمك يغطيها) · at:'front' = قدامك.
   ⛔ القاعدة: كلمة قدام ما تنكتب على الوجه (y فوق الراس أو تحت الذقن) — والقصّ يغطي ورا بس. */
(function () {
  const G = window, W = 1080, H = 1920;
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), pr = (t, a, b) => (b <= a ? (t >= b ? 1 : 0) : cl((t - a) / (b - a)));
  const eo = k => 1 - Math.pow(1 - k, 3), eio = k => k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2, ss = k => k * k * (3 - 2 * k);
  const SHOTS = [], WORDS = [], ROOMS = [], BOXES = [], LAYERS = { room: [], back: [], front: [] };
  /* كم تتحرك كل طبقة مع الكاميرا نسبةً لك (أنت = 1). الغرفة أقل، والكلام القدّامي أكثر.
     فرق الغرفة عنك صغير عمداً (≤3٪ زوم): القصّ يكبر حولك فيغطي مكانك الأصلي بالغرفة — بلا ظل منك */
  const DF = { room: 0.72, back: 0.86, person: 1, front: 1.55 };
  const hex = c => { c = String(c || '#ffffff').replace('#', ''); if (c.length === 3) c = c.split('').map(x => x + x).join(''); const n = parseInt(c, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const rgba = (c, a) => { const [r, g, b] = hex(c); return 'rgba(' + r + ',' + g + ',' + b + ',' + cl(a) + ')'; };
  const AR = () => '"' + (typeof FONT === 'string' ? FONT : 'Cairo') + '", sans-serif';
  const CV = (() => { const m = {}; return k => { if (!m[k]) { const c = document.createElement('canvas'); c.width = W; c.height = H; m[k] = c; } const c = m[k], y = c.getContext('2d'); y.setTransform(1, 0, 0, 1, 0, 0); y.globalAlpha = 1; y.globalCompositeOperation = 'source-over'; y.filter = 'none'; y.clearRect(0, 0, W, H); return [c, y]; }; })();
  const cue = (k, t, o) => { if (G.MV && MV.cue) MV.cue(k, t, o); };

  /* ── الكاميرا ── */
  function camAt(sh, t) {
    const K = sh.cam; if (!K || !K.length) return { z: 1, x: 0, y: 0 };
    if (t <= K[0][0]) return { z: K[0][1], x: K[0][2] || 0, y: K[0][3] || 0 };
    for (let i = 1; i < K.length; i++) if (t <= K[i][0]) {
      const a = K[i - 1], b = K[i], k = (sh.ease || ss)(pr(t, a[0], b[0]));
      return { z: a[1] + (b[1] - a[1]) * k, x: (a[2] || 0) + ((b[2] || 0) - (a[2] || 0)) * k, y: (a[3] || 0) + ((b[3] || 0) - (a[3] || 0)) * k };
    }
    const z = K[K.length - 1]; return { z: z[1], x: z[2] || 0, y: z[3] || 0 };
  }
  function focusOf(sh, t) {
    if (sh.focus) return sh.focus;
    const F = (typeof BEHIND !== 'undefined' && BEHIND && BEHIND.faces) || {};
    if (!sh._f) {   // وسط وجهك (وسيط اللقطة — ثابت، بلا رجفة)
      const xs = [], ys = []; for (let f = Math.floor(sh.s * 30) + 1; f <= Math.ceil(sh.e * 30) + 1; f++) { const q = F[f]; if (q) { xs.push(q.x + q.w / 2); ys.push(q.y + q.h / 2); } }
      const med = a => a.sort((p, q) => p - q)[a.length >> 1];
      sh._f = xs.length ? [med(xs), med(ys)] : [540, 760];
    }
    return sh._f;
  }
  /* تحويل طبقة: زوم حول وسط وجهك + إزاحة، مضروبة بعمق الطبقة. over = هامش 2٪ عشان الإزاحة ما تكشف حافة الإطار */
  function T(sh, t, f) {
    const c = camAt(sh, t), fo = focusOf(sh, t), over = sh.over == null ? 1.02 : sh.over;
    const s = (1 + (c.z - 1) * f) * (f <= 1 ? over : 1);
    return { s, x: c.x * f, y: c.y * f, fx: fo[0], fy: fo[1] };
  }
  const apply = (Y, L) => { Y.translate(L.fx + L.x, L.fy + L.y); Y.scale(L.s, L.s); Y.translate(-L.fx, -L.fy); };
  const mapPt = (L, x, y) => [L.fx + L.x + (x - L.fx) * L.s, L.fy + L.y + (y - L.fy) * L.s];

  /* ── الكلمات ── */
  const vis = (o, t) => o.a != null ? o.a : (pr(t, o.t, o.t + (o.inD || 0.10)) * (1 - eio(pr(t, o.e - (o.outD || 0.24), o.e))));
  const val = (v, t, d) => typeof v === 'function' ? v(t) : (v == null ? d : v);   // x/y/light/glowAmt تقبل رقم أو دالة بالوقت (القياس وقت الرسم بعد ما يتحمّل الخط)
  function drawWord(Y, o, t) {
    const v = vis(o, t); if (v <= 0) return;
    const k = eo(pr(t, o.t, o.t + (o.popD || 0.2))), out = eio(pr(t, o.e - (o.outD || 0.24), o.e));
    let sc = 1, dy = 0, dx = 0;
    if (o.anim === 'slam') { sc = 1 + 0.32 * (1 - eo(pr(t, o.t, o.t + 0.16))); }
    else if (o.anim === 'rise') { dy = (1 - k) * 46; }
    else if (o.anim === 'side') { dx = (1 - k) * (o.dir || 1) * 60; }
    else { sc = 0.84 + 0.16 * k; dy = (1 - k) * 18; }
    dy -= out * 14;
    const size = o.size || 96, txt = typeof o.text === 'function' ? o.text(t) : o.text;
    Y.save(); Y.globalAlpha *= v; Y.translate(val(o.x, t, 540) + dx, val(o.y, t, 400) + dy); Y.scale(sc, sc);
    Y.font = (o.weight || 700) + ' ' + size + 'px ' + (o.font || (/[؀-ۿ]/.test(txt) ? AR() : 'system-ui,-apple-system,"Helvetica Neue",sans-serif'));
    Y.textAlign = o.align || 'center'; Y.textBaseline = 'middle'; Y.direction = /[؀-ۿ]/.test(txt) ? 'rtl' : 'ltr';
    if (o.ls) Y.letterSpacing = o.ls + 'px';
    const ga = o.glow ? cl(val(o.light, t, 1)) : 0;
    if (o.glow && ga > 0.02) {   // الكلمة المضيئة: هالة بلونها (مسموحة لأنها «الكلمة المضيئة» بالاسم — references/depth.md)
      Y.save(); Y.globalAlpha *= ga; Y.shadowColor = rgba(o.glow, 0.95); Y.shadowBlur = size * 0.55; Y.fillStyle = o.color || '#FFFFFF'; Y.fillText(txt, 0, 0);
      Y.shadowBlur = size * 0.18; Y.fillText(txt, 0, 0); Y.restore();
      Y.shadowColor = 'rgba(0,0,0,0.35)'; Y.shadowBlur = size * 0.12;
    } else if (o.shadow !== false) { Y.shadowColor = 'rgba(0,0,0,0.42)'; Y.shadowBlur = Math.max(12, size * 0.16); Y.shadowOffsetY = 3; }
    Y.fillStyle = o.color || '#FFFFFF'; Y.fillText(txt, 0, 0);
    Y.restore();
  }

  /* ── الإضاءة من الكلمة المضيئة ── */
  function lightsAt(sh, t) {
    const L = [];
    for (const o of WORDS) { if (!o.glow || t < o.t || t > o.e) continue; const a = vis(o, t) * cl(val(o.light, t, 1)); if (a <= 0.01) continue;
      const Lt = sh ? T(sh, t, DF[o.at] || 1) : { s: 1, x: 0, y: 0, fx: 0, fy: 0 }, p = mapPt(Lt, val(o.x, t, 540), val(o.y, t, 400));
      L.push({ x: p[0], y: p[1], c: o.glow, a, r: o.lightR || 1100, back: o.at === 'back' }); }
    return L;
  }
  function lightRoom(Y, L) {   // الضوء على الجدار والمكان ورا (قبل ما ترسم أنت)
    if (!L.length) return; Y.save(); Y.globalCompositeOperation = 'screen';
    for (const l of L) { const g = Y.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); g.addColorStop(0, rgba(l.c, 0.50 * l.a)); g.addColorStop(0.35, rgba(l.c, 0.22 * l.a)); g.addColorStop(1, rgba(l.c, 0));
      Y.fillStyle = g; Y.fillRect(0, 0, W, H); }
    Y.restore();
  }
  function lightPerson(Y, L, drawP, pc) {   // على وجهك وجسمك: لون الكلمة ينقص بشكلك + حافة مضيئة من جهتها
    if (!L.length) return;
    /* ⛔ ماجد 8 نوفمبر: الكلمة ورا راسك = الضوء من وراك — يطلع حافة على شعرك وكتوفك وعلى الجدار بس، مو لون على وجهك.
       الإضاءة على الوجه (من قدام) للكلمة القدّامية بس. */
    const F = L.filter(l => !l.back);
    const [c1, y1] = CV('lp');
    for (const l of F) { const g = y1.createRadialGradient(l.x, l.y, 0, l.x, l.y, l.r); g.addColorStop(0, rgba(l.c, 0.95 * l.a)); g.addColorStop(0.5, rgba(l.c, 0.45 * l.a)); g.addColorStop(1, rgba(l.c, 0));
      y1.fillStyle = g; y1.fillRect(0, 0, W, H); }
    if (F.length) { y1.globalCompositeOperation = 'destination-in'; drawP(y1);
      Y.save(); Y.globalCompositeOperation = 'soft-light'; Y.drawImage(c1, 0, 0); Y.globalCompositeOperation = 'screen'; Y.globalAlpha = 0.42; Y.drawImage(c1, 0, 0); Y.restore(); }
    for (const l of L) {   // الحافة: شكلك ناقص نسخة منه مزاحة بعيد عن الضوء = شريط بالجهة اللي تواجه الكلمة
      const [c2, y2] = CV('rim'); const dx = l.x - pc[0], dy = l.y - pc[1], n = Math.hypot(dx, dy) || 1;
      drawP(y2); y2.globalCompositeOperation = 'destination-out'; y2.filter = 'blur(4px)'; y2.translate(-dx / n * 10, -dy / n * 10); drawP(y2);
      y2.setTransform(1, 0, 0, 1, 0, 0); y2.filter = 'none'; y2.globalCompositeOperation = 'source-in'; y2.fillStyle = rgba(l.c, 1); y2.fillRect(0, 0, W, H);
      Y.save(); Y.globalCompositeOperation = 'lighter'; Y.globalAlpha = (l.back ? 0.5 : 0.32) * l.a; Y.drawImage(c2, 0, 0); Y.restore();   // من ورا: الحافة هي الأثر الوحيد — أقوى شوي
    }
  }
  /* ── لون الغرفة ── */
  function roomTint(Y, t) {
    for (const r of ROOMS) { if (t < r.s || t > r.e) continue;
      const a = (r.amt == null ? 0.55 : r.amt) * eo(pr(t, r.s, r.s + (r.inD || 0.35))) * (1 - eio(pr(t, r.e - (r.outD || 0.35), r.e))); if (a <= 0) continue;
      let col = r.tint; if (!col || col === 'auto') { const d = G.DEPTH_DATA, rm = d && d.rooms && d.rooms[0]; col = (rm && rm.bg) || (typeof ACC === 'string' ? ACC : '#5AA2D2'); }
      Y.save(); Y.fillStyle = 'rgba(0,0,0,' + (0.42 * a) + ')'; Y.fillRect(0, 0, W, H);           // تعتيم
      Y.globalCompositeOperation = 'color'; Y.fillStyle = rgba(col, 0.75 * a); Y.fillRect(0, 0, W, H);   // لون الغرفة الجديد بنفس إضاءتها
      Y.restore(); }
  }
  /* ── رسم الشخص بنفس تأطير الفيديو (MV.person) ── */
  const drawPerson = (Y, L) => { Y.save(); apply(Y, L); const ok = G.MV && MV.person && MV.person(Y); Y.restore(); return ok; };

  /* ── اللقطة: تنرسم بطبقة الفيديو (قبل كل المشاهد الثانية) ── */
  function shotAt(t) { for (const s of SHOTS) if (t >= s.s && t < s.e) return s; return null; }
  function depthVideo(t) {
    const sh = shotAt(t); if (!sh) return;
    const Lr = T(sh, t, DF.room), Lb = T(sh, t, DF.back), Lp = T(sh, t, DF.person), Lf = T(sh, t, DF.front);
    const hasP = sh.person !== false && G.MV && MV.person && MV.person.ok();
    X.save(); X.fillStyle = '#000'; X.fillRect(0, 0, W, H); apply(X, hasP ? Lr : Lp); MV.video(X); X.restore();   // بلا قصّ: الغرفة وأنت طبقة وحدة
    roomTint(X, t);
    const lights = lightsAt(sh, t); lightRoom(X, lights);
    for (const f of LAYERS.room) { X.save(); apply(X, Lr); f(t, X, Lr); X.restore(); }
    for (const f of LAYERS.back) { X.save(); apply(X, Lb); f(t, X, Lb); X.restore(); }
    for (const o of WORDS) if (o.at === 'back' && t >= o.t && t <= o.e) { X.save(); apply(X, Lb); drawWord(X, o, t); X.restore(); }
    if (hasP) {
      drawPerson(X, Lp);
      const fo = focusOf(sh, t); lightPerson(X, lights, y => drawPerson(y, Lp), mapPt(Lp, fo[0], fo[1] + 260));
    }
    for (const f of LAYERS.front) { X.save(); apply(X, Lf); f(t, X, Lf); X.restore(); }
    for (const o of WORDS) if (o.at !== 'back' && t >= o.t && t <= o.e) { X.save(); apply(X, Lf); drawWord(X, o, t); X.restore(); }
  }
  depthVideo.layer = 'video';
  /* برّا اللقطات (بي-رول بلا قصّ): الكلمات والمربعات بلا كاميرا */
  function depthFlat(t) {
    if (!shotAt(t)) for (const o of WORDS) if (t >= o.t && t <= o.e) drawWord(X, o, t);
    for (const b of BOXES) drawBox(b, t);
  }

  /* ── مربع بالضبط على المعلومة: ينرسم بخط واحد يلف حولها (صوت قلم بطول الرسم) ── */
  function inflate(q, p) {   // نكبّر المربع على محاوره هو (مو قطرياً) — يبقى موازي للكتابة المايلة
    const u = [q[1][0] - q[0][0], q[1][1] - q[0][1]], v = [q[3][0] - q[0][0], q[3][1] - q[0][1]];
    const nu = Math.hypot(u[0], u[1]) || 1, nv = Math.hypot(v[0], v[1]) || 1, U = [u[0] / nu * p, u[1] / nu * p], V = [v[0] / nv * p, v[1] / nv * p];
    return [[q[0][0] - U[0] - V[0], q[0][1] - U[1] - V[1]], [q[1][0] + U[0] - V[0], q[1][1] + U[1] - V[1]],
            [q[2][0] + U[0] + V[0], q[2][1] + U[1] + V[1]], [q[3][0] - U[0] + V[0], q[3][1] - U[1] + V[1]]];
  }
  function roundPath(Y, q, r) { Y.beginPath(); for (let i = 0; i < 4; i++) { const p = q[i], a = q[(i + 3) % 4], b = q[(i + 1) % 4];
      const da = Math.hypot(a[0] - p[0], a[1] - p[1]), db = Math.hypot(b[0] - p[0], b[1] - p[1]), rr = Math.min(r, da / 2, db / 2);
      const s = [p[0] + (a[0] - p[0]) / da * rr, p[1] + (a[1] - p[1]) / da * rr], e = [p[0] + (b[0] - p[0]) / db * rr, p[1] + (b[1] - p[1]) / db * rr];
      if (i === 0) Y.moveTo(s[0], s[1]); else Y.lineTo(s[0], s[1]); Y.quadraticCurveTo(p[0], p[1], e[0], e[1]); } Y.closePath(); }
  function drawBox(b, t) {
    if (t < b.s || t > b.e) return; const q0 = typeof b.quad === 'function' ? b.quad(t) : b.quad; if (!q0) return;
    const q = inflate(q0, b.pad == null ? 10 : b.pad), dr = b.draw || 0.45, k = eio(pr(t, b.s, b.s + dr)), out = 1 - eio(pr(t, b.e - 0.22, b.e));
    cue('pen', b.s, { d: dr, id: 'box@' + b.s });
    const per = q.reduce((acc, p, i) => acc + Math.hypot(q[(i + 1) % 4][0] - p[0], q[(i + 1) % 4][1] - p[1]), 0);
    X.save(); X.globalAlpha *= out;
    if (b.dim) { X.save(); X.fillStyle = 'rgba(0,0,0,' + (b.dim * k) + ')'; X.beginPath(); X.rect(0, 0, W, H); roundPath(X, q, b.r || 14); X.fill('evenodd'); X.restore(); }
    roundPath(X, q, b.r == null ? 14 : b.r); X.setLineDash([per * k, per]); X.lineCap = 'round'; X.lineJoin = 'round';
    X.shadowColor = 'rgba(0,0,0,0.45)'; X.shadowBlur = 10; X.strokeStyle = b.color || '#FFFFFF'; X.lineWidth = b.lw || 4; X.stroke();
    X.restore();
    return q;
  }

  const DEPTH = {
    shot: o => { SHOTS.push(Object.assign({ s: 0, e: 0 }, o)); SHOTS.sort((a, b) => a.s - b.s);
      (o.cam || []).forEach((k, i, A) => { if (i && Math.abs(k[1] - A[i - 1][1]) / Math.max(0.1, k[0] - A[i - 1][0]) > 0.03) cue('air', A[i - 1][0] + 0.05, { id: 'cam@' + k[0], g: 0.03 }); }); },   // دفعة كاميرا سريعة (مو الزحف البطيء) = نَفَس هواء خفيف
    word: o => { const w = Object.assign({ at: 'front', x: 540, y: 400, size: 96, e: (o.t || 0) + 1.2 }, o); WORDS.push(w);
      const k = w.cue === undefined ? (w.glow ? 'swish' : (w.size >= 120 ? 'hit' : null)) : w.cue; if (k) cue(k, w.t, { id: 'w@' + w.t + w.text, g: w.cueG }); return w; },
    room: o => { ROOMS.push(o); },
    layer: (at, fn) => { (LAYERS[at] || LAYERS.front).push(fn); },
    box: o => { BOXES.push(o); },
    camAt: t => { const sh = shotAt(t); return sh ? camAt(sh, t) : null; },
    map: (t, at, x, y) => { const sh = shotAt(t); return sh ? mapPt(T(sh, t, DF[at] || 1), x, y) : [x, y]; },
    inflate, DF,
  };
  G.DEPTH = DEPTH;
  /* depth.json (44_matte.py): لون غرفتك حولك — لـtint:'auto' */
  try { const x = new XMLHttpRequest(); x.open('GET', 'depth.json', false); x.send(); if (x.status === 200 || (x.status === 0 && x.responseText)) G.DEPTH_DATA = JSON.parse(x.responseText); } catch (e) {}
  if (typeof SCENE_LIST !== 'undefined') { SCENE_LIST.push(['depthVideo', depthVideo, 'video']); SCENE_LIST.push(['depthFlat', depthFlat]); }
})();
