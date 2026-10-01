# -*- coding: utf-8 -*-
"""🎙️ تنظيف الصوت بالذكاء الاصطناعي على الجهاز — DeepFilterNet3 (30 سبتمبر، مأخوذة من فكرة Palmier).

  python3 02c_denoise.py <work> [--strength 0.85] [--engine auto|dfn|ffmpeg]

  • dfn    → برنامج deep-filter (DeepFilterNet3 مدمج فيه، بلا بايثون ولا torch) — ينزّله
             `00_setup.sh --extras` لمجلد bin/ بالسكل. يشيل مكيّف · مروحة · شارع · صدى خفيف.
  • ffmpeg → الطريق القديم (afftdn) لو البرنامج مو موجود.

strength (0..1) = كم ديسيبل مسموح يشيل من الضجيج (حد التخفيف داخل الموديل نفسه — مو خلط بالأصل،
الخلط يرجّع الضجيج كله). 1 = بلا حد (نظيف بالكامل بس ممكن يطلع «رقيق»)، 0.85 ≈ 43dB (الافتراضي)، 0.5 ≈ 30dB. الأصل يُحفظ src_rawaudio.mov — سوّها قبل التفريغ (الخطوة 4).
"""
import os, shutil, subprocess, sys, tempfile

SR = 48000                              # DeepFilterNet يشتغل على 48 كيلو بالضبط
HERE = os.path.dirname(os.path.abspath(__file__))
CHAIN = "highpass=f=80,acompressor=threshold=-18dB:ratio=3:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=9"


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


def find_dfn():
    for c in (os.path.join(HERE, "..", "bin", "deep-filter"), os.path.join(HERE, "..", "bin", "deep-filter.exe")):
        if os.path.isfile(c) and os.access(c, os.X_OK):
            return os.path.abspath(c)
    return shutil.which("deep-filter")


def ff(*a):
    r = subprocess.run(["ffmpeg", "-v", "error", "-y", *a], capture_output=True, text=True)
    if r.returncode:
        die("ffmpeg: " + r.stderr[-300:])


def read_wav(p):
    import numpy as np, wave
    with wave.open(p) as w:
        n, ch, sw = w.getnframes(), w.getnchannels(), w.getsampwidth()
        raw = w.readframes(n)
    dt = {2: np.int16, 4: np.int32}.get(sw)
    if dt is None:                                  # float32 أو غيره → نحوّله بـffmpeg
        q = p + ".s16.wav"
        ff("-i", p, "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", q)
        return read_wav(q)
    x = np.frombuffer(raw, dt).astype(np.float32) / float(np.iinfo(dt).max)
    return x.reshape(-1, ch).mean(1) if ch > 1 else x


def lag_of(dry, wet, max_ms=200):
    """كم عيّنة يتأخّر النظيف عن الأصل (الموديل فيه تأخير داخلي) — ارتباط على أعلى 30 ثانية طاقة."""
    import numpy as np
    L = min(len(dry), len(wet), SR * 30)
    if L < SR:
        return 0
    a, b = dry[:L], wet[:L]
    n = 1 << (2 * L - 1).bit_length()
    c = np.fft.irfft(np.fft.rfft(b, n) * np.conj(np.fft.rfft(a, n)), n)
    m = int(SR * max_ms / 1000)
    cand = np.concatenate([c[:m + 1], c[-m:]])
    k = int(np.argmax(cand))
    return k if k <= m else k - len(cand)


def atten_db(s):
    return 100 if s >= 0.99 else round(12 + 36 * s)


def dfn_clean(binp, wav, tmp, s):
    """يشغّل deep-filter (-D يعوّض تأخيره) ويرجّع مسار الملف النظيف (نفس الاسم بمجلد الإخراج)."""
    od = os.path.join(tmp, "out")
    os.makedirs(od, exist_ok=True)
    r = subprocess.run([binp, "-D", "-a", str(atten_db(s)), "-o", od, wav], capture_output=True, text=True)
    out = os.path.join(od, os.path.basename(wav))
    if r.returncode or not os.path.exists(out):
        print("⚠️  deep-filter ما اشتغل:", (r.stderr or r.stdout)[-200:].strip())
        return None
    return out


def main(a):
    if not a or a[0] in ("-h", "--help"):
        print(__doc__)
        sys.exit(0)
    W = os.path.abspath(a[0])
    src, raw = os.path.join(W, "src.mov"), os.path.join(W, "src_rawaudio.mov")
    if not os.path.exists(src):
        die("ما لقيت " + src)
    if not os.path.exists(raw):
        shutil.copy2(src, raw)
    s = max(0.0, min(1.0, flag(a, "--strength", 0.85, float)))
    eng = flag(a, "--engine", "auto")
    binp = find_dfn() if eng in ("auto", "dfn") else None
    if eng == "dfn" and not binp:
        die("برنامج التنظيف مو منصّب — شغّل: bash scripts/00_setup.sh --extras")

    tmp = tempfile.mkdtemp(prefix="dfn_")
    try:
        if binp:
            import numpy as np, wave
            dry_p = os.path.join(tmp, "a.wav")
            ff("-i", raw, "-vn", "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s16le", dry_p)
            print(f"🎙️ أنظّف الصوت بالذكاء الاصطناعي على جهازك (قوة {s:.2f} · حد {atten_db(s)}dB)…", flush=True)
            wet_p = dfn_clean(binp, dry_p, tmp, s)
            if wet_p:
                dry, wet = read_wav(dry_p), read_wav(wet_p)
                lag = lag_of(dry, wet)
                if lag > 0:
                    wet = wet[lag:]
                elif lag < 0:
                    wet = np.concatenate([np.zeros(-lag, np.float32), wet])
                n = len(dry)
                wet = np.pad(wet, (0, max(0, n - len(wet))))[:n]
                mix = np.clip(wet, -1, 1)          # احتياط: لو النسخة ما عوّضت التأخير، الارتباط فوق يصلّحه
                mix_p = os.path.join(tmp, "mix.wav")
                with wave.open(mix_p, "wb") as w:
                    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
                    w.writeframes((mix * 32767).astype(np.int16).tobytes())
                ff("-i", raw, "-i", mix_p, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
                   "-af", CHAIN, "-ac", "2", "-ar", str(SR), "-c:a", "aac", "-b:a", "192k", "-shortest",
                   "-movflags", "+faststart", src)
                print(f"✅ صوت نظيف (DeepFilterNet3 · تأخير مصحّح {lag / SR * 1000:.0f}ms) — الأصل بـ src_rawaudio.mov")
                return
            print("   أكمل بالطريق العادي…")
        elif eng == "auto":
            print("ℹ️  برنامج التنظيف الذكي مو منصّب (00_setup.sh --extras) — أمشي بفلتر ffmpeg العادي.")
        ff("-i", raw, "-c:v", "copy", "-af", "highpass=f=80,afftdn=nf=-28:nt=w," + CHAIN.split(",", 1)[1],
           "-ar", str(SR), "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", src)
        print("✅ صوت محسّن محلياً (ffmpeg) — الأصل بـ src_rawaudio.mov")
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


if __name__ == "__main__":
    main(sys.argv[1:])
