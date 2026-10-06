#!/bin/bash
# فحص وتجهيز الأدوات.  ./00_setup.sh          → يفحص ويقول وش ناقص
#                      ./00_setup.sh --install → ينزّل الناقص (بعد إذن المستخدم)
#                      ./00_setup.sh --extras  → الإضافات الاختيارية: تنظيف صوت ذكي · نبض · بحث بالمعنى
# ✏️ معدّل ليشتغل على ويندوز وماك ولينكس. الأصل الماكي محفوظ بـ00_setup.sh.mac-orig
. "$(dirname "$0")/_compat.sh"
INSTALL=0; [ "$1" = "--install" ] && INSTALL=1
MISS=(); OK=(); NOTE=()
have(){ command -v "$1" >/dev/null 2>&1; }
line(){ printf '%s\n' "$1"; }

case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*) OS=win ;;
  Darwin) OS=mac ;;
  *) OS=linux ;;
esac
SKILL="$(abspath "$(dirname "$0")/..")"
# ☁️ بيئة سحابية / جوال (6 أكتوبر 2026 — قرار ماجد: ما فيه «ما يصير»): بدل ما نوقف، ننبّه ونكمّل بالمسار البديل.
#    هنا تنزيل موديل وِسبر الأصلي قد يكون محجوب وما فيه واجهة، فنستخدم السلّم بـreferences/any-environment.md
#    (faster-whisper · MODNet · كروم بلا واجهة + ffmpeg). الجلسة الأولى على الجوال أثبتت إنه يشتغل.
if [ "$OS" = linux ] && { [ -n "$CLAUDE_SANDBOX" ] || [ ! -d /Applications ]; } && ! curl -sI -m 8 https://openaipublic.azureedge.net >/dev/null 2>&1; then
  echo "☁️ بيئة سحابية (جوال/ويب): وِسبر الأصلي محجوب هنا — نكمّل بالبدائل: faster-whisper للتفريغ، MODNet لقص الشخص، كروم بلا واجهة للرسم."
  echo "   اقرأ references/any-environment.md. ما توقف ولا تقول للمستخدم «ما يصير»."
  CLOUD=1
fi

# 🔄 تحديث تلقائي (v2.9): نقارن VERSION المحلي بآخر إصدار على قت هب بصمت (5 ثوانٍ كحد أقصى).
#    لو فيه أحدث: نطبع سطراً واحداً — وكلود يسأل المستخدم ثم يشغّل: bash scripts/00_setup.sh --update
SKROOT="$(cd "$(dirname "$0")/.." && pwd)"; LOCALV="$(cat "$SKROOT/VERSION" 2>/dev/null || echo 0)"
# v4: لو السكل منصّب كـplugin (majed-video) التحديث يكون من مدير الإضافات — مو بالاستبدال اليدوي
case "$SKROOT" in */.claude/plugins/*) PLUGIN=1 ;; *) PLUGIN=0 ;; esac
PLUG_UPD="claude plugin marketplace update majed-video && claude plugin update majed-video@majed-video"
if [ "$1" = "--update" ] && [ "$PLUGIN" = 1 ]; then
  echo "ℹ️ السكل منصّب كـplugin — شغّل: $PLUG_UPD  (ثم افتح جلسة جديدة)"; exit 0
fi
if [ "$1" = "--update" ]; then
  TMP="$(mktemp -d)"; echo "⬇️ أنزّل آخر إصدار…"
  if curl -sL -m 120 -o "$TMP/skill.zip" https://github.com/majedphotos/video-ad-editor/releases/latest/download/video-ad-editor.skill \
     && unzip -q -o "$TMP/skill.zip" -d "$TMP/x" && [ -f "$TMP/x/video-ad-editor/SKILL.md" ]; then
    rsync -a --delete --exclude=bin --exclude=hdr2sdr --exclude=personmask --exclude=facetrack --exclude=node_modules "$TMP/x/video-ad-editor/" "$SKROOT/" \
      && echo "✅ انحدّث السكل إلى v$(cat "$SKROOT/VERSION" 2>/dev/null) — كمّل شغلك عادي" || echo "⚠️ ما قدرت أستبدل الملفات"
  else echo "⚠️ ما قدرت أنزّل التحديث — جرّب لاحقاً"; fi
  rm -rf "$TMP"; exit 0
fi
LATEST="$(curl -sL -m 5 https://api.github.com/repos/majedphotos/video-ad-editor/releases/latest 2>/dev/null | sed -n 's/.*"tag_name": *"v\([0-9.]*\)".*/\1/p' | head -1)"
if [ -n "$LATEST" ] && [ "$LATEST" != "$LOCALV" ] && [ "$(printf '%s\n%s' "$LOCALV" "$LATEST" | sort -V | tail -1)" = "$LATEST" ]; then
  if [ "$PLUGIN" = 1 ]; then
    echo "🆕 فيه إصدار أحدث من السكل: v$LATEST (عندك v$LOCALV) — اسأل المستخدم، ولو وافق شغّل: $PLUG_UPD  (ثم جلسة جديدة)"
  else
    echo "🆕 فيه إصدار أحدث من السكل: v$LATEST (عندك v$LOCALV) — اسأل المستخدم، ولو وافق شغّل: bash scripts/00_setup.sh --update"
  fi
