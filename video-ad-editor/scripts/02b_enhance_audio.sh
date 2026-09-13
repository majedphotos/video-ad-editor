#!/bin/bash
# 🎙️ تحسين صوت التسجيل — «حسّن الصوت» (9 سبتمبر 2026)
#   الطريق الأول (الأفضل): أداة أدوبي «Enhance Speech» عبر كونكتور أدوبي داخل كلود — كلود هو اللي يناديها، مو هذا السكربت:
#     يرفع src.mov لأدوبي (asset_initialize_file_upload → PUT → asset_finalize_file_upload) ← media_enhance_speech(assetId)
#     ← ينزّل مسار الكلام النظيف ← يشغّل هذا السكربت لدمجه:   bash 02b_enhance_audio.sh <work> <clean.wav|.mp4|.m4a>
#   الطريق الثاني (بلا أدوبي): معالجة محلية بـffmpeg (حذف الضجيج + قطع الترددات المنخفضة + ضغط + معايرة):
#                                                            bash 02b_enhance_audio.sh <work> --local
#   النتيجة: src.mov يصير بالصوت المحسّن (الأصل يُحفظ src_rawaudio.mov) — سوّها قبل التفريغ (الخطوة 4) حتى يسمع وِسبر صوتاً نظيفاً.
set -e
W="${1%/}"; SRC="$W/src.mov"; IN="$2"
[ -f "$SRC" ] || { echo "❌ ما لقيت $SRC"; exit 1; }
[ -f "$W/src_rawaudio.mov" ] || cp "$SRC" "$W/src_rawaudio.mov"
if [ "$IN" = "--local" ]; then
  ffmpeg -v error -y -i "$W/src_rawaudio.mov" -c:v copy \
    -af "highpass=f=80,afftdn=nf=-28:nt=w,acompressor=threshold=-18dB:ratio=3:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=9" \
    -c:a aac -b:a 192k -movflags +faststart "$SRC"
  echo "✅ صوت محسّن محلياً (بلا أدوبي) — الأصل بـ src_rawaudio.mov"
else
  [ -f "$IN" ] || { echo "❌ عطني ملف الصوت النظيف من أدوبي أو --local"; exit 1; }
  # نأخذ الصورة من الأصل والصوت من ملف أدوبي (يقبل wav/m4a/mp4) — بنفس الطول
  ffmpeg -v error -y -i "$W/src_rawaudio.mov" -i "$IN" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$SRC"
  echo "✅ صوت أدوبي المحسّن اندمج بالفيديو — الأصل بـ src_rawaudio.mov"
fi
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate -of csv=p=0 "$SRC"
