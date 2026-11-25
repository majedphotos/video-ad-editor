// مشهد 3 (l9): «وشعارك نفسه يصير مجسّم، بسماكة ولمعة وظل» — بلاطة شعار حقيقية بسماكة، لمعة تمشي عليها، وظل يتحرك
import * as K from '/motion/kit3d.mjs';
const { studio, loadWords, ready3DText, word3D } = K;
import { studioBg } from '../lib/look.js';
import { plans } from '../motion.mjs';

MOTION.scene({
  id: 's3',
  async setup(ctx) {
    const { THREE, P } = ctx;
    this.st = ctx.stage3D({ fov: 30, camera: [0, 0.4, 5.2], env: 'room', tone: 'neutral', samples: 8 });
    this.L = studio(ctx, this.st, { floorY: -1.05, shadow: 0.3, key: 2.6, fogNear: 6.5, fogFar: 16 });
    // الشعار: كلمة project.logoWord بخط حقيقي مجسّم — سماكة فعلية وحافة مشطوفة تلقط اللمعة (مو بلاطة عليها كتابة)
    await loadWords('/proj/assets/words3d.json'); await ready3DText();
    this.tile = word3D(ctx, ctx.project.logoWord || 'شعارك', { height: 1, depth: 0.42, bevel: 0.035, face: P.acc, side: P.clay, rough: 0.22, clearcoat: 1, env: 1.2 });
    const sz = this.tile.userData.size; this.tile.userData.mesh.scale.setScalar(Math.min(1.22 / sz.x, 0.7 / sz.y));
    this.st.add(this.tile);
    // ضوء اللمعة: ضوء نقطي قريب يعبر الوجه فينعكس على الطلاء اللامع
    this.sweep = new THREE.PointLight(0xffffff, 0, 3.2, 1.6); this.st.add(this.sweep);
    this.M = plans((l, i) => ctx.wordTime(l, i).s, id => ctx.timeline.scenes.find(s => s.id === id).start, K);
  },
  draw(t, lt, ctx) {
    const { X, P, E, at, kf } = ctx, w = (l, i) => ctx.wordTime(l, i).s;
    studioBg(ctx, { cy: 780 });
    const t0 = ctx.scene.start, tM = w('l9', 3), tS = w('l9', 4), tL = w('l9', 5), tZ = w('l9', 6);
    // نوابض فيزيائية (../motion.mjs): يطلع لافّ ويهدّي بتخطّي، يلف جنب عند «بسماكة» ويرجع عند «ولمعة»
    const M = this.M;
    this.tile.rotation.set(M.tileRX(t), M.tileRY(t), 0);
    this.tile.position.set(0, M.tileY(t) + 0.03 * Math.sin(t * 1.4), 0);
    const cx = 0.25 * Math.sin(t * 0.35);
    this.st.camera.position.set(cx, 0.4, 5.2); this.st.camera.lookAt(0, 0.1, 0);
    // اللمعة تعبر من اليمين لليسار
    const ks = at(t, tL - 0.05, tL + 0.75, 'sineInOut');
    this.sweep.intensity = ks > 0 && ks < 1 ? 26 * Math.sin(Math.PI * ks) : 0;
    this.sweep.position.set(1.4 - 2.8 * ks, 0.9 - 0.6 * ks, 1.25);
    // الظل: الضوء الرئيسي يلف فالظل يتمد ويمشي
    const kz = at(t, tZ - 0.1, tZ + 0.9, 'sineInOut');
    this.L.key.position.set(2.2 - 4.6 * kz, 4.5 - 1.6 * kz, 3.2 - 1.4 * kz);
    this.L.floor.material.opacity = 0.3 + 0.12 * kz;
    this.st.draw(X);
    ctx.text.slot(X, t, [[w('l9', 0) - 0.1, 'شعارك'], [tM - 0.1, 'مجسّم'], [tS - 0.1, 'بسماكة'], [tL - 0.1, 'ولمعة'], [tZ - 0.1, 'وظل']], { x: 540, y: 1470, size: 130, family: 'display', weight: 900, color: P.ink });
  },
});
