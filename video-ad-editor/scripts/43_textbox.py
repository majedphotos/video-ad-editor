# -*- coding: utf-8 -*-
"""مربع بالضبط على المعلومة (6.5 — ملاحظة ماجد: «المربع ينرسم مضبوط على الشي اللي عليه المعلومة»)
   يقرأ الكتابة اللي على المنتج نفسه (ملصق، شاشة، رقم مطبوع) بكل فريم بأداة القراءة بالماك (Vision)،
   ويطلّع زوايا الكلمة نفسها — مايلة مع المنتج — ويلحقها لما يتحرك بإيدك. الفريم اللي ما انقرى (غبش حركة)
   يكمّله بالتتبّع البصري من أقرب فريم انقرى. المربع ما ينرسم بالعين أبداً.

   python3 43_textbox.py <work> <اسم> <من ث> <إلى ث> "<النص>"            مثال: "13.8W" أو "90Wh"
   python3 43_textbox.py <work> <اسم> <من> <إلى> "re:/(.{3,5})$"            القراءة تغلط بالحرف؟ (90Wh ← sawh) حدّد مكانه بتعبير
   python3 43_textbox.py <work> <اسم> <من> <إلى> "<النص>" --pick 1         لو النص مكرر بالفريم: 1 = الأقرب لفوق، 2 = الثاني…
   الناتج: tb.js (window.TB) + tb_<اسم>.jpg للفحص (3 فريمات والمربع عليها).
   بمشهدك: DEPTH.box({s, e, quad: t => TB.at('<اسم>', t), pad: 10})  — أو TB.at للنقطة/الزوايا بأي رسم.
   ماك فقط (Vision + swiftc)."""
import os, sys, json, subprocess, shutil, tempfile
import numpy as np

if len(sys.argv) < 6: print(__doc__); sys.exit(1)
W = os.path.abspath(sys.argv[1]); NAME = sys.argv[2]; t0, t1 = float(sys.argv[3]), float(sys.argv[4]); Q = sys.argv[5]
PICK = int(sys.argv[sys.argv.index("--pick") + 1]) if "--pick" in sys.argv else 0
SC = os.path.dirname(os.path.abspath(__file__)); FPS = 30
# أداة القراءة بالماك (Vision) — تنكتب وتنبني بمجلد الشغل أول مرة
SWIFT = r"""// يلقى نص مكتوب بالفريم (ملصق، شاشة، رقم على المنتج) ويطلّع مربعه بالضبط — Vision المدمج بالماك
// textfind <inDir> <query|re:regex|*> [fast|accurate]
//   query: النص المطلوب (بلا فرق حروف كبيرة/صغيرة ومسافات) — يطلّع مربع النص نفسه بس (مو السطر كله)
//   * = كل النصوص بالفريم (للاستكشاف)
// المخرج JSON لكل فريم: [{f, hits:[{t, c, q:[[x,y]x4]}]}] — q بالبكسل، الأصل فوق يسار، الترتيب: فوق يسار ← فوق يمين ← تحت يمين ← تحت يسار
import Foundation
import Vision
import CoreImage

let a = CommandLine.arguments
guard a.count >= 3 else { print("usage: textfind <inDir> <query|*> [fast|accurate]"); exit(2) }
let inDir = a[1], query = a[2], fast = a.count > 3 && a[3] == "fast"
let norm: (String) -> String = { s in
    s.lowercased().replacingOccurrences(of: " ", with: "")
}
let q = norm(query)
let files = (try FileManager.default.contentsOfDirectory(atPath: inDir)).filter { $0.hasSuffix(".jpg") || $0.hasSuffix(".png") }.sorted()
var out: [[String: Any]] = []
for f in files {
    guard let img = CIImage(contentsOf: URL(fileURLWithPath: inDir + "/" + f)) else { FileHandle.standardError.write("⚠️ ما انقرى \(f)\n".data(using: .utf8)!); continue }
    let W = img.extent.width, H = img.extent.height
    let req = VNRecognizeTextRequest()
    req.recognitionLevel = fast ? .fast : .accurate
    req.usesLanguageCorrection = false
    req.minimumTextHeight = 0.008
    if ProcessInfo.processInfo.environment["TF_CPU"] == "1" { req.usesCPUOnly = true }
    let h = VNImageRequestHandler(ciImage: img, options: [:])
    do { try h.perform([req]) } catch { FileHandle.standardError.write("⚠️ \(f): \(error)\n".data(using: .utf8)!); continue }
    var hits: [[String: Any]] = []
    for obs in (req.results ?? []) {
        for cand in obs.topCandidates(3) {
            let s = cand.string
            var rng: Range<String.Index>? = nil
            if q == "*" { rng = s.startIndex..<s.endIndex }
            else if query.hasPrefix("re:") {          // re:<تعبير> — الكلمة اللي يقرأها غلط (90Wh ← sawh): مكانها من اللي حولها
                let pat = String(query.dropFirst(3))
                if let re = try? NSRegularExpression(pattern: pat, options: [.caseInsensitive]),
                   let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) {
                    let nr = m.numberOfRanges > 1 && m.range(at: 1).location != NSNotFound ? m.range(at: 1) : m.range
                    rng = Range(nr, in: s)
                }
            }
            else {
                // نطابق بلا مسافات: نلقى مكان أول حرف وآخر حرف بالنص الأصلي
                let chars = Array(s); var map: [Int] = []; var flat = ""
                for (i, ch) in chars.enumerated() where ch != " " { flat += String(ch).lowercased(); map.append(i) }
                if let r = flat.range(of: q) {
                    let i0 = flat.distance(from: flat.startIndex, to: r.lowerBound)
                    let i1 = flat.distance(from: flat.startIndex, to: r.upperBound) - 1
                    let a0 = s.index(s.startIndex, offsetBy: map[i0]), a1 = s.index(s.startIndex, offsetBy: map[i1] + 1)
                    rng = a0..<a1
                }
            }
            guard let r = rng, let box = try? cand.boundingBox(for: r) else { continue }
            let P: (CGPoint) -> [Double] = { p in [Double(p.x * W), Double((1 - p.y) * H)] }
            // Vision أحياناً يرجّع مربع السطر كله للجزء — نرجّع السطر ومكان الجزء فيه (a,b بالحروف) و43_textbox.py يقصّه بالنسبة
            let lb = (try? cand.boundingBox(for: s.startIndex..<s.endIndex)) ?? box
            hits.append(["t": String(s[r]), "c": Double(cand.confidence), "line": s,
                         "a": s.distance(from: s.startIndex, to: r.lowerBound), "b": s.distance(from: s.startIndex, to: r.upperBound),
                         "q": [P(box.topLeft), P(box.topRight), P(box.bottomRight), P(box.bottomLeft)],
                         "lq": [P(lb.topLeft), P(lb.topRight), P(lb.bottomRight), P(lb.bottomLeft)]])
            break
        }
    }
    out.append(["f": f, "hits": hits])
}
let d = try JSONSerialization.data(withJSONObject: out, options: [])
FileHandle.standardOutput.write(d)
"""
f0, f1 = int(round(t0 * FPS)) + 1, int(round(t1 * FPS)) + 1
ids = [i for i in range(f0, f1 + 1) if os.path.exists(os.path.join(W, "vfr", f"{i:05d}.jpg"))]
if not ids: sys.exit("❌ ما فيه فريمات بـvfr لهالمدى")

