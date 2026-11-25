// خلفية الاستوديو + كلمة كبيرة بسيطة (بدل الكابشن) — مشتركة بين المشاهد
export function studioBg(ctx, o = {}) {
  const { X, P } = ctx;
  X.fillStyle = P.bg; X.fillRect(0, 0, ctx.W, ctx.H);
  const g = X.createRadialGradient(540, o.cy ?? 820, 60, 540, o.cy ?? 820, 1250);
  g.addColorStop(0, 'rgba(255,255,255,0.75)'); g.addColorStop(0.55, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(120,96,70,0.10)');
  X.fillStyle = g; X.fillRect(0, 0, ctx.W, ctx.H);
}

// كلمة كبيرة تطلع من تحت قناع خط الأساس كلمة كلمة، وتقعد بعد صوتها وتطلع بهدوء 0.4
// o: {text, s (أول كلمة), stepFrom:[أوقات كل كلمة], e (نهاية الظهور الكاملة = آخر كلمة + 0.45), y, size, color, accent:[أرقام كلمات بلون التمييز], family, weight}
export function bigWords(ctx, t, o) {
  const { X, P, E } = ctx; const s = o.s, e = o.e;
  if (t < s - 0.15 || t > e) return;
  const L = ctx.text.layout(X, o.text, { family: o.family || 'display', weight: o.weight || 900, size: o.size || 120, maxWidth: o.maxWidth || 940, lineHeight: o.lh || 1.15 });
  const ko = E.sineInOut(Math.min(1, Math.max(0, (t - (e - 0.4)) / 0.4)));
  ctx.text.drawLayout(X, L, 540, o.y ?? 1400, { align: 'center', color: o.color || P.ink, perWord: (i) => {
    const ws = (o.times && o.times[i] != null ? o.times[i] : s) - 0.10;
    const k = E.expoOut(Math.min(1, Math.max(0, (t - ws) / 0.32)));
    return { clipUp: 1, dy: (1 - k) * (o.rise ?? 110) - ko * 40, alpha: (k > 0 ? 1 : 0) * (1 - ko), color: (o.accent || []).includes(i) ? P.acc : undefined };
  } });
}
