<!-- مرجع لسكل video-ad-editor — يُقرأ عند الحاجة فقط (توفير توكنز) -->

# خريطة السكربتات والملفات

| | يسوي شنو | المحرّك |
|---|---|---|
| `00_setup.sh` | يفحص الأدوات وينزّل الناقص · `--update` للتحديث | مشترك |
| `01_cut_plan.py` | يقيس السكتات ويطلع مقاطع الكلام | مشترك |
| `02_captions.py` | توقيت كل كلمة على التايم-لاين الجديد | مشترك |
| `02b_enhance_audio.sh` | تحسين الصوت محلياً (`references/audio-enhance.md`) | مشترك |
| `03_cut_zoom.py` | القص + زوم لكل مقطع + وسم bt709 + محوّل HDR | مشترك |
| `_landscape.py` | يستدعيه 03 لحاله للفيديو العرضي: حدود اللقطات + الوجه → قصّ 9:16 لكل لقطة · `shots.json` (`references/landscape.md`) | مشترك (الوجه ماك) |
| `04_render_frames.js` | يرسم الفريمات (استئناف + نافذة + معاينة) · يطبع أخطاء المشاهد بـ`[compose]` · بصمة التصميم: تغيّر أو `--force` = يمسح القديم أول | الخفيف |
| `04b_remotion.sh` | يجهّز/يفتح/يرندر مشروع ريموشن (`references/remotion.md`) | ريموشن |
| `05_sfx.py` | المؤثرات الصوتية من `sfx.json` | مشترك |
| `06_encode.sh` | يجمّع الفريمات + الصوت | الخفيف |
| `06b_master.sh` | ‎-14 LUFS + ملف صوتي بالخلفية بخفض تلقائي | مشترك |
| `06c_loudfix.sh` | لما 06b يوقف تحت الهدف (‎-15/-16 بسبب قمم عالية): ضغط خفيف + ‎-14 بمرحلتين، الصورة كما هي | مشترك |
| `07_contact_sheet.sh` | ورقة لقطات وحدة: 3 أعمدة × صفّين (6 بالكثير) | مشترك |
| `08_safe_check.js` | المنطقة الآمنة + الهوك (نفس حمولة 04: theme + studio + behind) | الخفيف |
| `09_srt.py` | ملف ترجمة + نص الكابشن | مشترك |
| `10_script_edit.py` | `show` (يطبع النص والجمل المعادة) · `drop` · `keep` · `undo` | مشترك |
| `11_behind_text.js` + `personmask.swift` | أنماط القصّ الثلاثة (`references/cut-styles.md`) | الخفيف (ماك) |
| `12_montage.py` | **وضع المونتاج** (`references/montage.md`) | مستقل |
| `13_collage.js` · `13_collage_sfx.py` · `collage.TEMPLATE.html` | أسلوب الكولاج (`references/collage.md`) | مستقل |
| `13_assets.py` | صورة من ويكيميديا (رخصة حرة) مع قصّ خلفية اختياري | مشترك |
| `14_backdrop.py` | خلفية باهتة (`references/backdrop.md`) | الخفيف |
| `23_headcrop.py` (+`facetrack.swift`) | **قصّ الكرت من فوق الراس** — ثابت طول الفيديو، يكتب `studio.json ← cardTop` (الخطوة 6.1) | ماك |
| `15_podcast.py` · `16_render_pod.js` · `compose.PODCAST.html` · `facetrack.swift` | **وضع البودكاست** (`references/podcast.md`) | مستقل (ماك) |
| `17_gen_scenes.py` | مشاهد مولّدة (`references/gen-scenes.md`) | الخفيف |
| `18_long_transcribe.py` | تفريغ حلقة كاملة بقطع 20 ث عند السكتات (mlx على الماك ~8× أسرع) → `words.json` + `transcript.txt` | مشترك |
| `20_episode_cuts.py` | حلقة ← ريل: `spec.json` (قطع بالكلمات) → `cut.json` بحدود على السكتة + `a.json` (تفريغ لكل قطعة، `seg`) + قالب `fixes.json` + `src.mov` | مشترك |
| `19_seam_check.py` | يفرّغ الريل النهائي حول كل لحمة ويكشف الكلمة المكررة أو بقايا كلام من برّا | مشترك |
| `compose.REFERENCE.html` | المحرّك: الفيديو · الكابشن · ورا الراس · بي-رول · مولّد · ملصقات · كرت النهاية | الخفيف |
| `compose.EXAMPLES.js` | مشاهد المثال القديم للقراءة — **ما يتحمّل افتراضياً** | — |
| `studio/studio.py` | الاستوديو — تايملاين باللمس فوق نفس الملفات والراسم (`references/studio.md`) | الخفيف |
| `21_avatar_scene.py` | مشهد الأفاتار: صورة بمكان ثاني + يتكلم بصوته (`references/talking-avatar.md`) | fal |
| `22_hook.py` + `hook-card.js` | 🪝 الهوك المكتوب أول كل ريل بودكاست/مقابلة: `suggest` أقوى السطور · `check` فاحص القواعد (3-8 كلمات، أداة شد، لهجة، الرقم من كلامه) · `apply` يكتب `theme.json ← hook` ويركّب الكرت · `preview` ورقة 4 لقطات · `overlay` طبقة شفافة `hook.mov` (أو محروقة فوق mp4) لريل مو من محرّكاتنا — خط المقابلة بدافنشي (`references/podcast-hook.md`) | مشترك |

## ملفات مجلد الشغل
`src.mov` · `spec.json` (حلقة ← ريل) · `a.json` (وِسبر) · `fixes.json` · `cut.json` · `caps.json` · `theme.json` · `studio.json` · `sfx.json` · `behind.json` · `safe.json` (اختياري) · `hook-card.js` + `hook_sheet.jpg` (الهوك) · `vfr/` (فريمات المصدر) · `out/` (فريمات الرسم) · `prev/` (معاينة) · `ad-final.mp4` · `ad-master.mp4/.srt/.txt`.
**احفظ `caps.json` و`cut.json`** — أي تعديل لاحق ما يحتاج إعادة تفريغ.
