# بنك الحركات — كل فيديو له لوحة حركات، وأنت تختار بوعي

بنك حركات مرقّم يكبر مع الوقت (`motion/moves/catalog.json` — 100 حركة من 17 أكتوبر). كل حركة: دالة جاهزة بـ`motion/moves.js` + معاينة 4 ث + مصدرها.
**قرار المستخدم (13 أكتوبر):** «ابيك تكون غني بالحركات… وتكون واعي». هو ما يختار حركة حركة. أنت تختار لكل فيديو.

| الملف | شنو فيه |
|---|---|
| `motion/moves/catalog.json` | الرقم · `id` · الاسم · `role` · `energy` 1–3 · `families` · `cues` · المصدر · المعاينة |
| `motion/moves.js` | الدوال: `ctx.FX.<id>(ctx, t, o)` — كل خياراتها مكتوبة فوق كل دالة |
| `motion/moves/index.html` | المعرض (يفتحه `scripts/35_moves.py`) — للفرجة، أو لو حب يمنع شي |
| `motion/moves/CREDITS.md` | المصادر والرخص |

## 1) لوحة الفيديو (إلزامي قبل أول مشهد)

```bash
python3 scripts/35_moves.py plan --title "<عنوان الفيديو>" --family auto --cues number,cta
```
يطلع **لوحة** الفيديو:
- **العائلة** (`family`): لون الحركة للفيديو كله. `calm` هادي · `punch` طاقة · `onetake` كاميرا مستمرة بلا قص · `editorial` تحريري/شرح.
  `auto` = اللي ما انستخدمت من زمان. اختر بنفسك لو الفيديو واضح: نصيحة هادية = `calm`، هوك وأرقام = `punch`، فكرة وحدة تتطور = `onetake`، شرح وخطوات = `editorial`.
- **3 أساسيات** (`core`): حركة كلمات + انتقال + كاميرا أو كرت. **الفيديو كله يدور حولها**، مثل الونشوت: نفس اللغة البصرية من أوله لآخره.
- **لهجات** (`accents`، أكثر شي 2): حركة خاصة للحظة خاصة بس. `--cues` = اللحظات اللي بالسكربت:
  `number` رقم قوي · `list` نقاط · `price`/`cta` سعر أو طلب · `contrast` مقارنة · `emphasis` كلمة مفتاح · `reveal` كشف · `tech` تقنية · `hit` ضربة.
- **قواعد** (`rules`): تمشي على التوقيت دايماً (مثلاً J-cut).
- ينحفظ بسجل `moves-history.json`، فالأساسيات تتغير من فيديو لفيديو. قل للمستخدم بسطر: «لوحة هالفيديو: طاقة — طلعة متتابعة + سحبة + إشعارات».

## 2) الإيقاع داخل الفيديو

1. **كل 2–4 ث يصير شي** (حسب `pace` بالبروفايل). مو كل جملة لازم حركة: الجمل العادية تمشي على الكابشن بس.
2. **حركة الكلمات الأساسية** على الجمل المهمة. **الانتقال الأساسي** عند تغيّر المشهد أو الفكرة بس. **الكاميرا الأساسية** مرة وحدة بالمشهد أكثر شي.
3. **اللهجة** بلحظتها بس (الرقم، السعر، الضربة)، ولا تتكرر.
4. ⛔ لا نفس الحركة مرتين ورا بعض. ولا تجيب حركة من برّا اللوحة إلا لو الجملة ما يخدمها شي من اللوحة، وقلها بسطر.
5. **الحركة من معنى الجملة**: اللوحة تحدد اللغة، والجملة تحدد وين ومتى. مثلاً «من 0 لـ1000» = العدّاد، مو أي حركة.
6. `off` بالبروفايل (لو منع شي من المعرض) ممنوع نهائياً. `on` يقدّمها بالاختيار. والاثنين اختياريين: الافتراضي إنه ما يختار.

