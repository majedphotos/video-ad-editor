# Motion Engine: API for scene authors ("شرح بالموشن")

This is a pure motion-graphics film engine. The pipeline is: script, then voice, then 2D and 3D scenes, then beat-synced sound, then a 60fps MP4.
The engine is deterministic: frame `t` depends only on `t`. Canvas 2D is the compositor. three.js r186 (vendored) renders 3D stages that you composite into the 2D frame wherever you want.

```
motion/
  engine.html, engine.js  the runtime (loaded by render.js through a local server)
  render.js               preview / range / all / bench / serve   (headless Chrome, real GPU via ANGLE-Metal)
  voice.py                script.json → vo/<id>.wav + vo/words.json   (edge-tts, or --own + whisper)
  timeline.py             project.json + words.json → timeline.json + vo/vo_full.wav
  audio.py                bed + sfx + VO → -14 LUFS → renders/final.mp4
  vendor/three/           three.module.js + addons (EffectComposer, RenderPass, UnrealBloomPass, OutputPass, ShaderPass, FXAAPass, AfterimagePass, RoundedBoxGeometry, RoomEnvironment, TextGeometry, SVGLoader, BufferGeometryUtils)
  fonts/                  OFL fonts + licenses/
  demo/                   working reference project (3D + bloom scene, and Arabic kinetic scene)
```

## 1. Project folder

```
myproj/
  project.json   settings (you write it)
  script.json    [{id, text, rate?, pitch?, voice?, gap_after?}]   (you write it; Kuwaiti dialect)
  sfx.json       [{type, at, gain?, dur?, pitch?, pan?}]            (optional)
  scenes/*.js    one file per scene
  assets/        images (declared in project.images)
  vo/  timeline.json  renders/   (generated)
```

`project.json`:
```json
{ "name": "…", "fps": 60, "width": 1080, "height": 1920, "bpm": 120, "beatsPerBar": 4, "beatOffset": 0,
  "palette": { "bg": "#F0EBE0", "ink": "#1B1A17", "acc": "#D97757", "clay": "#C15F3C", "hi": "#E8A283", "mut": "#8A847A" },
  "fonts": { "display": "Lalezar", "body": "IBM Plex Sans Arabic", "num": "Inter" },
  "images": { "mark": "@logos/claude_mark.png", "shot": "assets/shot.png" },
  "post": { "grain": 0.04, "vignette": 0.25 },
  "voice": { "name": "<the voice the user picked>", "rate": "+20%", "pitch": "-6Hz" },
  "timing": { "snap": "half", "snapTarget": "line", "snapLines": "all", "leadIn": 0.25, "gap": 0.15, "startPad": 0.2, "tail": 0.6 },
  "music": { "key": "A", "scale": "minor", "progression": [0, 5, 2, 6], "level": -7, "duck": -4, "top": { "hat": 17, "pluck": 4 } },
  "sections": [ { "name": "intro", "at": 0 }, { "name": "build", "at": "line:l3" }, { "name": "drop", "at": "scene:s4" }, { "name": "outro", "at": "scene:s7" } ],
  "scenes": [ { "id": "s1", "file": "scenes/s1.js", "lines": ["l1", "l2"], "minDur": 1.5 },
              { "id": "s2", "file": "scenes/s2.js", "lines": ["l3"], "transition": { "type": "wipe", "dur": 0.4, "dir": "rtl" } } ]
}
```
Font families you can use by name, or by the aliases in `fonts`: `Cairo` (variable 200–1000), `IBM Plex Sans Arabic` (400/700), `Noto Kufi Arabic` (100–900), `Lalezar`, `Readex Pro` (160–700), `Aref Ruqaa` (400/700), `Tajawal` (400/700/900), `Inter` (100–900). The built-in aliases are `display`, `body`, `num`, `kufi` and `cairo`. To add more families, use `"extraFonts": [{"family","file","weight"}]` with paths relative to the project folder.

`timeline.json` is generated. It holds `duration`, `bpm`, `beats[]`, `bars[]`, `sections[{name,start,end}]`, `scenes[{id,file,start,end,lines,transition}]` and `vo[{id,text,start,end,words[{w,s,e}]}]`. All times are absolute seconds. Without a timeline.json, the engine falls back to each scene's own `start`/`end` and derives beats from `bpm`.

