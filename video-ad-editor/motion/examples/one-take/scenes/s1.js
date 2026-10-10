/* s1 — ونشوت v2: «ضيف الماركت بليس» بلقطة وحدة، الكاميرا ما تقطع أبداً.
   عالم A (صفحة البلقنات) ← نقرة على الزر الأسود ← زوم إن لين الزر يبلع الشاشة (أسود)
   ← عالم B (نكتب الرابط) ← Enter يفتح دايرة برتقالية ← عالم C (بلقنين + تحديث تلقائي)
   ← زوم آوت: كل اللي شفناه كان شاشة جوال جنب لابتوب ← الجوال يرجع لصفحة A ← زوم إن لين الجوال يملا الإطار = أول فريم (لوب).
   كل شي من t بس. موشن بلير حقيقي وقت الزوم: متوسط عيّنات زمنية. */
const W = 1080, H = 1920;
const PILL = { x: 540, y: 1240, w: 600, h: 140 };
const PH = { x: 640, y: 1010, w: 330, h: 587 };            // شاشة الجوال (9:16 بالضبط)
const PHC = { x: PH.x + PH.w / 2, y: PH.y + PH.h / 2 };
const LAP = { x: 120, y: 430, w: 840, h: 525 };          // شاشة اللابتوب
const SPH = W / PH.w;                                     // زوم الجوال لين يملا الإطار
const BLUR = [[0.95, 2.0], [4.35, 5.15], [9.2, 11.1], [13.0, 14.6]];
const URL = 'majedphotos/majed-plugins';

