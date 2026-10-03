# -*- coding: utf-8 -*-
"""كفر الريل (v2 — 3 أكتوبر 2026) — ويتحط أول فريم بالفيديو
   python3 28_cover.py <work> "سطر أول|*سطر ثاني ملوّن*" ["سطر صغير فوقه"]
        [--photo me.png]            صورة شخص مقصوصة (خلفية شفافة) بدل فريم من الفيديو
        [--video src.mov] [--t 3.2] [--n 16]   مصدر الفريم (بدون --t يختار أوضح فريم)
        [--bg "#EE9A6E"]            لون الخلفية مع --photo (بدونه: ياخذه من خلفية الفيديو نفسه)
        [--x manychat.png]          شعار عليه ✕ (اللي تركته / الخطأ)
        [--ok zorcha.png]           شعار عليه ✓ (البديل / الصح)
        [--first ad-master.mp4]     يركّب الكفر أول فريم بالفيديو ← <الاسم>-cover.mp4
        [--hold 0.1]                مدة الكفر بأول الفيديو (ثواني)

   ⛔ قاعدة المربع الآمن (ماجد 3 أكتوبر): الريل 9:16 بس انستقرام يعرضه بالبروفايل 4:5 (وأحياناً 1:1).
      كل اللي لازم ينشاف — الوجه والكلام والشعارات — داخل مربع 1080×1080 بنص الصورة (y من 420 لين 1500).
      المربع وهمي: لا إطار ولا خط. برّاه خلفية بس (أو كمّلة الجسم).
   الكلام هوك مختصر (سطرين + سطر صغير) على الصدر أو تحته شوي.
   يطلّع: cover.jpg (1080×1920) + cover_grid.jpg (معاينة: 9:16 · 4:5 · 1:1 جنب بعض) — اعرض الثانية."""
import sys, os, json, subprocess, tempfile, html
import numpy as np
from PIL import Image

SQ0, SQ1 = 420, 1500          # المربع الآمن 1:1 بنص 9:16

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
        p = os.path.join(tmp, f"{i}.png")
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1", "-vf", "scale=270:-1", p])
        if not os.path.exists(p): continue
        a = np.asarray(Image.open(p).convert("L"), dtype=np.float32)
        lap = np.abs(a[1:-1, 1:-1] * 4 - a[:-2, 1:-1] - a[2:, 1:-1] - a[1:-1, :-2] - a[1:-1, 2:]).var()
        m = a.mean(); score = lap * (1.0 if 60 < m < 200 else 0.5)
        if score > best[0]: best = (score, t)
    return best[1]
def uri(p):
    return "file://" + html.escape(os.path.abspath(p))
def hexc(c):
    return "#%02X%02X%02X" % tuple(int(v) for v in c)

