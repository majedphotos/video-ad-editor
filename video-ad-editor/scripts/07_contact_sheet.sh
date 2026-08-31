#!/bin/bash
# ورقة تواصل: يجمع لقطات كثيرة بصورة وحدة — كلود يشوفها بقراءة وحدة بدل عشر قراءات (توفير توكنز كبير).
# ./07_contact_sheet.sh <workdir> <sheet.jpg> <t1> <t2> ...    (المصدر: ad-final.mp4 إن وُجد، وإلا مجلد prev/)
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
  if [ -f "$W/ad-final.mp4" ]; then ffmpeg -v error -ss "$t" -i "$W/ad-final.mp4" -frames:v 1 -vf "scale=300:-1" -y "$f"
  else ffmpeg -v error -i "$W/prev/t$(printf %.2f $t).jpg" -vf "scale=300:-1" -y "$f"; fi
  ffmpeg -v error -i "$f" -vf "drawtext=${FONTARG}text='${t}s':x=8:y=8:fontsize=20:fontcolor=white:box=1:boxcolor=black@0.55:boxborderw=5" -y "$f.l.jpg" 2>/dev/null || cp "$f" "$f.l.jpg"
  ARGS+=(-i "$f.l.jpg")
done
ffmpeg -v error "${ARGS[@]}" -filter_complex "hstack=inputs=$i" -y "$OUT"
rm -rf "$TMP"; echo "✅ $OUT  ($i لقطة)"
