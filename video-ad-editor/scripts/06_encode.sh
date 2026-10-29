#!/bin/bash
# ./06_encode.sh <workdir> [اسم_الملف]   → يجمّع الفريمات + الصوت + المؤثرات
#   FIT=1 ← ترميز بمرحلتين بمعدل محسوب من المدة (6.1): الملف تحت MAXMB ميقا (افتراضي 29) — ريل بلا كفر طويل.
#   (ريل بكفر: 28_cover.py --first يضبط الحجم وحده من هالنسخة العالية — لا تضغطها هني وتنضغط مرتين)
set -e
. "$(dirname "$0")/_compat.sh"
W="$(abspath "$1")"; OUT="${2:-$W/ad-final.mp4}"; MAXMB="${MAXMB:-29}"
DUR=$("$PY" -c "import json;c=json.load(open('$W/caps.json'));s=json.load(open('$W/sfx.json'));print(round(c['total']+float(s.get('outro',0) or 0),3))")
FADE=$("$PY" -c "print(round($DUR-0.6,3))")
IN=(-framerate 30 -i "$W/out/%05d.jpg" -i "$W/cutz.mp4" -i "$W/sfx.wav"
 -filter_complex "[0:v]scale=in_range=pc:out_range=tv:out_color_matrix=bt709,format=yuv420p[vo];[1:a]apad=pad_dur=8[a0];[a0][2:a]amix=inputs=2:duration=first:normalize=0[am];[am]atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=out:st=$FADE:d=0.6[ao]"
 -map "[vo]" -map "[ao]")
V=(-c:v libx264 -preset slow -profile:v high -level 4.0 -pix_fmt yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -r 30)
A=(-c:a aac -b:a 160k -ar 48000)
if [ "${FIT:-0}" = "1" ]; then
  # المعدل = (الهدف − صوت 192k بعد المعايرة) × 0.97 هامش الحاوية — 124 ث ← ~1715k ≈ 28 ميقا (ريل «1000$ بيوم»: 1.72M = 27.9)
  VB=$("$PY" -c "print(max(600,min(6000,int(($MAXMB*8388608/$DUR-192000)*0.97/1000))))")
  echo "🎞  أجمّع الفريمات والصوت بمرحلتين — ${VB}k (الهدف أقل من $MAXMB ميقا)…"
  R=(-b:v ${VB}k -maxrate $((VB*2))k -bufsize $((VB*4))k -passlogfile "$W/.x264pass")
  ffmpeg -v error -nostats "${IN[@]}" "${V[@]}" "${R[@]}" -pass 1 "${A[@]}" -f null -
  ffmpeg -v error -nostats "${IN[@]}" "${V[@]}" "${R[@]}" -pass 2 "${A[@]}" -movflags +faststart -y "$OUT"
  rm -f "$W"/.x264pass*
else
  echo "🎞  أجمّع الفريمات والصوت… (بلا عدّاد)"
  ffmpeg -v error -nostats "${IN[@]}" "${V[@]}" -crf 21 -maxrate 6M -bufsize 12M "${A[@]}" -movflags +faststart -y "$OUT"
fi
echo "✅ $OUT  — $(ffprobe -v error -show_entries format=duration,size -of default=nw=1:nk=1 "$OUT" | paste -sd' ' - | awk '{printf "%.2f ث · %.1f ميقا", $1, $2/1048576}')"
SZ=$(ffprobe -v error -show_entries format=size -of csv=p=0 "$OUT")
if "$PY" -c "import sys;sys.exit(0 if $SZ>$MAXMB*1048576 else 1)"; then
  echo "📦 أكبر من $MAXMB ميقا — الكفر (28_cover.py --first) يطلّعه تحتها وحده · بلا كفر: FIT=1 bash scripts/06_encode.sh <work>"
fi
