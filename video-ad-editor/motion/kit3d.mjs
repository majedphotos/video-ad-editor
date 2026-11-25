// kit3d — أجهزة حقيقية (GLB) + حركة فيزيائية + كلمات مجسّمة، فوق ctx.stage3D. ما يغيّر المحرّك.
// الشرح والوصفة: references/devices-3d.md · مثال شغّال: motion/examples/devices-3d/
// المشهد:  import { loadDevice, studio, ... } from '/motion/kit3d.mjs';
// الدوال الرياضية (springStep · track · throwOut · speed · whooshes · dedupeCues · camRig) صافية بلا متصفح،
// فسكربت الصوت (scripts/46_motion_sfx.mjs) يستورد نفس الأرقام ويطلع الووش بنفس لحظة الحركة.

const TAU = Math.PI * 2;

/* ══════════ ١) الحركة الفيزيائية ══════════
   النابض المخمّد بدل منحنيات الإيزنق الجاهزة: الجسم له وزن، يتسارع لين أعلى سرعة بنص الحركة، يهدّي، ويعدّي هدفه شوي ويرجع.
   f = التردد بالهرتز: أعلى = أخف وأسرع (جوال ~0.9–1.1) · أقل = أثقل (لابتوب ~0.5–0.7)
   z = التخميد: 0.55–0.65 لفة فيها تخطّي واضح · 0.7–0.8 تخطّي خفيف · 1 طفو بلا تخطّي
   (E.spring بالمحرّك نابض واحد 0→1؛ هني تجمع عدة أهداف ورا بعض بنفس المسار) */
export function springStep(u, f, z) {
  if (u <= 0) return 0;
  const w = TAU * f;
  if (z >= 1) { const a = w * u; return 1 - Math.exp(-a) * (1 + a); }
  const wd = w * Math.sqrt(1 - z * z), e = Math.exp(-z * w * u);
  return 1 - e * (Math.cos(wd * u) + (z / Math.sqrt(1 - z * z)) * Math.sin(wd * u));
}

// مسار كامل: قيمة بداية ثم أهداف [{at, to, f, z, antic}] — antic = تحضير (يرجع شوي عكس الاتجاه 0.16 ث قبل الحركة)
export function track(v0, steps, def = {}) {
  const S = []; let prev = v0;
  for (const s of steps) {
    const f = s.f ?? def.f ?? 0.9, z = s.z ?? def.z ?? 0.7;
    if (s.antic) {
      const dir = Math.sign(s.to - prev) || 1;
      S.push({ at: s.at - 0.16, d: -dir * s.antic, f: 2.6, z: 0.9 });
      S.push({ at: s.at, d: dir * s.antic, f, z });
    }
    S.push({ at: s.at, d: s.to - prev, f, z }); prev = s.to;
  }
  const fn = t => { let v = v0; for (const s of S) v += s.d * springStep(t - s.at, s.f, s.z); return v; };
  fn.steps = steps; fn.v0 = v0;
  return fn;
}

// رمية للخروج: تبدأ هادية وتتسارع (دفع، مو نابض)
export function throwOut(t, at, dur, from, to) {
  if (t <= at) return from; const u = Math.min(1, (t - at) / dur);
  return from + (to - from) * u * u * u;
}

export function speed(fn, t, h = 1 / 240) { return (fn(t + h) - fn(t - h)) / (2 * h); }

/* الووش من الحركة نفسها: ذروة الصوت = لحظة أعلى سرعة · العلو لوغاريتمي مع السرعة · الطول = عرض حدبة السرعة.
   r = نص عرض الجسم بالمتر (سرعة الحافة = ω·r) · thr = أقل سرعة حافة تستاهل صوت (الحركات الصغيرة صامتة)
   الثقيل حدته أوطى: pitch أقل للابتوب */
export function whooshes(fn, { from, to, r, thr = 1.1, type = 'whoosh', pan = 0, pitch = 1, gmax = 0.75 }) {
  const out = [], dt = 1 / 240;
  let inHump = false, pk = 0, pkT = 0, s0 = 0;
  for (let t = from; t <= to; t += dt) {
    const v = Math.abs(speed(fn, t)) * r;
    if (!inHump && v > thr * 0.45) { inHump = true; s0 = t; pk = 0; }
    if (!inHump) continue;
    if (v > pk) { pk = v; pkT = t; }
    if (v < thr * 0.45) {
      inHump = false;
      if (pk >= thr) out.push({ type, at: +pkT.toFixed(3), gain: +Math.min(gmax, 0.28 + 0.16 * Math.log2(pk / thr + 1)).toFixed(2),
        dur: +Math.min(0.9, Math.max(0.32, (t - s0) * 1.1)).toFixed(2), pitch: +(pitch * Math.min(1.35, 0.8 + 0.12 * pk / thr)).toFixed(2), pan });
    }
  }
  return out;
}

