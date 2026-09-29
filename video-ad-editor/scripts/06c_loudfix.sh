#!/bin/bash
# معايرة لما 06b يوقف تحت الهدف (v3.5): صوت فيه قمم عالية (ضحكة، كلمة بقوة) يخلي loudnorm الخطي يوقف عند ‎-15/-16
# لأنه ما يقدر يرفع أكثر بدون ما يكسر حد الذروة. هني ضغط خفيف (3:1 فوق ‎-20dB) ثم معايرة ‎-14 بمرحلتين. الصورة تُنسخ كما هي.
#   bash 06c_loudfix.sh <in.mp4> [out.mp4]   (بدون out = يستبدل الملف)
IN="$1"; OUT="${2:-$1}"; TMP="${OUT%.mp4}.lufs.tmp.mp4"
C="acompressor=threshold=-20dB:ratio=3:attack=5:release=90:makeup=2"
J=$(ffmpeg -hide_banner -nostats -i "$IN" -af "$C,loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | sed -n '/{/,/}/p')
g(){ echo "$J" | python3 -c "import json,sys;print(json.load(sys.stdin)['$1'])"; }
ffmpeg -v error -i "$IN" -c:v copy -af "$C,loudnorm=I=-14:TP=-1.5:LRA=11:measured_I=$(g input_i):measured_TP=$(g input_tp):measured_LRA=$(g input_lra):measured_thresh=$(g input_thresh):linear=true" \
  -ar 48000 -c:a aac -b:a 192k -movflags +faststart -y "$TMP" && mv "$TMP" "$OUT" || { echo "❌ فشلت المعايرة"; exit 1; }
echo "✅ $(basename "$OUT") — $(ffmpeg -hide_banner -nostats -i "$OUT" -af loudnorm=I=-14:TP=-1.5:print_format=summary -f null - 2>&1 | awk '/Input Integrated/{i=$3}/Input True Peak/{p=$4}END{print i" LUFS · ذروة "p}')"