## 1ب) المعرض (اختياري)
`python3 scripts/35_moves.py` يفتح المعرض للفرجة أو المنع. ومن الشات: `set "3 7" --off "5"` · `show` · `list`.

## 3) الاستخدام بالكود

**بمحرّك الموشن** (`motion/` — فيلم الموشن، الونشوت، أي مشهد ينرسم بـ`render.js`): نادِ الدالة مباشرة.
```js
draw(t, lt, ctx) {
  const { X, P, FX } = ctx;
  X.fillStyle = P.bg; X.fillRect(0, 0, ctx.W, ctx.H);
  FX.riseUp(ctx, t, { text: 'الفكرة أهم من الأداة', s: ctx.wordTime('l2', 0).s, accent: [1] });    // 3 طلعة متتابعة
  FX.whip(ctx, t, { s: 4.2, A: Y => drawIntro(Y), B: Y => drawStats(Y) });                         // 11 سحبة
  const tau = FX.ramp(t, { hit: ctx.wordTime('l3', 2).s });                                          // 20 تبطيء الضربة: استخدم tau مكان t
}
```
- الألوان من `ctx.P` (ثيم المستخدم) تلقائياً. لا تمرر ألوان ثابتة.
- `o.s` لازم يكون توقيت كلمة حقيقية (`ctx.wordTime`). `FX.caption` ياخذ `line: 'l2'` ويتزامن مع الصوت كلمة كلمة.
- الانتقالات (`crossZoom softWipe iris whip zoomWipe dotZoom dipFade slideOver clockWipe slices glitch flip lightLeak` و`compare`) تاخذ `A` و`B` كدوال ترسم الإطار كامل. حطها داخل مشهد واحد مكان انتقال المحرّك.
  `glitch` و`flip` يرسمون A/B على الإطار نفسه وياخذون لقطة منه، فأي FX داخل A/B (مثلاً `MV.panel(Y, () => FX.ringStat(MV, t, …))`) يطلع صح.
- الكاميرا (`pushIn pullOut handheld kenBurns snapZoom shake`) تلف `draw`؛ `rackFocus` و`dollyZoom` ياخذون `back` و`front`؛ `parallax` ياخذ `layers:[{draw, depth}]`. بريل الكلام حطها بطبقة `'video'`.
- `lowerThird` تحت يمين داخل المنطقة الآمنة (y ≤ 1500 و x ≤ 920) — لا تحرّكه لزاوية الأزرار.
- `jcut` و`matchCut` قواعد توقيت، مو رسم: J-cut = صوت اللقطة الجاية يسبق صورتها بـ4–12 فريم. القطع المطابق = الشكل نفسه بنفس المكان والحجم على فريم القص.

