/* s1 — ونشوت: شكل واحد ما ينقص ولا ينقطع. زر ← لودر ← صح ← حقل ← صفّين ← مفتاح ← بطاقة ← زر (لوب).
   كل شي من الزمن t بس (بلا تايمرز ولا تراكم). المؤشر يسوي كل تغيير، والكاميرا تقرّب لين الحالة تملا الشاشة.
   120 BPM: نص ثانية = ضربة. آخر فريم = أول فريم. */
const TS = [0, 1.05, 2.05, 3.05, 5.55, 7.55, 9.05, 10.55];      // بداية تحوّل كل حالة (ثواني)
const G = [   // w, h, r, zoom
  [560, 170, 85, 1.25], [170, 170, 85, 3.1], [170, 170, 85, 3.1], [880, 170, 38, 1.0],
  [880, 380, 48, 1.0], [560, 170, 85, 1.5], [880, 260, 48, 1.0], [560, 170, 85, 1.25]];
const FILL = ['#1B1A17', '#1B1A17', '#D97757', '#FFFFFF', '#FFFFFF', '#1B1A17', '#1B1A17', '#1B1A17'];
const CLICKS = [1.0, 3.4, 6.1, 6.9, 8.25];
// المؤشر: [وقت، x، y] بإحداثيات العالم (مركز الشكل = 0,0)
const CUR = [[0, 430, 360], [0.45, 430, 360], [1.0, 70, 35], [2.6, 120, 90], [3.0, 120, 90], [3.4, -250, 10], [5.3, -250, 10],
  [5.9, 250, -90], [6.1, 250, -90], [6.7, 300, 125], [6.9, 300, 125], [7.6, 40, 30], [8.0, -190, 0], [8.25, -190, 0],
  [9.0, 300, 200], [10.4, 300, 200], [11.2, 520, 420], [12, 520, 420]];