fi

# ➕ الإضافات (v3.9، أفكار Palmier) — اختيارية، السكل يشتغل بدونها وكل وحدة ترجع للطريق القديم لو ناقصة:
#    ‹deep-filter› تنظيف صوت ذكي (02c) · ‹transformers› البحث بالمعنى (26)
extras_status(){
  local e=()
  { [ -x "$SKILL/bin/deep-filter" ] || [ -x "$SKILL/bin/deep-filter.exe" ] || have deep-filter; } && e+=("تنظيف-الصوت✅") || e+=("تنظيف-الصوت—")
  "$PY" -c "import transformers,PIL" 2>/dev/null && e+=("البحث-بالمعنى✅") || e+=("البحث-بالمعنى—")
  echo "${e[*]}"
}
if [ "$1" = "--extras" ]; then
  pipx2(){ "$PY" -m pip install --quiet "$@" || "$PY" -m pip install --quiet --break-system-packages "$@"; }
  mkdir -p "$SKILL/bin"
  DFV=0.5.6
  case "$OS-$(uname -m)" in
    mac-arm64)          T=aarch64-apple-darwin ;;
    mac-x86_64)         T=x86_64-apple-darwin ;;
    win-*)              T=x86_64-pc-windows-msvc.exe ;;
    linux-x86_64)       T=x86_64-unknown-linux-musl ;;
    *)                  T="" ;;
  esac
  DF="$SKILL/bin/deep-filter"; [ "$OS" = win ] && DF="$DF.exe"
  if [ -n "$T" ] && [ ! -x "$DF" ]; then
    line "⏬ تنظيف الصوت الذكي (DeepFilterNet3، ~20 ميقا)…"
    if curl -sfL -m 180 -o "$DF" "https://github.com/Rikorose/DeepFilterNet/releases/download/v$DFV/deep-filter-$DFV-$T" \
       && [ "$(wc -c < "$DF")" -gt 1000000 ]; then
      chmod +x "$DF"; [ "$OS" = mac ] && xattr -d com.apple.quarantine "$DF" 2>/dev/null
      "$DF" --help >/dev/null 2>&1 && line "   ✅ جاهز" || { rm -f "$DF"; line "   ⚠️ نزل بس ما اشتغل — يبقى فلتر ffmpeg العادي"; }
    else rm -f "$DF"; line "   ⚠️ ما قدرت أنزّله — يبقى فلتر ffmpeg العادي"; fi
  fi
  "$PY" -c "import torch" 2>/dev/null || { line "⏬ torch (أساس الموديلات)…"; pipx2 torch; }
  "$PY" -c "import transformers,PIL" 2>/dev/null || { line "⏬ البحث بالمعنى (transformers — الموديل ~1.5 قيقا ينزل أول بحث)…"; pipx2 "transformers>=4.49" pillow sentencepiece protobuf || line "   ⚠️ فشل"; }
  line "الإضافات: $(extras_status)"
  exit 0
fi

have ffmpeg  && OK+=("ffmpeg")  || MISS+=("ffmpeg")
have ffprobe && OK+=("ffprobe") || MISS+=("ffprobe")
"$PY" -c "import whisper" 2>/dev/null && OK+=("whisper") || MISS+=("whisper")
"$PY" -c "import numpy"   2>/dev/null && OK+=("numpy")   || MISS+=("numpy")

