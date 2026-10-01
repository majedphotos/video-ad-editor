# -*- coding: utf-8 -*-
"""🔬 فحص الإضاءة والألوان (سكوبس) — قبل أي تعديل لوني (30 سبتمبر، مأخوذة من فكرة Palmier).

  python3 25_scopes.py <work|فيديو> [--n 12] [--json out.json]

يقيس عيّنات من الفيديو: نقطة الأسود والأبيض · نسبة الاحتراق (أبيض/أسود مقصوص) · متوسط الإضاءة ·
ميل الحرارة (دافي/بارد) · ميل أخضر/بنفسجي · التشبّع. ويطلع حكماً بكلام بشري + تصحيحاً مقترحاً.

⛔ القاعدة 4: هذا **فحص** بس — ما يغيّر شي. لو طلع فيه مشكلة قل له بجملة
   («الفيديو غامج شوي ومايل للأصفر — أعدّله؟»)، ولو وافق: theme.json ← "grade":"auto"
   و03_cut_zoom.py يطبّق التصحيح المحسوب هني (scopes.json) بدل التدرّج الجاهز.
"""
import json, os, subprocess, sys

W_S, H_S = 192, 108          # عيّنة صغيرة تكفي للإحصاء


def die(m):
    print("❌ " + m)
    sys.exit(2)


def flag(args, name, default, cast=str):
    if name in args:
        i = args.index(name)
        if i + 1 < len(args):
            try:
                return cast(args[i + 1])
            except Exception:
                pass
    return default


def duration(p):
    o = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of",
                        "csv=p=0", p], capture_output=True, text=True).stdout.strip()
    try:
        return float(o)
    except ValueError:
        return 0.0


def frames(path, n):
    """n عيّنة موزّعة بالتساوي (بلا أول وآخر 5%) — RGB صغيرة."""
    import numpy as np
    dur = duration(path)
    ts = [dur * (0.05 + 0.9 * (k + 0.5) / n) for k in range(n)] if dur > 0 else [0.0]
    out = []
    for t in ts:
        r = subprocess.run(["ffmpeg", "-v", "error", "-ss", f"{t:.3f}", "-i", path, "-frames:v", "1",
                            "-vf", f"scale={W_S}:{H_S}:flags=area,format=rgb24", "-f", "rawvideo", "-"],
                           capture_output=True)
        if len(r.stdout) == W_S * H_S * 3:
            out.append(np.frombuffer(r.stdout, np.uint8).reshape(H_S, W_S, 3).astype(np.float32))
    return out, ts


def measure(imgs):
    import numpy as np
    x = np.stack(imgs)                                         # n × h × w × 3
    R, G, B = x[..., 0], x[..., 1], x[..., 2]
    Y = 0.2126 * R + 0.7152 * G + 0.0722 * B                   # إضاءة BT.709
    mx, mn = x.max(-1), x.min(-1)
    sat = np.where(mx > 8, (mx - mn) / np.maximum(mx, 1), 0)
    # الميل اللوني يُقاس على البكسلات «المحايدة» بس (جدار · رمادي · أبيض متوسط) — البشرة والخشب
    # دافيين بطبيعتهم وما يعنون إن الكاميرا مايلة. لو ما فيه محايد كفاية نرجع للمتوسط كله بحذر.
    mid = (Y > 40) & (Y < 215)
    neu = mid & (sat < 0.22)
    trust = 1.0
    if neu.mean() < 0.04:
        neu, trust = mid, 0.5
    if neu.sum() < 50:
        neu, trust = np.ones_like(Y, bool), 0.5
    r, g, b = R[neu].mean(), G[neu].mean(), B[neu].mean()
    return {
        "black": round(float(np.percentile(Y, 1)), 1),
        "white": round(float(np.percentile(Y, 99)), 1),
        "median": round(float(np.median(Y)), 1),
        "mean": round(float(Y.mean()), 1),
        "clip_black": round(float((Y <= 4).mean() * 100), 2),     # ٪
        "clip_white": round(float((Y >= 251).mean() * 100), 2),   # ٪
        "warm": round(float((r - b) / 255 * trust), 3),           # موجب = دافي/أصفر · سالب = بارد/أزرق
        "green": round(float((g - (r + b) / 2) / 255 * trust), 3),  # موجب = أخضر · سالب = بنفسجي
        "neutral": round(float(neu.mean() * 100), 1) if trust == 1.0 else 0.0,  # ٪ بكسلات محايدة
        "neu_rgb": [round(float(v), 1) for v in (r, g, b)],
        "trust": trust,
        "sat": round(float(sat.mean()), 3),
        "per_frame_median": [round(float(np.median(y)), 1) for y in Y],
    }


