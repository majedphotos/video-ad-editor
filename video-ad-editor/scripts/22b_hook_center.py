# -*- coding: utf-8 -*-
"""مركز زوم الهوك = وجهه (بدل نقطة ثابتة) — ماك
   python3 22b_hook_center.py <work>      ← يقرا theme.hookZoom (نهاية الهوك) وفريمات vfr/، ويكتب theme.hookCenter [x,y]
   المحرّك يستخدمه تلقائياً؛ بدونه ياخذ الوجه من behind.json لو موجود، وإلا 540,760."""
import sys, os, json, subprocess, statistics, shutil, tempfile
SC = os.path.dirname(os.path.abspath(__file__))
if len(sys.argv) < 2: print(__doc__); sys.exit(1)
W = os.path.abspath(sys.argv[1]); tp = os.path.join(W, "theme.json"); th = json.load(open(tp))
end = float(th.get("hookZoom") or 2.5); vfr = os.path.join(W, "vfr")
if not os.path.isdir(vfr): sys.exit("❌ ما فيه vfr/ — بعد الخطوة 6")
ft = os.path.join(W, "bt", "facetrack"); os.makedirs(os.path.dirname(ft), exist_ok=True)
if not os.path.exists(ft) and subprocess.run(["swiftc", "-O", "-o", ft, os.path.join(SC, "facetrack.swift")]).returncode:
    sys.exit("❌ يحتاج أدوات Xcode: xcode-select --install")
tmp = tempfile.mkdtemp(); n = int((end + 0.3) * 30) + 1
for i in range(1, n + 1, 3):   # كل ثالث فريم يكفي
    src = os.path.join(vfr, f"{i:05d}.jpg")
    if os.path.exists(src): shutil.copy(src, os.path.join(tmp, f"{i:05d}.jpg"))
subprocess.run([ft, tmp, os.path.join(tmp, "f.json")], capture_output=True)
rows = json.load(open(os.path.join(tmp, "f.json"))) if os.path.exists(os.path.join(tmp, "f.json")) else []
fs = [r["face"] for r in rows if "face" in r]; shutil.rmtree(tmp, ignore_errors=True)
if len(fs) < 3: sys.exit("⚠️ ما لقيت وجه واضح بالهوك — المحرّك يبقى على 540,760")
from PIL import Image
w, h = Image.open(os.path.join(vfr, "00001.jpg")).size
def px(v, size): return v * size if v <= 1.5 else v            # facetrack يطلّع نسب (0-1) أو بكسل
cx = statistics.median(px(f["x"] + f["w"] / 2, w) for f in fs) * 1080 / w
cy = statistics.median(px(f["y"] + f["h"] / 2, h) for f in fs) * 1920 / h
th["hookCenter"] = [round(cx), round(cy)]; json.dump(th, open(tp, "w"), ensure_ascii=False, indent=1)
print(f"→ hookCenter = {th['hookCenter']} (من {len(fs)} فريم)")
