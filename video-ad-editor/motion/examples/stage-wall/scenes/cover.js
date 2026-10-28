/* كفر وثمبنيل: شبكة البروفايل 3×3، المربع بالنص يصير الكفر البرتقالي ويطلع قدام — كل المهم داخل 1:1 */
MOTION.scene({
  id: 'cover',
  draw(t, lt, ctx) {
    const { X, P, E, prog } = ctx;
    DEMO.card(X, ctx);
    const sz = 262, gap = 10, gx = 540 - (sz * 3 + gap * 2) / 2, gy = 470;
    for (let i = 0; i < 9; i++) {
      if (i === 4) continue;
      const cx = i % 3, cy = Math.floor(i / 3), k = E.expoOut(prog(lt, i * .04, .4 + i * .04));
      X.globalAlpha = k; X.fillStyle = (i % 3 === 1) ? P.well : P.well2;
      X.beginPath(); X.roundRect(gx + cx * (sz + gap), gy + cy * (sz + gap) + (1 - k) * 40, sz, sz, 10); X.fill();
      X.fillStyle = DEMO.a(P.ink, .14); X.fillRect(gx + cx * (sz + gap) + 40, gy + cy * (sz + gap) + sz - 70 + (1 - k) * 40, sz - 80, 14);
    }
    X.globalAlpha = 1;
    const kh = E.springK(prog(lt, .55, 1.25)), lift = E.expoInOut(prog(lt, 1.2, 1.7));
    const cx = gx + sz + gap + sz / 2, cy = gy + sz + gap + sz / 2, s = ctx.lerp(.0, 1, kh) * (1 + lift * .55);
    if (s > 0) {
      X.save(); X.translate(cx, cy - lift * 30); X.scale(s, s); X.rotate((1 - kh) * -.3);
      X.shadowColor = DEMO.a(P.shadow, .35); X.shadowBlur = 50 * lift; X.shadowOffsetY = 26 * lift;
      X.fillStyle = P.acc; X.beginPath(); X.roundRect(-sz / 2, -sz / 2, sz, sz, 12); X.fill(); X.shadowColor = 'transparent';
      ctx.text(X, 'كفر', 0, 22, { family: 'display', weight: 900, size: 104, color: P.onAcc });
      ctx.text(X, '1:1', 0, sz / 2 - 24, { family: 'num', weight: 700, size: 26, color: DEMO.a(P.onAcc, .75), dir: 'ltr' });
      X.restore();
    }
    ctx.text(X, 'ينقرا بشبكة البروفايل', 540, 1330, { family: 'body', weight: 700, size: 40, color: P.mut, alpha: E.expoOut(prog(lt, 1.3, 1.8)) });
  },
});
