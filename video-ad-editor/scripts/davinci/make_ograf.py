"""يحوّل مشهد من حزمة الموشن (motion-kit) لرسم OGraf شفاف يشتغل داخل دافنشي 21+ (مجرّب 2 أكتوبر 2026 على ستوديو 21.1).
التشغيل: python3 make_ograf.py <work> <scene.js> <المدة بالثواني> [--theme theme.json]
scene.js = ملف فيه:  export function draw(t, X, W, H, MK) { MK.odometer(t, {...}); ... }   ← t بالثواني من بداية الرسم
يطلّع مجلد جديد كل مرة <work>/ograf/<اسم>_vN/ (دافنشي يكاشّ نفس المسار) ويطبع مسار الـmanifest:
  - حطه بـOGrafLoader → TemplatePath (نفس مكان ملف اللوتي بـdavinci_build.py / davinci_reels.py)
  - أو افحصه بالمتصفح قبل دافنشي: python3 make_ograf.py … --shot 1.0 2.5 4.0 → <المجلد>/sheet.jpg
"""
import sys, os, json, shutil, subprocess, argparse
HERE = os.path.dirname(os.path.abspath(__file__)); SCRIPTS = os.path.dirname(HERE)
ap = argparse.ArgumentParser()
ap.add_argument("work"); ap.add_argument("scene"); ap.add_argument("secs", type=float)
ap.add_argument("--theme", default=None); ap.add_argument("--shot", nargs="*", type=float, default=None)
a = ap.parse_args()
name = os.path.basename(a.scene).removesuffix(".js").removesuffix(".ograf").replace(".", "-")
root = os.path.join(os.path.abspath(a.work), "ograf"); os.makedirs(root, exist_ok=True)
n = 1
while os.path.exists(os.path.join(root, f"{name}_v{n}")): n += 1
D = os.path.join(root, f"{name}_v{n}"); os.makedirs(D)
tp = a.theme or os.path.join(a.work, "theme.json")
t = json.load(open(tp, encoding="utf-8")) if os.path.exists(tp) else {}
theme = {k: t.get(k, d) for k, d in [("bg", "#F0EEE6"), ("ink", "#1F1F1D"), ("acc", "#D97757"), ("clay", "#BD5D3A"), ("mut", "#7A7A75"), ("font", "Cairo")]}
shutil.copy(os.path.join(SCRIPTS, "motion-kit.js"), D)
shutil.copy(os.path.join(HERE, "ograf_wrap.js"), os.path.join(D, "main.js"))
shutil.copy(a.scene, os.path.join(D, "scene.js"))
open(os.path.join(D, "theme.js"), "w", encoding="utf-8").write("export default " + json.dumps(theme, ensure_ascii=False) + ";\n")
man = {"$schema": "https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json",
       "id": f"mk-{name}-v{n}", "name": f"MK {name} v{n}", "main": "main.js",
       "supportsRealTime": False, "supportsNonRealTime": True, "stepCount": 1,
       "v_bmd": {"duration": round(a.secs, 2)}, "schema": {"type": "object", "properties": {}}}
mp = os.path.join(D, f"{name}.ograf.json"); json.dump(man, open(mp, "w"), indent=1)
print(f"✅ {mp}", flush=True)
if a.shot:   # فحص بالمتصفح بنفس دورة حياة دافنشي (load ← goToTime) قبل ما نفتح دافنشي
    r = subprocess.run(["node", os.path.join(HERE, "ograf_shot.js"), D, os.path.join(D, "sheet.jpg")] + [str(s) for s in a.shot])
    sys.exit(r.returncode)