## 2. Scene contract

```js
// scenes/s2.js — plain script or ES module (import * as THREE from 'three' works via the import map)
MOTION.scene({
  id: 's2',                 // must match project.json scenes[].id
  start: 1.5, end: 3.0,     // fallback only: timeline.json wins when present
  transition: { type: 'wipe', dur: 0.4 },   // fallback; project/timeline wins
  async setup(ctx) { … },   // once, awaited. Build meshes/textures here. `this` is the scene object; keep state on it.
  draw(t, lt, ctx) { … },   // every frame. t = global seconds, lt = t - scene.start (can be <0 or >dur inside transitions)
});
```
Rules:
- Never use `Math.random`, `Date`, `performance.now` or `requestAnimationFrame` in scenes. Use `ctx.rng()` and `ctx.noise*`.
- `draw` must set every animated property from `t`. Never accumulate (`x += v`). Frames render out of order and in parallel pages.
- You draw into `ctx.X` in design pixels (1080×1920). The base transform handles `--scale`, so never call `setTransform(1,0,0,1,0,0)`. Use `ctx.resetTransform()` instead.
- `ctx.X` state is reset before each draw. Paint your own background.
- Keep every scene inside the reels safe zone. No text at y 0–150 or y 1620–1920 (1500–1620 is a caution band), and none at x 950–1080 while y is 1100–1750. Check with `--safe`.
- Digits are Western. Every ctx text helper converts Arabic-Indic digits automatically, and `ctx.num()` formats with `en-US`.

### Transitions
A scene's `transition` blends it in over the previous scene during the window `[start - dur/2, start + dur/2]`. In that window both scenes draw into their own layers, so `lt` of the incoming scene goes negative and `lt` of the outgoing scene exceeds its duration.
Available types are `cut`, `crossfade`, `dip` (color), `flash`, `wipe` (dir `rtl|ltr|up|down`, `bar`, `color`), `push` (dir), `zoom`, `iris` (`at:[x,y]`, `ring`), `blinds` (`n`) and `glitch`. Add `ease: 'expoInOut'` to reshape k.
For a custom transition, set `type: (X, A, B, k, opts) => {…}`. A and B are the layer canvases in device pixels.

## 3. ctx reference