def verdict(m):
    """مشاكل بكلام بشري + تصحيح ffmpeg خفيف (يعدّل اللي فيه مشكلة بس).
    الترتيب: توازن اللون ← مدّ الأسود/الأبيض (colorlevels) ← الإضاءة الوسطى (gamma)."""
    issues, cb, lv, eq = [], {}, None, {}
    bl, wh, med = m["black"], m["white"], m["median"]
    dark = med < 75 and wh < 215
    bright = med > 175 or m["clip_white"] > 4
    flat = wh - bl < 130 and m["clip_white"] < 1 and m["clip_black"] < 1
    if dark:
        issues.append("غامج — الإضاءة ناقصة")
    elif bright:
        issues.append("فاتح زيادة" + (" — فيه مناطق محروقة" if m["clip_white"] > 4 else ""))
    if m["clip_black"] > 6:
        issues.append("فيه أسود مقصوص (ظلال ضايعة)")
    if flat:
        issues.append("باهت (التباين ضعيف — يمكن مصوّر بلوق)")
    # توازن الأبيض = ضرب كل قناة بمعامل (colorchannelmixer) — colorbalance ما يحرّك الدرجات الوسطى
    #  نقرّب المحايد 85٪ من الرمادي بس، عشان يبقى شوية دفء طبيعي
    warm_bad, green_bad = abs(m["warm"]) > 0.05, abs(m["green"]) > 0.04
    if warm_bad:
        issues.append("مايل للأصفر" if m["warm"] > 0 else "مايل للأزرق")
    if green_bad:
        issues.append("مايل للأخضر" if m["green"] > 0 else "مايل للبنفسجي")
    if warm_bad or green_bad:
        r, g, b = m["neu_rgb"]
        t = (r + g + b) / 3
        st = 0.85 if m["trust"] == 1.0 else 0.4        # بلا بكسلات محايدة؟ نص القوة بس
        gain = lambda c: max(0.75, min(1.3, 1 + st * (t / max(c, 1) - 1)))
        cb["rr"], cb["gg"], cb["bb"] = gain(r), gain(g), gain(b)
        if not warm_bad:                    # نعدّل المحور المايل بس
            cb["rr"] = cb["bb"] = (cb["rr"] + cb["bb"]) / 2
        if not green_bad:
            cb["gg"] = 1.0
    # مدّ النطاق: الأسود ينزل قريب 10 والأبيض يطلع قريب 240 — بس لو فيه مجال فعلي
    lo, hi = 0.0, 255.0
    if (dark or flat) and (bl > 20 or wh < 225):
        lo = max(0.0, bl - 10) if bl > 20 else 0.0
        hi = min(255.0, wh + 15) if wh < 225 else 255.0
        if hi - lo < 255 / 1.6:                          # سقف المدّ 1.6× — أكثر يحرق البشرة
            c, w = (lo + hi) / 2, 255 / 1.6              # نوسّع من الطرفين حول الوسط
            lo = max(0.0, min(c - w / 2, 255 - w))
            hi = lo + w
        if hi - lo > 60:
            lv = f"colorlevels=rimin={lo/255:.3f}:gimin={lo/255:.3f}:bimin={lo/255:.3f}" \
                 f":rimax={hi/255:.3f}:gimax={hi/255:.3f}:bimax={hi/255:.3f}"
        else:
            lo, hi = 0.0, 255.0
    med2 = (med - lo) / (hi - lo) * 255                      # الإضاءة الوسطى بعد المدّ
    if dark and med2 < 95:
        eq["gamma"] = round(min(1.45, max(1.05, (115 / max(med2, 20)) ** 0.6)), 2)
    elif bright:
        eq["gamma"] = round(max(0.8, min(0.95, (140 / med) ** 0.5)), 2)
    if m["sat"] < 0.10:
        issues.append("الألوان باهتة")
        eq["saturation"] = 1.15
    pf = m["per_frame_median"]                                 # غيمة · لمبة · تعريض تلقائي
    if len(pf) > 3 and max(pf) - min(pf) > 55:
        issues.append("الإضاءة تتغيّر بين أجزاء الفيديو")
    return issues, {"cb": cb, "lv": lv, "eq": eq, "dark": dark, "bright": bright}


def build_fx(P):
    fx = []
    if P["cb"]:
        fx.append("colorchannelmixer=" + ":".join(f"{k}={v:.3f}" for k, v in P["cb"].items()))
    if P["lv"]:
        fx.append(P["lv"])
    if P["eq"]:
        fx.append("eq=" + ":".join(f"{k}={v:.2f}" for k, v in P["eq"].items()))
    return ",".join(fx)


