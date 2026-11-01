// الاستشوار: العنوان ينكتب ← الآلة ترتسم ← الموتور يدير المروحة ← الهوا يدخل بارد ويمر على السلك ← السلك يحمر والهوا يطلع حار
import { loadMachine, drawItem, frame } from './_iso.js';
const MX = 40, MY = 590;

MOTION.scene({ id: 'dryer', start: 0, end: 7.2,
  async setup(ctx) {
    Object.assign(this, await loadMachine(ctx, 'dryer.json', { t0: 0.35, span: 1.7, seed: 'dryer' }));
    const r = ctx.rng('air');
    this.air = Array.from({ length: 80 }, () => ({ s: r(), a: r.range(0, 6.283), rr: Math.sqrt(r()) * 0.8, sp: r.range(0.45, 0.62) }));
  },
  draw(t, lt, ctx) {
    const { X, P: C, at, E, clamp, lerp } = ctx, W = this.W, self = this;
    X.fillStyle = C.bg; X.fillRect(0, 0, ctx.W, ctx.H);
    frame(ctx, X, lt, { fig: 1, title: 'استشوار', sub: 'شلون يشتغل؟', top: 'اسأل كلود عن أي جهاز… ويرسمه لك', ask: 'اشرح لي شلون يشتغل الاستشوار',
      steps: [[2.3, 4.75, '1', 'موتور يدير مروحة… تسحب الهوا وتدفعه'], [4.75, 7.4, '2', 'الهوا يمر على سلك نيكروم حار… ويطلع حار']] });
    const rev = lt < 2.45, heat = at(lt, 4.3, 5.3);
    const τ = Math.max(0, lt - 2.3), θ = τ < 0.7 ? 26 * τ * τ / 1.4 : 26 * (τ - 0.35);
    const mix = (k) => { const a = [0x8A, 0x84, 0x7A], b = [0xD9, 0x5F, 0x2C]; return `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * k)).join(',')})`; };
    X.save(); X.translate(MX, MY);
    const z = 1.3 * (1 + 0.04 * at(lt, 2.3, 7.2, 'sineInOut')); X.translate(500, 360); X.scale(z, z); X.translate(-500, -380);
    const tint = (tag) => tag === 'coil' && heat > 0 ? [mix(heat), heat] : null;
    this.L.back.forEach(it => drawItem(ctx, X, lt, it, { rev, tint }));
    // المروحة (مستوى yz)
    const fa = rev ? at(lt, 1.6, 2.1) : 1;
    if (fa > 0) {
      const P3 = (ρ, φ) => this.iso([W.FAN.x, ρ * Math.cos(φ), W.AX.z + ρ * Math.sin(φ)]);
      X.save(); X.globalAlpha = fa;
      const spin = clamp(τ / 0.7, 0, 1);
      if (spin > 0.3) { X.globalAlpha = fa * 0.25 * spin; X.fillStyle = '#E6DFD2'; X.beginPath(); for (let i = 0; i <= 40; i++) { const p = P3(W.FAN.r, i / 40 * 6.283); i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]); } X.fill(); X.globalAlpha = fa; }
      for (let b = 0; b < 5; b++) { const φ = θ + b * 6.283 / 5, pts = [P3(3.5, φ - 0.35), P3(W.FAN.r, φ - 0.32), P3(W.FAN.r, φ + 0.28), P3(3.5, φ + 0.3)];
        X.beginPath(); pts.forEach((p, i) => i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1])); X.closePath();
        X.fillStyle = '#EEE8DD'; X.fill(); X.strokeStyle = '#2B2925'; X.lineWidth = 1.6; X.stroke(); }
      X.fillStyle = '#FFFDF9'; X.strokeStyle = '#2B2925'; X.beginPath(); for (let i = 0; i <= 24; i++) { const p = P3(4, i / 24 * 6.283); i ? X.lineTo(p[0], p[1]) : X.moveTo(p[0], p[1]); } X.fill(); X.stroke();
      X.restore();
    }
    this.L.mid.forEach(it => drawItem(ctx, X, lt, it, { rev, tint }));
    // الهوا: خطوط قصيرة تمشي على المحور، تبرد قبل السلك وتحمر بعده
    const airA = at(lt, 2.6, 3.2), R0 = W.AX.r * 0.85;
    const drawAir = (inside) => { if (airA <= 0) return;
      for (const p of this.air) { const u = ((p.s + lt * p.sp * 0.9) % 1), x = lerp(W.AX.from - 40, W.NOZ.to + 80, u);
        if ((x < W.NOZ.to) !== inside) continue;
        const R = x < W.AX.to ? R0 : x < W.NOZ.to ? lerp(R0, W.NOZ.r * 0.85, (x - W.AX.to) / (W.NOZ.to - W.AX.to)) : W.NOZ.r * 0.85 + (x - W.NOZ.to) * 0.32;
        const y = Math.cos(p.a) * p.rr * R, zz = W.AX.z + Math.sin(p.a) * p.rr * R;
        const hot = clamp((x - W.COIL.from) / (W.COIL.to - W.COIL.from), 0, 1) * heat;
        const a = this.iso([x - 9, y, zz]), b = this.iso([x, y, zz]);
        X.globalAlpha = airA * Math.min(1, u * 12, (1 - u) * 8) * 0.9; X.strokeStyle = mix(hot); X.lineWidth = 2.4 + hot; X.lineCap = 'round';
        X.beginPath(); X.moveTo(a[0], a[1]); X.lineTo(b[0], b[1]); X.stroke(); }
      X.globalAlpha = 1; };
    drawAir(true);
    this.L.front.forEach(it => drawItem(ctx, X, lt, it, { rev }));
    drawAir(false);
    X.restore();
  } });
