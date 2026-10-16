# بنك الحركات — كل فيديو له لوحة حركات، وأنت تختار بوعي

بنك حركات مرقّم يكبر مع الوقت (`motion/moves/catalog.json` — 61 حركة من 16 أكتوبر). كل حركة: دالة جاهزة بـ`motion/moves.js` + معاينة 4 ث + مصدرها.
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

## 4) إضافة حركة جديدة (البنك يكبر — الهدف 100)

0. عطها `role` و`energy` و`families` و`cues` بالكتالوج. **العائلات الضعيفة أولاً**: `plan --dry` لكل عائلة وشوف وين الخيارات قليلة.
1. دالة جديدة بـ`moves.js` بنفس الشكل `FX.<id>(ctx, t, o)`، والألوان من `ctx.P`.
2. سطر بالكتالوج **برقم جديد بالآخر**. ⛔ لا تعيد ترقيم القديم: الناس حافظين أرقام.
3. معاينة 4 ث بنص الدقة: `previews/NN.mp4`، مرسومة من الدالة نفسها، مو من كود ثاني.
4. المصدر بـ`CREDITS.md`، رابط فتحته بنفسك.
