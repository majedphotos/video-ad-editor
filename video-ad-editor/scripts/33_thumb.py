# -*- coding: utf-8 -*-
"""ثمبنيل يوتيوب 16:9 — ثلاث أفكار مختلفة يختار منها (قواعد references/thumbnails.md)
   python3 33_thumb.py <work> "سطر أول|*كلمة مميزة*" [--photo me.png | --video src.mov [--t 3.2]] [--logo a.png] [--x old.png --ok new.png] [--bg "#F0EEE6"]
   - الصورة: اسأل المستخدم «آخذ صورتك من الفيديو ولا عندك صور تعطيني؟»
     --photo: صورته مقصوصة (خلفية شفافة) · بدونها: يختار أحسن فريم من الفيديو ويقصّه (_cutout.py — ماك).
   - الخلفية كريمية مثل كلود (#F0EEE6 أو bg الثيم لو فاتح) والكلام غامق — --bg يغيّرها.
   - --logo: شعار/شي من محتوى الفيديو (الفكرة B). --x/--ok: قبل/بعد (الفكرة C) — بس لو الفيديو «من كذا لكذا».
   يطلّع لكل فكرة: thumb_A.jpg (3840×2160 — الموصى من يوتيوب) + thumb_A_1280.jpg (أخف، أقل من 2 ميقا للجوال)
   + thumbs_sheet.jpg (الثلاث جنب بعض) — اعرض الورقة، وبعدها 34_phone_preview.py <الأحسن> --youtube.
   ⛔ النص العربي ≥ 120 بكسل (على 1280) · الشعار ≥ 140 · تحت يمين 310×145 فاضي (مدة الفيديو) · 5 كلمات بالكثير.
"""
import sys, os, json, subprocess, html, shutil, glob
from PIL import Image

def arg(name, default=""):
    return sys.argv[sys.argv.index(name) + 1] if name in sys.argv else default

def chrome():
    for c in ["/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", "C:/Program Files/Google/Chrome/Application/chrome.exe",
              "/usr/bin/google-chrome", "/usr/bin/chromium"]:
        if os.path.exists(c): return c
    return shutil.which("google-chrome") or shutil.which("chromium") or sys.exit("❌ ما لقيت كروم")

def uri(p): return "file://" + html.escape(os.path.abspath(p))

flags = ("--photo", "--logo", "--x", "--ok", "--bg", "--video", "--t")
pos = [a for i, a in enumerate(sys.argv[1:], 1) if not a.startswith("--") and sys.argv[i - 1] not in flags]
if len(pos) < 2: print(__doc__); sys.exit(1)
W, title = os.path.abspath(pos[0]), pos[1]
J = lambda p: p if (not p or os.path.isabs(p)) else os.path.join(W, p)
photo, logo, xlogo, oklogo = J(arg("--photo")), J(arg("--logo")), J(arg("--x")), J(arg("--ok"))
if not photo:   # بلا صورة منه: أحسن فريم من الفيديو نفسه، مقصوص
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__))); import _cutout
    video = J(arg("--video")) or _cutout.find_video(W)
    if not video or not os.path.exists(video): sys.exit("❌ الثمبنيل يحتاج --photo (صورة مقصوصة) أو --video (يقص من الفيديو)")
    photo = os.path.join(W, "thumb_cut.png")
    print(f"✂️ صورته من الفيديو: الثانية {_cutout.cutout(video, photo, float(arg('--t') or -1), cache=os.path.join(W, 'bt')):.2f}")
if not os.path.exists(photo): sys.exit(f"❌ ما لقيت {photo}")
# الثمبنيل يبي وجه كبير: نقص الصورة لين الراس والكتوف (من فوق الراس لين ~نص الجسم)
import numpy as np
_im = Image.open(photo).convert("RGBA"); _al = np.asarray(_im)[:, :, 3]
_rows = np.where(_al.max(1) > 40)[0]; _top, _hb = _rows[0], _rows[-1] - _rows[0]
_cols = np.where(_al[_top:_top + int(_hb * 0.45)].max(0) > 40)[0]
bust = os.path.join(W, "thumb_bust.png")
_bot = _top + int(_hb * 0.42)
if os.path.exists(photo + ".face.json"):   # من الفيديو: الجسم مقطوع عند حد الفريم، فنقيس من الوجه (لين الكتوف ≈ 2.8 من طوله)
    _f = json.load(open(photo + ".face.json")); _bot = min(_rows[-1], int(_f["y"] + _f["h"] * 2.8))
    _cols = np.where(_al[_top:_bot].max(0) > 40)[0]
