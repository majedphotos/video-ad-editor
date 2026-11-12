# ── توافق ويندوز/ماك/لينكس — يُستدعى من كل سكربت (مضاف) ──────────
# 1) بايثون: ويندوز فيه python بس، و python3 اختصار متجر مايكروسوفت (يفشل)
# 2) المسارات: ويندوز يحتاج C:/… لأن بايثون ما يفهم /c/… حق قِت-باش
# 3) UTF-8 إجباري عشان العربي ما ينكسر على cp1252
_pick_py(){ for c in python3 python py; do
    command -v "$c" >/dev/null 2>&1 && "$c" -c "import sys" >/dev/null 2>&1 && { echo "$c"; return 0; }
  done; echo python3; }
PY="${PY:-$(_pick_py)}"
export PYTHONUTF8=1 PYTHONIOENCODING=utf-8
# مسار مطلق أصلي (C:/… على ويندوز، /… على ماك ولينكس)
abspath(){ ( cd "$1" 2>/dev/null && { pwd -W 2>/dev/null || pwd; } ); }

# ── 🎨 ألوان مطابقة للأصل (12 نوفمبر — ريل «عيون»: الخط كان ينقص الأحمر 5 من 255) ──────────
# المتصفح يقرا JPEG على إنه bt601 مدى كامل، والفيديو bt709 مدى تلفزيون. محوّل ffmpeg الافتراضي (swscale) يقصّ كسور اللون
# حتى مع accurate_rnd، ففلتر colorspace هو اللي يحوّل (فرق أقل من نص درجة عن فريم أبل). الصيغتين زوج: لا تستخدم وحدة بلا الثانية.
#   فيديو ← فريمات JPEG للرسم:   ffmpeg -i in.mp4 -vf "fps=30,$VF_FRAMES" -q:v 1 out/%05d.jpg
#   فريمات المتصفح ← فيديو:      ffmpeg -framerate 30 -i out/%05d.jpg -vf "$VF_ENCODE" …
VF_FRAMES='scale=out_range=tv:flags=accurate_rnd+full_chroma_int+full_chroma_inp,format=yuv420p,colorspace=ispace=bt709:irange=tv:iprimaries=bt709:itrc=bt709:space=bt470bg:range=pc:primaries=bt709:trc=bt709:format=yuv444p,format=yuvj444p'
VF_ENCODE='colorspace=ispace=bt470bg:irange=pc:iprimaries=bt709:itrc=bt709:space=bt709:range=tv:primaries=bt709:trc=bt709:format=yuv420p'