// صوت واحد لكل لحظة: أي اثنين أقرب من gap نخلي الأقوى بس
export function dedupeCues(cues, gap = 0.35) {
  const c = [...cues].sort((a, b) => a.at - b.at);
  for (let i = c.length - 1; i > 0; i--) if (i < c.length && c[i].at - c[i - 1].at < gap) c.splice(c[i].gain >= c[i - 1].gain ? i - 1 : i, 1);
  return c;
}

/* كاميرا بمحطات نوابض (تقطع مثل يد المصوّر: تنطلق، توصل، تهدّي).
   stops: [{at, pose: () => ({p: Vector3, l: Vector3}), f, z, roll (راديان), zoom: true}] — أول محطة ثابتة.
   يرجّع {p, l, roll, zoomW} — zoomW من 0 لـ1 وقت الزوم على الشاشة (استخدمه تشيل الزجاج والكلمات اللي تحت). */
export function camRig(t, stops) {
  let p = null, l = null, roll = 0, zoomW = 0;
  for (let i = 0; i < stops.length; i++) {
    const s = stops[i]; if (i > 0 && t < s.at) break;
    const P = s.pose(), k = i === 0 ? 1 : springStep(t - s.at, s.f ?? 1, s.z ?? 0.85);
    if (!p) { p = P.p.clone(); l = P.l.clone(); roll = s.roll || 0; zoomW = s.zoom ? 1 : 0; continue; }
    p.lerp(P.p, k); l.lerp(P.l, k);
    const kk = Math.min(1, k); zoomW += ((s.zoom ? 1 : 0) - zoomW) * kk; roll += ((s.roll || 0) - roll) * kk;
  }
  return { p, l, roll, zoomW };
}
export function applyCam(cam, r) { cam.position.copy(r.p); cam.up.set(Math.sin(r.roll), Math.cos(r.roll), 0); cam.lookAt(r.l); }

/* ══════════ ٢) الأجهزة الحقيقية (ملفات GLB) ══════════
   الملفات ما تنحط داخل البلقن (رخصة Sketchfab تمنع التوزيع) — المستخدم ينزّلها بحسابه لـ<المشروع>/models/ */
const glbCache = {};
async function loadGLB(url) {
  if (!glbCache[url]) glbCache[url] = import('three/addons/loaders/GLTFLoader.js')
    .then(({ GLTFLoader }) => new Promise((res, rej) => new GLTFLoader().load(url, res, undefined, rej)));
  return glbCache[url];
}

// مستطيل مدوّر (للشاشة) بإحداثيات UV من 0 لـ1
function roundRect(THREE, w, h, r) {
  const s = new THREE.Shape(), x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ShapeGeometry(s, 16), p = g.attributes.position, uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / w + 0.5, p.getY(i) / h + 0.5);
  return g;
}

// لقطة الشاشة (من project.images) كتكستشر حادة — لقطة بدقة عالية = زوم بلا تشويش (references/devices-3d.md)
export function shotTexture(ctx, name) {
  const { THREE } = ctx, im = ctx.img(name), c = document.createElement('canvas');
  c.width = im.naturalWidth || im.width; c.height = im.naturalHeight || im.height; c.getContext('2d').drawImage(im, 0, 0);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 16;
  tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  return tex;
}

