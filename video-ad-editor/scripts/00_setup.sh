#!/bin/bash
# فحص وتجهيز الأدوات.  ./00_setup.sh          → يفحص ويقول وش ناقص
#                      ./00_setup.sh --install → ينزّل الناقص (بعد إذن المستخدم)
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
# 🚧 حارس السحابة (8 سبتمبر): من تطبيق كلود بالسحابة (ساندبوكس لينكس) تنزيل موديل وِسبر محجوب وما فيه متصفح للرسم —
#    السكل يشتغل على جهازك (ماك أو ويندوز) عبر Claude Code. نوقف هنا برسالة واضحة بدل خطأ غامض بعدين.
if [ "$OS" = linux ] && { [ -n "$CLAUDE_SANDBOX" ] || [ ! -d /Applications ]; } && ! curl -sI -m 8 https://openaipublic.azureedge.net >/dev/null 2>&1; then
  echo "⛔ هذا السكل يشتغل على جهازك عبر Claude Code (ماك أو ويندوز)، مو داخل تطبيق كلود بالسحابة."
  echo "   السحابة تحجب تنزيل موديل التفريغ (openaipublic.azureedge.net) وما فيها متصفح للرسم."
  echo "   الحل: افتح Claude Code على جهازك (الوضع المحلي Local) وشغّل نفس الأمر."
  exit 9
fi

# 🔄 تحديث تلقائي (v2.9): نقارن VERSION المحلي بآخر إصدار على قت هب بصمت (5 ثوانٍ كحد أقصى).
#    لو فيه أحدث: نطبع سطراً واحداً — وكلود يسأل المستخدم ثم يشغّل: bash scripts/00_setup.sh --update
SKROOT="$(cd "$(dirname "$0")/.." && pwd)"; LOCALV="$(cat "$SKROOT/VERSION" 2>/dev/null || echo 0)"
if [ "$1" = "--update" ]; then
  TMP="$(mktemp -d)"; echo "⬇️ أنزّل آخر إصدار…"
  if curl -sL -m 120 -o "$TMP/skill.zip" https://github.com/majedphotos/video-ad-editor/releases/latest/download/video-ad-editor.skill \
     && unzip -q -o "$TMP/skill.zip" -d "$TMP/x" && [ -f "$TMP/x/video-ad-editor/SKILL.md" ]; then
    rsync -a --delete --exclude=hdr2sdr --exclude=personmask --exclude=facetrack --exclude=node_modules "$TMP/x/video-ad-editor/" "$SKROOT/" \
      && echo "✅ انحدّث السكل إلى v$(cat "$SKROOT/VERSION" 2>/dev/null) — كمّل شغلك عادي" || echo "⚠️ ما قدرت أستبدل الملفات"
  else echo "⚠️ ما قدرت أنزّل التحديث — جرّب لاحقاً"; fi
  rm -rf "$TMP"; exit 0
fi
LATEST="$(curl -sL -m 5 -o /dev/null -w '%{url_effective}' https://github.com/majedphotos/video-ad-editor/releases/latest 2>/dev/null | sed -n 's#.*/tag/v##p')"
if [ -n "$LATEST" ] && [ "$LATEST" != "$LOCALV" ] && [ "$(printf '%s\n%s' "$LOCALV" "$LATEST" | sort -V | tail -1)" = "$LATEST" ]; then
  echo "🆕 فيه إصدار أحدث من السكل: v$LATEST (عندك v$LOCALV) — اسأل المستخدم، ولو وافق شغّل: bash scripts/00_setup.sh --update"
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
