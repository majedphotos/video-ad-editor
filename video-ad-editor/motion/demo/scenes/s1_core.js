/* s1 — مشهد 3D: نواة تتنفّس على الإيقاع + حلقة شظايا متوهجة (بلوم) + «كلود» مجسّمة */
MOTION.scene({
  id: 's1', start: 0, end: 1.5,
  setup(ctx) {
    const { THREE } = ctx;
    const st = this.st = ctx.stage3D({ fov: 32, camera: [0, 0.4, 13], env: 'room', bloom: { strength: 0.85, radius: 0.5, threshold: 1.5 }, tone: 'neutral', exposure: 1.0 });
    // core: rounded box, clay, glossy
    this.core = st.add(new THREE.Mesh(new ctx.RoundedBoxGeometry(1.9, 1.9, 1.9, 6, 0.34),
      new THREE.MeshPhysicalMaterial({ color: ctx.P.acc, roughness: 0.34, metalness: 0.05, clearcoat: 0.25, clearcoatRoughness: 0.4, envMapIntensity: 0.3 })));
    const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(4, 6, 8); st.scene.add(key);
    const rim = new THREE.PointLight(0xE8A283, 40, 30); rim.position.set(-5, -2, -4); st.scene.add(rim);
    // shards ring (instanced, analytic motion, HDR colours → bloom)
    const cols = [ctx.P.acc, ctx.P.hi, '#FFFFFF'];
    this.shards = ctx.particles3D({
      count: 260, seed: 11, geometry: 'tetra', glow: 3.2,
      spawn: (i, r) => { const a = r() * Math.PI * 2, rad = r.range(2.2, 3.6); return { p: [Math.cos(a) * rad, r.gauss() * 0.35, Math.sin(a) * rad], v: [0, 0, 0], s: r.range(0.05, 0.16), delay: r.range(0, 0.5), color: r.pick(cols) }; },
    });
    this.ring = new THREE.Group(); this.ring.add(this.shards.mesh); this.ring.position.y = 0.45; this.ring.rotation.x = 0.42; st.add(this.ring);
    // extruded Arabic title
    this.title = ctx.extrudedText('كلود', { family: 'display', weight: 400, size: 260, height: 1.8, depth: 0.36, layers: 30, color: '#FFF6EC', sideColor: ctx.P.clay, sideColor2: '#2A120A' });
    this.title.position.set(0, -1.05, 2.5); st.add(this.title);
  },
  draw(t, lt, ctx) {
    const { X, E, at, P } = ctx, st = this.st;
    // 2D under 3D: ink backdrop + soft radial warmth
    X.fillStyle = P.ink; X.fillRect(0, 0, ctx.W, ctx.H);
    const g = X.createRadialGradient(540, 820, 60, 540, 820, 900); g.addColorStop(0, 'rgba(217,119,87,0.35)'); g.addColorStop(1, 'rgba(27,26,23,0)');
    X.fillStyle = g; X.fillRect(0, 0, ctx.W, ctx.H);
    // 3D
    const pulse = ctx.beatPulse(t, 9), intro = at(lt, 0, 0.7, 'expoOut');
    this.core.scale.setScalar((0.2 + 0.8 * E.springK(ctx.prog(lt, 0, 0.9))) * (1 + 0.06 * pulse));
    this.core.position.y = 0.45; this.core.rotation.set(0.5 + lt * 0.9, 0.7 + lt * 1.3, 0.1);
    this.ring.rotation.y = lt * 0.8; this.shards.update(lt);
    const tk = at(lt, 0.35, 1.0, 'backOut');
    this.title.position.y = -1.05 + (1 - tk) * -2.4; this.title.rotation.y = (1 - tk) * -0.9 + Math.sin(lt * 2) * 0.08; this.title.visible = lt > 0.35;
    st.orbit(-0.15 + lt * 0.18, 0.05, 13 - 2.2 * intro);
    st.draw(X);
    // 2D over 3D: VO-synced words (each word rises exactly when it is spoken)
    const L = ctx.text.layout(X, 'نفس الشغل،', { family: 'body', weight: 700, size: 76 });
    ctx.text.drawLayout(X, L, 540, 330, { color: '#FFF6EC', perWord: (i) => { const w = ctx.wordTime('l1', i), k = ctx.at(t, w.s - 0.06, w.s + 0.28, 'expoOut'); return { clipUp: 1, dy: (1 - k) * 90, alpha: k > 0 ? 1 : 0 }; } });
  },
});