_im.crop((max(0, _cols[0] - 40), max(0, _top - int(_hb * 0.04)), min(_im.width, _cols[-1] + 40), _bot)).save(bust)
photo = bust
th = json.load(open(os.path.join(W, "theme.json"))) if os.path.exists(os.path.join(W, "theme.json")) else {}
CREAM = "#F0EEE6"   # خلفية كلود الكريمية — قرار ماجد 3 أكتوبر
lum = lambda h: sum(int(h.lstrip("#")[i:i + 2], 16) * w for i, w in ((0, .299), (2, .587), (4, .114)))
bg = arg("--bg") or (th["bg"] if th.get("bg", "").startswith("#") and lum(th["bg"]) > 170 else CREAM)
light = lum(bg) > 150
bg2 = "#%02X%02X%02X" % tuple(int(int(bg.lstrip("#")[i:i + 2], 16) * (.9 if light else .45)) for i in (0, 2, 4))   # الأطراف أغمق شوي — مو أسود
ink = th.get("ink", "#1F1F1D") if light else "#FFFFFF"
acc = th.get("acc", "#D97757"); font = th.get("font", "Cairo")
words = len(title.replace("|", " ").replace("*", "").split())
if words > 5: print(f"⚠️ العنوان {words} كلمات — 3-5 أحسن للثمبنيل")
lines = title.split("|"); longest = max(len(l.replace("*", "")) for l in lines)
tt = html.escape(title).replace("*", "<b>", 1).replace("*", "</b>", 1).replace("|", "<br>")


def mark(ok):
    p = "M11 21 L18 28 L30 13" if ok else "M13 13 L27 27 M27 13 L13 27"
    return (f'<div class="mk" style="background:{"#2E8B57" if ok else "#D64545"}"><svg viewBox="0 0 40 40"><path d="{p}" '
            f'stroke="#fff" stroke-width="5.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>')


