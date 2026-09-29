# -*- coding: utf-8 -*-
"""🥁 كاشف الإيقاع — يطلع السرعة (BPM) ومواقع النبضات والضربات القوية من أي ملف صوت أو فيديو.

  python3 beat.py <ملف_صوت_أو_فيديو> [--out beats.json]
        [--bpm 120]        سرعة يدوية (لو الكشف طلع نص أو ضعف السرعة الصحيحة)
        [--offset 0.00]    يزيح كل الأوقات (ثوانٍ؛ سالب = أبكر). لو الأغنية تبدأ بعد أول الفيديو بـ1.2 ث حط 1.2
        [--start 0 --end 0] نافذة من الملف (الأوقات بالمخرَج تبدأ من --start = صفر)
        [--grid]           شبكة ثابتة بالسرعة (للأغاني الإلكترونية) بدل التتبّع المرن
        [--bar 4]          كم نبضة بالمازورة (للضربة الأولى بكل مازورة)
        [--click]          يطلع <out>.click.wav: الأغنية + تكّة على كل نبضة (أعلى على الضربات) — اسمعه وتأكد

المخرَج beats.json:
  {bpm, beats:[ث…], accents:[ث…], downbeats:[ث…], drops:[ث…], energy:[0..1 لكل نبضة],
   strength:[0..1 لكل نبضة], hits:[ث… ضربات قوية خارج الشبكة], onsets:[[ث, قوة]…], duration, offset}
  • beats     = كل نبضة (القطع والمؤثرات الخفيفة)
  • accents   = الضربات القوية (أول المازورة القوية + أقوى النبضات + الانفجارات) — المؤثرات الكبيرة هني
  • drops     = لحظة ما الأغنية «تنفجر» (المازورة الجاية أعلى بـ4.5 ديسبل أو أكثر) — أكبر مؤثر بالفيديو
  • energy    = طاقة قسم الأغنية حول كل نبضة (متوسط مازورة، 1 = أعلى قسم، كل 15 ديسبل أهدى = 0)
                — المصمّم الآلي يخلي شدة المؤثر تمشي معها. strength = قوة النبضة نفسها (كيك أقوى من سنير)
  • onsets    = كل ضربة مسموعة (طبل/تصفيق/مؤثر صوتي) بقوتها — للقطع الحر لما الأغنية مو على شبكة ثابتة

بلا librosa: numpy + scipy بس (نفس خوارزمية تتبّع النبضة بالبرمجة الديناميكية — Ellis 2007).
"""
import json, os, subprocess, sys
import numpy as np

SR = 22050
HOP = 256                      # 11.6 ملّي ثانية — أدق من فريم الفيديو (33 ملّي) بثلاث مرات
NFFT = 1024                    # نافذة 46 ملّي: أصغر = الضربة ما تنكشف قبل وقتها (2048 كانت تبكّر 28 ملّي)
LAT = 0.009                    # تعويض التبكير الباقي — مقاس على ضربات صناعية معروفة التوقيت (120/87/140 BPM: ‎-8.7±3 ملّي)
FR = SR / HOP                  # فريمات الغلاف بالثانية


def die(m):
    print("❌ " + m)
    sys.exit(2)


def flag(args, name, default, cast=float):
    if name in args:
        i = args.index(name)
        if i + 1 < len(args):
            try:
                return cast(args[i + 1])
            except Exception:
                die(f"قيمة {name} مو صحيحة: {args[i + 1]}")
    return default


def load_audio(path, start=0.0, end=0.0):
    cmd = ["ffmpeg", "-v", "error", "-nostdin"]
    if start > 0:
        cmd += ["-ss", f"{start:.3f}"]
    cmd += ["-i", path]
    if end > start:
        cmd += ["-t", f"{end - start:.3f}"]
    cmd += ["-vn", "-ac", "1", "-ar", str(SR), "-f", "s16le", "-"]
    r = subprocess.run(cmd, capture_output=True)
    if r.returncode or not r.stdout:
        die("ما قدرت أقرأ الصوت من الملف (فيه مسار صوت؟) — " + r.stderr.decode(errors="ignore")[-300:])
    return np.frombuffer(r.stdout, dtype=np.int16).astype(np.float32) / 32768.0