**بريل الكلام** (`compose.html`): نفس الدوال، بس الـctx اسمه `MV` (من `scripts/moves-compose.js`: أدوات النص والتوقيت وألوان `theme.json` وخطه فوق كانفس المحرّك).
`compose.REFERENCE.html` يحمّل `moves.js` و`moves-compose.js` من مجلد الشغل، و`04_render_frames.js`/`08_safe_check.js` ينسخونهم وحدهم لو ناقصين.
مشاهدك بآخر `compose.html` (بعد سطر التحميل):
```js
MV.ready(() => {                                   // caps.json يوصل بـinit — أي wordTime/lineSpan برّا الرسم داخل ready
  MV.hideCaption(MV.lineSpan(0).s, MV.lineSpan(2).e);                       // FX.caption بدال كابشن المحرّك
  MV.scene('cap', t => { const n = [0,1,2].find(i => t >= MV.lineSpan(i).s && t < MV.lineSpan(i).e);
    if (n !== undefined) FX.caption(MV, t, { line: n, y: 1280 }); });        // 1 متزامن كلمة كلمة
  const s = MV.wordTime(3, 0).s;
  MV.scene('push', t => { if (t >= s && t < MV.lineSpan(4).e)
    FX.pushIn(MV, t, { s, to: 1.18, focus: [540, 560], blur: false, draw: Y => MV.video(Y) }); }, 'video');   // 12 طبقة الفيديو
  const w = MV.wordTime(5, 0).s - 0.3;
  MV.scene('whip', t => { if (t >= w && t < MV.lineSpan(5).e)
    FX.whip(MV, t, { s: w, A: Y => MV.video(Y), B: Y => MV.panel(Y, () => FX.riseUp(MV, t, { text: 'الفكرة', s: w + 0.35 })) }); });   // 11
});
```
- السطر = رقم الجملة بـ`caps.json` (`MV.wordTime(3, 0)` = أول كلمة بالجملة 3). `line: 0` يشتغل.
- `MV.video(Y, R?)` يرسم فريم الفيديو الحالي (ملء الشاشة افتراضياً) — هو مشهد A/B للانتقالات و`draw` لحركات الكاميرا.
- `MV.panel(Y, fn)` = خلفية الثيم + رسمك: شاشة كاملة بين لقطتين. كابشن المحرّك يبقى فوقها.
- `MV.scene(name, fn, 'video')` لحركة تشتغل على الفيديو نفسه (pushIn/pullOut) فالكابشن يبقى فوقها؛ بدون طبقة = فوق الفيديو وتحت الكابشن.
- ⚠ `FX.caption` بثيم غامق: الحدّ حول الكلمات يصير الأغمق من `ink`/`bg` تلقائياً، والكلمة الحالية بلون `onAcc` فوق الكبسولة.

## 3ب) حركات المتحدث المقصوص (51–61)

`orbit couchWall uiWorld frameBreak headlineWall doodleBoil coverStory glassType phoneMockup greenScreen paperCut`
- تاخذ `person` (المتحدث مقصوص، إطار كامل) و`video` (الفيديو كامل). `glassType` ياخذ `draw` بدال الاثنين، و`phoneMockup` ياخذ `video` بس.
- **القصّ ماك بس** (`mask: required` و`mac: true` بالكتالوج). جهّزه للمدى قبل الرسم: `node scripts/11_behind_text.js <work> person 12.4-15.8`
  (قصّ بس بلا تأثير ثاني). بالمشهد مرّر `person: MV.person` **كما هو** — FX يسأل `MV.person.ok()`.
- بلا قصّ (مو ماك، أو الفريم برّا المدى) كل حركة ترجع لبديلها لحالها: الفيديو بكرت (المدار يلف حول الكرت، الغلاف فوق الفيديو، القرين سكرين وجهك بفقاعة). `uiWorld` و`doodleBoil` (`mask: optional`) أحلى بالقصّ وتشتغل بلاه.
- `o.out` = وقت الطلعة (ترجع للفيديو بنفس الحركة بالعكس).
```js
MV.ready(() => { const s = MV.wordTime(4, 0).s;
  MV.scene('cover', t => { if (t >= s && t < s + 3) FX.coverStory(MV, t, { s, out: s + 2.5, person: MV.person, video: Y => MV.video(Y), title: 'مكينة' }); }); });
```

## 3ج) الدفعة 62–73 (حروف عربية · ستيكر · ربط · فصول)

