# أجهزة ثري دي حقيقية بالموشن — آيفون، ماك بوك، آيباد، قلاكسي

لما الفيلم يبي **جهاز حقيقي** (مو رسمة): موديل GLB واقعي يلف بفيزياء، شاشته لقطة من حساب المستخدم أو تطبيقه،
الكاميرا تزوم على ميزة بالشاشة، والجهاز يتفكك خطوط ويرجع يرتسم. كله three.js داخل المحرّك — بلا برنامج ثري دي.

- **الأدوات:** `motion/kit3d.mjs` (المشهد يستورده `import * as K from '/motion/kit3d.mjs'`)
  + `scripts/45_text3d.py` (كلمات مجسّمة) + `scripts/46_motion_sfx.mjs` (الصوت من الحركة).
- **المثال الشغّال:** `motion/examples/devices-3d/` — ريل 40 ث كامل (آيفون ← ماك بوك ← كلمات مجسّمة ← شعار ← آيفون).
  اقراه عشان الطريقة. لو المجلد مو موجود: `node motion/vendor.js` يفكّه. ⛔ لا تنسخ الحركات والأوقات كما هي — ابنِها من معنى سكربتك.
- ⛔ **اقرا `references/moves.md` و`motion-rules.md` قبل أول مشهد** — أول نسخة لازم «واو»، مو جهاز يلف بس.

## 1) الموديلات — المصدر: Sketchfab

**الرخص المسموحة بس:**
| الرخصة | `license=` | ذكر اسم المصمم | ملاحظة |
|---|---|---|---|
| Free Standard | `free-st` | ❌ ما يلزم | مجانية — **الأول** |
| Standard | `st` | ❌ ما يلزم | تندفع مرة وحدة |
| CC0 | `cc0` | ❌ | ملكية عامة |

- ⛔ **CC BY و CC BY-SA:** تشترط اسم المصمم بكل فيديو ينعرض — لا. ⛔ **NonCommercial / NoDerivatives:** ممنوعة.
- Free Standard و Standard (sketchfab.com/licenses قسم 3.2): الاسم يلزم بس لو الفيديو **إخباري**، أو لو ذكرت أسماء مصادر ثانية فيه.
- ⛔ **ملف الموديل ما ينوزّع** (قسم 2.2): لا يدخل البلقن ولا يترفع لمستودع ولا ينعطى لأحد. كل مستخدم ينزّل بحسابه لمجلد مشروعه.
- وسم `noai` على الموديل = ممنوع تدخله لتوليد بالذكاء الاصطناعي (صور/فيديو). الرسم بـthree.js مو توليد.

**البحث** (بلا مفتاح):
```bash
curl -s "https://api.sketchfab.com/v3/search?type=models&q=iphone+17+pro&license=free-st&downloadable=true&sort_by=-likeCount&count=8" \
 | python3 -c "import json,sys;[print(m['uid'],'|',m['name'],'|',m['user']['username'],'|',m.get('faceCount')) for m in json.load(sys.stdin)['results']]"
```
البحث مو دقيق — **تأكد من الرخصة لكل موديل** قبل التنزيل:
```bash
curl -s https://api.sketchfab.com/v3/models/<uid> | python3 -c "import json,sys;d=json.load(sys.stdin);print(d['name'],'|',d['license']['slug'],'|',d['isDownloadable'])"
```

**موديلات مجرّبة (Free Standard، المثال مبني عليها):**
| الجهاز | uid | `screenMat` |
|---|---|---|
| Apple iPhone 17 Pro Max (برتقالي) | `43570bd2d48f48b6aafb8adbb04e346d` | `BsXHDwLKqtDOfrW` · `lens: [0.075,0.27,-0.045]` |
| MacBook Pro 14-inch M5 | `652a992f4f244122ae251f9cbb81da1e` | `HlQwFCAPWzetDQy` |
| Silver Apple iPad 13 Pro M4 | `0190a664959c4653afd4b6b62d5c6bc1` | (ما انجرب — طلّعه بالخطوة تحت) |
| Samsung Galaxy S24 Ultra | `49348722d3ea4511bd5a4d8c9f17c44a` | (ما انجرب) |
| Apple iPhone Duo Fold (أبيض) | `240492141edd4594ae13082a7fcbbb29` | (ما انجرب، فيه حركة فتح) |

**التنزيل:** يبي حساب المستخدم بمتصفحه (sketchfab.com/3d-models/<uid> ← Download ← **glTF Binary (.glb)** أو glTF zip).
افتح له الصفحة واطلب منه يضغط تنزيل؛ لو نزل zip فكّه. حط الملف `<المشروع>/models/phone.glb` (و`mac.glb` …).
بالماك الطرفية ما تقدر تقرا مجلد التنزيلات أحياناً — انقل الملف بأمر للفايندر (`osascript … duplicate`) أو خلّه يسحبه للمجلد.

**خامة الشاشة:** `loadDevice` يدوّر اسم فيه screen/display. لو ما لقى (أسماء عشوائية مثل موديلات apple-user)، اطبع الخامات:
```bash
node -e 'const b=require("fs").readFileSync(process.argv[1]),n=b.readUInt32LE(12),j=JSON.parse(b.slice(20,20+n));j.meshes.forEach(m=>console.log(m.name,"→",m.primitives.map(p=>j.materials[p.material]?.name).join(", ")))' models/phone.glb
```
جرّب المرشّحين بـ`screenMat` ورسم فريم معاينة — الصح هو اللي تطلع اللقطة فوقه بالضبط بلا إطار أسود ناقص.