def page(variant):
    """A: وجه يمين ضخم + كلام يسار · B: وجه يسار + شي من الفيديو يمين + كلام فوقه · C: قبل/بعد (✕ ← ✓) والوجه بالنص."""
    # مساحة الكلام وعرضه حسب الفكرة — الحجم من طول أطول سطر (كايرو 900 ≈ 0.62 من الحجم للحرف)، وأصغر شي 120
    box_w = {"A": 640, "B": 640, "C": 1180}[variant]
    size = int(max(120, min(210, box_w / (0.62 * max(longest, 1)))))
    face = {"A": "right:0;height:700px", "B": "left:0;height:700px", "C": "left:50%;transform:translateX(-50%);height:540px"}[variant]
    text = {"A": "left:56px;top:70px;width:640px;text-align:left",
            "B": "right:56px;top:56px;width:640px;text-align:right",
            "C": "left:40px;right:40px;top:14px;text-align:center;white-space:nowrap"}[variant]
    body_t = tt
    if variant == "C":   # سطر واحد فوق الراس (سطرين كانوا يصغّرون الوجه لـ400) — الوجه 540 والراس يبدأ تحت 180 (العنوان ينتهي ≈165)
        flat = len(title.replace("|", " ").replace("*", ""))
        size = int(max(96, min(140, 1200 / (0.62 * max(flat, 1)))))
        body_t = tt.replace("<br>", " ")
    extra = ""
    if variant == "B" and logo and os.path.exists(logo):
        extra = f'<div class="obj" style="right:330px;bottom:60px"><img src="{uri(logo)}"></div>'   # يسار منطقة المدة (تحت يمين 310×145 فاضي)
    if variant == "C" and (xlogo or oklogo):
        if xlogo: extra += f'<div class="obj" style="right:60px;bottom:190px"><img src="{uri(xlogo)}">{mark(False)}</div>'
        if oklogo: extra += f'<div class="obj" style="left:60px;bottom:190px"><img src="{uri(oklogo)}">{mark(True)}</div>'
    return f"""<!doctype html><html><head><meta charset="utf-8"><style>
@import url('https://fonts.googleapis.com/css2?family={font.replace(' ', '+')}:wght@800;900&display=swap');
*{{margin:0}} html,body{{width:1280px;height:720px;overflow:hidden}}
body{{position:relative;background:radial-gradient(ellipse 75% 85% at 50% 45%,{bg} 0%,{bg2} 130%);font-family:'{font}',Cairo,sans-serif}}
.me{{position:absolute;bottom:0;{face};filter:drop-shadow(0 18px 40px rgba(0,0,0,{.22 if light else .45}))}}
.t{{position:absolute;{text};direction:rtl;font-size:{size}px;font-weight:900;line-height:1.08;color:{ink};
   text-shadow:{"0 3px 0 rgba(255,255,255,.6),0 8px 24px rgba(0,0,0,.10)" if light else "0 4px 0 rgba(0,0,0,.35),0 10px 34px rgba(0,0,0,.65)"}}}   /* بلا text-stroke: يكسّر الحروف العربية المتصلة */
.t b{{color:{acc}}}
.obj{{position:absolute;width:280px;height:170px;background:#fff;border-radius:34px;display:flex;align-items:center;justify-content:center;
     box-shadow:0 14px 34px rgba(0,0,0,{.14 if light else .35})}}
.obj img{{max-width:220px;max-height:140px}}
.mk{{position:absolute;top:-34px;right:-30px;width:90px;height:90px;border-radius:50%;border:6px solid #fff;display:flex;align-items:center;justify-content:center}}
.mk svg{{width:58px;height:58px}}
</style></head><body><img class="me" src="{uri(photo)}">{extra}<div class="t">{body_t}</div></body></html>"""


variants = ["A"] + (["B"] if logo else []) + (["C"] if (xlogo or oklogo) else [])
if len(variants) < 3 and "B" not in variants: variants.append("B")   # بلا شعار: B بس يقلب الوجه والكلام
outs = []
for v in variants:
    hp = os.path.join(W, f"thumb_{v}.html"); open(hp, "w", encoding="utf-8").write(page(v))
    png = os.path.join(W, f"thumb_{v}.png")
    subprocess.run([chrome(), "--headless=new", "--disable-gpu", "--hide-scrollbars", "--allow-file-access-from-files",
                    "--force-device-scale-factor=3", "--virtual-time-budget=5000", f"--screenshot={png}", "--window-size=1280,720",
                    "file://" + hp], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
    im = Image.open(png).convert("RGB").crop((0, 0, 3840, 2160)); os.remove(png)
    big = os.path.join(W, f"thumb_{v}.jpg"); im.save(big, quality=90)
    small = os.path.join(W, f"thumb_{v}_1280.jpg"); im.resize((1280, 720), Image.LANCZOS).save(small, quality=88)
    outs.append(small)
sheet = Image.new("RGB", (640 * len(outs) + 20 * (len(outs) - 1), 360), (24, 24, 24))
for i, p in enumerate(outs): sheet.paste(Image.open(p).resize((640, 360)), (i * 660, 0))
sheet.save(os.path.join(W, "thumbs_sheet.jpg"), quality=86)
big_mb = max(os.path.getsize(p.replace("_1280", "")) for p in outs) / 1e6
print(f"→ {len(outs)} أفكار: {', '.join(os.path.basename(p) for p in outs)} + thumbs_sheet.jpg · 4K أكبر ملف {big_mb:.1f} ميقا"
      + (" (فوق 2 ميقا — للرفع من الجوال استخدم نسخة _1280)" if big_mb > 2 else ""))
