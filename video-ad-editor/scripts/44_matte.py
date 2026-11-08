# -*- coding: utf-8 -*-
"""قصّ الشخص بحواف شعر ناعمة (6.5) — بيريف نت بورتريه (مجاني، يشتغل على جهازك) بدل قصّ الماك.
   قارنّاهم على ريل البطاريات بزوم على الشعر: قصّ الماك يطلّع هالة من لون الغرفة وحافة مدوّرة،
   وبيريف نت يلحق الشعر نفسه. وفوقه ننظّف لون الغرفة من أطراف الشعر (فصل الألوان)،
   فالشخص ينحط فوق أي خلفية أو كلمة بلا هالة.

   python3 44_matte.py <work> <من فريم> <إلى فريم>          ← يكتب bt/mask (القناع) + bt/person (الشخص بشفافية)
   python3 44_matte.py <work> <من> <إلى> --check              ← يقول كم فريم ناقص وكم ياخذ، بلا شغل
   python3 44_matte.py <work> <من> <إلى> --from-apple         ← ⚡ سريع (ثواني): قصّ الماك نفسه بس ننظّف حوافه
        (نضيّقه بكسل ونشيل لون الغرفة من الأطراف) — للمقاطع اللي ما فيها شي ورا الراس (قرار ماجد: بيريف نت للي ورا الراس بس)
   الفريمات من bt/src (11_behind_text.js يجهّزها) أو vfr.
   ينادى تلقائياً من 11_behind_text.js (build/stack/cutout/headout/person). MATTE=apple يرجّع قصّ الماك.

   ⏱️ السرعة: حوالي 13 ث للفريم على معالج الماك (ثانية كلام = 30 فريم ≈ 6–7 دقايق) — يكمّل من وين وقف.
   🎮 فيه كرت شاشة إنفيديا (ويندوز/لينكس)؟ يستخدمه تلقائياً لو منصّب onnxruntime-gpu (00_setup.sh --extras يركّبه لحاله) — أسرع بواجد.
   القصّ الخام ينحفظ بـbt/bf_raw فإعادة التشغيل ما تعيد شي جاهز.
   يحتاج: pip3 install rembg onnxruntime pymatting (أول مرة ينزّل الموديل ~970 ميقا لـ~/.u2net)."""
import os, sys, json, time
import numpy as np
from PIL import Image

if len(sys.argv) < 4: print(__doc__); sys.exit(1)
W = os.path.abspath(sys.argv[1]); f0, f1 = int(sys.argv[2]), int(sys.argv[3])
CHECK = "--check" in sys.argv; APPLE = "--from-apple" in sys.argv
RAW = os.path.join(W, "bt", "bf_raw"); MASK = os.path.join(W, "bt", "mask"); PERS = os.path.join(W, "bt", "person")
for d in (RAW, MASK, PERS): os.makedirs(d, exist_ok=True)
ids = [f"{i:05d}" for i in range(f0, f1 + 1)]
def src(i):
    for d in ("bt/src", "vfr"):
        p = os.path.join(W, d, i + ".jpg")
        if os.path.exists(p): return p
    return None
todo = [] if APPLE else [i for i in ids if src(i) and not (os.path.exists(os.path.join(RAW, i + ".png")) and os.path.getsize(os.path.join(RAW, i + ".png")) > 1000)]
print(f"قصّ بيريف نت: {len(ids)} فريم — ناقص {len(todo)} (≈ {len(todo)*13/60:.0f} دقيقة على المعالج)")
if CHECK: sys.exit(0)

# 1) القصّ الخام (يكمّل من وين وقف)
if todo:
    try:
        from rembg import new_session, remove
    except Exception:
        print("⚠️ rembg مو منصّب (pip3 install rembg onnxruntime) — باقي على قصّ الماك"); sys.exit(10)
    # كرت الشاشة أول لو موجود (تجربة عزيز: كرت إنفيديا خلّاه أسرع بواجد) — CUDA ← DirectML (ويندوز) ← المعالج.
    # ⛔ CoreML بالماك لا: يعلّق المحرّك العصبي وقراءة النص. GPU=0 يجبر المعالج.
    try:
        import onnxruntime as ort; have = ort.get_available_providers()
    except Exception: have = []
    prov = [p for p in ("CUDAExecutionProvider", "DmlExecutionProvider") if p in have and os.environ.get("GPU") != "0"] + ["CPUExecutionProvider"]
    print(f"  القص على: {'كرت الشاشة (' + prov[0] + ')' if len(prov) > 1 else 'المعالج'}")
    s = new_session("birefnet-portrait", providers=prov)
    T = time.time()
    for k, i in enumerate(todo):
        im = Image.open(src(i)).convert("RGB")
        m = remove(im, session=s, only_mask=True, post_process_mask=False)
        o = os.path.join(RAW, i + ".png"); m.save(o + ".tmp.png"); os.replace(o + ".tmp.png", o)
        if k % 15 == 0:
            el = (time.time() - T) / (k + 1); print(f"  {k+1}/{len(todo)} · {el:.1f} ث/فريم · باقي ≈ {el*(len(todo)-k-1)/60:.0f} د", flush=True)

