// مشهد 1 (l1–l6): ماكرو على عدسات الآيفون ← يلف لقدام ← 3 زوايا كاميرا مع «ولا» ← «كلود رسمه»: يتفكك خطوط ويرتسم من جديد
// ← لقطة الحساب تطير لشاشته ← زوم قوي على المتابعين ثم على ريل ← يتبدل لماك بوك وزوم على شاشته ← «60»
// كله بـmotion/kit3d.mjs (references/devices-3d.md) + خطة الحركة ../motion.mjs (نفس الأرقام تولّد الووش)
import * as K from '/motion/kit3d.mjs';
import { studioBg, bigWords } from '../lib/look.js';
import { plans } from '../motion.mjs';
const { loadDevice, fallbackDevice, studio, shotTexture, wireDraw, sheen, camRig, applyCam, zoomPose, hideGlass, featureRing } = K;

MOTION.scene({
  id: 's1',
  async setup(ctx) {
    const { THREE } = ctx;
    this.st = ctx.stage3D({ fov: 30, camera: [0, 0.1, 3.3], env: 'room', tone: 'neutral', exposure: 1.0, samples: 8 });
    this.st.renderer.localClippingEnabled = true;                      // لازم لـwireDraw
    this.L = studio(ctx, this.st, { floorY: -0.62, shadow: 0.2 });
    this.texP = shotTexture(ctx, 'phoneShot'); this.texM = shotTexture(ctx, 'macShot');
    const D = ctx.project.devices || {};
    try { this.phone = await loadDevice(ctx, 'phone', { ...D.phone, url: '/proj/' + D.phone.url, height: 0.74, shot: this.texP }); }
    catch (e) { console.warn('phone glb missing → fallback', e && e.message); this.phone = fallbackDevice(ctx, 'phone', { height: 0.74, shot: this.texP }); }
    try { this.mac = await loadDevice(ctx, 'mac', { ...D.mac, url: '/proj/' + D.mac.url, width: 1.02, shot: this.texM }); }
    catch (e) { this.mac = fallbackDevice(ctx, 'mac', { width: 1.55, shot: this.texM }); }
    this.st.add(this.phone.pivot, this.mac.pivot);

    // «رسمه»: الشاشة السودا وقت الرسم لازم تنقص مع المجسّم
    this.black = new THREE.MeshBasicMaterial({ color: 0x050505, toneMapped: false });
    this.lit = this.phone.screenPlane.material;
    this.wire = wireDraw(ctx, this.phone, { extraMats: [this.black] });
    this.st.add(this.wire.scan);

    // العدسات (للماكرو بأول ثانية): نقطة بإحداثيات الجهاز من project.json، وإلا من خامات العدسة
    this.phone.pivot.updateMatrixWorld(true);
    const lb = new THREE.Box3();
    this.phone.pivot.traverse(m => { if (m.isMesh && m.material && /camera lens|sapphire/i.test(m.material.name)) lb.expandByObject(m); });
    const inv = new THREE.Matrix4().copy(this.phone.pivot.matrixWorld).invert();
    this.lens = D.phone && D.phone.lens ? new THREE.Vector3(...D.phone.lens) : lb.isEmpty() ? new THREE.Vector3(-0.08, 0.27, -0.03) : lb.getCenter(new THREE.Vector3()).applyMatrix4(inv);
    this.glint = new THREE.PointLight(0xffffff, 0, 1.2, 1.5); this.st.add(this.glint);

    // اللقطة الطايرة: نفس لقطة الحساب كبطاقة تدخل الشاشة
    this.fly = new THREE.Mesh(this.phone.screenPlane.geometry, new THREE.MeshBasicMaterial({ map: this.texP, toneMapped: false, transparent: true }));
    this.st.add(this.fly);
    this.shP = sheen(ctx, this.phone); this.shM = sheen(ctx, this.mac);

    this.claude = (ctx.project.images || {}).mark ? ctx.img('mark') : null;   // شعار اختياري جنب «كلود رسمه»
    this.flow = {};
    this.M = plans((l, i) => ctx.wordTime(l, i).s, id => ctx.timeline.scenes.find(s => s.id === id).start, K);
  },

  draw(t, lt, ctx) {
    const { X, P, E, at, THREE } = ctx, w = (l, i) => ctx.wordTime(l, i).s;
    studioBg(ctx, { cy: 760 });
    const M = this.M, ph = this.phone.pivot, mc = this.mac.pivot;

    // الآيفون: كل الدوران نوابض فيزيائية
    const wob = 0.03 * Math.sin(t * 0.9);
    ph.rotation.set(M.phoneRX(t) + 0.015 * Math.sin(t * 0.7), M.phoneRY(t) + wob + M.phoneRYexit(t), M.phoneRZ(t));
    ph.position.set(M.phoneX(t), M.phoneY(t) + 0.012 * Math.sin(t * 1.3), M.phoneZ(t));
    ph.visible = t < M.tSwap + 0.6;
    ph.updateMatrixWorld(true);

    // «كلود رسمه»: المسح من تحت لفوق يحوّله خطوط، ومع «رسمه» يرسمه من فوق لتحت
    const yTop = 0.47, yBot = -0.45;
    const kA = E.sineInOut(at(t, M.tWire, M.tWire + 0.38)), kB = E.cubicInOut(at(t, M.tDraw, M.tDraw + 0.75));
    const yS = t < M.tWire ? -9 : t < M.tDraw ? yBot + (yTop - yBot) * kA : yTop + (yBot - yTop) * kB;
    const drawing = t >= M.tWire && kB < 1;
    this.wire.set(yS, drawing, drawing && ((kA > 0 && kA < 1) || (kB > 0 && kB < 1)));
    this.wire.scan.position.x = ph.position.x; this.wire.scan.position.z = ph.position.z; this.wire.scan.rotation.y = ph.rotation.y;

    // الشاشة: سودا من بداية الرسم لين توصل لقطة الحساب
    const tGive = M.tPut, tLand = w('l3', 5) + 0.12;
    this.phone.screenPlane.material = t >= M.tWire && t < tLand ? this.black : this.lit;
    this.fly.visible = t >= tGive - 0.05 && t < tLand + 0.02;
    if (this.fly.visible) {
      const ps = this.phone.screenPlane, target = new THREE.Vector3(), tq = new THREE.Quaternion();
      ps.getWorldPosition(target); ps.getWorldQuaternion(tq);
      const k0 = E.expoOut(at(t, tGive - 0.05, tGive + 0.45)), kfl = E.cubicInOut(at(t, w('l3', 3), tLand));
      const cam = this.st.camera.position;
      this.fly.position.lerpVectors(new THREE.Vector3(cam.x * 0.7 + 0.12, cam.y * 0.7 + 0.1, cam.z * 0.62), target, kfl);
      this.fly.quaternion.slerpQuaternions(new THREE.Quaternion().setFromEuler(new THREE.Euler(0.1, -0.45 + 0.15 * Math.sin(t * 2), 0.14)), tq, kfl);
      this.fly.scale.setScalar((0.5 + 0.5 * kfl) * (0.55 + 0.45 * k0));
      this.fly.material.opacity = Math.min(1, k0 * 1.4);
    }

    // الماك بوك
    const tMac = M.tMac, t60 = M.t60;
    mc.visible = t >= tMac - 0.1;
    mc.position.set(M.macX(t), M.macY(t), M.macZ(t));
    mc.rotation.set(0, M.macRY(t), 0);
    mc.updateMatrixWorld(true);

    // الكاميرا: محطات بنوابض (camRig) — zoom: true يشيل الزجاج والكلمات اللي تحت
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const orbit = () => ({ p: V(0.3 * Math.sin(t * 0.32 + 0.6), 0.1, 3.3), l: V(0, -0.1, 0) });
    const macro = () => {
      const lw = this.lens.clone().applyMatrix4(ph.matrixWorld), n = V(0, 0, -1).transformDirection(ph.matrixWorld);
      return { p: lw.clone().add(n.multiplyScalar(0.24)).add(V(0.03, 0.02, 0)), l: lw };
    };
    const macWide = () => ({ p: V(0.3 * Math.sin(t * 0.32 + 0.6), 0.42, 3.55), l: V(0, t < t60 - 0.9 ? -0.34 : -0.3, 0) });
    const cam = this.st.camera;
    const r = camRig(t, [
      { at: 0, pose: macro },
      { at: 0.28, pose: orbit, f: 0.62, z: 0.96 },
      { at: w('l2', 0) - 0.08, pose: () => ({ p: V(-0.9, -0.36, 2.75), l: V(0, -0.06, 0) }), f: 2.0, z: 0.8 },
      { at: w('l2', 4) - 0.08, pose: () => ({ p: V(0.8, 1.45, 2.15), l: V(0, -0.04, 0) }), f: 2.0, z: 0.8, roll: -0.05 },
      { at: w('l2', 6) - 0.08, pose: () => ({ p: V(1.2, 0.22, 1.95), l: V(0, -0.1, 0) }), f: 2.0, z: 0.8, roll: 0.1 },
      { at: M.tWire - 0.1, pose: () => ({ p: V(-0.62, 0.3, 2.95), l: V(0, -0.1, 0) }), f: 1.1, z: 0.9 },
      { at: M.tPut, pose: () => ({ p: V(0.08, 0.02, 3.0), l: V(0, -0.1, 0) }), f: 0.9, z: 0.92 },
      { at: w('l4', 1) - 0.3, pose: zoomPose(THREE, this.phone, 0.44, 0.165, 0.36), f: 1.25, z: 0.86, zoom: true },
      { at: w('l4', 4) - 0.22, pose: zoomPose(THREE, this.phone, 0.833, 0.648, 0.44), f: 1.35, z: 0.84, zoom: true },
      { at: w('l4', 5) - 0.05, pose: orbit, f: 0.95, z: 0.86 },
      { at: tMac + 0.1, pose: macWide, f: 0.6, z: 1 },
      { at: w('l5', 6) - 0.28, pose: zoomPose(THREE, this.mac, 0.38, 0.22, 1.0), f: 1.2, z: 0.86, zoom: true },
      { at: w('l5', 7) - 0.1, pose: macWide, f: 0.8, z: 0.9 },
    ]);
    applyCam(cam, r);
    hideGlass([this.phone, this.mac], r.zoomW >= 0.15);

    // لمعة العدسة بأول ثانية
    const lw = this.lens.clone().applyMatrix4(ph.matrixWorld), kg = at(t, 0.05, 0.85);
    this.glint.intensity = t < 1.0 ? 2.2 * Math.sin(Math.PI * kg) : 0;
    this.glint.position.set(lw.x - 0.15 + 0.3 * kg, lw.y + 0.06, lw.z - 0.12);

    // لمعة الزجاج: لما تنحط اللقطة، ومع كل زوم
    const sh = (a, b) => at(t, a, b), win = k => Math.sin(Math.PI * Math.min(1, Math.max(0, k)));
    const s1 = sh(tLand - 0.05, tLand + 0.6), s2 = sh(w('l4', 1) + 0.05, w('l4', 1) + 0.75), s3 = sh(w('l4', 4) + 0.1, w('l4', 4) + 0.8);
    const sk = s1 > 0 && s1 < 1 ? s1 : s2 > 0 && s2 < 1 ? s2 : s3;
    this.shP.set(sk, 0.55 * win(sk));
    const sm = sh(w('l5', 6) + 0.05, w('l5', 6) + 0.8);
    this.shM.set(sm, 0.45 * win(sm));

    this.L.key.position.set(2.2 + 0.6 * Math.sin(t * 0.25), 4.5, 3.2);
    if (t >= t60 - 1.6) ctx.FX.flowLines(ctx, t, Object.assign(this.flow, { s: t60 - 1.6, n: 2200, dir: 200, lw: 2.0, shapes: [{ at: t60 + 0.15, text: '60', size: 470, x: 540, y: 1280, family: 'num', weight: 900, hold: 2.4, hi: true }] }));
    this.st.draw(X);

    // إطار يحدّد الميزة وقت الزوم (المتابعين ثم الريل)
    const ring = (rect, a, b) => featureRing(ctx, cam, this.phone, rect, E.cubicOut(at(t, a, a + 0.45)), 1 - at(t, b - 0.3, b));
    ring([0.315, 0.148, 0.565, 0.182], w('l4', 1) + 0.15, w('l4', 4) - 0.1);
    ring([0.668, 0.548, 0.998, 0.748], w('l4', 4) + 0.25, w('l4', 5) + 0.1);

    // الكلمات الكبيرة تحت الجهاز — تختفي وقت الزوم
    const Y = 1480, vis = 1 - Math.min(1, r.zoomW * 1.6);
    if (vis > 0.01) {
      X.save(); X.globalAlpha = vis;
      bigWords(ctx, t, { text: 'مو تصوير', s: w('l1', 5), times: [w('l1', 5), w('l1', 6)], e: w('l2', 0) + 0.3, y: Y, size: 130, accent: [1] });
      ctx.text.slot(X, t, [[w('l2', 0) - 0.1, 'ولا برنامج 3D'], [w('l2', 4) - 0.1, 'ولا مصمم'], [w('l2', 6) - 0.1, 'ولا كاميرا'], [w('l3', 0) - 0.1, 'كلود رسمه'], [w('l3', 2) - 0.1, 'داخل شاشته'],
        [w('l4', 0) - 0.1, ' '], [w('l4', 5) - 0.1, 'أو رابط موقعك'], [w('l5', 2) - 0.1, 'آيفون'], [w('l5', 4) - 0.1, 'أو ماك بوك'], [w('l5', 6) - 0.2, ' '], [w('l6', 0) - 0.1, 'حركة ناعمة'], [w('l6', 3) - 0.6, ' ']],
        { x: 540, y: Y, size: 120, family: 'display', weight: 900, color: P.ink });
      if (t > w('l6', 3) + 0.2 && t < ctx.scene.end + 0.3) bigWords(ctx, t, { text: 'فريم بالثانية', s: w('l6', 4), times: [w('l6', 4), w('l6', 5)], e: ctx.scene.end + 0.3, y: 1480, size: 72, color: P.mut, rise: 60 });
      const cs = w('l3', 0) - 0.1, ce = w('l3', 2) - 0.1;
      if (this.claude && t > cs && t < ce + 0.3) { const k = E.expoOut(at(t, cs, cs + 0.35)) * (1 - E.sineInOut(at(t, ce - 0.1, ce + 0.3)));
        X.globalAlpha = vis * k; const s = 92; X.drawImage(this.claude, 540 - 425 - s / 2, Y - 92 + (1 - k) * 30, s, s); }
      X.restore();
    }
  },
});
