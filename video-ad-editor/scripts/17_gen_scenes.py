#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
🖼️ 17_gen_scenes.py — مشاهد مولّدة (v3.2): صور ومقاطع قصيرة يولّدها الذكاء الاصطناعي وتدخل الفيديو كمشاهد، والمحرّك يرسم فوقها.

الاستخدام:
  python3 scripts/17_gen_scenes.py <work> cost      # كم بتكلّف الأصول المطلوبة (بلا توليد)
  python3 scripts/17_gen_scenes.py <work> fetch     # يولّد الناقص فقط → <work>/gen/ ويكتب genFrames بـstudio.json
  python3 scripts/17_gen_scenes.py <work> status    # شنو جاهز وشنو ناقص
  python3 scripts/17_gen_scenes.py <work> place <k> <url> [--force]
                                                    # ناتج جاهز (رابط https أو file://) يدخل مكان الأصل k — للتوليد بلا مفتاح

الملف: <work>/gen.json
{
  "assets": [
    {"k":"desk",  "kind":"video", "prompt":"...", "dur":5, "ar":"9:16"},
    {"k":"paper", "kind":"image", "prompt":"...", "ar":"3:4"}
  ],
  "scenes": [ {"s":"w:منو","e":"w:الجواب+","k":"paper","mode":"card","draw":[{"op":"vs","at":"w:ولا","l":"ورقة","r":"الجوال"}]} ]
}
المزوّدان (v3.3):
  • fal.ai — بمفتاح: FAL_KEY بالبيئة أو بملف .env (بمجلد الشغل أو المشروع أو البيت) → أمر fetch يولّد كل شي بنفسه.
    الموديلات: صورة = fal-ai/nano-banana (≈0.04$) · مقطع = fal-ai/wan-25-preview/text-to-video 720p (≈0.05$/ث).
  • عيون المخرج — بلا مفتاح: كلود يولّد بحساب المستخدم عبر خادم MCP اسمه director على https://hawsh-khalifa.com/mcp
    (صورة 0.2 نقطة · مقطع 5 ث = 1 نقطة)،
    ثم ينزّل كل ناتج بأمر place — السكربت نفسه ما يتكلم مع أي خادم هني.
