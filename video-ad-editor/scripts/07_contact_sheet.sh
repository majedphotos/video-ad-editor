#!/bin/bash
# ورقة تواصل: يجمع لقطات كثيرة بصورة وحدة — كلود يشوفها بقراءة وحدة بدل عشر قراءات (توفير توكنز كبير).
# ./07_contact_sheet.sh <workdir> <sheet.jpg> <t1> <t2> ...
#   المصدر: SRC=<ملف.mp4> إن أُعطي · وإلا ad-final.mp4 · وإلا مجلد prev/
#   شبكة 3 أعمدة × صفّين بالكثير (6 لقطات) بعرض 1080 — كل لقطة 360 بكسل، مقروءة حتى لو تصغّرت الورقة.
#   أكثر من 6 أوقات؟ تنرسم أول 6 بس — ورقة وحدة لكل معاينة، لا أوراق كثيرة.
# ⚠️ وسم التوقيت يُرسم ببايثون (PIL) لأن كثيراً من بناءات ffmpeg تجي بلا drawtext —
#    وبلا وسم الورقة تصير ألغازاً: تشوف لقطات وما تدري أي لحظة كل وحدة.
set -e
. "$(dirname "$0")/_compat.sh"
W="$(abspath "$1")"; OUT="$2"; shift 2
MAXT=6; COLS=3; TW=360; TH=640
if [ "$#" -gt "$MAXT" ]; then echo "⚠️  $# وقت — الورقة تاخذ $MAXT بالكثير، رسمت أول $MAXT"; set -- "${@:1:$MAXT}"; fi
VF="scale=$TW:$TH:force_original_aspect_ratio=decrease,pad=$TW:$TH:(ow-iw)/2:(oh-ih)/2:color=0x111111"
TMP="$W/.sheet"; rm -rf "$TMP"; mkdir -p "$TMP"; i=0
for t in "$@"; do
  i=$((i+1)); f="$TMP/$(printf %02d $i).jpg"
  V="${SRC:-$W/ad-final.mp4}"
  PV="$W/prev/t$(printf %.2f $t).jpg"
  if [ -f "$PV" ] && [ "$PV" -nt "$V" ]; then ffmpeg -v error -i "$PV" -vf "$VF" -y "$f"   # لقطة المعاينة الأحدث لها الأولوية على الفيديو القديم
  elif [ -f "$V" ]; then ffmpeg -v error -ss "$t" -i "$V" -frames:v 1 -vf "$VF" -y "$f"
  else ffmpeg -v error -i "$PV" -vf "$VF" -y "$f"; fi
done

if "${PY:-python3}" - "$OUT" "$TMP" "$COLS" "$@" <<'PY' 2>/dev/null
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
out, tmp, cols = sys.argv[1], sys.argv[2], int(sys.argv[3]); times = sys.argv[4:]
fs = sorted(glob.glob(os.path.join(tmp, "*.jpg")))
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
cols = min(cols, len(ims)); rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (w * cols, h * rows), (17, 17, 17))
dr = ImageDraw.Draw(sheet)
fnt = None
for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
          "C:/Windows/Fonts/arialbd.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
    if os.path.exists(p):
        fnt = ImageFont.truetype(p, 26); break
if fnt is None:
    try: fnt = ImageFont.load_default(size=26)
    except TypeError: fnt = ImageFont.load_default()
for k, im in enumerate(ims):
    x, y = (k % cols) * w, (k // cols) * h
    sheet.paste(im, (x, y))
    lbl = f"{times[k]}s" if k < len(times) else ""
    dr.rectangle([x + 6, y + 6, x + 26 + 15 * len(lbl), y + 42], fill=(0, 0, 0))
    dr.text((x + 14, y + 10), lbl, fill=(255, 255, 255), font=fnt)
sheet.save(out, quality=85)
PY
then echo "✅ $OUT  ($i لقطة · شبكة $COLS أعمدة · بالتوقيت على كل وحدة)"
else
  C=$(( i < COLS ? i : COLS )); R=$(( (i + COLS - 1) / COLS ))
  ffmpeg -v error -i "$TMP/%02d.jpg" -vf "tile=${C}x${R}:color=0x111111" -frames:v 1 -y "$OUT"
  echo "✅ $OUT  ($i لقطة · بلا وسم — الترتيب سطراً سطراً من فوق-يسار: $*)"
fi
rm -rf "$TMP"
