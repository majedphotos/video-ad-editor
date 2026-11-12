#!/bin/bash
# فحص مطابقة اللون: هل الريل النهائي يطلع بنفس ألوان تصوير الآيفون؟
#   bash tools/color-check.sh <مقطع آيفون HDR أو SDR> [ثانية البداية=1.0]
# يمشّي ثانيتين من المقطع بالخط كامل (03 قص + فريمات ← 04 رسم بلا تصميم ← 06 تجميع ← 28 كفر أول فريم ← 06b ماستر)
# ويقارن 3 فريمات من الناتج النهائي بفريم أبل الأصلي (AVAssetImageGenerator ← sRGB).
# ينجح لو متوسط الفرق لكل قناة أقل من 1 من 255، ووسوم الملف bt709 كاملة.
# ما يعدّل المقطع (قراية بس) · يحتاج: ماك + swiftc + numpy + puppeteer-core (PUPPETEER_PATH لو مو منصّب بالمجلد).
set -euo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"; SK="$REPO/video-ad-editor"
SRC="${1:?عطني مقطع: bash tools/color-check.sh <clip> [start]}"; T0="${2:-1.0}"
[ -f "$SRC" ] || { echo "❌ ما لقيت $SRC"; exit 2; }
SRC="$(cd "$(dirname "$SRC")" && pwd)/$(basename "$SRC")"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT; W="$T/w"; mkdir -p "$W"

cat > "$T/applegrab.swift" <<'EOF'
import AVFoundation
import CoreGraphics
import Foundation
// applegrab <video> <ثانية> <out.rgb> — فريم أبل محوّل sRGB (نفس اللي يشوفه بالجوال)، RGB8 خام
let a = CommandLine.arguments
let g = AVAssetImageGenerator(asset: AVURLAsset(url: URL(fileURLWithPath: a[1])))
g.appliesPreferredTrackTransform = true
g.requestedTimeToleranceBefore = .zero; g.requestedTimeToleranceAfter = .zero
var actual = CMTime.zero
let img = try! g.copyCGImage(at: CMTime(seconds: Double(a[2])!, preferredTimescale: 600), actualTime: &actual)
let w = img.width, h = img.height
var buf = [UInt8](repeating: 0, count: w * h * 4)
let ctx = CGContext(data: &buf, width: w, height: h, bitsPerComponent: 8, bytesPerRow: w * 4,
                    space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue)!
ctx.interpolationQuality = .none
ctx.draw(img, in: CGRect(x: 0, y: 0, width: w, height: h))
var rgb = [UInt8](repeating: 0, count: w * h * 3)
for i in 0..<(w * h) { rgb[i * 3] = buf[i * 4]; rgb[i * 3 + 1] = buf[i * 4 + 1]; rgb[i * 3 + 2] = buf[i * 4 + 2] }
FileManager.default.createFile(atPath: a[3], contents: Data(rgb))
print("\(w)x\(h)")
EOF
swiftc -O -o "$T/applegrab" "$T/applegrab.swift" 2>/dev/null

echo "① فريمات أبل الأصلية…"
SIZE=""
for k in 15 30 45; do
  t=$(python3 -c "print($T0+$k/30)"); SIZE=$("$T/applegrab" "$SRC" "$t" "$T/apple_$k.rgb")
done
[ "$SIZE" = "1080x1920" ] || { echo "❌ الفحص يبي مقطع طولي 1080×1920 (هذا $SIZE) عشان البكسل يطابق البكسل"; exit 2; }

echo "② الخط كامل على ثانيتين…"
ln -s "$SRC" "$W/src.mov"
python3 -c "print('{\"keep\":[[$T0,%s]],\"zooms\":{\"%.2f\":1.0}}' % ($T0+2.0, $T0))" > "$W/cut.json"
echo '{"total":2.0,"cards":[]}' > "$W/caps.json"; echo '{"outro":0}' > "$W/sfx.json"
echo '{"bg":"#F0EEE6","ink":"#1F1F1D","acc":"#D97757","clay":"#BD5D3A","mut":"#8A847A","onAcc":"#FFFFFF","font":"Cairo","handle":"","logo":"","grade":false,"capStyle":"card","grid":false,"bar":false}' > "$W/theme.json"
cp "$SK/scripts/compose.REFERENCE.html" "$W/compose.html"
ffmpeg -v error -f lavfi -i anullsrc=r=48000:cl=stereo -t 2 -y "$W/sfx.wav"
python3 "$SK/scripts/03_cut_zoom.py" "$W" | tail -2
node "$SK/scripts/04_render_frames.js" "$W" all 2>/dev/null | tail -1
bash "$SK/scripts/06_encode.sh" "$W" >/dev/null
python3 "$SK/scripts/28_cover.py" "$W" "فحص|*اللون*" --video "$W/cutz.mp4" --t 0.5 --first "$W/ad-final.mp4" --hold 0.1 >/dev/null
bash "$SK/scripts/06b_master.sh" "$W" "$W/ad-final-cover.mp4" "$W/final.mp4" >/dev/null

echo "③ المقارنة (الناتج − أبل، من 255):"
python3 - "$T" "$W" <<'EOF'
import sys, subprocess, json, numpy as np
T, W = sys.argv[1], sys.argv[2]
# فك المقارنة بأعلام الدقة — فك ffmpeg العادي نفسه يغلط درجتين
ACC = "scale=in_color_matrix=bt709:in_range=tv:flags=accurate_rnd+full_chroma_int+full_chroma_inp+bicubic,format=rgb24"
def frame(path, n):
    r = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vf", f"select=eq(n\\,{n}),{ACC}", "-frames:v", "1", "-f", "rawvideo", "-"], capture_output=True, check=True)
    return np.frombuffer(r.stdout, np.uint8).reshape(1920, 1080, 3).astype(np.float64)
ok = True
for name, path, shift in (("06_encode", W + "/ad-final.mp4", 0), ("النهائي (كفر + ماستر)", W + "/final.mp4", 3)):   # الكفر 0.1 ث = 3 فريمات قبل الفيديو
    worst = 0.0
    for k in (15, 30, 45):
        a = np.fromfile(f"{T}/apple_{k}.rgb", np.uint8).reshape(1920, 1080, 3).astype(np.float64)
        d = (frame(path, k + shift) - a).mean((0, 1)); worst = max(worst, np.abs(d).max())
        print(f"   {name} · فريم {k}:  أحمر {d[0]:+.2f} · أخضر {d[1]:+.2f} · أزرق {d[2]:+.2f}")
    tags = subprocess.run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=color_range,color_space,color_transfer,color_primaries", "-of", "json", path], capture_output=True, text=True).stdout
    tg = json.loads(tags)["streams"][0]; want = {"color_range": "tv", "color_space": "bt709", "color_transfer": "bt709", "color_primaries": "bt709"}
    tok = all(tg.get(k) == v for k, v in want.items())
    print(f"   {name}: أسوأ قناة {worst:.2f} {'✅' if worst < 1 else '❌'} · الوسوم {'bt709 كاملة ✅' if tok else '❌ ' + str(tg)}")
    ok = ok and worst < 1 and tok
print("🟢 اللون مطابق لتصوير الآيفون (فرق أقل من 1 من 255 لكل قناة)" if ok else "🔴 اللون مو مطابق — راجع VF_FRAMES/VF_ENCODE بـscripts/_compat.sh")
sys.exit(0 if ok else 1)
EOF
