// مشهد وضع الكرت من حزمة الموشن كعنوان دافنشي — النصوص والألوان من الإنسبكتر، والوقت من بداية القطعة
import './motion-kit.js';
const W = 1080, H = 1920;
const st = document.createElement('style');
st.textContent = '#ograf-content{width:100vw!important;height:100vh!important;transform:none!important}';
document.head.appendChild(st);
export default class MKHeadline extends HTMLElement {
  constructor() { super(); const r = this.attachShadow({ mode: 'open' });
    r.innerHTML = '<style>:host{position:absolute;inset:0}canvas{position:absolute;inset:0;width:100%;height:100%}</style><canvas></canvas>';
    this.cv = r.querySelector('canvas'); this.cv.width = W; this.cv.height = H; this.d = {}; this.t = 0; }
  async load(p) { this.d = Object.assign({}, p.data || {}); window.X = this.cv.getContext('2d'); window.FONT = 'Cairo';
    for (const w of [900, 700]) { try { await document.fonts.load(`${w} 80px Cairo`); } catch (e) {} } this.draw(); return { statusCode: 200 }; }
  async updateAction(p) { Object.assign(this.d, p.data || {}); this.draw(); return { statusCode: 200 }; }
  async goToTime(p) { this.t = (p?.timestamp ?? 0) / 1000; this.draw(); return { statusCode: 200 }; }
  draw() {
    const d = this.d, t = this.t, X = this.cv.getContext('2d'); window.X = X; window.INK = d.ink || '#1f1f1d'; window.ACC = d.acc || '#d97757';
    X.clearRect(0, 0, W, H); const MK = window.MK;
    const small = String(d.small ?? 'احنا الحين في').trim().split(/\s+/).filter(Boolean);
    if (small.length) MK.kinetic(t, { s: 0, box: { x: 90, y: 240, w: 900, h: 120 }, words: small, size: 84, times: small.map((_, i) => i * 0.27) });
    const big = String(d.big ?? '2026').trim(), stamp = String(d.stamp ?? 'مصدر دخل ثاني').trim();
    if (big) MK.kinetic(t, { s: 0.8, box: { x: 90, y: 330, w: 900, h: 260 }, words: [big], hot: [0], size: 240, mode: 'slam', times: [0.8] });
    if (stamp) MK.stamp(t, { s: d.stampAt != null ? +d.stampAt : 5, cx: 540, cy: 720, text: stamp, rot: -6, color: window.ACC });
  }
  async setActionsSchedule() { return { statusCode: 200 }; } async playAction() { return { statusCode: 200, currentStep: 0 }; }
  async stopAction() { return { statusCode: 200 }; } async customAction() { return { statusCode: 200 }; } async dispose() { return { statusCode: 200 }; }
}
