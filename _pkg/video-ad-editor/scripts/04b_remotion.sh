#!/bin/bash
# ═══ المحرّك الثاني: ريموشن (تايم-لاين حي بدل رسم فريمات) ═══
#   ./04b_remotion.sh <work> setup            → يجهّز المشروع بمجلد الشغل (ينزّل ~500 ميقا أول مرة)
#   ./04b_remotion.sh <work> sync             → يحدّث البيانات والأصول فقط (بلا تنزيل)
#   ./04b_remotion.sh <work> studio [port]    → يفتح الاستوديو الحي
#   ./04b_remotion.sh <work> render [out.mp4] → يطلّع MP4 مباشرة (بلا فريمات)
# المشاهد تُكتب بـ<work>/remotion/src/Scenes.tsx — ما يُمسح بأي إعادة تشغيل.
set -e
W="$(cd "$1" && pwd)"; CMD="${2:-setup}"; ARG="$3"
TPL="$(cd "$(dirname "$0")/remotion-template" && pwd)"
R="$W/remotion"

sync_all(){
  mkdir -p "$R/src" "$R/public"
  # ملفات الهيكل: تُحدَّث دائماً ما عدا اللي يعدّله المستخدم
  for f in package.json tsconfig.json remotion.config.ts .gitignore README.md; do
    [ -f "$TPL/$f" ] && cp "$TPL/$f" "$R/$f"; done
  for f in index.ts Root.tsx Ad.tsx theme.ts font.ts stage.ts util.tsx Chrome.tsx Captions.tsx Outro.tsx Guides.tsx; do
    cp "$TPL/src/$f" "$R/src/$f"; done
  # المشاهد: تُنسخ مرة وحدة بس — شغلك ما ينمسح
  [ -f "$R/src/Scenes.tsx" ] || cp "$TPL/src/Scenes.tsx" "$R/src/Scenes.tsx"

  cp "$W/caps.json" "$R/src/caps.json"
  python3 - "$W" "$R" <<'PY'
import json, os, sys
W, R = sys.argv[1], sys.argv[2]
def rd(name, dflt):
    p = os.path.join(W, name)
    return json.load(open(p)) if os.path.exists(p) else dflt
caps  = json.load(open(os.path.join(W, "caps.json")))
theme = rd("theme.json", {})
sfx   = rd("sfx.json", {})
proj = {
  "theme": {k: theme.get(k) for k in ("bg","ink","acc","clay","mut","font","handle") if theme.get(k)},
  "total": round(caps["total"], 3),
  "outro": float(sfx.get("outro", 5.0)),
  "sfx":   os.path.exists(os.path.join(W, "sfx.wav")),
  "stage": rd("stage.json", [{"s":0, "e":9999, "m":"FULL"}]),
  "outro_copy": rd("outro.json", {"line":"", "recap":[], "cta_top":"", "cta_word":"", "tail":""}),
  "guides": bool(rd("safe.json", {}).get("guides", False)),   # true → أدلّة المنطقة الآمنة بالاستوديو
}
json.dump(proj, open(os.path.join(R, "src", "project.json"), "w"), ensure_ascii=False, indent=1)
print("project.json → المدة", proj["total"], "+ ختام", proj["outro"], "· مؤثرات:", "نعم" if proj["sfx"] else "لا")
PY
  [ -f "$W/cutz.mp4" ] && cp "$W/cutz.mp4" "$R/public/video.mp4"
  [ -f "$W/sfx.wav" ]  && cp "$W/sfx.wav"  "$R/public/sfx.wav"
  LOGO="$(python3 -c "import json,os,sys;p=os.path.join('$W','theme.json');print(json.load(open(p)).get('logo','logo.png') if os.path.exists(p) else 'logo.png')")"
  [ -f "$W/$LOGO" ] && cp "$W/$LOGO" "$R/public/logo.png"
  [ -f "$R/public/logo.png" ] || echo "⚠️  ما فيه شعار بـ$W — حط logo.png"
  echo "✅ البيانات والأصول محدّثة بـ$R"
}

case "$CMD" in
  setup)
    sync_all
    if [ -d "$R/node_modules" ]; then echo "المكتبات موجودة — جاهز."; else
      echo "⏬ تنزيل مكتبات ريموشن (~500 ميقا، مرة وحدة)…"
      ( cd "$R" && npm install --silent ) || { echo "❌ فشل التنزيل"; exit 12; }
      echo "✅ جاهز."
    fi ;;
  sync) sync_all ;;
  studio)
    sync_all; PORT="${ARG:-3000}"
    echo "🎬 الاستوديو على http://localhost:$PORT"
    ( cd "$R" && npx remotion studio --port "$PORT" ) ;;
  render)
    sync_all; OUT="${ARG:-$W/ad-final.mp4}"
    grep -q '"guides": true' "$R/src/project.json" && \
      echo "⚠️  أدلّة المنطقة الآمنة شغّالة — تنطبع بالفيديو. شيل guides من safe.json قبل التسليم." 
    ( cd "$R" && npx remotion render Ad "$OUT" --codec h264 --crf 21 --jpeg-quality 95 )
    echo "✅ $OUT"
    ffprobe -v error -show_entries format=duration,size -show_entries stream=width,height -of default=nw=1 "$OUT" ;;
  *) echo "أوامر: setup | sync | studio | render"; exit 2 ;;
esac
