// مشهد 2 (l7–l8) v2: «واللي ما عنده تطبيق ولا موقع؟» ← خانة يكتب فيها ← الكلمات تنفجر من الخانة مجسّمة حقيقية (خط حقيقي بحافة مشطوفة)
// وتلف بنوابض لين تستقر بثلاث أسطر — كل سطر بمكانه، ولا شي فوق شي
import { studioBg, bigWords } from '../lib/look.js';
import { loadWords, ready3DText, word3D, springStep } from '/motion/kit3d.mjs';

MOTION.scene({
  id: 's2',
  async setup(ctx) {
    const { THREE, P } = ctx;
    this.st = ctx.stage3D({ fov: 34, camera: [0, 0, 10], env: 'room', tone: 'neutral', exposure: 1.0, samples: 8 });
    const key = new THREE.DirectionalLight(0xfff4ea, 2.2); key.position.set(3, 5, 6);
    const rim = new THREE.DirectionalLight(0xffffff, 1.4); rim.position.set(-5, 2, -3);
    this.st.add(key, rim, new THREE.HemisphereLight(0xffffff, 0xd9cfc0, 0.5));
    this.key = key;
    await loadWords('/proj/assets/words3d.json'); await ready3DText();
    const fit = (g, mw, mh) => { const s = Math.min(mw / g.userData.size.x, mh / g.userData.size.y); g.userData.fit = s; return g; };
    this.words = [
      fit(word3D(ctx, 'فيلم', { height: 1, depth: 0.32, face: P.ink, side: '#5a4c40' }), 2.1, 0.6),
      fit(word3D(ctx, 'موشن', { height: 1, depth: 0.32, face: P.ink, side: '#5a4c40' }), 2.3, 0.6),
      fit(word3D(ctx, '3D', { height: 1, depth: 0.4, face: P.acc, side: P.clay }), 1.5, 0.7),
    ];
    this.words.forEach(g => this.st.add(g));
  },
  draw(t, lt, ctx) {
    const { X, P, E, at } = ctx, w = (l, i) => ctx.wordTime(l, i).s;
    studioBg(ctx, { cy: 900 });
    // ── السؤال
    const qe = w('l8', 0) + 0.25;
    bigWords(ctx, t, { text: 'واللي ما عنده', s: w('l7', 1), times: [w('l7', 1), w('l7', 2), w('l7', 3)], e: qe, y: 700, size: 110, color: P.mut });
    bigWords(ctx, t, { text: 'تطبيق', s: w('l7', 4), e: qe, y: 960, size: 250, accent: [0] });
    bigWords(ctx, t, { text: 'ولا موقع؟', s: w('l7', 5), times: [w('l7', 5), w('l7', 6)], e: qe, y: 1200, size: 150 });

    // ── خانة الكتابة: تدخل بالنص، ومع «ويطلع» تطلع فوق وتصغر (تفسح للكلمات)
    const ps = w('l8', 0) - 0.05, tOut = w('l8', 3) - 0.1, pe = ctx.scene.end + 0.2;
    const kUp = E.cubicInOut(at(t, tOut, tOut + 0.45));
    const boxY = 900 - 420 * kUp, boxS = 1 - 0.22 * kUp;
    if (t > ps && t < pe) {
      const ki = E.expoOut(at(t, ps, ps + 0.4));
      const y = boxY + (1 - ki) * 60, wv = 860, h = 150;
      X.save(); X.globalAlpha = ki; X.translate(540, y); X.scale(boxS, boxS); X.translate(-540, -y);
      X.shadowColor = 'rgba(60,40,20,0.18)'; X.shadowBlur = 50; X.shadowOffsetY = 18;
      X.fillStyle = '#FFFFFF'; X.beginPath(); X.roundRect(540 - wv / 2, y - h / 2, wv, h, 44); X.fill(); X.shadowColor = 'transparent';
      const q = 'سو لي فيلم عن فكرتي', k = at(t, w('l8', 1), w('l8', 3) - 0.15);
      const sub = ctx.text.typeSub(q, k);
      ctx.text(X, sub, 540 + wv / 2 - 60, y + 22, { family: 'body', weight: 700, size: 62, color: P.ink, align: 'right', dir: 'rtl' });
      X.font = ctx.font('Cairo', 700, 62); const tw = Math.min(wv - 120, X.measureText(sub).width);
      if ((Math.floor(t * 2.4) % 2 === 0 || k < 1) && kUp < 0.5) { X.fillStyle = P.acc; X.fillRect(540 + wv / 2 - 66 - tw - 10, y - 34, 6, 68); }
      X.restore();
    }
    bigWords(ctx, t, { text: 'يكتب نص', s: w('l8', 1), times: [w('l8', 1), w('l8', 2)], e: tOut + 0.3, y: 1150, size: 96, color: P.mut, rise: 60 });

    // ── الكلمات المجسّمة: تطلع من الخانة (فوق)، تلف لفة كاملة بنابض، وتستقر بأسطرها
    const pxY = y => (960 - y) / 314;                         // بكسل ← متر (الكاميرا على بعد 10، زاوية 34)
    const T = [w('l8', 5), w('l8', 6), w('l8', 7)], rows = [790, 1060, 1335];
    // كل كلمة تطلع من العمق ورا سطرها بالضبط (ما تعبر فوق كلمة ثانية) وتلف لفة كاملة بنابض
    this.words.forEach((g, i) => {
      const s = T[i] - 0.42, u = t - s;
      g.visible = u > 0;
      if (!g.visible) return;
      const kp = springStep(u, 0.95, 0.8), kr = springStep(u, 0.8, 0.62);
      g.position.set(0, pxY(rows[i]), -14 * (1 - kp) + 0.2 * Math.sin(t * 0.9 + i));
      const dir = i === 1 ? -1 : 1;
      g.rotation.set(0.35 * (1 - kr) + 0.06 * Math.sin(t * 0.8 + i), dir * (-2 * Math.PI) * (1 - kr) + 0.2 * Math.sin(t * 0.6 + i * 1.7), 0.02 * Math.sin(t + i));
      g.scale.setScalar(g.userData.fit);
    });
    // الكاميرا تمشي شوي جنب فتلقط الحواف المشطوفة الضوء
    const kc = at(t, T[0] - 0.4, ctx.scene.end + 0.4, 'sineInOut');
    this.st.camera.position.set(-1.4 + 2.8 * kc, 0.3 - 0.5 * kc, 10); this.st.camera.lookAt(0, -0.05, 0);
    this.key.position.set(3 - 5 * kc, 5, 6);
    if (t > T[0] - 0.5) this.st.draw(X);
    bigWords(ctx, t, { text: 'بدون تصوير', s: w('l8', 9), times: [w('l8', 9), w('l8', 10)], e: ctx.scene.end + 0.5, y: 1560, size: 84, color: P.mut, rise: 60 });
  },
});