`ijamDrop qalamWrite videoText joinSnap kufiGrid redact` (كلام) · `pageTurnRTL` (انتقال) · `tilt3D` (كاميرا) · `stickerFreeze beamConnect lightRays dynamicIsland` (كروت وطبقات).
- **حركات الحروف** (62 نقاط تنزل، 63 القلم، 66 تتلاصق، 67 كوفي): تحلّل السطر المرسوم كامل لأجزاء متصلة (حرف موصول/نقطة/علامة)، فالوصلات ما تنكسر، وكلها تخلص على الكلمة المتصلة الصحيحة. 66 الوحيدة اللي تعرض الحروف منفصلة (بشكلها المنفرد) — هذا معنى الحركة نفسها. ⛔ 62 و66 ممنوعة على نص القرآن.
- 63 تستخدم Aref Ruqaa لو محمّل (محرّك الموشن)، وإلا خط الثيم. 67 تستخدم `kufi` (Noto Kufi بالمحرّك، وخط الثيم بريل الكلام).
- `videoText` ترسم الإطار كامل لين `out`؛ بعده ارجع لـ`MV.video` بنفسك (القطع مطابق). `tilt3D` و`lightRays` و`stickerFreeze` يرسمون الفيديو بنفسهم (مرّر `video`).
- `tilt3D` = نفس الحركة لكل فصل بالفيديو (قاعدة) — غيّر `title` و`num` بس.
- **`stickerFreeze` يحتاج فريم بوقت ثاني** — إضافة المحرّك (17 أكتوبر) بـ`moves-compose.js`:
  `MV.frameAt(Y, t, R?)` فريم الفيديو عند t (`vfr/`)، و`MV.personAt(Y, t, R?)` القصّ عند t (`bt/person/`). أول طلب يحمّل الصورة، و`04_render_frames.js` ينتظر `MV.settle()` ويعيد رسم الفريم قبل اللقطة، فالنتيجة حتمية.
  القصّ لازم يغطي لحظة التجميد: `node scripts/11_behind_text.js <work> person <من-إلى>` والمدى فيه `s`. بلا قصّ ترجع بولارويد للفريم كامل (`videoAt: MV.frameAt`).
```js
MV.ready(() => { const s = MV.wordTime(6, 0).s;
  MV.scene('freeze', t => { if (t >= s && t < s + 2.4) FX.stickerFreeze(MV, t, { s, out: s + 2, person: MV.person, personAt: MV.personAt, video: Y => MV.video(Y), videoAt: MV.frameAt, text: 'وقف!' }); }); });
```

## 3د) الدفعة 75–87 (نسخ · خريطة · رافعة · طرفية · زجاج · وجه)

`morphWord` (كلام) · `nuqtaCurtain glassLens scanLine` (انتقالات، تاخذ `A` و`B`) · `craneUp punchCut` (كاميرا) · `cloneTrio dotMap rimOutline terminalType lineChartDraw girihBloom speechBubble` (كروت وطبقات).
- **القصّ (ماك):** `cloneTrio` و`rimOutline` (`mask: required`) — بلاه: 3 كروت فيديو / شعاع على إطار كرت. `girihBloom` (`optional`) ورا الشخص بالقصّ، وفوق الفيديو بلاه.
  `cloneTrio` ياخذ `personAt: MV.personAt` (النسخ متأخرة 0.2/0.4 ث) و`videoAt: MV.frameAt` للبديل — نفس شرط القصّ بـ3ج.
- **الوجه (ماك، `face: optional` بالكتالوج)** — `speechBubble` و`punchCut`: إضافة المحرّك (17 أكتوبر):
  `python3 scripts/36_facetrack.py <work> <من> <إلى>` يطلّع `face.js` (نفس `facetrack.swift` حق البودكاست، منعّم σ=5 فريم). حطه بـcompose.html: `<script src="face.js"></script>`، ومرّر `face: MV.faceAt`.
  `MV.faceAt(t)` = `{x,y,w,h,mx,my}` بإحداثيات الكانفس (بنفس تأطير `MV.video`) أو `null` — والحركة ترجع لمكان افتراضي.
  `punchCut` يثبّت الوجه على أول فريم بكل لقطة (الكاميرا الحقيقية ما تلحق)، والحد ×2.