MOTION.scene({
  id: 's1', start: 0, end: 16,
  setup() { this.o = document.createElement('canvas'); },
  draw(t, lt, ctx) {
    const { X, E, P, prog, at } = ctx;
    const C = (v, a, b) => Math.min(b, Math.max(a, v));
    const SPR = (p) => E.springK(C(p, 0, 1));
    const lerp = (a, b, k) => a + (b - a) * k;

    // ── المؤشر (يرسم داخل العالم، فيكبر ويطير مع الكاميرا)
    const cursor = (Y, x, y, press, sc = 1) => {
      Y.save(); Y.translate(x, y); Y.scale(sc * (press ? 0.86 : 1), sc * (press ? 0.86 : 1));
      Y.fillStyle = '#FFFFFF'; Y.strokeStyle = '#1B1A17'; Y.lineWidth = 3; Y.lineJoin = 'round';
      Y.beginPath(); Y.moveTo(0, 0); Y.lineTo(0, 40); Y.lineTo(10, 31); Y.lineTo(18, 48); Y.lineTo(25, 45); Y.lineTo(17, 28); Y.lineTo(30, 28); Y.closePath(); Y.fill(); Y.stroke(); Y.restore();
    };
    const ring = (Y, x, y, t, ct, col) => { const q = prog(t, ct, ct + 0.4); if (q > 0 && q < 1) { Y.save(); Y.strokeStyle = col; Y.globalAlpha = 0.8 * (1 - q); Y.lineWidth = 6; Y.beginPath(); Y.arc(x, y, 16 + 70 * E.cubicOut(q), 0, 6.2832); Y.stroke(); Y.restore(); } };
    const path = (t, pts) => { // [[t,x,y],...] → [x,y]
      if (t <= pts[0][0]) return [pts[0][1], pts[0][2]];
      for (let n = 0; n < pts.length - 1; n++) { const a = pts[n], b = pts[n + 1]; if (t <= b[0]) { const q = E.cubicInOut(prog(t, a[0], b[0])); return [lerp(a[1], b[1], q), lerp(a[2], b[2], q)]; } }
      const z = pts[pts.length - 1]; return [z[1], z[2]];
    };

    // ── عالم A: صفحة البلقنات بكلود (ta = وقت محلي؛ 0 = حالة البداية/اللوب)
    const worldA = (Y, ta) => {
      Y.fillStyle = P.bg; Y.fillRect(0, 0, W, H);
      ctx.text(Y, 'ضيف الماركت بليس', 540, 360, { family: 'display', size: 112, color: P.ink, align: 'center', maxWidth: 960 });
      ctx.text(Y, 'بلقنات ماجد كلها بخطوة وحدة', 540, 440, { family: 'body', weight: 500, size: 42, color: P.mut, align: 'center' });
      Y.save(); Y.shadowColor = 'rgba(27,26,23,0.16)'; Y.shadowBlur = 50; Y.shadowOffsetY = 18;
      Y.fillStyle = '#FFFFFF'; Y.beginPath(); Y.roundRect(110, 540, 860, 860, 48); Y.fill(); Y.restore();
      [0, 1, 2].forEach((n) => { Y.fillStyle = ['#E8A283', '#D9D3C7', '#D9D3C7'][n]; Y.beginPath(); Y.arc(170 + n * 36, 600, 11, 0, 6.2832); Y.fill(); });
      ctx.text(Y, 'Customize  ›  Plugins', 170, 690, { family: 'num', weight: 500, size: 34, color: P.mut, align: 'left', dir: 'ltr' });
      ctx.text(Y, 'Plugins', 170, 785, { family: 'num', weight: 800, size: 76, color: P.ink, align: 'left', dir: 'ltr' });
      [[870, 0.78], [960, 0.55], [1050, 0.66]].forEach(([y, f]) => {
        Y.fillStyle = '#F0EBE0'; Y.beginPath(); Y.roundRect(170, y - 26, 72, 52, 14); Y.fill();
        Y.beginPath(); Y.roundRect(266, y - 14, 560 * f, 28, 14); Y.fill();
      });
      // الزر الأسود: ينضغط ثم يطفي نصه (عشان الزوم يدخل بأسود صافي)
      const press = ta > 1.0 && ta < 1.14 ? 0.96 : 1;
      Y.save(); Y.translate(PILL.x, PILL.y); Y.scale(press, press);
      Y.fillStyle = P.ink; Y.beginPath(); Y.roundRect(-PILL.w / 2, -PILL.h / 2, PILL.w, PILL.h, PILL.h / 2); Y.fill();
      const la = 1 - at(ta, 1.06, 1.24, 'cubicIn');
      if (la > 0.01) { Y.globalAlpha = la; ctx.text(Y, '+  Add marketplace', 0, 16, { family: 'num', weight: 700, size: 46, color: '#FFFFFF', align: 'center', dir: 'ltr' }); }
      Y.restore();
      const [cx, cy] = path(ta, [[0.3, 860, 1560], [0.95, 610, 1262]]);
      ring(Y, 610, 1262, ta, 1.0, P.acc);
      cursor(Y, cx, cy, ta >= 1.0 && ta < 1.14);
    };

    // ── عالم B: أسود، نكتب الرابط، Enter
    const worldB = (Y, t) => {
      Y.fillStyle = P.ink; Y.fillRect(0, 0, W, H);
      const lab = at(t, 2.0, 2.4, 'expoOut');
      Y.save(); Y.globalAlpha = lab; ctx.text(Y, 'الصق هالرابط', 540, 760 + 40 * (1 - lab), { family: 'display', size: 84, color: P.hi, align: 'center' }); Y.restore();
      const fw = 940 * at(t, 2.1, 2.55, 'expoOut');
      if (fw > 2) { Y.strokeStyle = 'rgba(255,255,255,0.32)'; Y.lineWidth = 4; Y.beginPath(); Y.roundRect(540 - fw / 2, 860, fw, 180, 36); Y.stroke(); }
      const typed = URL.slice(0, Math.round(URL.length * C(prog(t, 2.6, 4.0), 0, 1)));
      Y.font = ctx.font('num', 600, 56);
      if (typed) ctx.text(Y, typed, 112, 970, { family: 'num', weight: 600, size: 56, color: '#FFFFFF', align: 'left', dir: 'ltr' });
      if (t > 2.55 && Math.floor(t * 4) % 2 === 0) { Y.fillStyle = P.acc; Y.fillRect(112 + Y.measureText(typed).width + 8, 920, 6, 70); }
      // مفتاح Enter
      const k = SPR(prog(t, 4.0, 4.45)), pr = t >= 4.45 && t < 4.6;
      if (k > 0.01) {
        Y.save(); Y.translate(540, 1250); Y.scale(k * (pr ? 0.9 : 1), k * (pr ? 0.9 : 1));
        Y.fillStyle = t >= 4.45 ? P.acc : 'rgba(255,255,255,0.08)'; Y.strokeStyle = 'rgba(255,255,255,0.5)'; Y.lineWidth = 4;
        Y.beginPath(); Y.roundRect(-170, -80, 340, 160, 34); Y.fill(); if (t < 4.45) Y.stroke();
        ctx.text(Y, 'Enter ⏎', 0, 20, { family: 'num', weight: 700, size: 56, color: '#FFFFFF', align: 'center', dir: 'ltr' });
        Y.restore();
      }
    };

    // ── عالم C: برتقالي، بلقنين ينضافون، ثم تحديث تلقائي
    const worldC = (Y, t) => {
      Y.fillStyle = P.acc; Y.fillRect(0, 0, W, H);
      const out = (d) => E.expoIn(C(prog(t, 7.25 + d, 7.75 + d), 0, 1)) * -1500;
      const hd = at(t, 5.05, 5.5, 'expoOut');
      Y.save(); Y.globalAlpha = hd; ctx.text(Y, 'بلقنين جاهزين', 540, 520 + 60 * (1 - hd) + out(0), { family: 'display', size: 120, color: '#FFFFFF', align: 'center' }); Y.restore();
      [['content-engine-v5', 'مصنع المحتوى', 820, 5.2, 6.15], ['majed-video', 'بلقن الفيديو', 1110, 5.42, 6.75]].forEach(([n, a, y, t0, ck], i) => {
        const dy = (1 - SPR(prog(t, t0, t0 + 0.6))) * 1300 + out(0.07 * (i + 1));
        Y.save(); Y.translate(0, y + dy);
        Y.save(); Y.shadowColor = 'rgba(80,30,10,0.22)'; Y.shadowBlur = 40; Y.shadowOffsetY = 16; Y.fillStyle = '#FFFFFF'; Y.beginPath(); Y.roundRect(90, -115, 900, 230, 44); Y.fill(); Y.restore();
        ctx.text(Y, n, 140, -12, { family: 'num', weight: 800, size: 50, color: P.ink, align: 'left', dir: 'ltr' });
        ctx.text(Y, a, 140, 56, { family: 'body', weight: 500, size: 38, color: P.mut, align: 'left' });
        const on = SPR(prog(t, ck, ck + 0.35));
        Y.fillStyle = on > 0.5 ? P.ink : '#E7E1D6'; Y.beginPath(); Y.roundRect(770, -40, 170, 84, 42); Y.fill();
        Y.fillStyle = '#FFFFFF'; Y.beginPath(); Y.arc(812 + 86 * on, 2, 32, 0, 6.2832); Y.fill();
        Y.restore();
      });
      // المفتاح الكبير
      const g = SPR(prog(t, 7.7, 8.3)), on = SPR(prog(t, 8.55, 8.95));
      if (g > 0.01) {
        Y.save(); Y.translate(540, 900); Y.scale(g, g);
        Y.fillStyle = on > 0.5 ? P.ink : 'rgba(255,255,255,0.3)'; Y.beginPath(); Y.roundRect(-290, -140, 580, 280, 140); Y.fill();
        Y.fillStyle = '#FFFFFF'; Y.beginPath(); Y.arc(-150 + 300 * on, 0, 112, 0, 6.2832); Y.fill();
        Y.restore();
        const tx = at(t, 7.9, 8.4, 'expoOut');
        Y.save(); Y.globalAlpha = tx;
        ctx.text(Y, 'تحديث تلقائي', 540, 1250 + 50 * (1 - tx), { family: 'display', size: 124, color: '#FFFFFF', align: 'center' });
        ctx.text(Y, 'Sync automatically', 540, 1335 + 50 * (1 - tx), { family: 'num', weight: 600, size: 44, color: 'rgba(255,255,255,0.85)', align: 'center', dir: 'ltr' });
        Y.restore();
      }
      const [cx, cy] = path(t, [[5.5, 980, 1700], [6.05, 880, 840], [6.35, 880, 840], [6.65, 880, 1130], [7.0, 880, 1130], [8.4, 660, 920], [9.2, 760, 1060]]);
      [6.15, 6.75].forEach((ct, i) => ring(Y, 880, [840, 1130][i], t, ct, P.ink));
      ring(Y, 660, 920, t, 8.55, P.ink);
      if (t > 5.45) cursor(Y, cx, cy, [6.15, 6.75, 8.55].some((c) => t >= c && t < c + 0.14));
    };

    // ── عالم D: لابتوب + جوال؛ الشاشات تعرض العوالم الحية
    const inRect = (Y, R, rr, drawW, fit) => { // fit: 'fill' (9:16) أو 'cover' مع وسط y
      Y.save(); Y.beginPath(); Y.roundRect(R.x, R.y, R.w, R.h, rr); Y.clip();
      const s = R.w / W, oy = fit === 'cover' ? R.y + R.h / 2 - 1060 * s : R.y;
      Y.translate(R.x, oy); Y.scale(s, s); drawW(Y); Y.restore();
    };
    const worldD = (Y, t, rr) => {
      Y.fillStyle = P.bg; Y.fillRect(0, 0, W, H);
      // لابتوب
      Y.fillStyle = P.ink; Y.beginPath(); Y.roundRect(LAP.x - 22, LAP.y - 22, LAP.w + 44, LAP.h + 44, 30); Y.fill();
      inRect(Y, LAP, 8, (Z) => worldC(Z, Math.min(t, 9.2)), 'cover');
      Y.fillStyle = '#2B2A27'; Y.beginPath(); Y.moveTo(LAP.x - 70, LAP.y + LAP.h + 22); Y.lineTo(LAP.x + LAP.w + 70, LAP.y + LAP.h + 22); Y.lineTo(LAP.x + LAP.w + 40, LAP.y + LAP.h + 58); Y.lineTo(LAP.x - 40, LAP.y + LAP.h + 58); Y.closePath(); Y.fill();
      // جوال (شاشته تعرض C، وبعدين A تطلع من تحت)
      Y.save(); Y.shadowColor = 'rgba(27,26,23,0.28)'; Y.shadowBlur = 60; Y.shadowOffsetY = 24;
      Y.fillStyle = P.ink; Y.beginPath(); Y.roundRect(PH.x - 18, PH.y - 18, PH.w + 36, PH.h + 36, 58); Y.fill(); Y.restore();
      const sw = E.expoInOut(C(prog(t, 12.3, 12.9), 0, 1));
      inRect(Y, PH, rr, (Z) => {
        if (sw < 1) { Z.save(); Z.translate(0, -H * sw); worldC(Z, Math.min(t, 9.2)); Z.restore(); }
        if (sw > 0) { Z.save(); Z.translate(0, H * (1 - sw)); worldA(Z, 0); Z.restore(); }
      }, 'fill');
      const tx = at(t, 10.4, 10.9, 'expoOut');
      Y.save(); Y.globalAlpha = tx;
      ctx.text(Y, 'ديسكتوب', 330, 1210 + 50 * (1 - tx), { family: 'display', size: 120, color: P.ink, align: 'center', maxWidth: 520 });
      ctx.text(Y, '+ جوال', 330, 1350 + 50 * (1 - tx), { family: 'display', size: 120, color: P.acc, align: 'center', maxWidth: 520 });
      ctx.text(Y, 'من نفس الحساب', 330, 1440 + 50 * (1 - tx), { family: 'body', weight: 500, size: 44, color: P.mut, align: 'center' });
      Y.restore();
    };

    // ── الكاميرا: عالم واحد لكل لحظة، والانتقال دايماً زوم
    const frame = (Y, t) => {
      if (t < 1.05 || t >= 14.6) { worldA(Y, t >= 14.6 ? 0 : t); return; }
      if (t < 1.95) { // زوم إن لين الزر يبلع الشاشة
        const e = E.expoIn(prog(t, 1.05, 1.95)), m = E.cubicInOut(prog(t, 1.05, 1.6));
        const s = Math.exp(e * Math.log(40));
        Y.save(); Y.translate(PILL.x, lerp(PILL.y, 960, m)); Y.scale(s, s); Y.translate(-PILL.x, -PILL.y); worldA(Y, t); Y.restore(); return;
      }
      if (t < 4.45) { worldB(Y, t); return; }
      if (t < 9.2) { // دايرة Enter تفتح C
        worldB(Y, Math.min(t, 4.6));
        const r = 2300 * E.expoIn(C(prog(t, 4.45, 5.05), 0, 1)) + 90 * C(prog(t, 4.45, 4.5), 0, 1);
        Y.save(); Y.beginPath(); Y.arc(540, 1250, r, 0, 6.2832); Y.clip(); worldC(Y, t); Y.restore(); return;
      }
      // D: زوم آوت من شاشة الجوال (9.2→11.0) … ثم زوم إن للجوال (13.0→14.6)
      let e = 1;
      if (t < 11.0) e = E.expoOut(prog(t, 9.2, 11.0));
      else if (t >= 13.0) e = 1 - E.expoIn(prog(t, 13.0, 14.6));
      const s = Math.exp((1 - e) * Math.log(SPH));
      Y.save(); Y.translate(lerp(540, PHC.x, e), lerp(960, PHC.y, e)); Y.scale(s, s); Y.translate(-PHC.x, -PHC.y);
      worldD(Y, t, 40 * e); Y.restore();
    };

    // ── موشن بلير: متوسط عيّنات خلال نص فريم وقت الزوم
    const N = BLUR.some(([a, b]) => t >= a && t <= b) ? 7 : 1;
    if (N === 1) { frame(X, t); return; }
    const o = this.o; if (o.width !== X.canvas.width || o.height !== X.canvas.height) { o.width = X.canvas.width; o.height = X.canvas.height; }
    const O = o.getContext('2d'), T = X.getTransform();
    for (let i = 0; i < N; i++) {
      O.setTransform(1, 0, 0, 1, 0, 0); O.clearRect(0, 0, o.width, o.height); O.setTransform(T);
      frame(O, t - (i / N) * (0.5 / 60));
      X.save(); ctx.resetTransform(X); X.globalAlpha = 1 / (i + 1); X.drawImage(o, 0, 0, W, H); X.restore();
    }
  },
});