// إضاءة استوديو: ضوء رئيسي بظل ناعم + حافة + سماء، أرضية تستقبل الظل بس، وشبكة أرضية تذوب بالضباب (تعطي مكان وحركة لما الكاميرا تمشي)
export function studio(ctx, st, o = {}) {
  const { THREE } = ctx, R = st.renderer, fy = o.floorY ?? -0.62;
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  const key = new THREE.DirectionalLight(0xfff4ea, o.key ?? 2.4);
  key.position.set(2.2, 4.5, 3.2); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.radius = 9; key.shadow.blurSamples = 20; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.01;
  Object.assign(key.shadow.camera, { left: -2.5, right: 2.5, top: 2.5, bottom: -2.5, near: 0.5, far: 14 });
  const rim = new THREE.DirectionalLight(0xffffff, o.rim ?? 1.3); rim.position.set(-3.5, 1.5, -2.5);
  const fill = new THREE.HemisphereLight(0xffffff, 0xd9cfc0, o.fill ?? 0.55);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: o.shadow ?? 0.22, color: 0x3a2a1c }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = fy; floor.receiveShadow = true;
  st.add(key, key.target, rim, fill, floor);
  let grid = null;
  if (o.grid !== false) {
    const gc = new THREE.Color(o.gridColor ?? (ctx.P && ctx.P.mut) ?? '#8A847A');
    grid = new THREE.GridHelper(60, 120, gc, gc);
    grid.material.transparent = true; grid.material.opacity = o.gridOpacity ?? 0.4; grid.material.depthWrite = false;
    grid.position.y = fy + 0.001; st.add(grid);
    st.scene.fog = new THREE.Fog(new THREE.Color(o.fogColor ?? (ctx.P && ctx.P.bg) ?? '#F0EEE6'), o.fogNear ?? 4.5, o.fogFar ?? 13);
  }
  return { key, rim, fill, floor, grid };
}

// يوجّه الجوال: الأطول = Y، الأنحف = Z، والشاشة على +Z
function orient(THREE, root, screen, kind) {
  if (kind !== 'phone') return;
  root.updateMatrixWorld(true);
  const sz = new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
  const ax = ['x', 'y', 'z'].sort((a, b) => sz[a] - sz[b]);
  const B = { x: new THREE.Vector3(1, 0, 0), y: new THREE.Vector3(0, 1, 0), z: new THREE.Vector3(0, 0, 1) };
  root.quaternion.premultiply(new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(B[ax[1]], B[ax[2]], B[ax[0]]).invert()));
  root.updateMatrixWorld(true);
  if (screen) {
    const c = new THREE.Box3().setFromObject(root).getCenter(new THREE.Vector3());
    const sc = new THREE.Box3().setFromObject(screen).getCenter(new THREE.Vector3());
    if (sc.z < c.z) { root.quaternion.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI)); root.updateMatrixWorld(true); }
  }
}

function findScreen(root, test) {
  let best = null, area = 0;
  root.traverse(o => {
    if (!o.isMesh) return;
    if (!test((o.name + ' ' + (o.material && o.material.name || '')).toLowerCase())) return;
    o.geometry.computeBoundingBox(); const s = o.geometry.boundingBox.getSize(new o.position.constructor());
    const a = Math.max(s.x * s.y, s.y * s.z, s.x * s.z);
    if (a > area) { area = a; best = o; }
  });
  return best;
}

// جهاز مرسوم بديل (لين توصل ملفات الموديل — للمسودة بس، مو للتسليم)
export function fallbackDevice(ctx, kind, o = {}) {
  const { THREE, RoundedBoxGeometry } = ctx, pivot = new THREE.Group(), holder = new THREE.Group(); pivot.add(holder);
  const metal = new THREE.MeshPhysicalMaterial({ color: 0xb9bbc0, metalness: 1, roughness: 0.28 });
  if (kind === 'phone') {
    const h = o.height || 1, w = h * 0.479, d = h * 0.058;
    const body = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 8, d * 0.49), metal); body.castShadow = true; holder.add(body);
    const sp = new THREE.Mesh(roundRect(THREE, w * 0.93, h * 0.965, w * 0.11), new THREE.MeshBasicMaterial({ map: o.shot, toneMapped: false })); sp.position.z = d / 2 + 0.001; pivot.add(sp);
    return { pivot, holder, screenPlane: sp, size: new THREE.Vector3(w, h, d), fallback: true };
  }
  const W = o.width || 1.6, D = W * 0.7, T = W * 0.045, LH = D * 0.95;
  const base = new THREE.Mesh(new RoundedBoxGeometry(W, T, D, 4, T * 0.45), metal); base.position.y = T / 2; base.castShadow = true; holder.add(base);
  const lid = new THREE.Group(); lid.position.set(0, T, -D / 2); holder.add(lid);
  const lb = new THREE.Mesh(new RoundedBoxGeometry(W, LH, T * 0.5, 4, T * 0.2), metal); lb.position.set(0, LH / 2, 0); lb.castShadow = true; lid.add(lb);
  const sp = new THREE.Mesh(roundRect(THREE, W * 0.94, LH * 0.92, 0.02), new THREE.MeshBasicMaterial({ map: o.shot, toneMapped: false })); sp.position.set(0, LH / 2, T * 0.26); lid.add(sp);
  lid.rotation.x = -0.28;
  return { pivot, holder, screenPlane: sp, lid, size: new THREE.Vector3(W, LH, D), fallback: true };
}

