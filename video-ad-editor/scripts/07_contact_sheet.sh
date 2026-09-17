#!/bin/bash
# ورقة تواصل: يجمع لقطات كثيرة بصورة وحدة — كلود يشوفها بقراءة وحدة بدل عشر قراءات (توفير توكنز كبير).
# ./07_contact_sheet.sh <workdir> <sheet.jpg> <t1> <t2> ...
#   المصدر: SRC=<ملف.mp4> إن أُعطي · وإلا ad-final.mp4 · وإلا مجلد prev/
# ⚠️ وسم التوقيت يُرسم ببايثون (PIL) لأن كثيراً من بناءات ffmpeg تجي بلا drawtext —
#    وبلا وسم الورقة تصير ألغازاً: تشوف لقطات وما تدري أي لحظة كل وحدة.
set -e
. "$(dirname "$0")/_compat.sh"
W="$(abspath "$1")"; OUT="$2"; shift 2
FONTARG=""
for _fnt in "C:/Windows/Fonts/arial.ttf" "C:/Windows/Fonts/segoeui.ttf"             "/System/Library/Fonts/Supplemental/Arial.ttf"             "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"; do
  [ -f "$_fnt" ] && { FONTARG="fontfile='$(printf %s "$_fnt" | sed 's|:|\:|')':"; break; }
done
TMP="$W/.sheet"; rm -rf "$TMP"; mkdir -p "$TMP"; i=0; ARGS=()   # مصفوفة عشان المسارات اللي فيها مسافات
for t in "$@"; do
  i=$((i+1)); f="$TMP/$(printf %02d $i).jpg"
  V="${SRC:-$W/ad-final.mp4}"
  PV="$W/prev/t$(printf %.2f $t).jpg"
  if [ -f "$PV" ] && [ "$PV" -nt "$V" ]; then ffmpeg -v error -i "$PV" -vf "scale=300:-1" -y "$f"   # لقطة المعاينة الأحدث لها الأولوية على الفيديو القديم
  elif [ -f "$V" ]; then ffmpeg -v error -ss "$t" -i "$V" -frames:v 1 -vf "scale=300:-1" -y "$f"
  else ffmpeg -v error -i "$W/prev/t$(printf %.2f $t).jpg" -vf "scale=300:-1" -y "$f"; fi
  ARGS+=(-i "$f")
done

if "${PY:-python3}" - "$OUT" "$TMP" "$@" <<'PY' 2>/dev/null
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont
out, tmp = sys.argv[1], sys.argv[2]; times = sys.argv[3:]
fs = sorted(glob.glob(os.path.join(tmp, "*.jpg")))
ims = [Image.open(f) for f in fs]
w, h = ims[0].size
sheet = Image.new("RGB", (w * len(ims), h), (17, 17, 17))
dr = ImageDraw.Draw(sheet)
fnt = None
for p in ("/System/Library/Fonts/Supplemental/Arial Bold.ttf",
          "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"):
    if os.path.exists(p):
        fnt = ImageFont.truetype(p, 22); break
if fnt is None:
    try: fnt = ImageFont.load_default(size=22)
    except TypeError: fnt = ImageFont.load_default()
for k, im in enumerate(ims):
    sheet.paste(im, (k * w, 0))
    lbl = f"{times[k]}s" if k < len(times) else ""
    dr.rectangle([k * w + 5, 5, k * w + 22 + 12 * len(lbl), 34], fill=(0, 0, 0))
    dr.text((k * w + 12, 9), lbl, fill=(255, 255, 255), font=fnt)
sheet.save(out, quality=88)
PY
then echo "✅ $OUT  ($i لقطة · بالتوقيت على كل وحدة)"
else
  ffmpeg -v error "${ARGS[@]}" -filter_complex "hstack=inputs=$i" -y "$OUT"
  echo "✅ $OUT  ($i لقطة · بلا وسم — الترتيب من اليسار: $*)"
fi
rm -rf "$TMP"