def apply_fx(imgs, fx):
    """نمرّر العيّنات الصغيرة نفسها على التصحيح بـffmpeg — نفس الفلتر اللي بيتطبّق على الفيديو."""
    import numpy as np
    raw = b"".join(i.astype(np.uint8).tobytes() for i in imgs)
    r = subprocess.run(["ffmpeg", "-v", "error", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W_S}x{H_S}",
                        "-i", "-", "-vf", fx, "-f", "rawvideo", "-pix_fmt", "rgb24", "-"],
                       input=raw, capture_output=True)
    n = W_S * H_S * 3
    if r.returncode or len(r.stdout) != n * len(imgs):
        return None
    return [np.frombuffer(r.stdout[k * n:(k + 1) * n], np.uint8).reshape(H_S, W_S, 3).astype(np.float32)
            for k in range(len(imgs))]


def refine(imgs, P, rounds=6):
    """الإضاءة: التقدير الأول يخطّي (المدّ وgamma يتضاعفون) — نجرّب على العيّنات ونعدّل لين يوقف بالنص."""
    eq = P["eq"]
    for _ in range(rounds):
        fx = build_fx(P)
        if not fx:
            return fx, None
        out = apply_fx(imgs, fx)
        if out is None:
            return fx, None
        m2 = measure(out)
        ok = True
        if "gamma" in eq and (P["dark"] and not 100 <= m2["median"] <= 130
                              or P["bright"] and not 120 <= m2["median"] <= 160):
            tgt = 115 if P["dark"] else 140
            eq["gamma"] = max(0.7, min(1.8, eq["gamma"] * (tgt / max(m2["median"], 10)) ** 0.7))
            ok = False
        if ok:
            break
    # لمسة لون أخيرة: مدّ النطاق يكبّر أي ميل خفيف كان مخفي — نقيس بعده ونعدّل المعاملات
    for _ in range(3):
        out = apply_fx(imgs, build_fx(P))
        if out is None:
            break
        m2 = measure(out)
        if m2["trust"] < 1.0 or (abs(m2["warm"]) <= 0.035 and abs(m2["green"]) <= 0.03):
            break
        r, g, b = m2["neu_rgb"]
        t = (r + g + b) / 3
        cb = P["cb"]
        for k, c in (("rr", r), ("gg", g), ("bb", b)):
            cb[k] = max(0.75, min(1.3, cb.get(k, 1.0) * (1 + 0.85 * (t / max(c, 1) - 1))))
    fx = build_fx(P)
    out = apply_fx(imgs, fx) if fx else None
    return fx, (measure(out) if out else None)


def main(a):
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    tgt = os.path.abspath(a[0])
    if os.path.isdir(tgt):
        W = tgt
        src = next((os.path.join(W, f) for f in ("src_sdr.mov", "src.mov", "cutz.mp4")
                    if os.path.exists(os.path.join(W, f))), None)
        if not src:
            die("ما لقيت src.mov بمجلد الشغل")
        out = os.path.join(W, "scopes.json")
    else:
        src, W = tgt, os.path.dirname(tgt)
        out = os.path.splitext(tgt)[0] + ".scopes.json"
    out = flag(a, "--json", out)
    imgs, _ = frames(src, flag(a, "--n", 12, int))
    if not imgs:
        die("ما قدرت أطلع صور من الفيديو")
    m = measure(imgs)
    issues, P = verdict(m)
    fix, after = refine(imgs, P) if issues else ("", None)
    res = {"src": os.path.basename(src), **{k: v for k, v in m.items() if k != "per_frame_median"},
           "issues": issues, "fix": fix}
    if after:
        res["after"] = {k: after[k] for k in ("median", "black", "white", "warm", "green", "sat")}
    json.dump(res, open(out, "w"), ensure_ascii=False, indent=1)
    print(f"🔬 {res['src']}: إضاءة {m['median']:.0f}/255 · أسود {m['black']:.0f} · أبيض {m['white']:.0f}"
          f" · محروق {m['clip_white']}٪ · حرارة {m['warm']:+.2f} · أخضر {m['green']:+.2f} · تشبّع {m['sat']:.2f}")
    if issues:
        print("⚠️  " + " · ".join(issues))
        print("   التصحيح المقترح (ما يتطبّق إلا بموافقته ← theme.json \"grade\":\"auto\"): " + (fix or "—"))
        if after:
            print(f"   بعده: إضاءة {after['median']:.0f} · أسود {after['black']:.0f} · أبيض {after['white']:.0f}"
                  f" · حرارة {after['warm']:+.2f} · أخضر {after['green']:+.2f}")
    else:
        print("✅ الإضاءة والألوان سليمة — لا تلمسها.")
    print("→ " + out)


if __name__ == "__main__":
    main(sys.argv[1:])