/* يحمّل جهاز ويجهّزه. kind: 'phone' | 'mac'
   o: {url, height (للجوال، متر) | width (للماك)، shot (تكستشر)، screenMat (اسم خامة الشاشة بالموديل — الأدق)،
       screenName | screenRe، hideScreen (يخفي شاشة الموديل الأصلية)، tint: {اسم خامة: '#لون'}، rotate: [x,y,z] (بدل التوجيه الآلي)،
       inset، radius، env}
   يرجّع {root, holder, pivot, screen, screenPlane, size} — pivot هو اللي تحرّكه وتلفّه. screenPlane.userData.glass = لمعة الزجاج */
export async function loadDevice(ctx, kind, o) {
  const { THREE } = ctx;
  const root = (await loadGLB(o.url)).scene.clone(true);
  root.traverse(m => { if (!m.isMesh) return; m.castShadow = true; m.receiveShadow = false;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(mt => { if (mt && 'envMapIntensity' in mt) mt.envMapIntensity = o.env ?? 1.0; }); });
  if (o.tint) { const done = {};
    root.traverse(m => { if (!m.isMesh || !m.material || Array.isArray(m.material)) return;
      const nm = m.material.name, c = o.tint[nm]; if (!c) return;
      if (!done[nm]) { done[nm] = m.material.clone(); done[nm].color = new THREE.Color(c); }
      m.material = done[nm]; }); }
  const screen = o.screenName ? root.getObjectByName(o.screenName)
    : o.screenMat ? findScreen(root, nm => nm.endsWith(' ' + o.screenMat.toLowerCase()))
    : findScreen(root, nm => (o.screenRe || /screen|display|lcd|oled/).test(nm));
  if (o.rotate) { root.rotation.set(...o.rotate); root.updateMatrixWorld(true); } else orient(THREE, root, screen, kind);
  root.updateMatrixWorld(true);
  const bb = new THREE.Box3().setFromObject(root), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
  const s = kind === 'phone' ? (o.height || 1) / sz.y : (o.width || 1.6) / sz.x;
  const holder = new THREE.Group(); holder.add(root);
  root.position.sub(c); root.updateMatrixWorld(true); holder.scale.setScalar(s);
  if (kind === 'mac') holder.position.y = sz.y * s / 2;
  const pivot = new THREE.Group(); pivot.add(holder); pivot.updateMatrixWorld(true);
  let screenPlane = null;
  if (screen && o.shot) {
    screen.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(pivot.matrixWorld).invert(), g = screen.geometry; g.computeBoundingBox();
    const b = g.boundingBox, corners = [];
    for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z])
      corners.push(new THREE.Vector3(x, y, z).applyMatrix4(screen.matrixWorld).applyMatrix4(inv));
    const sb = new THREE.Box3().setFromPoints(corners), ss = sb.getSize(new THREE.Vector3()), scn = sb.getCenter(new THREE.Vector3());
    const ins = o.inset ?? 0, w = ss.x * (1 - ins), h = (kind === 'mac' ? Math.hypot(ss.y, ss.z) : ss.y) * (1 - ins);
    const geo = roundRect(THREE, w, h, Math.min(w, h) * (o.radius ?? (kind === 'phone' ? 0.115 : 0.02)));
    screenPlane = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: o.shot, toneMapped: false }));
    if (kind === 'phone') screenPlane.position.set(scn.x, scn.y, sb.max.z + 0.0008);
    else { screenPlane.position.copy(scn); screenPlane.rotation.x = -Math.atan2(ss.z, ss.y); screenPlane.translateZ(0.0015); }
    pivot.add(screenPlane);
    const glass = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ color: 0x000000, roughness: 0.04, clearcoat: 1, clearcoatRoughness: 0.02, transparent: true, opacity: 0.09, envMapIntensity: 2.0, depthWrite: false }));
    glass.position.copy(screenPlane.position); glass.rotation.copy(screenPlane.rotation); glass.translateZ(0.0006);
    pivot.add(glass); screenPlane.userData.glass = glass;
    if (o.hideScreen) screen.visible = false;
  }
  return { root, holder, pivot, screen, screenPlane, size: sz.clone().multiplyScalar(s) };
}

