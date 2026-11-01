// المايكرويف: العنوان ← الآلة ترتسم ← الشاشة تشتغل والصحن يلف ← موجات من الماقنترون بالدليل ← ترتد من الجدران ← توصل الكوب ← جزيئات المي تهتز والبخار يطلع
import { loadMachine, drawItem, frame } from './_iso.js';
const MX = 40, MY = 560;

MOTION.scene({ id: 'micro', start: 7.2, end: 14.6,
  async setup(ctx) { Object.assign(this, await loadMachine(ctx, 'micro.json', { t0: 0.35, span: 1.7, seed: 'micro' })); },
  draw(t, lt, ctx) {
    const { X, P: C, at, E, clamp, lerp } = ctx, W = this.W, self = this;
    X.fillStyle = C.bg; X.fillRect(0, 0, ctx.W, ctx.H);
    frame(ctx, X, lt, { fig: 2, title: 'مايكرويف', sub: 'شلون يسخّن الأكل؟', top: 'تخيّل المعلم يشرح الدرس جذي', ask: 'اشرح لي شلون يشتغل المايكرويف',
      steps: [[2.3, 4.25, '1', 'جهاز اسمه ماقنترون يطلق موجات'], [4.25, 5.9, '2', 'الموجات ترتد من جدران الفرن المعدن'], [5.9, 7.6, '3', 'وتهز جزيئات المي بالأكل… فيسخن']] });
    const rev = lt < 2.45, on = at(lt, 2.25, 2.45), heat = at(lt, 5.6, 6.6);
    const φ = 0.9 * Math.max(0, lt - 2.3);
    X.save(); X.translate(MX, MY);
    const z = 1.22 * (1 + 0.05 * at(lt, 2.3, 7.4, 'sineInOut')); X.translate(500, 370); X.scale(z, z); X.translate(-500, -380);
    const tint = (tag) => tag === 'display' && on > 0 ? [C.acc, on] : null;
    this.L.back.forEach(it => drawItem(ctx, X, lt, it, { rev, tint }));
    // علامات الصحن + الكوب يلف
    const TC = W.TURN.c, top = W.TURN.z + 2.4;
    if (!rev || lt > 1.9) { const ma = rev ? at(lt, 1.9, 2.3) : 1;
      X.globalAlpha = ma; X.fillStyle = '#B9B1A4'; for (let i = 0; i < 6; i++) { const a = φ + i * 1.047, p = this.iso([TC[0] + 30 * Math.cos(a), TC[1] + 30 * Math.sin(a), top]); X.beginPath(); X.arc(p[0], p[1], 2.2, 0, 6.283); X.fill(); }
      const ma2 = φ + 0.5, mx = TC[0] + 15 * Math.cos(ma2), my = TC[1] + 15 * Math.sin(ma2), d = this.mv(mx, my, top);
      this.T.mug.forEach(it => drawItem(ctx, X, lt, it, { dx: d[0], dy: d[1], alpha: ma }));
      // سطح المي بالكوب + الجزيئات تهتز
      const rimPts = Array.from({ length: 33 }, (_, i) => this.iso([mx + 7.4 * Math.cos(i / 32 * 6.283), my + 7.4 * Math.sin(i / 32 * 6.283), top + 17]));
      X.fillStyle = heat > 0 ? `rgba(217,119,87,${0.25 + 0.55 * heat})` : 'rgba(185,177,164,.35)'; X.beginPath(); rimPts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.fill();
      const jit = at(lt, 5.75, 6.1);
      if (jit > 0) { X.fillStyle = C.clay; for (let i = 0; i < 7; i++) { const a = i * 0.9, rr = 2 + (i % 3) * 1.6, j = 1.3 * jit * Math.sin(lt * 70 + i * 2.1);
        const p = this.iso([mx + rr * Math.cos(a) + j, my + rr * Math.sin(a) - j, top + 17]); X.beginPath(); X.arc(p[0], p[1], 2.4, 0, 6.283); X.fill(); } }
      // البخار
      const st = at(lt, 6.2, 6.7);
      if (st > 0) { const base = this.iso([mx, my, top + 21]); X.strokeStyle = C.mut; X.lineWidth = 3; X.lineCap = 'round';
        for (let s = 0; s < 3; s++) { const ph = (lt * 0.9 + s * 0.33) % 1, x0 = base[0] + (s - 1) * 12; X.globalAlpha = st * Math.sin(Math.PI * ph) * 0.8; X.beginPath();
          for (let i = 0; i <= 12; i++) { const yy = base[1] - 10 - i * 5 - ph * 40, xx = x0 + 6 * Math.sin(i * 0.7 + lt * 4 + s); i ? X.lineTo(xx, yy) : X.moveTo(xx, yy); } X.stroke(); } }
      X.globalAlpha = 1;
      this.mugAt = [mx, my, top + 17];
    }
    this.L.front.forEach(it => drawItem(ctx, X, lt, it, { rev, tint }));
    // الموجات: من الهوائي ← بالدليل ← ترتد (الجدار الخلفي، اليسار، الأرضية) ← الكوب
    if (lt > 2.4 && this.mugAt) {
      const ant = [W.MAG.x + W.MAG.w / 2, W.MAG.y + W.MAG.d / 2], gz = W.GUIDE_Z + 5.5, mg = this.mugAt;
      const path = [[ant[0], ant[1], W.MAG_Z[1]], [ant[0], ant[1], gz], [W.GUIDE.x + 4, ant[1], gz], [-62, W.CAV.y + W.WALL, 46], [W.CAV.x + W.WALL, 6, 58], [-20, 30, W.FLOOR + 3], mg].map(p => this.iso(p));
      const seg = []; let Lp = 0; for (let i = 1; i < path.length; i++) { const l = Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]); seg.push(l); Lp += l; }
      const ptAt = (l) => { for (let i = 0; i < seg.length; i++) { if (l <= seg[i]) { const k = l / seg[i], a = path[i], b = path[i + 1]; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, (b[0] - a[0]) / seg[i], (b[1] - a[1]) / seg[i]]; } l -= seg[i]; } const a = path[path.length - 2], b = path[path.length - 1], s = seg[seg.length - 1]; return [b[0], b[1], (b[0] - a[0]) / s, (b[1] - a[1]) / s]; };
      const speed = Lp / 1.15, tail = 150;
      X.strokeStyle = C.acc; X.lineWidth = 3.4; X.lineCap = 'round'; X.lineJoin = 'round';
      for (let k = 0; k < 18; k++) { const head = (lt - 2.4 - k * 0.32) * speed; if (head < 0 || head - tail > Lp) continue;
        X.beginPath(); let first = true;
        for (let l = Math.max(0, head - tail); l <= Math.min(Lp, head); l += 3) { const [x, y, dx, dy] = ptAt(l), w = 7 * Math.sin(l / 9 - lt * 22) * Math.min(1, (head - l) / 30, (l - (head - tail)) / 40 + 0.2);
          const px = x - dy * w, py = y + dx * w; first ? X.moveTo(px, py) : X.lineTo(px, py); first = false; }
        X.globalAlpha = 0.9; X.stroke(); }
      X.globalAlpha = 1;
      // نقطة ارتداد تومض عند كل جدار
      [3, 4, 5].forEach((i, j) => { const p = path[i], f = Math.max(0, ...Array.from({ length: 18 }, (_, k) => { const tt = 2.4 + k * 0.32 + (seg.slice(0, i).reduce((a, b) => a + b, 0)) / speed; return Math.exp(-Math.abs(lt - tt) * 10) * (lt > tt - 0.05 ? 1 : 0); }));
        if (f > 0.05) { X.globalAlpha = f; X.fillStyle = C.acc; X.beginPath(); X.arc(p[0], p[1], 5 + 4 * f, 0, 6.283); X.fill(); X.globalAlpha = 1; } });
    }
    X.restore();
  } });
