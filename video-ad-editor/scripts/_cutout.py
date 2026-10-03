# -*- coding: utf-8 -*-
"""صورة الشخص من الفيديو نفسه — يختار أحسن فريم (وجه كبير + واضح) ويقصّه بخلفية شفافة.
   يستخدمه 28_cover.py (--cut) و33_thumb.py (--video). القص بـpersonmask.swift (Vision المدمج بالماك).
   python3 _cutout.py <video> <out.png> [--t 3.2] [--n 12]"""
import os, sys, json, shutil, subprocess, tempfile
import numpy as np
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SOURCES = ["src_sdr.mov", "src_fixed.mov", "src.mov", "src.mp4", "ad-master.mp4", "ad-final.mp4"]   # المصدر أول: النهائي فيه كابشن محروق


def find_video(W):
    for c in SOURCES:
        if os.path.exists(os.path.join(W, c)): return os.path.join(W, c)
    return ""


def _dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f],
                                capture_output=True, text=True).stdout or 0)


def _bin(cache):
    b = os.path.join(cache, "personmask")
    if not os.path.exists(b):
        if not shutil.which("swiftc"):
            sys.exit("❌ قص الشخص من الفيديو يشتغل على الماك بس — على غيره أعطني --photo (صورة مقصوصة بخلفية شفافة)")
        os.makedirs(cache, exist_ok=True)
        subprocess.run(["swiftc", "-O", "-o", b, os.path.join(HERE, "personmask.swift")], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return b


def cutout(video, out, t=-1.0, n=12, cache=None):
    """يطلّع out (PNG شفاف مقصوص على حدود الشخص) ويرجّع الثانية اللي انأخذ منها."""
    tmp = tempfile.mkdtemp(); fr, mk = os.path.join(tmp, "f"), os.path.join(tmp, "m"); os.makedirs(fr)
    d = _dur(video)
    times = [t] if t >= 0 else [1.0 + (d - 2.0) * i / max(1, n - 1) for i in range(n)]
    for i, x in enumerate(times):
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{max(0, x):.2f}", "-i", video, "-frames:v", "1", "-q:v", "2",
                        os.path.join(fr, f"{i:03d}.jpg")])
    subprocess.run([_bin(cache or os.path.join(tmp, "bt")), fr, mk, "accurate", "1.5"],
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=True)
    meta = json.load(open(os.path.join(mk, "meta.json")))
    best = None
    for r in meta:
        if "face" not in r: continue
        a = np.asarray(Image.open(os.path.join(fr, r["f"])).convert("L").resize((270, 480)), dtype=np.float32)
        sharp = np.abs(a[1:-1, 1:-1] * 4 - a[:-2, 1:-1] - a[2:, 1:-1] - a[1:-1, :-2] - a[1:-1, 2:]).var()
        score = r["face"]["w"] * np.sqrt(sharp)            # وجه كبير وواضح (مو مهزوز وسط حركة)
        if not best or score > best[0]: best = (score, r["f"])
    if not best: sys.exit("❌ ما لقيت وجه بالفيديو — أعطني --photo أو --t لثانية يبين فيها الوجه")
    f = best[1]; i = int(f.split(".")[0])
    im = Image.open(os.path.join(fr, f)).convert("RGB")
    m = Image.open(os.path.join(mk, f.replace(".jpg", ".png"))).convert("L").resize(im.size)
    rgba = im.convert("RGBA"); rgba.putalpha(m)
    al = np.asarray(m); rows, cols = np.where(al.max(1) > 40)[0], np.where(al.max(0) > 40)[0]
    rgba.crop((cols[0], rows[0], cols[-1] + 1, rows[-1] + 1)).save(out)
    fc = next(r["face"] for r in meta if r["f"] == f)   # مكان الوجه بالصورة المقصوصة — الثمبنيل يقص الراس والكتوف منه
    json.dump({"x": fc["x"] - cols[0], "y": fc["y"] - rows[0], "w": fc["w"], "h": fc["h"]}, open(out + ".face.json", "w"))
    shutil.rmtree(tmp, ignore_errors=True)
    return times[i]


if __name__ == "__main__":
    a = sys.argv
    if len(a) < 3: print(__doc__); sys.exit(1)
    t = float(a[a.index("--t") + 1]) if "--t" in a else -1.0
    n = int(a[a.index("--n") + 1]) if "--n" in a else 12
    print(f"→ {a[2]} (الثانية {cutout(a[1], a[2], t, n):.2f})")