- `glassLens` العدسة تشيل المشهد الجديد معها (`carry`)، فاللي بنص B يظل كامل داخلها — خل عنوان B كلمة أو كلمتين (أعرض شي ~400px) عشان ما تنقص كلمة على حافتها.
- `scanLine` ياخذ `Aat: MV.frameAt` (القديم مجمّد تحت الخط). `craneUp` ياخذ `A` (الفيديو) و`B` (الكرت الجاي) — بعد `at + 0.5` ارسم `B` بنفسك. الكروت صور ثابتة (`cards`).
- `dotMap` خريطتها مضمّنة (يابسة مبسّطة، من الأطلسي لليابان) — المدن برّا هالمدى ما تبين. `terminalType` الأمر والناتج إنقليزي (خط Menlo/monospace)، والتعليق العربي بسطره.
```js
MV.ready(() => { const s = MV.wordTime(5, 0).s;
  MV.scene('bubble', t => { if (t >= s && t < s + 3) FX.speechBubble(MV, t, { s, out: MV.lineSpan(5).e, line: 5, face: MV.faceAt }); });
  const p = MV.wordTime(7, 0).s;
  MV.scene('cam2', t => { if (t >= p && t < MV.lineSpan(7).e) FX.punchCut(MV, t, { s: p, out: MV.lineSpan(7).e, video: Y => MV.video(Y), face: MV.faceAt }); }, 'video'); });
```

## 3هـ) الدفعة ج: 74 و88–100 (الآية · بوست · فاتورة · بحث · باب · صدى)

`ayahCalm echoStack warpWave` (كلام) · `bentoCut doorway lumaMelt` (انتقالات، تاخذ `A` و`B`) · `bodyFollow swishSettle motionEcho` (كاميرا) · `postCard palmHold receiptPrint searchBar pointerCursor` (كروت وطبقات).

**⛔ 74 آية بسكينة (`ayahCalm`) — قواعد القرآن قبل الحركة:**
- **النص من مصدر موثوق بس**: Tarteel MCP (`search_ayahs_text`) أو quran.com بالرسم العثماني، ومرّره `text` **كما جا حرفاً بحرف**. ⛔ لا تكتب آية من الذاكرة، ولا تعدّل حرف ولا تشكيل. الدالة ما تغيّر النص: تقسمه على الفراغات بس (وعلامة الوقف مثل ۗ تلتصق بكلمتها).
- ⛔ **62 «نقاط تنزل» ممنوعة نهائياً على نص القرآن** (تفكك الرسم والإعجام)، ومثلها 66 والكشيدة والقلتش وأي حركة كلام ثانية. على الآية: `ayahCalm` بس (وورا الآية `girihBloom` 84 مسموحة — هندسة بلا كائنات).
- `manual: true` بالكتالوج: اللوحة (`plan`) ما تختارها أبداً — تستخدمها بس لما الفيديو فيه آية.
- الخط `Amiri Quran` (عثماني، SIL OFL — `motion/fonts/AmiriQuran-Regular.ttf`): بالمحرّك محمّل؛ بريل الكلام `04_render_frames.js`/`08_safe_check.js` ينسخونه لمجلد الشغل لما compose.html فيه `ayahCalm`، و`MV.needFont` يحمّله (الفريم ينتظر الخط).
- رقم الآية داخل ۝: `digits: 'arabic'` (الافتراضي، ٢٨ — ينرسم مباشرة بلا تحويل الأرقام الغربي حق المحرّك) أو `'western'`. `surah` فوق، و`ref` (مثلاً `'13 : 28'`) تحت اختياري.
- الخلفية الثيم أو `video` مغمّق 60% — بلا صور كائنات حية فوق الآية. الكلمات تطلع بهدوء وحدة وحدة (`stagger`، أو `times` من توقيت التلاوة).
```js
MV.ready(() => { const s = MV.lineSpan(4).s;   // النص من search_ayahs_text كما هو
  MV.scene('ayah', t => { if (t >= s && t < s + 6) FX.ayahCalm(MV, t, { s, out: s + 5.3, text: AYAH_TEXT, surah: 'الرعد', ayah: 28, ref: '13 : 28' }); }); });
```
**الباقي:**
- `bodyFollow` (89) يحتاج الوجه (`face: MV.faceAt` من `36_facetrack.py` — ماك)؛ بلاه يرجع لـ`handheld` (31). بطبقة `'video'`.
- `motionEcho` (100) يحتاج فريم بوقت ثاني: `videoAt: MV.frameAt`، وبالقصّ (`mask: optional`) `person: MV.person, personAt: MV.personAt` فالصدى على جسمك بس. بلاهم تتخطى. حطها مع `FX.ramp` (20) على نفس الضربة.
- `palmHold` (91) يحتاج الكف (`hand: optional`): `python3 scripts/29_handtrack.py <work> <من> <إلى>` يطلّع `palm.js` — حطه بـcompose.html ومرّر `palm: MV.palmAt`. بلاه العنصر ثابت تحت يسار.
- `postCard` (88): ⚠ لا تسوي بوست مزيف لشخص حقيقي — يا لقطة حقيقية، يا كلام صاحب الحساب نفسه. بلا شعار أي منصة.
- `receiptPrint` (93) الأسعار بأرقام غربية والعملة من `currency`. `searchBar` (94) و`pointerCursor` (98) سهم ماوس بحبر الثيم؛ `pointerCursor` ياخذ `steps` (عدة نقرات) و`targets` (أزرار يرسمها).
- `swishSettle` (95) بداية مشهد (يلف `draw`)، يكبر لحاله لين ما يبين طرف الفريم. `doorway` (97) و`lumaMelt` (99) يرسمون `A` بكانفس جانبي.
```js
MV.ready(() => { const h = MV.wordTime(3, 2).s;
  MV.scene('echo', t => { if (t >= h - 0.1 && t < h + 0.7) FX.motionEcho(MV, t, { s: h, video: Y => MV.video(Y), videoAt: MV.frameAt, person: MV.person, personAt: MV.personAt }); }, 'video'); });
```

