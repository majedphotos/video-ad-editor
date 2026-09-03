#!/bin/bash
# ═══ معايرة الصوت لمعيار المنصات + ملف صوتي بالخلفية (اختياري) بخفض تلقائي ═══
#   ./06b_master.sh <work> <in.mp4> [out.mp4]
# • المعايرة: ‎-14 LUFS (نفس علو الفيديوهات الثانية بالفيد — بدونها صوتك يطلع أخفض)
# • الخلفية الصوتية: تشتغل بس إذا وُجد <work>/bg-audio.mp3|m4a|wav (أو BG=مسار)،
#   وتنخفض تلقائياً كل ما تتكلم (sidechain) فما تزاحم صوتك.
#   ⛔ ما نستخدم موسيقى — المقصود ملف صوتي (أصوات بشرية، أجواء، همهمة مكان).
# • الصورة تُنسخ كما هي — لا إعادة ترميز ولا خسارة جودة.
# متغيرات: BG · BG_GAIN (0.28) · LUFS (-14) · NO_LOUDNORM=1
set -e
W="$(cd "$1" && pwd)"; IN="$2"; OUT="${3:-${IN%.mp4}-master.mp4}"
[ -f "$IN" ] || { echo "❌ ما لقيت $IN"; exit 2; }
G="${BG_GAIN:-${MUSIC_GAIN:-0.28}}"; I="${LUFS:--14}"
DUR=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$IN")
FO=$(python3 -c "print(max(0,round($DUR-1.4,3)))")

MUS="${BG:-$MUSIC}"
if [ -z "$MUS" ]; then for n in bg-audio bg sound music; do for e in mp3 m4a wav aac; do
  [ -f "$W/$n.$e" ] && MUS="$W/$n.$e" && break 2; done; done; fi

MIX="$W/.master-mix.wav"; NRM="$W/.master-norm.wav"
if [ -n "$MUS" ]; then
  echo "🔊 خلفية صوتية: $(basename "$MUS")  (مستوى $G · تنخفض وقت الكلام)"
  ffmpeg -v error -stats -i "$IN" -stream_loop -1 -i "$MUS" -filter_complex \
   "[0:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,asplit=2[v0][sc];\
    [1:a]aresample=48000,aformat=sample_fmts=fltp:channel_layouts=stereo,volume=$G,atrim=0:$DUR,asetpts=N/SR/TB,\
    afade=t=in:st=0:d=1.0,afade=t=out:st=$FO:d=1.4[m];\
    [m][sc]sidechaincompress=threshold=0.035:ratio=9:attack=8:release=320[md];\
    [v0][md]amix=inputs=2:duration=first:normalize=0[a]" \
   -map "[a]" -ac 2 -ar 48000 -y "$MIX"
else
  echo "🔊 بلا خلفية صوتية (حط bg-audio.mp3 بمجلد الشغل إذا بغيتها)"
  ffmpeg -v error -i "$IN" -vn -ac 2 -ar 48000 -y "$MIX"
fi

if [ "$NO_LOUDNORM" = "1" ]; then cp "$MIX" "$NRM"; echo "⏭  المعايرة متخطّاة";
else
  echo "📏 قياس العلو…"
  M=$(ffmpeg -hide_banner -nostats -v info -i "$MIX" -af "loudnorm=I=$I:TP=-1.5:LRA=11:print_format=json" -f null - 2>&1 | \
      python3 -c "import sys,json,re;s=sys.stdin.read();m=re.findall(r'\{[^{}]*input_i[^{}]*\}',s,re.S);print(json.dumps(json.loads(m[-1])) if m else '')")
  if [ -z "$M" ]; then echo "⚠️  ما قدرت أقيس — معايرة بمرور واحد";
    ffmpeg -v error -stats -i "$MIX" -af "loudnorm=I=$I:TP=-1.5:LRA=11" -ar 48000 -y "$NRM"
  else
    read -r II TP LRA TH < <(python3 -c "
import json,sys;d=json.loads('''$M''');print(d['input_i'],d['input_tp'],d['input_lra'],d['input_thresh'])")
    # مسار صامت (مونتاج بلا خلفية صوتية) يقيس ‎-inf، وloudnorm يرفضها ويوقف الخط كله.
    if python3 -c "import sys;v=float('$II');sys.exit(0 if v!=v or v<-70 else 1)" 2>/dev/null; then
      echo "🔇 المسار الصوتي صامت — تخطّيت المعايرة (حط bg-audio.mp3 إذا تبي صوتاً)."
      cp "$MIX" "$NRM"
    else
      echo "   قبل: $II LUFS → بعد: $I LUFS"
      ffmpeg -v error -stats -i "$MIX" -af \
       "loudnorm=I=$I:TP=-1.5:LRA=11:measured_I=$II:measured_TP=$TP:measured_LRA=$LRA:measured_thresh=$TH:linear=true" \
       -ar 48000 -y "$NRM"
    fi
  fi
fi

ffmpeg -v error -stats -i "$IN" -i "$NRM" -map 0:v:0 -map 1:a:0 -c:v copy \
  -c:a aac -b:a 192k -ar 48000 -movflags +faststart -y "$OUT"
rm -f "$MIX" "$NRM"
echo "✅ $OUT"
ffmpeg -hide_banner -nostats -v info -i "$OUT" -af "loudnorm=I=$I:TP=-1.5:print_format=summary" -f null - 2>&1 | grep -E "Input Integrated|Input True Peak" || true
ffprobe -v error -show_entries format=duration,size -of default=nw=1 "$OUT"