def main():
    flags = ("--video", "--t", "--n", "--photo", "--bg", "--x", "--ok", "--first", "--hold")
    pos = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i - 1] not in flags]
    if len(pos) < 2: print(__doc__); sys.exit(1)
    W, title = os.path.abspath(pos[0]), pos[1]; eyebrow = pos[2] if len(pos) > 2 else ""
    J = lambda p: p if (not p or os.path.isabs(p)) else os.path.join(W, p)
    photo, xlogo, oklogo, first = J(arg("--photo", "")), J(arg("--x", "")), J(arg("--ok", "")), J(arg("--first", ""))
    video = arg("--video", "")
    if not video:
        for c in ["src_sdr.mov", "src_fixed.mov", "src.mov", "src.mp4", "ad-master.mp4", "ad-final.mp4"]:   # المصدر أول: النسخة النهائية فيها كابشن محروق
            if os.path.exists(os.path.join(W, c)): video = os.path.join(W, c); break
    video = J(video)
    th = json.load(open(os.path.join(W, "theme.json"))) if os.path.exists(os.path.join(W, "theme.json")) else {}
    bg, ink, acc = th.get("bg", "#111111"), th.get("ink", "#FFFFFF"), th.get("acc", "#F2B33D")
    on = th.get("onAcc", "#FFFFFF"); font = th.get("font", "Tajawal"); handle = th.get("handle", "")

    frame = os.path.join(W, "cover_frame.png"); t = -1.0
    if video and os.path.exists(video):
        t = arg("--t", -1.0); t = t if t >= 0 else pick(video, arg("--n", 16))
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", f"{t:.2f}", "-i", video, "-frames:v", "1",
                        "-vf", "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920", frame], check=True)
    elif not photo:
        sys.exit("❌ ما لقيت الفيديو — اعطه --video أو --photo")

    if photo:
        # الخلفية من لون خلفية الفيديو نفسه (فوق الراس + الجوانب) — أو --bg
        c_in, c_out = arg("--bg", ""), ""
        if not c_in and os.path.exists(frame):
            a = np.asarray(Image.open(frame).convert("RGB"), dtype=np.float32)
            top = a[60:260, 300:780].reshape(-1, 3).mean(0); side = a[700:1100, 0:110].reshape(-1, 3).mean(0)
            lo, hi = (top, side) if top.mean() < side.mean() else (side, top)
            c_in, c_out = hexc(np.minimum(hi * 1.08, 255)), hexc(lo * 0.92)
        c_in = c_in or "#EE9A6E"; c_out = c_out or c_in
        im = Image.open(photo).convert("RGBA"); al = np.asarray(im)[:, :, 3]
        rows = np.where(al.max(1) > 40)[0]; top_y, bot_y = rows[0], rows[-1]; hb = bot_y - top_y
        band = al[top_y:top_y + int(hb * 0.12)]; cols = np.where(band.max(0) > 40)[0]; cx = (cols[0] + cols[-1]) / 2
        s = (1920 - (SQ0 + 30)) / (0.62 * hb)            # الراس عند أول المربع، والجسم لين الورك يعبي تحت
        pw, ph = im.width * s, im.height * s
        px, py = 540 - cx * s, (SQ0 + 30) - top_y * s
        visual = (f'<div class="bgc"></div><img class="me" src="{uri(photo)}" style="left:{px:.0f}px;top:{py:.0f}px;width:{pw:.0f}px;height:{ph:.0f}px">'
                  f'<div class="sh2"></div>')
        bgcss = f".bgc{{position:absolute;inset:0;background:radial-gradient(ellipse 80% 58% at 50% 50%,{c_in} 0%,{c_out} 100%)}}"
    else:
        visual = f'<img class="fr" src="{uri(frame)}"><div class="sh"></div>'; bgcss = ""

    def badge(path, ok):
        if not path or not os.path.exists(path): return ""
        mark = ('<svg viewBox="0 0 40 40"><path d="M11 21 L18 28 L30 13" stroke="#fff" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' if ok else
                '<svg viewBox="0 0 40 40"><path d="M13 13 L27 27 M27 13 L13 27" stroke="#fff" stroke-width="5.5" stroke-linecap="round"/></svg>')
        return (f'<div class="lg {"ok" if ok else "no"}"><img src="{uri(path)}"><div class="mk" style="background:{"#2E8B57" if ok else "#D64545"}">{mark}</div></div>')
    logos = badge(xlogo, False) + badge(oklogo, True)
    tt = html.escape(title).replace('*', '<b>', 1).replace('*', '</b>', 1).replace('|', '<br>')
    longest = max(len(x.replace('*', '')) for x in title.split('|'))
    size = 120 if longest <= 13 else 104 if longest <= 17 else 88 if longest <= 22 else 74
    page = f"""<!doctype html><html dir="ltr"><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family={font.replace(' ', '+')}:wght@700;800;900&display=swap');
*{{margin:0}} html{{overflow:hidden}} body{{width:1080px;height:1920px;position:relative;overflow:hidden;direction:ltr;font-family:'{font}',Tajawal,'Geeza Pro',sans-serif;background:#000}}
{bgcss}
.fr{{position:absolute;inset:0;width:1080px;height:1920px;object-fit:cover}}
.me{{position:absolute}}
.sh{{position:absolute;left:0;right:0;top:{SQ0+560}px;bottom:0;background:linear-gradient(180deg,transparent,rgba(0,0,0,.55) 40%,rgba(0,0,0,.7))}}
.sh2{{position:absolute;left:0;right:0;top:{SQ0+620}px;bottom:0;background:linear-gradient(180deg,transparent,rgba(0,0,0,.28) 45%,rgba(0,0,0,.35))}}
.box{{position:absolute;left:60px;right:60px;top:{SQ0}px;height:{SQ1-SQ0-24}px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:16px;text-align:center;direction:rtl}}
.eb{{font-size:44px;font-weight:800;color:{on};background:{acc};padding:4px 30px 10px;border-radius:20px;box-shadow:0 10px 30px rgba(0,0,0,.25)}}
.t{{font-size:{size}px;font-weight:900;line-height:1.1;color:#fff;text-shadow:0 6px 26px rgba(0,0,0,.5)}}
.t b{{color:{acc};filter:brightness(1.25)}}
.lg{{position:absolute;top:{SQ0+60}px;width:250px;height:96px;background:#fff;border-radius:26px;display:flex;align-items:center;justify-content:center;box-shadow:0 12px 30px rgba(0,0,0,.25)}}
.lg img{{max-width:190px;max-height:56px}} .lg.no{{right:50px;transform:rotate(4deg)}} .lg.ok{{left:50px;transform:rotate(-4deg)}}
.lg.no img{{opacity:.55}}
.mk{{position:absolute;top:-24px;width:58px;height:58px;border-radius:50%;border:4px solid #fff;display:flex;align-items:center;justify-content:center}}
.lg.no .mk{{left:-22px}} .lg.ok .mk{{right:-22px}} .mk svg{{width:38px;height:38px}}
.h{{position:absolute;top:{SQ1+40}px;left:0;right:0;text-align:center;font:700 32px sans-serif;color:#fff;opacity:.8;direction:ltr}}
</style></head><body>{visual}{logos}
<div class="box">{f'<div class="eb">{html.escape(eyebrow)}</div>' if eyebrow else ''}<div class="t">{tt}</div></div>
{f'<div class="h">{html.escape(handle)}</div>' if handle else ''}</body></html>"""
    hp = os.path.join(W, "cover.html"); open(hp, "w", encoding="utf-8").write(page)
    png = os.path.join(W, "cover.png")
    subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    "--virtual-time-budget=5000", f"--screenshot={png}", "--window-size=1080,1920", "file://" + hp], capture_output=True)
    im = Image.open(png).convert("RGB").crop((0, 0, 1080, 1920)); os.remove(png)
    cj = os.path.join(W, "cover.jpg"); im.save(cj, quality=92)
    # معاينة: الكامل · قصّة 4:5 · قصّة 1:1 — بنفس الارتفاع
    g45 = im.crop((0, 285, 1080, 1635)); g11 = im.crop((0, SQ0, 1080, SQ1)); H = 720
    parts = [im.resize((405, H)), g45.resize((576, H)), g11.resize((H, H))]
    sheet = Image.new("RGB", (sum(p.width for p in parts) + 40, H), (24, 24, 24)); x = 0
    for p in parts: sheet.paste(p, (x, 0)); x += p.width + 20
    sheet.save(os.path.join(W, "cover_grid.jpg"), quality=85)
    msg = f"→ cover.jpg + cover_grid.jpg (9:16 · 4:5 · 1:1) — اعرض cover_grid.jpg عليه"
    if first and os.path.exists(first):
        hold = arg("--hold", 0.1); out = os.path.splitext(first)[0] + "-cover.mp4"
        has_a = bool(subprocess.run(["ffprobe", "-v", "error", "-select_streams", "a", "-show_entries", "stream=index", "-of", "csv=p=0", first], capture_output=True, text=True).stdout.strip())
        fc = "[1:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[c];[0:v]scale=1080:1920,setsar=1,fps=30,format=yuv420p[v];"
        if has_a:
            fc += "[2:a]aresample=48000[s];[0:a]aresample=48000[a];[c][s][v][a]concat=n=2:v=1:a=1[ov][oa]"; maps = ["-map", "[ov]", "-map", "[oa]", "-c:a", "aac", "-b:a", "192k"]
        else:
            fc += "[c][v]concat=n=2:v=1:a=0[ov]"; maps = ["-map", "[ov]"]
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", first, "-loop", "1", "-t", f"{hold}", "-framerate", "30", "-i", cj,
                        "-f", "lavfi", "-t", f"{hold}", "-i", "anullsrc=r=48000:cl=stereo", "-filter_complex", fc, *maps,
                        "-c:v", "libx264", "-crf", "18", "-preset", "medium", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out], check=True)
        msg += f" · والكفر صار أول فريم ← {os.path.basename(out)}"
    print(msg + (f" · تيك توك: الثانية {t:.2f}" if t >= 0 and not photo else ""))

if __name__ == "__main__":
    main()
