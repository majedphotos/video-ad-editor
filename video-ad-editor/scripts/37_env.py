# -*- coding: utf-8 -*-
"""🆕 6.0 موجة صوته الحقيقي — غلاف الصوت (loudness) لكل فريم، عشان الرسم يتحرك مع كلامه فعلاً (ريل بوبيان).
   python3 37_env.py <work> [--src cutz.mp4] [--fps 30]
   - يقرا صوت الفيديو المقصوص (cutz.mp4 — نفس توقيت caps.json) ويكتب <work>/env.js:
       window.ENV=[0..1 لكل فريم]
   - بـcompose.html: <script src="env.js"></script> قبل مشاهدك، وبالمشهد: MV.env(t) → 0..1 (صفر = سكتة).
   - مثال (موجة أعمدة ورا راسه): ارتفاع العمود = 18 + 420 * MV.env(t - تأخير) — شوف references/moves.md «لحظات العمق»."""
import sys, os, json, subprocess
import numpy as np

def main():
    a = sys.argv[1:]
    pos = [x for i, x in enumerate(a) if not x.startswith("--") and (i == 0 or a[i - 1] not in ("--src", "--fps"))]
    if not pos: print(__doc__); sys.exit(1)
    W = os.path.abspath(pos[0])
    src = a[a.index("--src") + 1] if "--src" in a else "cutz.mp4"
    src = src if os.path.isabs(src) else os.path.join(W, src)
    fps = int(a[a.index("--fps") + 1]) if "--fps" in a else 30
    if not os.path.exists(src): sys.exit(f"❌ ما لقيت {src} — شغّل 03_cut_zoom.py أول (أو --src)")
    sr = 16000
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", src, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    if not len(x): sys.exit("❌ الفيديو بلا صوت")
    hop = sr // fps; n = int(np.ceil(len(x) / hop))
    x = np.pad(x, (0, n * hop - len(x)))
    rms = np.sqrt((x.reshape(n, hop) ** 2).mean(1) + 1e-12)
    db = 20 * np.log10(rms)
    lo, hi = np.percentile(db, 10), np.percentile(db, 98)
    e = np.clip((db - (lo + 6)) / max(1e-6, hi - (lo + 6)), 0, 1)      # تحت أرضية الضجيج + 6 dB = صفر
    k = np.array([0.25, 0.5, 0.25]); e = np.convolve(np.pad(e, 1, mode="edge"), k, "valid")   # تنعيم خفيف (فريم)
    open(os.path.join(W, "env.js"), "w").write("window.ENV=" + json.dumps([round(float(v), 3) for v in e]) + ";\n")
    print(f"→ env.js · {n} فريم ({n / fps:.2f} ث) · متوسط {e.mean():.2f} — أضف <script src=\"env.js\"></script> واستخدم MV.env(t)")

if __name__ == "__main__":
    main()