| Group | Members |
|---|---|
| canvas | `X` (current 2D context), `OUT` (final composite), `W`, `H`, `fps`, `P`/`palette`, `resetTransform(X?)`, `img(name)`, `images` |
| scene | `scene` (`{id,start,end,dur,lines,transition}`), `project`, `timeline` |
| random | `rng(salt)` returns r() in [0,1) seeded by scene id+salt, with `r.range(a,b)`, `r.int`, `r.pick`, `r.sign`, `r.gauss`. `seeded(seed)`, `noise1(x,seed)`, `noise2(x,y,seed)`, `fbm(x,y,oct,seed)`, `hash01(...)` |
| easing | `E.linear`, `E.{quad,cubic,quart,quint,sine,expo,circ}{In,Out,InOut}`, `E.backIn/backOut/backInOut`, `E.back(s)`, `E.elasticOut/elasticIn`, `E.elastic(amp,per)`, `E.bounceIn/Out`, `E.spring({stiffness,damping,mass,velocity})(seconds)`, `E.springK(k)`, `E.bezier(x1,y1,x2,y2)(k)`, `E.snappy`, `E.smooth`, `E.anticipate` |
| time math | `clamp`, `lerp`, `prog(t,a,b)`, `map(v,a,b,c,d)`, `smoothstep(a,b,v)`, `fract`, `at(time,a,b,ease='cubicOut')` gives eased progress, `kf(t,[[t0,v0],[t1,v1,'backOut'],…])` for numbers or arrays |
| beats | `bpm`, `spb`, `beats`, `bars`, `beatIndex(t)`, `beatTime(i)`, `beatPhase(t)`, `beatPulse(t,decay=8,every=1)` (1 on the beat, then decays), `barPulse(t)`, `barIndex(t)`, `onBar(t,n)`, `nearestBeat(t)`, `section(t)` returning `{name,start,end}` |
| voice | `wordTime(lineId, i)` returns `{s,e,w}` (i may be negative, so -1 is the last word), `lineSpan(lineId)` returns `{s,e,text}`, `wordsOf(lineId)`, `activeWord(t, lineId?)`, `vo` |
| Arabic text | `text(X,str,x,y,{family,weight,size,color,align,dir,maxWidth(shrinks),scaleX,letterSpacing,stroke:{width,color},shadow:{blur,y,color},alpha})` |
| | `text.layout(X,str,{family,weight,size,maxWidth,lineHeight,wordSpacing})` gives lines and words in RTL visual order. Runs of Latin words stay LTR. |
| | `text.drawLayout(X,L,x,y,{align,color,perWord:(i,word,box)=>({alpha,dx,dy,scale,rot,color,reveal,clipUp,clip,stroke,shadow,skip})})` returns the word boxes. `reveal` is an RTL wipe mask from 0 to 1. `clipUp` masks at the baseline so a word can rise out of it. |
| | `text.kashida(X,str,targetW,{font…})` returns `{text,scaleX,count}`. It inserts tatweel only at legal joins and keeps the lam-alef ligature. `text.drawKashida(X,str,x,y,w,opts,amount0to1)` animates a line from its natural width to width `w`. |
| | `text.fit(X,str,{family,weight,box:{w,h},min,max,maxLines})` returns `{size,layout}`. `text.typeSub(str,k)` is a typewriter substring that keeps the joining form through ZWJ. `text.westernDigits(s)`. `num(v,decimals)`. `font(family,weight,size)` gives a CSS font string. |
| 3D | `stage3D({fov,near,far,camera:[x,y,z],lookAt,background:null\|'#hex',env:'room',bloom:{strength,radius,threshold},tone:'aces'\|'agx'\|'neutral'\|'none',exposure,rgbShift,vignette,fxaa,samples})` returns `{THREE,scene,camera,composer,renderer,bloom,draw(X?,{alpha,blend,filter,exposure}),orbit(az,el,dist,target),add(obj)}` |
| | `st.draw(X)` renders the stage and composites it at that point of your 2D code. Z-order is simply call order: 2D under, then `st.draw()`, then 2D over. All stages share one WebGLRenderer, with transparent clear and premultiplied-correct tone mapping, so bloom halos composite cleanly over 2D. |
| | `textPlane(str,{family,weight,size,height,color,glow,lit})` makes a canvas-texture mesh. `glow>1` pushes it to HDR so bloom catches it. `extrudedText(str,{height,depth,layers,color,sideColor,sideColor2,glow})` is a stacked-layer "extruded" look. `textTexture(str,opts)`. |
| | `THREE`, `RoundedBoxGeometry`, `BufferGeometryUtils`, `EffectComposer`, `RenderPass`, `UnrealBloomPass`, `OutputPass`, `ShaderPass`, `renderer()` |
| particles | `particles3D({count,seed,geometry:'sphere'\|'box'\|'tetra'\|'octa'\|'plane'\|'rounded'\|BufferGeometry,glow,color,material,spawn:(i,r)=>({p,v,s,spin,delay,life,color}),gravity,drag,sizeOverLife})` returns `{mesh,update(lt)}`. Motion is analytic, so any t works. `particles2D({count,seed,spawn:(i,r)=>({x,y,vx,vy,r,color,delay,life,shape}),gravity,drag})` returns `{draw(X,lt,alpha)}`. |
| strokes | `drawPath(X, svgPathD \| [[x,y],…], k, {width,color,cap,smooth,glow,glowColor,tip:{r,color,glow},from})` draws a hand-drawn stroke and returns the pen tip `[x,y]`. `pathInfo(src)` returns `{len,at(l),path}`. |
| motion-kit | `MK` is `scripts/motion-kit.js` (odometer, statCard, lineChart, compareBars, kinetic, techFrame, timeline, commentBox, stamp, statGrid, iconArray, burst, shake). The globals `X, BG, INK, ACC, CLAY, MUT, FONT` are shimmed from the project palette before every draw, so you can call `ctx.MK.odometer(t, {...})` directly. |

