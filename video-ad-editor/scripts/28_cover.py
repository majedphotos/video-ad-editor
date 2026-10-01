# -*- coding: utf-8 -*-
"""كفر الريل (الغلاف اللي يطلع بالبروفايل) من فريم بالفيديو + عنوان بألوان الثيم
   python3 28_cover.py <work> "العنوان" ["سطر صغير فوقه"] [--video ad-master.mp4] [--t 3.2] [--n 16]
   - بدون --t: يختار أوضح فريم من --n فريم (حدّة الصورة + سطوع معقول، ويتجنب أول وآخر ثانية).
   - العنوان داخل منطقة شبكة انستقرام (الوسط 3:4 = y من 240 لين 1680) — الكفر يبين صح بالبروفايل.
   - يطلّع <work>/cover.jpg (1080×1920) + <work>/cover_grid.jpg (القصّة اللي تبين بالبروفايل) — اعرض الثانية عليه.
   - المنصات: انستقرام ياخذ صورة غلاف للريل؛ تيك توك يختار فريم من الفيديو (اعطه --t نفسه)."""
import sys, os, json, glob, subprocess, shutil, tempfile, html
import numpy as np
from PIL import Image

def arg(n, d):
    return type(d)(sys.argv[sys.argv.index(n) + 1]) if n in sys.argv else d
def chrome():
    for p in [os.environ.get("CHROME", ""), "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
              "C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"]:
        if p and os.path.exists(p): return p
    sys.exit("❌ ما لقيت كروم")
def dur(f):
    return float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout)

def pick(video, n):
    d = dur(video); tmp = tempfile.mkdtemp(); best = (-1, 1.0)
    for i in range(n):
        t = 1.0 + (d - 2.0) * i / max(1, n - 1)
        f = os.path.join(tmp, f"{i}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-vf", "scale=270:-2,format=gray", f])
        if not os.path.exists(f): continue
        a = np.asarray(Image.open(f), dtype=np.float32)
        lap = np.abs(a[1:-1, 1:-1] * 4 - a[:-2, 1:-1] - a[2:, 1:-1] - a[1:-1, :-2] - a[1:-1, 2:]).var()   # حدّة
        m = a.mean(); score = lap * (1.0 if 60 < m < 200 else 0.5)
        if score > best[0]: best = (score, t)
    shutil.rmtree(tmp, ignore_errors=True)
    return best[1]

def main():
    pos = [a for a in sys.argv[1:] if not a.startswith("--")]
    pos = [a for i, a in enumerate(pos) if not (i > 0 and sys.argv[sys.argv.index(a) - 1] in ("--video", "--t", "--n"))]
    if len(pos) < 2: print(__doc__); sys.exit(1)
    W, title = os.path.abspath(pos[0]), pos[1]; eyebrow = pos[2] if len(pos) > 2 else ""
    video = arg("--video", "")
    if not video:
        for c in ["src_sdr.mov", "src_fixed.mov", "src.mov", "src.mp4", "ad-master.mp4", "ad-final.mp4"]:   # المصدر أول: النسخة النهائية فيها كابشن محروق
            if os.path.exists(os.path.join(W, c)): video = os.path.join(W, c); break
    video = video if os.path.isabs(video) else os.path.join(W, video)
    if not os.path.exists(video): sys.exit("❌ ما لقيت الفيديو — اعطه --video")
    t = arg("--t", -1.0); t = t if t >= 0 else pick(video, arg("--n", 16))
    frame = os.path.join(W, "cover_frame.png")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1",
                    "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", frame], check=True)
    th = json.load(open(os.path.join(W, "theme.json"))) if os.path.exists(os.path.join(W, "theme.json")) else {}
    bg, ink, acc = th.get("bg", "#111111"), th.get("ink", "#FFFFFF"), th.get("acc", "#F2B33D")
    on = th.get("onAcc", bg); font = th.get("font", "Tajawal"); handle = th.get("handle", "")
    size = 118 if len(title) <= 18 else 96 if len(title) <= 30 else 80
    page = f"""<!doctype html><html dir="rtl"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family={font.replace(' ', '+')}:wght@700;800;900&display=swap');
*{{margin:0}} body{{width:1080px;height:1920px;position:relative;overflow:hidden;font-family:'{font}',Tajawal,'Geeza Pro',sans-serif;background:#000}}
img{{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover}}
.sh{{position:absolute;left:0;right:0;top:980px;bottom:0;background:linear-gradient(180deg,transparent,{bg}E6 46%,{bg})}}
.box{{position:absolute;left:70px;right:70px;top:1180px;height:470px;display:flex;flex-direction:column;justify-content:flex-end;align-items:flex-start;gap:22px}}
.eb{{font-size:44px;font-weight:800;color:{on};background:{acc};padding:6px 26px;border-radius:14px}}
.t{{font-size:{size}px;font-weight:900;line-height:1.18;color:{ink};text-shadow:0 6px 30px rgba(0,0,0,.35)}}
.t b{{color:{acc}}} .h{{position:absolute;bottom:140px;left:0;right:0;text-align:center;font:600 30px sans-serif;color:{ink};opacity:.7;direction:ltr}}
</style></head><body><img src="file://{html.escape(frame)}"><div class="sh"></div>
<div class="box">{f'<div class="eb">{html.escape(eyebrow)}</div>' if eyebrow else ''}<div class="t">{html.escape(title).replace('*', '<b>', 1).replace('*', '</b>', 1)}</div></div>
{f'<div class="h">{html.escape(handle)}</div>' if handle else ''}</body></html>"""
    hp = os.path.join(W, "cover.html"); open(hp, "w", encoding="utf-8").write(page)
    png = os.path.join(W, "cover.png")
    subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    "--virtual-time-budget=4000", f"--screenshot={png}", "--window-size=1080,1920", "file://" + hp], capture_output=True)
    im = Image.open(png).convert("RGB").crop((0, 0, 1080, 1920))
    im.save(os.path.join(W, "cover.jpg"), quality=92)
    im.crop((0, 240, 1080, 1680)).resize((540, 720)).save(os.path.join(W, "cover_grid.jpg"), quality=85)
    os.remove(png)
    print(f"→ cover.jpg (فريم {t:.2f} ث) + cover_grid.jpg (قصّة البروفايل) — اعرض cover_grid.jpg عليه. تيك توك: نفس الثانية {t:.2f}")

if __name__ == "__main__":
    main()