`project.json`:
```json
"images": { "phoneShot": "assets/phone.jpg", "macShot": "assets/mac.jpg" },
"devices": {
  "phone": { "url": "models/phone.glb", "screenMat": "…", "hideScreen": true, "lens": [x,y,z] },
  "mac":   { "url": "models/mac.glb",   "screenMat": "…", "hideScreen": true }
}
```
بلا ملف؟ `fallbackDevice` يرسم جهاز بديل عشان المسودة تمشي — ⛔ مو للتسليم.

## 2) الشاشة: لقطة حقيقية بدقة عالية
الزوم القوي يفضح أي لقطة صغيرة. صوّر حساب المستخدم (إنستقرام، موقعه، تطبيقه) بالمتصفح الداخلي:
1. مقاس جوال 430×932، وشيل نوافذ «سجّل دخول» والكوكيز (`document.querySelectorAll('[role=dialog]')…remove()`).
2. للدقة ×3: `document.body.style.transformOrigin='0 0'; document.body.style.transform='translate(-X,-Y) scale(3)'` وصوّر قطع، ركّبها فوق نسخة مكبّرة ×3 (قص 6 بكسل من حواف القطع عشان ما تبين خطوط).
3. شيل مؤشر الماوس لو طلع. اسم الملف بـ`project.images`.
⛔ لا تحط بيانات أحد ثاني أو حساب مو للمستخدم.

## 3) لحظات «الواو» (اللي خلّت أول ريل ينقبل)
- **أول فريم ماكرو على العدسات** والكاميرا تسحب لورا وهو يلف لقدام (`lens` بـproject.json).
- **3 زوايا كاميرا بنوابض** على كلمات متكررة («ولا… ولا… ولا»): من تحت، من فوق، قريب ومايل مع `roll`.
- **«رسمه»:** `wireDraw` — حواف الموديل الحقيقية + مستوى قص يمشي: يتفكك خطوط ويرجع يرتسم، وخط مسح بلون التمييز.
- **اللقطة تطير وتنحط بالشاشة**، ولمعة زجاج (`sheen`) تمشي عليها.
- **زوم قوي على ميزة** (`zoomPose` + `featureRing`): المتابعين، ريل، زر — إطار بلون التمييز ينرسم حولها.
- وقت الزوم: **`hideGlass`** (زجاج الموديل يحط طبقة رمادية) و**الكلمات اللي تحت تختفي** (`camRig().zoomW`).
- كلمات المشهد تحت الجهاز (y ≈ 1480)، وحدة بوحدة (`ctx.text.slot`) — ⛔ لا نص فوق الجهاز ولا يطلع برّا الإطار.

## 4) الحركة الفيزيائية والصوت
`track(v0, [{at, to, f, z, antic}])` = نوابض لعدة أهداف ورا بعض (المحرّك فيه `E.spring` نابض واحد بس):
- `f` التردد: جوال 0.9–1.1 (خفيف)، لابتوب 0.5–0.7 (ثقيل)، طفو 0.3–0.4.
- `z` التخميد: 0.62–0.7 لفة فيها تخطّي، 0.8–0.9 هادية، 1 بلا تخطّي.
- `antic` تحضير صغير (0.08–0.14 راديان) عكس الاتجاه قبل اللفة الكبيرة · `throwOut` رمية للخروج (تتسارع).
- الكاميرا: `camRig(t, stops)` + `applyCam` — نفس النوابض، كل محطة `{at, pose, f, z, roll, zoom}`.

**الصوت من الحركة:** حط الخطط بـ`<المشروع>/motion.mjs` (بلا import — الدوال تنعطى له):
```js
export function plans(W, S, { track, throwOut }) { return { phoneRY: track(Math.PI, [{ at: 0.5, to: 2 * Math.PI, f: 0.6, z: 0.74 }]) }; }
export function cues({ M, W, S, scene, whooshes, add }) {
  add('shimmer', W('l3', 1), 0.36);                                  // لحظة الرسم
  return [...whooshes(M.phoneRY, { from: 0, to: scene('s1').end, r: 0.17, thr: 0.9 })];   // r = نص عرض الجسم بالمتر
}
```
المشهد: `this.M = plans(W, S, K)` · بعدها `node scripts/46_motion_sfx.mjs <المشروع>` يكتب `sfx.json`
(ذروة الووش بلحظة أعلى سرعة، الثقيل حدته أوطى، صوت واحد لكل 0.35 ث) ← `python3 motion/audio.py <المشروع>`.

## 5) كلمات وشعار مجسّمين بخط حقيقي
```bash
python3 scripts/45_text3d.py <المشروع>/assets/words3d.json "فيلم" "موشن" "شعارك"    # --font --wght
```
بالمشهد: `await loadWords('/proj/assets/words3d.json'); await ready3DText();` ثم `word3D(ctx, 'فيلم', {depth, bevel, face, side})`.
حافة مشطوفة + clearcoat = لمعة حقيقية مع الضوء. حرّكها بنوابض (`springStep`) من العمق ورا سطرها — ⛔ لا تعبر كلمة فوق كلمة.
⛔ لا `extrudedText` الطبقات للكلمات الكبيرة — تبين رخيصة.

## 6) قبل التسليم
- فريمات معاينة بلحظات الزوم (`node motion/render.js <المشروع> preview <وقت>`): اللقطة حادة؟ الزجاج مخفي؟ الإطار على الميزة بالضبط؟
- `renderer.localClippingEnabled = true` بالمشهد اللي فيه `wireDraw`.
- الموديل نفس الرخصة المسموحة، والكابشن بلا أسماء مصممين، وملفات `models/` ما تطلع مع أي شي ينعطى لأحد.
