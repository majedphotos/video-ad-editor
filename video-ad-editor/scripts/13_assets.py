# -*- coding: utf-8 -*-
"""يجيب صورة مناسبة لكلمة من مكتبة ويكيميديا كومنز (ملكية عامة / CC0 / CC BY) ويقصّ خلفيتها لو rembg متوفر.
   python3 13_assets.py <outdir> <name> "<استعلام إنقليزي>" ["استعلام بديل"...] [--cutout] [--min 800]
   يكتب: <outdir>/<name>.jpg (الأصل) · <outdir>/<name>.png (مقصوص لو --cutout) · <outdir>/<name>.json (المصدر والرخصة)
   الرخص المقبولة فقط: Public domain · CC0 · CC BY · CC BY-SA (وتُسجَّل عشان تُنسب بالكابشن لو لزم)."""
# ── توافق ويندوز/UTF-8 (مضاف) ─────────────────────────────────────
import sys as _sys, builtins as _bi
try:
    _sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    _sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except Exception:
    pass
_real_open = _bi.open
def _utf8_open(f, mode="r", *a, **k):
    if "b" not in mode:
        k.setdefault("encoding", "utf-8")
    return _real_open(f, mode, *a, **k)
_bi.open = _utf8_open
# ──────────────────────────────────────────────────────────────────
import sys, os, json, urllib.request, urllib.parse
UA={"User-Agent":"video-ad-editor-skill/2.6 (asset fetch)"}
OK=("Public domain","CC0","CC BY 2.0","CC BY 2.5","CC BY 3.0","CC BY 4.0","CC BY-SA")
args=[a for a in sys.argv[1:] if not a.startswith("--")]; flags=[a for a in sys.argv[1:] if a.startswith("--")]
out, name, queries = args[0], args[1], args[2:]
cut="--cutout" in flags; minw=int(next((f.split("=")[1] for f in flags if f.startswith("--min=")),800))
os.makedirs(out, exist_ok=True)
def api(p):
    return json.load(urllib.request.urlopen(urllib.request.Request("https://commons.wikimedia.org/w/api.php?"+urllib.parse.urlencode(p),headers=UA),timeout=60))
def search(q,n=12):
    d=api({"action":"query","format":"json","generator":"search","gsrsearch":q,"gsrnamespace":6,"gsrlimit":n,"prop":"imageinfo","iiprop":"url|size|extmetadata|mime","iiurlwidth":1400})
    res=[]
    for p in (d.get("query",{}).get("pages") or {}).values():
        ii=p["imageinfo"][0]; mime=ii.get("mime",""); lic=ii.get("extmetadata",{}).get("LicenseShortName",{}).get("value","")
        if not mime.startswith("image/") or mime=="image/svg+xml": continue
        if ii["width"]<minw or not any(lic.startswith(k) for k in OK): continue
        title=p["title"].lower()
        if any(b in title for b in ("logo","icon","map","diagram","screenshot","flag","coat","chart")): continue
        res.append({"title":p["title"],"url":ii.get("thumburl") or ii["url"],"page":ii.get("descriptionurl",""),"w":ii["width"],"h":ii["height"],"lic":lic,
                    "author":ii.get("extmetadata",{}).get("Artist",{}).get("value","")[:80]})
    return res
pick=None
for q in queries:
    for r in search(q):
        # نفضّل الصور الأفقية/المربعة المتوسطة (صور مشهد) على الضخمة جداً
        pick=r; break
    if pick: break
if not pick: print("✗ ما لقيت صورة مناسبة لـ", queries); sys.exit(1)
raw=urllib.request.urlopen(urllib.request.Request(pick["url"],headers=UA),timeout=120).read()
open(f"{out}/{name}.jpg","wb").write(raw)
json.dump(pick,open(f"{out}/{name}.json","w"),ensure_ascii=False,indent=1)
print("✓",name,"←",pick["title"][:60],"|",pick["w"],"x",pick["h"],"|",pick["lic"])
if cut:
    try:
        from rembg import remove, new_session
        from PIL import Image
        im=Image.open(f"{out}/{name}.jpg").convert("RGBA"); o=remove(im,session=new_session("u2net")); bb=o.getbbox()
        if bb: o=o.crop(bb)
        o.save(f"{out}/{name}.png"); print("✂️ مقصوص:",o.size)
    except Exception as e:
        print("⚠️ ما قدرت أقصّ (rembg غير مثبّت؟):",str(e)[:60],"— استخدم الصورة الأصلية بإطار ورقي")