## 4. Example: 3D scene with bloom
```js
MOTION.scene({ id: 'core',
  setup(ctx) {
    const { THREE } = ctx;
    this.st = ctx.stage3D({ fov: 32, camera: [0, 0, 12], env: 'room', tone: 'neutral', bloom: { strength: .85, radius: .5, threshold: 1.5 } });
    this.cube = this.st.add(new THREE.Mesh(new ctx.RoundedBoxGeometry(2, 2, 2, 6, .35),
      new THREE.MeshPhysicalMaterial({ color: ctx.P.acc, roughness: .35, clearcoat: .25, envMapIntensity: .3 })));
    this.sparks = ctx.particles3D({ count: 240, seed: 3, geometry: 'tetra', glow: 3,
      spawn: (i, r) => { const a = r() * 6.283, d = r.range(2.2, 3.6); return { p: [Math.cos(a) * d, r.gauss() * .3, Math.sin(a) * d], s: r.range(.05, .15), delay: r.range(0, .5) }; } });
    this.st.add(this.sparks.mesh);
    this.title = ctx.extrudedText('كلود', { family: 'display', size: 260, height: 1.8, depth: .36, color: '#FFF6EC', sideColor: ctx.P.clay });
    this.title.position.set(0, -1.05, 2.5); this.st.add(this.title);
  },
  draw(t, lt, ctx) {
    const { X, P } = ctx;
    X.fillStyle = P.ink; X.fillRect(0, 0, ctx.W, ctx.H);                        // 2D under
    this.cube.rotation.set(lt * .9, lt * 1.3, 0);
    this.cube.scale.setScalar(ctx.E.springK(ctx.prog(lt, 0, .9)) * (1 + .06 * ctx.beatPulse(t, 9)));
    this.sparks.update(lt);
    this.st.orbit(lt * .18, .05, 13 - 2 * ctx.at(lt, 0, .7, 'expoOut'));
    this.st.draw(X);                                                            // 3D
    const L = ctx.text.layout(X, 'نفس الشغل،', { family: 'body', weight: 700, size: 76 });   // 2D over, VO-synced
    ctx.text.drawLayout(X, L, 540, 330, { color: '#FFF6EC', perWord: i => { const w = ctx.wordTime('l1', i), k = ctx.at(t, w.s - .06, w.s + .28, 'expoOut'); return { clipUp: 1, dy: (1 - k) * 90, alpha: k > 0 ? 1 : 0 }; } });
  } });
```
Bloom tips: set `threshold` above anything that is merely well lit (1.2–1.6 with `tone:'neutral'`) and push only the elements that should glow into HDR (`glow: 2–4`). If you get a white blowout, the lit surfaces are crossing the threshold. Raise the threshold or lower `envMapIntensity`.

## 5. Example: 2D kinetic type
```js
MOTION.scene({ id: 'faster',
  setup(ctx) { this.bits = ctx.particles2D({ count: 40, seed: 5, spawn: (i, r) => ({ x: r.range(80, 1000), y: r.range(1100, 1400), vx: r.gauss() * 40, vy: -r.range(60, 180), r: r.range(3, 7), color: r.pick([ctx.P.acc, ctx.P.ink]), delay: .9, life: .9 }) }); },
  draw(t, lt, ctx) {
    const { X, P, at } = ctx;
    X.fillStyle = P.bg; X.fillRect(0, 0, ctx.W, ctx.H);
    const w = ctx.wordTime('l2', 1);                                              // «أسرع»
    ctx.text.drawKashida(X, 'بس أسرع', 540, 820, 900, { family: 'display', size: 230, color: P.clay }, at(t, w.s - .05, w.e + .25, 'expoInOut'));
    const v = Math.round(300 * at(lt, .45, 1.15, 'expoOut'));
    ctx.text(X, ctx.num(v) + '%', 540, 1180, { family: 'num', weight: 900, size: 210, dir: 'ltr' });
    ctx.drawPath(X, [[250, 1235], [640, 1242], [830, 1228]], at(lt, 1, 1.35), { width: 14, color: P.acc, tip: { r: 9 } });
    ctx.MK.burst(t, { s: ctx.scene.start + 1.15, cx: 540, cy: 1100, spread: 260 });
    this.bits.draw(X, lt);
  } });
```

