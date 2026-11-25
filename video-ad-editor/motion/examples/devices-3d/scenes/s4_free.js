// مشهد 4 (l10): «كل هذا من سكل الفيديو اللي أسوي فيه ريلاتي، ومجاني» — الآيفون يرجع، والكلمات تحته
import * as K from '/motion/kit3d.mjs';
const { loadDevice, fallbackDevice, studio, shotTexture, springStep, zoomPose, hideGlass } = K;
import { studioBg } from '../lib/look.js';
import { plans } from '../motion.mjs';

MOTION.scene({
  id: 's4',
  async setup(ctx) {
    this.st = ctx.stage3D({ fov: 30, camera: [0, 0.05, 3.5], env: 'room', tone: 'neutral', samples: 8 });
    this.L = studio(ctx, this.st, { floorY: -0.62, shadow: 0.2 });
    const tex = shotTexture(ctx, 'phoneShot'), P = ctx.project.devices || {};
    try { this.phone = await loadDevice(ctx, 'phone', { ...P.phone, url: '/proj/' + P.phone.url, height: 0.74, shot: tex }); }
    catch (e) { this.phone = fallbackDevice(ctx, 'phone', { height: 1, shot: tex }); }
    this.st.add(this.phone.pivot);
    this.M = plans((l, i) => ctx.wordTime(l, i).s, id => ctx.timeline.scenes.find(s => s.id === id).start, K);
  },
  draw(t, lt, ctx) {
    const { X, P, E, at, kf } = ctx, w = (l, i) => ctx.wordTime(l, i).s;
    studioBg(ctx, { cy: 760 });
    const t0 = ctx.scene.start, tF = w('l10', 9);
    const ph = this.phone.pivot, M = this.M;
    ph.rotation.set(0.1 + 0.02 * Math.sin(t * 0.8), M.phone4RY(t), 0.03 * Math.sin(t));
    ph.position.set(0, 0.04 + 0.015 * Math.sin(t * 1.3), M.phone4Z(t));
    // الكاميرا: تقرب على ريل من ريلاتك مع «ريلاتي»، وترجع مع «ومجاني»
    ph.updateMatrixWorld(true);
    const V = ctx.THREE.Vector3, base = { p: new V(0.3 * Math.sin(t * 0.3), 0.06, kf(t, [[t0, 3.6], [ctx.scene.end, 3.35, 'sineInOut']])), l: new V(0, -0.1, 0) };
    const sp = this.phone.screenPlane; sp.geometry.computeBoundingBox(); const bb = sp.geometry.boundingBox; sp.updateMatrixWorld(true);
    const q = new V(bb.min.x + 0.833 * (bb.max.x - bb.min.x), bb.max.y - 0.648 * (bb.max.y - bb.min.y), 0).applyMatrix4(sp.matrixWorld);
    const n = new V(0, 0, 1).transformDirection(sp.matrixWorld);
    const zoom = { p: q.clone().add(n.multiplyScalar(0.46)), l: q };
    const tz = w('l10', 8) - 0.28, kz = springStep(t - tz, 1.3, 0.84) * (1 - springStep(t - (tF - 0.3), 1.0, 0.86));
    const cp = base.p.clone().lerp(zoom.p, kz), cl = base.l.clone().lerp(zoom.l, kz);
    this.st.camera.position.copy(cp); this.st.camera.lookAt(cl);
    hideGlass([this.phone], kz >= 0.15);
    this.st.draw(X);
    const vis = 1 - Math.min(1, kz * 1.6);
    X.save(); X.globalAlpha = vis;
    ctx.text.slot(X, t, [[w('l10', 3) - 0.1, 'سكل الفيديو'], [w('l10', 6) - 0.1, 'أسوي فيه ريلاتي'], [tF - 0.12, 'ومجاني']], { x: 540, y: 1470, size: 112, family: 'display', weight: 900, color: P.ink });
    X.restore();
    // «مجاني» بلون التمييز ونبضة وحدة
    if (t > tF - 0.12) { const k = E.expoOut(at(t, tF - 0.12, tF + 0.3)); X.save(); X.globalAlpha = k * 0.9;
      X.strokeStyle = P.acc; X.lineWidth = 10; X.lineCap = 'round'; X.beginPath();
      const half = 170 * k; X.moveTo(540 - half, 1505); X.lineTo(540 + half, 1505); X.stroke(); X.restore(); }
  },
});
