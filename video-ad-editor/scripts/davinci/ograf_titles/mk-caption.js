// كابشن عربي من السكل كعنوان دافنشي: كل حقل يتعدّل من الإنسبكتر، والوقت من بداية القطعة (يطلع بنبضة أول 0.2 ث)
const W = 1080, H = 1920;
const st = document.createElement('style');
st.textContent = '#ograf-content{width:100vw!important;height:100vh!important;transform:none!important}';
document.head.appendChild(st);
export default class MKCaption extends HTMLElement {
  constructor() { super(); const r = this.attachShadow({ mode: 'open' });
    r.innerHTML = '<style>:host{position:absolute;inset:0}canvas{position:absolute;inset:0;width:100%;height:100%}</style><canvas></canvas>';
    this.cv = r.querySelector('canvas'); this.cv.width = W; this.cv.height = H; this.d = {}; this.t = 0; }
  async load(p) { this.d = Object.assign({}, p.data || {}); try { await document.fonts.load('700 60px Cairo'); await document.fonts.load('800 60px Cairo'); } catch (e) {} this.draw(); return { statusCode: 200 }; }
  async updateAction(p) { Object.assign(this.d, p.data || {}); this.draw(); return { statusCode: 200 }; }
  async goToTime(p) { this.t = (p?.timestamp ?? 0) / 1000; this.draw(); return { statusCode: 200 }; }
  draw() {
    const d = this.d, X = this.cv.getContext('2d'); X.clearRect(0, 0, W, H);
    const text = String(d.text ?? 'اكتب الكابشن هني').trim(); if (!text) return;
    const size = +d.size || 62, hot = String(d.hot || '').trim(), y0 = +d.y || 1330;
    const ink = d.ink || '#1f1f1d', acc = d.acc || '#d97757', bg = d.bg || '#f0eee6';
    X.font = `700 ${size}px Cairo`; X.direction = 'rtl';
    const words = text.split(/\s+/), sp = size * 0.3, maxW = 900, lines = [[]]; let cur = 0;
    for (const w of words) { const ww = X.measureText(w).width; if (lines.at(-1).length && cur + sp + ww > maxW) { lines.push([]); cur = 0; } lines.at(-1).push([w, ww]); cur += (lines.at(-1).length > 1 ? sp : 0) + ww; }
    const lh = size * 1.45, bh = lines.length * lh + size * 0.5;
    const k = Math.min(1, this.t / 0.2), sc = 0.9 + 0.1 * (1 - Math.pow(1 - k, 3));
    X.save(); X.globalAlpha = k; X.translate(540, y0); X.scale(sc, sc); X.translate(-540, -y0);
    const lw = lines.map(l => l.reduce((a, [, w], i) => a + w + (i ? sp : 0), 0)), bw = Math.max(...lw) + size * 0.9;
    if (d.card !== false) { X.fillStyle = bg; X.beginPath(); X.roundRect(540 - bw / 2, y0 - bh / 2, bw, bh, size * 0.35); X.fill(); }
    lines.forEach((l, i) => {
      let x = 540 + lw[i] / 2; const yb = y0 - bh / 2 + size * 0.25 + i * lh + lh * 0.72;
      for (const [w, ww] of l) {
        const isHot = hot && w.replace(/[.,،؟!]/g, '') === hot;
        if (isHot) { X.fillStyle = acc; X.beginPath(); X.roundRect(x - ww - size * 0.12, yb - size * 0.95, ww + size * 0.24, size * 1.25, size * 0.2); X.fill(); }
        X.fillStyle = isHot ? bg : ink; X.textAlign = 'right'; X.fillText(w, x, yb); x -= ww + sp;
      }
    });
    X.restore();
  }
  async setActionsSchedule() { return { statusCode: 200 }; } async playAction() { return { statusCode: 200, currentStep: 0 }; }
  async stopAction() { return { statusCode: 200 }; } async customAction() { return { statusCode: 200 }; } async dispose() { return { statusCode: 200 }; }
}
