/* الختام: 100 مربع تتعبى موجة (عدّاد لين 100)، وبعدها 17 منها تولّع برتقالي = الستايلات */
MOTION.scene({
  id: 'bank',
  draw(t, lt, ctx) {
    const { X, P, E, prog } = ctx;
    DEMO.card(X, ctx);
    const n = 10, sz = 56, gap = 10, w = n * sz + (n - 1) * gap, x0 = 540 - w / 2, y0 = 600;
    const r = ctx.rng('styles'), pick = new Set(); while (pick.size < 17) pick.add(r.int ? r.int(0, 99) : Math.floor(r() * 100));
    const kc = E.quartOut(prog(lt, .15, 1.3)), ks = E.expoOut(prog(lt, 1.35, 1.8));
    for (let i = 0; i < 100; i++) {
      const cx = i % n, cy = Math.floor(i / n), k = E.backOut(prog(lt, .15 + (cx + cy) * .05, .45 + (cx + cy) * .05));
      if (k <= 0) continue;
      const st = pick.has(i) ? ks : 0, x = x0 + (n - 1 - cx) * (sz + gap) + sz / 2, y = y0 + cy * (sz + gap) + sz / 2, s = k * (1 + .12 * st * Math.exp(-6 * Math.max(0, lt - 1.4)));
      X.fillStyle = st > .5 ? P.acc : P.well; X.beginPath(); X.roundRect(x - sz * s / 2, y - sz * s / 2, sz * s, sz * s, 10 * s); X.fill();
    }
    const v = Math.round(100 * kc);
    ctx.text(X, String(v), 540, 560, { family: 'num', weight: 900, size: 150, color: P.ink, dir: 'ltr' });
    ctx.text(X, 'حركة', 760, 545, { family: 'display', weight: 900, size: 52, color: P.mut, alpha: E.expoOut(prog(lt, .4, .8)) });
    ctx.text(X, '17 ستايل', 540, 1350, { family: 'display', weight: 900, size: 64, color: P.acc, alpha: ks });
  },
});