## 3و) لحظات العمق — الأصل من أول مسودة (6.0، من ريل بوبيان)

ريل بوبيان (اعتمده البنك وانتشر) نجح لأن الموشن كان **عميق من أول نسخة**. الأصل: تتعب على الأداء والموشن — مو أشياء هادية.
البطاقات والأختام والشارات مو ممنوعة؛ استخدمها لما الموضوع يستاهل. بس قبل ما ترسم، **خطّط 2–3 لحظات عمق** للريل وقلها بسطر:
«لحظات العمق: موجة صوتك ورا راسك عند (مقابلة بصوت) · خريطة الكويت عند (أول مرة) · مدار يلف حولك عند (العميل/الشغل/الموظفين)».

| الأداة | متى | شلون |
|---|---|---|
| **ورا الشخص** | أي عنصر (موجة، خريطة، مدار) يمر ورا راسه | قصّ المدى: `node scripts/11_behind_text.js <work> person 5.8-7.7` · ارسم بطبقة `'video'` ثم `MV.person(X)` فوقه |
| **موجة صوته** | «صوت»، «يتكلم»، «مقابلة»، ذكاء اصطناعي يرد | `python3 scripts/37_env.py <work>` ← `env.js` · `<script src="env.js">` · الارتفاع = `MV.env(t)` |
| **خريطة نقاط** | مكان، «أول مرة بالكويت»، انتشار | `FX.dotMap` بـ`cities:[]` وألوان فاتحة، تكبر ببطء ورا راسه |
| **مدار 3D** | 3 أشياء (عميل · شغل · موظفين) | حلقة بيضوية: النص اللي ورا ينرسم قبل `MV.person` واللي قدّام بعده |
| **شكل من هوية العميل** | رقم، انتقال | قوس شعاره يرتسم = عدّاد (`k` من 0 لـ1) أو مسحة تبلع الشاشة وداخلها اللقطة الجاية |
| **دخلة ون تيك** | تغيّر لقطة | الكاميرا تغوص بالشعار/التابلت (زوم 1→10 + غباش) وتطلع باللقطة الجاية — `MV.frameAt` للفريم المجمّد |

