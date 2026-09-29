/* s2 — مشهد كتابة حركية 2D: «أسرع» تتمطّط بالكشيدة لين عرض الشاشة + عدّاد أرقام غربية + كلمات تطلع من تحت قناع */
MOTION.scene({
  id: 's2', start: 1.5, end: 3.0,
  setup(ctx) {
    this.bits = ctx.particles2D({ count: 40, seed: 5, spawn: (i, r) => ({ x: r.range(80, 1000), y: r.range(1100, 1400), vx: r.gauss() * 40, vy: -r.range(60, 180), r: r.range(3, 7), color: r.pick([ctx.P.acc, ctx.P.clay, ctx.P.ink]), delay: r.range(0.9, 1.2), life: 0.9, shape: r.pick(['circle', 'rect', 'tri']) }) });
  },
  draw(t, lt, ctx) {
    const { X, P, at, E } = ctx;
    X.fillStyle = P.bg; X.fillRect(0, 0, ctx.W, ctx.H);
    // beat-synced accent bars behind (rhythm, not decoration: they kick on every beat)
    const bp = ctx.beatPulse(t, 10);
    X.fillStyle = P.acc; X.globalAlpha = 0.10 + 0.10 * bp; X.fillRect(0, 560 - 30 * bp, ctx.W, 360 + 60 * bp); X.globalAlpha = 1;

    // 1) per-word rise: «نفس الشغل،» (word-mask reveal)
    const L = ctx.text.layout(X, 'نفس الشغل،', { family: 'body', weight: 700, size: 92 });
    ctx.text.drawLayout(X, L, 540, 470, { align: 'center', color: P.ink, perWord: (i) => { const k = at(lt, 0.05 + i * 0.12, 0.5 + i * 0.12, 'expoOut'); return { clipUp: 1, dy: (1 - k) * 120, alpha: k > 0 ? 1 : 0 }; } });

    // 2) kashida stretch: «بس أسرع» grows to the full safe width
    const wA = ctx.wordTime('l2', 1);                       // «أسرع» — stretch while it is being said
    const kk = ctx.at(t, wA.s - 0.05, wA.e + 0.25, 'expoInOut');
    ctx.text.drawKashida(X, 'بس أسرع', 540, 820, 900, { family: 'display', weight: 400, size: 230, color: P.clay }, kk);

    // 3) counter with western digits + hand-drawn underline
    const kc = at(lt, 0.45, 1.15, 'expoOut'), v = Math.round(300 * kc);
    const land = at(lt, 1.15, 1.45, 'backOut');
    X.save(); X.translate(540, 1180); const s = 1 + 0.12 * Math.sin(Math.PI * ctx.prog(lt, 1.15, 1.4)); X.scale(s, s);
    ctx.text(X, ctx.num(v) + '%', 0, 0, { family: 'num', weight: 900, size: 210, color: P.ink, dir: 'ltr' });
    X.restore();
    ctx.drawPath(X, [[250, 1235], [420, 1255], [640, 1242], [830, 1228]], at(lt, 1.0, 1.35, 'cubicOut'), { width: 14, color: P.acc, tip: { r: 9, color: P.acc } });
    if (ctx.MK) ctx.MK.burst(t, { s: ctx.scene.start + 1.15, cx: 540, cy: 1100, spread: 260, n: 22 });
    this.bits.draw(X, lt);
    // caption line (safe: above 1500)
    ctx.text(X, 'أسرع 3 مرات', 540, 1400, { family: 'body', weight: 700, size: 52, color: P.mut, alpha: land });
  },
});
