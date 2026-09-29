# -*- coding: utf-8 -*-
"""🎭 مشهد «أنت بمكان ثاني وتتكلم بصوتك» — صورة مولّدة + أفاتار كلينق يحرّك الشفايف على صوته الحقيقي.
   الوصفة الكاملة والأخطاء اللي لا تكررها: references/talking-avatar.md

   python3 21_avatar_scene.py <work> still <ثانية_الفريم> "<وصف المكان والجلسة>" [صورة_مرجع_للتكوين ...]
        → ai/avatar_still0.jpg و ai/avatar_still1.jpg (خيارين · 0.039$ للصورة) — اعرضهم عليه واختر
   python3 21_avatar_scene.py <work> talk <من> <إلى> <الصورة_المختارة> [اسم=seat] [--yes]
        → يقص صوته من cutz.mp4 (نفس المدى) ويولّد الأفاتار (0.115$/ث) ويطلّع الفريمات clips/<اسم>_0001.jpg…
          بلا --yes يطبع التكلفة بس ولا يصرف.
المزوّد fal.ai — المفتاح FAL_KEY بالبيئة أو .env (مجلد الشغل أو المشروع أو البيت)."""
import sys, os, json, time, base64, subprocess, urllib.request, urllib.error

IMG_EDIT = "fal-ai/nano-banana/edit"            # 0.039$ للصورة (صفحة fal، 28 سبتمبر 2026)
AVATAR   = "fal-ai/kling-video/ai-avatar/v2/pro" # 0.115$ للثانية — صورة + صوت → يتكلم بالصوت نفسه

def key(work):
    k = os.environ.get("FAL_KEY")
    if k: return k
    for d in (work, os.path.dirname(os.path.abspath(work)), os.getcwd(), os.path.expanduser("~")):
        p = os.path.join(d, ".env")
        if os.path.exists(p):
            for line in open(p, encoding="utf-8"):
                if line.startswith("FAL_KEY="): return line.split("=", 1)[1].strip().strip('"')
    sys.exit("❌ ما فيه مفتاح فال — حط FAL_KEY بالبيئة أو بملف .env")

def req(url, k, body=None, timeout=600):
    r = urllib.request.Request(url, data=json.dumps(body).encode() if body is not None else None,
                               headers={"Authorization": "Key " + k, "Content-Type": "application/json"},
                               method="POST" if body is not None else "GET")
    return json.load(urllib.request.urlopen(r, timeout=timeout))

def run(ep, k, body):
    q = req("https://queue.fal.run/" + ep, k, body)
    while True:
        s = req(q["status_url"], k)
        if s["status"] == "COMPLETED": return req(q["response_url"], k)
        if s["status"] not in ("IN_QUEUE", "IN_PROGRESS"): sys.exit("❌ " + str(s))
        time.sleep(5)

def data_uri(p, mime):
    return "data:%s;base64,%s" % (mime, base64.b64encode(open(p, "rb").read()).decode())

def why(e):   # سبب الرفض بجملة — ⛔ لا تعيد الطلب بلا ما تقرا السبب
    try: return e.read().decode()[:400]
    except Exception: return str(e)

def main():
    if len(sys.argv) < 3: sys.exit(__doc__)
    W = os.path.abspath(sys.argv[1]); mode = sys.argv[2]; k = key(W)
    os.makedirs(os.path.join(W, "ai"), exist_ok=True); os.makedirs(os.path.join(W, "clips"), exist_ok=True)
    if mode == "still":
        t, scene = float(sys.argv[3]), sys.argv[4]; refs = sys.argv[5:]
        fr = os.path.join(W, "ai", "avatar_ref.jpg")
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(t), "-i", os.path.join(W, "cutz.mp4"), "-frames:v", "1", "-q:v", "2", "-y", fr], check=True)
        prompt = ("Photorealistic vertical 9:16 photo. The exact same man from the first image (identical face, beard, hairline, "
                  "skin tone and the same clothes). " + scene + " Camera at chest height facing him, medium-wide shot, his whole body "
                  "visible, head at about 38% of the image height, centered. Calm neutral expression with mouth closed. "
                  "Keep his facial proportions exactly. No text, no logos.")
        try: r = req("https://fal.run/" + IMG_EDIT, k, {"image_urls": [data_uri(fr, "image/jpeg")] + [data_uri(p, "image/jpeg") for p in refs],
                                                         "num_images": 2, "aspect_ratio": "9:16", "output_format": "jpeg", "prompt": prompt})
        except urllib.error.HTTPError as e: sys.exit("❌ رفض التوليد: " + why(e))
        for i, im in enumerate(r["images"]):
            urllib.request.urlretrieve(im["url"], os.path.join(W, "ai", "avatar_still%d.jpg" % i))
        print("✅ ai/avatar_still0.jpg · ai/avatar_still1.jpg — اعرضهم عليه واختر (تكلفة ≈ 0.08$)")
    elif mode == "talk":
        a, b, still = float(sys.argv[3]), float(sys.argv[4]), sys.argv[5]
        name = next((x for x in sys.argv[6:] if not x.startswith("--")), "seat"); dur = b - a
        print("💰 التكلفة المتوقعة ≈ %.2f$ (%.1f ث × 0.115$ — المخرج أحياناً أطول من الصوت بثانية)" % ((dur + 1.5) * 0.115, dur))
        if "--yes" not in sys.argv: sys.exit("   ما صرفت شي. أعد الأمر مع --yes بعد موافقته.")
        au = os.path.join(W, "ai", name + "_voice.mp3")
        subprocess.run(["ffmpeg", "-v", "error", "-ss", str(a), "-t", str(dur), "-i", os.path.join(W, "cutz.mp4"), "-vn", "-ac", "1",
                        "-ar", "44100", "-b:a", "160k", "-y", au], check=True)
        try: r = run(AVATAR, k, {"image_url": data_uri(still, "image/jpeg"), "audio_url": data_uri(au, "audio/mpeg"),
                                 "prompt": "He talks calmly to the camera like a presenter, natural lip movement matching the speech, relaxed "
                                           "neutral expression, not laughing, small natural hand gestures, static camera, background unchanged."})
        except urllib.error.HTTPError as e: sys.exit("❌ رفض الأفاتار: " + why(e))
        mp4 = os.path.join(W, "ai", name + "_avatar.mp4"); urllib.request.urlretrieve(r["video"]["url"], mp4)
        n = int(round(dur * 30))
        for f in os.listdir(os.path.join(W, "clips")):
            if f.startswith(name + "_"): os.remove(os.path.join(W, "clips", f))
        subprocess.run(["ffmpeg", "-v", "error", "-i", mp4, "-vf", "fps=30,scale=1080:1890", "-frames:v", str(n), "-q:v", "2",
                        os.path.join(W, "clips", name + "_%04d.jpg")], check=True)
        print("✅ clips/%s_0001..%04d.jpg — تبدأ عند %.2f ث بالضبط (الشفايف على صوته). الرسم: references/talking-avatar.md" % (name, n, a))
    else: sys.exit(__doc__)

if __name__ == "__main__": main()
