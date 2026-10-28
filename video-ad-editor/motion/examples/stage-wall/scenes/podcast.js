/* بودكاست بكاميرتين: إطار عريض 16:9 يقطع بين كاميرا A وB على النبضة، ومنه تطلع 3 ريلات 9:16 */
function mic(X, x, y, s, col) {
  X.save(); X.translate(x, y); X.scale(s, s); X.fillStyle = col; X.strokeStyle = col; X.lineWidth = 10; X.lineCap = 'round';
  X.beginPath(); X.roundRect(-34, -110, 68, 130, 34); X.fill();
  X.beginPath(); X.arc(0, -20, 62, 0.15, Math.PI - 0.15); X.stroke();
  X.beginPath(); X.moveTo(0, 42); X.lineTo(0, 90); X.moveTo(-40, 92); X.lineTo(40, 92); X.stroke(); X.restore();
}
MOTION.scene({
  id: 'podcast',
  draw(t, lt, ctx) {
    const { X, P, E, prog } = ctx;
    DEMO.card(X, ctx);
    const fw = 840, fh = 472, fx = 540 - fw / 2, fy = 440;
    const kin = E.expoOut(prog(lt, 0, .5));
    const cam = Math.floor(Math.max(0, lt - .2) / .5) % 2;            // يقطع كل نص ثانية (على النبضة)
    X.save(); X.globalAlpha = kin; X.translate(540, fy + fh / 2); X.scale(.9 + .1 * kin, .9 + .1 * kin); X.translate(-540, -(fy + fh / 2));
    X.fillStyle = cam ? '#1E1C1A' : '#262320'; X.beginPath(); X.roundRect(fx, fy, fw, fh, 22); X.fill();
    X.strokeStyle = 'rgba(243,238,231,.2)'; X.lineWidth = 2; X.stroke();
    mic(X, cam ? 640 : 430, fy + fh / 2 + 10, cam ? 1.25 : 1.0, cam ? P.acc : P.ink);
    ctx.text(X, cam ? 'CAM B' : 'CAM A', fx + 34, fy + 58, { family: 'num', weight: 700, size: 30, color: P.ink, dir: 'ltr', align: 'left' });
    X.fillStyle = '#FF3B30'; X.globalAlpha = kin * (Math.floor(lt * 4) % 2 ? .35 : 1); X.beginPath(); X.arc(fx + fw - 44, fy + 46, 11, 0, 6.283); X.fill();
    X.globalAlpha = kin; ctx.text(X, '16:9', fx + fw - 34, fy + fh - 30, { family: 'num', weight: 700, size: 28, color: P.mut, dir: 'ltr', align: 'right' });
    X.restore();
    // 3 ريلات تطلع من الحلقة
    const rw = 220, rh = 391, gap = 40, y0 = 960;
    for (let i = 0; i < 3; i++) {
      const k = E.springK(prog(lt, .9 + i * .14, 1.6 + i * .14)); if (k <= 0) continue;
      const tx = 540 + (1 - i) * (rw + gap), sx = 540 + (1 - i) * 220, sy = fy + fh / 2;
      const x = ctx.lerp(sx, tx, k), y = ctx.lerp(sy, y0 + rh / 2, k), sc = ctx.lerp(.2, 1, k);
      X.save(); X.translate(x, y); X.scale(sc, sc); X.rotate((1 - k) * (i - 1) * .4);
      X.fillStyle = i === 1 ? P.acc : '#22201E'; X.beginPath(); X.roundRect(-rw / 2, -rh / 2, rw, rh, 18); X.fill();
      const fg = i === 1 ? '#0A0A0A' : P.ink;
      X.fillStyle = fg; X.globalAlpha = .9; X.beginPath(); X.roundRect(-rw / 2 + 24, -rh / 2 + 34, rw - 48, 16, 8); X.fill();
      X.globalAlpha = .5; X.beginPath(); X.roundRect(-rw / 2 + 50, -rh / 2 + 62, rw - 100, 12, 6); X.fill();
      X.globalAlpha = 1; mic(X, 0, 30, .55, fg);
      ctx.text(X, '9:16', 0, rh / 2 - 26, { family: 'num', weight: 700, size: 24, color: fg, dir: 'ltr' });
      X.restore();
    }
  },
});