# كروم: نفس ترتيب البحث اللي بالسكربتات
find_chrome(){
  [ -n "$CHROME_PATH" ] && [ -f "$CHROME_PATH" ] && { echo "$CHROME_PATH"; return 0; }
  local c
  for c in "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
           "${ProgramFiles:-C:/Program Files}/Google/Chrome/Application/chrome.exe" \
           "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
           "${LOCALAPPDATA:-}/Google/Chrome/Application/chrome.exe" \
           "${ProgramFiles:-C:/Program Files}/Microsoft/Edge/Application/msedge.exe" \
           /usr/bin/google-chrome /usr/bin/chromium /usr/bin/chromium-browser; do
    [ -f "$c" ] && { echo "$c"; return 0; }
  done; return 1
}
CHROME="$(find_chrome)" && OK+=("chrome") || MISS+=("chrome")

# puppeteer-core: يُبحث عنه من مجلد السكل نفسه (هناك ينزّل)
( cd "$SKILL" && node -e "require.resolve('puppeteer-core')" ) 2>/dev/null \
  && OK+=("puppeteer-core") || MISS+=("puppeteer-core")

line "النظام: $OS · بايثون: $PY"
[ -n "$CHROME" ] && line "كروم: $CHROME"
line "الجاهز: ${OK[*]:-لا شيء}"
line "الإضافات (اختيارية — 00_setup.sh --extras): $(extras_status)"
if have npm; then line "المحرّك الثاني (ريموشن): متاح عند الطلب — 04b_remotion.sh setup ينزّله (~500 ميقا)"
else line "المحرّك الثاني (ريموشن): يحتاج npm — غير متاح، والخفيف يكفي"; fi
[ "$OS" = mac ] || NOTE+=("مؤثّر «الكلام ورا الشخص» (11_behind_text.js) يشتغل على ماك فقط — بقية السكل يشتغل عادي")

if [ ${#MISS[@]} -eq 0 ]; then
  line "✅ كل شي جاهز — نقدر نبدأ."
  [ ${#NOTE[@]} -gt 0 ] && printf 'ℹ️  %s\n' "${NOTE[@]}"
  exit 0
fi
line "الناقص: ${MISS[*]}"
if [ $INSTALL -eq 0 ]; then line "شغّل: $0 --install"; exit 10; fi

pipi(){ "$PY" -m pip install --quiet "$@" || "$PY" -m pip install --quiet --break-system-packages "$@"; }
for m in "${MISS[@]}"; do
  case "$m" in
    ffmpeg|ffprobe)
      [ "$m" = ffprobe ] && continue
      line "⏬ ffmpeg…"
      if   [ "$OS" = win ] && have winget; then winget install --id Gyan.FFmpeg -e --accept-package-agreements --accept-source-agreements || NOTE+=("ffmpeg فشل — نزّله من ffmpeg.org وضفه للـPATH")
      elif have brew;  then brew install ffmpeg || NOTE+=("ffmpeg فشل")
      elif have apt;   then sudo apt install -y ffmpeg || NOTE+=("ffmpeg فشل")
      else NOTE+=("نزّل ffmpeg يدوياً من ffmpeg.org وضفه للـPATH"); fi ;;
    whisper) line "⏬ openai-whisper… (الموديل ينزل أول تشغيل، 1.4 قيقا)"
      pipi openai-whisper || NOTE+=("whisper فشل") ;;
    numpy)   pipi numpy || NOTE+=("numpy فشل") ;;
    puppeteer-core) line "⏬ puppeteer-core…"
      ( cd "$SKILL" && npm i --silent puppeteer-core ) || NOTE+=("puppeteer-core فشل") ;;
    chrome) NOTE+=("كروم مو منصّب — نزّله من google.com/chrome أو حدّد CHROME_PATH") ;;
  esac
done

FAIL=0
have ffmpeg || FAIL=1
"$PY" -c "import whisper,numpy" 2>/dev/null || FAIL=1
find_chrome >/dev/null || FAIL=1
( cd "$SKILL" && node -e "require.resolve('puppeteer-core')" ) 2>/dev/null || FAIL=1
[ ${#NOTE[@]} -gt 0 ] && printf '⚠️  %s\n' "${NOTE[@]}"
[ $FAIL -eq 0 ] && line "✅ كل شي جاهز الحين." || { line "❌ باقي ناقص — شوف الملاحظات فوق."; exit 11; }