const SPR = (E, p) => E.springK(Math.min(1, Math.max(0, p)));
MOTION.scene({
  id: 's1', start: 0, end: 12,
  draw(t, lt, ctx) {
    const { X, E, P, prog, at } = ctx;
    X.fillStyle = P.bg; X.fillRect(0, 0, ctx.W, ctx.H);
    // حالة الشكل: نمزج بين حالة i-1 وi
    let i = 0; for (let k = 0; k < TS.length; k++) if (t >= TS[k]) i = k;
    const j = Math.max(0, i - 1), k = i === 0 ? 1 : SPR(E, prog(t, TS[i], TS[i] + 0.5));
    const mix = (a, b) => a + (b - a) * k;
    const w = mix(G[j][0], G[i][0]), h = mix(G[j][1], G[i][1]), r = mix(G[j][2], G[i][2]), z = mix(G[j][3], G[i][3]);
    const hexRGB = (c) => [1, 3, 5].map((n) => parseInt(c.slice(n, n + 2), 16));
    const fa = hexRGB(FILL[j]), fb = hexRGB(FILL[i]);
    const fill = 'rgb(' + fa.map((v, n) => Math.round(v + (fb[n] - v) * k)).join(',') + ')';
    const pulse = 1 + 0.012 * ctx.beatPulse(t, 10);
    X.save(); X.translate(540, 900); X.scale(z * pulse, z * pulse);
    // الشكل الواحد
    X.save(); X.shadowColor = 'rgba(27,26,23,0.22)'; X.shadowBlur = 40; X.shadowOffsetY = 14;
    X.fillStyle = fill; X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, r); X.fill(); X.restore();
    if (FILL[i] === '#FFFFFF' || FILL[j] === '#FFFFFF') { X.strokeStyle = 'rgba(27,26,23,' + (0.14 * (FILL[i] === '#FFFFFF' ? k : 1 - k)) + ')'; X.lineWidth = 3; X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, r); X.stroke(); }
    // المحتوى: القديم يطلع قبل التحوّل، والجديد يدخل بعد ما يبدأ الحاوي يتحوّل (ما يتراكب نص)
    const content = (s, a) => { if (a > 0.01) { X.save(); X.globalAlpha = a; drawContent(s); X.restore(); } };
    const drawContent = (s) => {
      const W0 = '#FFFFFF', INK = P.ink;
      if (s === 0 || s === 7) ctx.text(X, 'ضيف الماركت بليس', 0, 18, { family: 'body', weight: 700, size: 52, color: W0, align: 'center', maxWidth: 480 });
      else if (s === 1) { X.strokeStyle = W0; X.lineWidth = 11; X.lineCap = 'round'; X.beginPath(); X.arc(0, 0, 42, t * 7, t * 7 + 4.2); X.stroke(); }
      else if (s === 2) { const c = at(t, TS[2] + 0.2, TS[2] + 0.55, 'expoOut'); X.strokeStyle = W0; X.lineWidth = 14; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath(); X.moveTo(-28, 4); const a1 = Math.min(1, c * 2), a2 = Math.max(0, c * 2 - 1); X.lineTo(-28 + 18 * a1, 4 + 20 * a1); if (a2 > 0) X.lineTo(-10 + 40 * a2, 24 - 46 * a2); X.stroke(); }
      else if (s === 3) { const txt = ctx.text.typeSub('majedphotos/majed-plugins', prog(t, 3.5, 5.0)); ctx.text(X, txt, -400, 20, { family: 'num', weight: 600, size: 56, color: INK, align: 'left', dir: 'ltr' }); if (Math.floor(t * 4) % 2 === 0) { X.fillStyle = P.acc; X.fillRect(-400 + Math.min(780, X.measureText(txt).width + 6), -34, 5, 68); } }
      else if (s === 4) {
        [['content-engine-v5', '5.0.1', -90, 6.1], ['majed-video', '4.3.5', 90, 6.9]].forEach(([n, v, y, ck]) => {
          ctx.text(X, n, -400, y + 18, { family: 'num', weight: 700, size: 50, color: INK, align: 'left', dir: 'ltr' });
          const on = at(t, ck, ck + 0.3, 'backOut'); X.fillStyle = on > 0.05 ? P.acc : 'rgba(27,26,23,0.08)'; X.beginPath(); X.roundRect(190, y - 38, 190, 76, 38); X.fill();
          ctx.text(X, on > 0.5 ? 'مضاف ✓' : v, 285, y + 14, { family: on > 0.5 ? 'body' : 'num', weight: 700, size: 38, color: on > 0.5 ? '#FFFFFF' : INK, align: 'center' });
        });
      }
      else if (s === 5) {
        const flip = SPR(E, prog(t, 8.25, 8.65));
        ctx.text(X, 'تحديث تلقائي', 95, 18, { family: 'body', weight: 700, size: 50, color: W0, align: 'center', maxWidth: 250 });
        X.fillStyle = flip > 0.5 ? P.acc : 'rgba(255,255,255,0.28)'; X.beginPath(); X.roundRect(-250, -40, 150, 80, 40); X.fill();
        X.fillStyle = '#FFFFFF'; X.beginPath(); X.arc(-210 + 70 * flip, 0, 30, 0, 6.2832); X.fill();
      }
      else if (s === 6) { ctx.text(X, 'ديسكتوب + جوال', 0, -6, { family: 'display', weight: 400, size: 96, color: W0, align: 'center', maxWidth: 780 }); ctx.text(X, 'من نفس الحساب', 0, 78, { family: 'body', weight: 400, size: 44, color: P.hi, align: 'center' }); }
    };
    const kin = at(t, TS[i] + 0.2, TS[i] + 0.4, 'cubicOut');
    if (i === 0) content(0, 1); else { content(j, 1 - at(t, TS[i], TS[i] + 0.16, 'cubicIn')); content(i, kin); }
    X.restore();
    // المؤشر + نقرة
    let cx = CUR[CUR.length - 1][1], cy = CUR[CUR.length - 1][2];
    for (let n = 0; n < CUR.length - 1; n++) { const a = CUR[n], b = CUR[n + 1]; if (t >= a[0] && t <= b[0]) { const q = E.cubicInOut(prog(t, a[0], b[0])); cx = a[1] + (b[1] - a[1]) * q; cy = a[2] + (b[2] - a[2]) * q; break; } }
    const sx = 540 + cx * z, sy = 900 + cy * z;
    CLICKS.forEach((ct) => { const q = prog(t, ct, ct + 0.35); if (q > 0 && q < 1) { X.save(); X.strokeStyle = 'rgba(217,119,87,' + (0.7 * (1 - q)) + ')'; X.lineWidth = 6; X.beginPath(); X.arc(sx, sy, (14 + 60 * q) * Math.max(1, z * 0.6), 0, 6.2832); X.stroke(); X.restore(); } });
    const dip = CLICKS.some((ct) => t >= ct && t < ct + 0.14) ? 0.86 : 1, cs = Math.max(1, z * 0.7) * dip;
    X.save(); X.translate(sx, sy); X.scale(cs, cs); X.fillStyle = '#FFFFFF'; X.strokeStyle = '#1B1A17'; X.lineWidth = 3; X.lineJoin = 'round';
    X.beginPath(); X.moveTo(0, 0); X.lineTo(0, 40); X.lineTo(10, 31); X.lineTo(18, 48); X.lineTo(25, 45); X.lineTo(17, 28); X.lineTo(30, 28); X.closePath(); X.fill(); X.stroke(); X.restore();
  },
});