## 6. Commands
```bash
cd video-ad-editor/motion
python3 voice.py <proj>                      # TTS per line (cache: only changed lines regenerate)
python3 voice.py <proj> --own me.wav         # your own recording: whisper word timing, split by script lines
python3 timeline.py <proj>                   # beat-snapped timeline + vo/vo_full.wav
node render.js <proj> preview 0.5 1.2 2.8 --safe       # stills + contact.png (look at them!)
node render.js <proj> serve                  # live scrub/play player in your browser (preview only)
node render.js <proj> all --scale 0.5        # fast draft → renders/video_s0.5.mp4
node render.js <proj> all                    # final frames (resume) → renders/video.mp4 (H.264 crf16 60fps bt709 faststart)
node render.js <proj> all --fresh            # after editing scenes (resume would keep stale frames)
node render.js <proj> range 4 6              # re-render seconds 4..6 only (delete those frames first, or use --fresh)
node render.js <proj> bench                  # cost split: CPU submit vs GPU+readback+JPEG
python3 audio.py <proj> [--no-bed]           # bed + sfx + VO → -14 LUFS / TP ≤ -1.5 → renders/final.mp4
python3 audio.py <proj> --audition           # every sfx as its own wav in renders/audio/
```

## 7. Performance on an M1 Pro (demo, 1080×1920)
- Full render: about 22–25 ms/frame with 1 page and about 14.5 ms/frame wall with 2 pages (the default for `all`). That is about 70 fps, so one minute of 60fps video takes about 52 s.
- Almost all of the cost is GPU completion plus readback plus JPEG encode (about 18 ms). Scene CPU work is about 1 ms. Heavy scenes change this, so measure with `bench`.
- Tips: build geometry, textures and text canvases in `setup`, never in `draw`. Cache `text.layout` results that don't change. Use one `stage3D` per scene. Bloom adds GPU passes, so measure it with `bench`. Avoid `X.filter='blur()'` on full-frame layers because it is expensive. Use `--scale 0.5` for drafts (about 2.7× faster: 5.3 vs 14.4 ms/frame wall).
- Determinism: repeated renders are bit-identical except for rare ±1/255 GPU rounding on a pixel or so.

## 8. Audio notes
- `sfx.json` `at` accepts seconds, `scene:id`, `scene-end:id`, `line:id`, `line-end:id`, `word:line:i` (-1 is the last word), `beat:n` or `bar:n`, each with an optional offset such as `scene:s2-0.1`. Anchors: `riser` and `reverse-whoosh` end at `at`, `whoosh` and `swoosh-pass` peak at `at`, and everything else starts there.
- The bed follows `sections`. `intro` gives pad, hats and downbeat kick. `build` adds a filter sweep, 8th bass and a snare roll into the next section. `drop` is full: 4-on-floor kick, claps, bass, 16th arp and a crash at its start. `break` keeps the energy at roughly drop loudness with a different texture: brighter pad, softer arp, a half-bar sub pulse on the root, the 4-on-floor kick (under a low-pass that opens across the break), off-beat hats and a quiet 16th shaker. It drops the claps and the drop bass. A break never mutes the pulse; only `stop` goes silent. `stop` is a true hard silence of the whole bed that restarts hard at the next section; use at most one per film and keep it to 1 bar or less. `outro` is pad, kick and bass. The bed is sidechain-pumped by the kick and ducked under the VO with 40 ms look-ahead.
- `music.top` is the phone layer: 93% of the kick/bass/pad energy sits below 150 Hz and a phone speaker drops it, so without `top` the bed plays as silence on a phone. `top` adds hats/snap at 5-10 kHz and a pluck at 0.4-3 kHz. Pass one dB trim for both, or `{hat, pluck}`. Keep the pluck lower, because it shares its band with speech. Check the result with a 200 Hz high-pass: in speech the bed should sit 10-12 dB under the VO. The VO enters the mix through `st(vo)`, which puts it 3 dB lower per channel, so the real bed-to-VO gap is about 3 dB smaller than `level` says. Reference: opus55-motion with level -7, duck -4 and top {hat 17, pluck 4} measured 12.7 dB for the whole film and 10.2 dB in the densest drop.
- Majed's wording rule: call it «ملف صوتي بالخلفية», and it is optional (`--no-bed`). The content decision is his.
