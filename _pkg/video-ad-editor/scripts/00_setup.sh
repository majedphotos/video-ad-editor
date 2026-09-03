#!/bin/bash
# فحص وتجهيز الأدوات.  ./00_setup.sh          → يفحص ويقول وش ناقص
#                      ./00_setup.sh --install → ينزّل الناقص (بعد إذن المستخدم)
INSTALL=0; [ "$1" = "--install" ] && INSTALL=1
MISS=(); OK=(); NOTE=()
have(){ command -v "$1" >/dev/null 2>&1; }
line(){ printf '%s\n' "$1"; }

have ffmpeg && OK+=("ffmpeg") || MISS+=("ffmpeg")
python3 -c "import whisper" 2>/dev/null && OK+=("whisper") || MISS+=("whisper")
python3 -c "import numpy"  2>/dev/null && OK+=("numpy")   || MISS+=("numpy")
CHROME="${CHROME_PATH:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
[ -x "$CHROME" ] && OK+=("chrome") || MISS+=("chrome")
node -e "require.resolve('puppeteer-core')" 2>/dev/null && OK+=("puppeteer-core") || MISS+=("puppeteer-core")

line "الجاهز: ${OK[*]:-لا شيء}"
# المحرّك الثاني (ريموشن) اختياري تماماً — الخفيف يشتغل بدونه
if have npm; then line "المحرّك الثاني (ريموشن): متاح عند الطلب — 04b_remotion.sh setup ينزّله (~500 ميقا)"
else line "المحرّك الثاني (ريموشن): يحتاج npm — غير متاح، والخفيف يكفي"; fi
if [ ${#MISS[@]} -eq 0 ]; then line "✅ كل شي جاهز — نقدر نبدأ."; exit 0; fi
line "الناقص: ${MISS[*]}"

if [ $INSTALL -eq 0 ]; then line "شغّل: $0 --install"; exit 10; fi

for m in "${MISS[@]}"; do
  case "$m" in
    ffmpeg)
      if have brew; then line "⏬ ffmpeg…"; brew install ffmpeg || NOTE+=("ffmpeg فشل")
      else NOTE+=("لازم Homebrew أول: /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""); fi ;;
    whisper) line "⏬ openai-whisper… (الموديل ينزل أول تشغيل، 1.4 قيقا)"
      pip3 install --quiet openai-whisper || pip3 install --quiet --break-system-packages openai-whisper || NOTE+=("whisper فشل") ;;
    numpy)   pip3 install --quiet numpy || pip3 install --quiet --break-system-packages numpy || NOTE+=("numpy فشل") ;;
    puppeteer-core) line "⏬ puppeteer-core…"; npm i --silent puppeteer-core || NOTE+=("puppeteer-core فشل") ;;
    chrome) NOTE+=("كروم مو منصّب — نزّله من google.com/chrome أو حدّد CHROME_PATH") ;;
  esac
done

FAIL=0
have ffmpeg || FAIL=1
python3 -c "import whisper,numpy" 2>/dev/null || FAIL=1
[ -x "$CHROME" ] || FAIL=1
node -e "require.resolve('puppeteer-core')" 2>/dev/null || FAIL=1
[ ${#NOTE[@]} -gt 0 ] && printf '⚠️  %s\n' "${NOTE[@]}"
[ $FAIL -eq 0 ] && line "✅ كل شي جاهز الحين." || { line "❌ باقي ناقص — شوف الملاحظات فوق."; exit 11; }
