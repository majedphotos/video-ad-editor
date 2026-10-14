# -*- coding: utf-8 -*-
"""صفحة مراجعة الحلقة — ريلات + كاروسيل بصفحة وحدة: ملاحظة · اعتمد · تحميل (references/review-page.md)
   python3 41_review.py review.json <مجلد_الصفحة>

   review.json (المسارات نسبة لمكانه):
   { "key": "ep1",                       ← اسم ثابت للحلقة (لتخزين الطلبات بالجهاز)
     "eyebrow": "🎙️ استوديو البودكاست · الحلقة الأولى", "title": "عنوان الحلقة",
     "meta": ["بودكاست … مع …", "53 دقيقة"], "link": {"url": "https://youtu.be/…", "label": "الحلقة على يوتيوب"},
     "approve_label": "اعتمد",            ← من theme.json ← review.approve_label لو موجود
     "theme": "theme.json",               ← اختياري: ألوان الصفحة من هوية المستخدم (bg/ink/acc)
     "items": [ {"id": "R3", "kind": "reel", "title": "…", "cap": "الكابشن", "video": "reels/R3.mp4"},
                {"id": "C1", "kind": "carousel", "title": "…", "cap": "…", "slides": ["car/s1.png", "…"]} ],
     "ideas": [["6", "عنوان", "سطر"]] }   ← اختياري: مقترحات ما انعملت

   يطلّع بالمجلد: index.html + media/ (فيديو 1080×1920 تحت 14 ميقا = المعاينة والتحميل · بوستر · شرائح معاينة + أصلية للتحميل)
   ويطبع خريطة files لأداة النشر. الأصل الكامل ما ينلمس — هذي نسخة مراجعة."""
import sys, os, json, re, subprocess, shutil

CAP_MB = 14.0                     # حد ملف المنشور 15 ميقا — نخلي هامش
if len(sys.argv) < 3:
    print(__doc__); sys.exit(1)
SRC = os.path.abspath(sys.argv[1]); BASE = os.path.dirname(SRC); OUT = os.path.abspath(sys.argv[2])
R = json.load(open(SRC, encoding="utf-8"))
HERE = os.path.dirname(os.path.abspath(__file__))
os.makedirs(os.path.join(OUT, "media"), exist_ok=True)
p = lambda rel: rel if os.path.isabs(rel) else os.path.join(BASE, rel)
safe = lambda s: re.sub(r"[^A-Za-z0-9_-]", "_", s) or "x"

def dur(f):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", f], capture_output=True, text=True).stdout
    return float(o.strip() or 0)

def enc_reel(src, dst, d):
    # نفس الفيديو للمعاينة والتحميل: crf 21، ولو بيعدّي الحد نسقّف البت ريت على المدة
    br = int((CAP_MB * 8e6 / max(d, 1)) - 160e3)
    args = ["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", src,
            "-vf", "scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2",
            "-c:v", "libx264", "-preset", "slow", "-crf", "21", "-maxrate", str(min(br, 8_000_000)), "-bufsize", str(2 * min(br, 8_000_000)),
            "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", dst]
    subprocess.run(args, check=True)

theme = {}
tp = p(R["theme"]) if R.get("theme") else None
if tp and os.path.exists(tp):
    theme = json.load(open(tp, encoding="utf-8"))
approve = R.get("approve_label") or (theme.get("review") or {}).get("approve_label") or "اعتمد"
files, items, warn = {"index.html": os.path.join(OUT, "index.html")}, [], []

for it in R.get("items", []):
    iid = safe(it["id"]); o = dict(id=it["id"], kind=it["kind"], title=it.get("title", ""), cap=it.get("cap", ""))
    if it["kind"] == "reel":
        src = p(it["video"]); d = dur(src)
        mp4, jpg = f"media/{iid}.mp4", f"media/{iid}.jpg"
        enc_reel(src, os.path.join(OUT, mp4), d)
        subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-ss", str(min(1.2, d / 2)), "-i", src, "-frames:v", "1",
                        "-vf", "scale=540:-2", "-q:v", "4", os.path.join(OUT, jpg)], check=True)
        o.update(video=mp4, poster=jpg, download=mp4, dur=it.get("dur") or "%d:%02d" % divmod(round(d), 60))
        for f in (mp4, jpg): files[f] = os.path.join(OUT, f)
    else:
        slides, full = [], []
        for i, s in enumerate(it.get("slides", []), 1):
            s = p(s); ext = os.path.splitext(s)[1].lower()
            ext = ext if ext in (".png", ".jpg", ".jpeg", ".webp") else ".png"
            f = f"media/{iid}_f{i}{ext}"                                # التحميل = الشرائح الأصلية بجودتها (الصفحة تجمعها zip)
            if ext == os.path.splitext(s)[1].lower(): shutil.copy(s, os.path.join(OUT, f))
            else: subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", s, os.path.join(OUT, f)], check=True)
            rel = f"media/{iid}_s{i}.jpg"                               # المعاينة jpg خفيف
            subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", s, "-vf", "scale=720:-2", "-q:v", "3",
                            os.path.join(OUT, rel)], check=True)
            slides.append(rel); full.append(f); files[rel] = os.path.join(OUT, rel); files[f] = os.path.join(OUT, f)
        o.update(slides=slides, download=f"{iid}.zip", download_files=full, dur=it.get("dur") or f"{len(slides)} شرائح")
    items.append(o)

data = dict(key=R.get("key") or R.get("title", ""), eyebrow=R.get("eyebrow", ""), title=R.get("title", ""), meta=R.get("meta", []),
            link=R.get("link"), how=R.get("how"), approve_label=approve, items=items, ideas=R.get("ideas", []))
tpl = open(os.path.join(HERE, "review.TEMPLATE.html"), encoding="utf-8").read()
css = "".join(f"--{k}:{theme[k]};" for k in ("bg", "ink", "acc") if isinstance(theme.get(k), str) and theme[k].startswith("#"))
html = (tpl.replace("__TITLE__", (R.get("title") or "مراجعة").replace("<", "&lt;"))
           .replace("/*__THEME__*/", css)
           .replace("/*__DATA__*/", json.dumps(data, ensure_ascii=False).replace("</", "<\\/")))
open(os.path.join(OUT, "index.html"), "w", encoding="utf-8").write(html)

for rel, f in files.items():
    mb = os.path.getsize(f) / 1e6
    if mb > 15: warn.append(f"{rel} {mb:.1f} ميقا — فوق حد النشر 15")
print(f"✅ {OUT}/index.html — {len(items)} عنصر، {len(files)} ملف، {sum(os.path.getsize(f) for f in files.values()) / 1e6:.1f} ميقا")
for w in warn: print("⚠️ ", w)
rel_out = {k: v for k, v in files.items() if k != "index.html"}
json.dump(rel_out, open(os.path.join(OUT, "files.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print(f"   files (للنشر): {OUT}/files.json")
