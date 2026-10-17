# -*- coding: utf-8 -*-
"""تتبّع الوجه لحركات المعرض (85 فقاعة كلام · 86 كاميرا ثانية) — ماك فقط (Vision، ببلاش)
   python3 36_facetrack.py <work> <من_ثانية> <إلى_ثانية> [--sigma 5]
   - يقرا فريمات الفيديو المقصوص <work>/vfr/00001.jpg… ويشغّل facetrack.swift (نفس راصد البودكاست) على المدى بس.
   - يكتب <work>/face.js:  window.FACE={fps,from,to,sw,sh,pts:[[t,x,y,w,h],…]}  (نِسَب 0..1 من صورة vfr، منعّمة قاوسي σ=5 فريم، والفجوات مستوفاة)
   - بـcompose.html: <script src="face.js"></script> قبل مشاهدك، ثم مرّر face: MV.faceAt للحركة.
     MV.faceAt(t) يحوّلها لإحداثيات الكانفس بنفس تأطير MV.video ويرجّع {x,y,w,h,mx,my} (mx,my = الفم تقريباً) أو null برّا المدى.
   بلا face.js (مو ماك) الحركتين ترجع لمكان افتراضي."""
import sys, os, json, subprocess, shutil, tempfile
import numpy as np
SC = os.path.dirname(os.path.abspath(__file__)); FPS = 30

def main():
    pos, sig, a = [], 5.0, sys.argv[1:]
    for i, x in enumerate(a):
        if x == "--sigma": sig = float(a[i + 1])
        elif not x.startswith("--") and (i == 0 or a[i - 1] != "--sigma"): pos.append(x)
    if len(pos) < 3: print(__doc__); sys.exit(1)
    W = os.path.abspath(pos[0]); t0, t1 = float(pos[1]), float(pos[2])
    vfr = os.path.join(W, "vfr")
    if not os.path.isdir(vfr): sys.exit("❌ ما فيه vfr/ — شغّل الخطوة 6 (03_cut_zoom.py) أول")
    bt = os.path.join(W, "bt"); os.makedirs(bt, exist_ok=True); exe = os.path.join(bt, "facetrack")
    if not os.path.exists(exe):
        r = subprocess.run(["swiftc", "-O", "-o", exe, os.path.join(SC, "facetrack.swift")], capture_output=True, text=True)
        if r.returncode: sys.exit("❌ يحتاج أدوات Xcode: xcode-select --install\n" + r.stderr[-400:])
    f0, f1 = int(t0 * FPS) + 1, int(t1 * FPS) + 1
    fr = [f for f in range(f0, f1 + 1) if os.path.exists(os.path.join(vfr, f"{f:05d}.jpg"))]
    if len(fr) < 3: sys.exit("❌ المدى برّا فريمات vfr/")
    tmp = tempfile.mkdtemp(prefix="ft_")
    try:
        for f in fr: os.symlink(os.path.join(vfr, f"{f:05d}.jpg"), os.path.join(tmp, f"{f:05d}.jpg"))
        raw = os.path.join(W, "face.json")
        subprocess.run([exe, tmp, raw], check=True, capture_output=True)
    finally: shutil.rmtree(tmp, ignore_errors=True)
    rows = {int(r["f"][:5]): r.get("face") for r in json.load(open(raw))}
    from PIL import Image
    sw, shh = Image.open(os.path.join(vfr, f"{fr[0]:05d}.jpg")).size
    M = np.array([[rows[f][k] if rows.get(f) else np.nan for k in ("x", "y", "w", "h")] for f in fr], float)
    ok = ~np.isnan(M[:, 0])
    if ok.sum() < 3: sys.exit(f"❌ ما لقيت الوجه إلا بـ{int(ok.sum())} فريم")
    idx = np.arange(len(fr)); k = np.arange(-int(3 * sig), int(3 * sig) + 1); g = np.exp(-k ** 2 / (2 * sig ** 2)); g /= g.sum()
    for c in range(4):
        col = np.interp(idx, idx[ok], M[ok, c]); pad = np.concatenate([np.full(len(k) // 2, col[0]), col, np.full(len(k) // 2, col[-1])])
        M[:, c] = np.convolve(pad, g, "valid")
    pts = [[round((f - 1) / FPS, 3)] + [round(float(v), 4) for v in M[i]] for i, f in enumerate(fr)]
    open(os.path.join(W, "face.js"), "w").write("window.FACE=" + json.dumps({"fps": FPS, "from": t0, "to": t1, "sw": sw, "sh": shh, "pts": pts}) + ";\n")
    print(f"→ face.js · {len(pts)} فريم · الوجه بان بـ{100*ok.mean():.0f}٪ (الباقي مستوفى) · أضف <script src=\"face.js\"></script> ومرّر face: MV.faceAt")

if __name__ == "__main__":
    main()
