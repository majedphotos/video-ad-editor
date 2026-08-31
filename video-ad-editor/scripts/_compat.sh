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
