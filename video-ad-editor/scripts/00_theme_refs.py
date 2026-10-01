# -*- coding: utf-8 -*-
"""ثيم من صور مرجعية (بنترست · لقطات شاشة · صور تصوّرها) → <work>/theme.json
   python3 00_theme_refs.py <work> صورة1 [صورة2 …] [--force] [--light|--dark]
   - يجمع ألوان كل الصور، يختار خلفية ونص وتمييز بتباين مقروء (4.5+ للنص، 3+ للتمييز)،
     ويرسم <work>/refs_palette.jpg (الصور + الألوان المختارة) — اقرأها بعينك قبل ما تكمّل.
   - ما يلمس theme.json موجود إلا بـ--force (قاعدة: لا تغيّر ثيم سابق بلا طلبه).
   - الألوان بس من الصور؛ الخط وستايل الكابشن قرارك أنت من شكل الصور (شوف SKILL.md الخطوة 1)."""
import sys, os, json, colorsys
import numpy as np
from PIL import Image, ImageDraw

def hx(c): return "#%02X%02X%02X" % tuple(int(round(v)) for v in c)
def rgb(h): h = h.lstrip("#"); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))
def lum(c):
    def ch(v):
        v /= 255.0
        return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4
    r, g, b = c; return 0.2126 * ch(r) + 0.7152 * ch(g) + 0.0722 * ch(b)
def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True); return (la + 0.05) / (lb + 0.05)
def sat(c):
    h, l, s = colorsys.rgb_to_hls(*[v / 255 for v in c]); return s * (1 - abs(2 * l - 1))   # تشبّع «مرئي»
def mix(a, b, t): return tuple(a[i] + (b[i] - a[i]) * t for i in range(3))

def pixels(paths):
    out = []
    for p in paths:
        im = Image.open(p).convert("RGB"); im.thumbnail((200, 200))
        a = np.asarray(im, dtype=np.float32).reshape(-1, 3)
        out.append(a[np.random.RandomState(0).choice(len(a), min(len(a), 6000), replace=False)])
    return np.concatenate(out)

def kmeans(x, k=10, it=25):
    rs = np.random.RandomState(1); c = x[rs.choice(len(x), k, replace=False)]
    for _ in range(it):
        d = ((x[:, None, :] - c[None]) ** 2).sum(-1); lab = d.argmin(1)
        for j in range(k):
            m = x[lab == j]
            if len(m): c[j] = m.mean(0)
    share = np.bincount(lab, minlength=k) / len(x)
    return [(tuple(c[j]), float(share[j])) for j in np.argsort(-share) if share[j] > 0.004]

def pick(clusters, force_mode=None):
    big = [c for c, s in clusters if s > 0.06] or [clusters[0][0]]
    # الخلفية: أكبر مساحة هادية (قليلة التشبّع)، غامقة أو فاتحة حسب الصور أو --light/--dark
    calm = sorted(clusters, key=lambda cs: (sat(cs[0]) > 0.35, -cs[1]))
    bg = calm[0][0]
    if force_mode == "dark" and lum(bg) > 0.2: bg = min((c for c, _ in clusters), key=lum)
    if force_mode == "light" and lum(bg) < 0.4: bg = max((c for c, _ in clusters), key=lum)
    dark = lum(bg) < 0.25
    # النص: أوضح لون من الصور مقابل الخلفية، وإلا أبيض مكسور/أسود دافي
    ink = max((c for c, _ in clusters), key=lambda c: contrast(c, bg))
    if contrast(ink, bg) < 4.5: ink = (245, 243, 238) if dark else (27, 26, 23)
    # التمييز: أقوى لون مشبّع له حضور (≥1٪) — ولو تباينه أقل من 3 نغمّقه/نفتّحه لين يوصل، بدل ما نختار لون باهت
    cand = sorted([cs for cs in clusters if cs[1] >= 0.01], key=lambda cs: -(sat(cs[0]) * (0.6 + min(cs[1], 0.15) * 3)))
    acc = None
    for c, _ in cand[:3]:
        if sat(c) < 0.18: continue
        for t in np.linspace(0, 0.7, 15):
            cc = mix(c, (255, 255, 255) if dark else (0, 0, 0), t)
            if contrast(cc, bg) >= 3: acc = cc; break
        if acc: break
    acc = acc or ((242, 179, 61) if dark else (201, 95, 60))
    clay = mix(acc, (0, 0, 0), 0.22)
    mut = mix(ink, bg, 0.45)
    on_acc = max([ink, bg, (255, 255, 255), (17, 17, 17)], key=lambda c: contrast(c, acc))
    return dict(bg=hx(bg), ink=hx(ink), acc=hx(acc), clay=hx(clay), mut=hx(mut), onAcc=hx(on_acc)), dark

def sheet(paths, theme, out):
    W = 1080; th = []
    for p in paths[:6]:
        im = Image.open(p).convert("RGB"); im.thumbnail((W // 3 - 12, 420)); th.append(im)
    rows = (len(th) + 2) // 3; H = rows * 432 + 200
    s = Image.new("RGB", (W, H), rgb(theme["bg"])); d = ImageDraw.Draw(s)
    for i, im in enumerate(th): s.paste(im, (6 + (i % 3) * (W // 3), 6 + (i // 3) * 432))
    y = rows * 432 + 20
    for i, k in enumerate(["bg", "ink", "acc", "clay", "mut", "onAcc"]):
        x = 20 + i * 175; d.rectangle([x, y, x + 155, y + 110], fill=rgb(theme[k]), outline=rgb(theme["mut"]), width=2)
        d.text((x + 6, y + 120), f"{k} {theme[k]}", fill=rgb(theme["ink"]))
    d.rectangle([20, y + 145, 520, y + 175], fill=rgb(theme["acc"])); d.text((30, y + 152), "acc + onAcc", fill=rgb(theme["onAcc"]))
    s.save(out, quality=88)

def main():
    a = [x for x in sys.argv[1:] if not x.startswith("--")]
    if len(a) < 2: print(__doc__); sys.exit(1)
    work, imgs = os.path.abspath(a[0]), a[1:]
    mode = "dark" if "--dark" in sys.argv else "light" if "--light" in sys.argv else None
    os.makedirs(work, exist_ok=True)
    tp = os.path.join(work, "theme.json")
    if os.path.exists(tp) and "--force" not in sys.argv:
        print("⚠️ فيه theme.json من قبل — ما لمسته. (--force لو طلب تغييره صراحة)"); sys.exit(4)
    theme, dark = pick(kmeans(pixels(imgs)), mode)
    full = {**theme, "font": "Tajawal", "grade": False, "faceAnchor": 0.30, "badgeUntil": 0, "capStyle": "card",
            "refs": [os.path.basename(p) for p in imgs]}
    json.dump(full, open(tp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    sheet(imgs, theme, os.path.join(work, "refs_palette.jpg"))
    print(json.dumps({**theme, "mode": "dark" if dark else "light",
                      "contrast_ink": round(contrast(rgb(theme["ink"]), rgb(theme["bg"])), 1),
                      "contrast_acc": round(contrast(rgb(theme["acc"]), rgb(theme["bg"])), 1)}, ensure_ascii=False))
    print("اقرأ refs_palette.jpg بعينك، ثم قرر الخط و capStyle من شكل الصور، واكتب handle و logo.")

if __name__ == "__main__":
    main()
