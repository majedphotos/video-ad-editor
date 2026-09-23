<!-- مرجع لسكل video-ad-editor — يُقرأ عند الحاجة فقط (توفير توكنز) -->

# خريطة السكربتات والملفات

| | يسوي شنو | المحرّك |
|---|---|---|
| `00_setup.sh` | يفحص الأدوات وينزّل الناقص · `--update` للتحديث | مشترك |
| `01_cut_plan.py` | يقيس السكتات ويطلع مقاطع الكلام | مشترك |
| `02_captions.py` | توقيت كل كلمة على التايم-لاين الجديد | مشترك |
| `02b_enhance_audio.sh` | تحسين الصوت محلياً (`references/audio-enhance.md`) | مشترك |
| `03_cut_zoom.py` | القص + زوم لكل مقطع + وسم bt709 + محوّل HDR | مشترك |
| `04_render_frames.js` | يرسم الفريمات (استئناف + نافذة + معاينة) · يطبع أخطاء المشاهد بـ`[compose]` | الخفيف |
| `04b_remotion.sh` | يجهّز/يفتح/يرندر مشروع ريموشن (`references/remotion.md`) | ريموشن |
| `05_sfx.py` | المؤثرات الصوتية من `sfx.json` | مشترك |
| `06_encode.sh` | يجمّع الفريمات + الصوت | الخفيف |
| `06b_master.sh` | ‎-14 LUFS + ملف صوتي بالخلفية بخفض تلقائي | مشترك |
| `07_contact_sheet.sh` | ورقة لقطات وحدة: 3 أعمدة × صفّين (6 بالكثير) | مشترك |
| `08_safe_check.js` | المنطقة الآمنة + الهوك (نفس حمولة 04: theme + studio + behind) | الخفيف |
| `09_srt.py` | ملف ترجمة + نص الكابشن | مشترك |
| `10_script_edit.py` | `show` (يطبع النص والجمل المعادة) · `drop` · `keep` · `undo` | مشترك |
| `11_behind_text.js` + `personmask.swift` | أنماط القصّ الثلاثة (`references/cut-styles.md`) | الخفيف (ماك) |
| `12_montage.py` | **وضع المونتاج** (`references/montage.md`) | مستقل |
| `13_collage.js` · `13_collage_sfx.py` · `collage.TEMPLATE.html` | أسلوب الكولاج (`references/collage.md`) | مستقل |
| `13_assets.py` | صورة من ويكيميديا (رخصة حرة) مع قصّ خلفية اختياري | مشترك |
| `14_backdrop.py` | خلفية باهتة (`references/backdrop.md`) | الخفيف |
| `15_podcast.py` · `16_render_pod.js` · `compose.PODCAST.html` · `facetrack.swift` | **وضع البودكاست** (`references/podcast.md`) | مستقل (ماك) |
| `17_gen_scenes.py` | مشاهد مولّدة (`references/gen-scenes.md`) | الخفيف |
| `compose.REFERENCE.html` | المحرّك: الفيديو · الكابشن · ورا الراس · بي-رول · مولّد · ملصقات · كرت النهاية | الخفيف |
| `compose.EXAMPLES.js` | مشاهد المثال القديم للقراءة — **ما يتحمّل افتراضياً** | — |

## ملفات مجلد الشغل
`src.mov` · `a.json` (وِسبر) · `fixes.json` · `cut.json` · `caps.json` · `theme.json` · `studio.json` · `sfx.json` · `behind.json` · `safe.json` (اختياري) · `vfr/` (فريمات المصدر) · `out/` (فريمات الرسم) · `prev/` (معاينة) · `ad-final.mp4` · `ad-master.mp4/.srt/.txt`.
**احفظ `caps.json` و`cut.json`** — أي تعديل لاحق ما يحتاج إعادة تفريغ.
