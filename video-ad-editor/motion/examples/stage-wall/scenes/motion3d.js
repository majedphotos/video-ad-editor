/* موشن ثلاثي الأبعاد: مكعب برتقالي يطلع بسبرنق ويدور، وحوله مدار مكعبات صغيرة — داخل النافذة */
MOTION.scene({
  id: 'motion3d',
  setup(ctx) {
    const { THREE, P } = ctx;
    this.st = ctx.stage3D({ fov: 30, camera: [0, 0, 13], env: 'room', tone: 'neutral' });
    const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(3, 5, 6); this.st.scene.add(sun);
    this.cube = this.st.add(new THREE.Mesh(new ctx.RoundedBoxGeometry(1.75, 1.75, 1.75, 6, .3),
      new THREE.MeshPhysicalMaterial({ color: P.acc, roughness: .32, clearcoat: .6, envMapIntensity: .55 })));
    this.ring = new THREE.Group(); this.st.add(this.ring);
    const r = ctx.rng('ring'), mat = new THREE.MeshStandardMaterial({ color: P.ink, roughness: .4, metalness: .1, envMapIntensity: .6 });
    this.bits = [];
    for (let i = 0; i < 14; i++) {
      const m = new THREE.Mesh(new ctx.RoundedBoxGeometry(.3, .3, .3, 3, .06), i % 4 === 0 ? this.cube.material : mat);
      m.userData = { a: i / 14 * Math.PI * 2, rad: r.range(2.3, 2.75), y: r.range(-.5, .5), s: r.range(.6, 1.15), d: i * .03 };
      this.ring.add(m); this.bits.push(m);
    }
  },
  draw(t, lt, ctx) {
    const { X, P, E, prog } = ctx;
    DEMO.card(X, ctx);
    const k = E.springK(prog(lt, 0.05, 1.0));
    this.cube.scale.setScalar(Math.max(.001, k) * (1 + .05 * ctx.beatPulse(t, 9)));
    this.cube.rotation.set(.5 + lt * .7, lt * 1.1 + (1 - k) * 2, .2);
    this.ring.rotation.set(.35, lt * .6, -.15);
    this.bits.forEach(m => { const u = m.userData, kk = E.backOut(prog(lt, .35 + u.d, .9 + u.d)); m.position.set(Math.cos(u.a) * u.rad * kk, u.y, Math.sin(u.a) * u.rad * kk); m.scale.setScalar(Math.max(.001, kk * u.s)); m.rotation.set(lt * 2 + u.a, lt * 1.5, 0); });
    this.st.orbit(lt * .12 - .1, .12, 13);
    this.st.draw(X, { y: DEMO.WIN.y + DEMO.WIN.h / 2 - 960 - 90 });
    const a = E.expoOut(prog(lt, .9, 1.4));
    ctx.text(X, '60', 540, 1260, { family: 'num', weight: 900, size: 120, color: P.ink, alpha: a, dir: 'ltr' });
    ctx.text(X, 'فريم بالثانية', 540, 1330, { family: 'body', weight: 700, size: 40, color: P.mut, alpha: a });
  },
});
