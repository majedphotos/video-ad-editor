#!/bin/bash
# ./06_encode.sh <workdir> [اسم_الملف]   → يجمّع الفريمات + الصوت + المؤثرات
set -e
W="$(cd "$1" && pwd)"; OUT="${2:-$W/ad-final.mp4}"
DUR=$(python3 -c "import json;c=json.load(open('$W/caps.json'));s=json.load(open('$W/sfx.json'));print(round(c['total']+s['outro'],3))")
FADE=$(python3 -c "print(round($DUR-0.6,3))")
ffmpeg -v error -stats -framerate 30 -i "$W/out/%05d.jpg" -i "$W/cutz.mp4" -i "$W/sfx.wav" \
 -filter_complex "[0:v]format=yuv420p[vo];[1:a]apad=pad_dur=8[a0];[a0][2:a]amix=inputs=2:duration=first:normalize=0[am];[am]atrim=0:$DUR,asetpts=PTS-STARTPTS,afade=t=out:st=$FADE:d=0.6[ao]" \
 -map "[vo]" -map "[ao]" -c:v libx264 -preset slow -crf 21 -maxrate 6M -bufsize 12M \
 -profile:v high -level 4.0 -pix_fmt yuv420p -r 30 -c:a aac -b:a 160k -ar 48000 \
 -movflags +faststart -y "$OUT"
echo "✅ $OUT"
ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height -of default=nw=1 "$OUT"