```js
/* موجة صوته ورا راسه — طبقة الفيديو، والشخص فوقها */
MV.scene('wave', t => { if (t < 5.86 || t > 7.62) return;
  const n = 43, cx = 540, cy = 790; X.save(); X.fillStyle = '#fff';
  for (let i = 0; i < n; i++) { const x = 40 + i * (1000 / (n - 1)), d = Math.abs(x - cx) / 500;
    const h = 18 + 420 * MV.env(t - d * 0.22) * (1 - d * 0.3); X.fillRect(x - 7, cy - h / 2, 14, h); }
  X.restore(); MV.person(X); }, 'video');

/* خريطة نقاط ورا راسه — ألوان فاتحة، بلا مدن */
const MAPC = Object.assign({}, MV, { P: Object.assign({}, MV.P, { mut: '#FFFFFF', bg: '#FFFFFF', ink: '#FFFFFF' }) });
MV.scene('map', t => { if (t < 11.8 || t > 14.4) return;
  FX.dotMap(MAPC, t, { s: 11.8, y: 140, cities: [], total: null, title: null }); MV.person(X); }, 'video');

/* مدار: اللي ورا قبل الشخص، واللي قدّام بعده (orbitDraw دالتك: front=false يرسم النص الخلفي من الحلقة) */
MV.scene('orbit', t => { if (t < 31 || t > 38) return; orbitDraw(t, false); MV.person(X); orbitDraw(t, true); }, 'video');

/* دخلة ون تيك بنقطة (px,py) عند القطع tc */
function dive(t, tc, px, py) { if (t < tc - 0.38 || t > tc + 0.36) return;
  if (t < tc) { const k = Math.pow(2, 10 * ((t - tc + 0.38) / 0.38) - 10), s = 1 + 9 * k;
    X.save(); X.filter = `blur(${(k * 14).toFixed(1)}px)`; X.translate(px, py); X.scale(s, s); X.translate(-px, -py); MV.video(X); X.restore(); }
  else { const k = 1 - Math.pow(2, -10 * ((t - tc) / 0.36)), s = 1.45 - 0.45 * k;
    X.save(); X.filter = `blur(${((1 - k) * 12).toFixed(1)}px)`; X.translate(540, 900); X.scale(s, s); X.translate(-540, -900); MV.video(X); X.restore(); } }
```
- هذي أفكار مو قوالب: كل ريل يخترع لحظاته من كلامه وهوية عميله (بوبيان: قوس الشعار عدّاد 90 ثانية، سباق «من أوائل»، كرت أحمر مدرّج).
- أي جملة كلامها مكتوب بالموشن = `nocap` لهالجملة (`references/scenes.md`).
- النص اللي لازم يبين قدّام الشخص (وضع `cutout`) = طبقة `'afterPerson'` أو `window.AFTER_PERSON`.
- `08_safe_check.js` يحسب الفريم المجمّد (`MV.frameAt`) فيديو مو نص — الانتقالات ما تعطي إنذار كاذب (6.0).

## 4) إضافة حركة جديدة (البنك وصل 100 — أي زيادة برقم جديد بالآخر)

0. عطها `role` و`energy` و`families` و`cues` بالكتالوج. **العائلات الضعيفة أولاً**: `plan --dry` لكل عائلة وشوف وين الخيارات قليلة.
1. دالة جديدة بـ`moves.js` بنفس الشكل `FX.<id>(ctx, t, o)`، والألوان من `ctx.P`.
2. سطر بالكتالوج **برقم جديد بالآخر**. ⛔ لا تعيد ترقيم القديم: الناس حافظين أرقام.
3. معاينة 4 ث بنص الدقة: `previews/NN.mp4`، مرسومة من الدالة نفسها، مو من كود ثاني.
4. المصدر بـ`CREDITS.md`، رابط فتحته بنفسك.
