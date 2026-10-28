/* مونتاج على الإيقاع: خطوط النبضة تنبض، والمقاطع تطيح وتلصق على النبضات، والمعاينة فوق تتبدل على كل ضربة */
MOTION.scene({
  id: 'montage',
  draw(t, lt, ctx) {
    const { X, P, E, prog } = ctx;
    DEMO.card(X, ctx);
    const tx0 = 110, tx1 = 970, ty = 1080, beat = .5, n = 8, seg = (tx1 - tx0) / n;
    // خطوط النبضة (RTL: الوقت يمشي من اليمين لليسار)
    for (let i = 0; i <= n; i++) {
      const x = tx1 - i * seg, hit = Math.exp(-10 * Math.max(0, lt - (.25 + i * beat * .55)));
      X.fillStyle = `rgba(243,238,231,${.18 + .6 * (lt > .25 + i * beat * .55 ? hit : 0)})`; X.fillRect(x - 2, ty - 120, 4, 240);
    }
    // المقاطع تطيح وتلصق
    const cols = [P.acc, '#3A3632', P.ink, '#2B2825', P.acc, '#3A3632', P.ink, '#2B2825'];
    for (let i = 0; i < n; i++) {
      const s = .1 + i * beat * .55, k = E.springK(prog(lt, s, s + .45)); if (k <= 0) continue;
      const x = tx1 - (i + 1) * seg + 6, y = ctx.lerp(ty - 420, ty - 70, k);
      X.save(); X.translate(x + seg / 2, y + 70); X.rotate((1 - k) * (i % 2 ? .5 : -.5)); X.fillStyle = cols[i];
      X.beginPath(); X.roundRect(-seg / 2 + 6, -70, seg - 12, 140, 14); X.fill(); X.restore();
    }
    // رأس التشغيل
    const ph = tx1 - (tx1 - tx0) * E.sineInOut(prog(lt, .3, 2.5));
    X.fillStyle = P.acc; X.fillRect(ph - 3, ty - 160, 6, 320); X.beginPath(); X.moveTo(ph - 18, ty - 172); X.lineTo(ph + 18, ty - 172); X.lineTo(ph, ty - 150); X.fill();
    // المعاينة: كل ضربة تتبدل
    const bi = Math.max(0, Math.floor((lt - .1) / (beat * .55))), pk = Math.exp(-9 * ((lt - .1) % (beat * .55)));
    const c = cols[Math.min(n - 1, bi)], pw = 560 * (1 + .05 * pk), ph2 = 315 * (1 + .05 * pk);
    X.fillStyle = c; X.beginPath(); X.roundRect(540 - pw / 2, 650 - ph2 / 2, pw, ph2, 24); X.fill();
    ctx.text(X, String(Math.min(n, bi + 1)).padStart(2, '0'), 540, 690, { family: 'num', weight: 900, size: 120, color: c === P.ink || c === P.acc ? '#0A0A0A' : P.ink, dir: 'ltr' });
    ctx.text(X, 'على النبضة', 540, 1310, { family: 'body', weight: 700, size: 40, color: P.mut, alpha: E.expoOut(prog(lt, .4, .9)) });
  },
});
