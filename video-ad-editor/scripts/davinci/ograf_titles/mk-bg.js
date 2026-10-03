// خلفية الريل بلون الثيم + شبكة 60 بكسل خفيفة
const st = document.createElement('style');
st.textContent = '#ograf-content{width:100vw!important;height:100vh!important;transform:none!important}';
document.head.appendChild(st);
export default class MKBg extends HTMLElement {
  constructor() { super(); const r = this.attachShadow({ mode: 'open' });
    r.innerHTML = '<style>:host{position:absolute;inset:0}canvas{position:absolute;inset:0;width:100%;height:100%}</style><canvas></canvas>';
    this.cv = r.querySelector('canvas'); this.cv.width = 1080; this.cv.height = 1920; this.d = {}; }
  async load(p) { this.d = Object.assign({}, p.data || {}); this.draw(); return { statusCode: 200 }; }
  async updateAction(p) { Object.assign(this.d, p.data || {}); this.draw(); return { statusCode: 200 }; }
  async goToTime() { this.draw(); return { statusCode: 200 }; }
  draw() { const X = this.cv.getContext('2d'); X.fillStyle = this.d.bg || '#f0eee6'; X.fillRect(0, 0, 1080, 1920);
    if (this.d.grid !== false) { X.strokeStyle = 'rgba(31,31,29,.05)'; X.lineWidth = 2; for (let x = 0; x <= 1080; x += 60) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, 1920); X.stroke(); } for (let y = 0; y <= 1920; y += 60) { X.beginPath(); X.moveTo(0, y); X.lineTo(1080, y); X.stroke(); } } }
  async setActionsSchedule() { return { statusCode: 200 }; } async playAction() { return { statusCode: 200, currentStep: 0 }; }
  async stopAction() { return { statusCode: 200 }; } async customAction() { return { statusCode: 200 }; } async dispose() { return { statusCode: 200 }; }
}
