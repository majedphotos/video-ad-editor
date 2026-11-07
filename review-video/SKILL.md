---
name: review-video
description: يمنتج ريل مراجعة منتج 9:16 — تعليق صوتي فوق لقطات المنتج، خطوط تتبع القطعة لحظة ذكرها، زومات ناعمة، كروت مواصفات، كرت خصم، شعار المتجر والبراند، وكفر المنتج مقصوص. Use when user says "مراجعة منتج"، "ريل مراجعة"، "فتح علبة"، "انبوكسنق"، "شورت تقني"، "إعلان منتج بصوتي"، "عرض وخصم"، "خطوط على القطعة"، or sends product footage plus a voice note or script. Not for talking-head video only (use video-ad-editor) or clips with no speech (use montage-video).
---

# ريل مراجعة منتج

المحرّك مشترك. كل المسارات من: `${CLAUDE_SKILL_DIR}/../video-ad-editor`

اقرأ أول: `references/start.md` ثم `references/pro-editor.md` ثم `references/review-video.md`.

## الخطوات

1. **البداية:** نفّذ `references/start.md`، وخذ الموافقة بجملة وحدة لو فيه ناقص.
2. **افحص كل المواد:** `python3 scripts/review/review.py inspect <مجلد المواد> <work>`
   - شوف كل ورقات الفريمات وصورة السكربت بعينك.
   - الملف اللي مو تابع للشغل لا تستخدمه، واذكره.
3. **اكتب الخطة:** كل جملة لها لقطتها وقطعتها وحركتها، بملف `<work>/plan.json`.
   - الشكل والمثال بـ`references/review-video.md`.
   - لنقاط القطع: `review.py grid <work> <ملف> <ثانية>`.
4. **الصوت:** `review.py voice <work>`، وصحح القص لو طلع تحذير.
5. **ركّب التوقيت على بدايات الطاقة** من `voice_speech.json`، مو على توقيت التفريغ.
6. **التتبع:** `review.py track <work>`.
7. **التجربة:** `review.py still <work> <12 إلى 17 وقت>`، وافتح `stills.jpg`.
   لا ترسم كامل قبل ما تكون الفريمات سليمة.
8. **الرسم:** `review.py render <work>`.
9. **التسليم:** `review.py finish <work>` ثم افتح `qa.jpg`، واقرا السعر والتاريخ والأسماء من الملف النهائي.
10. **الكفر:** `review.py cover <work>` ثم `python3 scripts/34_phone_preview.py <الكفر>`.
11. أرسل النسخة الأصلية والخفيفة والكفر، وافتح المجلد.

## ⛔ أسلوبك مع المستخدم

- لا تقول «أبدأ؟». اشتغل للآخر، والموافقة بس قبل النشر.
- لا تنشر شي بلا موافقته الصريحة.
- لا تألف سعر ولا خصم ولا كود. لو تعارضت المصادر قلها بسطر، واكتب أي رقم اعتمدت.
- قل اللي ما انفحص. لا تقول إنك سمعت الصوت.