# 2) وسيط زمني من 3 فريمات (يشيل رجفة أطراف الشعر بلا ما يخلّف ظل وقت الحركة) + 3) تنظيف لون الغرفة من الأطراف
try:
    from pymatting import estimate_foreground_ml
except Exception:
    estimate_foreground_ml = None; print("ℹ️ pymatting مو منصّب — بلا تنظيف لون الأطراف (pip3 install pymatting)")
def raw(i):
    if APPLE:   # قصّ الماك: نضيّقه بكسل (حافته واسعة فيها لون الغرفة) ونخلّيه ناعم — من نسخته الأصلية (bt/mask_apple) عشان الإعادة ما تضيّقه مرتين
        p0 = os.path.join(MASK, i + ".png"); p = os.path.join(W, "bt", "mask_apple", i + ".png")
        if not os.path.exists(p):
            if not os.path.exists(p0): return None
            os.makedirs(os.path.dirname(p), exist_ok=True); import shutil; shutil.copy(p0, p)
        m = Image.open(p).convert("L"); from PIL import ImageFilter
        m = m.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(0.8))
        return np.asarray(m, np.float32) / 255
    p = os.path.join(RAW, i + ".png")
    return np.asarray(Image.open(p).convert("L"), np.float32) / 255 if os.path.exists(p) else None
ring = []; n = 0
for k, i in enumerate(ids):
    a = raw(i)
    if a is None: continue
    nb = [x for x in (raw(ids[k - 1]) if k > 0 else None, a, raw(ids[k + 1]) if k + 1 < len(ids) else None) if x is not None]
    if len(nb) == 3: a = np.median(np.stack(nb), axis=0)
    im = np.asarray(Image.open(src(i)).convert("RGB"), np.float64) / 255
    if a.shape != im.shape[:2]: a = np.asarray(Image.fromarray((a * 255).astype(np.uint8)).resize((im.shape[1], im.shape[0]), Image.LANCZOS), np.float32) / 255
    F = estimate_foreground_ml(im, a.astype(np.float64)) if estimate_foreground_ml else im
    Image.fromarray((a * 255).clip(0, 255).astype(np.uint8)).save(os.path.join(MASK, i + ".png"))
    rgba = np.dstack([(F * 255).clip(0, 255), a[..., None] * 255]).astype(np.uint8)
    Image.fromarray(rgba).save(os.path.join(PERS, i + ".png"))
    if k % 10 == 0:   # 4) لون الغرفة حولك (حلقة برّا حدودك) — للخلفية الجديدة: لون قريب منه ما يطلّع هالة (ملاحظة ماجد)
        sm = a[::4, ::4]; out = sm < 0.02
        from numpy.lib.stride_tricks import sliding_window_view as _sw
        near = np.zeros_like(out)
        pad = np.pad(sm > 0.5, 6); win = _sw(pad, (13, 13)).max(axis=(2, 3)); near = win & out
        px = im[::4, ::4][near]
        if len(px): ring.append(np.median(px, axis=0))
    n += 1
info = {}
if ring:
    c = (np.median(np.array(ring), axis=0) * 255).astype(int); info["bg"] = "#%02X%02X%02X" % tuple(c)
dp = os.path.join(W, "depth.json"); d = json.load(open(dp)) if os.path.exists(dp) else {}
d.setdefault("rooms", []); d["rooms"] = [r for r in d["rooms"] if r.get("f") != [f0, f1]] + [{"f": [f0, f1], **info}]
json.dump(d, open(dp, "w"), ensure_ascii=False, indent=1)
print(f"✅ {n} فريم: bt/mask + bt/person ({'قصّ الماك منظّف' if APPLE else 'قصّ بيريف نت'} + تنظيف الأطراف) · لون غرفتك حولك {info.get('bg','؟')} ← depth.json")
