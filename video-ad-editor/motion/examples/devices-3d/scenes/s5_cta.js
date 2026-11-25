// مشهد 5 (l11–l12): «إعلان تطبيقك صار يبدأ بجملة تكتبها» ← «اكتب فيديو، وهو يوصلك بالخاص»
import { studioBg, bigWords } from '../lib/look.js';
import { loadWords, ready3DText, word3D, springStep } from '/motion/kit3d.mjs';

MOTION.scene({
  id: 's5',
  async setup(ctx) {
    const { THREE, P } = ctx;
    this.st = ctx.stage3D({ fov: 34, camera: [0, 0, 10], env: 'room', tone: 'neutral', exposure: 1.0, samples: 8 });
    const key = new THREE.DirectionalLight(0xfff4ea, 2.2); key.position.set(3, 5, 6); this.key = key;
    const rim = new THREE.DirectionalLight(0xffffff, 1.3); rim.position.set(-5, 2, -3);
    this.st.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xd9cfc0, 0.5));
    await loadWords('/proj/assets/words3d.json'); await ready3DText();
    this.vid = word3D(ctx, 'فيديو', { height: 1, depth: 0.42, bevel: 0.035, face: P.acc, side: P.clay, rough: 0.22, env: 1.2 });
    const sz = this.vid.userData.size; this.vid.userData.fit = Math.min(2.6 / sz.x, 1.0 / sz.y); this.st.add(this.vid);
  },
  draw(t, lt, ctx) {
    const { X, P, E, at } = ctx, w = (l, i) => ctx.wordTime(l, i).s;
    studioBg(ctx, { cy: 900 });
    const c0 = w('l12', 0);
    // ── «إعلان تطبيقك» ← «يبدأ بجملة»
    ctx.text.slot(X, t, [[w('l11', 1) - 0.1, 'إعلان تطبيقك'], [w('l11', 4) - 0.1, 'يبدأ بجملة'], [c0 - 0.35, ' ']], { x: 540, y: 620, size: 130, family: 'display', weight: 900, color: P.ink });
    // ── خانة الجملة
    const bs = w('l11', 1) + 0.1, be = c0 - 0.05;
    if (t > bs && t < be + 0.45) {
      const ki = E.expoOut(at(t, bs, bs + 0.45)), ko = E.expoIn(at(t, be, be + 0.4));
      const y = 980 + (1 - ki) * 70 + ko * 80, wv = 880, h = 156;
      X.save(); X.globalAlpha = ki * (1 - ko);
      X.shadowColor = 'rgba(60,40,20,0.18)'; X.shadowBlur = 50; X.shadowOffsetY = 18;
      X.fillStyle = '#FFFFFF'; X.beginPath(); X.roundRect(540 - wv / 2, y - h / 2, wv, h, 46); X.fill(); X.shadowColor = 'transparent';
      const q = 'سو لي إعلان لتطبيقي', k = at(t, w('l11', 3), w('l11', 6) + 0.2), sub = ctx.text.typeSub(q, k);
      ctx.text(X, sub, 540 + wv / 2 - 150, y + 22, { family: 'body', weight: 700, size: 62, color: P.ink, align: 'right', dir: 'rtl' });
      X.font = ctx.font('Cairo', 700, 62); const tw = X.measureText(sub).width;
      if (Math.floor(t * 2.4) % 2 === 0 || k < 1) { X.fillStyle = P.acc; X.fillRect(540 + wv / 2 - 156 - tw - 10, y - 34, 6, 68); }
      // زر الإرسال يتضغط بعد ما تكمل الجملة
      const kb = E.expoOut(at(t, w('l11', 6) + 0.25, w('l11', 6) + 0.5));
      X.fillStyle = P.acc; X.beginPath(); X.arc(540 + wv / 2 - 78, y, 46 * (1 - 0.12 * Math.sin(Math.PI * kb)), 0, 6.2832); X.fill();
      X.strokeStyle = '#fff'; X.lineWidth = 9; X.lineCap = 'round'; X.lineJoin = 'round'; X.beginPath();
      X.moveTo(540 + wv / 2 - 78, y + 20); X.lineTo(540 + wv / 2 - 78, y - 20); X.moveTo(540 + wv / 2 - 96, y - 3); X.lineTo(540 + wv / 2 - 78, y - 21); X.lineTo(540 + wv / 2 - 60, y - 3); X.stroke();
      X.restore();
    }
    // ── الختام: «اكتب» + «فيديو» كبيرة بكشيدة تتمدد + «ويوصلك بالخاص»
    if (t > c0 - 0.15) {
      bigWords(ctx, t, { text: 'اكتب', s: c0, e: 99, y: 760, size: 150, color: P.ink });
      // «فيديو» مجسّمة: تنطلق من العمق وتلف لفة ونص بنابض، وتقعد تتمايل والضوء يمشي على حافتها
      const tv = w('l12', 1) - 0.4, u = t - tv;
      if (u > 0) {
        const kp = springStep(u, 0.9, 0.8), kr = springStep(u, 0.75, 0.6);
        this.vid.position.set(0, (960 - 1040) / 314, -16 * (1 - kp));
        this.vid.rotation.set(0.3 * (1 - kr) + 0.06 * Math.sin(t * 0.9), -3 * Math.PI * (1 - kr) + 0.22 * Math.sin(t * 0.7), 0);
        this.vid.scale.setScalar(this.vid.userData.fit);
        this.key.position.set(3 * Math.cos(t * 0.8), 5, 6);
        this.st.camera.position.set(0.6 * Math.sin(t * 0.4), 0.2, 10); this.st.camera.lookAt(0, -0.2, 0);
        this.st.draw(X);
      }
      bigWords(ctx, t, { text: 'ويوصلك بالخاص', s: w('l12', 2), times: [w('l12', 2), w('l12', 3)], e: 99, y: 1300, size: 92, color: P.mut, rise: 60 });
      // فقاعة تعليق صغيرة تلمّح إنها كلمة تنكتب بالتعليقات
      const kb = E.expoOut(at(t, w('l12', 3), w('l12', 3) + 0.4));
      if (kb > 0) { X.save(); X.globalAlpha = kb; X.translate(540, 1420); X.scale(0.9 + 0.1 * kb, 0.9 + 0.1 * kb);
        X.fillStyle = '#FFFFFF'; X.shadowColor = 'rgba(60,40,20,0.15)'; X.shadowBlur = 30; X.shadowOffsetY = 10;
        X.beginPath(); X.roundRect(-150, -46, 300, 92, 46); X.fill(); X.shadowColor = 'transparent';
        X.beginPath(); X.moveTo(70, 40); X.lineTo(110, 72); X.lineTo(100, 36); X.fill();
        ctx.text(X, 'فيديو', 0, 20, { family: 'body', weight: 800, size: 54, color: P.ink, align: 'center' });
        X.restore(); }
    }
  },
});
