/* الستيج: الإطار والعنوان ثابتين طول الفيلم، والمحتوى يتبدل داخل النافذة بس — فيبين لقطة وحدة.
   قبل 3.2 ث (الجدار) ما فيه نافذة: الجدار ياخذ الشاشة كاملة، وكرت البطل يهبط بمكان النافذة بالضبط. */
const WIN = { x: 60, y: 350, w: 960, h: 1050, r: 34 };
const INTRO = 3.2;
const STEPS = [[INTRO, 'ريل من فيديو كلام'], [5.8, 'موشن ثلاثي الأبعاد'], [8.4, 'بودكاست بكاميرتين'], [11.0, 'مونتاج على الإيقاع'], [13.6, 'كفر وثمبنيل'], [16.2, 'وفيه 100 حركة و17 ستايل']];

/* رسومات مشتركة بين المشاهد ووجه كرت البطل (القطع المطابق: نفس الدالة ترسم الكرت والمشهد) */
window.DEMO = {
  WIN, INTRO, STEPS,
  /* لون من الثيم بشفافية: a(P.ink, .2) — كل الألوان من project.palette، فأي ثيم (فاتح/غامق/عميل) يشتغل بلا تعديل */
  a(hex, al) { const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${al})`; },
  card(X, ctx, fill) { X.save(); X.fillStyle = fill || ctx.P.card; X.fillRect(0, 0, 1080, 1920); X.restore(); },
  /* المشهد 1 عند lt: موجة صوت فيها سكتات، السكتات تنشال والموجة تتلاصق */
  reel(X, ctx, lt) {
    const { P, E, prog, clamp } = ctx;
    DEMO.card(X, ctx);
    const cy = 760, x0 = 120, x1 = 960, bars = 64, bw = (x1 - x0) / bars;
    const gaps = [[14, 20], [33, 38], [49, 54]];                  // السكتات (بأرقام الأعمدة)
    const kCut = E.expoInOut(prog(lt, .35, 1.05));
    const isGap = i => gaps.some(([a, b]) => i >= a && i < b);
    // كل عمود يتزحزح لليمين بعدد عرض السكتات اللي قبله (RTL: الكلام يمشي من اليمين)
    let shift = 0; const xs = [];
    for (let i = 0; i < bars; i++) { if (isGap(i)) shift += bw; xs.push(shift); }
    const total = shift;
    for (let i = 0; i < bars; i++) {
      const gap = isGap(i), n = ctx.noise1(i * .55, 3) * .5 + .5, pulse = ctx.noise1(i * .3 + lt * 6, 9) * .5 + .5;
      const h = gap ? 10 : 40 + n * 220 * (.75 + .25 * pulse);
      const x = x1 - (i + 1) * bw + xs[i] * kCut - total * kCut / 2;
      const a = gap ? 1 - kCut : 1;
      if (a <= 0) continue;
      X.globalAlpha = a; X.fillStyle = gap ? P.well2 : (i % 9 === 4 ? P.acc : P.ink);
      X.beginPath(); X.roundRect(x + 3, cy - h / 2, bw - 6, h, 4); X.fill();
    }
    X.globalAlpha = 1;
    // مقص على السكتات قبل القص
    gaps.forEach(([a, b], g) => {
      const k = clamp(1 - kCut * 1.6), x = x1 - ((a + b) / 2) * bw;
      if (k <= 0) return;
      X.save(); X.globalAlpha = k; X.strokeStyle = P.acc; X.lineWidth = 4; X.setLineDash([10, 10]);
      X.beginPath(); X.moveTo(x, cy - 190); X.lineTo(x, cy + 190); X.stroke(); X.restore();
    });
    // كابشن بتوقيت الكلمة: الكلمة الحالية بكبسولة برتقالية
    const words = ['كابشن', 'عربي', 'بتوقيت', 'الكلمة'];
    const L = ctx.text.layout(X, words.join(' '), { family: 'display', weight: 800, size: 62 });
    const cur = Math.floor(clamp((lt - 1.15) / .32, 0, 3.999));
    const kin = E.expoOut(prog(lt, 1.0, 1.4));
    if (kin > 0) {
      const boxes = ctx.text.drawLayout(X, L, 540, 1110, { color: P.ink, perWord: (i, w, b) => {
        const a = E.expoOut(prog(lt, 1.0 + i * .06, 1.4 + i * .06));
        if (i === cur && lt > 1.15) { X.save(); X.fillStyle = P.acc; X.beginPath(); X.roundRect(b.x - 14, b.y + 6, b.w + 28, b.h - 6, 22); X.fill(); X.restore(); }
        return { alpha: a, dy: (1 - a) * 40, color: i === cur && lt > 1.15 ? P.onAcc : P.ink };
      } });
    }
    // سطر صغير تحت
    ctx.text(X, 'السكتات تنشال', 540, 480, { family: 'body', weight: 700, size: 40, color: P.mut });
  },
};

MOTION.stage({
  window: t => t < INTRO ? null : WIN,
  introEnd: INTRO + .01,
  setup(ctx) { },
  under(t, lt, ctx) {
    const { X, P, E, prog } = ctx;
    X.fillStyle = P.bg; X.fillRect(0, 0, 1080, 1920);
    // شبكة نقاط خفيفة جداً (تحس عمق بلا ما تزحم)
    X.fillStyle = DEMO.a(P.ink, .07);
    for (let y = 30; y < 1920; y += 60) for (let x = 30; x < 1080; x += 60) X.fillRect(x - 1.5, y - 1.5, 3, 3);
    // توهّج برتقالي تحت النافذة يتنفس مع النبضة
    // النافذة ورقة مرفوعة: ظلها على الخلفية (يطلع مع الإطار)
    const kS = E.cubicOut(prog(t, INTRO - .3, INTRO + .4));
    if (kS > 0) { X.save(); X.shadowColor = DEMO.a(P.shadow, .22 * kS); X.shadowBlur = 70; X.shadowOffsetY = 28; X.fillStyle = P.card; X.beginPath(); X.roundRect(WIN.x, WIN.y, WIN.w, WIN.h, WIN.r); X.fill(); X.restore(); }
  },
  over(t, lt, ctx) {
    const { X, P, E, prog, at } = ctx;
    // تظليل فوق عشان العنوان ينقرا فوق الجدار
    const kTop = E.cubicOut(prog(t, 1.2, 1.7));
    if (t < INTRO + .3) { const g = X.createLinearGradient(0, 0, 0, 560); g.addColorStop(0, DEMO.a(P.bg, .97 * kTop)); g.addColorStop(.55, DEMO.a(P.bg, .85 * kTop)); g.addColorStop(1, DEMO.a(P.bg, 0)); X.fillStyle = g; X.fillRect(0, 0, 1080, 560); }
    // العنوان الثابت
    const kT = E.expoOut(prog(t, 1.5, 2.1));
    ctx.text(X, 'بلقن الفيديو', 540, 222, { family: 'display', weight: 900, size: 64, color: P.ink, alpha: kT });
    // الخانة اللي تتبدل تحته
    ctx.text.slot(X, t, STEPS, { x: 540, y: 316, size: 76, family: 'display', weight: 900, color: P.clay, dur: .5, stagger: .05 });
    // الإطار: خط يرتسم حول النافذة لما الكرت يهبط
    const kF = E.expoOut(prog(t, INTRO - .25, INTRO + .55));
    if (kF > 0) {
      const o = 14, x = WIN.x - o, y = WIN.y - o, w = WIN.w + 2 * o, h = WIN.h + 2 * o;
      X.save(); X.strokeStyle = DEMO.a(P.ink, .14 * kF); X.lineWidth = 2;
      X.beginPath(); X.roundRect(x, y, w, h, WIN.r + o); X.stroke();
      X.restore();
      // شريط التقدّم + العدّاد
      const segs = 5, gap = 12, bw = (WIN.w - gap * (segs - 1)) / segs, by = 1440;
      for (let i = 0; i < segs; i++) {
        const s0 = STEPS[i][0], s1 = STEPS[i + 1][0], k = prog(t, s0, s1 - .25);
        const x0 = WIN.x + WIN.w - (i + 1) * bw - i * gap;              // RTL: يبدأ من اليمين
        X.globalAlpha = kF; X.fillStyle = DEMO.a(P.ink, .1); X.beginPath(); X.roundRect(x0, by, bw, 8, 4); X.fill();
        X.fillStyle = P.acc; X.beginPath(); X.roundRect(x0 + bw * (1 - k), by, bw * k, 8, 4); X.fill();
      }
      X.globalAlpha = 1;
      ctx.text.slot(X, t, STEPS.slice(0, 5).map((s, i) => [s[0], String(i + 1)]), { x: 520, y: 1494, size: 34, family: 'num', weight: 700, color: P.ink, dur: .35, instant: false });
      ctx.text(X, '/ 5', 548, 1494, { family: 'num', weight: 500, size: 30, color: P.mut, alpha: kF, dir: 'ltr', align: 'left' });
    }
  },
});