// نقطة على شاشة الجهاز (u,v من فوق يسار، 0–1) بإحداثيات العالم + اتجاه وجه الشاشة — للزوم على ميزة
export function screenPoint(THREE, dev, u, v) {
  const sp = dev.screenPlane; sp.geometry.computeBoundingBox();
  const b = sp.geometry.boundingBox, w = b.max.x - b.min.x, h = b.max.y - b.min.y;
  sp.updateMatrixWorld(true);
  return { p: new THREE.Vector3(b.min.x + u * w, b.max.y - v * h, 0).applyMatrix4(sp.matrixWorld),
    n: new THREE.Vector3(0, 0, 1).transformDirection(sp.matrixWorld) };
}
// محطة كاميرا للزوم: d = بعد الكاميرا عن الشاشة (أصغر = أقرب)
export const zoomPose = (THREE, dev, u, v, d) => () => { const s = screenPoint(THREE, dev, u, v); return { p: s.p.clone().add(s.n.multiplyScalar(d)), l: s.p }; };

// وقت الزوم: زجاج الموديل (خامة اسمها Glass) ولمعتنا يحطون طبقة رمادية فوق اللقطة — نشيلهم
export function hideGlass(devs, hidden) {
  for (const d of devs) {
    const g = d.screenPlane && d.screenPlane.userData.glass; if (g) g.visible = !hidden;
    d.root && d.root.traverse(m => { if (m.isMesh && m.material && /^glass$/i.test(m.material.name)) m.visible = !hidden; });
  }
}

// لمعة تمشي على الزجاج: شريط ضوء مايل (إضافة). sh.set(k من 0 لـ1 = مكان الشريط، a = قوته)
export function sheen(ctx, dev) {
  const { THREE } = ctx, sp = dev.screenPlane, c = document.createElement('canvas'); c.width = 512; c.height = 64;
  const g = c.getContext('2d'), gr = g.createLinearGradient(0, 0, 512, 0);
  [[0, 0], [0.42, 0], [0.5, 0.85], [0.53, 0.35], [0.6, 0], [1, 0]].forEach(([p, a]) => gr.addColorStop(p, `rgba(255,255,255,${a})`));
  g.fillStyle = gr; g.fillRect(0, 0, 512, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(sp.geometry, mat); mesh.position.copy(sp.position); mesh.rotation.copy(sp.rotation); mesh.translateZ(0.0012);
  dev.pivot.add(mesh);
  return { mesh, set(k, a) { mat.opacity = a; tex.repeat.set(0.55, 1); tex.offset.set(0.75 - 1.3 * k, 0); tex.rotation = 0.5; tex.center.set(0.5, 0.5); } };
}

/* «رسمه»: الجهاز يتفكك خطوط (حواف الموديل الحقيقية) ويرجع يرتسم مجسّم بمستوى قص يمشي عليه.
   st.renderer.localClippingEnabled = true لازم. w.set(y, on): y = ارتفاع خط المسح بإحداثيات العالم — تحته خطوط وفوقه مجسّم.
   on=false يرجّعه مجسّم كامل. w.scan = خط مضيء بلون التمييز تحرّكه مع y */
export function wireDraw(ctx, dev, o = {}) {
  const { THREE } = ctx;
  const cutSolid = new THREE.Plane(new THREE.Vector3(0, 1, 0), 9), cutWire = new THREE.Plane(new THREE.Vector3(0, -1, 0), -9);
  const wireMat = new THREE.LineBasicMaterial({ color: new THREE.Color(o.ink ?? ctx.P.ink), transparent: true, opacity: o.opacity ?? 0.85, clippingPlanes: [cutWire] });
  const wires = [], mats = new Set(), skip = new Set([dev.screenPlane, dev.screenPlane && dev.screenPlane.userData.glass, ...(o.skip || [])]);
  dev.pivot.traverse(m => {
    if (!m.isMesh) return;
    (Array.isArray(m.material) ? m.material : [m.material]).forEach(mt => mats.add(mt));
    if (skip.has(m) || !m.geometry || !m.visible) return;
    const L = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, o.angle ?? 28), wireMat); L.visible = false; m.add(L); wires.push(L);
  });
  (o.extraMats || []).forEach(mt => mats.add(mt));
  mats.forEach(mt => { mt.clippingPlanes = [cutSolid]; mt.clipShadows = true; mt.needsUpdate = true; });
  const scan = new THREE.Mesh(new THREE.BoxGeometry(o.scanW ?? 0.5, 0.0035, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(ctx.P.acc), toneMapped: false }));
  scan.visible = false;
  return { wires, scan, cutSolid, cutWire, addMaterial(mt) { mt.clippingPlanes = [cutSolid]; mt.needsUpdate = true; },
    set(y, on, showScan = on) { cutSolid.constant = on ? -y : 9; cutWire.constant = on ? y : -9; wires.forEach(L => { L.visible = on; }); scan.visible = !!showScan; scan.position.y = y; } };
}

