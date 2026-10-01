#!/bin/bash
# 🎙️ تحسين صوت التسجيل — «حسّن الصوت» (9 سبتمبر 2026)
#   الطريق الأول (الأفضل): أداة أدوبي «Enhance Speech» عبر كونكتور أدوبي داخل كلود — كلود هو اللي يناديها، مو هذا السكربت:
#     يرفع src.mov لأدوبي (asset_initialize_file_upload → PUT → asset_finalize_file_upload) ← media_enhance_speech(assetId)
#     ← ينزّل مسار الكلام النظيف ← يشغّل هذا السكربت لدمجه:   bash 02b_enhance_audio.sh <work> <clean.wav|.mp4|.m4a>
#   الطريق الثاني (بلا أدوبي): على الجهاز — DeepFilterNet3 لو منصّب (00_setup.sh --extras) وإلا ffmpeg:
#                                                            bash 02b_enhance_audio.sh <work> --local [0.85]
#   النتيجة: src.mov يصير بالصوت المحسّن (الأصل يُحفظ src_rawaudio.mov) — سوّها قبل التفريغ (الخطوة 4) حتى يسمع وِسبر صوتاً نظيفاً.
set -e
. "$(dirname "$0")/_compat.sh"
W="${1%/}"; SRC="$W/src.mov"; IN="$2"
[ -f "$SRC" ] || { echo "❌ ما لقيت $SRC"; exit 1; }
[ -f "$W/src_rawaudio.mov" ] || cp "$SRC" "$W/src_rawaudio.mov"
if [ "$IN" = "--local" ] || [ "$IN" = "--ai" ]; then
  # 🆕 v3.9: 02c_denoise.py — DeepFilterNet3 على الجهاز لو منصّب (00_setup.sh --extras)، وإلا ffmpeg العادي.
  #    القوة (0..1) اختيارية كوسيط ثالث: bash 02b_enhance_audio.sh <work> --local 0.7
  ENG=auto; [ "$IN" = "--ai" ] && ENG=dfn
  "$PY" "$(dirname "$0")/02c_denoise.py" "$W" --engine "$ENG" --strength "${3:-0.85}"
else
  [ -f "$IN" ] || { echo "❌ عطني ملف الصوت النظيف من أدوبي أو --local"; exit 1; }
  # نأخذ الصورة من الأصل والصوت من ملف أدوبي (يقبل wav/m4a/mp4) — بنفس الطول
  ffmpeg -v error -y -i "$W/src_rawaudio.mov" -i "$IN" -map 0:v:0 -map 1:a:0 -c:v copy -c:a aac -b:a 192k -shortest -movflags +faststart "$SRC"
  echo "✅ صوت أدوبي المحسّن اندمج بالفيديو — الأصل بـ src_rawaudio.mov"
fi
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate -of csv=p=0 "$SRC"
