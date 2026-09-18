#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🖼️ 17_gen_scenes.py — مشاهد مولّدة (v3.2): صور ومقاطع قصيرة يولّدها الذكاء الاصطناعي وتدخل الفيديو كمشاهد، والمحرّك يرسم فوقها.

الاستخدام:
  python3 scripts/17_gen_scenes.py <work> cost      # كم بتكلّف الأصول المطلوبة (بلا توليد)
  python3 scripts/17_gen_scenes.py <work> fetch     # يولّد الناقص فقط → <work>/gen/ ويكتب genFrames بـstudio.json
  python3 scripts/17_gen_scenes.py <work> status    # شنو جاهز وشنو ناقص

الملف: <work>/gen.json
{
  "assets": [
    {"k":"desk",  "kind":"video", "prompt":"...", "dur":5, "ar":"9:16"},
    {"k":"paper", "kind":"image", "prompt":"...", "ar":"3:4"}
  ],
  "scenes": [ {"s":"w:منو","e":"w:الجواب+","k":"paper","mode":"card","draw":[{"op":"vs","at":"w:ولا","l":"ورقة","r":"الجوال"}]} ]
}
المزوّد: fal.ai — المفتاح من FAL_KEY بالبيئة أو بملف .env (بمجلد الشغل أو المشروع أو البيت).
الموديلات: صورة = fal-ai/nano-banana (≈0.04$) · مقطع = fal-ai/wan-25-preview/text-to-video 720p (≈0.05$/ث).
⛔ يولّد فقط اللي ما هو موجود بمجلد gen/ (ما يعيد ولا يدفع مرتين). لو فشل طلب مرة، يوقف ويقول السبب — ما يكرّر.
"""
import sys, os, json, time, subprocess, urllib.request, urllib.error

IMG_MODEL = "fal-ai/nano-banana"
VID_MODEL = "fal-ai/wan-25-preview/text-to-video"
IMG_COST, VID_COST_PER_S = 0.04, 0.05
NEG = "no women, no people, no readable text, no logos, no watermark"   # قواعد المستخدم: بلا نساء وبلا شعارات مرسومة

def _key(work):
    k = os.environ.get("FAL_KEY")
    for d in (work, os.getcwd(), os.path.expanduser("~")):
        if k: break
        p = os.path.join(d, ".env")
        if os.path.exists(p):
            for line in open(p, encoding="utf-8"):
                if line.startswith("FAL_KEY="):
                    k = line.split("=", 1)[1].strip().strip('"').strip("'"); break
    return k

def _post(url, key, body, timeout=120):
    r = urllib.request.Request(url, data=json.dumps(body).encode(), headers={"Authorization": "Key " + key, "Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(r, timeout=timeout))

def _get(url, key, timeout=60):
    r = urllib.request.Request(url, headers={"Authorization": "Key " + key})
    return json.load(urllib.request.urlopen(r, timeout=timeout))

def _dl(url, path):
    urllib.request.urlretrieve(url, path)

def load(work):
    p = os.path.join(work, "gen.json")
    if not os.path.exists(p):
        sys.exit("❌ ما فيه gen.json بمجلد الشغل — اكتبه أولاً (الصيغة بأعلى هذا الملف)")
    return json.load(open(p, encoding="utf-8"))

def have(work, a):
    g = os.path.join(work, "gen")
    if a.get("kind") == "video":
        return os.path.exists(os.path.join(g, a["k"] + "_0001.jpg"))
    return os.path.exists(os.path.join(g, a["k"] + ".jpg"))

def cost(assets):
    return sum((VID_COST_PER_S * float(a.get("dur", 5))) if a.get("kind") == "video" else IMG_COST for a in assets)

def frames_of(work, k):
    g = os.path.join(work, "gen"); n = 0
    while os.path.exists(os.path.join(g, "%s_%04d.jpg" % (k, n + 1))): n += 1
    return n

def write_studio(work, cfg):
    """يكتب scenes/genFrames بـstudio.json (يدمج بلا ما يمسح باقي الإعدادات)"""
    sp = os.path.join(work, "studio.json")
    st = json.load(open(sp, encoding="utf-8")) if os.path.exists(sp) else {}
    st["gen"] = cfg.get("scenes", [])
    st["genFrames"] = {a["k"]: frames_of(work, a["k"]) for a in cfg.get("assets", []) if a.get("kind") == "video"}
    json.dump(st, open(sp, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    return st

def main():
    if len(sys.argv) < 3: sys.exit(__doc__)
    work, cmd = sys.argv[1], sys.argv[2]
    cfg = load(work); assets = cfg.get("assets", [])
    missing = [a for a in assets if not have(work, a)]
    if cmd == "cost":
        print("الأصول: %d (ناقص %d) — التكلفة التقديرية للناقص ≈ %.2f دولار" % (len(assets), len(missing), cost(missing)))
        for a in missing: print("  •", a["k"], a.get("kind", "image"), ("%ss" % a.get("dur", 5)) if a.get("kind") == "video" else "", "≈ %.2f$" % (VID_COST_PER_S * float(a.get("dur", 5)) if a.get("kind") == "video" else IMG_COST))
        return
    if cmd == "status":
        for a in assets: print(("✅" if have(work, a) else "⏳"), a["k"], a.get("kind", "image"), (("%d فريم" % frames_of(work, a["k"])) if a.get("kind") == "video" and have(work, a) else ""))
        write_studio(work, cfg); print("studio.json ← gen:", len(cfg.get("scenes", [])), "مشهد"); return
    if cmd != "fetch": sys.exit(__doc__)
    key = _key(work)
    if not key: sys.exit("❌ ما فيه مفتاح فال — حط FAL_KEY بالبيئة أو بملف .env")
    g = os.path.join(work, "gen"); os.makedirs(g, exist_ok=True)
    print("🎨 أولّد %d أصل (≈ %.2f دولار)" % (len(missing), cost(missing)))
    for a in missing:
        k, kind, prompt = a["k"], a.get("kind", "image"), a["prompt"].strip() + ", " + NEG
        t0 = time.time()
        try:
            if kind == "video":
                dur = str(int(float(a.get("dur", 5))))
                q = _post("https://queue.fal.run/" + VID_MODEL, key, {"prompt": prompt, "aspect_ratio": a.get("ar", "9:16"), "duration": dur, "resolution": a.get("res", "720p"), "enable_prompt_expansion": False}, 60)
                su, ru = q["status_url"], q["response_url"]
                for _ in range(120):
                    st = _get(su, key).get("status")
                    if st == "COMPLETED": break
                    if st == "FAILED": raise RuntimeError("فشل توليد المقطع " + k)
                    time.sleep(5)
                res = _get(ru, key); url = res["video"]["url"]
                mp4 = os.path.join(g, k + ".mp4"); _dl(url, mp4)
                subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "fps=30", "-q:v", "3", os.path.join(g, k + "_%04d.jpg")], check=True)
                print("  ✅ %s مقطع %s ث → %d فريم (%.0f ث)" % (k, dur, frames_of(work, k), time.time() - t0))
            else:
                res = _post("https://fal.run/" + IMG_MODEL, key, {"prompt": prompt, "num_images": 1, "aspect_ratio": a.get("ar", "3:4"), "output_format": "jpeg"}, 120)
                _dl(res["images"][0]["url"], os.path.join(g, k + ".jpg"))
                print("  ✅ %s صورة (%.0f ث)" % (k, time.time() - t0))
        except urllib.error.HTTPError as e:
            body = e.read()[:300].decode("utf-8", "ignore")
            sys.exit("❌ فال رفض طلب «%s»: %s %s\n   (ما أعدت الطلب — شخّص السبب: المفتاح؟ الرصيد؟ المحتوى؟)" % (k, e.code, body))
        except Exception as e:
            sys.exit("❌ توقفت عند «%s»: %s" % (k, str(e)[:200]))
    st = write_studio(work, cfg)
    print("📝 studio.json ← gen: %d مشهد · genFrames: %s" % (len(st["gen"]), st["genFrames"]))

if __name__ == "__main__":
    main()
