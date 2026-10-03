// غلاف OGraf: يشغّل مشاهد حزمة الموشن (motion-kit) داخل دافنشي 21+ كرسم شفاف — يبنيه make_ograf.py، لا تعدّله باليد
// دافنشي يطلب أي فريم بأي ترتيب عبر goToTime(ms) — فالرسم لازم دالة بالزمن بس (بلا مؤقتات ولا حالة)
import './motion-kit.js';
import { draw } from './scene.js';
import THEME from './theme.js';
const W = 1080, H = 1920;
const unbox = document.createElement('style');            // صندوق المضيف أفقي 1920×1080 افتراضاً — نفكه للريل الطولي
unbox.textContent = '#ograf-content{width:100vw!important;height:100vh!important;transform:none!important}';
document.head.appendChild(unbox);
export default class MKScene extends HTMLElement {
  constructor() {
    super(); const r = this.attachShadow({ mode: 'open' });
    r.innerHTML = '<style>:host{position:absolute;inset:0;display:block}canvas{position:absolute;inset:0;width:100%;height:100%}</style><canvas></canvas>';
    this.cv = r.querySelector('canvas'); this.cv.width = W; this.cv.height = H;
  }
  async load() {
    Object.assign(window, { X: this.cv.getContext('2d'), BG: THEME.bg, INK: THEME.ink, ACC: THEME.acc, CLAY: THEME.clay, MUT: THEME.mut, FONT: THEME.font });
    for (const w of [900, 700]) { try { await document.fonts.load(`${w} 80px ${THEME.font}`); } catch (e) {} }
    this.frame(0); return { statusCode: 200 };
  }
  frame(t) { const X = window.X; X.clearRect(0, 0, W, H); X.save(); draw(t, X, W, H, window.MK); X.restore(); }
  async goToTime(p) { this.frame((p?.timestamp ?? 0) / 1000); return { statusCode: 200 }; }
  async setActionsSchedule() { return { statusCode: 200 }; }
  async playAction() { return { statusCode: 200, currentStep: 0 }; }
  async stopAction() { return { statusCode: 200 }; }
  async updateAction() { return { statusCode: 200 }; }
  async customAction() { return { statusCode: 200 }; }
  async dispose() { return { statusCode: 200 }; }
}