⛔ يولّد فقط اللي ما هو موجود بمجلد gen/ (ما يعيد ولا يدفع مرتين). لو فشل طلب مرة، يوقف ويقول السبب — ما يكرّر.
"""
import sys, os, json, math, time, glob, subprocess, urllib.request, urllib.error

IMG_MODEL = "fal-ai/nano-banana"
VID_MODEL = "fal-ai/wan-25-preview/text-to-video"
IMG_COST, VID_COST_PER_S = 0.04, 0.05
# نقاط عيون المخرج (بلا مفتاح فال): الصورة ثابتة، والمقطع تقدير — الخادم يحسب ceil(دولار / 0.8) وأقلها نقطة.
PT_IMG, PT_USD_PER_S, PT_USD = 0.2, 0.10, 0.8
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

def points_of(a):
    """نقاط أصل واحد: الصورة 0.2 بالضبط، والمقطع تقدير بنفس قاعدة الخادم (ceil(دولار / 0.8)، وأقلها نقطة)"""
    if a.get("kind") == "video":
        return max(1, math.ceil(PT_USD_PER_S * float(a.get("dur", 5)) / PT_USD))
    return PT_IMG

def points(assets):
    return sum(points_of(a) for a in assets)

def num(v):
    """رقم بلا أصفار زايدة: 1 · 0.2 · 1.4 — وكلها غربية"""
    return ("%.2f" % v).rstrip("0").rstrip(".")

def frames_of(work, k):
    g = os.path.join(work, "gen"); n = 0
    while os.path.exists(os.path.join(g, "%s_%04d.jpg" % (k, n + 1))): n += 1
    return n

def drop_frames(work, k):
    g = os.path.join(work, "gen")
    for old in glob.glob(os.path.join(g, "%s_[0-9][0-9][0-9][0-9].jpg" % glob.escape(k))): os.remove(old)

def to_frames(work, k, mp4):
    """مقطع → فريمات 30/ث بـgen/<k>_%04d.jpg. أمر واحد يستخدمه fetch وplace عشان ما يفترقان.
    فشل الاستخراج يمسح الناقص (الفريمات والمقطع) حتى ما يحسب have() أصلاً نص مكتوب إنه جاهز."""
    drop_frames(work, k)
    try:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", mp4, "-vf", "fps=30", "-q:v", "3", os.path.join(work, "gen", k + "_%04d.jpg")], check=True)
    except BaseException:                      # حتى Ctrl+C ما يخلّي فريمات ناقصة يحسبها have() جاهزة
        drop_frames(work, k)
        if os.path.exists(mp4): os.remove(mp4)
        raise
    return frames_of(work, k)

def to_image(work, k, src):
    """أي صورة (PNG/WebP/JPG) → gen/<k>.jpg بنفس جودة الفريمات (والفشل ما يخلّي صورة نص مكتوبة)"""
    jpg = os.path.join(work, "gen", k + ".jpg")
    try:
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-q:v", "3", jpg], check=True)
    except BaseException:                      # نفس القاعدة: الصورة الناقصة تنمسح ولو وقفه المستخدم
        if os.path.exists(jpg): os.remove(jpg)
        raise
    return jpg

def frames_line(st):
    """genFrames بأسلوب السكربت: «clip: 30 فريم» لا شكل قاموس بايثون"""
    return " · ".join("%s: %d فريم" % (k, n) for k, n in st.get("genFrames", {}).items()) or "صور فقط"

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
        if not _key(work):
            print("بلا مفتاح فال — بنقاط عيون المخرج: %d أصل (ناقص %d) ≈ %s نقطة (تقدير — director_quote هو الحَكَم)"
                  % (len(assets), len(missing), num(points(missing))))
            for a in missing:
                v = a.get("kind") == "video"
                print("  •", a["k"], ("مقطع %s ث" % a.get("dur", 5)) if v else "صورة", "≈ %s نقطة" % num(points_of(a)))
            return
        print("الأصول: %d (ناقص %d) — التكلفة التقديرية للناقص ≈ %.2f دولار" % (len(assets), len(missing), cost(missing)))
        for a in missing: print("  •", a["k"], a.get("kind", "image"), ("%ss" % a.get("dur", 5)) if a.get("kind") == "video" else "", "≈ %.2f$" % (VID_COST_PER_S * float(a.get("dur", 5)) if a.get("kind") == "video" else IMG_COST))
        return
    if cmd == "status":
        for a in assets: print(("✅" if have(work, a) else "⏳"), a["k"], a.get("kind", "image"), (("%d فريم" % frames_of(work, a["k"])) if a.get("kind") == "video" and have(work, a) else ""))
        write_studio(work, cfg); print("studio.json ← gen:", len(cfg.get("scenes", [])), "مشهد"); return
    if cmd == "place":
        # ناتج جاهز (ولّده كلود بعيون المخرج، أو أي رابط) يدخل مكان الأصل k — بلا مفتاح وبلا نداء أي خدمة من هني.
        args = sys.argv[3:]; force = "--force" in args
        rest = [x for x in args if x != "--force"]          # --force بأي مكان بعد الأمر
        if len(rest) != 2 or not rest[1].lower().startswith(("https://", "http://", "file://")):
            sys.exit("❌ الاستخدام: 17_gen_scenes.py <work> place <k> <رابط الناتج: https:// أو file://> [--force]")
        k, url = rest
        a = next((x for x in assets if x.get("k") == k), None)
        if a is None:
            sys.exit("❌ ما فيه أصل اسمه «%s» بـgen.json — الموجود: %s" % (k, "، ".join(x.get("k", "?") for x in assets) or "لا شيء"))
        if have(work, a) and not force:
            print("⏭️  «%s» موجود أصلاً — ما نزّلته مرة ثانية (--force يعيده)" % k)
            write_studio(work, cfg); return
        g = os.path.join(work, "gen"); os.makedirs(g, exist_ok=True)
        kind = a.get("kind", "image"); t0 = time.time()
        tmp = os.path.join(g, "_tmp_" + k + (".mp4" if kind == "video" else ".bin"))
        stage = "dl"
        try:
            _dl(url, tmp)                        # داخل نفس الـtry حتى ما يخلّي ملفاً مؤقتاً لو فشل
            stage = "ff"
            if kind == "video":
                mp4 = os.path.join(g, k + ".mp4"); os.replace(tmp, mp4)
                print("  ✅ %s مقطع → %d فريم (%.0f ث)" % (k, to_frames(work, k, mp4), time.time() - t0))
            else:
                to_image(work, k, tmp)
                print("  ✅ %s صورة (%.0f ث)" % (k, time.time() - t0))
        except Exception as e:
            if stage == "dl": sys.exit("❌ ما قدرت أنزّل «%s» من الرابط: %s" % (k, str(e)[:200]))
            sys.exit("❌ الملف نزل بس ما قدرت أجهّزه لـ«%s»: %s\n   (لازم ffmpeg يقرا الملف — تأكد إن الرابط صورة أو مقطع)" % (k, str(e)[:200]))
        finally:
            if os.path.exists(tmp): os.remove(tmp)   # المؤقت ينمسح بالحالتين (المقطع انتقل باسمه أصلاً)
        st = write_studio(work, cfg)
        print("📝 studio.json ← gen: %d مشهد · %s" % (len(st["gen"]), frames_line(st)))
        return
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
                print("  ✅ %s مقطع %s ث → %d فريم (%.0f ث)" % (k, dur, to_frames(work, k, mp4), time.time() - t0))
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
    print("📝 studio.json ← gen: %d مشهد · %s" % (len(st["gen"]), frames_line(st)))

if __name__ == "__main__":
    main()
