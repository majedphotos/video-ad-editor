/* ═══ styles.js — بنك الستايلات (اللغة البصرية للفيديو كله) ═══
   الحركة (moves.js) تجاوب «شلون يتحرك»، والستايل يجاوب «شلون يبين»: السطح، الملمس، الخط، الكرت، الملصق، والشخصية.
   الاستخدام (محرّك الموشن): project.json ← "style": "paperCut" (أو "explainer+keynote" دمج) → ctx.S جاهز، وctx.P والخطوط من الستايل.
   بريل الكلام (compose): MV.useStyle('paperCut') → MV.S ونفس الشي.
   داخل المشهد:
     S.background(X, t, { video: Y => …, person: Y => … })   // السطح (أو معالجة الفيديو) + الشخص بمعالجة الستايل
     S.card(X, x, y, w, h, o) · S.label(X, 'نص', x, y, o) · S.post(X, t)   // الكرت والملصق والملمس الأخير
     S.sig.<توقيع>(X, t, o)   // عناصر خاصة بكل ستايل (ختم، شريط لاصق، سهم يد، مؤشر…) — شوف SIGS تحت
     S.ease(k) · S.tq(t)       // إيزنق شخصية الستايل · الوقت «على اثنين» للستوب موشن
   ⚠ الستايل لغة مو قالب: ادمج (A+B)، أو خذ منه السطح بس، أو اخترع عنصر من معنى الجملة — الدليل references/styles.md
   ⚠ الكلمات العربية تنرسم ككلمات كاملة — لا letter-spacing ولا تقسيم حروف. */
