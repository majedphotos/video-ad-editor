# -*- coding: utf-8 -*-
"""توقيت الكلمة على موجة الصوت (6.5) — وِسبر يحط بداية الكلمة قبل نطقها بحوالي 0.1 ث (وأحياناً بعده).
   هذا يدوّر بنافذة صغيرة حول توقيت وِسبر على **أول ارتفاع بالصوت** (نهاية السكتة/الحرف الهادي ← بداية الكلمة)
   ويحط بداية الكلمة عليه. الكلمة اللي ما لها ارتفاع واضح (كلام متصل بلا فاصل) تبقى على توقيت وِسبر.

   يستخدمه 02_captions.py تلقائياً (--no-snap يوقفه). فحص لحاله:
     python3 _onsets.py <work>                 ← يطبع الإزاحات من a.json على صوت المصدر
     python3 _onsets.py <work> --plot out.png  ← رسمة الموجة مع العلامات القديمة (رمادي) والجديدة (أزرق)"""
import os, sys, json, subprocess
import numpy as np

SR = 16000
HOP = 80            # 5ms
WIN = 320           # 20ms
SOURCES = ["src_sdr.mov", "src_fixed.mov", "src.mov", "src.mp4"]


def find_source(W):
    for c in SOURCES:
        p = os.path.join(W, c)
        if os.path.exists(p): return p
    return ""


def load_audio(path, sr=SR):
    raw = subprocess.run(["ffmpeg", "-v", "error", "-i", path, "-vn", "-ac", "1", "-ar", str(sr), "-f", "f32le", "-"],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def envelope(y):
    """طاقة بالديسبل كل 5ms (نافذة 20ms) بعد قص التردد الواطي (طنين الغرفة) — منعّمة 15ms."""
    if len(y) < WIN: return np.zeros(1)
    # هاي باس بسيط ~120Hz عشان طنين المكيف ما يغطي على بداية الكلمة
    a = np.exp(-2 * np.pi * 120 / SR); hp = np.empty_like(y); z = 0.0; px = 0.0
    for i in range(0, len(y)):                       # حلقة بايثون على 16k/ث مقبولة (ريل 60 ث ≈ ثانيتين)
        z = a * (z + y[i] - px); px = y[i]; hp[i] = z
    n = 1 + (len(hp) - WIN) // HOP
    idx = np.arange(WIN)[None, :] + HOP * np.arange(n)[:, None]
    e = np.sqrt(np.mean(hp[idx] ** 2, axis=1) + 1e-12)
    db = 20 * np.log10(e + 1e-9)
    k = np.ones(3) / 3
    return np.convolve(db, k, mode="same")


def snap_words(words, db, back=0.08, fwd=0.20, pre=0.02, rise_min=6.0):
    """words = [[start,end],...] بثواني الصوت. يرجّع قائمة البدايات الجديدة + الإزاحات.
       back/fwd = النافذة حول توقيت وِسبر · pre = نطلّع الكلمة قبل الصوت بـ20ms (العين تحس التأخير أكثر من التبكير)
       rise_min = أقل ارتفاع (ديسبل) نعتبره «بداية كلمة» — أقل منه = كلام متصل، نخلي وِسبر."""
    fps = SR / HOP
    T = lambda t: int(round(t * fps))
    out = []; prev = -1.0
    for (s, e) in words:
        lo = max(0, T(s - back)); hi = min(len(db) - 1, T(min(s + fwd, max(s + 0.06, e - 0.04))))
        new = s
        if hi - lo >= 4:
            seg = db[lo:hi + 1]
            # الوادي: أهدى نقطة بالنص الأول من النافذة (الفاصل بين الكلمتين)
            vh = lo + max(2, int((hi - lo) * 0.7))
            v = lo + int(np.argmin(db[lo:vh]))
            peak = float(np.max(db[v:min(len(db), v + T(0.25))]))
            rise = peak - float(db[v])
            if rise >= rise_min:
                thr = db[v] + max(rise_min * 0.6, 0.30 * rise)
                j = v
                while j < hi and db[j] < thr: j += 1
                if j < hi or db[j] >= thr:
                    new = j / fps - pre
        new = max(new, prev + 0.05)                    # ترتيب الكلمات ما ينقلب
        new = min(new, e - 0.05) if e - 0.05 > prev + 0.05 else new
        out.append(round(new, 3)); prev = new
    return out


def snap_segments(segments, audio_path, **kw):
    """يعدّل a.json (segments→words→start) بمكانه ويرجّع قائمة الإزاحات (ث)."""
    db = envelope(load_audio(audio_path))
    flat = [w for s in segments for w in s.get("words", [])]
    if not flat: return []
    news = snap_words([[w["start"], w["end"]] for w in flat], db, **kw)
    sh = []
    for w, n in zip(flat, news):
        sh.append(round(n - w["start"], 3)); w["start"] = n
        if w["end"] <= n: w["end"] = round(n + 0.12, 3)
    return sh


def report(sh):
    if not sh: return "ما فيه كلمات"
    a = np.array(sh); moved = a[np.abs(a) >= 0.02]
    return (f"توقيت الموجة: {len(moved)}/{len(a)} كلمة تعدّلت · متوسط {np.mean(a)*1000:+.0f}ms · "
            f"أكبر تأخير {np.max(a)*1000:+.0f}ms · أكبر تبكير {np.min(a)*1000:+.0f}ms")


if __name__ == "__main__":
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    W = os.path.abspath(sys.argv[1]); src = find_source(W)
    if not src: sys.exit("❌ ما لقيت فيديو المصدر (src.mov) بمجلد الشغل")
    a = json.load(open(os.path.join(W, "a.json"), encoding="utf-8"))
    old = [[w["start"], w["end"], w.get("word", "")] for s in a["segments"] for w in s.get("words", [])]
    sh = snap_segments(a["segments"], src)
    print(report(sh))
    for (s, e, t), d in zip(old, sh):
        if abs(d) >= 0.02: print(f"  {s:7.2f} → {s+d:7.2f}  ({d*1000:+4.0f}ms) {t.strip()}")
    if "--plot" in sys.argv:
        from PIL import Image, ImageDraw
        outp = sys.argv[sys.argv.index("--plot") + 1]
        db = envelope(load_audio(src)); fps = SR / HOP
        t0 = float(sys.argv[sys.argv.index("--from") + 1]) if "--from" in sys.argv else 0.0
        t1 = float(sys.argv[sys.argv.index("--to") + 1]) if "--to" in sys.argv else min(len(db) / fps, t0 + 6)
        Wd, Hd = 1800, 420; im = Image.new("RGB", (Wd, Hd), (18, 18, 22)); d = ImageDraw.Draw(im)
        x = lambda t: int((t - t0) / (t1 - t0) * Wd)
        lo, hi = -70.0, float(np.max(db)) + 3
        pts = [(x(i / fps), int(Hd - 30 - (max(lo, db[i]) - lo) / (hi - lo) * (Hd - 60))) for i in range(int(t0 * fps), min(len(db), int(t1 * fps)))]
        d.line(pts, fill=(200, 200, 210), width=2)
        for (s, e, t), dd in zip(old, sh):
            if t0 <= s <= t1:
                d.line([(x(s), 0), (x(s), Hd)], fill=(110, 110, 110), width=1)
                d.line([(x(s + dd), 20), (x(s + dd), Hd)], fill=(80, 160, 255), width=3)
        im.save(outp); print("→", outp)