BIN = os.path.join(W, "bt", "textfind"); os.makedirs(os.path.dirname(BIN), exist_ok=True)
SWP = BIN + ".swift"
if not os.path.exists(SWP) or open(SWP, encoding="utf-8").read() != SWIFT:
    open(SWP, "w", encoding="utf-8").write(SWIFT)
    if os.path.exists(BIN): os.remove(BIN)
if not os.path.exists(BIN):
    if not shutil.which("swiftc"): sys.exit("❌ يحتاج ماك + أدوات Xcode (xcode-select --install)")
    subprocess.run(["swiftc", "-O", "-o", BIN, SWP], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
tmp = tempfile.mkdtemp()
for i in ids: os.symlink(os.path.join(W, "vfr", f"{i:05d}.jpg"), os.path.join(tmp, f"{i:05d}.jpg"))
r = subprocess.run([BIN, tmp, Q], capture_output=True, text=True)
shutil.rmtree(tmp, ignore_errors=True)
try: res = json.loads(r.stdout or "[]")
except Exception: res = []
if not res and "nilError" in (r.stderr or ""):
    sys.exit("❌ أداة القراءة بالماك ما اشتغلت (nilError) — غالباً المحرّك العصبي مشغول بتجميع موديل ثاني. انتظر شوي وأعد.")

NARROW = set(".,:;/|!'il1 ")
def sub_quad(h):
    """الجزء المطلوب من السطر: لو Vision رجّع مربع السطر كله، نقصّه بنسبة عرض الحروف (الضيقة ./1 بنص عرض)"""
    lq = np.array(h["lq"], float); q = np.array(h["q"], float); line = h.get("line", ""); a, b = h.get("a", 0), h.get("b", len(line))
    if not line or (a == 0 and b >= len(line)): return q
    if np.abs(q - lq).max() > 3: return q          # Vision عطى مربع الجزء نفسه — أدق
    wts = [0.5 if c in NARROW else 1.0 for c in line]; tot = sum(wts) or 1
    u0, u1 = sum(wts[:a]) / tot, sum(wts[:b]) / tot
    top = lambda u: lq[0] + (lq[1] - lq[0]) * u; bot = lambda u: lq[3] + (lq[2] - lq[3]) * u
    return np.array([top(u0), top(u1), bot(u1), bot(u0)])

det = {}
for row in res:
    hs = row.get("hits", [])
    if not hs: continue
    hs.sort(key=lambda h: (np.mean([p[1] for p in h["q"]]), np.mean([p[0] for p in h["q"]])))
    h = hs[min(len(hs) - 1, PICK - 1)] if PICK else max(hs, key=lambda h: h["c"])
    det[int(row["f"][:5])] = sub_quad(h)
print(f"انقرت الكتابة بـ{len(det)} من {len(ids)} فريم")
if not det: sys.exit("❌ ما لقيت النص بأي فريم — جرّب جزء أقصر منه أو re:")

# التتبّع للفريمات اللي ما انقرت: نقاط مميزة حول الكتابة (المنتج نفسه) + تدفق بصري + هوموقرافي
import cv2
G = {i: cv2.imread(os.path.join(W, "vfr", f"{i:05d}.jpg"), cv2.IMREAD_GRAYSCALE) for i in ids}
LK = dict(winSize=(25, 25), maxLevel=4, criteria=(cv2.TERM_CRITERIA_EPS | cv2.TERM_CRITERIA_COUNT, 40, 0.01))
def region(q, k=2.2):
    c = q.mean(0); return (c + (q - c) * k).astype(np.int32)
def propagate(src, dst):
    a, b = G[src], G[dst]; q = det_all[src]; m = np.zeros_like(a); cv2.fillPoly(m, [region(q)], 255)
    p = cv2.goodFeaturesToTrack(a, 300, 0.004, 4, mask=m, blockSize=7)
    if p is None or len(p) < 8: return q
    p2, st, _ = cv2.calcOpticalFlowPyrLK(a, b, p, None, **LK)
    ok = st.ravel() == 1
    if ok.sum() < 8: return q
    M, _ = cv2.findHomography(p[ok], p2[ok], cv2.RANSAC, 2.0)
    if M is None: return q
    return cv2.perspectiveTransform(q.reshape(-1, 1, 2).astype(np.float32), M).reshape(-1, 2)
det_all = dict(det)
order = sorted(ids)
for d in (1, -1):   # من كل فريم مقروء نمشي للأمام والخلف لين نوصل فريم مقروء
    seq = order if d == 1 else order[::-1]
    last = None
    for i in seq:
        if i in det: last = i; continue
        if last is not None and i not in det_all:
            det_all[i] = propagate(last, i); last = i
Qs = np.array([det_all[i] for i in order], float)                # n×4×2
# تنعيم خفيف (σ=1 فريم): يشيل رجّة القراءة ±2px بلا ما يتأخر عن الحركة
r = 3; k = np.exp(-0.5 * (np.arange(-r, r + 1) / 1.0) ** 2); k /= k.sum()
pad = np.pad(Qs, ((r, r), (0, 0), (0, 0)), mode="edge")
Qs = np.stack([np.stack([np.convolve(pad[:, c, j], k, mode="valid") for j in range(2)], -1) for c in range(4)], 1)

tbp = os.path.join(W, "tb.js"); D = {}
if os.path.exists(tbp):
    try: D = json.loads(open(tbp, encoding="utf-8").read().split("window.TB_DATA=", 1)[1].split(";\n", 1)[0])
    except Exception: D = {}
D[NAME] = {"f0": order[0], "f1": order[-1], "q": [[round(float(v), 1) for v in q.ravel()] for q in Qs], "text": Q}
js = ("/* 43_textbox.py — مربعات الكتابة على المنتج (فريم بفريم). TB.at(اسم, ثانية) = [[x,y]×4] فوق يسار ← فوق يمين ← تحت يمين ← تحت يسار */\n"
      "window.TB_DATA=" + json.dumps(D, ensure_ascii=False) + ";\n"
      "window.TB={at:function(n,t){var d=window.TB_DATA[n];if(!d)return null;var f=Math.round(t*30)+1;if(f<d.f0||f>d.f1)return null;"
      "var q=d.q[f-d.f0];return [[q[0],q[1]],[q[2],q[3]],[q[4],q[5]],[q[6],q[7]]];},has:function(n,t){return !!this.at(n,t);}};\n")
open(tbp, "w", encoding="utf-8").write(js)

from PIL import Image, ImageDraw
pick3 = [order[0], order[len(order) // 2], order[-1]]; tiles = []
for i in pick3:
    im = Image.open(os.path.join(W, "vfr", f"{i:05d}.jpg")).convert("RGB"); dr = ImageDraw.Draw(im)
    q = Qs[order.index(i)]; dr.polygon([tuple(p) for p in q], outline=(0, 255, 120), width=3)
    c = q.mean(0); s = max(220, float(np.ptp(q[:, 0])) * 2.2)
    tiles.append(im.crop((int(c[0] - s), int(c[1] - s * 0.75), int(c[0] + s), int(c[1] + s * 0.75))).resize((540, 405)))
sheet = Image.new("RGB", (540 * 3 + 20, 405), (255, 255, 255))
for k2, t in enumerate(tiles): sheet.paste(t, (k2 * 550, 0))
sheet.save(os.path.join(W, f"tb_{NAME}.jpg"), quality=90)
print(f"✅ tb.js ← «{NAME}» فريمات {order[0]}–{order[-1]} (مقروءة {len(det)}، متتبّعة {len(order)-len(det)}) · فحص: tb_{NAME}.jpg")