(function () {
  const G = typeof window !== 'undefined' ? window : globalThis;
  const cl = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v)), lerp = (a, b, k) => a + (b - a) * k, TAU = Math.PI * 2;
  const E = {
    linear: k => k, sineInOut: k => -(Math.cos(Math.PI * k) - 1) / 2, cubicOut: k => 1 - Math.pow(1 - k, 3),
    expoOut: k => (k >= 1 ? 1 : 1 - Math.pow(2, -10 * k)), backOut: k => { const s = 1.9; k -= 1; return k * k * ((s + 1) * k + s) + 1; },
    softBack: k => { const s = 0.8; k -= 1; return k * k * ((s + 1) * k + s) + 1; },
    stepped: k => Math.floor(k * 6) / 6,
  };
  const PERSONALITY = { calm: 'sineInOut', clean: 'expoOut', snappy: 'backOut', bouncy: 'backOut', mechanical: 'stepped', organic: 'softBack', soft: 'cubicOut' };
  function rng(seed) { let x = (seed | 0) || 1; return () => { x ^= x << 13; x ^= x >> 17; x ^= x << 5; return ((x >>> 0) % 100000) / 100000; }; }
  const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; };
  const mk = (w, h) => { if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h); const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };

  /* ── الخطوط (نفس ملفات motion/fonts — compose يحمّلها بـMV.needFont) ── */
  const FONT_FILES = {
    'IBM Plex Sans Arabic': [['IBMPlexSansArabic-Regular.ttf', '400'], ['IBMPlexSansArabic-Bold.ttf', '700']],
    'Lalezar': [['Lalezar-Regular.ttf', '400']], 'Aref Ruqaa': [['ArefRuqaa-Regular.ttf', '400'], ['ArefRuqaa-Bold.ttf', '700']],
    'Readex Pro': [['ReadexPro-VF.ttf', '160 700']], 'Noto Kufi Arabic': [['NotoKufiArabic-VF.ttf', '100 900']], 'Cairo': [['Cairo-VF.ttf', '200 1000']],
    'Tajawal': [['Tajawal-Regular.ttf', '400'], ['Tajawal-Bold.ttf', '700'], ['Tajawal-Black.ttf', '900']], 'Inter': [['Inter-VF.ttf', '100 900']],
  };
  const MONO = 'ui-monospace, Menlo, Consolas, monospace';

  /* ══ التوكنز: 17 ستايل (من البحث labs: styles-research — الخط من الموجود بالمحرّك بس) ══
     families = عائلات بنك الحركات اللي تناسبه · personality = إيزنق كل الحركات · needsCut = السطح يبدّل خلفية الفيديو (يحتاج قصّ الشخص)
     cues = متى يناسب (يقراها 35_moves.py) · blend = أحلى خلطات · lockAcc = لونه جزء من هويته (ما ياخذ لون هوية المستخدم) */
  const TOK = {
    keynote: { name: 'كينوت', desc: 'فراغ كبير، كلمة وحدة تحمل المشهد، حركة قليلة مضبوطة', families: ['calm', 'onetake'], personality: 'clean',
      palette: { bg: '#F5F5F7', ink: '#1D1D1F', acc: '#D97757', mut: '#6E6E73', hi: '#F6C7A8' }, fonts: { display: 'IBM Plex Sans Arabic', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0, vignette: 0.10 }, surface: 'clean', card: 'soft', label: 'clean', person: 'plain', needsCut: true, cues: ['reveal', 'number', 'launch', 'calm'], blend: ['explainer', 'devCard', 'studio3D'] },
    glassUI: { name: 'زجاج الواجهة', desc: 'إشعارات وكروت وويدجت بمادة زجاجية فوق الفيديو، كأن الشاشة تتكلم', families: ['editorial', 'punch'], personality: 'organic',
      palette: { bg: '#0E1116', ink: '#FFFFFF', acc: '#D97757', mut: 'rgba(255,255,255,.72)', hi: '#FFD9C7' }, fonts: { display: 'Readex Pro', body: 'Readex Pro', num: 'Inter' },
      post: { grain: 0, vignette: 0.12 }, surface: 'video', card: 'glass', label: 'notif', person: 'plain', needsCut: false, cues: ['tech', 'app', 'list', 'chat'], blend: ['keynote', 'terminal'] },
    explainer: { lockAcc: true, name: 'شرح صحفي', desc: 'ورق ودبابيس وقلم تحديد وخيط أحمر — المعلومة تطلع موثّقة (Vox / جوني هاريس)', families: ['editorial'], personality: 'organic',
      palette: { bg: '#EDE5D3', ink: '#1B1A17', acc: '#FFE14D', mut: '#6B6255', hi: '#C8382B', paper: '#FBF7EE' }, fonts: { display: 'Aref Ruqaa', body: 'IBM Plex Sans Arabic', num: 'Inter', hand: 'Aref Ruqaa' },
      post: { grain: 0.05, vignette: 0.18 }, surface: 'paper', card: 'clipping', label: 'highlight', person: 'plain', needsCut: true, cues: ['news', 'number', 'contrast', 'map', 'source'], blend: ['keynote', 'paperCut', 'archive'] },
    paperCut: { name: 'ورق مقصوص', desc: 'كل شي قصاصة ورق بحد أبيض وظل قاسي، وانت نفسك ستيكر — ستوب موشن', families: ['punch', 'editorial'], personality: 'snappy', fps: 12,
      palette: { bg: '#E7D7B5', ink: '#1B1A17', acc: '#E2482B', hi: '#F2C230', mut: '#5E5240', paper: '#FBF7EE' }, fonts: { display: 'Lalezar', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0.04, vignette: 0.08 }, surface: 'kraft', card: 'torn', label: 'slap', person: 'sticker', needsCut: true, cues: ['hit', 'list', 'fun', 'emphasis'], blend: ['explainer', 'archive', 'doodle'] },
    archive: { lockAcc: true, name: 'وثائقي', desc: 'حبيبات فلم، ملف مانيلا، آلة كاتبة، ختم أحمر، وكن بيرنز بطيء', families: ['calm', 'editorial'], personality: 'calm',
      palette: { bg: '#2A231A', ink: '#231A0C', acc: '#B3261E', mut: '#5A4320', hi: '#D9C59A', paper: '#D9C59A' }, fonts: { display: 'Aref Ruqaa', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0.09, vignette: 0.45 }, surface: 'film', vfx: 'film', card: 'manila', label: 'stamp', person: 'warm', needsCut: false, cues: ['story', 'history', 'reveal', 'secret', 'date'], blend: ['explainer', 'paperCut', 'newsprint'] },
    editorial: { name: 'مجلة', desc: 'غلاف مجلة: عنوان ضخم ورا الراس، خطوط رفيعة، أرقام صغيرة بالزوايا', families: ['editorial', 'calm'], personality: 'clean',
      palette: { bg: '#F1ECE3', ink: '#141414', acc: '#C8382B', mut: '#6F6A62' }, fonts: { display: 'Aref Ruqaa', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0.02, vignette: 0 }, surface: 'solid', card: 'rule', label: 'masthead', person: 'plain', needsCut: true, cues: ['quote', 'profile', 'story', 'title'], blend: ['swiss', 'keynote'] },
    swiss: { lockAcc: true, name: 'سويسري', desc: 'شبكة صارمة، أحمر وأسود وأبيض، أشرطة وأرقام ضخمة، بلا زخرفة', families: ['punch', 'editorial'], personality: 'clean',
      palette: { bg: '#FFFFFF', ink: '#111111', acc: '#E30613', mut: '#777777' }, fonts: { display: 'Noto Kufi Arabic', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0, vignette: 0 }, surface: 'grid', card: 'block', label: 'bar', person: 'plain', needsCut: true, cues: ['number', 'list', 'steps', 'data'], blend: ['editorial', 'brutal'] },
    doodle: { name: 'رسم يد', desc: 'أسهم ودوائر بقلم تنرسم وهي تلحق الكلام، والخط «يغلي» شوي', families: ['calm', 'editorial'], personality: 'organic',
      palette: { bg: '#FBFAF6', ink: '#1B1A17', acc: '#D97757', mut: '#8A847A' }, fonts: { display: 'Aref Ruqaa', body: 'IBM Plex Sans Arabic', num: 'Inter', hand: 'Aref Ruqaa' },
      post: { grain: 0.02, vignette: 0 }, surface: 'video', card: 'sketch', label: 'circled', person: 'plain', needsCut: false, cues: ['emphasis', 'explain', 'arrow', 'tip'], blend: ['paperCut', 'explainer'] },
    terminal: { lockAcc: true, name: 'تيرمنال', desc: 'نافذة كود داكنة، مؤشر يومض، أوامر تنكتب ونتايج تطلع', families: ['punch', 'editorial'], personality: 'mechanical',
      palette: { bg: '#0D1117', ink: '#E6EDF3', acc: '#3FB950', mut: '#7D8590', hi: '#D2A8FF', warn: '#F0883E' }, fonts: { display: 'IBM Plex Sans Arabic', body: 'IBM Plex Sans Arabic', num: MONO, mono: MONO },
      post: { grain: 0, vignette: 0.15 }, surface: 'video', card: 'window', label: 'prompt', person: 'plain', needsCut: false, cues: ['tech', 'code', 'ai', 'tool'], blend: ['glassUI', 'devCard'] },
    riso: { lockAcc: true, name: 'ريزو', desc: 'حبرين فلورسنت متراكبين مزحزحين، ونقاط هافتون — طباعة يدوية', families: ['punch'], personality: 'snappy',
      palette: { bg: '#F4F0E8', ink: '#2B2B6B', acc: '#FF48B0', hi: '#00A9B5', mut: '#6E6A8C' }, fonts: { display: 'Lalezar', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0.05, vignette: 0 }, surface: 'riso', card: 'misreg', label: 'misreg', person: 'halftone', needsCut: true, cues: ['hook', 'title', 'fun'], blend: ['paperCut', 'newsprint'] },
    newsprint: { lockAcc: true, name: 'جريدة', desc: 'ورق جرايد، عنوان عريض، أعمدة رفيعة، وأحمر للعاجل بس', families: ['editorial'], personality: 'clean',
      palette: { bg: '#E9E5DC', ink: '#161513', acc: '#C8102E', mut: '#5C5850' }, fonts: { display: 'Aref Ruqaa', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0.06, vignette: 0.15 }, surface: 'newspaper', card: 'column', label: 'headline', person: 'plain', needsCut: true, cues: ['news', 'breaking', 'source'], blend: ['archive', 'explainer'] },
    blueprint: { lockAcc: true, name: 'بلوبرنت', desc: 'أزرق وشبكة قياس، خطوط تنرسم وأسهم أبعاد وcallouts تأشر', families: ['editorial', 'calm'], personality: 'calm',
      palette: { bg: '#1E4C8F', ink: '#FFFFFF', acc: '#FF9F43', mut: 'rgba(200,225,255,.75)', hi: '#9FD3FF' }, fonts: { display: 'Noto Kufi Arabic', body: 'Readex Pro', num: 'Inter' },
      post: { grain: 0.02, vignette: 0.2 }, surface: 'blueprint', card: 'outline', label: 'callout', person: 'plain', needsCut: true, cues: ['how', 'explain', 'parts', 'tech'], blend: ['terminal', 'swiss'] },
    vhs: { lockAcc: true, name: 'VHS', desc: 'شاشة قديمة: خطوط مسح ونزيف ألوان وOSD — لحظات «زمان» بس (1–3 ث)', families: ['punch'], personality: 'mechanical', moment: true,
      palette: { bg: '#0A0A12', ink: '#FFFFFF', acc: '#33FF66', mut: '#BBBBBB', hi: '#FF3366' }, fonts: { display: 'Noto Kufi Arabic', body: 'Noto Kufi Arabic', num: MONO, mono: MONO },
      post: { grain: 0.07, vignette: 0.35 }, surface: 'video', vfx: 'vhs', card: 'osd', label: 'osd', person: 'plain', needsCut: false, cues: ['flashback', 'old', 'retro'], blend: ['archive'] },
    brutal: { lockAcc: true, name: 'بروتالي', desc: 'ألوان صارخة، حدود سودة عريضة وظل قاسي، ضربة واهتزاز — للهوك والطلب بس', families: ['punch'], personality: 'snappy', moment: true,
      palette: { bg: '#FFE600', ink: '#000000', acc: '#FF3B00', mut: '#333333', paper: '#FFFFFF' }, fonts: { display: 'Lalezar', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0, vignette: 0 }, surface: 'video', card: 'brutal', label: 'boxed', person: 'plain', needsCut: false, cues: ['hook', 'cta', 'hit'], blend: ['swiss', 'stickerToon'] },
    studio3D: { name: 'ستوديو منتج', desc: 'خلفية كريمية بإضاءة ناعمة، اسم بارز كأنه مجسّم مطفي، وتاق أسود صغير', families: ['calm', 'onetake'], personality: 'calm',
      palette: { bg: '#EFE7DA', ink: '#1E1D1B', acc: '#D97757', mut: '#8A8276', hi: '#FFFFFF' }, fonts: { display: 'Cairo', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0.02, vignette: 0.22 }, surface: 'studio', card: 'soft', label: 'extrude', person: 'plain', needsCut: true, cues: ['launch', 'tool', 'free', 'name'], blend: ['keynote', 'devCard'] },
    stickerToon: { name: 'ستيكر كرتوني', desc: 'باستيل وحدود سودة ثابتة السماكة، فقاعات وماسكوت ينط — مرح', families: ['punch'], personality: 'bouncy', fps: 12,
      palette: { bg: '#F7C6D9', ink: '#111111', acc: '#FF7A1A', mut: '#5A4A55', paper: '#FFFDF7', hi: '#CFE6FF' }, fonts: { display: 'Lalezar', body: 'IBM Plex Sans Arabic', num: 'Inter' },
      post: { grain: 0, vignette: 0 }, surface: 'pastel', card: 'toon', label: 'pill', person: 'outline', needsCut: true, cues: ['fun', 'tool', 'explain', 'kids'], blend: ['doodle', 'paperCut'] },
    devCard: { name: 'كرت أداة', desc: 'كريمي بشبكة وأشعة، كرت أبيض، breadcrumb، كلمة أكسنت بالرقعة وchips', families: ['calm', 'editorial'], personality: 'clean',
      palette: { bg: '#F4EFE6', ink: '#1F1D1A', acc: '#C8643B', mut: '#8A847A', paper: '#FFFFFF', line: '#E7E0D4' }, fonts: { display: 'IBM Plex Sans Arabic', body: 'IBM Plex Sans Arabic', num: 'Inter', accent: 'Aref Ruqaa', mono: MONO },
      post: { grain: 0, vignette: 0.06 }, surface: 'devgrid', card: 'white', label: 'chip', person: 'plain', needsCut: true, cues: ['tool', 'skill', 'free', 'launch', 'fact'], blend: ['keynote', 'terminal', 'studio3D'] },
  };

  /* ══ أدوات مشتركة ══ */
  const tiles = {};
  function noiseTile(seed, alpha = 255, size = 256) { const k = seed + ':' + alpha; if (tiles[k]) return tiles[k];
    const c = mk(size, size), g = c.getContext('2d'), d = g.createImageData(size, size), r = rng(seed);
    for (let i = 0; i < d.data.length; i += 4) { const v = r() * 255; d.data[i] = d.data[i + 1] = d.data[i + 2] = v; d.data[i + 3] = alpha; } g.putImageData(d, 0, 0); return (tiles[k] = c); }
  function grain(X, W, H, frame, amt) { if (!amt) return; const tile = noiseTile(100 + (frame % 6)), r = rng(frame * 13 + 7);
    X.save(); X.globalAlpha = cl(amt * 4.5); X.globalCompositeOperation = 'overlay'; const ox = -r() * 256, oy = -r() * 256;
    for (let y = oy; y < H; y += 256) for (let x = ox; x < W; x += 256) X.drawImage(tile, x, y); X.restore(); }
  function vignette(X, W, H, a, col = '0,0,0') { if (!a) return; const g = X.createRadialGradient(W / 2, H * 0.45, H * 0.22, W / 2, H * 0.5, H * 0.82);
    g.addColorStop(0, `rgba(${col},0)`); g.addColorStop(1, `rgba(${col},${a})`); X.fillStyle = g; X.fillRect(0, 0, W, H); }
  function tornPath(X, x, y, w, h, seed, j = 7) { const r = rng(seed), P = [], st = 9;
    for (let i = 0; i <= w; i += st) P.push([x + i, y + (r() - 0.5) * j]); for (let i = 0; i <= h; i += st) P.push([x + w + (r() - 0.5) * j, y + i]);
    for (let i = w; i >= 0; i -= st) P.push([x + i, y + h + (r() - 0.5) * j]); for (let i = h; i >= 0; i -= st) P.push([x + (r() - 0.5) * j, y + i]);
    X.beginPath(); P.forEach((q, k) => (k ? X.lineTo(q[0], q[1]) : X.moveTo(q[0], q[1]))); X.closePath(); }
  function roughLine(X, pts, seed, wob = 3) { const r = rng(seed); X.beginPath(); pts.forEach((p, i) => { const x = p[0] + (r() - 0.5) * wob, y = p[1] + (r() - 0.5) * wob; i ? X.lineTo(x, y) : X.moveTo(x, y); }); }
  // يرسم الشخص لطبقة offscreen (للحد/الظل/الهافتون) — person = Y => {...} يرسم بإحداثيات 1080×1920
  function personLayer(S, person) { const W = S.W, H = S.H; if (!S._pl) S._pl = mk(W, H); const g = S._pl.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); person(g); return S._pl; }
  function tint(src, col, S, key = '_tn') { const W = S.W, H = S.H; if (!S[key]) S[key] = mk(W, H); const g = S[key].getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; g.drawImage(src, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; return S[key]; }
  function dilate(src, r, col, S) { const W = S.W, H = S.H; if (!S._dl) S._dl = mk(W, H); const g = S._dl.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H);
    for (let a = 0; a < 16; a++) { const t = (a / 16) * TAU; g.drawImage(src, Math.cos(t) * r, Math.sin(t) * r); }
    g.globalCompositeOperation = 'source-in'; g.fillStyle = col; g.fillRect(0, 0, W, H); g.globalCompositeOperation = 'source-over'; return S._dl; }
  function txt(X, s, x, y, o = {}) { X.save(); X.font = `${o.weight || 700} ${o.size || 80}px "${o.family}"`.replace(`"${MONO}"`, MONO); X.textAlign = o.align || 'center';
    X.textBaseline = o.baseline || 'alphabetic'; X.direction = o.dir || 'rtl'; X.globalAlpha *= o.alpha ?? 1;
    if (o.stroke) { X.lineJoin = 'round'; X.lineWidth = o.stroke.w; X.strokeStyle = o.stroke.c; X.strokeText(s, x, y); }
    X.fillStyle = o.color || '#000'; X.fillText(s, x, y); const w = X.measureText(s).width; X.restore(); return w; }
  const measure = (X, s, size, family, weight = 700) => { X.save(); X.font = `${weight} ${size}px "${family}"`.replace(`"${MONO}"`, MONO); X.direction = 'rtl'; const w = X.measureText(s).width; X.restore(); return w; };

  /* ══ السطوح — (X, t, S, o) ترسم الخلفية بدل خلفية الفيديو ══ */
  const SURF = {
    clean(X, t, S) { X.fillStyle = S.P.bg; X.fillRect(0, 0, S.W, S.H); const g = X.createRadialGradient(S.W / 2, S.H * 0.38, 40, S.W / 2, S.H * 0.45, S.H * 0.7);
      g.addColorStop(0, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)'); X.fillStyle = g; X.fillRect(0, 0, S.W, S.H); },
    solid(X, t, S) { X.fillStyle = S.P.bg; X.fillRect(0, 0, S.W, S.H); },
    paper(X, t, S) { X.fillStyle = S.P.bg; X.fillRect(0, 0, S.W, S.H); X.save(); X.globalAlpha = 0.35; X.globalCompositeOperation = 'multiply';
      const n = noiseTile(77, 40); for (let y = 0; y < S.H; y += 256) for (let x = 0; x < S.W; x += 256) X.drawImage(n, x, y); X.restore(); },
    kraft(X, t, S) { SURF.paper(X, t, S); const r = rng(5); X.save(); X.strokeStyle = 'rgba(120,90,50,.18)'; X.lineWidth = 1.4;
      for (let n = 0; n < 80; n++) { const x = r() * S.W, y = r() * S.H, a = r() * TAU, l = 10 + r() * 26; X.beginPath(); X.moveTo(x, y); X.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); X.stroke(); } X.restore(); },
    grid(X, t, S) { X.fillStyle = S.P.bg; X.fillRect(0, 0, S.W, S.H); X.save(); X.strokeStyle = 'rgba(0,0,0,.06)'; X.lineWidth = 2;
      for (let x = 0; x <= S.W; x += S.W / 12) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, S.H); X.stroke(); } X.restore(); },
    riso(X, t, S) { SURF.paper(X, t, S); X.save(); X.globalCompositeOperation = 'multiply'; X.fillStyle = S.P.acc; X.globalAlpha = 0.22;
      X.beginPath(); X.arc(S.W * 0.78, S.H * 0.2, 260, 0, TAU); X.fill(); X.fillStyle = S.P.hi; X.beginPath(); X.arc(S.W * 0.22, S.H * 0.3, 200, 0, TAU); X.fill(); X.restore(); },
    newspaper(X, t, S) { SURF.paper(X, t, S); X.save(); X.globalAlpha = 0.16; X.fillStyle = S.P.ink; const r = rng(31);
      for (let c = 0; c < 4; c++) for (let l = 0; l < 30; l++) { const x = 60 + c * 250, y = 1080 + l * 26; X.fillRect(x, y, 200 - r() * 50, 8); } X.restore(); },
    blueprint(X, t, S) { X.fillStyle = S.P.bg; X.fillRect(0, 0, S.W, S.H); if (!S._bp) { S._bp = mk(S.W, S.H); const g = S._bp.getContext('2d');
        g.strokeStyle = 'rgba(255,255,255,.07)'; g.lineWidth = 1; for (let x = 0; x <= S.W; x += 24) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S.H); g.stroke(); } for (let y = 0; y <= S.H; y += 24) { g.beginPath(); g.moveTo(0, y); g.lineTo(S.W, y); g.stroke(); }
        g.strokeStyle = 'rgba(255,255,255,.16)'; g.lineWidth = 2; for (let x = 0; x <= S.W; x += 120) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, S.H); g.stroke(); } for (let y = 0; y <= S.H; y += 120) { g.beginPath(); g.moveTo(0, y); g.lineTo(S.W, y); g.stroke(); } }
      X.drawImage(S._bp, 0, 0); },
    studio(X, t, S) { const g = X.createRadialGradient(S.W / 2, S.H * 0.42, 60, S.W / 2, S.H * 0.5, S.H * 0.75); g.addColorStop(0, '#F7F1E7'); g.addColorStop(0.6, S.P.bg); g.addColorStop(1, '#D9CDB9');
      X.fillStyle = g; X.fillRect(0, 0, S.W, S.H); const f = X.createLinearGradient(0, S.H * 0.55, 0, S.H); f.addColorStop(0, 'rgba(255,255,255,0)'); f.addColorStop(1, 'rgba(120,100,70,.10)'); X.fillStyle = f; X.fillRect(0, S.H * 0.55, S.W, S.H); },
    pastel(X, t, S) { X.fillStyle = S.P.bg; X.fillRect(0, 0, S.W, S.H); if (!S._pb) { S._pb = mk(S.W, S.H); const g = S._pb.getContext('2d'), r = rng(12); g.filter = 'blur(60px)';
        for (let n = 0; n < 5; n++) { g.fillStyle = n % 2 ? 'rgba(255,255,255,.35)' : 'rgba(200,80,130,.18)'; g.beginPath(); g.ellipse(r() * S.W, r() * S.H, 160 + r() * 200, 120 + r() * 160, r() * 3, 0, TAU); g.fill(); } }
      X.drawImage(S._pb, 0, 0); },
    devgrid(X, t, S) { X.fillStyle = S.P.bg; X.fillRect(0, 0, S.W, S.H); X.save(); X.strokeStyle = 'rgba(0,0,0,.06)'; X.lineWidth = 1.5;
      for (let x = 0; x <= S.W; x += 40) { X.beginPath(); X.moveTo(x, 0); X.lineTo(x, S.H); X.stroke(); } for (let y = 0; y <= S.H; y += 40) { X.beginPath(); X.moveTo(0, y); X.lineTo(S.W, y); X.stroke(); }
      const cx = S.W / 2, cy = S.H * 0.3, rot = t * 0.04; X.globalAlpha = 0.07; X.fillStyle = S.P.acc;
      for (let i = 0; i < 18; i++) { const a = rot + (i / 18) * TAU; X.beginPath(); X.moveTo(cx, cy); X.arc(cx, cy, S.H, a, a + TAU / 54); X.closePath(); X.fill(); } X.restore(); },
  };
  /* ══ معالجة الفيديو لما ما نبدّل الخلفية — (X, t, S, video) ══ */
  const VID = {
    plain(X, t, S, v) { v(X); },
    film(X, t, S, v) { const k = cl(S.kb ?? 0), z = 1 + 0.06 * E.sineInOut(k), fl = 1 + (rng(Math.floor(t * 24) * 31)() - 0.5) * 0.05;
      X.save(); X.translate(S.W / 2, S.H / 2); X.scale(z, z); X.translate(-S.W / 2 - 10 * k, -S.H / 2);
      X.filter = `grayscale(1) sepia(.55) contrast(1.12) brightness(${(0.9 * fl).toFixed(3)})`; v(X); X.filter = 'none'; X.restore(); },
    vhs(X, t, S, v) { if (!S._vh) S._vh = mk(S.W, S.H); const g = S._vh.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, S.W, S.H); g.filter = 'saturate(1.5) contrast(1.1)'; v(g); g.filter = 'none';
      const off = 5 + 3 * Math.sin(t * 9); X.save(); X.drawImage(S._vh, 0, 0); X.globalCompositeOperation = 'screen'; X.globalAlpha = 0.35;
      X.drawImage(tint(S._vh, '#FF0040', S, '_vr'), off, 0); X.drawImage(tint(S._vh, '#00E0FF', S, '_vb'), -off, 0); X.restore();
      const band = (t * 260) % S.H; X.save(); X.globalAlpha = 0.12; X.fillStyle = '#fff'; X.fillRect(0, band, S.W, 30); X.restore(); },
  };
  /* ══ معالجة الشخص — (X, t, S, person) ══ */
  const PER = {
    plain(X, t, S, p) { p(X); },
    warm(X, t, S, p) { X.save(); X.filter = 'sepia(.18) saturate(.85) contrast(1.04)'; p(X); X.restore(); },
    sticker(X, t, S, p) { const L = personLayer(S, p), r = rng(Math.floor(S.tq(t) * 12) * 7 + 1), jx = (r() - 0.5) * 3, jy = (r() - 0.5) * 3, rot = (r() - 0.5) * 0.006;
      X.save(); X.translate(S.W / 2 + jx, S.H / 2 + jy); X.rotate(rot); X.translate(-S.W / 2, -S.H / 2);
      const bd = dilate(L, 13, S.P.paper || '#FFFDF6', S); X.globalAlpha = 0.28; X.drawImage(tint(bd, '#3A2A14', S), 12, 14); X.globalAlpha = 1; X.drawImage(bd, 0, 0); X.drawImage(L, 0, 0); X.restore(); },
    outline(X, t, S, p) { const L = personLayer(S, p), bd = dilate(L, 8, S.P.ink, S); X.save(); X.globalAlpha = 0.9; X.drawImage(bd, 6, 7); X.globalAlpha = 1; X.drawImage(bd, 0, 0); X.drawImage(L, 0, 0); X.restore(); },
    halftone(X, t, S, p) { const L = personLayer(S, p), g = L.getContext('2d'), cell = 12, d = g.getImageData(0, 0, S.W, S.H).data;
      X.save(); X.globalCompositeOperation = 'multiply'; [[S.P.acc, 0], [S.P.ink, 4]].forEach(([c, off]) => { X.fillStyle = c;
        for (let y = cell / 2; y < S.H; y += cell) for (let x = cell / 2; x < S.W; x += cell) { const i = ((y | 0) * S.W + (x | 0)) * 4; if (d[i + 3] < 80) continue;
          const lum = (d[i] * 0.3 + d[i + 1] * 0.59 + d[i + 2] * 0.11) / 255, rad = (cell / 2) * Math.sqrt(1 - lum) * (off ? 0.8 : 1.05); if (rad < 0.6) continue;
          X.beginPath(); X.arc(x + off, y + off, rad, 0, TAU); X.fill(); } }); X.restore(); },
  };
  /* ══ الكروت — (X, x, y, w, h, o, S) x,y = الزاوية فوق يسار ══ */
  const CARD = {
    soft(X, x, y, w, h, o, S) { X.save(); X.shadowColor = 'rgba(0,0,0,.10)'; X.shadowBlur = 40; X.shadowOffsetY = 14; X.fillStyle = o.fill || '#FFFFFF'; X.beginPath(); X.roundRect(x, y, w, h, o.r ?? 36); X.fill(); X.restore(); },
    glass(X, x, y, w, h, o, S) { const r = o.r ?? 40; X.save(); X.shadowColor = 'rgba(0,0,0,.25)'; X.shadowBlur = 40; X.shadowOffsetY = 16; X.beginPath(); X.roundRect(x, y, w, h, r);
      X.fillStyle = o.fill || 'rgba(28,28,34,.42)'; X.fill(); X.shadowColor = 'transparent'; if (o.backdrop) { X.save(); X.clip(); X.filter = 'blur(24px) saturate(1.4)'; o.backdrop(X); X.filter = 'none'; X.fillStyle = 'rgba(255,255,255,.14)'; X.fillRect(x, y, w, h); X.restore(); }
      X.lineWidth = 2; X.strokeStyle = 'rgba(255,255,255,.38)'; X.stroke(); const g = X.createLinearGradient(0, y, 0, y + h * 0.4); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      X.fillStyle = g; X.beginPath(); X.roundRect(x + 2, y + 2, w - 4, h * 0.4, [r, r, 0, 0]); X.fill(); X.restore(); },
    clipping(X, x, y, w, h, o, S) { X.save(); tornPath(X, x + 8, y + 9, w, h, o.seed || 3, 5); X.fillStyle = 'rgba(40,30,15,.25)'; X.fill(); tornPath(X, x, y, w, h, o.seed || 3, 5); X.fillStyle = o.fill || S.P.paper; X.fill(); X.restore();
      if (o.pin !== false) SIGS.pin(X, 0, { x: x + w / 2, y: y + 18 }, S); },
    torn(X, x, y, w, h, o, S) { X.save(); X.translate(10, 12); tornPath(X, x, y, w, h, o.seed || 7); X.fillStyle = 'rgba(58,42,20,.28)'; X.fill(); X.restore(); tornPath(X, x, y, w, h, o.seed || 7); X.fillStyle = o.fill || S.P.paper; X.fill(); },
    manila(X, x, y, w, h, o, S) { X.save(); X.shadowColor = 'rgba(0,0,0,.35)'; X.shadowBlur = 18; X.shadowOffsetY = 10; X.fillStyle = S.P.paper; X.fillRect(x, y, w, h); X.shadowColor = 'transparent';
      X.fillStyle = '#CDB685'; X.fillRect(x + w - 290, y - 44, 240, 50); X.strokeStyle = 'rgba(60,40,10,.3)'; X.lineWidth = 2; for (let ly = y + 110; ly < y + h - 20; ly += 72) { X.beginPath(); X.moveTo(x + 50, ly); X.lineTo(x + w - 50, ly); X.stroke(); } X.restore(); },
    rule(X, x, y, w, h, o, S) { X.save(); X.strokeStyle = S.P.ink; X.lineWidth = 2; X.beginPath(); X.moveTo(x, y); X.lineTo(x + w, y); X.moveTo(x, y + h); X.lineTo(x + w, y + h); X.stroke(); X.restore(); },
    block(X, x, y, w, h, o, S) { X.fillStyle = o.fill || S.P.acc; X.fillRect(x, y, w, h); },
    sketch(X, x, y, w, h, o, S) { const s = o.seed || Math.floor((o.t || 0) * 8); X.save(); X.strokeStyle = o.color || S.P.ink; X.lineWidth = 5; X.lineJoin = 'round';
      for (let p = 0; p < 2; p++) { roughLine(X, [[x, y], [x + w, y], [x + w, y + h], [x, y + h], [x, y]], s * 3 + p, 6); X.stroke(); } X.restore(); },
    window(X, x, y, w, h, o, S) { X.save(); X.shadowColor = 'rgba(0,0,0,.45)'; X.shadowBlur = 50; X.shadowOffsetY = 20; X.fillStyle = S.P.bg; X.beginPath(); X.roundRect(x, y, w, h, 16); X.fill(); X.shadowColor = 'transparent';
      X.fillStyle = '#161B22'; X.beginPath(); X.roundRect(x, y, w, 56, [16, 16, 0, 0]); X.fill(); ['#FF5F57', '#FEBC2E', '#28C840'].forEach((c, i) => { X.fillStyle = c; X.beginPath(); X.arc(x + 34 + i * 30, y + 28, 9, 0, TAU); X.fill(); });
      X.strokeStyle = '#30363D'; X.lineWidth = 2; X.beginPath(); X.roundRect(x, y, w, h, 16); X.stroke(); X.restore(); },
    misreg(X, x, y, w, h, o, S) { X.save(); X.globalCompositeOperation = 'multiply'; X.fillStyle = S.P.hi; X.fillRect(x + 8, y + 6, w, h); X.fillStyle = S.P.acc; X.fillRect(x, y, w, h); X.restore(); },
    column(X, x, y, w, h, o, S) { X.save(); X.fillStyle = S.P.bg; X.fillRect(x, y, w, h); X.strokeStyle = S.P.ink; X.lineWidth = 3; X.strokeRect(x, y, w, h); X.lineWidth = 1; X.strokeRect(x + 10, y + 10, w - 20, h - 20); X.restore(); },
    outline(X, x, y, w, h, o, S) { X.save(); X.strokeStyle = S.P.ink; X.lineWidth = 2.5; X.strokeRect(x, y, w, h); const c = 26; X.lineWidth = 5;
      [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]].forEach(([a, b, dx, dy]) => { X.beginPath(); X.moveTo(a + dx * c, b); X.lineTo(a, b); X.lineTo(a, b + dy * c); X.stroke(); }); X.restore(); },
    osd(X, x, y, w, h, o, S) { X.save(); X.fillStyle = 'rgba(0,0,40,.55)'; X.fillRect(x, y, w, h); X.restore(); },
    brutal(X, x, y, w, h, o, S) { X.save(); X.fillStyle = S.P.ink; X.fillRect(x + 14, y + 14, w, h); X.fillStyle = o.fill || S.P.paper; X.fillRect(x, y, w, h); X.lineWidth = 9; X.strokeStyle = S.P.ink; X.strokeRect(x, y, w, h); X.restore(); },
    toon(X, x, y, w, h, o, S) { X.save(); X.lineJoin = 'round'; X.fillStyle = S.P.ink; X.beginPath(); X.roundRect(x + 8, y + 9, w, h, o.r ?? 34); X.fill();
      X.fillStyle = o.fill || S.P.paper; X.beginPath(); X.roundRect(x, y, w, h, o.r ?? 34); X.fill(); X.lineWidth = 7; X.strokeStyle = S.P.ink; X.stroke(); X.restore(); },
    white(X, x, y, w, h, o, S) { X.save(); X.shadowColor = 'rgba(0,0,0,.08)'; X.shadowBlur = 30; X.shadowOffsetY = 8; X.fillStyle = S.P.paper; X.beginPath(); X.roundRect(x, y, w, h, o.r ?? 32); X.fill();
      X.shadowColor = 'transparent'; X.lineWidth = 2; X.strokeStyle = S.P.line || '#E7E0D4'; X.stroke(); X.restore(); },
  };
  /* ══ الملصق (النص بتوقيع الستايل) — (X, s, x, y, o, S) ؛ o.k = تقدّم الدخول 0..1 (من S.ease) ؛ o.size · o.rot · o.seed · o.color/o.bg ══ */
  const LABEL = {
    clean(X, s, x, y, o, S) { const k = o.k ?? 1; X.save(); X.globalAlpha *= k; X.filter = k < 0.99 ? `blur(${((1 - k) * 14).toFixed(1)}px)` : 'none';
      txt(X, s, x, y + (1 - k) * 36, { family: S.fonts.display, size: o.size || 200, color: o.color || S.P.ink }); X.restore(); },
    notif(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 52, w = Math.min(940, measure(X, s, size, S.fonts.body, 600) + 200), h = size * 2.6, yy = y - (1 - k) * 220;
      X.save(); X.globalAlpha *= cl(k * 2); CARD.glass(X, x - w / 2, yy - h / 2, w, h, { r: 44 }, S); X.fillStyle = S.P.acc; X.beginPath(); X.roundRect(x + w / 2 - 110, yy - 40, 80, 80, 20); X.fill();
      txt(X, o.app || 'الآن', x + w / 2 - 130, yy - size * 0.45, { family: S.fonts.body, weight: 600, size: size * 0.55, color: S.P.mut, align: 'right' });
      txt(X, s, x + w / 2 - 130, yy + size * 0.65, { family: S.fonts.body, weight: 600, size, color: S.P.ink, align: 'right' }); X.restore(); },
    highlight(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 110, w = measure(X, s, size, S.fonts.display), r = rng(o.seed || 4);
      X.save(); X.globalCompositeOperation = 'multiply'; X.fillStyle = o.bg || S.P.acc; X.beginPath(); const x0 = x + w / 2 + 20, x1 = lerp(x0, x - w / 2 - 20, k);
      X.moveTo(x0, y - size * 0.62 + (r() - 0.5) * 8); X.lineTo(x1, y - size * 0.6 + (r() - 0.5) * 8); X.lineTo(x1, y + size * 0.18 + (r() - 0.5) * 8); X.lineTo(x0, y + size * 0.16); X.closePath(); X.fill(); X.restore();
      txt(X, s, x, y, { family: S.fonts.display, size, color: o.color || S.P.ink }); },
    slap(X, s, x, y, o, S) { const k = o.k ?? 1; if (k <= 0) return; const size = o.size || 130, w = measure(X, s, size, S.fonts.display, 400) + 90, h = size * 1.35, deg = o.rot ?? -4;
      X.save(); X.translate(x, y - (1 - k) * 260); X.rotate(((deg + (1 - k) * -18) * Math.PI) / 180); X.scale(0.85 + 0.15 * k, 0.85 + 0.15 * k);
      CARD.torn(X, -w / 2, -h / 2, w, h, { seed: o.seed || 101, fill: o.bg || S.P.acc }, S);
      txt(X, s, 0, size * 0.06, { family: S.fonts.display, weight: 400, size, color: o.color || S.P.paper, baseline: 'middle' }); if (o.tape) SIGS.tape(X, 0, { x: -w / 2 + 34, y: -h / 2 + 6 }, S); X.restore(); },
    stamp(X, s, x, y, o, S) { const k = o.k ?? 1; if (k <= 0) return; const size = o.size || 96, w = measure(X, s, size, S.fonts.body) + 110, h = size * 1.6, sc = lerp(1.9, 1, E.expoOut(k));
      X.save(); X.translate(x, y); X.rotate(o.rot ?? -0.12); X.scale(sc, sc); X.globalAlpha *= Math.min(1, k * 1.6) * 0.9; X.strokeStyle = o.color || S.P.acc; X.lineWidth = 10; X.strokeRect(-w / 2, -h / 2, w, h);
      X.lineWidth = 3; X.strokeRect(-w / 2 + 16, -h / 2 + 16, w - 32, h - 32); txt(X, s, 0, size * 0.08, { family: S.fonts.body, size, color: o.color || S.P.acc, baseline: 'middle' });
      X.globalCompositeOperation = 'destination-out'; const r = rng(o.seed || 9); for (let n = 0; n < 240; n++) { X.globalAlpha = 0.5; X.fillRect(-w / 2 + r() * w, -h / 2 + r() * h, 2 + r() * 5, 2 + r() * 4); } X.restore(); },
    masthead(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 260; X.save(); const w = measure(X, s, size, S.fonts.display) + 40; X.beginPath(); X.rect(x - w / 2, y - size, w, size * 1.3 * k + 1); X.clip();
      txt(X, s, x, y, { family: S.fonts.display, size, color: o.color || S.P.ink }); X.restore(); X.save(); X.strokeStyle = S.P.ink; X.lineWidth = 2; const lw = 900 * k;
      X.beginPath(); X.moveTo(540 + lw / 2, y + size * 0.3); X.lineTo(540 - lw / 2, y + size * 0.3); X.stroke(); X.restore(); },
    bar(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 120, w = measure(X, s, size, S.fonts.display, 800) + 80; X.fillStyle = o.bg || S.P.acc; X.fillRect(x + w / 2 - w * k, y - size * 0.95, w * k, size * 1.25);
      if (k > 0.6) txt(X, s, x + w / 2 - 40, y, { family: S.fonts.display, weight: 800, size, color: o.color || '#FFFFFF', align: 'right' }); },
    circled(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 120, w = measure(X, s, size, S.fonts.display) + 70, h = size * 1.5, seed = Math.floor((o.t || 0) * 8);
      txt(X, s, x, y, { family: S.fonts.display, size, color: o.color || S.P.ink }); X.save(); X.strokeStyle = o.ring || S.P.acc; X.lineWidth = 7; X.lineCap = 'round';
      const r = rng(seed + 3), n = 40, end = Math.floor(n * 1.08 * k); X.beginPath(); for (let i = 0; i <= end; i++) { const a = -Math.PI / 2 + (i / n) * TAU, jx = (r() - 0.5) * 6;
        const px = x + Math.cos(a) * (w / 2 + jx), py = y - size * 0.32 + Math.sin(a) * (h / 2 + jx); i ? X.lineTo(px, py) : X.moveTo(px, py); } X.stroke(); X.restore(); },
    prompt(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 56, words = s.split(' '), n = Math.ceil(words.length * cl(k)), shown = words.slice(0, n).join(' ');
      txt(X, '❯', x + 330, y, { family: S.fonts.mono, weight: 700, size, color: S.P.acc, align: 'right' });
      const w = txt(X, shown, x + 270, y, { family: S.fonts.body, weight: 600, size, color: o.color || S.P.ink, align: 'right' });
      if (Math.floor((o.t || 0) * 2.5) % 2 === 0) { X.fillStyle = S.P.ink; X.fillRect(x + 270 - w - 26, y - size * 0.8, size * 0.45, size * 0.95); } },
    misreg(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 170, d = (1 - k) * 60 + 7; X.save(); X.globalCompositeOperation = 'multiply';
      txt(X, s, x + d, y + d * 0.6, { family: S.fonts.display, weight: 400, size, color: S.P.hi }); txt(X, s, x - d * 0.3, y, { family: S.fonts.display, weight: 400, size, color: S.P.acc }); X.restore(); },
    headline(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 150; X.save(); X.globalAlpha *= k; txt(X, s, x, y, { family: S.fonts.display, size, color: o.color || S.P.ink });
      X.fillStyle = S.P.ink; X.fillRect(80, y + size * 0.32, 920 * k, 6); X.fillRect(80, y + size * 0.32 + 14, 920 * k, 2);
      if (o.kicker) { X.fillStyle = S.P.acc; X.fillRect(x + 300 - 220, y - size * 1.3, 220, 56); txt(X, o.kicker, x + 300 - 110, y - size * 1.3 + 42, { family: S.fonts.body, size: 36, color: '#FFFFFF' }); } X.restore(); },
    callout(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 64, tx = o.to?.x ?? 540, ty = o.to?.y ?? 900; X.save(); X.strokeStyle = S.P.ink; X.lineWidth = 3;
      const mx = lerp(tx, x, cl(k * 1.6)), my = lerp(ty, y, cl(k * 1.6)); X.beginPath(); X.arc(tx, ty, 16, 0, TAU); X.stroke(); X.beginPath(); X.moveTo(tx, ty); X.lineTo(mx, my); X.stroke();
      if (k > 0.6) { const w = txt(X, s, x, y - 18, { family: S.fonts.display, weight: 500, size, color: S.P.ink, align: x > 540 ? 'right' : 'left' }); X.beginPath(); X.moveTo(x, y); X.lineTo(x + (x > 540 ? -w : w), y); X.stroke(); } X.restore(); },
    osd(X, s, x, y, o, S) { const k = o.k ?? 1; if (k < 0.15) return; const g = rng(Math.floor((o.t || 0) * 30))(), dx = k < 0.5 ? (g - 0.5) * 30 : 0; X.save(); X.shadowColor = S.P.acc; X.shadowBlur = 18;
      txt(X, s, x + dx, y, { family: S.fonts.display, weight: 700, size: o.size || 90, color: S.P.acc }); X.restore(); },
    boxed(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 140, sc = lerp(1.4, 1, E.expoOut(cl(k * 3))), w = measure(X, s, size, S.fonts.display, 400) + 90, h = size * 1.4;
      X.save(); X.translate(x, y); X.scale(sc, sc); CARD.brutal(X, -w / 2, -h / 2, w, h, { fill: o.bg || S.P.paper }, S); txt(X, s, 0, size * 0.08, { family: S.fonts.display, weight: 400, size, color: o.color || S.P.ink, baseline: 'middle' }); X.restore(); },
    extrude(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 200, rot = Math.sin((o.t || 0) * 0.9) * 0.12 * (1 - k * 0.5); X.save(); X.translate(x, y); X.scale(Math.cos(rot), 1); X.globalAlpha *= cl(k * 1.5);
      X.save(); X.filter = 'blur(28px)'; X.globalAlpha *= 0.35; X.fillStyle = '#5A4A33'; X.beginPath(); X.ellipse(0, size * 0.5, size * 2, size * 0.18, 0, 0, TAU); X.fill(); X.restore();
      for (let i = 14; i > 0; i--) txt(X, s, i * 0.75, i * 0.75, { family: S.fonts.display, weight: 900, size, color: `rgb(${70 - i * 2},${66 - i * 2},${60 - i * 2})` });
      const g = X.createLinearGradient(0, -size, 0, size * 0.2); g.addColorStop(0, '#4A4743'); g.addColorStop(1, S.P.ink); txt(X, s, 0, 0, { family: S.fonts.display, weight: 900, size, color: g }); X.restore();
      if (o.tag) SIGS.tag(X, 0, { x: o.tagX ?? x, y: y + size * 0.75, text: o.tag, k: cl((k - 0.4) * 2) }, S); },
    pill(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 72, w = measure(X, s, size, S.fonts.display, 400) + 90, h = size * 1.5, sq = 1 + 0.12 * Math.sin(cl(k) * Math.PI);
      X.save(); X.translate(x, y); X.scale(sq * cl(k * 1.4), (2 - sq) * cl(k * 1.4)); CARD.toon(X, -w / 2, -h / 2, w, h, { r: h / 2, fill: o.bg || S.P.paper }, S);
      txt(X, s, 0, size * 0.1, { family: S.fonts.display, weight: 400, size, color: o.color || S.P.ink, baseline: 'middle' }); X.restore(); },
    chip(X, s, x, y, o, S) { const k = o.k ?? 1, size = o.size || 46, w = measure(X, s, size, S.fonts.body, 700) + 64, h = size * 1.7, sc = 0.8 + 0.2 * E.backOut(cl(k));
      X.save(); X.translate(x, y); X.scale(sc, sc); X.globalAlpha *= cl(k * 2); X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, h / 2); X.fillStyle = o.bg || (o.solid ? S.P.acc : S.P.paper); X.fill();
      if (!o.solid) { X.lineWidth = 2; X.strokeStyle = S.P.line || '#E7E0D4'; X.stroke(); } txt(X, s, 0, size * 0.08, { family: S.fonts.body, size, color: o.color || (o.solid ? '#FFFFFF' : S.P.ink), baseline: 'middle' }); X.restore(); },
  };
  /* ══ التواقيع — عناصر خاصة (X, t, o, S) ══ */
  const SIGS = {
    tape(X, t, o, S) { X.save(); X.translate(o.x, o.y); X.rotate(o.rot ?? -0.6); X.fillStyle = 'rgba(255,250,230,.75)'; X.fillRect(-55, -18, 110, 36); X.restore(); },
    pin(X, t, o, S) { X.save(); X.fillStyle = 'rgba(0,0,0,.25)'; X.beginPath(); X.arc(o.x + 4, o.y + 6, 13, 0, TAU); X.fill(); X.fillStyle = o.color || '#C8382B'; X.beginPath(); X.arc(o.x, o.y, 13, 0, TAU); X.fill(); X.fillStyle = 'rgba(255,255,255,.6)'; X.beginPath(); X.arc(o.x - 4, o.y - 4, 4, 0, TAU); X.fill(); X.restore(); },
    // خيط أحمر بين دبوسين — o: {a:{x,y}, b:{x,y}, k}
    string(X, t, o, S) { const k = o.k ?? 1, a = o.a, b = o.b, mx = (a.x + b.x) / 2, my = Math.max(a.y, b.y) + 80; X.save(); X.strokeStyle = o.color || '#C8382B'; X.lineWidth = 4;
      const L = Math.hypot(b.x - a.x, b.y - a.y) * 1.25; X.setLineDash([L, L]); X.lineDashOffset = L * (1 - k); X.beginPath(); X.moveTo(a.x, a.y); X.quadraticCurveTo(mx, my, b.x, b.y); X.stroke(); X.restore(); SIGS.pin(X, t, a, S); if (k > 0.95) SIGS.pin(X, t, b, S); },
    // آلة كاتبة كلمة كلمة — o: {words:[[w,s],…], x, y, size} (x = الطرف اليمين)
    typewriter(X, t, o, S) { const line = o.words.filter(([, s]) => t >= s).map(([w]) => w).join(' '), size = o.size || 76;
      const w = txt(X, line, o.x, o.y, { family: S.fonts.body, weight: 400, size, color: o.color || S.P.ink, align: 'right' });
      if (Math.floor(t * 3) % 2 === 0 && (o.until == null || t < o.until)) { X.fillStyle = o.color || S.P.ink; X.fillRect(o.x - w - 26, o.y - size * 0.8, 8, size); } },
    // شطب أسود يرتفع ويكشف — o: {x, y, w, h, s, dur}
    redact(X, t, o, S) { const k = cl((t - o.s) / (o.dur || 0.5)); if (k >= 1) return; X.save(); X.fillStyle = '#0B0B0B'; tornPath(X, o.x, o.y - (o.h * E.expoOut(k)), o.w, o.h, 41, 4); X.globalAlpha = 1 - k * 0.3; X.fill(); X.restore(); },
    // سهم يد يتسحب — o: {from:{x,y}, to:{x,y}, k}
    arrow(X, t, o, S) { const k = o.k ?? 1, a = o.from, b = o.to, c = { x: (a.x + b.x) / 2 + 80, y: (a.y + b.y) / 2 - 60 }; X.save(); X.strokeStyle = o.color || S.P.acc; X.lineWidth = 7; X.lineCap = 'round';
      const L = 900; X.setLineDash([L, L]); X.lineDashOffset = L * (1 - k); X.beginPath(); X.moveTo(a.x, a.y); X.quadraticCurveTo(c.x, c.y, b.x, b.y); X.stroke(); X.setLineDash([]);
      if (k > 0.9) { const ang = Math.atan2(b.y - c.y, b.x - c.x); X.beginPath(); X.moveTo(b.x, b.y); X.lineTo(b.x - 34 * Math.cos(ang - 0.5), b.y - 34 * Math.sin(ang - 0.5)); X.moveTo(b.x, b.y); X.lineTo(b.x - 34 * Math.cos(ang + 0.5), b.y - 34 * Math.sin(ang + 0.5)); X.stroke(); } X.restore(); },
    // سطر كود LTR — o: {code, x, y, size, k}
    code(X, t, o, S) { const k = o.k ?? 1, n = Math.floor(o.code.length * cl(k)); txt(X, o.code.slice(0, n), o.x, o.y, { family: S.fonts.mono, weight: 500, size: o.size || 40, color: o.color || S.P.hi, align: 'left', dir: 'ltr' }); },
    // تاق أسود صغير ✓ — o: {x, y, text, k}
    tag(X, t, o, S) { const k = o.k ?? 1; if (k <= 0) return; const size = o.size || 44, w = measure(X, o.text, size, S.fonts.body) + 110, h = size * 1.6, sc = 0.7 + 0.3 * E.backOut(k);
      X.save(); X.translate(o.x, o.y); X.scale(sc, sc); X.fillStyle = '#111'; X.beginPath(); X.roundRect(-w / 2, -h / 2, w, h, 14); X.fill();
      txt(X, '✓', w / 2 - 40, size * 0.35, { family: S.fonts.body, size, color: '#fff' }); txt(X, o.text, -16, size * 0.35, { family: S.fonts.body, size, color: '#fff' }); X.restore(); },
    // breadcrumb مونو + مجلد — o: {x (يسار), y, text, k}
    breadcrumb(X, t, o, S) { const k = o.k ?? 1, n = Math.floor(o.text.length * cl(k)); X.fillStyle = S.P.acc; X.fillRect(o.x, o.y - 30, 44, 32); X.fillRect(o.x, o.y - 38, 20, 10);
      txt(X, o.text.slice(0, n), o.x + 64, o.y, { family: S.fonts.mono, weight: 500, size: o.size || 38, color: S.P.mut, align: 'left', dir: 'ltr' }); },
    // ماسكوت مربّع برجول (رسمنا — مو شخصية أحد) — o: {x, y, s, color, t}
    mascot(X, t, o, S) { const s = o.s || 1, tq = S.tq(t), hop = Math.abs(Math.sin(tq * 6)) * 18 * s; X.save(); X.translate(o.x, o.y - hop); X.scale(s, s); X.lineWidth = 7; X.strokeStyle = S.P.ink; X.lineJoin = 'round';
      for (let i = 0; i < 4; i++) { const sw = Math.sin(tq * 10 + i) * 10; X.fillStyle = o.color || S.P.acc; X.beginPath(); X.rect(-78 + i * 44, 80, 26, 70 + sw * 0.3); X.fill(); X.stroke(); }
      X.fillStyle = o.color || S.P.acc; X.beginPath(); X.roundRect(-110, -110, 220, 200, 22); X.fill(); X.stroke(); X.fillStyle = S.P.ink;
      X.lineWidth = 6; X.beginPath(); X.arc(-40, -20, 18, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); X.beginPath(); X.arc(40, -20, 18, Math.PI * 1.1, Math.PI * 1.9); X.stroke(); X.fillRect(-10, 20, 20, 24); X.restore(); },
    // فقاعة كلام كرتونية — o: {x, y, w, h, tail:{x,y}, k}
    bubble(X, t, o, S) { const k = o.k ?? 1, sc = E.backOut(cl(k)); if (sc <= 0.01) return; X.save(); X.translate(o.tail.x, o.tail.y); X.scale(sc, sc); X.translate(-o.tail.x, -o.tail.y);
      CARD.toon(X, o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, { r: o.h / 2 }, S); [[0.25, 26], [0.5, 18], [0.72, 11]].forEach(([f, r]) => { const cx = lerp(o.x, o.tail.x, f), cy = lerp(o.y + o.h / 2, o.tail.y, f);
        X.fillStyle = S.P.paper; X.lineWidth = 6; X.strokeStyle = S.P.ink; X.beginPath(); X.arc(cx, cy, r, 0, TAU); X.fill(); X.stroke(); }); X.restore(); },
    // سهم أبعاد بلوبرنت — o: {x1,x2,y,label,k}
    dimension(X, t, o, S) { const k = o.k ?? 1, x2 = lerp(o.x1, o.x2, k); X.save(); X.strokeStyle = S.P.ink; X.lineWidth = 2.5; X.beginPath(); X.moveTo(o.x1, o.y - 20); X.lineTo(o.x1, o.y + 20); X.moveTo(o.x1, o.y); X.lineTo(x2, o.y);
      if (k > 0.98) { X.moveTo(o.x2, o.y - 20); X.lineTo(o.x2, o.y + 20); } X.stroke(); if (k > 0.98 && o.label) txt(X, o.label, (o.x1 + o.x2) / 2, o.y - 22, { family: S.fonts.num, weight: 500, size: 40, color: S.P.hi, dir: 'ltr' }); X.restore(); },
    // اهتزاز للضربة — يرجّع {dx,dy} تحطه بـtranslate — o: {s, amp}
    shake(X, t, o, S) { const k = cl((t - o.s) / 0.3); if (k >= 1 || k <= 0) return { dx: 0, dy: 0 }; const a = (o.amp || 18) * (1 - k), r = rng(Math.floor(t * 60)); return { dx: (r() - 0.5) * 2 * a, dy: (r() - 0.5) * 2 * a }; },
    // لفّة جريدة (الكلاسيكية) — ترجّع scale/rotate تطبقها قبل رسم الصفحة — o: {s, dur}
    spin(X, t, o, S) { const k = cl((t - o.s) / (o.dur || 0.9)), e = E.expoOut(k); return { rot: (1 - e) * TAU * 2, scale: lerp(0.05, 1, e) }; },
  };

  /* ══ المصنع ══ */
  function resolve(spec) {
    if (spec && typeof spec === 'object') return spec;
    const [a, b] = String(spec || 'keynote').split('+').map(s => s.trim()), A = TOK[a];
    if (!A) throw new Error('ستايل مو معروف: ' + a + ' — الموجود: ' + Object.keys(TOK).join(' '));
    if (!b) return Object.assign({ id: a }, A);
    const B = TOK[b]; if (!B) throw new Error('ستايل مو معروف: ' + b);
    // قاعدة الخلط: السطح والملمس والكرت والشخص من الأول، والخط والحركة والملصق من الثاني (لا ملمسين ولا خطين display)
    return Object.assign({}, A, { id: a + '+' + b, name: A.name + ' × ' + B.name, fonts: B.fonts, personality: B.personality, label: B.label, fps: B.fps || A.fps,
      palette: Object.assign({}, A.palette, { acc: B.palette.acc }), families: [...new Set([...A.families, ...B.families])] });
  }
  /* make(spec, env) — env: {W, H, brand:{acc,...}, keepBrand:true} → S */
  function make(spec, env = {}) {
    const T = resolve(spec), W = env.W || 1080, H = env.H || 1920;
    const P = Object.assign({}, T.palette); if (env.brand && env.keepBrand !== false && env.brand.acc && !T.lockAcc) P.acc = env.brand.acc;
    const easeFn = E[PERSONALITY[T.personality] || 'expoOut'];
    const S = { id: T.id, name: T.name, tok: T, P, fonts: Object.assign({ display: 'IBM Plex Sans Arabic', body: 'IBM Plex Sans Arabic', num: 'Inter', mono: MONO }, T.fonts), W, H,
      E, ease: k => easeFn(cl(k)), tq: t => (T.fps ? Math.floor(t * T.fps) / T.fps : t), rng, frameOf: t => Math.round(t * (env.fps || 30)),
      /* background(X, t, {video, person, behind, kb}) — يبدّل الخلفية بالسطح لو فيه person (قصّ) والستايل needsCut، وإلا يعالج الفيديو */
      background(X, t, o = {}) {
        S.kb = o.kb; S._bgPost = null;
        if (T.needsCut && o.person && SURF[T.surface]) SURF[T.surface](X, t, S, o);
        else {
          VID[T.vfx || 'plain'](X, t, S, o.video || (() => {}));
          if (T.vfx === 'film') { const pv = T.post || {}; grain(X, W, H, S.frameOf(t), pv.grain); vignette(X, W, H, pv.vignette, '20,12,4'); S._bgPost = t; }  // الحبيبات على الخلفية بس، مو على الوجه
        }
        if (o.behind) o.behind(X);                       // نص «ورا الراس» بين الخلفية والشخص
        if (o.person) (PER[T.person] || PER.plain)(X, t, S, o.person);
      },
      person: (X, t, p) => (PER[T.person] || PER.plain)(X, t, S, p),
      card: (X, x, y, w, h, o = {}) => (CARD[o.kind || T.card] || CARD.soft)(X, x, y, w, h, o, S),
      label: (X, s, x, y, o = {}) => (LABEL[o.kind || T.label] || LABEL.clean)(X, s, x, y, o, S),
      post(X, t, o = {}) { if (S._bgPost === t) return;   // الوثائقي حط ملمسه على الخلفية قبل الشخص
        const pv = T.post || {}; grain(X, W, H, S.frameOf(t), pv.grain); if (!o.noVignette) vignette(X, W, H, pv.vignette); },
      sig: {}, text: (X, s, x, y, o = {}) => txt(X, s, x, y, Object.assign({ family: S.fonts[o.role || 'display'] || S.fonts.display, color: S.P.ink }, o)), measure: (X, s, size, role = 'display', w) => measure(X, s, size, S.fonts[role], w),
      tornPath, roughLine,
    };
    Object.keys(SIGS).forEach(k => { S.sig[k] = (X, t, o = {}) => SIGS[k](X, t, o, S); });
    return S;
  }
  /* الخطوط اللي يحتاجها ستايل (لـcompose: MV.needFont) */
  function fontsOf(spec) { const T = resolve(spec), out = []; Object.values(T.fonts || {}).forEach(f => { (FONT_FILES[f] || []).forEach(([file, weight]) => out.push({ family: f, file, weight })); });
    return out.filter((x, i, a) => a.findIndex(y => y.file === x.file) === i); }
  const list = () => Object.entries(TOK).map(([id, t]) => ({ id, name: t.name, desc: t.desc, families: t.families, cues: t.cues, blend: t.blend, moment: !!t.moment, needsCut: !!t.needsCut }));
  G.STYLES = { make, resolve, list, fontsOf, tokens: TOK, FONT_FILES, version: 1 };
  if (typeof module !== 'undefined') module.exports = G.STYLES;
})();
/* node motion/styles.js --catalog → يكتب motion/styles/catalog.json (يقراه scripts/35_moves.py لاختيار ستايل الفيديو). شغّله بعد أي تعديل بـTOK. */
if (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module && process.argv.includes('--catalog')) {
  const fs = require('fs'), path = require('path'), S = module.exports, out = path.join(__dirname, 'styles', 'catalog.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify({ version: 1, note: 'مولّد من motion/styles.js — لا تعدّله بيدك', styles: S.list() }, null, 1));
  console.log('✓ ' + out + ' (' + S.list().length + ' ستايل)');
}
