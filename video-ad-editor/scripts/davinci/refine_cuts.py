"""يمط القطع لين تخلص الكلمة — عشان القص على نهاية الكلمة ما ياكل آخرها («أسكّر حسا…»).
النهاية تنتقل لأول سكتة بعد الكلمة (لين 1.2 ث)، والبداية لآخر سكتة قبلها (لين 0.6 ث). مجرّب على ريلات المقابلة v2.
التشغيل: python3 refine_cuts.py <الأصل.mp4> reels.json reels_v2.json
reels.json = {"اسم الريل": [[بداية, نهاية], ...]} بثواني الأصل — يطبع كل قطعة كم انمطّت.
بعدها: الكابشن ينبني على القطع الجديدة (reel_captions.py) ثم davinci_reels.py.
"""
import json, subprocess, sys
import numpy as np
SR = 16000
SRC, IN, OUT = sys.argv[1:4]


def rms_db(t0, dur):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{max(0, t0):.3f}", "-t", f"{dur:.3f}", "-i", SRC, "-ac", "1",
                          "-ar", str(SR), "-f", "s16le", "-"], capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
    hop = SR // 100; n = len(x) // hop
    return np.array([20 * np.log10(np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) + 1e-9) for i in range(n)])


def quiet_runs(db, thr, need=8):
    q = db < thr; runs = []; i = 0
    while i < len(q):
        if q[i]:
            j = i
            while j < len(q) and q[j]: j += 1
            if j - i >= need: runs.append((i, j))
            i = j
        else: i += 1
    return runs


R = json.load(open(IN)); out = {}
for name, segs in R.items():
    ns = []
    for a, b in segs:
        db = rms_db(b - 0.3, 1.5); thr = np.percentile(db, 60) - 12               # النهاية: أول سكتة بعد الكلمة
        runs = [r for r in quiet_runs(db, thr) if r[0] >= 25]
        nb = b - 0.3 + (runs[0][0] + 4) / 100 if runs else b + 0.35
        db2 = rms_db(a - 0.6, 0.75); thr2 = np.percentile(db2, 60) - 12           # البداية: آخر سكتة قبلها
        runs2 = [r for r in quiet_runs(db2, thr2, 5) if r[1] <= 62]
        na = a - 0.6 + (runs2[-1][1] - 3) / 100 if runs2 else a - 0.12
        ns.append([round(max(0, na), 2), round(nb, 2)])
        print(f"{name[:16]:16s} [{a:.2f},{b:.2f}] → [{ns[-1][0]:.2f},{nb:.2f}]  (+{nb - b:.2f} آخر · -{a - ns[-1][0]:.2f} أول)")
    out[name] = ns
json.dump(out, open(OUT, "w"), ensure_ascii=False)
print(f"✅ {OUT}")
