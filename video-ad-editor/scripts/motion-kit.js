/* ═══ motion-kit.js — حزمة موشن قرافيكس بمستوى الشوريلز (v3.6 · 27 سبتمبر 2026) ═══
   طلب المستخدم بعد مشهد الإثبات: «نبي الحركة الديناميكية هذي… لما أتكلم بنص الشاشة، أو كرت صغير تحت، أو لما أختفي».
   كل مكوّن = دالة بالزمن MK.xxx(t, o) ترسم على X (كانفس المحرّك) داخل صندوق o.box={x,y,w,h} — فيركب على أي وضع:
     R_DOWN  → داخل panelIn (صندوق 130..950 × 278..458، يتكبّر 1.2 وحده)
     R_LOWER → صندوق كبير فوق الكرت الصغير: {x:60,y:170,w:960,h:1150}
     R_OFF   → الشاشة كلها: {x:60,y:170,w:960,h:1400}
   الوقت: o.s = بداية الدخول (ثبّتها على توقيت الكلمة: wordsOf(i)[j].s)، o.e = نهاية (اختياري — يطلع بتلاشي).
   التحميل بـcompose.html تحت سكربت المحرّك:  <script src="motion-kit.js"></script>
   الدليل الكامل والوصفات: references/motion-kit.md */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  // أدوات المحرّك لو موجودة، وإلا بدائل (عشان الحزمة تشتغل بصفحة تجربة لحالها)
  const cl = G.cl || ((v, a, b) => Math.max(a, Math.min(b, v)));
  const lerp = G.lerp || ((a, b, k) => a + (b - a) * k);
  const pr = G.pr || ((t, a, b) => cl((t - a) / (b - a), 0, 1));
  const eo = k => 1 - Math.pow(1 - k, 3);
  const eExpo = k => k >= 1 ? 1 : 1 - Math.pow(2, -10 * k);
  const eBack = k => { const s = 1.7; k = k - 1; return k * k * ((s + 1) * k + s) + 1; };
  const spring = k => k >= 1 ? 1 : 1 - Math.exp(-6 * k) * Math.cos(12 * k);
  const C = () => G.X;                                  // كانفس المحرّك
  const col = n => ({ BG: G.BG || '#F3EFEA', INK: G.INK || '#1F1F1D', ACC: G.ACC || '#D97757', CLAY: G.CLAY || '#BD5D3A', MUT: G.MUT || '#8A847A' })[n];
  const font = (w, s) => w + ' ' + s + 'px ' + (G.FONT || 'Cairo');
  const rrp = (x, y, w, h, r) => { const X = C(); X.beginPath(); X.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); };
  const fmt = n => Math.round(n).toLocaleString('en-US');
  const kfmt = v => v >= 1e6 ? (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? (v / 1000).toFixed(1) + 'K' : String(Math.round(v));
  const out = (t, o) => o.e ? 1 - pr(t, o.e - 0.25, o.e) : 1;          // تلاشي الخروج
  const live = (t, o) => t >= o.s - 0.01 && (!o.e || t <= o.e);
  const shadow = (b, y, a) => { const X = C(); X.shadowColor = 'rgba(0,0,0,' + a + ')'; X.shadowBlur = b; X.shadowOffsetY = y; };
  const noShadow = () => { const X = C(); X.shadowColor = 'transparent'; X.shadowBlur = 0; X.shadowOffsetY = 0; };

  const MK = {};
  MK.ease = { eo, eExpo, eBack, spring };

  /* 🔢 عدّاد بعجلات — كل خانة بعرض ثابت وتدوّر؛ يخبط بآخره (تكبير + ارتداد). o: {s, dur, val, cx, cy, size, color, prefix, suffix, slam} */
  MK.odometer = function (t, o) {
    if (!live(t, o)) return; const X = C(), dur = o.dur || 1.9, size = o.size || 160;
    const k = pr(t, o.s, o.s + dur), v = (o.val || 0) * eExpo(k), speed = k > 0 && k < 1 ? 1 - k : 0;
    const sl = o.slam === false ? 0 : pr(t, o.s + dur, o.s + dur + 0.35), sc = sl > 0 && sl < 1 ? 1 + 0.12 * Math.sin(sl * Math.PI) * (1 - sl) : 1;
    X.save(); X.globalAlpha *= out(t, o); X.translate(o.cx, o.cy); X.scale(sc, sc);
    X.font = font(900, size); X.textBaseline = 'alphabetic'; X.direction = 'ltr'; X.textAlign = 'center';
    const dw = Math.max(...'0123456789'.split('').map(d => X.measureText(d).width)), cw = X.measureText(',').width * 0.9;
    const s = (o.prefix || '') + fmt(v) + (o.suffix || ''), chars = s.split('');
    let tw = 0; chars.forEach(ch => tw += /\d/.test(ch) ? dw : X.measureText(ch).width * (ch === ',' ? 0.9 : 1));
    let px = -tw / 2; const digits = fmt(v).replace(/,/g, '').length; let di = 0;
    X.fillStyle = o.color || col('INK');
    for (const ch of chars) {
      if (!/\d/.test(ch)) { const w = X.measureText(ch).width * (ch === ',' ? 0.9 : 1); X.fillText(ch, px + w / 2, 0); px += w; continue; }
      const place = digits - 1 - di; di++;
      const frac = (v / Math.pow(10, place)) % 1, d = parseInt(ch), roll = speed > 0.02 && place < 4 ? eo(frac) : 0;
      X.save(); X.beginPath(); X.rect(px, -size * 0.95, dw, size * 1.15); X.clip();
      const off = roll * size * 0.9; X.globalAlpha *= 1 - roll * 0.6; X.fillText(String(d), px + dw / 2, -off);
      if (roll > 0.01) { X.globalAlpha = roll; X.fillText(String((d + 1) % 10), px + dw / 2, size * 0.9 - off); }
      X.restore(); px += dw;
    }
    X.restore();
    if (o.slam !== false && o.burst !== false) MK.burst(t, { s: o.s + dur, cx: o.cx, cy: o.cy - size * 0.35, spread: size * 1.4 });
  };
  /* الرجّة لحظة الخبطة — استخدمها بطبقة: const [dx,dy]=MK.shake(t, sTime); X.translate(dx,dy) */
  MK.shake = function (t, s, amp) { const k = pr(t, s, s + 0.3); if (k <= 0 || k >= 1) return [0, 0]; const a = (amp || 12) * (1 - k); return [Math.sin(t * 90) * a, Math.cos(t * 77) * a]; };

  /* 💥 انفجار نقاط من نقطة — o: {s, cx, cy, spread, n, colors} */
  MK.burst = function (t, o) {
    const k = pr(t, o.s, o.s + 0.8); if (k <= 0 || k >= 1) return; const X = C(), n = o.n || 24, sp = o.spread || 220;
    X.save(); for (let q = 0; q < n; q++) { const an = q * 2.399, d = eo(k) * (sp * 0.6 + (q * 37) % (sp * 0.7));
      X.globalAlpha = 1 - k; X.fillStyle = (o.colors || [col('ACC'), col('ACC'), col('INK')])[q % 3];
      X.beginPath(); X.arc(o.cx + Math.cos(an) * d * 1.5, o.cy + Math.sin(an) * d * 0.8, 7 * (1 - k) + 2, 0, 7); X.fill(); }
    X.restore();
  };

  /* 🃏 بطاقة رقم تنبثق بزنبرك وتعدّ — o: {s, box, bg, ink, label, val, format:'k'|'comma', prefix, viz:'ring'|'bars'|'avatars'|'bubbles'|'spark'|null, vizVal, bubbles:[], i (ترتيب للدوران)} */
  MK.statCard = function (t, o) {
    if (!live(t, o)) return; const X = C(), b = o.box, k = pr(t, o.s, o.s + 0.7); if (k <= 0) return;
    const s = lerp(0.55, 1, spring(k)), rot = (1 - eo(k)) * ((o.i || 0) % 2 ? 4 : -4);
    const bg = o.bg || '#FFFFFF', ink = o.ink || col('INK'), acc = o.acc || col('ACC');
    X.save(); X.globalAlpha *= cl(k * 3, 0, 1) * out(t, o);
    X.translate(b.x + b.w / 2, b.y + b.h / 2); X.rotate(rot * Math.PI / 180); X.scale(s, s); X.translate(-b.w / 2, -b.h / 2);
    shadow(40, 14, 0.12); X.fillStyle = bg; rrp(0, 0, b.w, b.h, Math.min(34, b.h * 0.12)); X.fill(); noShadow();
    const kc = pr(t, o.s + 0.25, o.s + 1.6), v = (o.val || 0) * eExpo(kc);
    const pad = Math.max(24, b.w * 0.08), lf = Math.max(22, b.h * 0.095), nf = Math.max(40, Math.min(b.h * 0.3, b.w * 0.2));
    X.direction = 'rtl'; X.textAlign = 'right'; X.textBaseline = 'alphabetic';
    X.fillStyle = o.labelColor || (bg === '#FFFFFF' ? col('MUT') : ink); X.globalAlpha *= 0.85; X.font = font(800, lf); X.fillText(o.label || '', b.w - pad, pad + lf);
    X.globalAlpha /= 0.85; X.direction = 'ltr'; X.font = font(900, nf); X.fillStyle = ink;
    X.fillText((o.prefix || '') + (o.format === 'comma' ? fmt(v) : kfmt(v)) + (o.suffix || ''), b.w - pad, pad + lf + nf * 1.05);
    const vz = pr(t, o.s + 0.3, o.s + 1.8), vy = pad + lf + nf * 1.3, vh = b.h - vy - pad * 0.7;
    if (o.viz === 'ring') { const r = Math.min(vh, b.w * 0.3) * 0.42, cx = pad + r + 10, cy = b.h - pad - r;
      X.lineWidth = r * 0.33; X.strokeStyle = 'rgba(127,127,127,.18)'; X.beginPath(); X.arc(cx, cy, r, 0, 7); X.stroke();
      X.strokeStyle = acc; X.lineCap = 'round'; X.beginPath(); X.arc(cx, cy, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (o.vizVal || 0.9) * eo(vz)); X.stroke(); }
    else if (o.viz === 'bars') { const hs = o.bars || [.35, .55, .42, .75, .6, .9, 1], bw = Math.min(26, (b.w * 0.5) / hs.length - 10);
      hs.forEach((q, j) => { const kb = eBack(pr(vz, j * 0.06, j * 0.06 + 0.5)), bh = Math.max(0, vh * 0.9 * q * cl(kb, 0, 1.2));
        X.fillStyle = j === hs.length - 1 ? acc : ink; rrp(pad + j * (bw + 10), b.h - pad * 0.7 - bh, bw, bh, 6); X.fill(); }); }
    else if (o.viz === 'avatars') { const r = Math.min(30, vh * 0.35);
      for (let a = 0; a < 5; a++) { const ka = eBack(pr(vz, a * 0.1, a * 0.1 + 0.35)); if (ka <= 0) continue; const cx = pad + r + a * r * 1.5, cy = b.h - pad - r * 0.6;
        X.save(); X.globalAlpha *= cl(ka, 0, 1); X.fillStyle = '#fff'; X.beginPath(); X.arc(cx, cy, r * ka, 0, 7); X.fill(); X.strokeStyle = bg; X.lineWidth = 5; X.stroke();
        X.fillStyle = acc; X.beginPath(); X.arc(cx, cy - r * 0.25, r * 0.34 * ka, 0, 7); X.fill(); X.beginPath(); X.arc(cx, cy + r * 0.62, r * 0.55 * ka, Math.PI, 0); X.fill(); X.restore(); } }
    else if (o.viz === 'bubbles') { let bx = pad; X.font = font(800, Math.max(20, lf * 0.9));
      (o.bubbles || ['شلون؟']).forEach((sTxt, j) => { const kb = eBack(pr(vz, 0.1 + j * 0.18, 0.45 + j * 0.18)), tw = X.measureText(sTxt).width, bw = tw + 34, bh = lf * 1.7;
        if (kb > 0) { X.save(); X.globalAlpha *= cl(kb, 0, 1); X.translate(bx + bw / 2, b.h - pad - bh / 2); X.scale(cl(kb, 0, 1.1), cl(kb, 0, 1.1));
          X.fillStyle = j === 0 ? acc : 'rgba(127,127,127,.14)'; rrp(-bw / 2, -bh / 2, bw, bh, bh / 2); X.fill();
          X.fillStyle = j === 0 ? '#fff' : ink; X.direction = 'rtl'; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(sTxt, 0, 2); X.restore(); }
        bx += bw + 12; }); }
    else if (o.viz === 'spark') MK.lineChart(t, { s: o.s + 0.3, dur: 1.2, box: { x: pad, y: vy, w: b.w - pad * 2, h: vh }, color: acc, grid: false, fill: true, width: 5 });
    X.restore();
  };

  /* 📈 منحنى يرتسم (+ تعبئة متدرجة + نقطة تنبض) — o: {s, dur, box, points:[0..1]|'hockey'|'steady', color, max:'1M', grid, fill, width} */
  MK.lineChart = function (t, o) {
    if (!live(t, o)) return; const X = C(), b = o.box, k = eo(pr(t, o.s, o.s + (o.dur || 1.2))); if (k <= 0) return;
    let pts = o.points; if (!Array.isArray(pts)) { pts = []; for (let i = 0; i <= 50; i++) { const q = i / 50; pts.push(pts.length && o.points === 'steady' ? 0.2 + q * 0.6 + 0.05 * Math.sin(q * 11) : Math.pow(q, 3.2) * 0.96 + 0.03 * Math.sin(q * 9) * (1 - q)); } }
    const P = pts.map((v, i) => [b.x + b.w * i / (pts.length - 1), b.y + b.h - b.h * cl(v, 0, 1)]);
    const c = o.color || col('ACC'); X.save(); X.globalAlpha *= out(t, o);
    if (o.grid !== false) { X.strokeStyle = 'rgba(127,127,127,.18)'; X.lineWidth = 2; X.setLineDash([6, 10]);
      [0, 0.5, 1].forEach(q => { const y = b.y + b.h * q; X.beginPath(); X.moveTo(b.x, y); X.lineTo(b.x + b.w, y); X.stroke(); }); X.setLineDash([]);
      if (o.max) { X.fillStyle = col('MUT'); X.font = '600 22px Menlo'; X.direction = 'ltr'; X.textAlign = 'left'; X.fillText(o.max, b.x, b.y - 10); } }
    const n = Math.max(2, Math.floor(P.length * k));
    if (o.fill !== false) { const g = X.createLinearGradient(0, b.y, 0, b.y + b.h); g.addColorStop(0, c + '47'); g.addColorStop(1, c + '00');
      X.beginPath(); X.moveTo(P[0][0], b.y + b.h); for (let i = 0; i < n; i++) X.lineTo(P[i][0], P[i][1]); X.lineTo(P[n - 1][0], b.y + b.h); X.closePath(); X.fillStyle = g; X.fill(); }
    X.beginPath(); P.slice(0, n).forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]));
    X.strokeStyle = c; X.lineWidth = o.width || 7; X.lineJoin = 'round'; X.lineCap = 'round'; X.stroke();
    const [ex, ey] = P[n - 1]; X.fillStyle = c; X.beginPath(); X.arc(ex, ey, (o.width || 7) * 1.7, 0, 7); X.fill();
    const pu = (t * 1.4) % 1; X.strokeStyle = c; X.globalAlpha *= 1 - pu; X.lineWidth = 4; X.beginPath(); X.arc(ex, ey, 12 + pu * 40, 0, 7); X.stroke();
    X.restore();
  };

  /* 📊 مقارنة أعمدة: الطويل ينهار للقصير أو يسبق — o: {s, box, items:[{l:'قبل',v:48,u:'ساعة'},{l:'بعد',v:1,u:'ساعة',hot:true}], unit} */
  MK.compareBars = function (t, o) {
    if (!live(t, o)) return; const X = C(), b = o.box, items = o.items || [], mx = Math.max(...items.map(i => i.v)), n = items.length;
    const gw = b.w / n, bw = Math.min(170, gw * 0.55); X.save(); X.globalAlpha *= out(t, o);
    items.forEach((it, j) => { const k = eBack(pr(t, o.s + j * 0.35, o.s + j * 0.35 + 0.8)); if (k <= 0) return;
      const h = Math.max(14, (b.h - 150) * (it.v / mx)) * cl(k, 0, 1.08),   // الصغير جداً يبان (1 من 48 كان يختفي)
       x = b.x + gw * (n - 1 - j) + (gw - bw) / 2, y = b.y + b.h - 70 - h;   // من اليمين
      shadow(30, 10, 0.12); X.fillStyle = it.hot ? col('ACC') : col('INK'); rrp(x, y, bw, h, 22); X.fill(); noShadow();
      const vk = pr(t, o.s + j * 0.35 + 0.2, o.s + j * 0.35 + 1.2);
      X.direction = 'ltr'; X.textAlign = 'center'; X.textBaseline = 'alphabetic'; X.fillStyle = it.hot ? col('ACC') : col('INK'); X.font = font(900, 64);
      X.fillText(fmt(it.v * eExpo(vk)), x + bw / 2, y - 48);
      X.font = font(700, 30); X.direction = 'rtl'; X.fillStyle = col('MUT'); if (it.u) X.fillText(it.u, x + bw / 2, y - 12);
      X.font = font(800, 38); X.fillStyle = col('INK'); X.fillText(it.l, x + bw / 2, b.y + b.h - 18); });
    X.restore();
  };

  /* ✍️ كاينتك تايبو عربي — الكلمات تطلع من تحت قناع وحدة ورا وحدة، والمظلّلة بلون العلامة؛ mode:'rise'|'slam'
     o: {s, box, words:['ريل','واحد.'], hot:[1], size, mode, times:[ثواني دخول كل كلمة — من wordsOf] , underline} */
  MK.kinetic = function (t, o) {
    if (!live(t, o)) return; const X = C(), b = o.box, size = o.size || 110, ws = o.words || [];
    X.save(); X.globalAlpha *= out(t, o); X.font = font(900, size); X.direction = 'rtl'; X.textBaseline = 'alphabetic';
    const sp = X.measureText(' ').width, widths = ws.map(w => X.measureText(w).width), tot = widths.reduce((a, w) => a + w, 0) + sp * (ws.length - 1);
    let px = b.x + b.w / 2 + tot / 2; const cy = b.y + b.h / 2 + size * 0.35;
    ws.forEach((w, j) => { const st = o.times ? o.times[j] : o.s + j * 0.14, k = pr(t, st, st + 0.42); if (k > 0) {
        X.save(); X.beginPath(); X.rect(px - widths[j] - 10, cy - size * 1.15, widths[j] + 20, size * 1.5); X.clip();
        const off = o.mode === 'slam' ? 0 : (1 - eBack(k)) * size * 1.2, sc = o.mode === 'slam' ? lerp(1.8, 1, eBack(k)) : 1;
        X.translate(px - widths[j] / 2, cy + off); X.scale(sc, sc); X.globalAlpha *= o.mode === 'slam' ? cl(k * 2, 0, 1) : 1;
        X.fillStyle = (o.hot || []).includes(j) ? col('ACC') : (o.color || col('INK')); X.textAlign = 'center'; X.fillText(w, 0, 0); X.restore(); }
      px -= widths[j] + sp; });
    if (o.underline) { const last = o.times ? o.times[ws.length - 1] : o.s + (ws.length - 1) * 0.14, u = eo(pr(t, last + 0.25, last + 0.7));
      X.fillStyle = col('ACC'); rrp(b.x + b.w / 2 - tot / 2 * u, cy + size * 0.3, tot * u, Math.max(8, size * 0.09), 5); X.fill(); }
    X.restore();
  };

  /* 🎛️ إطار تقني للشاشة الكاملة (R_OFF): زوايا · تايم كود · عنوان · مسطرة — o: {s, title, sub, tc0} */
  MK.techFrame = function (t, o) {
    if (!live(t, o)) return; const X = C(), k = eo(pr(t, o.s, o.s + 0.55)), W = 1080, H = 1920;
    X.save(); X.globalAlpha *= out(t, o); X.strokeStyle = col('INK'); X.globalAlpha *= 0.55; X.lineWidth = 2.5; const L = 44 * k;
    [[40, 160, 1, 1], [W - 40, 160, -1, 1], [40, 1600, 1, -1], [W - 40, 1600, -1, -1]].forEach(([a, c2, sx, sy]) => { X.beginPath(); X.moveTo(a, c2 + sy * L); X.lineTo(a, c2); X.lineTo(a + sx * L, c2); X.stroke(); });
    X.globalAlpha /= 0.55; X.globalAlpha *= 0.65 * k; X.fillStyle = col('INK');
    X.font = font(700, 26); X.direction = 'rtl'; X.textAlign = 'right'; X.textBaseline = 'alphabetic'; X.fillText(o.title || '', W - 100, 208);
    const tt = t - o.s + (o.tc0 || 0), fr = Math.floor(tt * 30); X.direction = 'ltr'; X.textAlign = 'left'; X.font = '600 24px Menlo';
    X.fillText('TC 00:00:' + String(Math.floor(tt)).padStart(2, '0') + ':' + String(fr % 30).padStart(2, '0'), 100, 206);
    X.lineWidth = 2; X.strokeStyle = col('INK'); X.beginPath(); X.moveTo(100, 1560); X.lineTo(100 + (W - 200) * k, 1560); X.stroke();
    for (let i = 0; i <= 40; i++) { const px = 100 + (W - 200) * i / 40; if (px > 100 + (W - 200) * k) break; X.beginPath(); X.moveTo(px, 1560); X.lineTo(px, 1560 - (i % 5 ? 10 : 22)); X.stroke(); }
    if (o.sub) { X.font = font(700, 24); X.direction = 'rtl'; X.textAlign = 'right'; X.fillText(o.sub, W - 100, 1590); }
    X.restore();
  };

  /* 🎬 تايملاين مونتاج: مسارات + ماسات كيفريم + رأس تشغيل يمشي + زر «رندر» ينضغط — o: {s, box, steps:['صوّرت','عطيته المقطع','طلع جاهز'], clickAt} */
  MK.timeline = function (t, o) {
    if (!live(t, o)) return; const X = C(), b = o.box, k = eo(pr(t, o.s, o.s + 0.5)); if (k <= 0) return;
    const steps = o.steps || [], rows = 3, rh = Math.min(70, (b.h - 140) / rows);
    X.save(); X.globalAlpha *= k * out(t, o); shadow(40, 14, 0.12); X.fillStyle = '#6D5DF6'; rrp(b.x, b.y, b.w, b.h, 34); X.fill(); noShadow();
    X.fillStyle = 'rgba(255,255,255,.85)'; X.font = font(800, 30); X.direction = 'rtl'; X.textAlign = 'right'; X.textBaseline = 'alphabetic';
    X.fillText(o.title || 'المونتاج', b.x + b.w - 40, b.y + 58);
    const tx0 = b.x + 150, tx1 = b.x + b.w - 40;
    ['موضع', 'حجم', 'دوران'].forEach((lab, r) => { const y = b.y + 100 + r * rh + rh / 2;
      X.fillStyle = 'rgba(255,255,255,.5)'; X.font = font(700, 22); X.textAlign = 'right'; X.fillText(lab, b.x + 120, y + 8);
      X.strokeStyle = 'rgba(255,255,255,.18)'; X.lineWidth = 2; X.beginPath(); X.moveTo(tx0, y); X.lineTo(tx1, y); X.stroke();
      for (let d = 0; d < 6; d++) { const kd = eBack(pr(t, o.s + 0.3 + r * 0.12 + d * 0.07, o.s + 0.6 + r * 0.12 + d * 0.07)); if (kd <= 0) continue;
        const px = lerp(tx0, tx1, ((d * 0.17 + r * 0.09) % 1)), s2 = 12 * cl(kd, 0, 1.2);
        X.save(); X.translate(px, y); X.rotate(Math.PI / 4); X.fillStyle = '#E4FF6A'; X.fillRect(-s2 / 2, -s2 / 2, s2, s2); X.restore(); } });
    const ph = lerp(tx0, tx1, eo(pr(t, o.s + 0.6, o.s + (o.dur || 2.6))));      // رأس التشغيل
    X.strokeStyle = '#FF5A4E'; X.lineWidth = 3; X.beginPath(); X.moveTo(ph, b.y + 88); X.lineTo(ph, b.y + 100 + rows * rh); X.stroke();
    X.fillStyle = '#FF5A4E'; X.beginPath(); X.moveTo(ph - 9, b.y + 80); X.lineTo(ph + 9, b.y + 80); X.lineTo(ph, b.y + 94); X.fill();
    steps.forEach((sTxt, j) => { const kj = pr(t, o.s + 0.6 + j * 0.6, o.s + 0.9 + j * 0.6); if (kj <= 0) return;
      const sw = (b.w - 80) / steps.length, x = b.x + b.w - 40 - (j + 1) * sw + 8, y = b.y + b.h - 92;
      X.globalAlpha *= 1; X.fillStyle = 'rgba(255,255,255,' + (0.16 + 0.14 * kj) + ')'; rrp(x, y, sw - 16, 56, 16); X.fill();
      X.fillStyle = '#fff'; X.font = font(800, 26); X.textAlign = 'center'; X.fillText(sTxt, x + (sw - 16) / 2, y + 37); });
    const ca = o.clickAt || o.s + 2.4, press = pr(t, ca, ca + 0.18), rel = pr(t, ca + 0.18, ca + 0.4), sc = 1 - 0.12 * press + 0.12 * rel;
    X.save(); X.translate(b.x + 110, b.y + 48); X.scale(sc, sc); X.fillStyle = t >= ca ? '#E4FF6A' : '#fff'; rrp(-70, -24, 140, 48, 24); X.fill();
    X.fillStyle = '#1F1F1D'; X.font = font(900, 24); X.textAlign = 'center'; X.fillText('رندر', 0, 9); X.restore();
    X.restore();
  };

  /* 💬 خانة تعليق تنكتب بنفسها + زر إرسال ينبض — o: {s, box, text:'موشن', cps} */
  MK.commentBox = function (t, o) {
    if (!live(t, o)) return; const X = C(), b = o.box, k = eBack(pr(t, o.s, o.s + 0.5)); if (k <= 0) return;
    const h = Math.min(130, b.h), y = b.y + (b.h - h) / 2, txt = o.text || 'موشن', n = Math.floor(cl((t - o.s - 0.4) * (o.cps || 6), 0, txt.length));
    X.save(); X.globalAlpha *= cl(k, 0, 1) * out(t, o); X.translate(b.x + b.w / 2, y + h / 2); X.scale(lerp(0.8, 1, cl(k, 0, 1.1)), lerp(0.8, 1, cl(k, 0, 1.1))); X.translate(-b.w / 2, -h / 2);
    shadow(40, 14, 0.14); X.fillStyle = '#fff'; rrp(0, 0, b.w, h, h / 2); X.fill(); noShadow();
    X.fillStyle = col('INK'); X.font = font(800, h * 0.4); X.direction = 'rtl'; X.textAlign = 'right'; X.textBaseline = 'middle'; X.fillText(txt.slice(0, n), b.w - h * 0.5, h / 2 + 3);
    if (n < txt.length || Math.floor(t * 3) % 2) { const tw = X.measureText(txt.slice(0, n)).width; X.fillStyle = col('ACC'); X.fillRect(b.w - h * 0.5 - tw - 8, h * 0.28, 5, h * 0.44); }
    const done = n >= txt.length, pul = done ? 1 + 0.08 * Math.sin((t - o.s) * 10) : 1;
    X.translate(h * 0.55, h / 2); X.scale(pul, pul); X.fillStyle = done ? col('ACC') : 'rgba(127,127,127,.3)'; X.beginPath(); X.arc(0, 0, h * 0.36, 0, 7); X.fill();
    X.strokeStyle = '#fff'; X.lineWidth = h * 0.07; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(0, h * 0.16); X.lineTo(0, -h * 0.16); X.moveTo(-h * 0.13, -h * 0.03); X.lineTo(0, -h * 0.16); X.lineTo(h * 0.13, -h * 0.03); X.stroke();
    X.restore();
  };

  /* 🔖 ختم ينطبع (يدخل كبير ويخبط مايل) — o: {s, cx, cy, text, sub, color, rot} */
  MK.stamp = function (t, o) {
    if (!live(t, o)) return; const X = C(), k = pr(t, o.s, o.s + 0.3); if (k <= 0) return;
    const sc = lerp(1.9, 1, eBack(k)), c = o.color || col('ACC');
    X.save(); X.globalAlpha *= cl(k * 2, 0, 1) * out(t, o); X.translate(o.cx, o.cy); X.rotate((o.rot == null ? -8 : o.rot) * Math.PI / 180); X.scale(sc, sc);
    X.font = font(900, o.size || 70); X.direction = 'rtl'; const tw = X.measureText(o.text || '').width, w = tw + 90, h = (o.size || 70) * 1.7;
    X.strokeStyle = c; X.lineWidth = 8; rrp(-w / 2, -h / 2, w, h, 22); X.stroke(); X.lineWidth = 3; rrp(-w / 2 + 12, -h / 2 + 12, w - 24, h - 24, 14); X.stroke();
    X.fillStyle = c; X.textAlign = 'center'; X.textBaseline = 'middle'; X.fillText(o.text || '', 0, 4); X.restore();
    const rk = pr(t, o.s + 0.28, o.s + 1.1); if (rk > 0 && rk < 1) { X.save(); X.globalAlpha = (1 - rk) * 0.45; X.strokeStyle = c; X.lineWidth = 6; X.beginPath(); X.arc(o.cx, o.cy, 60 + rk * 320, 0, 7); X.stroke(); X.restore(); }
  };

  /* 🧩 شبكة بطاقات جاهزة: 1 كبيرة + حتى 4 صغار، تنبثق بتتابع — o: {s, box, hero:{...statCard أو null}, cards:[...]} */
  MK.statGrid = function (t, o) {
    const b = o.box, gap = 28, cols = 2, cs = o.cards || [], rowsN = Math.ceil(cs.length / cols);
    const heroH = o.hero ? (b.h - gap) * 0.42 : 0, ch = (b.h - heroH - (o.hero ? gap : 0) - gap * (rowsN - 1)) / Math.max(1, rowsN), cw = (b.w - gap) / cols;
    if (o.hero) MK.statCard(t, Object.assign({ s: o.s, e: o.e, box: { x: b.x, y: b.y, w: b.w, h: heroH } }, o.hero));
    cs.forEach((c2, j) => { const r = Math.floor(j / cols), cI = j % cols;
      MK.statCard(t, Object.assign({ s: o.s + 0.35 + j * 0.13, e: o.e, i: j, box: { x: b.x + b.w - (cI + 1) * cw - cI * gap, y: b.y + heroH + (o.hero ? gap : 0) + r * (ch + gap), w: cw, h: ch } }, c2)); });
  };

  /* 👥 شبكة أيقونات بشر (إنفوقرافيك «X من كل N») — تتعبّى وحدة وحدة، والمظلّلين يتلوّنون ويكبرون بآخرها
     o: {s, box, total:100, hot:4, cols:10, fill:1.4 (مدة التعبئة), hotAt (لحظة تلوين المظلّلين — اربطها بكلمة الرقم), color, hotColor, pick:'random'|'first'} */
  MK.iconArray = function (t, o) {
    if (!live(t, o)) return; const X = C(), b = o.box, N = o.total || 100, cols = o.cols || 10, rows = Math.ceil(N / cols);
    const cw = b.w / cols, ch = b.h / rows, r = Math.min(cw, ch) * 0.36, fill = o.fill || 1.4, hotAt = o.hotAt || o.s + fill + 0.2;
    const hotSet = new Set(); const hN = o.hot || 0;
    if (o.pick === 'first') for (let i = 0; i < hN; i++) hotSet.add(i); else { let seed = 7; while (hotSet.size < hN) { seed = (seed * 9301 + 49297) % 233280; hotSet.add(Math.floor(seed / 233280 * N)); } }
    X.save(); X.globalAlpha *= out(t, o);
    for (let i = 0; i < N; i++) { const rI = Math.floor(i / cols), cI = cols - 1 - (i % cols);            // يتعبّى من اليمين
      const k = eBack(pr(t, o.s + (i / N) * fill, o.s + (i / N) * fill + 0.3)); if (k <= 0) continue;
      const isHot = hotSet.has(i), hk = isHot ? eBack(pr(t, hotAt + [...hotSet].indexOf(i) * 0.12, hotAt + [...hotSet].indexOf(i) * 0.12 + 0.35)) : 0;
      const cx = b.x + cI * cw + cw / 2, cy = b.y + rI * ch + ch / 2, sc = cl(k, 0, 1.1) * (1 + 0.35 * hk);
      X.save(); X.translate(cx, cy); X.scale(sc, sc);
      X.globalAlpha *= isHot && hk > 0 ? 1 : (t > hotAt && hN ? 0.35 : 1);
      X.fillStyle = hk > 0 ? (o.hotColor || '#E5484D') : (o.color || col('INK'));
      X.beginPath(); X.arc(0, -r * 0.55, r * 0.42, 0, 7); X.fill();                      // راس
      X.beginPath(); X.roundRect(-r * 0.62, -r * 0.05, r * 1.24, r * 1.05, [r * 0.62, r * 0.62, r * 0.18, r * 0.18]); X.fill();   // جسم
      X.restore();
      if (hk > 0 && hk < 1) { X.save(); X.globalAlpha = (1 - hk) * 0.6; X.strokeStyle = o.hotColor || '#E5484D'; X.lineWidth = 4; X.beginPath(); X.arc(cx, cy, r * (1 + hk * 1.6), 0, 7); X.stroke(); X.restore(); }
    }
    X.restore();
  };

  G.MK = MK;
})();
