# -*- coding: utf-8 -*-
"""تتبّع الكف: عنصر (شعار، أيقونة، كرة ضوء) يمشي مع إيده بنعومة — ماك فقط (Vision، ببلاش)
   python3 29_handtrack.py <work> <من_ثانية> <إلى_ثانية> [--hand high|left|right] [--sigma 5]
   - يقرا فريمات الفيديو المقصوص <work>/vfr/00001.jpg… (تطلع بالخطوة 6) ويكتب <work>/palm.js:
       window.PALM={fps:30,from:..,to:..,pts:[[t,x,y,c],…]}   (x,y بإحداثيات الكانفس 1080×1920)
   - التنعيم قاوسي σ=5 فريمات + سد الفجوات بالاستيفاء (معتمد 27 سبتمبر: «يمشي مع الإيد بنعومة»).
   - بـcompose.html: <script src="palm.js"></script> قبل مشاهدك، ثم palmAt(t) يرجّع {x,y,c} أو null (الدالة تحت بالتعليق)."""
import sys, os, json, subprocess
import numpy as np
SC = os.path.dirname(os.path.abspath(__file__)); FPS = 30

def arg(n, d):
    return type(d)(sys.argv[sys.argv.index(n) + 1]) if n in sys.argv else d

def main():
    pos, skip = [], False
    for a in sys.argv[1:]:
        if skip: skip = False; continue
        if a.startswith("--"): skip = True; continue
        pos.append(a)
    if len(pos) < 3: print(__doc__); sys.exit(1)
    W = os.path.abspath(pos[0]); t0, t1 = float(pos[1]), float(pos[2])
    side, sig = arg("--hand", "high"), arg("--sigma", 5.0)
    vfr = os.path.join(W, "vfr")
    if not os.path.isdir(vfr): sys.exit("❌ ما فيه vfr/ — شغّل الخطوة 6 (03_cut_zoom.py) أول")
    bt = os.path.join(W, "bt"); os.makedirs(bt, exist_ok=True); exe = os.path.join(bt, "handpose")
    if not os.path.exists(exe):
        r = subprocess.run(["swiftc", "-O", "-o", exe, os.path.join(SC, "handpose.swift")], capture_output=True, text=True)
        if r.returncode: sys.exit("❌ يحتاج أدوات Xcode: xcode-select --install\n" + r.stderr[-400:])
    f0, f1 = int(t0 * FPS) + 1, int(t1 * FPS) + 1
    raw = os.path.join(W, "hand.json")
    subprocess.run([exe, vfr, str(f0), str(f1), raw], check=True, capture_output=True)
    rows = {r["f"]: r["hands"] for r in json.load(open(raw))}
    from PIL import Image
    sw, shh = Image.open(os.path.join(vfr, f"{f0:05d}.jpg")).size; kx, ky = 1080 / sw, 1920 / shh
    fr = list(range(f0, f1 + 1)); xs, ys, cs = [], [], []; prev = None
    for f in fr:
        hs = rows.get(f, [])
        if hs:
            if side == "left": h = min(hs, key=lambda h: h["x"])
            elif side == "right": h = max(hs, key=lambda h: h["x"])
            elif prev is not None: h = min(hs, key=lambda h: (h["x"] - prev[0]) ** 2 + (h["y"] - prev[1]) ** 2)   # نفس الإيد اللي قبل
            else: h = min(hs, key=lambda h: h["y"])                                                             # الأعلى = اللي يرفعها
            prev = (h["x"], h["y"]); xs.append(h["x"] * kx); ys.append(h["y"] * ky); cs.append(h["c"])
        else: xs.append(np.nan); ys.append(np.nan); cs.append(0.0)
    xs, ys = np.array(xs), np.array(ys); ok = ~np.isnan(xs)
    if ok.sum() < 3: sys.exit(f"❌ ما لقيت الإيد إلا بـ{int(ok.sum())} فريم — تأكد إنها تبين بهالمدى")
    idx = np.arange(len(fr))
    xs = np.interp(idx, idx[ok], xs[ok]); ys = np.interp(idx, idx[ok], ys[ok])
    k = np.arange(-int(3 * sig), int(3 * sig) + 1); g = np.exp(-k ** 2 / (2 * sig ** 2)); g /= g.sum()
    pad = lambda a: np.concatenate([np.full(len(k) // 2, a[0]), a, np.full(len(k) // 2, a[-1])])
    xs = np.convolve(pad(xs), g, "valid"); ys = np.convolve(pad(ys), g, "valid")
    pts = [[round((f - 1) / FPS, 3), round(float(x), 1), round(float(y), 1), round(c, 2)] for f, x, y, c in zip(fr, xs, ys, cs)]
    open(os.path.join(W, "palm.js"), "w").write("window.PALM=" + json.dumps({"fps": FPS, "from": t0, "to": t1, "pts": pts}) + ";\n"
        "window.palmAt=function(t){const P=window.PALM;if(!P||t<P.from||t>P.to)return null;const i=Math.min(P.pts.length-1,Math.max(0,Math.round((t-P.from)*P.fps)));const p=P.pts[i];return{x:p[1],y:p[2],c:p[3]};};\n")
    print(f"→ palm.js · {len(pts)} فريم · الإيد بانت بـ{100*ok.mean():.0f}٪ (الباقي مستوفى) · أضف <script src=\"palm.js\"></script> بـcompose.html وارسم عند palmAt(t)")

if __name__ == "__main__":
    main()
