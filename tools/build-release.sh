#!/bin/bash
# يبني ملفات الإصدار من آخر كوميت بهالمستودع (بلا نسخ من أي مجلد ثاني):
#   bash tools/build-release.sh   →   dist/majed-video.plugin + dist/video-ad-editor.skill
# لا ينشر شي. النشر (push + gh release) خطوة منفصلة بموافقة ماجد.
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"; cd "$REPO"
[ -z "$(git status --porcelain -- .claude-plugin video-ad-editor motion-video podcast-video montage-video thumbnail-video davinci-video)" ] || { echo "❌ فيه تعديلات مو مكومتة — كوميت أول"; exit 1; }
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
git archive HEAD .claude-plugin video-ad-editor motion-video podcast-video montage-video thumbnail-video davinci-video | tar -x -C "$T"
P="$T/video-ad-editor"
# مو للتشغيل: صور الشرح وملفات npm وملفات جيت الداخلية (نفس 4.4.4)
rm -rf "$P/img" "$P/package.json" "$P/package-lock.json" "$P/motion/.gitignore"
# حد 200 ملف لرفع تطبيق كلود: معاينات بنك الحركات ← zip واحد (35_moves.py / 00_onboard.py يفكّونه أول مرة)
( cd "$P/motion/moves" && zip -qr previews.zip previews && rm -rf previews )
mkdir -p dist; rm -f dist/majed-video.plugin dist/video-ad-editor.skill
( cd "$T" && zip -qr "$REPO/dist/majed-video.plugin" .claude-plugin video-ad-editor motion-video podcast-video montage-video thumbnail-video davinci-video -x '*/.DS_Store' )
# ملف .skill القديم: سكل واحد بوصف يغطي كل الأوضاع (دبل كليك + التحديث الذاتي للنسخ القديمة)
S="$(mktemp -d)"; cp -R "$P" "$S/"
python3 - "$S/video-ad-editor/SKILL.md" <<'PY'
import sys
p = sys.argv[1]; s = open(p, encoding="utf-8").read()
full = ('description: يمنتج فيديو كلام للكاميرا إلى ريل/إعلان 9:16: يشيل السكتات، كابشن عربي بتوقيت الكلمة، وموشن قرافيكس بألوانه. '
        'وفيه مونتاج مقاطع بلا كلام وبودكاست بكاميرتين. Use when user says "منتج هذا المقطع"، "سو من هذا الفيديو إعلان"، "شيّل السكتات"، '
        '"حوّل الفيديو لريل"، "ركّب كابشن عربي"، "اقص الصمت"، "مونتاج من هالمقاطع"، "بودكاست"، "كاميرتين"، or sends a talking video/clip folder. '
        'Also a no-person 3D motion-graphics explainer from text: "فيديو موشن"، "شرح بالموشن"، "سو فيديو من هالنص"، "موشن قرافيكس"، '
        '"اشرح هالموقع/التطبيق بفيديو". Also a full 16:9 YouTube podcast edit from raw multi-camera files ("الحلقة كاملة بالعرض"). '
        'Not for carousels or video covers.')
lines = s.split("\n"); i = next(k for k, l in enumerate(lines) if l.startswith("description:"))
lines[i] = full; open(p, "w", encoding="utf-8").write("\n".join(lines))
PY
( cd "$S" && zip -qr "$REPO/dist/video-ad-editor.skill" video-ad-editor -x '*/.DS_Store' ); rm -rf "$S"
# فحوص
for z in video-ad-editor.skill majed-video.plugin; do N="$(unzip -Z1 "dist/$z" | grep -vc '/$')"; [ "$N" -le 200 ] || { echo "❌ $z فيه $N ملف (الحد 200)"; exit 1; }; echo "  $z: $N ملف"; done
V="$(cat "$P/VERSION")"; PV="$(python3 -c "import json;print(json.load(open('$T/.claude-plugin/plugin.json'))['version'])")"
[ "$V" = "$PV" ] || { echo "❌ VERSION ($V) ≠ plugin.json ($PV)"; exit 1; }
! grep -rIl "/Users/majedalzaabi" "$P" | grep -q . || { echo "❌ فيه مسار شخصي:"; grep -rIl "/Users/majedalzaabi" "$P"; exit 1; }
( cd "$T" && claude plugin validate . >/dev/null && claude plugin validate .claude-plugin/plugin.json >/dev/null ) || { echo "❌ فحص الـplugin فشل"; exit 1; }
# تذكير المتجر: claude.ai يراقب ~/majed-plugins/.claude-plugin/marketplace.json بس — لازم version + source.ref = v$V
MK="$HOME/majed-plugins/.claude-plugin/marketplace.json"
if [ -f "$MK" ]; then python3 - "$MK" "$V" <<'PY' || true
import json, sys
m = json.load(open(sys.argv[1])); v = sys.argv[2]
e = next((p for p in m.get("plugins", []) if p.get("name") == "majed-video"), {})
if e.get("version") != v or (e.get("source") or {}).get("ref") != "v" + v:
    print("⚠️  المتجر: majed-video بـmarketplace.json = %s @ %s — بعد الإصدار عدّلهم لـ%s @ v%s وادفع ~/majed-plugins (وإلا claude.ai ما يشوف التحديث)" % (e.get("version"), (e.get("source") or {}).get("ref"), v, v))
PY
fi
echo "✅ v$V جاهز بـdist/ — .plugin $(du -h dist/majed-video.plugin | cut -f1) · .skill $(du -h dist/video-ad-editor.skill | cut -f1)"