def stft_mag(y):
    pad = NFFT // 2
    y = np.pad(y, (pad, pad), mode="reflect")
    n = 1 + (len(y) - NFFT) // HOP
    win = np.hanning(NFFT).astype(np.float32)
    idx = np.arange(NFFT)[None, :] + HOP * np.arange(n)[:, None]
    out = np.empty((n, NFFT // 2 + 1), dtype=np.float32)
    step = 2048                                  # على دفعات — ما ينفجر بالذاكرة لأغنية طويلة
    for a in range(0, n, step):
        fr = y[idx[a:a + step]] * win
        out[a:a + step] = np.abs(np.fft.rfft(fr, axis=1))
    return out


def band_edges(n_bands=40, fmin=30.0, fmax=8000.0):
    """حزم لوغاريتمية (قريبة من الميل) — تجمع الطيف قبل حساب التغيّر."""
    freqs = np.linspace(0, SR / 2, NFFT // 2 + 1)
    edges = np.geomspace(fmin, fmax, n_bands + 1)
    return freqs, edges


def onset_env(S):
    freqs, edges = band_edges()
    B = np.stack([S[:, (freqs >= edges[i]) & (freqs < edges[i + 1])].sum(axis=1) + 1e-9
                  for i in range(len(edges) - 1)], axis=1)
    L = np.log1p(100.0 * B / (B.max() + 1e-9))
    flux = np.maximum(0.0, np.diff(L, axis=0, prepend=L[:1]))
    full = flux.mean(axis=1)
    low = flux[:, edges[1:] <= 200].mean(axis=1)        # الطبل/الكيك
    # طرح المتوسط المتحرك — يخلي القمم نسبية للمقطع (ما يغرق الهادئ تحت الصاخب)
    from scipy.ndimage import uniform_filter1d
    def norm(e):
        e = e - uniform_filter1d(e, size=int(FR * 0.5))
        e = np.maximum(e, 0)
        return e / (e.max() + 1e-9)
    return norm(full), norm(low)


def rms_env(y):
    n = 1 + len(y) // HOP
    yy = np.pad(y, (0, n * HOP - len(y) + NFFT))
    fr = np.lib.stride_tricks.sliding_window_view(yy, NFFT)[::HOP][:n]
    return np.sqrt((fr ** 2).mean(axis=1) + 1e-12)


def grid_fit(m2, bpm):
    """متوسط الغلاف على أفضل شبكة ثابتة بهالسرعة (أفضل طور) — كم الشبكة «تركب» على الضربات."""
    P = 60.0 * FR / bpm
    best = 0.0
    for ph in np.arange(0, P, 1.0):
        idx = np.round(np.arange(ph, len(m2), P)).astype(int)
        idx = idx[idx < len(m2)]
        if len(idx):
            best = max(best, float(m2[idx].mean()))
    return best


def estimate_tempo(env, lo=60.0, hi=190.0):
    """مرشحين من الارتباط الذاتي + فحص الشبكة لكل مرشح + تفضيل خفيف (أوكتاف) حول 110.
    (الارتباط الذاتي وحده يخلط بين 96 و126 بالأغاني اللي فيها ثلاثيات — الشبكة تفصل بينهم)"""
    from scipy.ndimage import maximum_filter1d
    m2 = maximum_filter1d(env, 5)                      # سماحية ±2 فريم (±23 ملّي)
    e = env - env.mean()
    n = len(e)
    f = np.fft.rfft(e, 2 * n)
    ac = np.fft.irfft(f * np.conj(f))[:n]
    ac /= ac[0] + 1e-9
    cands = set()
    for L in range(int(60 * FR / hi), min(int(60 * FR / lo) + 2, n - 1)):
        if ac[L] > ac[L - 1] and ac[L] >= ac[L + 1] and ac[L] > 0.02:
            for k in (0.5, 1.0, 2.0):
                bpm = 60.0 * FR / L * k
                if lo <= bpm <= hi:
                    cands.add(round(bpm, 1))
    if not cands:
        cands = {120.0}
    scored = []
    for c in sorted(cands):
        # دقّة: جرّب ±1.5 حول المرشح
        fits = [(grid_fit(m2, c + d), c + d) for d in np.arange(-1.5, 1.51, 0.25)]
        g, bpm = max(fits)
        prior = np.exp(-0.5 * (np.log2(bpm / 110.0) / 1.0) ** 2)
        scored.append((g * prior, g, bpm))
    scored.sort(reverse=True)
    _, g, bpm = scored[0]
    # التحرير يحب 75-150: لو طلعت بطيئة والضعف يركب تقريباً بنفس القوة، خذ الضعف
    if bpm < 75:
        g2 = grid_fit(m2, bpm * 2)
        if g2 >= 0.85 * g:
            bpm *= 2
    return bpm


def track_beats(env, bpm, tight=100.0):
    """برمجة ديناميكية: كل نبضة = قمة بالغلاف، والمسافة بينها قريبة من الدور."""
    P = 60.0 * FR / bpm
    n = len(env)
    # غلاف مصقول بنافذة قدّ الدور — يخفّف الضوضاء
    w = np.exp(-0.5 * ((np.arange(-int(P), int(P) + 1)) / (P / 32.0)) ** 2)
    loc = np.convolve(env, w, mode="same")
    loc = loc / (loc.std() + 1e-9)
    score = loc.copy()
    back = -np.ones(n, dtype=int)
    rng = np.arange(-int(round(2 * P)), -int(round(P / 2)) + 1)
    pen = -tight * (np.log(-rng / P)) ** 2
    for t in range(n):
        z = t + rng
        m = z >= 0
        if not m.any():
            continue
        cand = score[z[m]] + pen[m]
        k = int(np.argmax(cand))
        if cand[k] > 0:
            score[t] = loc[t] + cand[k]
            back[t] = z[m][k]
    # آخر نبضة: أعلى درجة بآخر دور، ثم رجوع
    tail = max(1, int(P))
    # نختار من بين القمم المحلية بآخر المقطع
    t = n - tail + int(np.argmax(score[n - tail:]))
    beats = []
    while t >= 0:
        beats.append(t)
        t = back[t]
    beats = np.array(beats[::-1])
    # نشيل النبضات بالسكوت بالأطراف (قبل أول صوت / بعد آخره)
    thr = 0.5 * np.median(loc[beats]) if len(beats) else 0
    keep = np.ones(len(beats), bool)
    i = 0
    while i < len(beats) and loc[beats[i]] < thr:
        keep[i] = False; i += 1
    j = len(beats) - 1
    while j > i and loc[beats[j]] < thr:
        keep[j] = False; j -= 1
    return beats[keep]


def grid_beats(env, bpm, n):
    """شبكة ثابتة: أفضل طور (phase) يطابق القمم."""
    P = 60.0 * FR / bpm
    best, bp = -1, 0.0
    for ph in np.arange(0, P, 0.5):
        idx = np.round(np.arange(ph, n, P)).astype(int)
        idx = idx[idx < n]
        v = env[idx].sum()
        if v > best:
            best, bp = v, ph
    idx = np.round(np.arange(bp, n, P)).astype(int)
    return idx[idx < n]


def refine(beats, env, rad=2):
    """يقرّب كل نبضة لأعلى قمة قريبة (±23 ملّي) — الضربة الحقيقية مو منتصف الشبكة."""
    out = []
    for b in beats:
        a, c = max(0, b - rad), min(len(env), b + rad + 1)
        out.append(a + int(np.argmax(env[a:c])))
    return np.array(out)


def main():
    a = sys.argv[1:]
    if not a or a[0].startswith("-"):
        print(__doc__)
        sys.exit(1)
    src = a[0]
    if not os.path.exists(src):
        die("الملف مو موجود: " + src)
    out = flag(a, "--out", os.path.join(os.path.dirname(os.path.abspath(src)), "beats.json"), str)
    man_bpm = flag(a, "--bpm", 0.0)
    offset = flag(a, "--offset", 0.0)
    start = flag(a, "--start", 0.0)
    end = flag(a, "--end", 0.0)
    bar = int(flag(a, "--bar", 4))
    grid = "--grid" in a

    y = load_audio(src, start, end)
    dur = len(y) / SR
    if dur < 1.0:
        die("الصوت أقصر من ثانية — ما يكفي للكشف.")
    S = stft_mag(y)
    env, low = onset_env(S)
    mix = 0.6 * env + 0.4 * low                         # الكيك يثبّت الإيقاع، والكل يلقط اللي بلا طبل
    rms = rms_env(y)[:len(env)]

    bpm = man_bpm if man_bpm > 0 else estimate_tempo(mix)
    bi = grid_beats(mix, bpm, len(mix)) if grid else track_beats(mix, bpm)
    if not grid:
        bi = refine(bi, mix)
    bi = np.unique(bi)
    if len(bi) < 2:
        die("ما لقيت نبضات واضحة — جرّب --bpm يدوياً أو --grid.")
    if not man_bpm:                                      # السرعة الفعلية من النبضات نفسها
        bpm = 60.0 * FR / float(np.median(np.diff(bi)))

    # قوة كل نبضة (قمة الغلاف ±50 ملّي، الكيك بوزن أعلى) + طاقة الأغنية حولها
    rad = int(0.05 * FR)
    strength = np.array([max(mix[max(0, b - rad):b + rad + 1].max(), 0) for b in bi])
    lowS = np.array([low[max(0, b - rad):b + rad + 1].max() for b in bi])
    half = int(0.5 * 60 * FR / bpm)
    en = np.array([rms[max(0, b - half):b + half + 1].mean() for b in bi])
    pw = en ** 2
    # طاقة «القسم» مو طاقة النبضة: متوسط قدرة على مازورة كاملة حول كل نبضة (نافذة [½,1,1,1,½]/4 —
    # تلغي تذبذب كيك/سنير بدور نبضتين وأربع). قبل كانت نص نبضة بس، فتتأرجح 0.6 ↔ 0.0 بأغنية ثابتة.
    wN = np.array([0.5] + [1.0] * (bar - 1) + [0.5]); wN /= wN.sum()
    hb = bar // 2
    pwp = np.pad(pw, (hb, hb), mode="edge")
    pw_s = np.convolve(pwp, wN, mode="valid")[:len(pw)]
    en_db = 10 * np.log10(pw_s + 1e-12)
    # مقياس مطلق بالديسبل: أعلى قسم = 1، وكل 15 ديسبل أهدى = صفر. أغنية ثابتة تطلع ~1 بكل مكان
    # (ما نمطّ الفروق الصغيرة لين 0..1 — كانت تخلي الضجيج يبين كأنه أقسام)
    top_db = np.percentile(en_db, 95)
    energy = np.clip(1.0 - (top_db - en_db) / 15.0, 0, 1)
    sN = strength / (np.percentile(strength, 95) + 1e-9)
    sN = np.clip(sN, 0, 1)

    # الضربة الأولى بالمازورة: الطور اللي مجموع كيكه أعلى
    ph = int(np.argmax([lowS[p::bar].sum() + 0.5 * strength[p::bar].sum() for p in range(bar)]))
    down = set(range(ph, len(bi), bar))

    # الانفجارات: قدرة المازورة الجاية أعلى بـ4.5 ديسبل (≈1.7×) من المازورة اللي قبلها، وهي أعلى قفزة حولها.
    # (قبل: نسبة 1.8× على نبضتين — قفزة +7 ديسبل حقيقية طلعت 1.74 وما انكشفت)
    n_b = len(bi)
    jump = np.full(n_b, -99.0)
    for i in range(bar, n_b - bar + 1):
        before = pw[i - bar:i].mean()
        after = pw[i:i + bar].mean()
        jump[i] = 10 * np.log10((after + 1e-12) / (before + 1e-12))
    drops = []
    for i in range(bar, n_b - bar + 1):
        loc_max = jump[i] >= jump[max(0, i - 2):i + 3].max()
        loud_after = energy[min(n_b - 1, i + hb)] > 0.6
        if jump[i] >= 4.5 and loc_max and loud_after:
            if not drops or i - drops[-1] >= 2 * bar:
                drops.append(i)

    # الضربات القوية: أولى المازورة القوية + أعلى 15% قوة + الانفجارات
    thr_s = np.percentile(sN, 85)
    acc = sorted(set([i for i in down if sN[i] >= 0.45 * np.median(sN[list(down)]) + 0.1])
                 | set(np.where(sN >= thr_s)[0].tolist()) | set(drops))
    # ضربات قوية خارج الشبكة (سنير/صفقة بين نبضتين) — تنفع للقطع الحر
    from scipy.signal import find_peaks
    pk, _ = find_peaks(mix, height=0.55, distance=int(0.12 * FR))
    btimes = bi / FR
    hits = [p / FR for p in pk if np.min(np.abs(btimes - p / FR)) > 0.07]
    # كل الضربات الواضحة (على الشبكة وخارجها) بقوتها — المونتاج الحر يقطع عليها (مثل مرجع celina: القطع على صوت الضربة نفسه)
    pk2, pr2 = find_peaks(mix, height=0.12, prominence=0.08, distance=int(0.08 * FR))
    onsets = [[round(p / FR + offset + LAT, 3), round(float(h), 3)] for p, h in zip(pk2, pr2["peak_heights"])]

    T = lambda i: round(float(i) / FR + offset + LAT, 3)
    res = {
        "bpm": round(float(bpm), 2),
        "beats": [T(b) for b in bi],
        "accents": [T(bi[i]) for i in acc],
        "downbeats": [T(bi[i]) for i in sorted(down)],
        "drops": [T(bi[i]) for i in drops],
        "energy": [round(float(v), 3) for v in energy],
        "strength": [round(float(v), 3) for v in sN],
        "hits": [round(h + offset + LAT, 3) for h in hits],
        "onsets": onsets,
        "duration": round(dur, 3),
        "offset": offset,
        "bar": bar,
        "mode": "grid" if grid else "track",
        "source": os.path.basename(src),
    }
    os.makedirs(os.path.dirname(os.path.abspath(out)), exist_ok=True)
    json.dump(res, open(out, "w"), ensure_ascii=False, indent=1)

    print(f"🥁 {res['bpm']:.1f} نبضة/دقيقة · {len(res['beats'])} نبضة · "
          f"{len(res['accents'])} ضربة قوية · {len(res['drops'])} انفجار · {dur:.1f} ث")
    print("   أول النبضات:", " ".join(f"{b:.2f}" for b in res["beats"][:8]))
    print("   الضربات القوية:", " ".join(f"{b:.2f}" for b in res["accents"][:10]),
          "…" if len(res["accents"]) > 10 else "")
    if res["drops"]:
        print("   الانفجارات:", " ".join(f"{b:.2f}" for b in res["drops"]))
    if not man_bpm:
        # نص/ضعف السرعة أشهر غلطة: نقيس كم شبكة الضعف تركب على الضربات مقارنة بالحالية
        from scipy.ndimage import maximum_filter1d
        m2 = maximum_filter1d(mix, 5)
        g1, g2 = grid_fit(m2, bpm), grid_fit(m2, bpm * 2)
        if bpm < 100 and g2 >= 0.8 * g1:
            print(f"⚠️  السرعة {bpm:.0f} — ممكن الصحيحة ضعفها ({bpm*2:.0f}): شبكة الضعف تركب تقريباً بنفس القوة. "
                  f"اسمع --click؛ لو التكّة أبطأ من الطبل أعد بـ--bpm {bpm*2:.0f}")
        elif bpm > 150:
            print(f"⚠️  السرعة {bpm:.0f} — لو حسّيتها ضعف الصحيحة (القطع يطلع سريع مرّة)، أعد بـ--bpm {bpm/2:.0f}")
        elif bpm < 80:
            print(f"⚠️  السرعة {bpm:.0f} — لو حسّيتها نص الصحيحة، أعد بـ--bpm {bpm*2:.0f}")
    print(f"✅ {out}")

    if "--click" in a:
        cy = y.copy() * 0.6
        def tick(freq, amp, n=int(0.04 * SR)):
            tt = np.arange(n) / SR
            return amp * np.sin(2 * np.pi * freq * tt) * np.exp(-tt * 90)
        accset = set(acc)
        for i, b in enumerate(bi):
            s0 = int(b * HOP)
            k = tick(1800, 0.7) if i in accset else tick(1000, 0.4)
            e0 = min(len(cy), s0 + len(k))
            cy[s0:e0] += k[:e0 - s0]
        cy = np.clip(cy, -1, 1)
        cp = os.path.splitext(out)[0] + ".click.wav"
        import wave
        with wave.open(cp, "wb") as wf:
            wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(SR)
            wf.writeframes((cy * 32767).astype(np.int16).tobytes())
        print(f"🔊 {cp}  — اسمعه: التكّة لازم توقع مع الطبل. لو متأخرة/متقدمة عدّل --offset")


if __name__ == "__main__":
    main()