// إطار يحدّد ميزة على الشاشة وقت الزوم: خط بلون التمييز ينرسم حولها (k = كم انرسم 0–1، alpha)
export function featureRing(ctx, cam, dev, [u0, v0, u1, v1], k, alpha = 1, o = {}) {
  if (k <= 0 || alpha <= 0) return;
  const { X, THREE } = ctx;
  const pr = (u, v) => { const s = screenPoint(THREE, dev, u, v).p.project(cam); return [(s.x + 1) / 2 * ctx.W, (1 - s.y) / 2 * ctx.H]; };
  const A = pr(u0, v0), B = pr(u1, v0), C = pr(u1, v1), D = pr(u0, v1), per = [A, B, C, D, A];
  let L = 0; for (let i = 1; i < 5; i++) L += Math.hypot(per[i][0] - per[i - 1][0], per[i][1] - per[i - 1][1]);
  X.save(); X.globalAlpha = alpha; X.strokeStyle = o.color ?? ctx.P.acc; X.lineWidth = o.width ?? 9; X.lineJoin = 'round'; X.lineCap = 'round';
  X.setLineDash([L * k, L]); X.beginPath(); X.moveTo(...A); [B, C, D, A].forEach(q => X.lineTo(...q)); X.stroke(); X.restore();
}

/* ══════════ ٣) كلمات مجسّمة بخط حقيقي ══════════
   scripts/45_text3d.py يشكّل الحروف العربية (harfbuzz) ويطلع مسارات ← هني ExtrudeGeometry بحافة مشطوفة تلقط الضوء.
   ⛔ لا تستخدم طبقات نص فوق بعض (extrudedText) — تبين رخيصة. */
let WORDS = null;
export async function loadWords(url) { if (!WORDS) WORDS = await (await fetch(url)).json(); return WORDS; }
let SVGL = null;
export async function ready3DText() { if (!SVGL) SVGL = (await import('three/addons/loaders/SVGLoader.js')).SVGLoader; }
// o: {height (ارتفاع الحرف بالمتر تقريباً), depth, bevel, face, side, rough, metal, clearcoat, env} — قبله: await loadWords(...) و await ready3DText()
export function word3D(ctx, text, o = {}) {
  const { THREE } = ctx, d = WORDS && WORDS[text];
  if (!d) throw new Error('word3D: «' + text + '» مو بملف الكلمات — ضيفها بـscripts/45_text3d.py');
  if (!SVGL) throw new Error('word3D: نادِ await ready3DText() بالـsetup أول');
  const k = (o.height ?? 1) / d.upem;
  const sp = new SVGL().parse(`<svg><path d="${d.d}"/></svg>`).paths[0]; sp.userData.style.fillRule = 'nonzero';
  const depth = (o.depth ?? 0.22) / k, bev = (o.bevel ?? 0.025) / k;
  const geo = new THREE.ExtrudeGeometry(SVGL.createShapes(sp), { depth, bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.8, bevelSegments: 4, curveSegments: 10 });
  geo.scale(k, k, k); geo.computeBoundingBox();
  const c = geo.boundingBox.getCenter(new THREE.Vector3()); geo.translate(-c.x, -c.y, -c.z); geo.computeVertexNormals();
  const face = new THREE.MeshPhysicalMaterial({ color: o.face ?? ctx.P.ink, roughness: o.rough ?? 0.28, metalness: o.metal ?? 0, clearcoat: o.clearcoat ?? 1, clearcoatRoughness: 0.06, envMapIntensity: o.env ?? 1.1 });
  const side = new THREE.MeshPhysicalMaterial({ color: o.side ?? o.face ?? ctx.P.ink, roughness: (o.rough ?? 0.28) + 0.1, metalness: o.metal ?? 0, clearcoat: 0.6, envMapIntensity: o.env ?? 1.1 });
  const m = new THREE.Mesh(geo, [face, side]); m.castShadow = true;
  const g = new THREE.Group(); g.add(m); g.userData.size = geo.boundingBox.getSize(new THREE.Vector3()); g.userData.mesh = m;
  return g;
}
